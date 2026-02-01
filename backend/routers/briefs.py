from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from typing import Optional, Dict, Any
from models.schemas import BriefCreate
from services.clerk_auth import get_current_user, verify_clerk_token
from services.supabase_client import get_supabase
from services.agent_manager import get_agent_manager, AgentManager

router = APIRouter()


def _map_task(task: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": task.get("id"),
        "briefId": task.get("brief_id"),
        "role": task.get("role"),
        "title": task.get("title"),
        "description": task.get("description") or "",
        "status": task.get("status"),
        "createdAt": task.get("created_at")
    }


def _map_brief(brief: Dict[str, Any], include_tasks: bool = True) -> Dict[str, Any]:
    mapped = {
        "id": brief.get("id"),
        "orgId": brief.get("org_id"),
        "name": brief.get("name"),
        "description": brief.get("description") or "",
        "status": brief.get("status"),
        "createdBy": brief.get("created_by"),
        "createdAt": brief.get("created_at")
    }

    if include_tasks and isinstance(brief.get("tasks"), list):
        mapped["tasks"] = [_map_task(task) for task in brief.get("tasks", [])]

    return mapped


def _map_submission(submission: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": submission.get("id"),
        "briefId": submission.get("brief_id"),
        "userId": submission.get("user_id"),
        "userName": submission.get("user_name"),
        "role": submission.get("role"),
        "summaryLines": submission.get("summary_lines") or [],
        "durationMinutes": submission.get("duration_minutes") or 0,
        "matchedTasks": submission.get("matched_tasks") or [],
        "status": submission.get("status"),
        "createdAt": submission.get("created_at")
    }


@router.post("/briefs", status_code=status.HTTP_201_CREATED)
async def create_brief(
    brief_data: BriefCreate,
    authorization: str = Header(...),
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """
    Create brief and generate tasks with AI.
    
    Flow:
    1. Validate auth
    2. Create brief in DB
    3. Brief Agent generates role-specific tasks
    4. Store generated tasks
    5. Return brief with tasks
    """
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    # Get org_id - use provided, token, users table, or fallback to user_id
    org_id = brief_data.orgId or user.get("orgId")
    
    if not org_id:
        user_record = supabase.table("users").select("org_id").eq("id", user["userId"]).execute()
        if user_record.data and user_record.data[0].get("org_id"):
            org_id = user_record.data[0]["org_id"]
        else:
            # Fallback: use user_id as org_id for single-user mode
            org_id = user["userId"]
    
    # Create brief
    brief_insert = {
        "org_id": org_id,
        "name": brief_data.name,
        "description": brief_data.description,
        "status": "planning",
        "created_by": user["userId"]
    }
    
    brief_response = supabase.table("briefs").insert(brief_insert).execute()
    
    if not brief_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": "Failed to create brief"}
        )
    
    brief = brief_response.data[0]
    
    # Generate tasks with Brief Agent
    try:
        brief_agent = agent_manager.get_agent("brief")
        generated = await brief_agent.process_brief(
            brief_name=brief_data.name,
            description=brief_data.description
        )
        
        # Store generated tasks
        tasks_to_insert = []
        for task in generated.get("tasks", []):
            tasks_to_insert.append({
                "brief_id": brief["id"],
                "role": task["role"],
                "title": task["title"],
                "description": task.get("description", ""),
                "status": "todo"
            })
        
        if tasks_to_insert:
            supabase.table("tasks").insert(tasks_to_insert).execute()
        
    except Exception as e:
        print(f"Task generation error: {e}")
        # Brief created successfully even if task generation fails
    
    # Fetch brief with tasks
    brief_with_tasks = supabase.table("briefs").select("*, tasks(*)").eq("id", brief["id"]).single().execute()
    
    return _map_brief(brief_with_tasks.data, include_tasks=True)


