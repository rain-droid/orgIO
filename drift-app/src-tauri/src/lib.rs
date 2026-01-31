use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, State,
};

// ============================================
// STATE
// ============================================

#[derive(Default)]
pub struct AppState {
    pub is_recording: Mutex<bool>,
    pub current_brief_id: Mutex<Option<String>>,
    pub session_start: Mutex<Option<i64>>,
    pub screenshots: Mutex<Vec<String>>,
    pub auth_token: Mutex<Option<String>>,
}

// ============================================
// COMMANDS
// ============================================

#[derive(Serialize)]
pub struct RecordingStatus {
    is_recording: bool,
    brief_id: Option<String>,
    duration_seconds: i64,
    screenshot_count: usize,
}

#[tauri::command]
pub fn get_recording_status(state: State<AppState>) -> RecordingStatus {
    let is_recording = *state.is_recording.lock().unwrap();
    let brief_id = state.current_brief_id.lock().unwrap().clone();
    let session_start = *state.session_start.lock().unwrap();
    let screenshot_count = state.screenshots.lock().unwrap().len();
    
    let duration_seconds = match session_start {
        Some(start) => chrono::Utc::now().timestamp() - start,
        None => 0,
    };
    
    RecordingStatus {
        is_recording,
        brief_id,
        duration_seconds,
        screenshot_count,
    }
}

#[tauri::command]
pub fn start_recording(brief_id: String, state: State<AppState>) -> Result<(), String> {
    let mut recording = state.is_recording.lock().map_err(|e| e.to_string())?;
    if *recording {
        return Err("Already recording".to_string());
    }
    
    *recording = true;
    *state.current_brief_id.lock().unwrap() = Some(brief_id);
    *state.session_start.lock().unwrap() = Some(chrono::Utc::now().timestamp());
    state.screenshots.lock().unwrap().clear();
    
    Ok(())
}

#[tauri::command]
pub fn stop_recording(state: State<AppState>) -> Result<Vec<String>, String> {
    let mut recording = state.is_recording.lock().map_err(|e| e.to_string())?;
    if !*recording {
        return Err("Not recording".to_string());
    }
    
    *recording = false;
    *state.current_brief_id.lock().unwrap() = None;
    *state.session_start.lock().unwrap() = None;
    
    let screenshots = state.screenshots.lock().unwrap().clone();
    state.screenshots.lock().unwrap().clear();
    
    Ok(screenshots)
}

#[tauri::command]
pub fn capture_screenshot(state: State<AppState>) -> Result<String, String> {
    // Use screenshots crate to capture
    let screens = screenshots::Screen::all().map_err(|e| e.to_string())?;
    
    if let Some(screen) = screens.first() {
        let image = screen.capture().map_err(|e| e.to_string())?;
        let buffer = image.to_png(None).map_err(|e| e.to_string())?;
        let base64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buffer);
        
        // Store if recording
        if *state.is_recording.lock().unwrap() {
            state.screenshots.lock().unwrap().push(base64.clone());
        }
        
        Ok(base64)
    } else {
        Err("No screen found".to_string())
    }
}

#[tauri::command]
pub fn set_auth_token(token: String, state: State<AppState>) {
    *state.auth_token.lock().unwrap() = Some(token);
}

#[tauri::command]
pub fn get_auth_token(state: State<AppState>) -> Option<String> {
    state.auth_token.lock().unwrap().clone()
}

// ============================================
// APP SETUP
// ============================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Create tray menu
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit])?;
            
            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Drift - Recording")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;
            
            Ok(())
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_recording_status,
            start_recording,
            stop_recording,
            capture_screenshot,
            set_auth_token,
            get_auth_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
