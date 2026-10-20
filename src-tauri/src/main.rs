mod application_focus;
mod commands;
mod instance;
mod lifecycle;
mod storage_commands;
mod tray;

use portglass_core::cache::SnapshotCache;
use std::sync::Arc;
use tauri::Manager;

fn main() {
    let mut instance = match instance::Instance::claim() {
        Ok(instance::Claim::Existing) => return,
        Ok(instance::Claim::Primary(instance)) => instance,
        Err(error) => {
            eprintln!("Portglass: {error}");
            std::process::exit(1);
        }
    };
    if std::env::args().any(|arg| arg == "--activate-existing") {
        drop(instance);
        std::process::exit(42);
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Arc::new(SnapshotCache::default()))
        .invoke_handler(tauri::generate_handler![
            commands::snapshot,
            commands::focus_application,
            storage_commands::scan_storage,
            storage_commands::cancel_storage_scan,
            storage_commands::trash_storage_resource,
            storage_commands::docker_storage,
            storage_commands::docker_endpoints,
            storage_commands::system_storage,
            storage_commands::refresh_storage,
            storage_commands::cached_storage,
            storage_commands::clear_storage_cache
        ])
        .setup(move |app| {
            instance.listen(app.handle().clone());
            app.manage(instance);
            let directory = app.path().app_cache_dir()?;
            app.manage(Arc::new(
                portglass_core::storage::StorageService::with_cache(directory),
            ));
            lifecycle::setup(app)
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("Unable to launch Portglass")
        .run(|app, event| {
            if let tauri::RunEvent::Reopen { .. } = event {
                lifecycle::show(app);
            }
        });
}
