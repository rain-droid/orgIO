# Drift Backend

FastAPI backend with AI agents for brief generation and submission analysis.

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Fill in your API keys

# Run
uvicorn app.main:app --reload
```

## Environment Variables

```env
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
CLERK_ISSUER=https://your-clerk.clerk.accounts.dev
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
ENV=development
```

## API Endpoints

### `POST /api/brief/generate`
Generate role-specific content for a brief.

```json
{
  "name": "Apple Pay Checkout",
  "description": "Payment integration",
  "role": "pm" | "dev" | "designer"
}
```

### `POST /api/submission/analyze`
Analyze a work submission and match to tasks.

```json
{
  "brief_id": "uuid",
  "summary": "Implemented Stripe webhooks",
  "duration_minutes": 120
}
```

### `POST /api/desktop/session`
Process desktop recording session.

## Agents

### BriefAgent
Uses LangChain with OpenAI (primary) and Gemini (fallback):
- `generate_brief_content()` - Generate PM/Dev/Designer views
- `analyze_submission()` - Match work to tasks
- `process_session()` - Summarize desktop session
