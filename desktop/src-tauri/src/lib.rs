mod daemon;
mod windows;

use daemon::{
    bootstrap_via_uv, current_daemon_url, discover_or_start_daemon, discover_or_start_inner,
    restart_daemon, shutdown_managed_daemon, DaemonState,
};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, RunEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use windows::{
    close_picker_and_open_command, collapse_to_pill, expand_from_pill, get_self_pid, hide_command,
    hide_target_border, open_studio_in_browser, resize_command_window, resize_pill_window,
    show_picker, show_target_border, toggle_command_window,
};

fn register_summon_shortcut(app: &tauri::App) {
    let primary = Shortcut::new(Some(Modifiers::ALT), Code::Space);
    if app.global_shortcut().register(primary).is_ok() {
        return;
    }

    #[cfg(target_os = "macos")]
    let fallback = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyA);
    #[cfg(not(target_os = "macos"))]
    let fallback = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyA);

    let _ = app.global_shortcut().register(fallback);
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let summon_item = MenuItem::with_id(app, "summon", "召唤 AEFlow (Alt+Space)", true, None::<&str>)?;
    let pick_item = MenuItem::with_id(app, "pick_target", "选择目标窗口", true, None::<&str>)?;
    let studio_item = MenuItem::with_id(app, "open_studio", "打开 Studio 工作台", true, None::<&str>)?;
    let sep_top = PredefinedMenuItem::separator(app)?;
    let restart_item = MenuItem::with_id(app, "restart_daemon", "重启本地引擎", true, None::<&str>)?;
    let sep_bottom = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &summon_item,
            &pick_item,
            &studio_item,
            &sep_top,
            &restart_item,
            &sep_bottom,
            &quit_item,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id("aeflow-tray")
        .menu(&menu)
        .tooltip("AEFlow Desktop")
        .show_menu_on_left_click(false)
        .on_menu_event(|app_handle, event| match event.id.as_ref() {
            "summon" => toggle_command_window(app_handle),
            "pick_target" => {
                let _ = show_picker(app_handle.clone());
            }
            "open_studio" => {
                let state = app_handle.state::<DaemonState>();
                let url = current_daemon_url(&state.inner);
                let _ = open_studio_in_browser(app_handle.clone(), url);
            }
            "restart_daemon" => {
                let handle = app_handle.clone();
                let runtime = app_handle.state::<DaemonState>().inner.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    let result = discover_or_start_inner(&runtime, true);
                    let _ = handle.emit("aeflow://daemon-status", &result);
                });
            }
            "quit" => {
                let state = app_handle.state::<DaemonState>();
                shutdown_managed_daemon(&state.inner);
                app_handle.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_command_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let daemon_state = DaemonState::default();
    let cleanup_runtime = daemon_state.inner.clone();

    let app = tauri::Builder::default()
        .manage(daemon_state)
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_command_window(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            discover_or_start_daemon,
            restart_daemon,
            bootstrap_via_uv,
            get_self_pid,
            show_picker,
            close_picker_and_open_command,
            resize_command_window,
            show_target_border,
            hide_target_border,
            collapse_to_pill,
            resize_pill_window,
            expand_from_pill,
            open_studio_in_browser,
            hide_command,
        ])
        .setup(|app| {
            register_summon_shortcut(app);
            if let Err(err) = setup_tray(app) {
                eprintln!("[aeflow-desktop] Tray setup warning: {err}");
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building AEFlow Desktop application");

    app.run(move |_app_handle, event| {
        if let RunEvent::Exit = event {
            shutdown_managed_daemon(&cleanup_runtime);
        }
    });
}
