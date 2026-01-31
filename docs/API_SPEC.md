# DRIFT - API Interface Specification

**Version:** 1.0  
**Last Updated:** 2026-01-31

---

## Overview

This document defines the API contract between:
- **Desktop App** (Windows/Mac/Linux - Tauri): Records sessions, generates summaries
- **Frontend** (React/TypeScript): Web interface for briefs and submissions
- **Backend API** (Python/FastAPI + LangChain): Processes submissions, matches tasks with AI

Both teams can work in parallel using this specification.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Base URLs](#base-urls)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [WebSocket Events](#websocket-events)
6. [Error Handling](#error-handling)
7. [Examples](#examples)
8. [Python Backend Implementation](#python-backend-implementation)

---

## Authentication

### Clerk Token Flow

All API requests require a Clerk JWT token in the Authorization header:

```
Authorization: Bearer {clerkToken}
```

### Desktop App Authentication

1. Desktop App opens embedded webview with Clerk login
2. User logs in → Clerk issues JWT token
3. Desktop App stores token securely (OS keychain)
4. Desktop App includes token in all API requests

### Token Validation (Backend)

```typescript
// Backend validates token with Clerk
import { verifyToken } from '@clerk/backend';

const token = req.headers.authorization?.replace('Bearer ', '');
const { userId, orgId } = await verifyToken(token);
```

---

## Base URLs

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:3000/api` |
| Production  | `https://api.drift.app/api` |

**WebSocket URL:**
- Development: `ws://localhost:3000/ws`
- Production: `wss://api.drift.app/ws`

---

## Data Models

### Core Types

```typescript
// ============================================
// SUBMISSION (Desktop → Backend)
// ============================================

interface SubmissionPayload {
  briefId: string;              // UUID of the brief
  userId: string;               // Clerk user ID
  userName: string;             // Display name
  role: 'pm' | 'dev' | 'designer';
  
  // AI-generated summary (edited by user)
  summary: string[];            // ["Bullet 1", "Bullet 2", ...]
  
  // Session duration in minutes
  duration: number;
  
  // Activity breakdown
  activities: Activity[];
  
  // Optional: OCR snippets for AI matching
  snippets?: Snippet[];
}

interface Activity {
  app: string;                  // "Cursor", "Chrome", "Figma"
  title: string;                // Window title
  summary: string;              // AI summary of this activity
  duration: number;             // Minutes spent in this activity
  timestamp: number;            // Unix timestamp (ms)
}

interface Snippet {
  text: string;                 // OCR text (max 500 chars)
  context: 'code' | 'terminal' | 'browser';
}

// ============================================
// SUBMISSION RESPONSE (Backend → Desktop/Web)
// ============================================

interface SubmissionResponse {
  id: string;                   // UUID
  briefId: string;
  userId: string;
  userName: string;
  role: 'pm' | 'dev' | 'designer';
  summary: string[];
  duration: number;
  activities: Activity[];
  matchedTasks: string[];       // UUID[] - AI-matched task IDs
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;            // ISO 8601 timestamp
}

// ============================================
// BRIEF
// ============================================

interface Brief {
  id: string;                   // UUID
  orgId: string;                // Clerk org ID
  name: string;
  description: string;
  status: 'planning' | 'active' | 'completed';
  createdBy: string;            // User ID
  createdAt: string;
}

// ============================================
// TASK
// ============================================

interface Task {
  id: string;                   // UUID
  briefId: string;
  role: 'pm' | 'dev' | 'designer';
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  createdAt: string;
}

// ============================================
// ERROR RESPONSE
// ============================================

interface ErrorResponse {
  error: {
    code: string;               // "UNAUTHORIZED", "VALIDATION_ERROR", etc.
    message: string;            // Human-readable error
    details?: any;              // Additional context
  };
}
```

---

## API Endpoints

### 1. Submit Work Session

**`POST /api/submissions`**

Submit completed work session from Desktop App.

**Request:**

```typescript
POST /api/submissions
Authorization: Bearer {clerkToken}
Content-Type: application/json

{
  "briefId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_2abc123xyz",
  "userName": "Max Mustermann",
  "role": "dev",
  "summary": [
    "Implemented Stripe webhook handler for Apple Pay",
    "Added error handling for failed payment scenarios",
    "Wrote unit tests for payment flow"
  ],
  "duration": 154,
  "activities": [
    {
      "app": "Cursor",
      "title": "stripe-webhook.ts",
      "summary": "Implemented webhook handler",
      "duration": 67,
      "timestamp": 1706745600000
    },
    {
      "app": "Chrome",
      "title": "Stripe API Documentation",
      "summary": "Researched payment intents",
      "duration": 18,
      "timestamp": 1706749200000
    },
    {
      "app": "Terminal",
      "title": "~/project",
      "summary": "Ran tests",
      "duration": 12,
      "timestamp": 1706752800000
    }
  ],
  "snippets": [
    {
      "text": "export async function handleStripeWebhook(req: Request) {\n  const signature = req.headers['stripe-signature'];\n  const event = stripe.webhooks.constructEvent(...);\n}",
      "context": "code"
    }
  ]
}
```

**Response:** `201 Created`

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "briefId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_2abc123xyz",
  "userName": "Max Mustermann",
  "role": "dev",
  "summary": [
    "Implemented Stripe webhook handler for Apple Pay",
    "Added error handling for failed payment scenarios",
    "Wrote unit tests for payment flow"
  ],
  "duration": 154,
  "activities": [...],
  "matchedTasks": [
    "770e8400-e29b-41d4-a716-446655440002",
    "770e8400-e29b-41d4-a716-446655440003"
  ],
  "status": "pending",
  "createdAt": "2026-01-31T14:30:00.000Z"
}
```

**Errors:**
- `400` - Invalid payload (missing required fields)
- `401` - Unauthorized (invalid/missing token)
- `404` - Brief not found
- `413` - Payload too large (max 5MB)

---

### 2. Get Submission Details

**`GET /api/submissions/:id`**

Get details of a specific submission.

**Request:**

```typescript
GET /api/submissions/660e8400-e29b-41d4-a716-446655440001
Authorization: Bearer {clerkToken}
```

**Response:** `200 OK`

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "briefId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_2abc123xyz",
  "userName": "Max Mustermann",
  "role": "dev",
  "summary": [...],
  "duration": 154,
  "activities": [...],
  "matchedTasks": [...],
  "status": "pending",
  "createdAt": "2026-01-31T14:30:00.000Z"
}
```

**Errors:**
- `401` - Unauthorized
- `404` - Submission not found

---

### 3. List Submissions for Brief

**`GET /api/briefs/:briefId/submissions`**

Get all submissions for a specific brief.

**Request:**

```typescript
GET /api/briefs/550e8400-e29b-41d4-a716-446655440000/submissions?status=pending
Authorization: Bearer {clerkToken}
```

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `approved`, `rejected`)
- `userId` (optional): Filter by user
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset

**Response:** `200 OK`

```json
{
  "submissions": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "briefId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "user_2abc123xyz",
      "userName": "Max Mustermann",
      "role": "dev",
      "summary": [...],
      "duration": 154,
      "activities": [...],
      "matchedTasks": [...],
      "status": "pending",
      "createdAt": "2026-01-31T14:30:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

### 4. Update Submission Status

**`PATCH /api/submissions/:id`**

Approve or reject a submission (Web App only).

**Request:**

```typescript
PATCH /api/submissions/660e8400-e29b-41d4-a716-446655440001
Authorization: Bearer {clerkToken}
Content-Type: application/json

{
  "status": "approved",
  "matchedTasks": [
    "770e8400-e29b-41d4-a716-446655440002",
    "770e8400-e29b-41d4-a716-446655440003"
  ]
}
```

**Response:** `200 OK`

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "status": "approved",
  "updatedAt": "2026-01-31T15:00:00.000Z"
}
```

**Side Effects:**
- If `status: "approved"`: All `matchedTasks` are updated to `status: "done"`
- Realtime event `tasks:updated` is broadcast

**Errors:**
- `401` - Unauthorized
- `403` - Forbidden (user not PM or brief owner)
- `404` - Submission not found

---

### 5. Get Brief Details

**`GET /api/briefs/:id`**

Get brief details with tasks.

**Request:**

```typescript
GET /api/briefs/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {clerkToken}
```

**Response:** `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "orgId": "org_2xyz789abc",
  "name": "Apple Pay Checkout",
  "description": "Implement Apple Pay as a checkout option...",
  "status": "active",
  "createdBy": "user_2sarah123",
  "createdAt": "2026-01-28T10:00:00.000Z",
  "tasks": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "briefId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "dev",
      "title": "Stripe webhook setup",
      "description": "Implement webhook handler for Apple Pay events",
      "status": "done",
      "createdAt": "2026-01-28T10:05:00.000Z"
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440003",
      "briefId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "dev",
      "title": "Error handling",
      "description": "Add error handling for failed payments",
      "status": "in_progress",
      "createdAt": "2026-01-28T10:05:00.000Z"
    }
  ]
}
```

---

### 6. Get Tasks for Brief

**`GET /api/briefs/:briefId/tasks`**

Get all tasks for a brief (optionally filtered by role).

**Request:**

```typescript
GET /api/briefs/550e8400-e29b-41d4-a716-446655440000/tasks?role=dev
Authorization: Bearer {clerkToken}
```

**Query Parameters:**
- `role` (optional): Filter by role (`pm`, `dev`, `designer`)
- `status` (optional): Filter by status (`todo`, `in_progress`, `done`)

**Response:** `200 OK`

```json
{
  "tasks": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "briefId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "dev",
      "title": "Stripe webhook setup",
      "description": "Implement webhook handler",
      "status": "done",
      "createdAt": "2026-01-28T10:05:00.000Z"
    }
  ],
  "total": 1
}
```

---

### 7. Validate Desktop Session

**`POST /api/auth/session`**

Validate Clerk token and return user info (Desktop App startup).

**Request:**

```typescript
POST /api/auth/session
Authorization: Bearer {clerkToken}
```

**Response:** `200 OK`

```json
{
  "userId": "user_2abc123xyz",
  "orgId": "org_2xyz789abc",
  "email": "max@example.com",
  "name": "Max Mustermann",
  "role": "dev",
  "avatarUrl": "https://..."
}
```

**Errors:**
- `401` - Invalid token

---

## WebSocket Events

### Connection

**URL:** `wss://api.drift.app/ws`

**Authentication:**

```typescript
const ws = new WebSocket('wss://api.drift.app/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: clerkToken
  }));
};
```

### Events (Server → Client)

#### `submission:new`

Broadcast when new submission is created.

```json
{
  "type": "submission:new",
  "payload": {
    "submissionId": "660e8400-e29b-41d4-a716-446655440001",
    "briefId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user_2abc123xyz",
    "userName": "Max Mustermann"
  }
}
```

#### `submission:updated`

Broadcast when submission status changes.

```json
{
  "type": "submission:updated",
  "payload": {
    "submissionId": "660e8400-e29b-41d4-a716-446655440001",
    "status": "approved"
  }
}
```

#### `tasks:updated`

Broadcast when tasks are completed/updated.

```json
{
  "type": "tasks:updated",
  "payload": {
    "briefId": "550e8400-e29b-41d4-a716-446655440000",
    "taskIds": [
      "770e8400-e29b-41d4-a716-446655440002",
      "770e8400-e29b-41d4-a716-446655440003"
    ]
  }
}
```

### Events (Client → Server)

#### `recording:status`

Desktop App reports recording status.

```json
{
  "type": "recording:status",
  "payload": {
    "briefId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "recording" | "stopped",
    "duration": 3600000
  }
}
```

---

## Error Handling

### Standard Error Response

```typescript
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}  // Optional additional context
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | User doesn't have permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request payload |
| `PAYLOAD_TOO_LARGE` | 413 | Payload exceeds 5MB limit |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Example Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid submission payload",
    "details": {
      "field": "briefId",
      "issue": "Must be a valid UUID"
    }
  }
}
```

---

## Examples

### Desktop App: Complete Submit Flow

```typescript
// 1. User ends session in Desktop App
async function submitSession(session: Session) {
  try {
    // Get stored Clerk token
    const token = await getStoredToken();
    
    // Prepare payload
    const payload: SubmissionPayload = {
      briefId: session.briefId,
      userId: session.userId,
      userName: session.userName,
      role: session.userRole,
      summary: session.summary,  // Already edited by user
      duration: Math.round(session.duration / 60000),
      activities: session.activities.map(act => ({
        app: act.app,
        title: act.title,
        summary: act.summary,
        duration: act.duration,
        timestamp: act.timestamp
      })),
      snippets: extractTopSnippets(session.activities)
    };
    
    // Submit to API
    const response = await fetch('https://api.drift.app/api/submissions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }
    
    const result: SubmissionResponse = await response.json();
    
    // Success
    console.log('Submission created:', result.id);
    console.log('Matched tasks:', result.matchedTasks);
    
    // Cleanup local data
    await cleanupSession(session.id);
    
    return result;
    
  } catch (error) {
    console.error('Submit failed:', error);
    // Show error to user
    showErrorNotification(error.message);
    throw error;
  }
}
```

### Backend: Handle Submission

```typescript
// API Route: POST /api/submissions
export async function POST(req: Request) {
  try {
    // 1. Verify Clerk token
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Missing auth token' } },
        { status: 401 }
      );
    }
    
    const { userId, orgId } = await verifyToken(token);
    
    // 2. Parse and validate payload
    const payload: SubmissionPayload = await req.json();
    
    if (!payload.briefId || !payload.summary || !payload.activities) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' } },
        { status: 400 }
      );
    }
    
    // 3. Verify brief exists and user has access
    const { data: brief } = await supabase
      .from('briefs')
      .select('*')
      .eq('id', payload.briefId)
      .eq('org_id', orgId)
      .single();
    
    if (!brief) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Brief not found' } },
        { status: 404 }
      );
    }
    
    // 4. Get tasks for AI matching
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('brief_id', payload.briefId);
    
    // 5. AI Task Matching
    const matchedTaskIds = await matchTasksWithAI(
      tasks,
      payload.summary,
      payload.activities,
      payload.snippets
    );
    
    // 6. Insert submission
    const { data: submission, error } = await supabase
      .from('submissions')
      .insert({
        brief_id: payload.briefId,
        user_id: userId,
        user_name: payload.userName,
        role: payload.role,
        summary_lines: payload.summary,
        duration_minutes: payload.duration,
        matched_tasks: matchedTaskIds,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // 7. Store activities (optional separate table)
    if (payload.activities?.length > 0) {
      await supabase.from('submission_activities').insert(
        payload.activities.map(act => ({
          submission_id: submission.id,
          ...act
        }))
      );
    }
    
    // 8. Broadcast WebSocket event
    await broadcastWebSocket({
      type: 'submission:new',
      payload: {
        submissionId: submission.id,
        briefId: payload.briefId,
        userId,
        userName: payload.userName
      }
    });
    
    // 9. Return response
    const response: SubmissionResponse = {
      id: submission.id,
      briefId: submission.brief_id,
      userId: submission.user_id,
      userName: submission.user_name,
      role: submission.role,
      summary: submission.summary_lines,
      duration: submission.duration_minutes,
      activities: payload.activities,
      matchedTasks: submission.matched_tasks,
      status: submission.status,
      createdAt: submission.created_at
    };
    
    return Response.json(response, { status: 201 });
    
  } catch (error) {
    console.error('Submission error:', error);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Server error' } },
      { status: 500 }
    );
  }
}

// AI Task Matching Helper
async function matchTasksWithAI(
  tasks: Task[],
  summary: string[],
  activities: Activity[],
  snippets?: Snippet[]
): Promise<string[]> {
  const prompt = `
Match this work submission to relevant tasks.

Tasks:
${tasks.map(t => `- [${t.id}] ${t.title}: ${t.description}`).join('\n')}

Work Done:
${summary.map(s => `• ${s}`).join('\n')}

Activities:
${activities.map(a => `- ${a.app}: ${a.summary} (${a.duration}m)`).join('\n')}

${snippets ? `\nCode/Text Snippets:\n${snippets.map(s => s.text.slice(0, 200)).join('\n\n')}` : ''}

Return ONLY task IDs that were clearly worked on.
Format: JSON array ["id1", "id2"]
Be conservative - only match if confident.
  `.trim();
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  });
  
  const result = JSON.parse(response.choices[0].message.content);
  return result.taskIds || [];
}
```

---

## Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| `POST /api/submissions` | 10 requests / hour / user |
| `GET /api/*` | 100 requests / minute / user |
| `PATCH /api/submissions/:id` | 30 requests / minute / user |

---

## Payload Size Limits

- **Max request size:** 5MB
- **Max summary lines:** 20
- **Max activities:** 1000
- **Max snippets:** 5
- **Max snippet text:** 500 characters each

---

## Notes for Developers

### Desktop Dev

- Store Clerk token securely (OS keychain)
- Handle network errors gracefully (retry with exponential backoff)
- Show progress during upload (activities can be large)
- Cache brief/task data locally to reduce API calls
- Implement offline queue for submissions (retry when online)

### Backend Dev

- Validate all inputs (use Zod or similar)
- Implement request logging for debugging
- Rate limit per user to prevent abuse
- Use database transactions for submission + task updates
- Optimize AI matching (cache task embeddings)
- Monitor OpenAI API usage/costs

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-31 | Initial API specification |

---

**Questions?** Contact the team or check `/docs/DRIFT_DEV.md` for implementation details.

---

## Python Backend Implementation

### Overview

This section provides complete Python/FastAPI backend implementation with LangChain integration. The Python backend implements all endpoints defined above while maintaining compatibility with TypeScript frontend and Tauri desktop app.

**Stack:**
- Python 3.11+
- FastAPI (async web framework)
- LangChain (AI/agent orchestration)
- Clerk (authentication)
- Supabase (database)
- Pydantic (data validation)

---

### Project Structure

```
backend/
├── main.py                    # FastAPI app entry point
├── requirements.txt           # Python dependencies
├── .env                       # Environment variables
├── routers/
│   ├── __init__.py
│   ├── submissions.py         # Submission endpoints
│   ├── briefs.py             # Brief endpoints
│   └── auth.py               # Auth endpoints
├── models/
│   ├── __init__.py
│   └── schemas.py            # Pydantic models
├── services/
│   ├── __init__.py
│   ├── clerk_auth.py         # Clerk authentication
│   ├── ai_matching.py        # LangChain AI task matching
│   └── supabase_client.py    # Supabase client
└── middleware/
    ├── __init__.py
    └── auth.py               # Auth middleware
```

---

### Requirements

**`requirements.txt`:**

```txt
# Web Framework
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# Data Validation
pydantic==2.5.3
pydantic-settings==2.1.0

# Authentication
clerk-backend-api==0.2.0
python-jose[cryptography]==3.3.0

# Database
supabase==2.3.4

# AI / LangChain
langchain==0.1.4
langchain-openai==0.0.5
langchain-google-genai==0.0.6
openai==1.10.0

# WebSockets
websockets==12.0

# Utilities
python-dotenv==1.0.0
httpx==0.26.0
```

---

### Environment Variables

**`.env`:**

```bash
# Clerk
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxx

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...

# OpenAI (for LangChain)
OPENAI_API_KEY=sk-xxxxx

# Optional: Gemini (for LangChain)
GOOGLE_API_KEY=AIzaSyxxxxx

# Server
HOST=0.0.0.0
PORT=8000
```

---

### Pydantic Models

**`models/schemas.py`:**

```python
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal
from datetime import datetime
import uuid

# ============================================
# ACTIVITY
# ============================================

class Activity(BaseModel):
    app: str = Field(..., description="Application name")
    title: str = Field(..., description="Window title")
    summary: str = Field(..., description="AI-generated activity summary")
    duration: int = Field(..., ge=0, description="Duration in minutes")
    timestamp: int = Field(..., description="Unix timestamp in milliseconds")

# ============================================
# SNIPPET
# ============================================

class Snippet(BaseModel):
    text: str = Field(..., max_length=500, description="OCR text snippet")
    context: Literal["code", "terminal", "browser"]

# ============================================
# SUBMISSION PAYLOAD (Desktop → Backend)
# ============================================

class SubmissionPayload(BaseModel):
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
        json_schema_extra = {
            "example": {
                "briefId": "550e8400-e29b-41d4-a716-446655440000",
                "userId": "user_2abc123xyz",
                "userName": "Max Mustermann",
                "role": "dev",
                "summary": [
                    "Implemented Stripe webhook handler",
                    "Added error handling"
                ],
                "duration": 154,
                "activities": [
                    {
                        "app": "Cursor",
                        "title": "stripe-webhook.ts",
                        "summary": "Implemented webhook",
                        "duration": 67,
                        "timestamp": 1706745600000
                    }
                ],
                "snippets": []
            }
        }

# ============================================
# SUBMISSION RESPONSE (Backend → Desktop/Web)
# ============================================

class SubmissionResponse(BaseModel):
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
# ERROR RESPONSE
# ============================================

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None

class ErrorResponse(BaseModel):
    error: ErrorDetail
```

---

### Clerk Authentication

**`services/clerk_auth.py`:**

```python
from clerk_backend_api import Clerk
from fastapi import HTTPException, status
import os

clerk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))

async def verify_clerk_token(token: str) -> dict:
    """
    Verify Clerk JWT token and return user info.
    
    Args:
        token: JWT token from Authorization header
        
    Returns:
        dict with userId, orgId, email, etc.
        
    Raises:
        HTTPException: If token is invalid
    """
    try:
        # Verify the token
        session = clerk.sessions.verify_token(token)
        
        # Get user info
        user = clerk.users.get(session.user_id)
        
        # Get organization (if user is in one)
        org_id = None
        if user.organization_memberships:
            org_id = user.organization_memberships[0].organization.id
        
        return {
            "userId": user.id,
            "orgId": org_id,
            "email": user.email_addresses[0].email_address if user.email_addresses else None,
            "name": user.first_name + " " + user.last_name if user.first_name else None,
            "avatarUrl": user.image_url
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid or expired token"}
        )

async def get_current_user(token: str) -> dict:
    """
    Dependency for FastAPI routes to get current authenticated user.
    """
    if not token or not token.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing authorization header"}
        )
    
    token = token.replace("Bearer ", "")
    return await verify_clerk_token(token)
```

---

### Supabase Client

**`services/supabase_client.py`:**

```python
from supabase import create_client, Client
import os

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

def get_supabase() -> Client:
    """Dependency to get Supabase client"""
    return supabase
```

---

### LangChain AI Task Matching

**`services/ai_matching.py`:**

```python
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from typing import List
import json

# Output schema for task matching
class TaskMatchOutput(BaseModel):
    taskIds: List[str] = Field(description="List of task IDs that were worked on")
    confidence: str = Field(description="Confidence level: high, medium, low")

# Initialize LLM
llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.3,  # Lower for more consistent matching
)

# Create output parser
parser = PydanticOutputParser(pydantic_object=TaskMatchOutput)

# Prompt template
MATCHING_PROMPT = PromptTemplate(
    input_variables=["tasks", "summary", "activities", "snippets"],
    template="""You are an AI assistant that matches work submissions to tasks.

Tasks available:
{tasks}

Work completed (user summary):
{summary}

Activities breakdown:
{activities}

{snippets}

Your job: Match the work done to the task IDs above.
- Only return task IDs that were CLEARLY worked on
- Be conservative - only match if you're confident
- Consider both the summary and activities

{format_instructions}
""",
    partial_variables={"format_instructions": parser.get_format_instructions()}
)

# Create chain
matching_chain = LLMChain(llm=llm, prompt=MATCHING_PROMPT)

async def match_tasks_with_langchain(
    tasks: List[dict],
    summary: List[str],
    activities: List[dict],
    snippets: List[dict] = None
) -> List[str]:
    """
    Use LangChain to match work submission to tasks.
    
    Args:
        tasks: List of task dicts with id, title, description
        summary: List of summary bullet points
        activities: List of activity dicts
        snippets: Optional list of code/terminal snippets
        
    Returns:
        List of matched task IDs
    """
    # Format tasks
    tasks_str = "\n".join([
        f"- [{t['id']}] {t['title']}: {t.get('description', '')}"
        for t in tasks
    ])
    
    # Format summary
    summary_str = "\n".join([f"• {s}" for s in summary])
    
    # Format activities
    activities_str = "\n".join([
        f"- {a['app']}: {a['summary']} ({a['duration']}m)"
        for a in activities
    ])
    
    # Format snippets (if provided)
    snippets_str = ""
    if snippets:
        snippets_str = "\nCode/Terminal snippets:\n" + "\n\n".join([
            f"[{s['context']}]\n{s['text'][:200]}"
            for s in snippets
        ])
    
    try:
        # Run the chain
        result = await matching_chain.arun(
            tasks=tasks_str,
            summary=summary_str,
            activities=activities_str,
            snippets=snippets_str
        )
        
        # Parse output
        parsed = parser.parse(result)
        
        # Validate task IDs exist
        valid_task_ids = {t['id'] for t in tasks}
        matched_ids = [tid for tid in parsed.taskIds if tid in valid_task_ids]
        
        return matched_ids
        
    except Exception as e:
        print(f"LangChain matching error: {e}")
        # Fallback: return empty list if AI fails
        return []
```

---

### FastAPI Main App

**`main.py`:**

```python
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import uvicorn

from routers import submissions, briefs, auth

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="DRIFT API",
    description="AI-powered Sprint Planning & Work Tracking API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware (allow Frontend + Desktop App)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Production frontend
        "tauri://localhost",      # Tauri desktop app
        "https://drift.app"       # Production domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(submissions.router, prefix="/api", tags=["submissions"])
app.include_router(briefs.router, prefix="/api", tags=["briefs"])
app.include_router(auth.router, prefix="/api", tags=["auth"])

# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "drift-api"}

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": str(exc)
            }
        }
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Hot reload in development
        log_level="info"
    )
```

---

### Submissions Router

**`routers/submissions.py`:**

```python
from fastapi import APIRouter, Depends, HTTPException, Header, status
from typing import Optional
from datetime import datetime

from models.schemas import (
    SubmissionPayload,
    SubmissionResponse,
    ErrorResponse
)
from services.clerk_auth import get_current_user
from services.supabase_client import get_supabase
from services.ai_matching import match_tasks_with_langchain

router = APIRouter()

@router.post(
    "/submissions",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        413: {"model": ErrorResponse}
    }
)
async def create_submission(
    payload: SubmissionPayload,
    authorization: str = Header(...),
):
    """
    Submit completed work session from Desktop App.
    
    Workflow:
    1. Verify Clerk token
    2. Validate brief exists and user has access
    3. Get tasks for AI matching
    4. Use LangChain to match tasks
    5. Store submission in Supabase
    6. Broadcast WebSocket event
    """
    # 1. Verify authentication
    user = await get_current_user(authorization)
    
    supabase = get_supabase()
    
    # 2. Verify brief exists and user has access
    brief_response = supabase.table("briefs").select("*").eq("id", payload.briefId).eq("org_id", user["orgId"]).execute()
    
    if not brief_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Brief not found"}
        )
    
    # 3. Get tasks for AI matching
    tasks_response = supabase.table("tasks").select("*").eq("brief_id", payload.briefId).execute()
    tasks = tasks_response.data or []
    
    # 4. AI Task Matching with LangChain
    matched_task_ids = await match_tasks_with_langchain(
        tasks=tasks,
        summary=payload.summary,
        activities=[act.model_dump() for act in payload.activities],
        snippets=[snip.model_dump() for snip in payload.snippets] if payload.snippets else None
    )
    
    # 5. Insert submission
    submission_data = {
        "brief_id": payload.briefId,
        "user_id": user["userId"],
        "user_name": payload.userName,
        "role": payload.role,
        "summary_lines": payload.summary,
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
    
    # 6. Store activities (optional - separate table)
    if payload.activities:
        activities_data = [
            {
                "submission_id": submission["id"],
                **act.model_dump()
            }
            for act in payload.activities
        ]
        supabase.table("submission_activities").insert(activities_data).execute()
    
    # 7. TODO: Broadcast WebSocket event
    # await broadcast_websocket({
    #     "type": "submission:new",
    #     "payload": {
    #         "submissionId": submission["id"],
    #         "briefId": payload.briefId,
    #         "userId": user["userId"],
    #         "userName": payload.userName
    #     }
    # })
    
    # 8. Return response
    return SubmissionResponse(
        id=submission["id"],
        briefId=submission["brief_id"],
        userId=submission["user_id"],
        userName=submission["user_name"],
        role=submission["role"],
        summary=submission["summary_lines"],
        duration=submission["duration_minutes"],
        activities=payload.activities,
        matchedTasks=submission["matched_tasks"],
        status=submission["status"],
        createdAt=submission["created_at"]
    )

@router.get(
    "/submissions/{submission_id}",
    response_model=SubmissionResponse,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}}
)
async def get_submission(
    submission_id: str,
    authorization: str = Header(...),
):
    """Get details of a specific submission."""
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
    
    # Get activities
    activities_response = supabase.table("submission_activities").select("*").eq("submission_id", submission_id).execute()
    activities = activities_response.data or []
    
    return SubmissionResponse(
        id=submission["id"],
        briefId=submission["brief_id"],
        userId=submission["user_id"],
        userName=submission["user_name"],
        role=submission["role"],
        summary=submission["summary_lines"],
        duration=submission["duration_minutes"],
        activities=activities,
        matchedTasks=submission["matched_tasks"],
        status=submission["status"],
        createdAt=submission["created_at"]
    )

@router.patch(
    "/submissions/{submission_id}",
    responses={401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}}
)
async def update_submission_status(
    submission_id: str,
    status_update: dict,
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
    
    # Update submission status
    update_data = {"status": status_update["status"]}
    
    if "matchedTasks" in status_update:
        update_data["matched_tasks"] = status_update["matchedTasks"]
    
    response = supabase.table("submissions").update(update_data).eq("id", submission_id).execute()
    
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Submission not found"}
        )
    
    submission = response.data[0]
    
    # If approved, update tasks
    if status_update["status"] == "approved" and submission.get("matched_tasks"):
        for task_id in submission["matched_tasks"]:
            supabase.table("tasks").update({"status": "done"}).eq("id", task_id).execute()
        
        # TODO: Broadcast tasks:updated event
    
    return {
        "id": submission["id"],
        "status": submission["status"],
        "updatedAt": datetime.utcnow().isoformat()
    }
```

---

### Briefs Router

**`routers/briefs.py`:**

```python
from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from typing import Optional

from models.schemas import Brief, Task, ErrorResponse
from services.clerk_auth import get_current_user
from services.supabase_client import get_supabase

router = APIRouter()

@router.get(
    "/briefs/{brief_id}",
    response_model=Brief,
    responses={401: {"model": ErrorResponse}, 404: {"model": ErrorResponse}}
)
async def get_brief(
    brief_id: str,
    authorization: str = Header(...),
):
    """Get brief details with tasks."""
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    # Get brief
    brief_response = supabase.table("briefs").select("*").eq("id", brief_id).eq("org_id", user["orgId"]).execute()
    
    if not brief_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Brief not found"}
        )
    
    brief = brief_response.data[0]
    
    # Get tasks
    tasks_response = supabase.table("tasks").select("*").eq("brief_id", brief_id).execute()
    tasks = tasks_response.data or []
    
    return Brief(
        id=brief["id"],
        orgId=brief["org_id"],
        name=brief["name"],
        description=brief["description"],
        status=brief["status"],
        createdBy=brief["created_by"],
        createdAt=brief["created_at"],
        tasks=[Task(**{
            "id": t["id"],
            "briefId": t["brief_id"],
            "role": t["role"],
            "title": t["title"],
            "description": t["description"],
            "status": t["status"],
            "createdAt": t["created_at"]
        }) for t in tasks]
    )

@router.get(
    "/briefs/{brief_id}/tasks",
    responses={401: {"model": ErrorResponse}}
)
async def get_tasks(
    brief_id: str,
    authorization: str = Header(...),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    """Get all tasks for a brief."""
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    query = supabase.table("tasks").select("*").eq("brief_id", brief_id)
    
    if role:
        query = query.eq("role", role)
    if status:
        query = query.eq("status", status)
    
    response = query.execute()
    tasks = response.data or []
    
    return {
        "tasks": [Task(**{
            "id": t["id"],
            "briefId": t["brief_id"],
            "role": t["role"],
            "title": t["title"],
            "description": t["description"],
            "status": t["status"],
            "createdAt": t["created_at"]
        }) for t in tasks],
        "total": len(tasks)
    }

@router.get(
    "/briefs/{brief_id}/submissions",
    responses={401: {"model": ErrorResponse}}
)
async def get_submissions_for_brief(
    brief_id: str,
    authorization: str = Header(...),
    status: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List all submissions for a brief."""
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    query = supabase.table("submissions").select("*").eq("brief_id", brief_id)
    
    if status:
        query = query.eq("status", status)
    if user_id:
        query = query.eq("user_id", user_id)
    
    query = query.limit(limit).offset(offset).order("created_at", desc=True)
    
    response = query.execute()
    submissions = response.data or []
    
    return {
        "submissions": submissions,
        "total": len(submissions),
        "limit": limit,
        "offset": offset
    }
```

---

### Auth Router

**`routers/auth.py`:**

```python
from fastapi import APIRouter, Header, HTTPException, status

from services.clerk_auth import get_current_user
from services.supabase_client import get_supabase

router = APIRouter()

@router.post("/auth/session")
async def validate_session(
    authorization: str = Header(...),
):
    """
    Validate Clerk token and return user info.
    Used by Desktop App on startup.
    """
    user = await get_current_user(authorization)
    supabase = get_supabase()
    
    # Upsert user in our database
    user_data = {
        "id": user["userId"],
        "org_id": user["orgId"],
        "email": user["email"],
        "name": user["name"],
        "avatar_url": user["avatarUrl"]
    }
    
    # Get or create user
    existing = supabase.table("users").select("*").eq("id", user["userId"]).execute()
    
    if existing.data:
        # Update existing user
        supabase.table("users").update(user_data).eq("id", user["userId"]).execute()
        role = existing.data[0].get("role", "dev")
    else:
        # Create new user
        user_data["role"] = "dev"  # Default role
        supabase.table("users").insert(user_data).execute()
        role = "dev"
    
    return {
        "userId": user["userId"],
        "orgId": user["orgId"],
        "email": user["email"],
        "name": user["name"],
        "role": role,
        "avatarUrl": user["avatarUrl"]
    }
```

---

### Running the Backend

**Development:**

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your keys

# Run server with hot reload
python main.py

# Or use uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Production:**

```bash
# Using uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Using gunicorn (with uvicorn workers)
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

**Docker:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

### Testing the API

**Using curl:**

```bash
# Health check
curl http://localhost:8000/health

# Create submission (requires Clerk token)
curl -X POST http://localhost:8000/api/submissions \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "briefId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user_2abc123xyz",
    "userName": "Max Mustermann",
    "role": "dev",
    "summary": ["Implemented feature X"],
    "duration": 120,
    "activities": [
      {
        "app": "Cursor",
        "title": "main.py",
        "summary": "Wrote code",
        "duration": 120,
        "timestamp": 1706745600000
      }
    ]
  }'
```

**Interactive API Docs:**

Visit `http://localhost:8000/docs` for Swagger UI with interactive API testing.

---

### LangChain Advanced Features

**Using Different LLM Providers:**

```python
# OpenAI (default)
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="gpt-4o")

# Google Gemini
from langchain_google_genai import ChatGoogleGenerativeAI
llm = ChatGoogleGenerativeAI(model="gemini-pro")

# Anthropic Claude
from langchain_anthropic import ChatAnthropic
llm = ChatAnthropic(model="claude-3-sonnet-20240229")
```

**Adding Memory to Agent:**

```python
from langchain.memory import ConversationBufferMemory

memory = ConversationBufferMemory()

chain = LLMChain(
    llm=llm,
    prompt=MATCHING_PROMPT,
    memory=memory
)
```

**Using Agents for Complex Matching:**

```python
from langchain.agents import initialize_agent, AgentType, Tool

# Define tools for the agent
tools = [
    Tool(
        name="TaskSearch",
        func=search_tasks,
        description="Search for tasks by keywords"
    ),
    Tool(
        name="CodeAnalysis",
        func=analyze_code_snippet,
        description="Analyze code snippets to infer intent"
    )
]

agent = initialize_agent(
    tools=tools,
    llm=llm,
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True
)

result = agent.run(f"Match these activities to tasks: {activities}")
```

---

### Notes for Backend Developer

**Authentication:**
- Clerk handles all user auth (signup, login, session management)
- Backend only validates JWT tokens via `clerk-backend-api`
- Store minimal user info in Supabase (sync on login)

**LangChain Benefits:**
- Easy to swap LLM providers (OpenAI ↔ Gemini ↔ Claude)
- Built-in retry logic and error handling
- Can add memory, tools, and agents for complex workflows
- Output parsing with Pydantic ensures type safety

**Performance:**
- Use async/await throughout (FastAPI is async-native)
- Cache task embeddings for faster matching
- Consider batching LangChain calls if processing multiple submissions
- Use Supabase connection pooling

**Deployment:**
- Deploy on Railway, Render, or AWS Lambda (with Mangum adapter)
- Use environment variables for all secrets
- Enable CORS for frontend domains
- Monitor OpenAI API usage (LangChain has built-in callbacks)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-31 | Initial API specification |
| 1.1 | 2026-01-31 | Added Python/FastAPI backend implementation with LangChain |
