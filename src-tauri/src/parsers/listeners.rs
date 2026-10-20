use crate::models::Listener;

pub fn parse_listeners(input: &str) -> Vec<Listener> {
    let (mut pid, mut name, mut uid, mut family) = (0, String::new(), String::new(), String::new());
    let mut rows = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for line in input.lines() {
        let Some(key) = line.get(..1) else {
            continue;
        };
        let value = &line[1..];
        match key {
            "p" => {
                pid = value.parse().unwrap_or(0);
                name.clear();
                uid.clear();
                family.clear();
            }
            "c" => name = value.to_string(),
            "u" => uid = value.to_string(),
            "f" => family.clear(),
            "t" => family = value.to_string(),
            "n" => {
                if let Some((address, port)) = value.rsplit_once(':') {
                    if let Ok(port) = port.parse::<u16>() {
                        let id = format!("TCP:{family}:{address}:{port}:{pid}");
                        if seen.insert(id.clone()) {
                            rows.push(Listener {
                                id,
                                pid,
                                name: name.clone(),
                                uid: uid.clone(),
                                family: family.clone(),
                                address: address.to_string(),
                                port,
                            });
                        }
                    }
                }
            }
            _ => {}
        }
    }
    rows.sort_by_key(|r| r.port);
    rows
}
