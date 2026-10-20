use super::scanner::{scan_with_seen, ScanReport};
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::atomic::AtomicBool,
    time::{Duration, Instant},
};
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(super) enum ScanScope {
    Folder(PathBuf),
    DeveloperLocations,
}
pub(super) fn roots(home: &Path) -> Vec<PathBuf> {
    let locations = [
        "Projects",
        "Developer",
        ".npm",
        ".pnpm-store",
        ".cache/pip",
        ".cache/uv",
        ".cargo/registry",
        "Library/Developer/Xcode/DerivedData",
        "Library/Developer/Xcode/Archives",
        "Library/Developer/CoreSimulator",
        "Library/Android/sdk",
        "Library/Caches/JetBrains",
        "Library/Caches/pip",
        "Library/Caches/uv",
        "Library/Caches/Yarn",
    ];
    let mut roots: Vec<PathBuf> = vec![];
    for location in locations {
        if let Ok(path) = home.join(location).canonicalize() {
            if path.is_dir() && !roots.iter().any(|root| path.starts_with(root)) {
                roots.push(path);
            }
        }
    }
    roots
}
pub(super) fn scan(home: &Path, cancel: &AtomicBool) -> Result<ScanReport, String> {
    let started = Instant::now();
    let roots = roots(home);
    if roots.is_empty() {
        return Err("No common developer locations found. Choose a scan root instead.".into());
    }
    let mut report = ScanReport {
        root: "Common developer locations".into(),
        roots: roots.iter().map(|p| p.to_string_lossy().into()).collect(),
        resources: vec![],
        entries: 0,
        skipped: 0,
        errors: 0,
        status: "complete".into(),
        duration_ms: 0,
        captured_at: super::cache::now(),
        cached: false,
        cache_note: None,
    };
    // Small shared-cache/SDK locations first, so a very large Projects tree
    // cannot conceal all other developer footprint behind the scan budget.
    let mut seen = std::collections::HashSet::new();
    for root in roots.iter().rev() {
        let remaining = 250_000usize.saturating_sub(report.entries);
        let duration = Duration::from_secs(30).saturating_sub(started.elapsed());
        if remaining == 0 || duration.is_zero() {
            report.status = "limit-reached".into();
            break;
        }
        match scan_with_seen(root, cancel, remaining, duration, &mut seen) {
            Ok(child) => {
                report.entries += child.entries;
                report.skipped += child.skipped;
                report.errors += child.errors;
                report.resources.extend(child.resources);
                if child.status != "complete" {
                    report.status = child.status;
                    break;
                }
            }
            Err(_) => report.errors += 1,
        }
    }
    if report.status != "complete" {
        for resource in &mut report.resources {
            resource.complete = false;
            resource.trash_allowed = false;
        }
    }
    for (index, resource) in report.resources.iter_mut().enumerate() {
        resource.id = format!("resource-{index}");
    }
    report
        .resources
        .sort_by(|a, b| b.allocated_bytes.cmp(&a.allocated_bytes));
    report.duration_ms = started.elapsed().as_millis();
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn system_scans_share_hardlink_accounting_across_roots() {
        let home =
            std::env::temp_dir().join(format!("portglass-system-test-{}", std::process::id()));
        std::fs::create_dir_all(home.join("Projects/app/node_modules")).unwrap();
        std::fs::create_dir_all(home.join(".npm")).unwrap();
        std::fs::write(home.join(".npm/data"), vec![1; 8192]).unwrap();
        std::fs::hard_link(
            home.join(".npm/data"),
            home.join("Projects/app/node_modules/data"),
        )
        .unwrap();
        let report = scan(&home, &AtomicBool::new(false)).unwrap();
        assert_eq!(
            report
                .resources
                .iter()
                .map(|r| r.logical_bytes)
                .sum::<u64>(),
            8192
        );
        assert_eq!(report.roots.len(), 2);
        std::fs::remove_dir_all(home).unwrap();
    }
}
