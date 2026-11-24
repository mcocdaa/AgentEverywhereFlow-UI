use serde::Serialize;
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize,
    Position, Size, State, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_shell::ShellExt;

pub const COMMAND_LABEL: &str = "command";
pub const PICKER_LABEL: &str = "picker";
pub const BORDER_LABEL: &str = "border";
pub const PILL_LABEL: &str = "pill";

const COMMAND_WIDTH: f64 = 640.0;
const COMMAND_MIN_HEIGHT: f64 = 108.0;
const COMMAND_MAX_HEIGHT: f64 = 540.0;

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

#[derive(Default)]
pub struct OverlayState {
    pub border: Mutex<Option<BorderUpdatePayload>>,
    pub pill: Mutex<Option<PillStatePayload>>,
}

#[tauri::command]
pub fn get_border_state(state: State<'_, OverlayState>) -> Option<BorderUpdatePayload> {
    state.border.lock().ok().and_then(|g| g.clone())
}

#[tauri::command]
pub fn get_pill_state(state: State<'_, OverlayState>) -> Option<PillStatePayload> {
    state.pill.lock().ok().and_then(|g| g.clone())
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

    // Determine active monitor geometry for fullscreen transparent picker overlay
    let monitor = app
        .get_webview_window(COMMAND_LABEL)
        .and_then(|w| w.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());

    let (pos_x, pos_y, width, height) = if let Some(m) = monitor {
        let pos = m.position();
        let size = m.size();
        let scale = m.scale_factor();
        (
            pos.x as f64 / scale,
            pos.y as f64 / scale,
            size.width as f64 / scale,
            size.height as f64 / scale,
        )
    } else {
        (0.0, 0.0, 1440.0, 900.0)
    };

    if let Some(picker) = app.get_webview_window(PICKER_LABEL) {
        let _ = picker.set_position(Position::Logical(LogicalPosition::new(pos_x, pos_y)));
        let _ = picker.set_size(Size::Logical(LogicalSize::new(width, height)));
        picker.show().map_err(|e| e.to_string())?;
        let _ = picker.set_focus();
        let _ = app.emit("aeflow://picker-opened", ());
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
    .position(pos_x, pos_y)
    .inner_size(width, height)
    .focused(true)
    .build()
    .map_err(|e| format!("Failed to create picker overlay window: {e}"))?;

    let _ = picker.show();
    let _ = picker.set_focus();
    let _ = app.emit("aeflow://picker-opened", ());
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
        let _ = border.set_position(Position::Physical(PhysicalPosition::new(
            x.round() as i32,
            y.round() as i32,
        )));
        let _ = border.set_size(Size::Physical(PhysicalSize::new(
            safe_w.round() as u32,
            safe_h.round() as u32,
        )));
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
    let _ = border.set_position(Position::Physical(PhysicalPosition::new(
        x.round() as i32,
        y.round() as i32,
    )));
    let _ = border.set_size(Size::Physical(PhysicalSize::new(
        safe_w.round() as u32,
        safe_h.round() as u32,
    )));
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
        let scale = m.scale_factor();
        let mon_x = pos.x as f64 / scale;
        let mon_y = pos.y as f64 / scale;
        let mon_w = size.width as f64 / scale;
        (mon_x + (mon_w - width) / 2.0, mon_y + 14.0)
    } else {
        (540.0, 14.0)
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

    let pill_w = 360.0;
    let pill_h = 44.0;
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
    let clamped_w = width.clamp(280.0, 460.0);
    let clamped_h = height.clamp(40.0, 172.0);
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
