from agents.base_agent import BaseAgent
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import JsonOutputParser
from prompts.brief_prompts import BRIEF_TASK_GENERATION_PROMPT
from typing import Dict, List, Any
import json


class BriefProcessingAgent(BaseAgent):
    """
    Agent that processes briefs and generates role-specific tasks.
    
    Input: Brief name and description
    Output: Lists of tasks for PM, Dev, Designer roles
    """
    
    def __init__(self):
        super().__init__(model="gpt-4o", temperature=0.7)
        self.prompt = ChatPromptTemplate.from_template(BRIEF_TASK_GENERATION_PROMPT)
        self.output_parser = JsonOutputParser()
    
    async def execute(self, brief_name: str, description: str) -> Dict[str, Any]:
        """
        Generate tasks from brief.
        
        Args:
            brief_name: Name of the brief
            description: Brief description
            
        Returns:
            Dict with 'tasks' key containing list of task dicts
        """
        return await self.process_brief(brief_name, description)
    
    async def process_brief(self, brief_name: str, description: str) -> Dict[str, Any]:
        """
        Main processing method.
        
        Args:
            brief_name: Name of the brief
            description: Brief description
            
        Returns:
            Dict with generated tasks
        """
        try:
            # Format prompt
            messages = self.prompt.format_messages(
                brief_name=brief_name,
                description=description
            )
            
            # Invoke LLM
            response = await self.llm.ainvoke(messages)
            
            # Parse JSON response
            content = response.content
            
            # Clean potential markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            result = json.loads(content)
            
            # Validate structure
            if "tasks" not in result:
                raise ValueError("Response missing 'tasks' key")
            
            # Ensure all tasks have required fields
            for task in result["tasks"]:
                if not all(k in task for k in ["role", "title", "description"]):
                    raise ValueError("Task missing required fields")
            
            return result
            
        except Exception as e:
            print(f"BriefProcessingAgent error: {e}")
            # Return fallback structure
            return {
                "tasks": [
                    {
                        "role": "pm",
                        "title": "Define project scope and requirements",
                        "description": f"Create detailed requirements for: {brief_name}",
                        "acceptance_criteria": ["Requirements documented", "Stakeholders aligned"]
                    },
                    {
                        "role": "dev",
                        "title": "Implement core functionality",
                        "description": f"Develop the main features for: {brief_name}",
                        "acceptance_criteria": ["Code implemented", "Unit tests pass"]
                    },
                    {
                        "role": "designer",
                        "title": "Design user interface",
                        "description": f"Create UI designs for: {brief_name}",
                        "acceptance_criteria": ["Designs created", "Prototype ready"]
                    }
                ]
            }
    
    def _generate_pm_tasks(self, brief_name: str, description: str) -> List[Dict]:
        """Generate PM-specific tasks"""
        return []
    
    def _generate_dev_tasks(self, brief_name: str, description: str) -> List[Dict]:
        """Generate Dev-specific tasks"""
        return []
    
    def _generate_design_tasks(self, brief_name: str, description: str) -> List[Dict]:
        """Generate Designer-specific tasks"""
        return []
