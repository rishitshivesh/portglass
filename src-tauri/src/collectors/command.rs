use std::{
    io::Read,
    process::{Command, Stdio},
    sync::mpsc,
    time::{Duration, Instant},
};

// Fixed executable and arguments only. No caller-supplied commands, shell, environment or file paths.
pub(crate) fn bounded_command(binary: &str, args: &[&str]) -> Result<String, String> {
    let mut child = Command::new(binary)
        .args(args)
        .env_clear()
        .env("LC_ALL", "C")
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "Collector executable unavailable or restricted".to_string())?;
    let stdout = child.stdout.take().ok_or("Collector output unavailable")?;
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let result = stdout
            .take(2_000_001)
            .read_to_end(&mut bytes)
            .map(|_| bytes);
        let _ = tx.send(result);
    });
    let deadline = Instant::now() + Duration::from_secs(4);
    let mut output = None;
    loop {
        if Instant::now() > deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Collector exceeded its 4-second deadline".into());
        }
        if output.is_none() {
            if let Ok(result) = rx.try_recv() {
                let bytes = match result {
                    Ok(bytes) => bytes,
                    Err(_) => {
                        let _ = child.kill();
                        let _ = child.wait();
                        return Err("Collector output could not be read".into());
                    }
                };
                if bytes.len() > 2_000_000 {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("Collector exceeded its 2 MB output limit".into());
                }
                output = Some(bytes);
            }
        }
        if let Some(status) = child
            .try_wait()
            .map_err(|_| "Collector status unavailable")?
        {
            if let Some(bytes) = output.take() {
                // lsof exits 1 when no matching sockets are visible.
                if !status.success()
                    && !(binary == "/usr/sbin/lsof" && status.code() == Some(1) && bytes.is_empty())
                {
                    return Err("Collector failed; visibility may be restricted".into());
                }
                return String::from_utf8(bytes)
                    .map_err(|_| "Collector returned invalid text".into());
            }
        }
        std::thread::sleep(Duration::from_millis(15));
    }
}
