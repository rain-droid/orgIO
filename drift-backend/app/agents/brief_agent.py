import os
from typing import List, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
import json

# ============================================
# OUTPUT MODELS
# ============================================

class PMContent(BaseModel):
    """PM view content structure"""
    user_stories: List[dict] = Field(description="List of user stories with title and acceptance criteria")
    timeline: List[dict] = Field(description="Timeline phases with labels and progress")
    tasks: dict = Field(description="Kanban tasks grouped by status: todo, in_progress, done")

class DevContent(BaseModel):
    """Developer view content structure"""
    architecture: List[dict] = Field(description="Architecture components with labels")
    api_endpoints: List[dict] = Field(description="API endpoints with method, path, request, response")
    code_snippets: List[str] = Field(description="Relevant code snippets")
    tech_stack: List[str] = Field(description="Technologies to use")

class DesignerContent(BaseModel):
    """Designer view content structure"""
    user_flow: List[str] = Field(description="User flow steps")
    components: List[dict] = Field(description="Component specs with name, height, radius, color")
    states: List[str] = Field(description="Component states to design")

class SubmissionAnalysis(BaseModel):
    """Submission analysis result"""
    matched_tasks: List[str] = Field(description="Tasks that match the work done")
    suggestions: List[str] = Field(description="Suggestions for improvement")
    confidence: float = Field(description="Confidence score 0-1")

# ============================================
# PROMPTS
# ============================================

PM_PROMPT = """You are an expert Product Manager. Generate a comprehensive sprint plan for the following feature.

Feature: {name}
Description: {description}

Generate:
1. User Stories with acceptance criteria
2. Timeline phases (Backend, Frontend, Testing, Launch)
3. Kanban tasks (todo, in_progress, done)

{format_instructions}
"""

DEV_PROMPT = """You are a Senior Software Engineer. Generate technical specifications for the following feature.

Feature: {name}
Description: {description}

Generate:
1. Architecture diagram components (Client, API, Database, External Services)
2. API Endpoints with request/response schemas
3. Relevant code snippets
4. Tech stack recommendations

{format_instructions}
"""

DESIGNER_PROMPT = """You are a UX/UI Designer. Generate design specifications for the following feature.

Feature: {name}
Description: {description}

Generate:
1. User flow steps
2. Component specifications (buttons, cards, inputs with dimensions and colors)
3. States to design (default, hover, loading, disabled, error, success)

{format_instructions}
"""

SUBMISSION_PROMPT = """Analyze this work submission and match it to tasks.

Work Summary: {summary}
Duration: {duration} minutes

Available Tasks:
{tasks}

Determine which tasks were completed or progressed. Provide suggestions for improvement.

{format_instructions}
"""

SESSION_PROMPT = """Analyze these screenshots from a work session and generate a summary of what was accomplished.

Screenshots context:
{context}

Generate a concise summary of the work done, including:
- What was built/designed/planned
- Key decisions made
- Progress on tasks
"""

# ============================================
# AGENT
# ============================================

class BriefAgent:
    def __init__(self):
        # Initialize both LLMs
        self.openai = ChatOpenAI(
            model="gpt-4-turbo-preview",
            temperature=0.7,
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        self.gemini = ChatGoogleGenerativeAI(
            model="gemini-pro",
            temperature=0.7,
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        
        # Default to OpenAI, fallback to Gemini
        self.primary_llm = self.openai
        self.fallback_llm = self.gemini

    async def generate_brief_content(
        self, 
        name: str, 
        description: str, 
        role: str
    ) -> Dict[str, Any]:
        """Generate role-specific brief content"""
        
        if role == "pm":
            parser = PydanticOutputParser(pydantic_object=PMContent)
            prompt = ChatPromptTemplate.from_template(PM_PROMPT)
        elif role == "dev":
            parser = PydanticOutputParser(pydantic_object=DevContent)
            prompt = ChatPromptTemplate.from_template(DEV_PROMPT)
        elif role == "designer":
            parser = PydanticOutputParser(pydantic_object=DesignerContent)
            prompt = ChatPromptTemplate.from_template(DESIGNER_PROMPT)
        else:
            raise ValueError(f"Unknown role: {role}")

        chain = prompt | self.primary_llm | parser
        
        try:
            result = await chain.ainvoke({
                "name": name,
                "description": description or "No additional description",
                "format_instructions": parser.get_format_instructions()
            })
            return result.model_dump()
        except Exception as e:
            # Fallback to Gemini
            print(f"OpenAI failed, falling back to Gemini: {e}")
            chain = prompt | self.fallback_llm | parser
            result = await chain.ainvoke({
                "name": name,
                "description": description or "No additional description",
                "format_instructions": parser.get_format_instructions()
            })
            return result.model_dump()

    async def analyze_submission(
        self,
        brief_id: str,
        summary: str,
        duration_minutes: int
    ) -> Dict[str, Any]:
        """Analyze a work submission"""
        
        parser = PydanticOutputParser(pydantic_object=SubmissionAnalysis)
        prompt = ChatPromptTemplate.from_template(SUBMISSION_PROMPT)
        
        # TODO: Fetch actual tasks from database
        tasks = "- Setup payment API\n- Implement frontend\n- Write tests"
        
        chain = prompt | self.primary_llm | parser
        
        try:
            result = await chain.ainvoke({
                "summary": summary,
                "duration": duration_minutes,
                "tasks": tasks,
                "format_instructions": parser.get_format_instructions()
            })
            return result.model_dump()
        except Exception as e:
            print(f"Analysis failed: {e}")
            return {
                "matched_tasks": [],
                "suggestions": ["Could not analyze submission"],
                "confidence": 0.0
            }

    async def process_session(self, screenshots: List[str]) -> str:
        """Process desktop session screenshots and generate summary"""
        
        # For MVP, we'll use Gemini Vision for image analysis
        prompt = ChatPromptTemplate.from_template(SESSION_PROMPT)
        
        # Simplified: just describe what might have been done
        context = f"User worked for a session with {len(screenshots)} captured moments."
        
        chain = prompt | self.primary_llm
        
        try:
            result = await chain.ainvoke({"context": context})
            return result.content
        except Exception as e:
            print(f"Session processing failed: {e}")
            return "Work session completed. Summary generation failed."

    def switch_to_gemini(self):
        """Switch primary LLM to Gemini"""
        self.primary_llm = self.gemini
        self.fallback_llm = self.openai

    def switch_to_openai(self):
        """Switch primary LLM to OpenAI"""
        self.primary_llm = self.openai
        self.fallback_llm = self.gemini
