use super::command::bounded_command;
use crate::{
    models::{Capability, Snapshot},
    parsers::{listeners::parse_listeners, processes::parse_processes},
};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

pub fn collect(processes_enabled: bool, ports_enabled: bool) -> Snapshot {
    let now = Instant::now();
    let mut snapshot = Snapshot {
        captured_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        processes: vec![],
        listeners: vec![],
        capabilities: vec![],
        platform: std::env::consts::OS.into(),
        duration_ms: 0,
    };
    for (name, enabled) in [
        ("Processes", processes_enabled),
        ("TCP listeners", ports_enabled),
    ] {
        if !enabled {
            snapshot.capabilities.push(Capability {
                name: name.into(),
                state: "disabled".into(),
                detail: "Collection disabled; previous observations discarded".into(),
            });
            continue;
        }
        if !cfg!(target_os = "macos") {
            snapshot.capabilities.push(Capability {
                name: name.into(),
                state: "unsupported".into(),
                detail: "Only the macOS adapter is implemented".into(),
            });
            continue;
        }
        let result = if name == "Processes" {
            bounded_command(
                "/bin/ps",
                &["-axo", "pid=,ppid=,uid=,lstart=,%cpu=,rss=,comm="],
            )
        } else {
            bounded_command(
                "/usr/sbin/lsof",
                &["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcuftn"],
            )
        };
        match result {
            Ok(text) => {
                if name == "Processes" {
                    snapshot.processes = parse_processes(&text);
                } else {
                    snapshot.listeners = parse_listeners(&text);
                }
                snapshot.capabilities.push(Capability{name:name.into(),state:"limited".into(),detail:if name=="Processes" {"ps metadata only. CPU is lifetime average; RSS is current. Arguments and paths are omitted."}else{"lsof snapshot; OS permissions may hide owners or listeners. IPv4 and IPv6 remain separate."}.into()});
            }
            Err(detail) => snapshot.capabilities.push(Capability {
                name: name.into(),
                state: "error".into(),
                detail,
            }),
        }
    }
    snapshot.duration_ms = now.elapsed().as_millis();
    snapshot
}