@router.get("/briefs/{brief_id}")
async def get_brief(
    brief_id: str,
    authorization: str = Header(...),
):
    """Get brief details with tasks"""
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    # Get brief with tasks
    response = supabase.table("briefs").select("*, tasks(*)").eq("id", brief_id).eq("org_id", user["orgId"]).single().execute()
    
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Brief not found"}
        )
    
    return _map_brief(response.data, include_tasks=True)


@router.get("/briefs")
async def list_briefs(
    authorization: str = Header(...),
):
    """List briefs for the current user"""
    user = await get_current_user(authorization)
    supabase = get_supabase()

    # Simple: just get briefs created by this user
    response = supabase.table("briefs").select("*").eq("created_by", user["userId"]).order("created_at", desc=True).execute()
    briefs = response.data or []

    return {"briefs": [_map_brief(brief, include_tasks=False) for brief in briefs]}


@router.delete("/briefs/{brief_id}")
async def delete_brief(
    brief_id: str,
    authorization: str = Header(...)
):
    """Delete a brief"""
    user = await get_current_user(authorization)
    supabase = get_supabase()

    response = supabase.table("briefs").delete().eq("id", brief_id).eq("org_id", user["orgId"]).execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Brief not found"}
        )

    return {"id": brief_id, "deleted": True}


@router.get("/briefs/{brief_id}/tasks")
async def get_tasks(
    brief_id: str,
    authorization: str = Header(...),
    role: Optional[str] = Query(None, regex="^(pm|dev|designer)$"),
    status_filter: Optional[str] = Query(None, alias="status", regex="^(todo|in_progress|done)$"),
):
    """Get all tasks for a brief, optionally filtered by role and status"""
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    # Verify brief access
    brief = supabase.table("briefs").select("id").eq("id", brief_id).eq("org_id", user["orgId"]).single().execute()
    
    if not brief.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Brief not found"}
        )
    
    # Build query
    query = supabase.table("tasks").select("*").eq("brief_id", brief_id)
    
    if role:
        query = query.eq("role", role)
    if status_filter:
        query = query.eq("status", status_filter)
    
    response = query.execute()
    
    tasks = response.data or []

    return {
        "tasks": [_map_task(task) for task in tasks],
        "total": len(tasks)
    }


@router.get("/briefs/{brief_id}/view")
async def get_brief_view(
    brief_id: str,
    role: str = Query(..., regex="^(pm|dev|designer)$"),
    authorization: str = Header(...),
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """
    Generate role-specific view content with Generative UI Agent.
    
    Returns structured JSON that frontend renders as components.
    """
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    # Get brief and tasks
    brief_response = supabase.table("briefs").select("*").eq("id", brief_id).eq("org_id", user["orgId"]).single().execute()
    
    if not brief_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Brief not found"}
        )
    
    brief = brief_response.data
    
    # Get tasks
    tasks_response = supabase.table("tasks").select("*").eq("brief_id", brief_id).execute()
    tasks = tasks_response.data or []
    
    # Generate view with UI Agent
    try:
        ui_agent = agent_manager.get_agent("ui")
        view_content = await ui_agent.generate_view_content(
            brief=brief,
            tasks=tasks,
            role=role
        )
        
        return view_content
        
    except Exception as e:
        print(f"View generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": f"Failed to generate view: {str(e)}"}
        )


