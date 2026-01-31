from agents.base_agent import BaseAgent
from langchain.prompts import ChatPromptTemplate
from prompts.submission_prompts import SUBMISSION_ANALYSIS_PROMPT, ACTIVITY_GROUPING_PROMPT
from typing import List, Dict, Any, Optional
import json


class SubmissionAnalysisAgent(BaseAgent):
    """
    Agent that analyzes work sessions and generates summaries.
    
    Features:
    - Activity grouping
    - Role-aware summaries
    - Context-aware analysis
    """
    
    def __init__(self):
        super().__init__(model="gpt-4o-mini", temperature=0.4)
        self.analysis_prompt = ChatPromptTemplate.from_template(SUBMISSION_ANALYSIS_PROMPT)
        self.grouping_prompt = ChatPromptTemplate.from_template(ACTIVITY_GROUPING_PROMPT)
    
    async def execute(
        self,
        activities: List[Dict],
        role: str,
        brief_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute submission analysis"""
        return await self.analyze_submission(activities, role, brief_context)
    
    async def analyze_submission(
        self,
        activities: List[Dict],
        role: str,
        brief_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze work session and generate summary.
        
        Args:
            activities: List of activity dicts
            role: User role (pm, dev, designer)
            brief_context: Optional brief context
            
        Returns:
            Dict with summary, accomplishments, suggested keywords
        """
        if not activities:
            return {
                "summary": ["No activities recorded"],
                "key_accomplishments": [],
                "suggested_task_keywords": []
            }
        
        try:
            # Format activities
            activities_str = self._format_activities(activities)
            
            # Create prompt
            messages = self.analysis_prompt.format_messages(
                role=role.upper(),
                activities=activities_str,
                brief_context=brief_context or "General work session"
            )
            
            # Invoke LLM
            response = await self.llm.ainvoke(messages)
            content = response.content
            
            # Parse JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            result = json.loads(content)
            
            # Ensure required fields
            if "summary" not in result:
                result["summary"] = self._generate_fallback_summary(activities, role)
            
            if "key_accomplishments" not in result:
                result["key_accomplishments"] = result["summary"][:3]
            
            if "suggested_task_keywords" not in result:
                result["suggested_task_keywords"] = []
            
            return result
            
        except Exception as e:
            print(f"SubmissionAnalysisAgent error: {e}")
            # Fallback summary
            return {
                "summary": self._generate_fallback_summary(activities, role),
                "key_accomplishments": [f"Worked in {act.get('app')}" for act in activities[:3]],
                "suggested_task_keywords": []
            }
    
    def _format_activities(self, activities: List[Dict]) -> str:
        """Format activities for prompt"""
        formatted = []
        for i, act in enumerate(activities, 1):
            app = act.get("app", "Unknown")
            title = act.get("title", "")
            summary = act.get("summary", "")
            duration = act.get("duration", 0)
            formatted.append(f"{i}. {app} - {title} ({duration}m): {summary}")
        return "\n".join(formatted)
    
    def _generate_fallback_summary(self, activities: List[Dict], role: str) -> List[str]:
        """Generate fallback summary when LLM fails"""
        summaries = []
        
        # Group by app
        by_app = {}
        for act in activities:
            app = act.get("app", "Unknown")
            if app not in by_app:
                by_app[app] = []
            by_app[app].append(act)
        
        # Create summary per app
        for app, acts in by_app.items():
            total_duration = sum(a.get("duration", 0) for a in acts)
            if total_duration > 15:  # Only include significant time
                summaries.append(f"Worked in {app} for {total_duration} minutes")
        
        if not summaries:
            summaries = ["Completed work session"]
        
        return summaries[:5]  # Max 5 bullet points
    
    async def _group_activities(self, activities: List[Dict]) -> List[Dict]:
        """Group related activities together"""
        # Simple grouping by app for now
        # TODO: Implement smarter grouping with LLM
        groups = {}
        for act in activities:
            app = act.get("app", "Unknown")
            if app not in groups:
                groups[app] = []
            groups[app].append(act)
        
        return [
            {"context": app, "activities": acts}
            for app, acts in groups.items()
        ]
    
    async def _analyze_group(
        self,
        group: Dict,
        role: str,
        brief_context: Optional[str]
    ) -> List[str]:
        """Analyze a group of related activities"""
        # Placeholder for future enhancement
        return [f"Work in {group.get('context', 'app')}"]
    
    async def _generate_summary(self, accomplishments: List[str], role: str) -> List[str]:
        """Generate final summary from accomplishments"""
        # Deduplicate and limit to 5
        unique = list(dict.fromkeys(accomplishments))
        return unique[:5]
    
    async def _suggest_tasks(self, summary: List[str], brief_context: Optional[str]) -> List[str]:
        """Suggest related task keywords"""
        # Extract keywords from summary
        keywords = []
        for s in summary:
            words = s.lower().split()
            keywords.extend([w for w in words if len(w) > 4])
        return list(set(keywords))[:10]
