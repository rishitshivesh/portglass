use serde::Serialize;
use std::{io::Read, process::{Command, Stdio}, sync::mpsc, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};

#[derive(Clone, Serialize, Debug)]
#[serde(rename_all="camelCase")]
pub struct Process { pub id:String, pub pid:u32, pub parent:u32, pub uid:String, pub started:String, pub name:String, pub cpu:f64, pub memory_mb:f64, pub agent:Option<String> }
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all="camelCase")]
pub struct Listener { pub id:String, pub pid:u32, pub name:String, pub uid:String, pub family:String, pub address:String, pub port:u16 }
#[derive(Clone, Serialize, Debug)]
pub struct Capability { pub name:String, pub state:String, pub detail:String }
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all="camelCase")]
pub struct Snapshot { pub captured_at:u64, pub processes:Vec<Process>, pub listeners:Vec<Listener>, pub capabilities:Vec<Capability>, pub platform:String, pub duration_ms:u128 }

// Fixed executable and arguments only. No caller-supplied commands, shell, environment or file paths.
fn bounded_command(binary:&str, args:&[&str]) -> Result<String,String> {
    let mut child=Command::new(binary).args(args).env_clear().env("LC_ALL","C").stdout(Stdio::piped()).stderr(Stdio::null()).spawn().map_err(|_|"Collector executable unavailable or restricted".to_string())?;
    let stdout=child.stdout.take().ok_or("Collector output unavailable")?;
    let (tx,rx)=mpsc::channel();
    std::thread::spawn(move || { let mut bytes=Vec::new(); let result=stdout.take(2_000_001).read_to_end(&mut bytes).map(|_|bytes); let _=tx.send(result); });
    let deadline=Instant::now()+Duration::from_secs(4);
    let mut output=None;
    loop {
        if Instant::now()>deadline { let _=child.kill(); let _=child.wait(); return Err("Collector exceeded its 4-second deadline".into()); }
        if output.is_none() { if let Ok(result)=rx.try_recv() {
            let bytes=match result {Ok(bytes)=>bytes,Err(_)=>{let _=child.kill();let _=child.wait();return Err("Collector output could not be read".into());}};
            if bytes.len()>2_000_000 { let _=child.kill(); let _=child.wait(); return Err("Collector exceeded its 2 MB output limit".into()); }
            output=Some(bytes);
        }}
        if let Some(status)=child.try_wait().map_err(|_|"Collector status unavailable")? { if let Some(bytes)=output.take() {
            // lsof exits 1 when no matching sockets are visible.
            if !status.success() && !(binary=="/usr/sbin/lsof" && status.code()==Some(1) && bytes.is_empty()) { return Err("Collector failed; visibility may be restricted".into()); }
            return String::from_utf8(bytes).map_err(|_|"Collector returned invalid text".into());
        }}
        std::thread::sleep(Duration::from_millis(15));
    }
}

