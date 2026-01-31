from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn

from routers import auth, briefs, submissions, users
from services.agent_manager import get_agent_manager
from config.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    
    Startup: Initialize agent manager (lazy-loaded agents)
    Shutdown: Cleanup resources
    """
    # Startup
    print("🚀 Starting DRIFT API Server...")
    print(f"📝 Agent Model: {settings.AGENT_MODEL}")
    
    # Initialize agent manager (singleton)
    agent_manager = get_agent_manager()
    print("✅ Agent Manager initialized")
    
    yield
    
    # Shutdown
    print("👋 Shutting down DRIFT API Server...")


# Create FastAPI app
app = FastAPI(
    title="DRIFT API",
    description="AI-powered Sprint Planning & Work Tracking API with Multi-Agent System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Vite dev server (Frontend)
        "http://localhost:3000",      # Production frontend
        "tauri://localhost",          # Tauri desktop app
        "https://drift.app",          # Production domain
        "https://*.drift.app",        # Subdomains
        "https://34.185.148.16",      # GCP Production
        "http://34.185.148.16",       # GCP Production (HTTP)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(auth.router, prefix="/api", tags=["Authentication"])
app.include_router(briefs.router, prefix="/api", tags=["Briefs"])
app.include_router(submissions.router, prefix="/api", tags=["Submissions"])
app.include_router(users.router, prefix="/api", tags=["Users"])


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "drift-api",
        "version": "1.0.0",
        "agents": {
            "brief_processing": "ready",
            "task_matching": "ready",
            "submission_analysis": "ready",
            "generative_ui": "ready"
        }
    }


# Root endpoint
@app.get("/")
async def root():
    """API information"""
    return {
        "name": "DRIFT API",
        "description": "Multi-Agent AI System for Sprint Planning & Work Tracking",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for unhandled errors.
    
    Returns standard error response format.
    """
    print(f"Unhandled exception: {exc}")
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": str(exc) if settings.AGENT_MODEL == "gpt-4o" else None  # Show details in dev
            }
        }
    )


# Run server
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,  # Auto-reload on code changes (dev only)
        log_level="info"
    )
