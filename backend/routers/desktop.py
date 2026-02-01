"""
Desktop App Integration Router - Handles desktop overlay communication.
"""
from fastapi import APIRouter, HTTPException, Header, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

from services.clerk_auth import verify_clerk_token
from services.supabase_client import get_supabase
from services.websocket_manager import websocket_manager
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from config.settings import settings

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
    userId: Optional[str] = None  # Optional - extracted from token
    orgId: Optional[str] = None
    activities: Optional[List[ActivityEntry]] = None


class SessionAnalyzeRequest(BaseModel):
    """Request to analyze a completed session."""
    sessionId: str
    submissionId: Optional[str] = None
    briefId: Optional[str] = None
    activities: Optional[List[Dict[str, Any]]] = None
    notes: Optional[List[Dict[str, Any]]] = None
    summaryLines: List[str]
    durationMinutes: int


class LiveInsightRequest(BaseModel):
    """Request for live AI insight during session."""
    activities: List[Dict[str, Any]]
    notes: Optional[List[str]] = None
    totalDuration: Optional[int] = None  # seconds


class ScreenAnalysisRequest(BaseModel):
    """Request for continuous screen analysis."""
    screenshot: str  # base64 encoded image
    projectName: Optional[str] = None
    projectDescription: Optional[str] = None
    currentTasks: Optional[List[str]] = None
    previousInsights: Optional[List[str]] = None  # To avoid repetition


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
    
    # Get all briefs for org (not just active)
    briefs_result = supabase.table("briefs")\
        .select("id, name, description, status")\
        .eq("org_id", org_id)\
        .execute()
    
    briefs = briefs_result.data if briefs_result.data else []
    
    # If no briefs found with org_id, try getting user's created briefs
    if not briefs:
        briefs_result = supabase.table("briefs")\
            .select("id, name, description, status")\
            .eq("created_by", user_id)\
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


@router.post("/desktop/session/analyze-screen")
async def analyze_screen(
    request: ScreenAnalysisRequest,
    authorization: str = Header(...)
):
    """
    Analyze a screenshot using Vision AI and extract important points.
    This runs continuously during a session to capture what's happening.
    """
    token = authorization.replace("Bearer ", "")
    await verify_clerk_token(token)
    
    if not request.screenshot:
        return {"bullets": [], "skip": True}
    
    # Build context about the project
    project_context = ""
    if request.projectName:
        project_context += f"Projekt: {request.projectName}\n"
    if request.projectDescription:
        project_context += f"Beschreibung: {request.projectDescription}\n"
    if request.currentTasks:
        project_context += f"Aktuelle Tasks: {', '.join(request.currentTasks[:5])}\n"
    
    # Previous insights to avoid repetition
    previous = ""
    if request.previousInsights:
        previous = f"\nBereits notiert (NICHT wiederholen): {', '.join(request.previousInsights[-5:])}"
    
    try:
        llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.3,
            max_tokens=200,
            api_key=settings.OPENAI_API_KEY
        )
        
        # Vision prompt
        messages = [
            {
                "role": "system",
                "content": f"""Du bist ein intelligenter Arbeits-Assistent der live mitschreibt was wichtig ist.
Analysiere den Screenshot und extrahiere NUR wichtige, projektrelevante Informationen.

{project_context}
{previous}

REGELN:
1. Nur NEUE, WICHTIGE Erkenntnisse notieren (Code-Änderungen, Fehler, wichtige UI-Elemente, Entscheidungen)
2. Maximal 1-2 kurze Stichpunkte auf Deutsch
3. Wenn nichts Neues/Wichtiges → antworte mit "SKIP"
4. Keine generischen Beobachtungen ("User arbeitet in VS Code")
5. Fokus auf: Bugs, TODOs, wichtige Code-Stellen, Fehler, Fortschritte

FORMAT (JSON):
{{"bullets": ["Stichpunkt 1", "Stichpunkt 2"]}}
oder
{{"skip": true}}"""
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Was ist wichtig auf diesem Screen? Nur relevante Stichpunkte."
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{request.screenshot}",
                            "detail": "low"  # Use low detail for speed
                        }
                    }
                ]
            }
        ]
        
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        
        # Parse response
        if "SKIP" in content.upper() or '"skip"' in content.lower():
            return {"bullets": [], "skip": True}
        
        # Try to parse JSON
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            result = json.loads(content)
            bullets = result.get("bullets", [])
            
            # Filter out empty or too short bullets
            bullets = [b for b in bullets if b and len(b) > 5]
            
            return {"bullets": bullets[:2], "skip": False}  # Max 2 bullets
            
        except json.JSONDecodeError:
            # If not JSON, try to extract bullet points
            if content and not content.upper().startswith("SKIP"):
                lines = [l.strip().lstrip("•-* ") for l in content.split("\n") if l.strip()]
                return {"bullets": lines[:2], "skip": False}
            return {"bullets": [], "skip": True}
        
    except Exception as e:
        print(f"Screen analysis error: {e}")
        return {"bullets": [], "skip": True, "error": str(e)}


