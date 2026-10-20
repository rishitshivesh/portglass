use serde::Serialize;

#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Process {
    pub id: String,
    pub pid: u32,
    pub parent: u32,
    pub uid: String,
    pub started: String,
    pub name: String,
    pub cpu: f64,
    pub memory_mb: f64,
    pub agent: Option<String>,
}
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Listener {
    pub id: String,
    pub pid: u32,
    pub name: String,
    pub uid: String,
    pub family: String,
    pub address: String,
    pub port: u16,
}
#[derive(Clone, Serialize, Debug)]
pub struct Capability {
    pub name: String,
    pub state: String,
    pub detail: String,
}
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub captured_at: u64,
    pub processes: Vec<Process>,
    pub listeners: Vec<Listener>,
    pub capabilities: Vec<Capability>,
    pub platform: String,
    pub duration_ms: u128,
}
