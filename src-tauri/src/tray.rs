use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Open Portglass", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Portglass", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    TrayIconBuilder::new()
        .icon(tray_icon())
        .tooltip("Portglass · read-only")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

fn tray_icon() -> Image<'static> {
    let mut pixels = vec![0; 32 * 32 * 4];
    for y in 4..28 {
        for x in 4..28 {
            if x < 7 || x > 24 || y < 7 || y > 24 || (x + y) % 12 < 3 {
                let index = (y * 32 + x) * 4;
                pixels[index..index + 4].copy_from_slice(&[94, 225, 191, 255]);
            }
        }
    }
    Image::new_owned(pixels, 32, 32)
}
