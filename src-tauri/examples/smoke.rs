fn main() {
    let s = portglass_core::collect(true, true);
    println!(
        "platform={} processes={} listeners={} agents={} duration_ms={}",
        s.platform,
        s.processes.len(),
        s.listeners.len(),
        s.processes.iter().filter(|p| p.agent.is_some()).count(),
        s.duration_ms
    );
    for c in &s.capabilities {
        println!("{}: {} — {}", c.name, c.state, c.detail);
    }
    assert!(
        s.capabilities.iter().all(|c| c.state != "error"),
        "A collector failed"
    );
    assert!(
        s.processes.iter().any(|p| p.pid == std::process::id()),
        "Collector should see this smoke process"
    );
}
