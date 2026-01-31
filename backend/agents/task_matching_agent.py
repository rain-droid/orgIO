from agents.base_agent import BaseAgent
from langchain.prompts import ChatPromptTemplate
from langchain_openai import OpenAIEmbeddings
from prompts.task_matching_prompts import TASK_MATCHING_PROMPT
from typing import List, Dict, Any, Optional
import json


class TaskMatchingAgent(BaseAgent):
    """
    Agent that matches work submissions to tasks using semantic understanding.
    
    Features:
    - Semantic search with embeddings
    - LLM validation
    - Confidence scoring
    """
    
    def __init__(self):
        super().__init__(model="gpt-4o", temperature=0.3)
        self.embeddings = OpenAIEmbeddings()
        self.prompt = ChatPromptTemplate.from_template(TASK_MATCHING_PROMPT)
    
    async def execute(
        self,
        tasks: List[Dict],
        summary: List[str],
        activities: List[Dict],
        snippets: Optional[List[Dict]] = None
    ) -> List[str]:
        """Execute task matching"""
        return await self.match_tasks(tasks, summary, activities, snippets)
    
    async def match_tasks(
        self,
        tasks: List[Dict],
        summary: List[str],
        activities: List[Dict],
        snippets: Optional[List[Dict]] = None
    ) -> List[str]:
        """
        Match submission to tasks.
        
        Args:
            tasks: List of available tasks
            summary: Summary bullet points
            activities: Activity breakdown
            snippets: Optional code/terminal snippets
            
        Returns:
            List of matched task IDs
        """
        if not tasks:
            return []
        
        try:
            # Format tasks for prompt
            tasks_str = self._format_tasks(tasks)
            
            # Format summary
            summary_str = "\n".join([f"• {s}" for s in summary])
            
            # Format activities
            activities_str = self._format_activities(activities)
            
            # Format snippets
            snippets_str = ""
            if snippets:
                snippets_str = "\nCode/Terminal Snippets:\n" + "\n\n".join([
                    f"[{s.get('context', 'unknown')}]\n{s.get('text', '')[:200]}"
                    for s in snippets
                ])
            
            # Create prompt
            messages = self.prompt.format_messages(
                tasks=tasks_str,
                summary=summary_str,
                activities=activities_str,
                snippets=snippets_str
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
            
            # Extract matched task IDs
            matched_ids = result.get("matched_task_ids", [])
            
            # Validate task IDs exist
            valid_task_ids = {t.get("id") or t.get("task_id") for t in tasks}
            matched_ids = [tid for tid in matched_ids if tid in valid_task_ids]
            
            return matched_ids
            
        except Exception as e:
            print(f"TaskMatchingAgent error: {e}")
            # Fallback: simple keyword matching
            return self._fallback_matching(tasks, summary, activities)
    
    def _format_tasks(self, tasks: List[Dict]) -> str:
        """Format tasks for prompt"""
        formatted = []
        for task in tasks:
            task_id = task.get("id") or task.get("task_id")
            title = task.get("title", "Untitled")
            description = task.get("description", "")
            formatted.append(f"- [{task_id}] {title}: {description}")
        return "\n".join(formatted)
    
    def _format_activities(self, activities: List[Dict]) -> str:
        """Format activities for prompt"""
        formatted = []
        for act in activities:
            app = act.get("app", "Unknown")
            summary = act.get("summary", "")
            duration = act.get("duration", 0)
            formatted.append(f"- {app}: {summary} ({duration}m)")
        return "\n".join(formatted)
    
    def _fallback_matching(
        self,
        tasks: List[Dict],
        summary: List[str],
        activities: List[Dict]
    ) -> List[str]:
        """Simple keyword-based fallback matching"""
        matched = []
        
        # Combine all text
        all_text = " ".join(summary).lower()
        all_text += " " + " ".join([a.get("summary", "") for a in activities]).lower()
        
        for task in tasks:
            task_id = task.get("id") or task.get("task_id")
            title = task.get("title", "").lower()
            description = task.get("description", "").lower()
            
            # Simple keyword check
            if any(word in all_text for word in title.split() if len(word) > 3):
                matched.append(task_id)
            elif any(word in all_text for word in description.split() if len(word) > 4):
                matched.append(task_id)
        
        return matched[:3]  # Limit to 3 matches
    
    async def _semantic_search(self, submission_text: str, tasks: List[Dict]) -> List[Dict]:
        """Perform semantic search (placeholder for future enhancement)"""
        # TODO: Implement vector search with FAISS or Pinecone
        return tasks[:5]  # Return top 5 for now
    
    def _create_submission_text(
        self,
        summary: List[str],
        activities: List[Dict],
        snippets: Optional[List[Dict]]
    ) -> str:
        """Create combined submission text for embedding"""
        text_parts = []
        text_parts.extend(summary)
        text_parts.extend([a.get("summary", "") for a in activities])
        if snippets:
            text_parts.extend([s.get("text", "") for s in snippets])
        return " ".join(text_parts)
