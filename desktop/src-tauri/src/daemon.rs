use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const INSTALL_HINT: &str = "uv tool install agenteverywhereflow";

#[derive(Debug, Default)]
pub struct DaemonRuntime {
    pub child: Option<Child>,
    pub url: Option<String>,
    pub mode: String,
    pub port: Option<u16>,
}

#[derive(Clone, Default)]
pub struct DaemonState {
    pub inner: Arc<Mutex<DaemonRuntime>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonDiscoveryResult {
    pub url: Option<String>,
    pub mode: String,
    pub install_hint: String,
    pub has_uv: bool,
    pub version: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
    pub daemon: Option<DaemonDiscoveryResult>,
}

#[derive(Debug, Deserialize)]
struct DaemonJson {
    #[allow(dead_code)]
    pid: Option<u32>,
    host: Option<String>,
    port: Option<u16>,
    #[allow(dead_code)]
    version: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HealthPayload {
    status: Option<String>,
    version: Option<String>,
}

fn normalize_host(host: &str) -> &str {
    match host.trim() {
        "" | "0.0.0.0" | "localhost" | "::" => "127.0.0.1",
        other => other,
    }
}

/// Lightweight zero-dependency HTTP/1.1 health probe for localhost AEFlow daemon.
pub fn probe_health(host: &str, port: u16, timeout_ms: u64) -> Option<Option<String>> {
    let normalized = normalize_host(host);
    let addr_str = format!("{normalized}:{port}");
    let addr: SocketAddr = addr_str.parse().ok()?;
    let timeout = Duration::from_millis(timeout_ms);

    let mut stream = TcpStream::connect_timeout(&addr, timeout).ok()?;
    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));

    let req = format!(
        "GET /api/v1/health HTTP/1.1\r\nHost: {normalized}:{port}\r\nAccept: application/json\r\nConnection: close\r\n\r\n"
    );
    stream.write_all(req.as_bytes()).ok()?;

    let mut buf = Vec::with_capacity(1024);
    let mut chunk = [0u8; 1024];
    loop {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                buf.extend_from_slice(&chunk[..n]);
                if buf.len() > 16_384 {
                    break;
                }
            }
            Err(_) => break,
        }
    }

    let response = String::from_utf8_lossy(&buf);
    let first_line = response.lines().next()?;
    if !first_line.contains(" 200") {
        return None;
    }

    if let Some((_, body)) = response.split_once("\r\n\r\n") {
        if let Ok(parsed) = serde_json::from_str::<HealthPayload>(body.trim()) {
            if parsed.status.as_deref() == Some("ok") {
                return Some(parsed.version);
            }
        }
        if body.contains("\"ok\"") {
            return Some(None);
        }
    }
    None
}

fn read_daemon_json() -> Option<(String, u16)> {
    let path = dirs::home_dir()?.join(".aef").join("daemon.json");
    let raw = fs::read_to_string(path).ok()?;
    let parsed: DaemonJson = serde_json::from_str(&raw).ok()?;

    if let Some(port) = parsed.port {
        let host = parsed
            .host
            .as_deref()
            .map(normalize_host)
            .unwrap_or("127.0.0.1")
            .to_string();
        return Some((host, port));
    }

    if let Some(url) = parsed.url {
        let trimmed = url
            .trim()
            .trim_start_matches("http://")
            .trim_start_matches("https://");
        let host_port = trimmed.split('/').next().unwrap_or("");
        if let Some((h, p_str)) = host_port.rsplit_once(':') {
            if let Ok(port) = p_str.parse::<u16>() {
                return Some((normalize_host(h).to_string(), port));
            }
        }
    }

    None
}

fn candidate_bin_dirs() -> Vec<PathBuf> {
    let mut dirs_list = Vec::new();
    if let Some(path_var) = env::var_os("PATH") {
        dirs_list.extend(env::split_paths(&path_var));
    }
    if let Some(home) = dirs::home_dir() {
        dirs_list.push(home.join(".local").join("bin"));
        dirs_list.push(home.join(".cargo").join("bin"));
        #[cfg(target_os = "macos")]
        {
            dirs_list.push(PathBuf::from("/opt/homebrew/bin"));
            dirs_list.push(PathBuf::from("/usr/local/bin"));
        }
        #[cfg(target_os = "windows")]
        {
            dirs_list.push(home.join("AppData").join("Local").join("Programs").join("uv"));
        }
    }
    dirs_list
}

pub fn find_executable(name: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let names = [format!("{name}.exe"), format!("{name}.cmd"), name.to_string()];
    #[cfg(not(target_os = "windows"))]
    let names = [name.to_string()];

    for dir in candidate_bin_dirs() {
        for candidate_name in &names {
            let full = dir.join(candidate_name);
            if full.is_file() {
                return Some(full);
            }
        }
    }
    None
}

