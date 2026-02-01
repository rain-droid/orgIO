"""
Desktop App Integration Router - Handles desktop overlay communication.
"""
from fastapi import APIRouter, HTTPException, Header, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

from services.clerk_auth import verify_clerk_token
from services.supabase_client import get_supabase
from services.websocket_manager import websocket_manager

router = APIRouter()


class ActivityEntry(BaseModel):
    """A single activity entry from the desktop app."""
    app: str
    title: str
    duration: int  # seconds
    timestamp: int  # unix timestamp


class SessionStartRequest(BaseModel):
    """Request to start a work session."""
    briefId: str
    role: str


class SessionEndRequest(BaseModel):
    """Request to end a work session."""
    sessionId: str
    activities: List[ActivityEntry]
    summary: Optional[str] = None


class DesktopSyncRequest(BaseModel):
    """Request to sync desktop state with server."""
    userId: str
    orgId: Optional[str] = None
    activities: Optional[List[ActivityEntry]] = None


@router.post("/desktop/sync")
async def sync_desktop_state(
    request: DesktopSyncRequest,
    authorization: str = Header(...)
):
    """
    Sync desktop app state with server.
    Returns active briefs and pending tasks for the user.
    """
    token = authorization.replace("Bearer ", "")
    user_info = await verify_clerk_token(token)
    user_id = user_info["userId"]
    org_id = user_info.get("orgId")
    
    supabase = get_supabase()
    
    # Get active briefs for org
    briefs_result = supabase.table("briefs")\
        .select("id, name, description, status")\
        .eq("org_id", org_id)\
        .eq("status", "active")\
        .execute()
    
    briefs = briefs_result.data if briefs_result.data else []
    
    # Get tasks assigned to user's role
    user_result = supabase.table("users")\
        .select("role")\
        .eq("id", user_id)\
        .single()\
        .execute()
    
    user_role = user_result.data.get("role", "dev") if user_result.data else "dev"
    
    # Get pending tasks
    tasks = []
    for brief in briefs:
        tasks_result = supabase.table("tasks")\
            .select("id, title, description, status")\
            .eq("brief_id", brief["id"])\
            .eq("role", user_role)\
            .neq("status", "done")\
            .execute()
        
        if tasks_result.data:
            tasks.extend([{
                "briefId": brief["id"],
                "briefName": brief["name"],
                **task
            } for task in tasks_result.data])
    
    return {
        "userId": user_id,
        "orgId": org_id,
        "role": user_role,
        "briefs": [{
            "id": b["id"],
            "name": b["name"],
            "description": b.get("description", ""),
            "status": b["status"]
        } for b in briefs],
        "pendingTasks": tasks[:10]  # Limit to 10 most relevant tasks
    }


@router.post("/desktop/session/start")
async def start_session(
    request: SessionStartRequest,
    authorization: str = Header(...)
):
    """
    Start a work session for a brief.
    Returns session ID for tracking.
    """
    token = authorization.replace("Bearer ", "")
    user_info = await verify_clerk_token(token)
    user_id = user_info["userId"]
    org_id = user_info.get("orgId")
    
    supabase = get_supabase()
    
    # Verify brief exists and user has access
    brief_result = supabase.table("briefs")\
        .select("id, name, org_id")\
        .eq("id", request.briefId)\
        .single()\
        .execute()
    
    if not brief_result.data:
        raise HTTPException(status_code=404, detail="Brief not found")
    
    if brief_result.data.get("org_id") != org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create session in DB
    session_data = {
        "user_id": user_id,
        "org_id": org_id,
        "brief_id": request.briefId,
        "role": request.role,
        "status": "active"
    }
    
    result = supabase.table("work_sessions")\
        .insert(session_data)\
        .execute()
    
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create session")
    
    session = result.data[0]
    session_id = session["id"]
    started_at = session.get("started_at") or session.get("created_at")
    
    # Notify web clients
    try:
        await websocket_manager.broadcast_event(
            "session:started",
            {
                "sessionId": session_id,
                "userId": user_id,
                "briefId": request.briefId,
                "briefName": brief_result.data["name"]
            },
            org_id
        )
    except:
        pass  # WebSocket notification is optional
    
    return {
        "sessionId": session_id,
        "briefId": request.briefId,
        "briefName": brief_result.data["name"],
        "startedAt": started_at
    }


