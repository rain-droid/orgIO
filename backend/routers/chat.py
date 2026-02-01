"""
AI Chat/Copilot Router - Real-time AI assistance for the workspace.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Header
from typing import Dict, Any, Optional
import json
import asyncio

from services.clerk_auth import verify_clerk_token
from services.supabase_client import get_supabase
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from config.settings import settings

router = APIRouter()

# AI Copilot System Prompt
COPILOT_SYSTEM_PROMPT = """You are Drift AI, an intelligent workspace assistant for product teams.

You help with:
- Breaking down project ideas into actionable tasks
- Generating technical specifications
- Creating user stories and acceptance criteria
- Suggesting architecture decisions
- Writing code snippets and examples
- Designing user flows and UI components

Current context:
- User Role: {role}
- Project: {project_name}
- Project Description: {project_description}

Be concise, helpful, and proactive. Use markdown formatting for code and lists.
When generating tasks, format them clearly with priorities.
When writing code, always include comments explaining the logic.

Respond in the same language the user writes in."""


class AICopilot:
    """AI Copilot for workspace assistance."""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.7,
            streaming=True,
            api_key=settings.openai_api_key
        )
        self.conversations: Dict[str, list] = {}  # user_id -> messages
    
    def get_conversation(self, user_id: str) -> list:
        """Get or create conversation history."""
        if user_id not in self.conversations:
            self.conversations[user_id] = []
        return self.conversations[user_id]
    
    def add_message(self, user_id: str, role: str, content: str):
        """Add message to conversation."""
        conv = self.get_conversation(user_id)
        conv.append({"role": role, "content": content})
        # Keep last 20 messages for context
        if len(conv) > 20:
            self.conversations[user_id] = conv[-20:]
    
    def clear_conversation(self, user_id: str):
        """Clear conversation history."""
        self.conversations[user_id] = []
    
    async def stream_response(
        self,
        user_id: str,
        message: str,
        context: Dict[str, Any]
    ):
        """Stream AI response."""
        # Build system message with context
        system_prompt = COPILOT_SYSTEM_PROMPT.format(
            role=context.get("role", "dev"),
            project_name=context.get("project_name", "No project selected"),
            project_description=context.get("project_description", "")
        )
        
        # Build messages
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(self.get_conversation(user_id))
        messages.append({"role": "user", "content": message})
        
        # Add user message to history
        self.add_message(user_id, "user", message)
        
        # Stream response
        full_response = ""
        async for chunk in self.llm.astream(messages):
            if chunk.content:
                full_response += chunk.content
                yield chunk.content
        
        # Add assistant response to history
        self.add_message(user_id, "assistant", full_response)


# Global copilot instance
copilot = AICopilot()


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket endpoint for AI chat.
    
    Message format:
    {
        "type": "message" | "clear" | "context",
        "content": "user message",
        "token": "clerk_jwt_token",
        "context": {"role": "dev", "project_name": "...", "project_description": "..."}
    }
    """
    await websocket.accept()
    user_id: Optional[str] = None
    context: Dict[str, Any] = {}
    
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "message")
            
            # Authenticate on first message or when token provided
            if "token" in data:
                try:
                    token = data["token"].replace("Bearer ", "")
                    user_info = await verify_clerk_token(token)
                    user_id = user_info["userId"]
                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "content": "Authentication failed"
                    })
                    continue
            
            if not user_id:
                await websocket.send_json({
                    "type": "error",
                    "content": "Please authenticate first"
                })
                continue
            
            # Update context if provided
            if "context" in data:
                context.update(data["context"])
            
            # Handle message types
            if msg_type == "clear":
                copilot.clear_conversation(user_id)
                await websocket.send_json({
                    "type": "cleared",
                    "content": "Conversation cleared"
                })
            
            elif msg_type == "context":
                await websocket.send_json({
                    "type": "context_updated",
                    "content": "Context updated"
                })
            
            elif msg_type == "message":
                content = data.get("content", "")
                if not content:
                    continue
                
                # Send start marker
                await websocket.send_json({
                    "type": "start",
                    "content": ""
                })
                
                # Stream response
                try:
                    async for chunk in copilot.stream_response(user_id, content, context):
                        await websocket.send_json({
                            "type": "chunk",
                            "content": chunk
                        })
                except Exception as e:
                    await websocket.send_json({
                        "type": "error",
                        "content": f"AI error: {str(e)}"
                    })
                    continue
                
                # Send end marker
                await websocket.send_json({
                    "type": "end",
                    "content": ""
                })
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")


