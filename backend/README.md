# DRIFT Backend

Multi-Agent LangChain System with FastAPI for AI-powered Sprint Planning & Work Tracking.

## Architecture

The backend uses a modular multi-agent architecture:

- **Brief Processing Agent**: Generates role-specific tasks from brief descriptions
- **Task Matching Agent**: Matches work submissions to tasks using semantic understanding
- **Submission Analysis Agent**: Analyzes work sessions and generates summaries
- **Generative UI Agent**: Creates role-based content structures for frontend rendering

## Tech Stack

- **FastAPI**: Async web framework
- **LangChain**: Multi-agent orchestration
- **OpenAI GPT-4**: LLM for agent intelligence
- **Clerk**: Authentication
- **Supabase**: PostgreSQL database
- **WebSockets**: Real-time updates

## Project Structure

```
backend/
├── agents/                    # LangChain agents
│   ├── base_agent.py         # Base agent class
│   ├── brief_agent.py        # Brief processing
│   ├── task_matching_agent.py # Task matching
│   ├── submission_agent.py   # Submission analysis
│   └── generative_ui_agent.py # UI content generation
├── routers/                   # FastAPI endpoints
│   ├── auth.py               # Authentication
│   ├── briefs.py             # Brief management
│   └── submissions.py        # Submission handling
├── services/                  # Core services
│   ├── agent_manager.py      # Agent orchestration
│   ├── clerk_auth.py         # Clerk integration
│   ├── supabase_client.py    # Database client
│   └── websocket_manager.py  # WebSocket manager
├── prompts/                   # Agent prompts
│   ├── brief_prompts.py
│   ├── task_matching_prompts.py
│   ├── submission_prompts.py
│   └── ui_generation_prompts.py
├── models/                    # Pydantic schemas
│   └── schemas.py
├── config/                    # Configuration
│   └── settings.py
├── main.py                    # FastAPI app
└── requirements.txt           # Dependencies
```

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```env
# Clerk
CLERK_SECRET_KEY=sk_live_xxxxx

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...

# OpenAI
OPENAI_API_KEY=sk-xxxxx

# Optional: Google Gemini
GOOGLE_API_KEY=AIzaSyxxxxx

# Agent Settings
AGENT_MODEL=gpt-4o
AGENT_TEMPERATURE=0.7
```

### 3. Setup Database

Run the Supabase schema from `../drift-web/supabase/schema.sql`

### 4. Run Server

**Development:**
```bash
python main.py
```

**Production:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### Authentication
- `POST /api/auth/session` - Validate Clerk token

### Briefs
- `POST /api/briefs` - Create brief (generates tasks with AI)
- `GET /api/briefs/{id}` - Get brief details
- `GET /api/briefs/{id}/tasks` - Get tasks
- `GET /api/briefs/{id}/view?role=pm|dev|designer` - Generate role-specific view
- `GET /api/briefs/{id}/submissions` - List submissions

### Submissions
- `POST /api/submissions` - Submit work (with multi-agent processing)
- `GET /api/submissions/{id}` - Get submission
- `PATCH /api/submissions/{id}` - Update status (approve/reject)

## Agent Workflows

### Brief Creation Flow

1. User creates brief with name + description
2. **Brief Agent** analyzes requirements
3. Generates 3-5 tasks per role (PM, Dev, Designer)
4. Tasks stored in database
5. Returns brief with generated tasks

### Submission Processing Flow

1. Desktop App sends work submission
2. **Submission Agent** analyzes activities → enhanced summary
3. **Task Matching Agent** matches to tasks → task IDs
4. Submission stored in database
5. WebSocket broadcast to team
6. Returns submission with matched tasks

### View Generation Flow

1. Frontend requests view for specific role
2. **Generative UI Agent** generates content structure
3. Returns JSON with components (Kanban, Architecture, User Flow, etc.)
4. Frontend renders components

## Agent Configuration

Agents can use different LLM models:

```python
# In agents/{agent_name}.py
class MyAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            model="gpt-4o",      # or "gpt-4o-mini", "gemini-pro"
            temperature=0.7       # 0.0 (deterministic) to 1.0 (creative)
        )
```

## Testing

**Interactive API Docs:**
Visit `http://localhost:8000/docs` for Swagger UI.

**Example: Create Brief**
```bash
curl -X POST http://localhost:8000/api/briefs \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Apple Pay Checkout",
    "description": "Implement Apple Pay as a checkout option for faster mobile payments"
  }'
```

**Example: Submit Work**
```bash
curl -X POST http://localhost:8000/api/submissions \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "briefId": "uuid",
    "userId": "user_xxx",
    "userName": "Max",
    "role": "dev",
    "summary": ["Implemented Stripe webhook"],
    "duration": 120,
    "activities": [...]
  }'
```

## Development

### Add New Agent

1. Create `agents/my_agent.py`:
```python
from agents.base_agent import BaseAgent

class MyAgent(BaseAgent):
    async def execute(self, **kwargs):
        # Agent logic
        pass
```

2. Register in `services/agent_manager.py`

3. Use in routers:
```python
my_agent = agent_manager.get_agent("my_agent")
result = await my_agent.execute(...)
```

### Modify Prompts

Edit files in `prompts/` directory. Prompts are separate from agent code for easy iteration.

### Monitor Costs

LangChain has built-in callbacks for tracking LLM usage. Add monitoring:

```python
from langchain.callbacks import get_openai_callback

with get_openai_callback() as cb:
    result = await agent.execute(...)
    print(f"Tokens used: {cb.total_tokens}")
    print(f"Cost: ${cb.total_cost}")
```

## Deployment

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Railway / Render

1. Connect GitHub repo
2. Set environment variables
3. Deploy command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## Troubleshooting

**Agent Errors:**
- Check `.env` has valid API keys
- Verify OpenAI API key has credits
- Check prompt templates in `prompts/`

**Database Errors:**
- Verify Supabase URL and key
- Check schema is applied
- Verify RLS policies allow access

**Auth Errors:**
- Verify Clerk secret key
- Check token format: `Bearer {token}`
- Ensure user exists in Clerk

## License

MIT