@router.post("/desktop/session/end")
async def end_session(
    request: SessionEndRequest,
    authorization: str = Header(...)
):
    """
    End a work session and optionally submit work.
    Processes activities and creates submission.
    """
    token = authorization.replace("Bearer ", "")
    user_info = await verify_clerk_token(token)
    user_id = user_info["userId"]
    
    supabase = get_supabase()
    
    # Get session from DB
    session_result = supabase.table("work_sessions")\
        .select("*")\
        .eq("id", request.sessionId)\
        .eq("status", "active")\
        .single()\
        .execute()
    
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found or already ended")
    
    session = session_result.data
    
    if session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculate duration
    started_at_str = session.get("started_at") or session.get("created_at")
    if "Z" in started_at_str:
        started_at = datetime.fromisoformat(started_at_str.replace("Z", "+00:00"))
    elif "+" in started_at_str:
        started_at = datetime.fromisoformat(started_at_str)
    else:
        started_at = datetime.fromisoformat(started_at_str)
    
    ended_at = datetime.utcnow()
    duration_minutes = max(1, int((ended_at - started_at.replace(tzinfo=None)).total_seconds() / 60))
    
    # Update session in DB
    supabase.table("work_sessions")\
        .update({
            "ended_at": ended_at.isoformat(),
            "duration_minutes": duration_minutes,
            "status": "completed"
        })\
        .eq("id", request.sessionId)\
        .execute()
    
    # Get user name
    user_result = supabase.table("users")\
        .select("name, email")\
        .eq("id", user_id)\
        .single()\
        .execute()
    
    user_name = user_result.data.get("name") or user_result.data.get("email", "User") if user_result.data else "User"
    
    # Generate summary from activities
    summary_lines = []
    if request.activities:
        app_durations: Dict[str, int] = {}
        for activity in request.activities:
            app_durations[activity.app] = app_durations.get(activity.app, 0) + activity.duration
        
        # Top 3 apps
        sorted_apps = sorted(app_durations.items(), key=lambda x: x[1], reverse=True)[:3]
        for app, duration in sorted_apps:
            mins = duration // 60
            if mins > 0:
                summary_lines.append(f"Worked in {app} for {mins} minutes")
    
    if request.summary:
        summary_lines.insert(0, request.summary)
    
    if not summary_lines:
        summary_lines = [f"Work session: {duration_minutes} minutes"]
    
    # Create submission
    submission_data = {
        "brief_id": session["brief_id"],
        "user_id": user_id,
        "user_name": user_name,
        "role": session["role"],
        "summary_lines": summary_lines,
        "duration_minutes": duration_minutes,
        "session_id": request.sessionId,
        "status": "pending"
    }
    
    submission_result = supabase.table("submissions")\
        .insert(submission_data)\
        .execute()
    
    submission_id = submission_result.data[0]["id"] if submission_result.data else None
    
    # Notify web clients
    try:
        await websocket_manager.broadcast_event(
            "session:ended",
            {
                "sessionId": request.sessionId,
                "submissionId": submission_id,
                "userId": user_id,
                "userName": user_name,
                "briefId": session["brief_id"],
                "durationMinutes": duration_minutes
            },
            session.get("org_id")
        )
    except:
        pass  # WebSocket notification is optional
    
    return {
        "sessionId": request.sessionId,
        "submissionId": submission_id,
        "durationMinutes": duration_minutes,
        "summaryLines": summary_lines
    }


@router.websocket("/desktop/ws")
async def desktop_websocket(websocket: WebSocket):
    """
    WebSocket for real-time communication with desktop app.
    
    Events:
    - authenticate: Auth with Clerk token
    - heartbeat: Keep connection alive
    - activity: Real-time activity tracking
    """
    await websocket.accept()
    user_id: Optional[str] = None
    org_id: Optional[str] = None
    
    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")
            
            if event_type == "authenticate":
                token = data.get("token", "").replace("Bearer ", "")
                try:
                    user_info = await verify_clerk_token(token)
                    user_id = user_info["userId"]
                    org_id = user_info.get("orgId")
                    
                    await websocket.send_json({
                        "type": "authenticated",
                        "userId": user_id,
                        "orgId": org_id
                    })
                except Exception:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Authentication failed"
                    })
            
            elif event_type == "heartbeat":
                await websocket.send_json({"type": "pong"})
            
            elif event_type == "activity" and user_id:
                # Could store real-time activity here
                await websocket.send_json({
                    "type": "activity_ack",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown event: {event_type}"
                })
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Desktop WebSocket error: {e}")