@router.post("/chat")
async def chat_message(
    request: Dict[str, Any],
    authorization: str = Header(...)
):
    """
    Non-streaming chat endpoint for simple requests.
    
    Body:
    {
        "message": "user message",
        "context": {"role": "dev", "project_name": "...", ...}
    }
    """
    # Authenticate
    token = authorization.replace("Bearer ", "")
    user_info = await verify_clerk_token(token)
    user_id = user_info["userId"]
    
    message = request.get("message", "")
    context = request.get("context", {})
    
    if not message:
        raise HTTPException(status_code=400, detail="Message required")
    
    # Get full response
    full_response = ""
    async for chunk in copilot.stream_response(user_id, message, context):
        full_response += chunk
    
    return {
        "response": full_response,
        "userId": user_id
    }


@router.post("/chat/clear")
async def clear_chat(authorization: str = Header(...)):
    """Clear conversation history."""
    token = authorization.replace("Bearer ", "")
    user_info = await verify_clerk_token(token)
    user_id = user_info["userId"]
    
    copilot.clear_conversation(user_id)
    
    return {"status": "cleared"}


@router.post("/generate/tasks")
async def generate_tasks(
    request: Dict[str, Any],
    authorization: str = Header(...)
):
    """
    Generate tasks from a project description.
    
    Body:
    {
        "name": "Project name",
        "description": "Project description",
        "role": "pm" | "dev" | "designer"
    }
    """
    token = authorization.replace("Bearer ", "")
    await verify_clerk_token(token)
    
    name = request.get("name", "")
    description = request.get("description", "")
    role = request.get("role", "dev")
    
    prompt = f"""Generate a structured task breakdown for this project:

Project: {name}
Description: {description}
Role Focus: {role.upper()}

Return a JSON object with this structure:
{{
    "tasks": [
        {{
            "title": "Task title",
            "description": "Detailed description",
            "priority": "high" | "medium" | "low",
            "estimated_hours": number,
            "role": "{role}"
        }}
    ],
    "milestones": [
        {{
            "name": "Milestone name",
            "tasks": ["task titles included"],
            "estimated_days": number
        }}
    ],
    "summary": "Brief project summary"
}}

Generate 5-10 actionable tasks appropriate for a {role}."""

    llm = ChatOpenAI(model="gpt-4o", temperature=0.7, api_key=settings.openai_api_key)
    response = await llm.ainvoke([{"role": "user", "content": prompt}])
    
    # Parse JSON
    content = response.content
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
    
    try:
        result = json.loads(content)
    except:
        result = {"tasks": [], "milestones": [], "summary": content}
    
    return result


@router.post("/generate/spec")
async def generate_spec(
    request: Dict[str, Any],
    authorization: str = Header(...)
):
    """
    Generate a full specification for a project.
    
    Body:
    {
        "name": "Project name",
        "description": "Project description",
        "role": "pm" | "dev" | "designer"
    }
    """
    token = authorization.replace("Bearer ", "")
    await verify_clerk_token(token)
    
    name = request.get("name", "")
    description = request.get("description", "")
    role = request.get("role", "dev")
    
    prompts = {
        "pm": f"""Create a comprehensive Product Specification for:

Project: {name}
Description: {description}

Include:
1. Executive Summary
2. User Stories (with acceptance criteria)
3. Feature List with priorities
4. Timeline with milestones
5. Success Metrics (KPIs)
6. Risk Assessment

Format as structured markdown.""",

        "dev": f"""Create a comprehensive Technical Specification for:

Project: {name}
Description: {description}

Include:
1. Technical Overview
2. Architecture Diagram (describe components)
3. API Endpoints (with request/response examples)
4. Database Schema
5. Technology Stack Recommendations
6. Security Considerations
7. Code Examples (key components)

Format as structured markdown with code blocks.""",

        "designer": f"""Create a comprehensive Design Specification for:

Project: {name}
Description: {description}

Include:
1. Design Overview
2. User Flow (step by step)
3. Component Library (list key components)
4. Color Palette & Typography
5. Responsive Breakpoints
6. Accessibility Considerations
7. Interaction Patterns

Format as structured markdown."""
    }
    
    prompt = prompts.get(role, prompts["dev"])
    
    llm = ChatOpenAI(model="gpt-4o", temperature=0.7, api_key=settings.openai_api_key)
    response = await llm.ainvoke([{"role": "user", "content": prompt}])
    
    return {
        "role": role,
        "spec": response.content,
        "project_name": name
    }
