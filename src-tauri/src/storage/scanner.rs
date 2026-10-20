use serde::{Deserialize, Serialize};
#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
use std::{
    collections::HashSet,
    fs,
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Resource {
    #[serde(skip)]
    pub(super) observed_identity: Option<Identity>,
    pub id: String,
    pub path: String,
    pub category: String,
    pub logical_bytes: u64,
    pub allocated_bytes: u64,
    pub complete: bool,
    pub trash_allowed: bool,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanReport {
    pub root: String,
    pub roots: Vec<String>,
    pub captured_at: u64,
    pub cached: bool,
    pub cache_note: Option<String>,
    pub resources: Vec<Resource>,
    pub entries: usize,
    pub skipped: usize,
    pub errors: usize,
    pub status: String,
    pub duration_ms: u128,
}
#[derive(Clone, PartialEq, Eq)]
pub(super) struct Identity {
    pub device: u64,
    pub inode: u64,
    changed: i64,
    nanos: i64,
    uid: u32,
}
#[cfg(unix)]
pub(super) fn identity(path: &Path) -> Result<Identity, String> {
    let m = fs::symlink_metadata(path).map_err(|_| "Resource is no longer accessible")?;
    if !m.is_dir() || m.file_type().is_symlink() {
        return Err("Resource identity changed".into());
    }
    Ok(Identity {
        device: m.dev(),
        inode: m.ino(),
        changed: m.ctime(),
        nanos: m.ctime_nsec(),
        uid: m.uid(),
    })
}
#[cfg(not(unix))]
pub(super) fn identity(_: &Path) -> Result<Identity, String> {
    Err("Storage is currently supported on macOS only".into())
}

pub(super) fn category(path: &Path) -> Option<(&'static str, bool)> {
    let name = path.file_name()?.to_str()?;
    match name {
        "node_modules" => Some(("Node dependencies", true)),
        ".venv" | "venv" if path.join("pyvenv.cfg").is_file() => Some(("Python environment", true)),
        "site-packages" => Some(("Python packages", false)),
        ".next" | ".nuxt" | ".output" => Some(("Build output", false)),
        "target"
            if path
                .parent()
                .is_some_and(|parent| parent.join("Cargo.toml").is_file()) =>
        {
            Some(("Build output", false))
        }
        "dist" | "build"
            if path.parent().is_some_and(|parent| {
                [
                    "package.json",
                    "pyproject.toml",
                    "CMakeLists.txt",
                    "build.gradle",
                    "build.gradle.kts",
                ]
                .iter()
                .any(|name| parent.join(name).is_file())
            }) =>
        {
            Some(("Build output", false))
        }
        "DerivedData" | "Archives" => Some(("Xcode build storage", false)),
        "CoreSimulator" => Some(("Apple simulators", false)),
        "sdk"
            if path
                .parent()
                .and_then(Path::file_name)
                .is_some_and(|name| name == "Android") =>
        {
            Some(("Android SDK", false))
        }
        "JetBrains" => Some(("IDE cache", false)),
        ".npm" | ".pnpm-store" | ".gradle" | "Yarn" => Some(("Package cache", false)),
        "_cacache" => Some(("Package cache", false)),
        "pip" | "uv"
            if path
                .parent()
                .and_then(Path::file_name)
                .is_some_and(|n| n == ".cache" || n == "Caches") =>
        {
            Some(("Python cache", false))
        }
        "registry"
            if path
                .parent()
                .and_then(Path::file_name)
                .is_some_and(|n| n == ".cargo" || n == "cargo") =>
        {
            Some(("Rust cache", false))
        }
        _ => None,
    }
}
fn excluded(path: &Path) -> bool {
    path.file_name().and_then(|n| n.to_str()).is_some_and(|n| {
        matches!(
            n,
            ".git" | ".ssh" | ".aws" | ".gnupg" | ".codex" | ".claude" | ".Trash" | "Library"
        )
    })
}

pub fn scan(root: &Path, cancel: &AtomicBool) -> Result<ScanReport, String> {
    scan_with_limits(root, cancel, 250_000, Duration::from_secs(30))
}
pub(super) fn scan_with_limits(
    root: &Path,
    cancel: &AtomicBool,
    max_entries: usize,
    duration: Duration,
) -> Result<ScanReport, String> {
    scan_with_seen(root, cancel, max_entries, duration, &mut HashSet::new())
}
pub(super) fn scan_with_seen(
    root: &Path,
    cancel: &AtomicBool,
    max_entries: usize,
    duration: Duration,
    seen: &mut HashSet<(u64, u64)>,
) -> Result<ScanReport, String> {
    let root = root
        .canonicalize()
        .map_err(|_| "Selected folder is inaccessible")?;
    let root_identity = identity(&root)?;
    let started = Instant::now();
    let mut report = ScanReport {
        root: root.to_string_lossy().into(),
        roots: vec![root.to_string_lossy().into()],
        captured_at: super::cache::now(),
        cached: false,
        cache_note: None,
        resources: vec![],
        entries: 0,
        skipped: 0,
        errors: 0,
        status: "complete".into(),
        duration_ms: 0,
    };
    let mut stack = vec![(root.clone(), 0usize, None::<usize>)];
    while let Some((path, depth, owner)) = stack.pop() {
        if cancel.load(Ordering::Relaxed) {
            report.status = "cancelled".into();
            break;
        }
        if report.entries >= max_entries || started.elapsed() >= duration {
            report.status = "limit-reached".into();
            break;
        }
        report.entries += 1;
        let m = match fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(_) => {
                report.errors += 1;
                if let Some(i) = owner {
                    report.resources[i].complete = false;
                }
                continue;
            }
        };
        if m.file_type().is_symlink() {
            // Account for the link itself without accessing its target. A link
            // does not make an otherwise complete resource scan incomplete.
            #[cfg(unix)]
            if seen.insert((m.dev(), m.ino())) {
                if let Some(i) = owner {
                    report.resources[i].allocated_bytes += m.blocks().saturating_mul(512);
                }
            }
            report.skipped += 1;
            continue;
        }
        if path != root && excluded(&path) {
            report.skipped += 1;
            if let Some(i) = owner {
                report.resources[i].complete = false;
            }
            continue;
        }
        #[cfg(unix)]
        if m.dev() != root_identity.device {
            report.skipped += 1;
            if let Some(i) = owner {
                report.resources[i].complete = false;
            }
            continue;
        }
        let owner = owner.or_else(|| {
            if !m.is_dir() {
                return None;
            }
            category(&path).map(|(category, allowed)| {
                let index = report.resources.len();
                report.resources.push(Resource {
                    observed_identity: identity(&path).ok(),
                    id: format!("resource-{index}"),
                    path: path.to_string_lossy().into(),
                    category: category.into(),
                    logical_bytes: 0,
                    allocated_bytes: 0,
                    complete: true,
                    trash_allowed: allowed && path != root,
                });
                index
            })
        });
        #[cfg(unix)]
        if seen.insert((m.dev(), m.ino())) {
            if let Some(i) = owner {
                if m.is_file() {
                    report.resources[i].logical_bytes += m.len();
                }
                report.resources[i].allocated_bytes += m.blocks().saturating_mul(512);
            }
        }
        if m.is_dir() {
            if depth >= 48 {
                report.skipped += 1;
                if let Some(i) = owner {
                    report.resources[i].complete = false;
                }
                continue;
            }
            match fs::read_dir(&path) {
                Ok(children) => {
                    // Bound queued paths as well as visited entries.
                    for child in children {
                        if stack.len() + report.entries >= max_entries {
                            report.status = "limit-reached".into();
                            break;
                        }
                        match child {
                            Ok(child) => stack.push((child.path(), depth + 1, owner)),
                            Err(_) => {
                                report.errors += 1;
                                if let Some(i) = owner {
                                    report.resources[i].complete = false;
                                }
                            }
                        }
                    }
                    if report.status != "complete" {
                        break;
                    }
                }
                Err(_) => {
                    report.errors += 1;
                    if let Some(i) = owner {
                        report.resources[i].complete = false;
                    }
                }
            }
        }
    }
    for resource in &mut report.resources {
        if report.status != "complete" {
            resource.complete = false;
        }
        resource.trash_allowed &= resource.complete;
    }
    report.duration_ms = started.elapsed().as_millis();
    report
        .resources
        .sort_by(|a, b| b.allocated_bytes.cmp(&a.allocated_bytes));
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    static FIXTURE_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    fn fixture() -> std::path::PathBuf {
        let p = std::env::temp_dir().join(format!(
            "portglass-storage-{}-{}-{}",
            std::process::id(),
            FIXTURE_ID.fetch_add(1, Ordering::Relaxed),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(p.join("project/node_modules/nested/node_modules")).unwrap();
        fs::write(p.join("project/node_modules/data"), vec![1; 8192]).unwrap();
        p
    }
    #[test]
    fn outer_build_folders_include_all_nested_output_without_inner_rows() {
        let root = fixture();
        fs::write(root.join("project/package.json"), "{}").unwrap();
        fs::create_dir_all(root.join("project/.next/dist/build")).unwrap();
        fs::write(
            root.join("project/.next/dist/build/artifact"),
            vec![0; 4096],
        )
        .unwrap();
        fs::create_dir_all(root.join("unrelated/build")).unwrap();
        let report = scan(&root, &AtomicBool::new(false)).unwrap();
        let builds: Vec<_> = report
            .resources
            .iter()
            .filter(|r| r.category == "Build output")
            .collect();
        assert_eq!(builds.len(), 1);
        assert!(builds[0].path.ends_with(".next"));
        assert_eq!(builds[0].logical_bytes, 4096);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn resources_do_not_overlap_and_hardlinks_are_counted_once() {
        let root = fixture();
        fs::hard_link(
            root.join("project/node_modules/data"),
            root.join("project/node_modules/copy"),
        )
        .unwrap();
        let report = scan(&root, &AtomicBool::new(false)).unwrap();
        assert_eq!(report.resources.len(), 1);
        assert_eq!(report.resources[0].logical_bytes, 8192);
        assert!(
            report.resources[0].trash_allowed,
            "status={} skipped={} errors={}",
            report.status, report.skipped, report.errors
        );
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn symlinks_are_not_followed_and_partial_scans_disable_cleanup() {
        let root = fixture();
        #[cfg(unix)]
        std::os::unix::fs::symlink("/", root.join("outside")).unwrap();
        let report = scan(&root, &AtomicBool::new(false)).unwrap();
        assert!(report.skipped > 0);
        assert!(report.resources[0].trash_allowed);
        assert_eq!(report.resources[0].logical_bytes, 8192);
        let report =
            scan_with_limits(&root, &AtomicBool::new(false), 1, Duration::from_secs(1)).unwrap();
        assert_eq!(report.status, "limit-reached");
        let report = scan(&root, &AtomicBool::new(true)).unwrap();
        assert_eq!(report.status, "cancelled");
        fs::remove_dir_all(root).unwrap();
    }
}
