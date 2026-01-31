use serde::Serialize;
use std::sync::Mutex;
use tauri::{Emitter, State};

// ============================================
// STATE
// ============================================

#[derive(Default)]
pub struct AppState {
    pub is_recording: Mutex<bool>,
    pub current_brief_id: Mutex<Option<String>>,
    pub session_start: Mutex<Option<i64>>,
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
}

#[tauri::command]
fn get_recording_status(state: State<AppState>) -> RecordingStatus {
    let is_recording = *state.is_recording.lock().unwrap();
    let brief_id = state.current_brief_id.lock().unwrap().clone();
    let session_start = *state.session_start.lock().unwrap();
    
    let duration_seconds = match session_start {
        Some(start) => chrono::Utc::now().timestamp() - start,
        None => 0,
    };
    
    RecordingStatus {
        is_recording,
        brief_id,
        duration_seconds,
    }
}

#[tauri::command]
fn start_recording(brief_id: String, state: State<AppState>) -> Result<(), String> {
    let mut recording = state.is_recording.lock().map_err(|e| e.to_string())?;
    if *recording {
        return Err("Already recording".to_string());
    }
    
    *recording = true;
    *state.current_brief_id.lock().unwrap() = Some(brief_id);
    *state.session_start.lock().unwrap() = Some(chrono::Utc::now().timestamp());
    
    Ok(())
}

#[tauri::command]
fn stop_recording(state: State<AppState>) -> Result<i64, String> {
    let mut recording = state.is_recording.lock().map_err(|e| e.to_string())?;
    if !*recording {
        return Err("Not recording".to_string());
    }
    
    let session_start = *state.session_start.lock().unwrap();
    let duration = match session_start {
        Some(start) => chrono::Utc::now().timestamp() - start,
        None => 0,
    };
    
    *recording = false;
    *state.current_brief_id.lock().unwrap() = None;
    *state.session_start.lock().unwrap() = None;
    
    Ok(duration)
}

#[tauri::command]
fn set_auth_token(token: String, state: State<AppState>) {
    *state.auth_token.lock().unwrap() = Some(token);
}

#[tauri::command]
fn get_auth_token(state: State<AppState>) -> Option<String> {
    state.auth_token.lock().unwrap().clone()
}

// ============================================
// APP SETUP
// ============================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Handle deep link URLs (drift://auth?token=xxx)
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls = event.urls();
                    for url in urls {
                        let url_str = url.as_str();
                        println!("Deep link received: {}", url_str);
                        
                        // Parse auth token from URL
                        if url_str.starts_with("drift://auth") {
                            if let Some(token) = url_str
                                .split("token=")
                                .nth(1)
                                .map(|t| t.split('&').next().unwrap_or(t))
                            {
                                let decoded = urlencoding::decode(token)
                                    .unwrap_or_else(|_| token.into())
                                    .to_string();
                                
                                // Emit to frontend
                                let _ = handle.emit("auth-token", decoded);
                            }
                        }
                    }
                });
            }
            
            Ok(())
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_recording_status,
            start_recording,
            stop_recording,
            set_auth_token,
            get_auth_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
