use crate::collectors::command::bounded_command;
use serde::Serialize;
use std::path::Path;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerUsage {
    pub endpoint: String,
    pub rows: Vec<DockerRow>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerRow {
    pub category: String,
    pub total: String,
    pub active: String,
    pub size: String,
    pub reclaimable: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockerEndpoint {
    pub id: String,
    pub name: String,
    pub socket: String,
}
pub fn endpoints() -> Vec<DockerEndpoint> {
    let Some(home) = std::env::var_os("HOME").map(std::path::PathBuf::from) else {
        return vec![];
    };
    discover(&home)
}
fn discover(home: &Path) -> Vec<DockerEndpoint> {
    use std::{
        collections::HashSet,
        hash::{Hash, Hasher},
        os::unix::fs::{FileTypeExt, MetadataExt},
    };
    let mut candidates = vec![
        (
            "OrbStack".to_string(),
            home.join(".orbstack/run/docker.sock"),
        ),
        (
            "Colima · default".to_string(),
            home.join(".colima/default/docker.sock"),
        ),
        ("Rancher Desktop".to_string(), home.join(".rd/docker.sock")),
        (
            "Lima · docker".to_string(),
            home.join(".lima/docker/sock/docker.sock"),
        ),
    ];
    for (directory, label, suffix) in [
        (".colima", "Colima", "docker.sock"),
        (".lima", "Lima", "sock/docker.sock"),
    ] {
        if let Ok(profiles) = std::fs::read_dir(home.join(directory)) {
            for profile in profiles.take(32).flatten() {
                let name = profile.file_name().to_string_lossy().into_owned();
                if profile.file_type().is_ok_and(|kind| kind.is_dir()) && !name.starts_with('.') {
                    candidates.push((format!("{label} · {name}"), profile.path().join(suffix)));
                }
            }
        }
    }
    candidates.push((
        "Docker Desktop".into(),
        home.join(".docker/run/docker.sock"),
    ));
    candidates.push((
        "Local Docker socket".into(),
        std::path::PathBuf::from("/var/run/docker.sock"),
    ));
    let mut seen = HashSet::new();
    candidates
        .into_iter()
        .filter_map(|(name, path)| {
            let metadata = std::fs::metadata(&path).ok()?;
            if !metadata.file_type().is_socket() || !seen.insert((metadata.dev(), metadata.ino())) {
                return None;
            }
            let canonical = path.canonicalize().ok()?;
            let mut hash = std::collections::hash_map::DefaultHasher::new();
            canonical.hash(&mut hash);
            Some(DockerEndpoint {
                id: format!("local-{:x}", hash.finish()),
                name,
                socket: canonical.to_string_lossy().into(),
            })
        })
        .collect()
}
pub fn collect(endpoint_id: &str) -> Result<DockerUsage, String> {
    let endpoint = endpoints()
        .into_iter()
        .find(|endpoint| endpoint.id == endpoint_id)
        .ok_or("Local runtime socket changed or is unavailable; discover engines again")?;
    let mut binaries = vec![
        std::path::PathBuf::from("/opt/homebrew/bin/docker"),
        std::path::PathBuf::from("/usr/local/bin/docker"),
        std::path::PathBuf::from("/Applications/Docker.app/Contents/Resources/bin/docker"),
    ];
    if let Some(home) = std::env::var_os("HOME") {
        binaries.push(std::path::PathBuf::from(home).join(".docker/bin/docker"));
    }
    let binary=binaries.into_iter().find(|path|path.is_file()).ok_or("Docker CLI not found. Colima, OrbStack and other Docker-compatible engines need a Docker CLI in a supported location.")?;
    let socket = format!("unix://{}", endpoint.socket);
    let output = bounded_command(
        binary.to_str().ok_or("Docker executable path is invalid")?,
        &[
            "--config",
            "/var/empty",
            "--host",
            &socket,
            "system",
            "df",
            "--format",
            "{{json .}}",
        ],
    )?;
    Ok(DockerUsage {
        endpoint: format!("{} · {}", endpoint.name, socket),
        rows: parse(&output)?,
    })
}

fn parse(output: &str) -> Result<Vec<DockerRow>, String> {
    let mut rows = vec![];
    for line in output.lines().filter(|l| !l.trim().is_empty()).take(16) {
        let v: serde_json::Value = serde_json::from_str(line)
            .map_err(|_| "Docker returned an unsupported usage format")?;
        if !v["Type"].is_string() || !v["Size"].is_string() {
            return Err("Docker returned an unsupported usage format".into());
        }
        let text = |key: &str| {
            v[key]
                .as_str()
                .map(|s| s.chars().take(160).collect::<String>())
                .unwrap_or_else(|| {
                    v[key]
                        .as_u64()
                        .map(|n| n.to_string())
                        .unwrap_or_else(|| "Unknown".into())
                })
        };
        rows.push(DockerRow {
            category: text("Type"),
            total: text("TotalCount"),
            active: text("Active"),
            size: text("Size"),
            reclaimable: text("Reclaimable"),
        });
    }
    if rows.is_empty() {
        return Err("Docker returned no usage summary".into());
    }
    Ok(rows)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn discovers_colima_profiles_and_deduplicates_socket_aliases() {
        let home =
            std::env::temp_dir().join(format!("portglass-engines-test-{}", std::process::id()));
        std::fs::create_dir_all(home.join(".colima/work")).unwrap();
        std::fs::create_dir_all(home.join(".docker/run")).unwrap();
        let socket = home.join(".colima/work/docker.sock");
        let _listener = std::os::unix::net::UnixListener::bind(&socket).unwrap();
        std::os::unix::fs::symlink(&socket, home.join(".docker/run/docker.sock")).unwrap();
        let endpoints = discover(&home);
        let canonical = socket
            .canonicalize()
            .unwrap()
            .to_string_lossy()
            .into_owned();
        assert_eq!(
            endpoints.iter().filter(|e| e.socket == canonical).count(),
            1
        );
        assert!(endpoints
            .iter()
            .find(|e| e.socket == canonical)
            .unwrap()
            .name
            .contains("Colima"));
        assert!(collect("tcp://remote.invalid:2375").is_err());
        std::fs::remove_dir_all(home).unwrap();
    }
    #[test]
    fn preserves_docker_estimates_without_treating_them_as_disk_bytes() {
        let rows=parse(r#"{"Type":"Local Volumes","TotalCount":"3","Active":"1","Size":"2GB","Reclaimable":"1GB (50%)"}"#).unwrap();
        assert_eq!(rows[0].category, "Local Volumes");
        assert_eq!(rows[0].reclaimable, "1GB (50%)");
        assert!(parse("bad").is_err());
        assert!(parse("{}").is_err());
    }
}
