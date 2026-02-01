from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


# ============================================
# ACTIVITY
# ============================================

class Activity(BaseModel):
    """Activity recorded by Desktop App"""
    app: str = Field(..., description="Application name (e.g., 'Cursor', 'Chrome')")
    title: str = Field(..., description="Window title")
    summary: str = Field(..., description="AI-generated activity summary")
    duration: int = Field(..., ge=0, description="Duration in minutes")
    timestamp: int = Field(..., description="Unix timestamp in milliseconds")


# ============================================
# SNIPPET
# ============================================

class Snippet(BaseModel):
    """OCR text snippet for context"""
    text: str = Field(..., max_length=500, description="OCR text snippet")
    context: Literal["code", "terminal", "browser"]


# ============================================
# SUBMISSION PAYLOAD (Desktop → Backend)
# ============================================

class SubmissionPayload(BaseModel):
    """Submission from Desktop App"""
    briefId: str = Field(..., alias="briefId")
    userId: str = Field(..., alias="userId")
    userName: str = Field(..., alias="userName")
    role: Literal["pm", "dev", "designer"]
    summary: List[str] = Field(..., max_items=20)
    duration: int = Field(..., ge=0, description="Session duration in minutes")
    activities: List[Activity] = Field(..., max_items=1000)
    snippets: Optional[List[Snippet]] = Field(default=None, max_items=5)

    class Config:
        populate_by_name = True


# ============================================
# SUBMISSION RESPONSE (Backend → Desktop/Web)
# ============================================

class SubmissionResponse(BaseModel):
    """Submission response"""
    id: str
    briefId: str = Field(..., alias="briefId")
    userId: str = Field(..., alias="userId")
    userName: str = Field(..., alias="userName")
    role: Literal["pm", "dev", "designer"]
    summary: List[str]
    duration: int
    activities: List[Activity]
    matchedTasks: List[str] = Field(..., alias="matchedTasks")
    status: Literal["pending", "approved", "rejected"]
    createdAt: str = Field(..., alias="createdAt")

    class Config:
        populate_by_name = True


# ============================================
# TASK
# ============================================

class Task(BaseModel):
    """Task model"""
    id: str
    briefId: str = Field(..., alias="briefId")
    role: Literal["pm", "dev", "designer"]
    title: str
    description: str
    status: Literal["todo", "in_progress", "done"]
    createdAt: str = Field(..., alias="createdAt")

    class Config:
        populate_by_name = True


# ============================================
# BRIEF
# ============================================

class Brief(BaseModel):
    """Brief model"""
    id: str
    orgId: str = Field(..., alias="orgId")
    name: str
    description: str
    status: Literal["planning", "active", "completed"]
    createdBy: str = Field(..., alias="createdBy")
    createdAt: str = Field(..., alias="createdAt")
    tasks: Optional[List[Task]] = None

    class Config:
        populate_by_name = True


# ============================================
# BRIEF CREATE
# ============================================

class BriefCreate(BaseModel):
    """Create brief request"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default="", max_length=5000)


# ============================================
# TASK CREATE
# ============================================

class TaskCreate(BaseModel):
    """Create task request"""
    briefId: str = Field(..., alias="briefId")
    role: Literal["pm", "dev", "designer"]
    title: str
    description: str

    class Config:
        populate_by_name = True


# ============================================
# ERROR RESPONSE
# ============================================

class ErrorDetail(BaseModel):
    """Error detail"""
    code: str
    message: str
    details: Optional[dict] = None


class ErrorResponse(BaseModel):
    """Standard error response"""
    error: ErrorDetail
