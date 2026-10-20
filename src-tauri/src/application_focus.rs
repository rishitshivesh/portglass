use portglass_core::Process;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusReceipt {
    pub application_name: String,
    pub application_pid: u32,
    pub scope: &'static str,
}

#[cfg(target_os = "macos")]
pub fn activate(chain: &[Process]) -> Result<FocusReceipt, String> {
    use objc2::MainThreadMarker;
    use objc2_app_kit::{
        NSApplication, NSApplicationActivationOptions, NSApplicationActivationPolicy,
        NSRunningApplication,
    };
    let marker =
        MainThreadMarker::new().ok_or("Application activation requires the main thread")?;
    for process in chain {
        let Ok(pid) = i32::try_from(process.pid) else {
            continue;
        };
        let Some(application) = NSRunningApplication::runningApplicationWithProcessIdentifier(pid)
        else {
            continue;
        };
        if application.isTerminated()
            || application.activationPolicy() != NSApplicationActivationPolicy::Regular
        {
            continue;
        }
        let name = application
            .localizedName()
            .map(|name| name.to_string())
            .unwrap_or_else(|| process.name.clone());
        if process.pid == std::process::id() || application.isActive() {
            return Ok(FocusReceipt {
                application_name: name,
                application_pid: process.pid,
                scope: if process.pid == std::process::id() {
                    "current-application"
                } else {
                    "already-active"
                },
            });
        }
        // Cooperatively yield focus on modern macOS; never launch an executable.
        let modern = objc2_foundation::NSProcessInfo::processInfo()
            .operatingSystemVersion()
            .majorVersion
            >= 14;
        let accepted = if modern {
            NSApplication::sharedApplication(marker).yieldActivationToApplication(&application);
            application.activateFromApplication_options(
                &NSRunningApplication::currentApplication(),
                NSApplicationActivationOptions::empty(),
            )
        } else {
            #[allow(deprecated)]
            application
                .activateWithOptions(NSApplicationActivationOptions::ActivateIgnoringOtherApps)
        };
        if accepted {
            return Ok(FocusReceipt {
                application_name: name,
                application_pid: process.pid,
                scope: "application",
            });
        }
        return Err("macOS declined the activation request".into());
    }
    Err("No foreground application was found in the verified process ancestry. Exact terminal tabs and detached CLI sessions are unsupported.".into())
}

#[cfg(not(target_os = "macos"))]
pub fn activate(_chain: &[Process]) -> Result<FocusReceipt, String> {
    Err("Application focus is currently supported on macOS only".into())
}