@router.get("/briefs/{brief_id}/submissions")
async def get_submissions_for_brief(
    brief_id: str,
    authorization: str = Header(...),
    status_filter: Optional[str] = Query(None, alias="status", regex="^(pending|approved|rejected)$"),
    user_id: Optional[str] = Query(None, alias="userId"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List all submissions for a brief"""
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    # Verify brief access
    brief = supabase.table("briefs").select("id").eq("id", brief_id).eq("org_id", user["orgId"]).single().execute()
    
    if not brief.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Brief not found"}
        )
    
    # Build query
    query = supabase.table("submissions").select("*").eq("brief_id", brief_id)
    
    if status_filter:
        query = query.eq("status", status_filter)
    if user_id:
        query = query.eq("user_id", user_id)
    
    query = query.limit(limit).offset(offset).order("created_at", desc=True)
    
    response = query.execute()
    
    submissions = response.data or []

    return {
        "submissions": [_map_submission(sub) for sub in submissions],
        "total": len(submissions),
        "limit": limit,
        "offset": offset
    }


# =============================================================================
# Streaming Brief Generation WebSocket
# =============================================================================

from fastapi import WebSocket, WebSocketDisconnect
from langchain_openai import ChatOpenAI
from config.settings import settings as app_settings
import json

@router.websocket("/briefs/generate/stream")
async def stream_brief_generation(websocket: WebSocket):
    """
    WebSocket endpoint for streaming brief generation.
    
    Message format:
    {
        "type": "generate",
        "name": "Project name",
        "description": "Project description",
        "role": "pm" | "dev" | "designer",
        "token": "clerk_jwt_token"
    }
    """
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") != "generate":
                await websocket.send_json({"type": "error", "message": "Unknown message type"})
                continue
            
            # Authenticate
            token = data.get("token", "").replace("Bearer ", "")
            try:
                user = await verify_clerk_token(token)
            except Exception:
                await websocket.send_json({"type": "error", "message": "Authentication failed"})
                continue
            
            name = data.get("name", "")
            description = data.get("description", "")
            role = data.get("role", "dev")
            
            # Stream generation
            await websocket.send_json({"type": "start", "phase": "tasks"})
            
            # Generate tasks with streaming
            llm = ChatOpenAI(
                model="gpt-4o",
                temperature=0.7,
                streaming=True,
                api_key=app_settings.OPENAI_API_KEY
            )
            
            task_prompt = f"""Generate tasks for this project as a {role.upper()}:

Project: {name}
Description: {description}

Return ONLY a JSON array of tasks with this structure:
[
  {{"title": "Task title", "description": "Description", "priority": "high|medium|low", "estimated_hours": 2}}
]

Generate 5-8 focused tasks appropriate for a {role}. Return ONLY valid JSON, no other text."""

            full_response = ""
            async for chunk in llm.astream([{"role": "user", "content": task_prompt}]):
                if chunk.content:
                    full_response += chunk.content
                    await websocket.send_json({"type": "chunk", "phase": "tasks", "content": chunk.content})
            
            await websocket.send_json({"type": "end", "phase": "tasks"})
            
            # Parse tasks
            try:
                # Extract JSON from response
                json_str = full_response
                if "```json" in json_str:
                    json_str = json_str.split("```json")[1].split("```")[0].strip()
                elif "```" in json_str:
                    json_str = json_str.split("```")[1].split("```")[0].strip()
                
                tasks = json.loads(json_str)
            except:
                tasks = []
            
            # Generate spec with streaming
            await websocket.send_json({"type": "start", "phase": "spec"})
            
            spec_prompts = {
                "pm": f"Create a concise Product Specification for '{name}': {description}. Include: Overview, User Stories (3-5), Timeline, Success Metrics. Use markdown.",
                "dev": f"Create a concise Technical Specification for '{name}': {description}. Include: Architecture, API Design, Tech Stack, Security. Use markdown with code examples.",
                "designer": f"Create a concise Design Specification for '{name}': {description}. Include: User Flow, Components, Design Tokens, Accessibility. Use markdown."
            }
            
            spec_prompt = spec_prompts.get(role, spec_prompts["dev"])
            
            full_spec = ""
            async for chunk in llm.astream([{"role": "user", "content": spec_prompt}]):
                if chunk.content:
                    full_spec += chunk.content
                    await websocket.send_json({"type": "chunk", "phase": "spec", "content": chunk.content})
            
            await websocket.send_json({"type": "end", "phase": "spec"})
            
            # Send final result
            await websocket.send_json({
                "type": "complete",
                "tasks": tasks,
                "spec": full_spec,
                "role": role,
                "projectName": name
            })
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Streaming generation error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