@router.post("/desktop/session/live-insight")
async def get_live_insight(
    request: LiveInsightRequest,
    authorization: str = Header(...)
):
    """
    Generate a live AI insight about current work session.
    This is called periodically during a session to provide real-time feedback.
    """
    token = authorization.replace("Bearer ", "")
    await verify_clerk_token(token)
    
    if not request.activities:
        return {"insight": None}
    
    # Build activity context
    activity_text = ""
    for act in request.activities[-5:]:  # Last 5 activities
        app = act.get("app", "Unknown")
        file = act.get("file", "")
        duration = act.get("duration", 0)
        if file:
            activity_text += f"- {app}: {file} ({duration}s)\n"
        else:
            activity_text += f"- {app} ({duration}s)\n"
    
    notes_text = ""
    if request.notes:
        notes_text = "User notes: " + ", ".join(request.notes[-3:])
    
    total_min = (request.totalDuration or 0) // 60
    
    # Quick AI insight prompt
    prompt = f"""Du bist ein intelligenter Arbeits-Assistent. Analysiere diese aktuelle Arbeitsaktivität und gib ein kurzes, hilfreiches Update (1-2 Sätze auf Deutsch).

AKTIVITÄTEN (letzte Minuten):
{activity_text}
{notes_text}
Gesamtzeit: ~{total_min} Minuten

REGELN:
- Sei kurz und konkret (max 2 Sätze)
- Erwähne was gerade gemacht wird
- Gib einen hilfreichen Tipp oder Observation
- Schreib auf Deutsch
- Kein JSON, nur natürlicher Text

Beispiele:
- "Du arbeitest gerade an der API-Integration. Vergiss nicht die Error-Handler zu testen."
- "Gute Fortschritte bei den UI-Komponenten! Schon 3 Files bearbeitet."
- "Viel Zeit in der Doku - vielleicht Zeit für den nächsten Code-Sprint?"

Dein Insight:"""

    try:
        llm = ChatOpenAI(
            model="gpt-4o-mini",  # Faster model for live insights
            temperature=0.7,
            max_tokens=100,
            api_key=settings.OPENAI_API_KEY
        )
        
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        insight = response.content.strip()
        
        return {"insight": insight}
        
    except Exception as e:
        print(f"Live insight error: {e}")
        return {"insight": None, "error": str(e)}


