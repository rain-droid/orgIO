from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv

from app.agents import brief_agent
from app.auth import verify_clerk_token, get_current_user

load_dotenv()

app = FastAPI(
    title="Drift API",
    description="AI-powered Sprint Planning Backend",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# MODELS
# ============================================

class BriefGenerateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    role: str  # pm, dev, designer

class BriefGenerateResponse(BaseModel):
    role: str
    content: dict

class SubmissionAnalyzeRequest(BaseModel):
    brief_id: str
    summary: str
    duration_minutes: int

class SubmissionAnalyzeResponse(BaseModel):
    matched_tasks: List[str]
    suggestions: List[str]
    confidence: float

# ============================================
# ROUTES
# ============================================

@app.get("/")
async def root():
    return {"status": "ok", "service": "drift-backend"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/api/brief/generate", response_model=BriefGenerateResponse)
async def generate_brief_content(
    request: BriefGenerateRequest,
    user = Depends(get_current_user)
):
    """Generate role-specific brief content using AI agents"""
    try:
        content = await brief_agent.generate_brief_content(
            name=request.name,
            description=request.description,
            role=request.role
        )
        return BriefGenerateResponse(role=request.role, content=content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/submission/analyze", response_model=SubmissionAnalyzeResponse)
async def analyze_submission(
    request: SubmissionAnalyzeRequest,
    user = Depends(get_current_user)
):
    """Analyze a work submission and match to tasks"""
    try:
        result = await brief_agent.analyze_submission(
            brief_id=request.brief_id,
            summary=request.summary,
            duration_minutes=request.duration_minutes
        )
        return SubmissionAnalyzeResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/desktop/session")
async def process_desktop_session(
    screenshots: List[str],  # base64 encoded
    user = Depends(get_current_user)
):
    """Process desktop recording session and generate summary"""
    try:
        summary = await brief_agent.process_session(screenshots)
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
