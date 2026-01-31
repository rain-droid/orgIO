from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from datetime import datetime
from typing import Dict, Any, Optional
from models.schemas import SubmissionPayload
from services.clerk_auth import get_current_user
from services.supabase_client import get_supabase
from services.agent_manager import get_agent_manager, AgentManager
from services.websocket_manager import get_websocket_manager

router = APIRouter()


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


@router.post("/submissions", status_code=status.HTTP_201_CREATED)
async def create_submission(
    payload: SubmissionPayload,
    authorization: str = Header(...),
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """
    Process submission with multiple agents.
    
    Agent Flow:
    1. Submission Agent: Analyze activities → enhanced summary
    2. Task Matching Agent: Match to tasks → task IDs
    3. Store submission in database
    4. Broadcast WebSocket event to team
    """
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    # Verify brief exists and user has access
    brief_response = supabase.table("briefs").select("*").eq("id", payload.briefId).eq("org_id", user["orgId"]).single().execute()
    
    if not brief_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Brief not found"}
        )
    
    brief = brief_response.data
    
    # Get tasks for matching
    tasks_response = supabase.table("tasks").select("*").eq("brief_id", payload.briefId).execute()
    tasks = tasks_response.data or []
    
    # Agent 1: Submission Analysis (enhance summary)
    try:
        submission_agent = agent_manager.get_agent("submission")
        analysis = await submission_agent.analyze_submission(
            activities=[act.model_dump() for act in payload.activities],
            role=payload.role,
            brief_context=f"{brief['name']}: {brief['description']}"
        )
        
        # Use enhanced summary from agent
        final_summary = analysis.get("summary", payload.summary)
        
    except Exception as e:
        print(f"Submission analysis error: {e}")
        # Fallback to user-provided summary
        final_summary = payload.summary
    
    # Agent 2: Task Matching
    try:
        matching_agent = agent_manager.get_agent("matching")
        matched_task_ids = await matching_agent.match_tasks(
            tasks=tasks,
            summary=payload.summary,
            activities=[act.model_dump() for act in payload.activities],
            snippets=[snip.model_dump() for snip in payload.snippets] if payload.snippets else None
        )
        
    except Exception as e:
        print(f"Task matching error: {e}")
        # Fallback to empty matches
        matched_task_ids = []
    
    # Store submission
    submission_data = {
        "brief_id": payload.briefId,
        "user_id": user["userId"],
        "user_name": payload.userName,
        "role": payload.role,
        "summary_lines": final_summary,
        "duration_minutes": payload.duration,
        "matched_tasks": matched_task_ids,
        "status": "pending"
    }
    
    submission_response = supabase.table("submissions").insert(submission_data).execute()
    
    if not submission_response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": "Failed to create submission"}
        )
    
    submission = submission_response.data[0]
    
    # Store activities in separate table (optional)
    if payload.activities:
        activities_data = [
            {
                "submission_id": submission["id"],
                "app": act.app,
                "title": act.title,
                "summary": act.summary,
                "duration": act.duration,
                "timestamp": act.timestamp
            }
            for act in payload.activities
        ]
        
        try:
            supabase.table("submission_activities").insert(activities_data).execute()
        except Exception as e:
            print(f"Failed to store activities: {e}")
    
    # Broadcast WebSocket event
    try:
        ws_manager = get_websocket_manager()
        await ws_manager.broadcast_event(
            event_type="submission:new",
            payload={
                "submissionId": submission["id"],
                "briefId": payload.briefId,
                "userId": user["userId"],
                "userName": payload.userName
            },
            org_id=user["orgId"]
        )
    except Exception as e:
        print(f"WebSocket broadcast error: {e}")
    
    # Return response
    return _map_submission(submission)


