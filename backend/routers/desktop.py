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


class ProcessNoteRequest(BaseModel):
    """Request to process a raw note into a clean bullet point."""
    note: str
    projectName: Optional[str] = None
    recentActivity: Optional[str] = None  # Context about what user is doing


@router.post("/desktop/session/process-note")
async def process_note(
    request: ProcessNoteRequest,
    authorization: str = Header(...)
):
    """
    Process a raw user note into a clean, professional bullet point.
    Transforms informal notes like "fixed the bug" into "Fixed authentication bug in login flow"
    """
    token = authorization.replace("Bearer ", "")
    await verify_clerk_token(token)
    
    if not request.note or len(request.note.strip()) < 2:
        return {"bullet": request.note, "processed": False}
    
    context = ""
    if request.projectName:
        context += f"Project: {request.projectName}. "
    if request.recentActivity:
        context += f"Recent activity: {request.recentActivity}. "
    
    try:
        llm = ChatOpenAI(
            model="gpt-4o-mini",  # Fast model for quick processing
            temperature=0.3,
            max_tokens=50,
            api_key=settings.OPENAI_API_KEY
        )
        
        prompt = f"""Transform this raw note into a clean, professional bullet point for a work log.

{context}
Raw note: "{request.note}"

RULES:
- Keep it SHORT (max 8 words)
- Start with action verb (Added, Fixed, Implemented, Created, Updated, etc.)
- Be specific if possible (include file/function names mentioned)
- Professional tone
- If note is already good, keep it similar

Examples:
- "fixed the bug" → "Fixed authentication bug"
- "working on api" → "Implementing API endpoints"
- "done with login" → "Completed login feature"
- "testing stuff" → "Running tests"

Output ONLY the bullet point, nothing else."""

        response = await llm.ainvoke([HumanMessage(content=prompt)])
        bullet = response.content.strip().strip('"').strip("'").strip("-").strip("•").strip()
        
        # Ensure it starts with capital letter
        if bullet:
            bullet = bullet[0].upper() + bullet[1:] if len(bullet) > 1 else bullet.upper()
        
        return {"bullet": bullet, "processed": True, "original": request.note}
        
    except Exception as e:
        print(f"Note processing error: {e}")
        # Fallback: return original note
        return {"bullet": request.note, "processed": False, "error": str(e)}


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
    
    print(f"[desktop/sync] user_id: {user_id}, org_id: {org_id}")
    
    supabase = get_supabase()
    
    # Try multiple strategies to find briefs
    briefs = []
    
    # Strategy 1: Get all briefs for org
    if org_id:
        briefs_result = supabase.table("briefs")\
            .select("id, name, description, status, org_id, created_by")\
            .eq("org_id", org_id)\
            .execute()
        briefs = briefs_result.data if briefs_result.data else []
        print(f"[desktop/sync] Found {len(briefs)} briefs by org_id")
    
    # Strategy 2: Get user's created briefs
    if not briefs:
        briefs_result = supabase.table("briefs")\
            .select("id, name, description, status, org_id, created_by")\
            .eq("created_by", user_id)\
            .execute()
        briefs = briefs_result.data if briefs_result.data else []
        print(f"[desktop/sync] Found {len(briefs)} briefs by created_by")
    
    # Strategy 3: Get ALL briefs (for debugging - remove in production)
    if not briefs:
        all_briefs_result = supabase.table("briefs")\
            .select("id, name, description, status, org_id, created_by")\
            .limit(10)\
            .execute()
        all_briefs = all_briefs_result.data if all_briefs_result.data else []
        print(f"[desktop/sync] Total briefs in DB: {len(all_briefs)}")
        if all_briefs:
            print(f"[desktop/sync] Sample brief: org_id={all_briefs[0].get('org_id')}, created_by={all_briefs[0].get('created_by')}")
        
        # Use all briefs for now (temporary fix)
        briefs = all_briefs
    
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
        .select("id, name, org_id, created_by")\
        .eq("id", request.briefId)\
        .single()\
        .execute()
    
    if not brief_result.data:
        raise HTTPException(status_code=404, detail="Brief not found")
    
    brief = brief_result.data
    
    # Check access: user must be creator OR in same org
    has_access = False
    if brief.get("created_by") == user_id:
        has_access = True
    elif org_id and brief.get("org_id") == org_id:
        has_access = True
    elif not org_id and not brief.get("org_id"):
        # Both have no org - allow if user created it
        has_access = brief.get("created_by") == user_id
    
    if not has_access:
        print(f"[Session] Access denied: user={user_id}, org={org_id}, brief_org={brief.get('org_id')}, brief_creator={brief.get('created_by')}")
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
    except Exception as e:
        print(f"WebSocket broadcast error: {e}")
    
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
        project_context += f"Project: {request.projectName}\n"
    if request.projectDescription:
        project_context += f"Description: {request.projectDescription}\n"
    if request.currentTasks:
        project_context += f"Current tasks: {', '.join(request.currentTasks[:5])}\n"
    
    # Previous insights to avoid repetition
    previous = ""
    if request.previousInsights:
        previous = f"\nAlready noted (DO NOT repeat): {', '.join(request.previousInsights[-5:])}"
    
    try:
        llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.3,
            max_tokens=200,
            api_key=settings.OPENAI_API_KEY
        )
        
        # Vision prompt - optimized for capturing actionable work insights
        messages = [
            {
                "role": "system",
                "content": f"""You are a sharp-eyed work tracker. Your job: spot and log CONCRETE progress, blockers, and decisions.

{project_context}
{previous}

CAPTURE THESE (be specific!):
- Function/component names being edited
- Error messages or warnings visible
- File names being worked on
- API endpoints, database queries
- Test results (pass/fail)
- Git commits, branch names
- Design decisions visible in code/comments
- TODO/FIXME comments
- Console output, logs

SKIP THESE:
- Generic "working in IDE" observations
- Unchanged screens
- Browser tabs with no relevant content
- Anything already noted above

OUTPUT FORMAT:
{{"bullets": ["Editing UserAuth.tsx - adding password validation", "Error: Cannot read property 'id' of undefined"]}}
or if nothing concrete:
{{"skip": true}}

Keep bullets SHORT (max 10 words) and SPECIFIC (names, numbers, exact errors)."""
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "What concrete work is visible? File names, errors, progress - be specific."
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
    prompt = f"""You are an intelligent work assistant. Analyze this current work activity and provide a short, helpful update (1-2 sentences).

ACTIVITIES (last minutes):
{activity_text}
{notes_text}
Total time: ~{total_min} minutes

RULES:
- Be brief and specific (max 2 sentences)
- Mention what's currently being done
- Give a helpful tip or observation
- Write in English
- No JSON, just natural text

Examples:
- "Working on API integration. Don't forget to test the error handlers."
- "Good progress on UI components! Already edited 3 files."
- "Lots of time in docs - maybe time for the next code sprint?"

Your insight:"""

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
