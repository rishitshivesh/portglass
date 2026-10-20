use std::sync::{Mutex,Arc};
use std::time::Instant;
use portglass_core::{Snapshot,collect};
use tauri::{Manager, State};

#[derive(Default)] struct Cache(Arc<Mutex<Option<(Instant,bool,bool,Snapshot)>>>);
#[tauri::command]
async fn snapshot(processes_enabled:bool,ports_enabled:bool,cache:State<'_,Cache>)->Result<Snapshot,String>{
    // The lock also prevents concurrent collectors across repeated renderer requests.
    let cache=cache.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
    let mut guard=cache.lock().map_err(|_|"Snapshot cache unavailable")?;
    if let Some((time,p,l,s))=guard.as_ref(){if time.elapsed().as_secs()<5 && *p==processes_enabled && *l==ports_enabled{return Ok(s.clone());}}
    let s=collect(processes_enabled,ports_enabled); *guard=Some((Instant::now(),processes_enabled,ports_enabled,s.clone()));Ok(s)
    }).await.map_err(|_|"Collector worker unavailable".to_string())?
}
fn main(){
    tauri::Builder::default().manage(Cache::default()).invoke_handler(tauri::generate_handler![snapshot]).setup(|app|{
        use tauri::{menu::{Menu,MenuItem},tray::TrayIconBuilder,image::Image};
        let show=MenuItem::with_id(app,"show","Open Portglass",true,None::<&str>)?;
        let quit=MenuItem::with_id(app,"quit","Quit Portglass",true,None::<&str>)?;
        let menu=Menu::with_items(app,&[&show,&quit])?;
        let mut pixels=vec![0u8;32*32*4];for y in 4..28 {for x in 4..28 {if x<7||x>24||y<7||y>24||((x+y)%12<3){let i=(y*32+x)*4;pixels[i..i+4].copy_from_slice(&[94,225,191,255]);}}}
        TrayIconBuilder::new().icon(Image::new_owned(pixels,32,32)).tooltip("Portglass · read-only").menu(&menu).on_menu_event(|app,event|match event.id.as_ref(){"show"=>{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.set_focus();}},"quit"=>app.exit(0),_=>{}}).build(app)?;
        Ok(())
    }).run(tauri::generate_context!()).expect("Unable to launch Portglass");
}
