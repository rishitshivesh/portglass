use super::*;
use crate::{
    agents::detect_agent,
    collectors::command::bounded_command,
    parsers::{listeners::parse_listeners, processes::parse_processes},
};
use std::time::{Duration, Instant};

fn focus_fixture() -> Snapshot {
    let mut snapshot = collect(false, false);
    snapshot.processes = parse_processes("42 43 501 Tue Oct 20 20:00:00 2026 0 2048 /usr/bin/codex\n43 1 501 Tue Oct 20 19:00:00 2026 0 2048 /Applications/Terminal.app/Contents/MacOS/Terminal");
    snapshot
}

#[test]
fn focus_validates_process_and_same_user_ancestry() {
    let observed = focus_fixture();
    let chain = crate::focus::verified_application_chain(
        &observed,
        &observed,
        &observed.processes[0].id,
        None,
        "501",
    )
    .unwrap();
    assert_eq!(
        chain.iter().map(|p| p.pid).collect::<Vec<_>>(),
        vec![42, 43]
    );
    assert!(crate::focus::verified_application_chain(
        &observed,
        &observed,
        &observed.processes[0].id,
        None,
        "502"
    )
    .is_err());
}
#[test]
fn focus_rejects_reused_pid_and_unknown_identity() {
    let observed = focus_fixture();
    let mut changed = observed.clone();
    changed.processes[0].id.push_str(":restarted");
    assert!(crate::focus::verified_application_chain(
        &observed,
        &changed,
        &observed.processes[0].id,
        None,
        "501"
    )
    .is_err());
    assert!(crate::focus::verified_application_chain(
        &observed,
        &observed,
        "arbitrary",
        None,
        "501"
    )
    .is_err());
}
#[test]
fn focus_does_not_follow_changed_or_other_user_parents() {
    let observed = focus_fixture();
    let mut changed = observed.clone();
    changed.processes[1].id.push_str(":restarted");
    let chain = crate::focus::verified_application_chain(
        &observed,
        &changed,
        &observed.processes[0].id,
        None,
        "501",
    )
    .unwrap();
    assert_eq!(chain.len(), 1);
    changed.processes[1].id = observed.processes[1].id.clone();
    changed.processes[1].uid = "0".into();
    assert_eq!(
        crate::focus::verified_application_chain(
            &observed,
            &changed,
            &observed.processes[0].id,
            None,
            "501"
        )
        .unwrap()
        .len(),
        1
    );
}
#[test]
fn focus_revalidates_listener_ownership() {
    let mut observed = focus_fixture();
    observed.listeners = parse_listeners("p42\nccodex\nu501\nf1\ntIPv4\nn127.0.0.1:3000");
    let mut current = observed.clone();
    current.listeners.clear();
    assert!(crate::focus::verified_application_chain(
        &observed,
        &current,
        &observed.processes[0].id,
        Some(&observed.listeners[0].id),
        "501"
    )
    .is_err());
}
#[test]
fn process_identity_and_privacy() {
    let p = parse_processes(
        "42 1 501 Tue Oct 20 20:00:00 2026 2.5 2048 /Users/private/project/codex\ninvalid",
    );
    assert_eq!(p.len(), 1);
    assert_eq!(p[0].name, "codex");
    assert_eq!(p[0].memory_mb, 2.0);
    assert_eq!(p[0].agent.as_deref(), Some("Codex"));
    assert!(!p[0].id.contains("/Users"));
    let q = parse_processes("42 1 501 Tue Oct 20 20:01:00 2026 2.5 2048 /usr/bin/codex");
    assert_ne!(p[0].id, q[0].id);
}
#[test]
fn ipv4_ipv6_and_dedup() {
    let rows=parse_listeners("p42\ncnode\nu501\nf12\ntIPv4\nn127.0.0.1:3000\nn127.0.0.1:3000\nf13\ntIPv6\nn[::1]:3000\np99\ncunknown\nf2\ntIPv4\nn*:8080\nnmalformed");
    assert_eq!(rows.len(), 3);
    assert_ne!(rows[0].id, rows[1].id);
    assert_eq!(rows[2].uid, "");
}
#[test]
fn agent_is_conservative() {
    assert!(detect_agent("node").is_none());
    assert!(detect_agent("codex-helper").is_none());
    assert!(detect_agent("ollama").is_none());
}
#[test]
fn disabled_collectors_do_not_collect() {
    let s = collect(false, false);
    assert!(s.processes.is_empty());
    assert!(s.listeners.is_empty());
    assert!(s.capabilities.iter().all(|c| c.state == "disabled"));
}
#[test]
fn unavailable_command_fails_soft() {
    assert!(bounded_command("/nonexistent/portglass-test", &[]).is_err());
}
#[test]
fn malformed_unicode_does_not_panic() {
    assert!(parse_listeners("💡malformed\nninvalid").is_empty());
}
#[test]
fn excessive_output_is_rejected() {
    assert!(bounded_command("/usr/bin/yes", &[])
        .unwrap_err()
        .contains("output limit"));
}
#[test]
fn command_deadline_is_enforced() {
    let started = Instant::now();
    assert!(bounded_command("/bin/sleep", &["5"])
        .unwrap_err()
        .contains("deadline"));
    assert!(started.elapsed() < Duration::from_secs(5));
}
#[cfg(target_os = "macos")]
#[test]
fn real_loopback_listener_attribution() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let snapshot = collect(true, true);
    assert!(
        snapshot
            .listeners
            .iter()
            .any(|l| l.port == port && l.pid == std::process::id() && l.address == "127.0.0.1"),
        "Expected correct ownership of the temporary test listener"
    );
    assert!(snapshot
        .processes
        .iter()
        .any(|p| p.pid == std::process::id()));
}