@router.get("/submissions/{submission_id}")
async def get_submission(
    submission_id: str,
    authorization: str = Header(...),
):
    """Get details of a specific submission"""
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    # Get submission
    response = supabase.table("submissions").select("*").eq("id", submission_id).execute()
    
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Submission not found"}
        )
    
    submission = response.data[0]
    
    # Verify access (must be in same org as brief)
    brief = supabase.table("briefs").select("org_id").eq("id", submission["brief_id"]).single().execute()
    
    if not brief.data or brief.data["org_id"] != user["orgId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Access denied"}
        )
    
    # Get activities
    activities_response = supabase.table("submission_activities").select("*").eq("submission_id", submission_id).execute()
    activities = activities_response.data or []
    
    result = _map_submission(submission)
    result["activities"] = activities
    return result


@router.get("/submissions")
async def list_submissions(
    authorization: str = Header(...),
    status_filter: Optional[str] = Query(None, alias="status", regex="^(pending|approved|rejected)$"),
    brief_id: Optional[str] = Query(None, alias="briefId"),
    user_id: Optional[str] = Query(None, alias="userId"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List submissions for the current organization"""
    user = await get_current_user(authorization)
    supabase = get_supabase()

    query = supabase.table("submissions").select("*")

    if status_filter:
        query = query.eq("status", status_filter)
    if brief_id:
        query = query.eq("brief_id", brief_id)
    if user_id:
        query = query.eq("user_id", user_id)

    query = query.limit(limit).offset(offset).order("created_at", desc=True)

    response = query.execute()
    submissions = response.data or []

    if submissions:
        brief_ids = list({sub["brief_id"] for sub in submissions if sub.get("brief_id")})
        if brief_ids:
            briefs_response = supabase.table("briefs").select("id, org_id").in_("id", brief_ids).execute()
            allowed_brief_ids = {brief["id"] for brief in (briefs_response.data or []) if brief.get("org_id") == user["orgId"]}
            submissions = [sub for sub in submissions if sub.get("brief_id") in allowed_brief_ids]

    return {
        "submissions": [_map_submission(sub) for sub in submissions],
        "total": len(submissions),
        "limit": limit,
        "offset": offset
    }


@router.patch("/submissions/{submission_id}")
async def update_submission_status(
    submission_id: str,
    update_data: dict,
    authorization: str = Header(...),
):
    """
    Approve or reject a submission.
    
    Side effects:
    - If approved: Update matched tasks to 'done'
    - Broadcast WebSocket event
    """
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    # Get submission
    submission = supabase.table("submissions").select("*").eq("id", submission_id).single().execute()
    
    if not submission.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Submission not found"}
        )
    
    sub = submission.data
    
    # Verify access
    brief = supabase.table("briefs").select("org_id").eq("id", sub["brief_id"]).single().execute()
    
    if not brief.data or brief.data["org_id"] != user["orgId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Access denied"}
        )
    
    # Update submission
    update_payload = {}
    
    if "status" in update_data:
        update_payload["status"] = update_data["status"]
    
    if "matchedTasks" in update_data:
        update_payload["matched_tasks"] = update_data["matchedTasks"]
    
    updated = supabase.table("submissions").update(update_payload).eq("id", submission_id).execute()
    
    if not updated.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": "Failed to update submission"}
        )
    
    # If approved, update tasks to 'done'
    if update_data.get("status") == "approved" and updated.data[0].get("matched_tasks"):
        for task_id in updated.data[0]["matched_tasks"]:
            try:
                supabase.table("tasks").update({"status": "done"}).eq("id", task_id).execute()
            except Exception as e:
                print(f"Failed to update task {task_id}: {e}")
        
        # Broadcast tasks updated event
        try:
            ws_manager = get_websocket_manager()
            await ws_manager.broadcast_event(
                event_type="tasks:updated",
                payload={
                    "briefId": sub["brief_id"],
                    "taskIds": updated.data[0]["matched_tasks"]
                },
                org_id=user["orgId"]
            )
        except Exception as e:
            print(f"WebSocket broadcast error: {e}")
    
    return {
        "id": updated.data[0]["id"],
        "status": updated.data[0]["status"],
        "updatedAt": datetime.utcnow().isoformat()
    }
