use crate::{collect, Snapshot};
use std::{
    sync::Mutex,
    time::{Duration, Instant},
};

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct CollectorSettings {
    pub processes_enabled: bool,
    pub ports_enabled: bool,
}

struct CachedSnapshot {
    collected_at: Instant,
    settings: CollectorSettings,
    snapshot: Snapshot,
}

#[derive(Default)]
pub struct SnapshotCache {
    entry: Mutex<Option<CachedSnapshot>>,
}

impl SnapshotCache {
    pub fn observed_for_focus(&self) -> Result<Snapshot, String> {
        let entry = self
            .entry
            .lock()
            .map_err(|_| "Snapshot cache unavailable")?;
        let cached = entry
            .as_ref()
            .ok_or("Refresh observations before focusing an application")?;
        if !cached.settings.processes_enabled
            || cached.collected_at.elapsed() > Duration::from_secs(60)
        {
            return Err(
                "Process observation is disabled or stale; enable it and refresh first".into(),
            );
        }
        Ok(cached.snapshot.clone())
    }

    /// Keep collection serialized, including when IPC requests arrive concurrently.
    pub fn snapshot(&self, settings: CollectorSettings) -> Result<Snapshot, String> {
        let mut entry = self
            .entry
            .lock()
            .map_err(|_| "Snapshot cache unavailable")?;
        if let Some(cached) = entry.as_ref() {
            if cached.collected_at.elapsed() < Duration::from_secs(5) && cached.settings == settings
            {
                return Ok(cached.snapshot.clone());
            }
        }
        let snapshot = collect(settings.processes_enabled, settings.ports_enabled);
        *entry = Some(CachedSnapshot {
            collected_at: Instant::now(),
            settings,
            snapshot: snapshot.clone(),
        });
        Ok(snapshot)
    }
}
