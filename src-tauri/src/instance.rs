//! macOS singleton authority. The kernel releases flock on crash; the socket
//! only activates the existing UI and accepts no commands, paths or arguments.
use std::os::fd::AsRawFd;
use std::{
    fs::{self, File, OpenOptions},
    io,
    os::unix::{
        fs::{DirBuilderExt, MetadataExt, OpenOptionsExt},
        net::{UnixListener, UnixStream},
    },
    path::PathBuf,
};
pub enum Claim {
    Primary(Instance),
    Existing,
}
pub struct Instance {
    lock: File,
    listener: Option<UnixListener>,
    socket: PathBuf,
}
impl Instance {
    pub fn claim() -> Result<Claim, String> {
        // SAFETY: getuid takes no pointers.
        let uid = unsafe { libc::getuid() };
        Self::at(
            PathBuf::from("/tmp").join(format!("dev.portglass.desktop-{uid}")),
            uid,
        )
    }
    fn at(directory: PathBuf, uid: u32) -> Result<Claim, String> {
        match fs::DirBuilder::new().mode(0o700).create(&directory) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {}
            Err(e) => return Err(e.to_string()),
        }
        let metadata = fs::symlink_metadata(&directory).map_err(|e| e.to_string())?;
        if !metadata.is_dir()
            || metadata.file_type().is_symlink()
            || metadata.uid() != uid
            || metadata.mode() & 0o077 != 0
        {
            return Err("Instance directory must be private and owned by your user".into());
        }
        let lock = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .mode(0o600)
            .custom_flags(libc::O_NOFOLLOW)
            .open(directory.join("instance.lock"))
            .map_err(|e| e.to_string())?;
        // SAFETY: fd remains valid for the entire Instance lifetime. LOCK_NB
        // avoids blocking another invocation or creating a second authority.
        if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
            let error = io::Error::last_os_error();
            if error.kind() != io::ErrorKind::WouldBlock {
                return Err(error.to_string());
            }
            let socket = directory.join("activate.sock");
            for _ in 0..40 {
                if UnixStream::connect(&socket).is_ok() {
                    return Ok(Claim::Existing);
                }
                std::thread::sleep(std::time::Duration::from_millis(25));
            }
            return Err(
                "Portglass is running but activation is unavailable; no duplicate was started"
                    .into(),
            );
        }
        let socket = directory.join("activate.sock");
        match fs::remove_file(&socket) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.to_string()),
        }
        let listener = UnixListener::bind(&socket).map_err(|e| e.to_string())?;
        Ok(Claim::Primary(Self {
            lock,
            listener: Some(listener),
            socket,
        }))
    }
    pub fn listen(&mut self, app: tauri::AppHandle) {
        let listener = self
            .listener
            .take()
            .expect("Activation listener started once");
        std::thread::spawn(move || {
            for connection in listener.incoming() {
                if connection.is_ok() {
                    crate::lifecycle::show(&app);
                }
            }
        });
    }
}
impl Drop for Instance {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.socket);
        let _ = &self.lock;
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cold_start_race_has_one_owner() {
        let root = std::env::temp_dir().join(format!("portglass-cold-lock-{}", std::process::id()));
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(8));
        let uid = unsafe { libc::getuid() };
        let threads: Vec<_> = (0..8)
            .map(|_| {
                let root = root.clone();
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    Instance::at(root, uid).unwrap()
                })
            })
            .collect();
        let claims: Vec<_> = threads
            .into_iter()
            .map(|thread| thread.join().unwrap())
            .collect();
        assert_eq!(
            claims
                .iter()
                .filter(|claim| matches!(claim, Claim::Primary(_)))
                .count(),
            1
        );
        drop(claims);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn simultaneous_claims_have_exactly_one_owner_and_recover_after_exit() {
        let root = std::env::temp_dir().join(format!("portglass-lock-test-{}", std::process::id()));
        let uid = unsafe { libc::getuid() };
        let first = Instance::at(root.clone(), uid).unwrap();
        let Claim::Primary(first) = first else {
            panic!("first must own lock");
        };
        let claims: Vec<_> = (0..8)
            .map(|_| {
                let root = root.clone();
                std::thread::spawn(move || {
                    matches!(Instance::at(root, uid).unwrap(), Claim::Existing)
                })
            })
            .collect();
        for thread in claims {
            assert!(thread.join().unwrap());
        }
        drop(first);
        assert!(matches!(
            Instance::at(root.clone(), uid).unwrap(),
            Claim::Primary(_)
        ));
        fs::remove_dir_all(root).unwrap();
    }
}
