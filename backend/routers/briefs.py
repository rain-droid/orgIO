from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from typing import Optional
from models.schemas import BriefCreate, Brief, Task
from services.clerk_auth import get_current_user
from services.supabase_client import get_supabase
from services.agent_manager import get_agent_manager, AgentManager

router = APIRouter()


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
    
    # Create brief
    brief_insert = {
        "org_id": user["orgId"],
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
    
    return brief_with_tasks.data


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
    
    return response.data


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
    
    return {
        "tasks": response.data or [],
        "total": len(response.data or [])
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
    
    return {
        "submissions": response.data or [],
        "total": len(response.data or []),
        "limit": limit,
        "offset": offset
    }
