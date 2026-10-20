use super::{
    cache::StorageCache,
    scanner::{category, identity, scan, Identity, ScanReport},
    system::{self, ScanScope},
};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
struct Target {
    path: PathBuf,
    chain: Vec<(PathBuf, Identity)>,
}
struct Observed {
    at: Instant,
    targets: HashMap<String, Target>,
}
#[derive(Default)]
pub struct StorageService {
    busy: AtomicBool,
    generation: AtomicU64,
    cancel: AtomicBool,
    observed: Mutex<Option<Observed>>,
    cache: Option<StorageCache>,
    last_scope: Mutex<Option<ScanScope>>,
}
struct Busy<'a>(&'a AtomicBool);
impl Drop for Busy<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
impl StorageService {
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::Relaxed);
    }
    pub fn with_cache(directory: PathBuf) -> Self {
        Self {
            cache: Some(StorageCache::new(directory)),
            ..Self::default()
        }
    }
    pub fn scan(&self, root: &Path) -> Result<ScanReport, String> {
        self.scan_scope(
            ScanScope::Folder(
                root.canonicalize()
                    .map_err(|_| "Selected folder unavailable")?,
            ),
            true,
        )
    }
    pub fn select(&self, root: &Path) -> Result<ScanReport, String> {
        self.scan_scope(
            ScanScope::Folder(
                root.canonicalize()
                    .map_err(|_| "Selected folder unavailable")?,
            ),
            false,
        )
    }
    pub fn system(&self) -> Result<ScanReport, String> {
        self.scan_scope(ScanScope::DeveloperLocations, false)
    }
    pub fn refresh(&self) -> Result<ScanReport, String> {
        let scope = self
            .last_scope
            .lock()
            .map_err(|_| "Storage unavailable")?
            .clone()
            .ok_or("Choose a scan root first")?;
        self.scan_scope(scope, true)
    }
    pub fn cached(&self) -> Result<Option<ScanReport>, String> {
        if self.busy.swap(true, Ordering::AcqRel) {
            return Err("Storage operation in progress".into());
        }
        let _guard = Busy(&self.busy);
        let Some(entry) = self.cache.as_ref().and_then(StorageCache::latest) else {
            return Ok(None);
        };
        *self.last_scope.lock().map_err(|_| "Storage unavailable")? = Some(entry.scope);
        *self.observed.lock().map_err(|_| "Storage unavailable")? = None;
        Ok(Some(entry.report))
    }
    pub fn clear_cache(&self) -> Result<(), String> {
        if self.busy.swap(true, Ordering::AcqRel) {
            return Err("Storage operation in progress".into());
        }
        let _guard = Busy(&self.busy);
        if let Some(cache) = &self.cache {
            cache.clear()?;
        }
        *self.observed.lock().map_err(|_| "Storage unavailable")? = None;
        Ok(())
    }
    fn scan_scope(&self, scope: ScanScope, force: bool) -> Result<ScanReport, String> {
        if self.busy.swap(true, Ordering::AcqRel) {
            return Err("A storage operation is already running".into());
        }
        let _guard = Busy(&self.busy);
        self.cancel.store(false, Ordering::Relaxed);
        *self
            .observed
            .lock()
            .map_err(|_| "Storage state unavailable")? = None;
        *self
            .last_scope
            .lock()
            .map_err(|_| "Storage state unavailable")? = Some(scope.clone());
        if !force {
            if let Some(report) = self.cache.as_ref().and_then(|cache| cache.fresh(&scope)) {
                return Ok(report);
            }
        }
        let mut report = match &scope {
            ScanScope::Folder(root) => scan(root, &self.cancel)?,
            ScanScope::DeveloperLocations => system::scan(
                &std::env::var_os("HOME")
                    .map(PathBuf::from)
                    .ok_or("Home directory unavailable")?,
                &self.cancel,
            )?,
        };
        let generation = self.generation.fetch_add(1, Ordering::Relaxed);
        let mut targets = HashMap::new();
        for resource in &mut report.resources {
            resource.id = format!("scan-{generation}-{}", resource.id);
            if resource.trash_allowed {
                let path = PathBuf::from(&resource.path);
                match chain(&path) {
                    Ok(chain) if resource.observed_identity.as_ref() == Some(&chain[0].1) => {
                        targets.insert(resource.id.clone(), Target { path, chain });
                    }
                    _ => resource.trash_allowed = false,
                }
            }
        }
        *self
            .observed
            .lock()
            .map_err(|_| "Storage state unavailable")? = Some(Observed {
            at: Instant::now(),
            targets,
        });
        if report.status != "cancelled" {
            if let Some(cache) = &self.cache {
                if let Err(error) = cache.store(scope, &report) {
                    report.cache_note = Some(error);
                }
            }
        }
        Ok(report)
    }
    pub fn trash(&self, id: &str, confirmation: &str) -> Result<String, String> {
        if self.busy.swap(true, Ordering::AcqRel) {
            return Err("A storage operation is already running".into());
        }
        let _guard = Busy(&self.busy);
        let mut state = self
            .observed
            .lock()
            .map_err(|_| "Storage state unavailable")?;
        let observed = state.as_mut().ok_or("Scan a folder before cleanup")?;
        if observed.at.elapsed() > Duration::from_secs(120) {
            return Err("Scan expired; scan again before cleanup".into());
        }
        let target = observed
            .targets
            .get(id)
            .ok_or("Resource is not approved for cleanup")?;
        validate(target, confirmation)?;
        // Native Trash only. Never fall back to permanent deletion.
        let mut trash_context = trash::TrashContext::default();
        #[cfg(target_os = "macos")]
        {
            use trash::macos::{DeleteMethod, TrashContextExtMacos};
            trash_context.set_delete_method(DeleteMethod::NsFileManager);
        }
        trash_context.delete(&target.path).map_err(|_| {
            "macOS could not move the resource to Trash; no permanent deletion was attempted"
        })?;
        let absent = std::fs::symlink_metadata(&target.path)
            .is_err_and(|error| error.kind() == std::io::ErrorKind::NotFound);
        *state = None;
        if let Some(cache) = &self.cache {
            let _ = cache.clear();
        }
        if !absent {
            return Err("Trash returned but a path still exists here; scan again to verify".into());
        }
        Ok("Moved to Trash. Restore through Finder if needed. Scan again to update sizes; disk space is not freed until Trash is emptied.".into())
    }
}
fn chain(path: &Path) -> Result<Vec<(PathBuf, Identity)>, String> {
    path.ancestors()
        .map(|p| Ok((p.to_path_buf(), identity(p)?)))
        .collect()
}
fn validate(target: &Target, confirmation: &str) -> Result<(), String> {
    if target.path.file_name().and_then(|s| s.to_str()) != Some(confirmation) {
        return Err("Type the exact directory name to confirm".into());
    }
    if !category(&target.path).is_some_and(|(_, allowed)| allowed) {
        return Err("Resource is not eligible for cleanup".into());
    }
    for (index, (path, expected)) in target.chain.iter().enumerate() {
        let current = identity(path)?;
        // Parent directory timestamps change for unrelated siblings. Device/inode
        // is sufficient there; the target's own timestamp must also match.
        if index == 0 && current != *expected
            || index > 0 && (current.device != expected.device || current.inode != expected.inode)
        {
            return Err("Resource or an ancestor changed; scan again".into());
        }
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        // SAFETY: getuid reads the process UID without pointers.
        if std::fs::symlink_metadata(&target.path)
            .map_err(|_| "Resource unavailable")?
            .uid()
            != unsafe { libc::getuid() }
        {
            return Err("Only resources owned by your user can be moved to Trash".into());
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reading_cached_data_revokes_live_cleanup_authority() {
        let root =
            std::env::temp_dir().join(format!("portglass-cache-authority-{}", std::process::id()));
        std::fs::create_dir_all(root.join("project/node_modules")).unwrap();
        let service = StorageService::with_cache(root.join("cache"));
        let fresh = service.scan(&root.join("project")).unwrap();
        assert!(fresh.resources[0].trash_allowed);
        let cached = service.cached().unwrap().unwrap();
        assert!(cached.cached);
        assert!(!cached.resources[0].trash_allowed);
        assert_ne!(fresh.resources[0].id, cached.resources[0].id);
        assert!(service.observed.lock().unwrap().is_none());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn cleanup_ids_expire_and_are_not_reused_between_scans() {
        let root = std::env::temp_dir().join(format!("portglass-expiry-{}", std::process::id()));
        std::fs::create_dir_all(root.join("node_modules")).unwrap();
        let service = StorageService::default();
        let first = service.scan(&root).unwrap();
        let old_id = first.resources[0].id.clone();
        let second = service.scan(&root).unwrap();
        assert_ne!(old_id, second.resources[0].id);
        assert!(service.trash(&old_id, "node_modules").is_err());
        service.observed.lock().unwrap().as_mut().unwrap().at =
            Instant::now() - Duration::from_secs(121);
        assert!(service
            .trash(&second.resources[0].id, "node_modules")
            .unwrap_err()
            .contains("expired"));
        let selected_resource = service.scan(&root.join("node_modules")).unwrap();
        assert!(!selected_resource.resources[0].trash_allowed);
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn rejects_replacement_and_wrong_confirmation() {
        let root = std::env::temp_dir().join(format!("portglass-identity-{}", std::process::id()));
        std::fs::create_dir_all(root.join("node_modules")).unwrap();
        let root = root.canonicalize().unwrap();
        let path = root.join("node_modules");
        let target = Target {
            chain: chain(&path).unwrap(),
            path: path.clone(),
        };
        assert!(validate(&target, "no").is_err());
        assert!(validate(&target, "node_modules").is_ok());
        std::fs::rename(&path, root.join("old")).unwrap();
        std::fs::create_dir(&path).unwrap();
        assert!(validate(&target, "node_modules").is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
