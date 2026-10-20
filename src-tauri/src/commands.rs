use portglass_core::{
    cache::{CollectorSettings, SnapshotCache},
    Snapshot,
};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn focus_application(
    process_id: String,
    listener_id: Option<String>,
    app: tauri::AppHandle,
    cache: State<'_, Arc<SnapshotCache>>,
) -> Result<crate::application_focus::FocusReceipt, String> {
    #[cfg(not(target_os = "macos"))]
    return Err("Application focus is currently supported on macOS only".into());
    #[cfg(target_os = "macos")]
    {
        let cache = Arc::clone(cache.inner());
        tauri::async_runtime::spawn_blocking(move || {
            let observed = cache.observed_for_focus()?;
            let current = portglass_core::collect(true, listener_id.is_some());
            // SAFETY: getuid takes no pointers and reads this process's numeric user identity.
            let uid = unsafe { libc::getuid() }.to_string();
            let chain = portglass_core::focus::verified_application_chain(
                &observed,
                &current,
                &process_id,
                listener_id.as_deref(),
                &uid,
            )?;
            let (tx, rx) = std::sync::mpsc::sync_channel(1);
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
            app.run_on_main_thread(move || {
                if std::time::Instant::now() > deadline {
                    let _ = tx.send(Err("Activation request expired; try again".into()));
                    return;
                }
                let _ = tx.send(crate::application_focus::activate(&chain));
            })
            .map_err(|_| "Application activation unavailable")?;
            rx.recv_timeout(std::time::Duration::from_secs(2))
                .map_err(|_| "Application activation did not respond in time")?
        })
        .await
        .map_err(|_| "Application focus worker unavailable".to_string())?
    }
}

#[tauri::command]
pub async fn snapshot(
    processes_enabled: bool,
    ports_enabled: bool,
    cache: State<'_, Arc<SnapshotCache>>,
) -> Result<Snapshot, String> {
    let cache = Arc::clone(cache.inner());
    tauri::async_runtime::spawn_blocking(move || {
        cache.snapshot(CollectorSettings {
            processes_enabled,
            ports_enabled,
        })
    })
    .await
    .map_err(|_| "Collector worker unavailable".to_string())?
}
