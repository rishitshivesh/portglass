use crate::{agents::detect_agent, models::Process};

pub fn parse_processes(input: &str) -> Vec<Process> {
    input
        .lines()
        .filter_map(|line| {
            let p: Vec<&str> = line.split_whitespace().collect();
            if p.len() < 11 {
                return None;
            }
            let pid = p[0].parse().ok()?;
            let parent = p[1].parse().ok()?;
            let uid = p[2].to_string();
            let started = p[3..8].join(" ");
            let executable = p[10..].join(" ");
            let name = executable
                .rsplit('/')
                .next()
                .unwrap_or("unknown")
                .to_string();
            Some(Process {
                id: format!("{pid}:{started}:{uid}:{name}"),
                pid,
                parent,
                uid,
                started,
                name: name.clone(),
                cpu: p[8].parse().unwrap_or(0.0),
                memory_mb: p[9].parse::<f64>().unwrap_or(0.0) / 1024.0,
                agent: detect_agent(&name),
            })
        })
        .collect()
}
