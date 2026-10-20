mod application_focus;
mod commands;
mod tray;

use portglass_core::cache::SnapshotCache;
use std::sync::Arc;

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(SnapshotCache::default()))
        .invoke_handler(tauri::generate_handler![
            commands::snapshot,
            commands::focus_application
        ])
        .setup(tray::setup)
        .run(tauri::generate_context!())
        .expect("Unable to launch Portglass");
}
