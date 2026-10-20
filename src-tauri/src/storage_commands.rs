use portglass_core::storage::{
    docker::{self, DockerUsage},
    ScanReport, StorageService,
};
use std::sync::Arc;
use tauri::State;
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
pub async fn scan_storage(
    app: tauri::AppHandle,
    service: State<'_, Arc<StorageService>>,
) -> Result<Option<ScanReport>, String> {
    let service = Arc::clone(service.inner());
    tauri::async_runtime::spawn_blocking(move || {
        let Some(folder) = app
            .dialog()
            .file()
            .set_title("Choose a folder to scan for developer storage")
            .blocking_pick_folder()
        else {
            return Ok(None);
        };
        let root = folder
            .into_path()
            .map_err(|_| "Selected folder is not a local path")?;
        service.select(&root).map(Some)
    })
    .await
    .map_err(|_| "Storage worker unavailable".to_string())?
}
#[tauri::command]
pub fn cancel_storage_scan(service: State<'_, Arc<StorageService>>) {
    service.cancel();
}
#[tauri::command]
pub async fn trash_storage_resource(
    resource_id: String,
    confirmation: String,
    service: State<'_, Arc<StorageService>>,
) -> Result<String, String> {
    let service = Arc::clone(service.inner());
    tauri::async_runtime::spawn_blocking(move || service.trash(&resource_id, &confirmation))
        .await
        .map_err(|_| "Storage worker unavailable".to_string())?
}
#[tauri::command]
pub async fn docker_storage(endpoint_id: String) -> Result<DockerUsage, String> {
    tauri::async_runtime::spawn_blocking(move || docker::collect(&endpoint_id))
        .await
        .map_err(|_| "Docker worker unavailable".to_string())?
}

#[tauri::command]
pub fn docker_endpoints() -> Vec<docker::DockerEndpoint> {
    docker::endpoints()
}

#[tauri::command]
pub async fn system_storage(service: State<'_, Arc<StorageService>>) -> Result<ScanReport, String> {
    let service = Arc::clone(service.inner());
    tauri::async_runtime::spawn_blocking(move || service.system())
        .await
        .map_err(|_| "Storage worker unavailable".to_string())?
}
#[tauri::command]
pub async fn refresh_storage(
    service: State<'_, Arc<StorageService>>,
) -> Result<ScanReport, String> {
    let service = Arc::clone(service.inner());
    tauri::async_runtime::spawn_blocking(move || service.refresh())
        .await
        .map_err(|_| "Storage worker unavailable".to_string())?
}
#[tauri::command]
pub fn cached_storage(
    service: State<'_, Arc<StorageService>>,
) -> Result<Option<ScanReport>, String> {
    service.cached()
}
#[tauri::command]
pub fn clear_storage_cache(service: State<'_, Arc<StorageService>>) -> Result<(), String> {
    service.clear_cache()
}