@router.post("/desktop/session/analyze")
async def analyze_session(
    request: SessionAnalyzeRequest,
    authorization: str = Header(...)
):
    """
    Analyze a completed work session using AI.
    Compares work done against existing tasks and updates project status.
    
    Returns:
    - updatedTasks: Tasks that were marked as done/in_progress
    - newTasks: New tasks identified from the work
    - issues: Any deviations from plan or concerns
    - aiSummary: AI-generated summary of the session
    """
    token = authorization.replace("Bearer ", "")
    user_info = await verify_clerk_token(token)
    user_id = user_info["userId"]
    org_id = user_info.get("orgId")
    
    supabase = get_supabase()
    
    # Get brief and existing tasks
    brief_id = request.briefId
    if not brief_id and request.sessionId:
        # Try to get brief from session
        session_result = supabase.table("work_sessions")\
            .select("brief_id")\
            .eq("id", request.sessionId)\
            .single()\
            .execute()
        if session_result.data:
            brief_id = session_result.data.get("brief_id")
    
    existing_tasks = []
    if brief_id:
        tasks_result = supabase.table("tasks")\
            .select("id, title, description, status, priority, role")\
            .eq("brief_id", brief_id)\
            .execute()
        existing_tasks = tasks_result.data or []
    
    # Build context for AI analysis
    activity_summary = ""
    if request.activities:
        for act in request.activities:
            app = act.get("app", "Unknown")
            duration = act.get("totalDuration", 0) // 60
            files = act.get("files", [])
            if duration > 0:
                activity_summary += f"- {app}: {duration}m"
                if files:
                    activity_summary += f" (files: {', '.join(files[:3])})"
                activity_summary += "\n"
    
    notes_text = ""
    if request.notes:
        notes_text = "\n".join([f"- {n.get('text', '')}" for n in request.notes])
    
    tasks_text = ""
    for task in existing_tasks:
        tasks_text += f"- [{task['status'].upper()}] {task['title']}: {task.get('description', '')}\n"
    
    # AI Analysis Prompt
    analysis_prompt = f"""Analyze this work session and compare it to the project's existing tasks.

SESSION DATA:
- Duration: {request.durationMinutes} minutes
- Summary: {', '.join(request.summaryLines)}

ACTIVITY LOG:
{activity_summary or 'No activity logged'}

USER NOTES:
{notes_text or 'No notes'}

EXISTING PROJECT TASKS:
{tasks_text or 'No tasks defined yet'}

ANALYZE AND RETURN JSON:
{{
    "updatedTasks": [
        {{"taskId": "task_id_if_exists", "title": "Task title", "status": "done|in_progress", "wasUpdated": true, "reason": "Why this task was updated"}}
    ],
    "newTasks": [
        {{"title": "New task title", "description": "What needs to be done", "priority": "high|medium|low", "reason": "Why this task was identified"}}
    ],
    "issues": [
        "Any concerns, blockers, or deviations from plan"
    ],
    "aiSummary": "One paragraph summary of what was accomplished and project status"
}}

RULES:
1. Only mark tasks as "done" if the work clearly completed them
2. Mark tasks as "in_progress" if work started but not finished
3. Add newTasks only for clear follow-up work identified
4. Add issues if: work took longer than expected, blocked on something, or deviated from plan
5. Be concise but specific in the aiSummary

Return ONLY valid JSON, no other text."""

    try:
        llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.3,
            api_key=settings.OPENAI_API_KEY
        )
        
        response = await llm.ainvoke([HumanMessage(content=analysis_prompt)])
        content = response.content
        
        # Parse JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        result = json.loads(content)
        
        # Update tasks in database
        updated_task_ids = []
        for updated in result.get("updatedTasks", []):
            if updated.get("wasUpdated") and updated.get("taskId"):
                task_id = updated["taskId"]
                new_status = updated.get("status", "in_progress")
                
                supabase.table("tasks")\
                    .update({"status": new_status})\
                    .eq("id", task_id)\
                    .execute()
                updated_task_ids.append(task_id)
        
        # Insert new tasks
        new_task_ids = []
        for new_task in result.get("newTasks", []):
            if brief_id:
                insert_result = supabase.table("tasks")\
                    .insert({
                        "brief_id": brief_id,
                        "title": new_task["title"],
                        "description": new_task.get("description", ""),
                        "priority": new_task.get("priority", "medium"),
                        "status": "todo",
                        "role": "dev"  # Default role
                    })\
                    .execute()
                if insert_result.data:
                    new_task_ids.append(insert_result.data[0]["id"])
        
        # Update submission with analysis
        if request.submissionId:
            supabase.table("submissions")\
                .update({
                    "ai_analysis": result.get("aiSummary"),
                    "status": "reviewed"
                })\
                .eq("id", request.submissionId)\
                .execute()
        
        # Notify web clients
        try:
            await websocket_manager.broadcast_event(
                "workspace:updated",
                {
                    "sessionId": request.sessionId,
                    "briefId": brief_id,
                    "updatedTaskIds": updated_task_ids,
                    "newTaskIds": new_task_ids,
                    "issues": result.get("issues", []),
                    "aiSummary": result.get("aiSummary", "")
                },
                org_id
            )
        except:
            pass
        
        return result
        
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return {
            "updatedTasks": [],
            "newTasks": [],
            "issues": ["Failed to parse AI analysis"],
            "aiSummary": "Session recorded but analysis failed. Please review manually."
        }
    except Exception as e:
        print(f"Session analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