pub fn detect_agent(name:&str)->Option<String> {
    match name.to_lowercase().as_str() { "codex"|"codex-cli"=>Some("Codex".into()), "claude"=>Some("Claude Code".into()), "gemini"=>Some("Gemini CLI".into()), "opencode"=>Some("OpenCode".into()), _=>None }
}
pub fn parse_processes(input:&str)->Vec<Process> {
    input.lines().filter_map(|line| {
        let p:Vec<&str>=line.split_whitespace().collect(); if p.len()<11 { return None; }
        let pid=p[0].parse().ok()?; let parent=p[1].parse().ok()?; let uid=p[2].to_string(); let started=p[3..8].join(" ");
        let executable=p[10..].join(" "); let name=executable.rsplit('/').next().unwrap_or("unknown").to_string();
        Some(Process {id:format!("{pid}:{started}:{uid}:{name}"),pid,parent,uid,started,name:name.clone(),cpu:p[8].parse().unwrap_or(0.0),memory_mb:p[9].parse::<f64>().unwrap_or(0.0)/1024.0,agent:detect_agent(&name)})
    }).collect()
}
pub fn parse_listeners(input:&str)->Vec<Listener> {
    let (mut pid,mut name,mut uid,mut family)=(0,String::new(),String::new(),String::new()); let mut rows=Vec::new();
    for line in input.lines() { let Some(key)=line.get(..1) else {continue;}; let value=&line[1..]; match key {
        "p"=>{pid=value.parse().unwrap_or(0);name.clear();uid.clear();family.clear();}, "c"=>name=value.to_string(), "u"=>uid=value.to_string(), "f"=>family.clear(), "t"=>family=value.to_string(),
        "n"=>{if let Some((address,port))=value.rsplit_once(':') {if let Ok(port)=port.parse::<u16>() { let id=format!("TCP:{family}:{address}:{port}:{pid}"); if !rows.iter().any(|r:&Listener|r.id==id) {rows.push(Listener{id,pid,name:name.clone(),uid:uid.clone(),family:family.clone(),address:address.to_string(),port});}}}}, _=>{} }
    } rows.sort_by_key(|r|r.port); rows
}
pub fn collect(processes_enabled:bool, ports_enabled:bool)->Snapshot {
    let now=Instant::now(); let mut snapshot=Snapshot{captured_at:SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs(), processes:vec![], listeners:vec![], capabilities:vec![],platform:std::env::consts::OS.into(),duration_ms:0};
    for (name,enabled) in [("Processes",processes_enabled),("TCP listeners",ports_enabled)] {
        if !enabled { snapshot.capabilities.push(Capability{name:name.into(),state:"disabled".into(),detail:"Collection disabled; previous observations discarded".into()});continue; }
        if !cfg!(target_os="macos") {snapshot.capabilities.push(Capability{name:name.into(),state:"unsupported".into(),detail:"Only the macOS adapter is implemented".into()});continue;}
        let result=if name=="Processes" {bounded_command("/bin/ps", &["-axo","pid=,ppid=,uid=,lstart=,%cpu=,rss=,comm="])}else{bounded_command("/usr/sbin/lsof", &["-nP","-iTCP","-sTCP:LISTEN","-Fpcuftn"])};
        match result { Ok(text)=>{if name=="Processes" {snapshot.processes=parse_processes(&text);}else{snapshot.listeners=parse_listeners(&text);}snapshot.capabilities.push(Capability{name:name.into(),state:"limited".into(),detail:if name=="Processes" {"ps metadata only. CPU is lifetime average; RSS is current. Arguments and paths are omitted."}else{"lsof snapshot; OS permissions may hide owners or listeners. IPv4 and IPv6 remain separate."}.into()});}, Err(detail)=>snapshot.capabilities.push(Capability{name:name.into(),state:"error".into(),detail}) }
    } snapshot.duration_ms=now.elapsed().as_millis(); snapshot
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn process_identity_and_privacy(){let p=parse_processes("42 1 501 Tue Oct 20 20:00:00 2026 2.5 2048 /Users/private/project/codex\ninvalid");assert_eq!(p.len(),1);assert_eq!(p[0].name,"codex");assert_eq!(p[0].memory_mb,2.0);assert_eq!(p[0].agent.as_deref(),Some("Codex"));assert!(!p[0].id.contains("/Users"));let q=parse_processes("42 1 501 Tue Oct 20 20:01:00 2026 2.5 2048 /usr/bin/codex");assert_ne!(p[0].id,q[0].id);}
    #[test] fn ipv4_ipv6_and_dedup(){let rows=parse_listeners("p42\ncnode\nu501\nf12\ntIPv4\nn127.0.0.1:3000\nn127.0.0.1:3000\nf13\ntIPv6\nn[::1]:3000\np99\ncunknown\nf2\ntIPv4\nn*:8080\nnmalformed");assert_eq!(rows.len(),3);assert_ne!(rows[0].id,rows[1].id);assert_eq!(rows[2].uid,"");}
    #[test] fn agent_is_conservative(){assert!(detect_agent("node").is_none());assert!(detect_agent("codex-helper").is_none());assert!(detect_agent("ollama").is_none());}
    #[test] fn disabled_collectors_do_not_collect(){let s=collect(false,false);assert!(s.processes.is_empty());assert!(s.listeners.is_empty());assert!(s.capabilities.iter().all(|c|c.state=="disabled"));}
    #[test] fn unavailable_command_fails_soft(){assert!(bounded_command("/nonexistent/portglass-test", &[]).is_err());}
    #[test] fn malformed_unicode_does_not_panic(){assert!(parse_listeners("💡malformed\nninvalid").is_empty());}
    #[test] fn excessive_output_is_rejected(){assert!(bounded_command("/usr/bin/yes", &[]).unwrap_err().contains("output limit"));}
    #[test] fn command_deadline_is_enforced(){let started=Instant::now();assert!(bounded_command("/bin/sleep", &["5"]).unwrap_err().contains("deadline"));assert!(started.elapsed()<Duration::from_secs(5));}
    #[cfg(target_os="macos")]
    #[test] fn real_loopback_listener_attribution(){
        let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port=listener.local_addr().unwrap().port();
        let snapshot=collect(true,true);
        assert!(snapshot.listeners.iter().any(|l|l.port==port && l.pid==std::process::id() && l.address=="127.0.0.1"),"Expected correct ownership of the temporary test listener");
        assert!(snapshot.processes.iter().any(|p|p.pid==std::process::id()));
    }
}
