use serde::Serialize;
use std::sync::Mutex;
#[cfg(not(target_os = "macos"))]
use tauri::{PhysicalPosition, PhysicalSize};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Monitor, Position, Size, State,
    WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_shell::ShellExt;

pub const COMMAND_LABEL: &str = "command";
pub const PICKER_LABEL: &str = "picker";
pub const BORDER_LABEL: &str = "border";
pub const PILL_LABEL: &str = "pill";

const COMMAND_WIDTH: f64 = 688.0;
const COMMAND_MIN_HEIGHT: f64 = 156.0;
const COMMAND_MAX_HEIGHT: f64 = 620.0;

#[derive(Debug, Clone, Serialize)]
pub struct BorderUpdatePayload {
    pub label: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PillStatePayload {
    pub session_id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PickerGeometry {
    pub logical_x: f64,
    pub logical_y: f64,
    pub logical_width: f64,
    pub logical_height: f64,
    pub physical_x: i32,
    pub physical_y: i32,
    pub scale_factor: f64,
    pub os_coord_space: String, // "logical" on macOS, "physical" on Windows/Linux
}

#[derive(Default)]
pub struct OverlayState {
    pub border: Mutex<Option<BorderUpdatePayload>>,
    pub pill: Mutex<Option<PillStatePayload>>,
    pub picker_geometry: Mutex<Option<PickerGeometry>>,
}

fn os_coord_space() -> String {
    #[cfg(target_os = "macos")]
    {
        "logical".to_string()
    }
    #[cfg(not(target_os = "macos"))]
    {
        "physical".to_string()
    }
}

fn sanitize_scale(scale: f64) -> f64 {
    if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    }
}

fn read_live_picker_geometry(picker: &WebviewWindow) -> Option<PickerGeometry> {
    let pos = picker.outer_position().ok()?;
    let size = picker.inner_size().ok()?;
    if size.width == 0 || size.height == 0 {
        return None;
    }
    let scale = sanitize_scale(picker.scale_factor().unwrap_or(1.0));
    Some(PickerGeometry {
        logical_x: pos.x as f64 / scale,
        logical_y: pos.y as f64 / scale,
        logical_width: size.width as f64 / scale,
        logical_height: size.height as f64 / scale,
        physical_x: pos.x,
        physical_y: pos.y,
        scale_factor: scale,
        os_coord_space: os_coord_space(),
    })
}

fn monitor_under_cursor(app: &AppHandle) -> Option<Monitor> {
    let cursor = app.cursor_position().ok()?;
    let monitors = app.available_monitors().ok()?;
    monitors.into_iter().find(|m| {
        let pos = m.position();
        let size = m.size();
        let left = pos.x as f64;
        let top = pos.y as f64;
        let right = left + size.width as f64;
        let bottom = top + size.height as f64;
        cursor.x >= left && cursor.x < right && cursor.y >= top && cursor.y < bottom
    })
}

fn active_monitor(app: &AppHandle) -> Option<Monitor> {
    monitor_under_cursor(app)
        .or_else(|| {
            app.get_webview_window(COMMAND_LABEL)
                .and_then(|w| w.current_monitor().ok().flatten())
        })
        .or_else(|| app.primary_monitor().ok().flatten())
}

fn apply_border_bounds(border: &WebviewWindow, x: f64, y: f64, width: f64, height: f64) {
    #[cfg(target_os = "macos")]
    {
        let _ = border.set_position(Position::Logical(LogicalPosition::new(x, y)));
        let _ = border.set_size(Size::Logical(LogicalSize::new(width, height)));
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = border.set_position(Position::Physical(PhysicalPosition::new(
            x.round() as i32,
            y.round() as i32,
        )));
        let _ = border.set_size(Size::Physical(PhysicalSize::new(
            width.round() as u32,
            height.round() as u32,
        )));
    }
}

#[tauri::command]
pub fn get_border_state(state: State<'_, OverlayState>) -> Option<BorderUpdatePayload> {
    state.border.lock().ok().and_then(|g| g.clone())
}

#[tauri::command]
pub fn get_pill_state(state: State<'_, OverlayState>) -> Option<PillStatePayload> {
    state.pill.lock().ok().and_then(|g| g.clone())
}

#[tauri::command]
pub fn get_picker_geometry(
    app: AppHandle,
    state: State<'_, OverlayState>,
) -> Option<PickerGeometry> {
    if let Some(picker) = app.get_webview_window(PICKER_LABEL) {
        if let Some(live) = read_live_picker_geometry(&picker) {
            if let Ok(mut guard) = state.picker_geometry.lock() {
                *guard = Some(live.clone());
            }
            return Some(live);
        }
    }
    state.picker_geometry.lock().ok().and_then(|g| g.clone())
}

pub fn toggle_command_window(app: &AppHandle) {
    // If picker is currently open, close it cleanly first
    if let Some(picker) = app.get_webview_window(PICKER_LABEL) {
        if picker.is_visible().unwrap_or(false) {
            let _ = picker.hide();
            return;
        }
    }

    if let Some(cmd) = app.get_webview_window(COMMAND_LABEL) {
        let visible = cmd.is_visible().unwrap_or(false);
        if visible {
            let _ = cmd.hide();
        } else {
            let _ = cmd.show();
            let _ = cmd.set_focus();
            let _ = app.emit("aeflow://command-summoned", ());
        }
    }
}

pub fn show_command_window(app: &AppHandle) {
    if let Some(cmd) = app.get_webview_window(COMMAND_LABEL) {
        let _ = cmd.show();
        let _ = cmd.set_focus();
        let _ = app.emit("aeflow://command-summoned", ());
    }
}

#[tauri::command]
pub fn get_self_pid() -> u32 {
    std::process::id()
}

#[tauri::command]
pub fn hide_command(app: AppHandle) -> Result<(), String> {
    if let Some(cmd) = app.get_webview_window(COMMAND_LABEL) {
        cmd.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_picker(app: AppHandle) -> Result<(), String> {
    // Hide floating command popup while visually selecting a target
    if let Some(cmd) = app.get_webview_window(COMMAND_LABEL) {
        let _ = cmd.hide();
    }

    // Determine active monitor under cursor (falling back to command window's monitor, then primary)
    let fallback_geom = if let Some(m) = active_monitor(&app) {
        let pos = m.position();
        let size = m.size();
        let scale = sanitize_scale(m.scale_factor());
        PickerGeometry {
            logical_x: pos.x as f64 / scale,
            logical_y: pos.y as f64 / scale,
            logical_width: size.width as f64 / scale,
            logical_height: size.height as f64 / scale,
            physical_x: pos.x,
            physical_y: pos.y,
            scale_factor: scale,
            os_coord_space: os_coord_space(),
        }
    } else {
        PickerGeometry {
            logical_x: 0.0,
            logical_y: 0.0,
            logical_width: 1440.0,
            logical_height: 900.0,
            physical_x: 0,
            physical_y: 0,
            scale_factor: 1.0,
            os_coord_space: os_coord_space(),
        }
    };

    if let Some(picker) = app.get_webview_window(PICKER_LABEL) {
        let _ = picker.set_position(Position::Logical(LogicalPosition::new(
            fallback_geom.logical_x,
            fallback_geom.logical_y,
        )));
        let _ = picker.set_size(Size::Logical(LogicalSize::new(
            fallback_geom.logical_width,
            fallback_geom.logical_height,
        )));
        picker.show().map_err(|e| e.to_string())?;
        let _ = picker.set_focus();
        let geom = read_live_picker_geometry(&picker).unwrap_or(fallback_geom);
        if let Ok(mut guard) = app.state::<OverlayState>().picker_geometry.lock() {
            *guard = Some(geom.clone());
        }
        let _ = app.emit("aeflow://picker-opened", geom);
        return Ok(());
    }

    let picker = WebviewWindowBuilder::new(
        &app,
        PICKER_LABEL,
        WebviewUrl::App("index.html?view=picker".into()),
    )
    .title("AEFlow Target Picker")
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .resizable(false)
    .position(fallback_geom.logical_x, fallback_geom.logical_y)
    .inner_size(fallback_geom.logical_width, fallback_geom.logical_height)
    .focused(true)
    .build()
    .map_err(|e| format!("Failed to create picker overlay window: {e}"))?;

    let _ = picker.show();
    let _ = picker.set_focus();
    let geom = read_live_picker_geometry(&picker).unwrap_or(fallback_geom);
    if let Ok(mut guard) = app.state::<OverlayState>().picker_geometry.lock() {
        *guard = Some(geom.clone());
    }
    let _ = app.emit("aeflow://picker-opened", geom);
    Ok(())
}

#[tauri::command]
pub fn close_picker_and_open_command(
    app: AppHandle,
    target_json: String,
) -> Result<(), String> {
    if let Some(picker) = app.get_webview_window(PICKER_LABEL) {
        let _ = picker.hide();
    }

    if let Some(cmd) = app.get_webview_window(COMMAND_LABEL) {
        cmd.show().map_err(|e| e.to_string())?;
        let _ = cmd.set_focus();
    }

    if !target_json.trim().is_empty() {
        let _ = app.emit("aeflow://target-selected", target_json);
    }

    Ok(())
}

#[tauri::command]
pub fn resize_command_window(app: AppHandle, height: f64) -> Result<(), String> {
    let clamped = height.clamp(COMMAND_MIN_HEIGHT, COMMAND_MAX_HEIGHT);
    if let Some(cmd) = app.get_webview_window(COMMAND_LABEL) {
        cmd.set_size(Size::Logical(LogicalSize::new(COMMAND_WIDTH, clamped)))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_target_border(
    app: AppHandle,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    label: String,
) -> Result<(), String> {
    let safe_w = w.max(48.0);
    let safe_h = h.max(48.0);
    let payload = BorderUpdatePayload {
        label: label.clone(),
        x,
        y,
        width: safe_w,
        height: safe_h,
    };

    if let Ok(mut guard) = app.state::<OverlayState>().border.lock() {
        *guard = Some(payload.clone());
    }

    if let Some(border) = app.get_webview_window(BORDER_LABEL) {
        let _ = border.set_ignore_cursor_events(true);
        apply_border_bounds(&border, x, y, safe_w, safe_h);
        border.show().map_err(|e| e.to_string())?;
        let _ = app.emit("aeflow://border-update", payload);
        return Ok(());
    }

    let border = WebviewWindowBuilder::new(
        &app,
        BORDER_LABEL,
        WebviewUrl::App("index.html?view=border".into()),
    )
    .title("AEFlow Target Border")
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .resizable(false)
    .focused(false)
    .inner_size(safe_w, safe_h)
    .build()
    .map_err(|e| format!("Failed to create target border window: {e}"))?;

    let _ = border.set_ignore_cursor_events(true);
    apply_border_bounds(&border, x, y, safe_w, safe_h);
    let _ = border.show();
    let _ = app.emit("aeflow://border-update", payload);
    Ok(())
}

#[tauri::command]
pub fn hide_target_border(app: AppHandle) -> Result<(), String> {
    if let Some(border) = app.get_webview_window(BORDER_LABEL) {
        border.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn compute_top_center_position(app: &AppHandle, width: f64) -> (f64, f64) {
    let monitor = app
        .get_webview_window(COMMAND_LABEL)
        .and_then(|w| w.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());

    if let Some(m) = monitor {
        let pos = m.position();
        let size = m.size();
        let scale = sanitize_scale(m.scale_factor());
        let mon_x = pos.x as f64 / scale;
        let mon_y = pos.y as f64 / scale;
        let mon_w = size.width as f64 / scale;
        (mon_x + (mon_w - width) / 2.0, mon_y + 6.0)
    } else {
        (540.0, 6.0)
    }
}

#[tauri::command]
pub fn collapse_to_pill(
    app: AppHandle,
    session_id: String,
    label: String,
) -> Result<(), String> {
    if let Some(cmd) = app.get_webview_window(COMMAND_LABEL) {
        let _ = cmd.hide();
    }

    let pill_w = 408.0;
    let pill_h = 84.0;
    let (px, py) = compute_top_center_position(&app, pill_w);
    let payload = PillStatePayload { session_id, label };

    if let Ok(mut guard) = app.state::<OverlayState>().pill.lock() {
        *guard = Some(payload.clone());
    }

    if let Some(pill) = app.get_webview_window(PILL_LABEL) {
        let _ = pill.set_size(Size::Logical(LogicalSize::new(pill_w, pill_h)));
        let _ = pill.set_position(Position::Logical(LogicalPosition::new(px, py)));
        pill.show().map_err(|e| e.to_string())?;
        let _ = app.emit("aeflow://pill-state", payload);
        return Ok(());
    }

    let pill = WebviewWindowBuilder::new(
        &app,
        PILL_LABEL,
        WebviewUrl::App("index.html?view=pill".into()),
    )
    .title("AEFlow Status Pill")
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(false)
    .resizable(false)
    .focused(false)
    .position(px, py)
    .inner_size(pill_w, pill_h)
    .build()
    .map_err(|e| format!("Failed to create status pill window: {e}"))?;

    let _ = pill.show();
    let _ = app.emit("aeflow://pill-state", payload);
    Ok(())
}

#[tauri::command]
pub fn resize_pill_window(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    let clamped_w = width.clamp(320.0, 520.0);
    let clamped_h = height.clamp(76.0, 220.0);
    let (px, py) = compute_top_center_position(&app, clamped_w);

    if let Some(pill) = app.get_webview_window(PILL_LABEL) {
        pill.set_size(Size::Logical(LogicalSize::new(clamped_w, clamped_h)))
            .map_err(|e| e.to_string())?;
        let _ = pill.set_position(Position::Logical(LogicalPosition::new(px, py)));
    }
    Ok(())
}

#[tauri::command]
pub fn expand_from_pill(app: AppHandle) -> Result<(), String> {
    if let Some(pill) = app.get_webview_window(PILL_LABEL) {
        let _ = pill.hide();
    }
    show_command_window(&app);
    let _ = app.emit("aeflow://expand-command", ());
    Ok(())
}

#[tauri::command]
pub fn open_studio_in_browser(app: AppHandle, url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("Only http:// and https:// URLs are permitted.".to_string());
    }
    #[allow(deprecated)]
    app.shell()
        .open(trimmed, None)
        .map_err(|e| format!("Failed to open browser URL: {e}"))
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    let state = app.state::<crate::daemon::DaemonState>();
    crate::daemon::shutdown_managed_daemon(&state.inner);
    app.exit(0);
}
