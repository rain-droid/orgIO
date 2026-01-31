# Drift Desktop App

Tauri-based desktop app for work recording and sync with Drift web app.

## Features

- **Auth Sync**: Uses same Clerk authentication as web app
- **Screen Recording**: Captures screenshots during work sessions
- **Session Management**: Start/stop recording linked to briefs
- **Tray App**: Runs in background with system tray

## Setup

### Prerequisites
- Node.js 18+
- Rust (install via https://rustup.rs)
- Tauri CLI: `cargo install tauri-cli`

### Development

```bash
# Install dependencies
npm install

# Run in development
npm run tauri dev
```

### Build

```bash
# Build for production
npm run tauri build
```

## Environment Variables

Create `.env`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

## Auth Flow

1. User signs in with Clerk (same account as web app)
2. Clerk token is passed to Tauri backend
3. Token used for API calls to drift-backend
4. Session data synced to web app via backend

## Commands (Tauri)

| Command | Description |
|---------|-------------|
| `start_recording` | Start a recording session |
| `stop_recording` | Stop and get screenshots |
| `get_recording_status` | Get current status |
| `capture_screenshot` | Manual screenshot |
| `set_auth_token` | Store Clerk token |
| `get_auth_token` | Retrieve stored token |