fn find_free_port() -> Option<u16> {
    let listener = TcpListener::bind("127.0.0.1:0").ok()?;
    listener.local_addr().ok().map(|addr| addr.port())
}

pub fn shutdown_managed_daemon(state: &Arc<Mutex<DaemonRuntime>>) {
    if let Ok(mut guard) = state.lock() {
        if let Some(mut child) = guard.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        guard.url = None;
        guard.port = None;
        guard.mode.clear();
    }
}

pub fn current_daemon_url(state: &Arc<Mutex<DaemonRuntime>>) -> String {
    if let Ok(guard) = state.lock() {
        if let Some(ref url) = guard.url {
            return url.clone();
        }
    }
    if let Some((host, port)) = read_daemon_json() {
        if probe_health(&host, port, 300).is_some() {
            return format!("http://{host}:{port}");
        }
    }
    "http://127.0.0.1:8000".to_string()
}

fn spawn_and_wait(
    program: &PathBuf,
    args: &[String],
    port: u16,
    wait_timeout: Duration,
) -> Option<(Child, Option<String>)> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().ok()?;
    let deadline = Instant::now() + wait_timeout;

    while Instant::now() < deadline {
        if let Some(version) = probe_health("127.0.0.1", port, 300) {
            return Some((child, version));
        }
        if let Ok(Some(_exit_status)) = child.try_wait() {
            return None;
        }
        thread::sleep(Duration::from_millis(200));
    }

    let _ = child.kill();
    let _ = child.wait();
    None
}

pub fn discover_or_start_inner(
    state: &Arc<Mutex<DaemonRuntime>>,
    force_restart: bool,
) -> DaemonDiscoveryResult {
    let has_uv = find_executable("uv").is_some();

    if force_restart {
        shutdown_managed_daemon(state);
    } else {
        // 0. Check currently tracked runtime first
        let tracked = state
            .lock()
            .ok()
            .and_then(|g| g.port.map(|p| (p, g.mode.clone())));
        if let Some((port, mode)) = tracked {
            if let Some(version) = probe_health("127.0.0.1", port, 350) {
                return DaemonDiscoveryResult {
                    url: Some(format!("http://127.0.0.1:{port}")),
                    mode: if mode.is_empty() {
                        "attached".to_string()
                    } else {
                        mode
                    },
                    install_hint: INSTALL_HINT.to_string(),
                    has_uv,
                    version,
                    message: None,
                };
            }
        }
    }

    // 1. Check ~/.aef/daemon.json and attach transparently if alive
    if !force_restart {
        if let Some((host, port)) = read_daemon_json() {
            if let Some(version) = probe_health(&host, port, 400) {
                let url = format!("http://{host}:{port}");
                if let Ok(mut guard) = state.lock() {
                    guard.url = Some(url.clone());
                    guard.port = Some(port);
                    guard.mode = "attached".to_string();
                }
                return DaemonDiscoveryResult {
                    url: Some(url),
                    mode: "attached".to_string(),
                    install_hint: INSTALL_HINT.to_string(),
                    has_uv,
                    version,
                    message: Some("Attached to running daemon via ~/.aef/daemon.json".to_string()),
                };
            }
        }

        // Also check default port 8000 in case an older `aef serve` instance is already live
        if let Some(version) = probe_health("127.0.0.1", 8000, 250) {
            let url = "http://127.0.0.1:8000".to_string();
            if let Ok(mut guard) = state.lock() {
                guard.url = Some(url.clone());
                guard.port = Some(8000);
                guard.mode = "attached".to_string();
            }
            return DaemonDiscoveryResult {
                url: Some(url),
                mode: "attached".to_string(),
                install_hint: INSTALL_HINT.to_string(),
                has_uv,
                version,
                message: Some("Attached to local daemon on port 8000".to_string()),
            };
        }
    }

    // 2. Spawn managed `aef serve` (preferring installed `aef`, falling back to `uvx`)
    let port = match find_free_port() {
        Some(p) => p,
        None => {
            return DaemonDiscoveryResult {
                url: None,
                mode: "missing_backend".to_string(),
                install_hint: INSTALL_HINT.to_string(),
                has_uv,
                version: None,
                message: Some("Failed to allocate local TCP port".to_string()),
            };
        }
    };

    if let Some(aef_bin) = find_executable("aef") {
        let args = vec![
            "serve".to_string(),
            "--host".to_string(),
            "127.0.0.1".to_string(),
            "--port".to_string(),
            port.to_string(),
        ];
        if let Some((child, version)) = spawn_and_wait(&aef_bin, &args, port, Duration::from_secs(10))
        {
            let url = format!("http://127.0.0.1:{port}");
            if let Ok(mut guard) = state.lock() {
                guard.child = Some(child);
                guard.url = Some(url.clone());
                guard.port = Some(port);
                guard.mode = "spawned".to_string();
            }
            return DaemonDiscoveryResult {
                url: Some(url),
                mode: "spawned".to_string(),
                install_hint: INSTALL_HINT.to_string(),
                has_uv,
                version,
                message: Some(format!("Spawned managed daemon via {}", aef_bin.display())),
            };
        }
    }

    if let Some(uvx_bin) = find_executable("uvx") {
        let args = vec![
            "agenteverywhereflow".to_string(),
            "serve".to_string(),
            "--host".to_string(),
            "127.0.0.1".to_string(),
            "--port".to_string(),
            port.to_string(),
        ];
        if let Some((child, version)) = spawn_and_wait(&uvx_bin, &args, port, Duration::from_secs(12))
        {
            let url = format!("http://127.0.0.1:{port}");
            if let Ok(mut guard) = state.lock() {
                guard.child = Some(child);
                guard.url = Some(url.clone());
                guard.port = Some(port);
                guard.mode = "spawned".to_string();
            }
            return DaemonDiscoveryResult {
                url: Some(url),
                mode: "spawned".to_string(),
                install_hint: INSTALL_HINT.to_string(),
                has_uv,
                version,
                message: Some("Spawned managed daemon via uvx".to_string()),
            };
        }
    }

    DaemonDiscoveryResult {
        url: None,
        mode: "missing_backend".to_string(),
        install_hint: INSTALL_HINT.to_string(),
        has_uv,
        version: None,
        message: Some(
            "Local AEFlow daemon not found. Install via `uv tool install agenteverywhereflow`."
                .to_string(),
        ),
    }
}

