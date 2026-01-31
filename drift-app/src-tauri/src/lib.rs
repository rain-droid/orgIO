use serde::Serialize;
use std::sync::Mutex;
use std::sync::Arc;
use std::thread;
use tauri::{Emitter, State, AppHandle};

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

/// Start a localhost server and return the callback URL
#[tauri::command]
fn start_auth_server(app_handle: AppHandle) -> Result<String, String> {
    use rand::Rng;
    use tiny_http::{Server, Response};
    
    // Generate random port between 19000-19999
    let port: u16 = rand::thread_rng().gen_range(19000..20000);
    let callback_url = format!("http://localhost:{}/callback", port);
    
    // Start server in background thread
    let app_handle_clone = app_handle.clone();
    
    thread::spawn(move || {
        let addr = format!("127.0.0.1:{}", port);
        let server = match Server::http(&addr) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to start auth server: {}", e);
                return;
            }
        };
        
        println!("Auth server listening on {}", addr);
        
        // Wait for one request (with timeout)
        if let Ok(Some(request)) = server.recv_timeout(std::time::Duration::from_secs(300)) {
            let url = request.url().to_string();
            println!("Received callback: {}", url);
            
            // Parse token from URL
            if let Some(token_start) = url.find("token=") {
                let token_part = &url[token_start + 6..];
                let token = token_part.split('&').next().unwrap_or(token_part);
                let decoded = urlencoding::decode(token).unwrap_or_else(|_| token.into()).to_string();
                
                // Emit to frontend
                let _ = app_handle_clone.emit("auth-token", decoded);
                
                // Send success response
                let html = r#"
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { 
                                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                                background: #0a0a0b;
                                color: white;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                height: 100vh;
                                margin: 0;
                            }
                            .container { text-align: center; }
                            .check {
                                width: 80px;
                                height: 80px;
                                background: linear-gradient(135deg, #22c55e, #16a34a);
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin: 0 auto 24px;
                            }
                            h1 { font-size: 28px; margin-bottom: 8px; }
                            p { color: #71717a; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="check">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                                    <path d="M20 6L9 17l-5-5"/>
                                </svg>
                            </div>
                            <h1>Successfully Connected!</h1>
                            <p>You can close this window and return to Drift.</p>
                        </div>
                        <script>setTimeout(() => window.close(), 2000);</script>
                    </body>
                    </html>
                "#;
                
                let response = Response::from_string(html)
                    .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html"[..]).unwrap());
                let _ = request.respond(response);
            }
        }
        
        println!("Auth server shutting down");
    });
    
    Ok(callback_url)
}

// ============================================
// APP SETUP
// ============================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_recording_status,
            start_recording,
            stop_recording,
            set_auth_token,
            get_auth_token,
            start_auth_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
