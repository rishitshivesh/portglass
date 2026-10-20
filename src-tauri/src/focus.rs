use crate::{Process, Snapshot};
use std::collections::{HashMap, HashSet};

/// Correlate only fresh, unchanged process identities and same-user ancestry.
/// This authorizes foreground navigation, never termination or arbitrary launches.
pub fn verified_application_chain(
    observed: &Snapshot,
    current: &Snapshot,
    process_id: &str,
    listener_id: Option<&str>,
    user_uid: &str,
) -> Result<Vec<Process>, String> {
    if process_id.len() > 1024 || listener_id.is_some_and(|id| id.len() > 1024) {
        return Err("Invalid resource identity".into());
    }
    let expected = observed
        .processes
        .iter()
        .find(|p| p.id == process_id)
        .ok_or("Process is no longer in the observed snapshot; refresh first")?;
    if expected.uid != user_uid {
        return Err("Only your own applications can be focused".into());
    }
    let before: HashMap<_, _> = observed.processes.iter().map(|p| (p.pid, p)).collect();
    let after: HashMap<_, _> = current.processes.iter().map(|p| (p.pid, p)).collect();
    let process = after.get(&expected.pid).ok_or("Process has exited")?;
    if process.id != expected.id {
        return Err("Process identity changed; refresh before focusing".into());
    }
    if let Some(id) = listener_id {
        let endpoint = observed
            .listeners
            .iter()
            .find(|l| l.id == id && l.pid == expected.pid)
            .ok_or("Listener ownership is not verified")?;
        if !current.listeners.iter().any(|l| l.id == endpoint.id) {
            return Err("Listener ownership changed; refresh before focusing".into());
        }
    }
    let mut chain = Vec::new();
    let mut seen = HashSet::new();
    let mut pid = process.pid;
    while pid > 1 && chain.len() < 32 && seen.insert(pid) {
        let Some(current) = after.get(&pid) else {
            break;
        };
        let Some(expected) = before.get(&pid) else {
            break;
        };
        if current.id != expected.id || current.parent != expected.parent || current.uid != user_uid
        {
            break;
        }
        chain.push((*current).clone());
        pid = current.parent;
    }
    if chain.is_empty() {
        return Err("Application ancestry is unavailable".into());
    }
    Ok(chain)
}