#[tauri::command]
pub async fn discover_or_start_daemon(
    state: State<'_, DaemonState>,
) -> Result<DaemonDiscoveryResult, String> {
    let runtime = state.inner.clone();
    tauri::async_runtime::spawn_blocking(move || discover_or_start_inner(&runtime, false))
        .await
        .map_err(|e| format!("Daemon discovery task failed: {e}"))
}

#[tauri::command]
pub async fn restart_daemon(
    app: AppHandle,
    state: State<'_, DaemonState>,
) -> Result<DaemonDiscoveryResult, String> {
    let runtime = state.inner.clone();
    let res = tauri::async_runtime::spawn_blocking(move || discover_or_start_inner(&runtime, true))
        .await
        .map_err(|e| format!("Daemon restart task failed: {e}"))?;
    let _ = app.emit("aeflow://daemon-status", &res);
    Ok(res)
}

#[tauri::command]
pub async fn bootstrap_via_uv(
    app: AppHandle,
    state: State<'_, DaemonState>,
) -> Result<BootstrapResult, String> {
    let runtime = state.inner.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let uv_bin = match find_executable("uv") {
            Some(bin) => bin,
            None => {
                return BootstrapResult {
                    success: false,
                    output: String::new(),
                    error: Some(
                        "uv is not installed on PATH. Install uv from https://docs.astral.sh/uv/ first."
                            .to_string(),
                    ),
                    daemon: None,
                };
            }
        };

        let _ = app.emit(
            "aeflow://bootstrap-log",
            "Running `uv tool install agenteverywhereflow`...",
        );

        let mut cmd = Command::new(&uv_bin);
        cmd.args(["tool", "install", "agenteverywhereflow"]);
        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        match cmd.output() {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                let combined = format!("{stdout}\n{stderr}").trim().to_string();

                if out.status.success() {
                    let _ = app.emit(
                        "aeflow://bootstrap-log",
                        "Installed successfully. Starting local AEFlow engine...",
                    );
                    let daemon = discover_or_start_inner(&runtime, false);
                    let _ = app.emit("aeflow://daemon-status", &daemon);
                    BootstrapResult {
                        success: true,
                        output: combined,
                        error: None,
                        daemon: Some(daemon),
                    }
                } else {
                    BootstrapResult {
                        success: false,
                        output: combined.clone(),
                        error: Some(if combined.is_empty() {
                            format!("uv exited with status {}", out.status)
                        } else {
                            combined
                        }),
                        daemon: None,
                    }
                }
            }
            Err(err) => BootstrapResult {
                success: false,
                output: String::new(),
                error: Some(format!("Failed to launch uv: {err}")),
                daemon: None,
            },
        }
    })
    .await
    .map_err(|e| format!("Bootstrap task failed: {e}"))
}
