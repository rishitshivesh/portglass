use super::{scanner::ScanReport, system::ScanScope};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Read,
    path::PathBuf,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
#[derive(Clone, Serialize, Deserialize)]
pub(super) struct Entry {
    pub scope: ScanScope,
    pub report: ScanReport,
}
#[derive(Serialize, Deserialize)]
struct DiskCache {
    version: u8,
    entries: Vec<Entry>,
}
pub(super) struct StorageCache {
    path: PathBuf,
    entries: Mutex<Vec<Entry>>,
}
impl StorageCache {
    pub fn new(directory: PathBuf) -> Self {
        let path = directory.join("storage-v1.json");
        let entries = (|| {
            let metadata = fs::symlink_metadata(&path).ok()?;
            if !metadata.is_file()
                || metadata.file_type().is_symlink()
                || metadata.len() > 8_000_000
            {
                return None;
            }
            let mut bytes = Vec::new();
            fs::File::open(&path)
                .ok()?
                .take(8_000_001)
                .read_to_end(&mut bytes)
                .ok()?;
            let cache: DiskCache = serde_json::from_slice(&bytes).ok()?;
            (cache.version == 1 && cache.entries.len() <= 4).then_some(cache.entries)
        })()
        .unwrap_or_default();
        Self {
            path,
            entries: Mutex::new(entries),
        }
    }
    pub fn latest(&self) -> Option<Entry> {
        self.entries.lock().ok()?.last().cloned().map(sanitize)
    }
    pub fn fresh(&self, scope: &ScanScope) -> Option<ScanReport> {
        let entries = self.entries.lock().ok()?;
        let entry = entries.iter().find(|entry| &entry.scope == scope)?;
        let age = now().checked_sub(entry.report.captured_at)?;
        (age < 15 * 60).then(|| sanitize(entry.clone()).report)
    }
    pub fn store(&self, scope: ScanScope, report: &ScanReport) -> Result<(), String> {
        let mut entries = self.entries.lock().map_err(|_| "Cache unavailable")?;
        entries.retain(|entry| entry.scope != scope);
        entries.push(sanitize(Entry {
            scope,
            report: report.clone(),
        }));
        while entries.len() > 4 {
            entries.remove(0);
        }
        let bytes = serde_json::to_vec(&DiskCache {
            version: 1,
            entries: entries.clone(),
        })
        .map_err(|_| "Cache encoding failed")?;
        if bytes.len() > 8_000_000 {
            return Err("Scan is too large to cache; current results remain available".into());
        }
        let directory = self.path.parent().ok_or("Cache path unavailable")?;
        fs::create_dir_all(directory).map_err(|_| "Cache directory unavailable")?;
        let metadata =
            fs::symlink_metadata(directory).map_err(|_| "Cache directory unavailable")?;
        if !metadata.is_dir() || metadata.file_type().is_symlink() {
            return Err("Cache directory is not a local directory".into());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::{MetadataExt, PermissionsExt};
            if metadata.uid() != unsafe { libc::getuid() } {
                return Err("Cache directory belongs to another user".into());
            }
            fs::set_permissions(directory, fs::Permissions::from_mode(0o700))
                .map_err(|_| "Cache permissions unavailable")?;
        }
        let temp = directory.join(format!(
            ".storage-{}-{}.tmp",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let result = (|| {
            use std::io::Write;
            let mut options = fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut file = options.open(&temp).map_err(|_| "Cache write unavailable")?;
            file.write_all(&bytes).map_err(|_| "Cache write failed")?;
            file.sync_all().map_err(|_| "Cache flush failed")?;
            fs::rename(&temp, &self.path).map_err(|_| "Cache replace failed")
        })();
        if result.is_err() {
            let _ = fs::remove_file(temp);
        }
        result.map_err(String::from)
    }
    pub fn clear(&self) -> Result<(), String> {
        self.entries
            .lock()
            .map_err(|_| "Cache unavailable")?
            .clear();
        match fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(_) => Err("Cache file could not be removed".into()),
        }
    }
}
fn sanitize(mut entry: Entry) -> Entry {
    entry.report.cached = true;
    for (index, resource) in entry.report.resources.iter_mut().enumerate() {
        resource.id = format!("cached-{index}");
        resource.trash_allowed = false;
        resource.observed_identity = None;
    }
    entry
}
pub(super) fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicBool;
    #[test]
    fn persistent_cache_never_restores_cleanup_authority_and_can_be_cleared() {
        let root =
            std::env::temp_dir().join(format!("portglass-cache-test-{}", std::process::id()));
        fs::create_dir_all(root.join("project/node_modules")).unwrap();
        let report = crate::storage::scan(&root.join("project"), &AtomicBool::new(false)).unwrap();
        assert!(report.resources[0].trash_allowed);
        let scope = ScanScope::Folder(root.join("project"));
        let cache = StorageCache::new(root.join("cache"));
        cache.store(scope.clone(), &report).unwrap();
        let reloaded = StorageCache::new(root.join("cache"));
        let report = reloaded.fresh(&scope).unwrap();
        assert!(report.cached);
        assert!(!report.resources[0].trash_allowed);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(root.join("cache/storage-v1.json"))
                    .unwrap()
                    .permissions()
                    .mode()
                    & 0o777,
                0o600
            );
        }
        let mut expired = report.clone();
        expired.captured_at = now() - 901;
        reloaded.store(scope.clone(), &expired).unwrap();
        assert!(reloaded.fresh(&scope).is_none());
        assert!(reloaded.latest().is_some());
        reloaded.clear().unwrap();
        assert!(reloaded.latest().is_none());
        assert!(!root.join("cache/storage-v1.json").exists());
        fs::write(root.join("cache/storage-v1.json"), "malformed cache").unwrap();
        assert!(StorageCache::new(root.join("cache")).latest().is_none());
        fs::remove_dir_all(root).unwrap();
    }
}
