from agents.base_agent import BaseAgent
from langchain.prompts import ChatPromptTemplate
from prompts.ui_generation_prompts import (
    PM_VIEW_GENERATION_PROMPT,
    DEV_VIEW_GENERATION_PROMPT,
    DESIGNER_VIEW_GENERATION_PROMPT
)
from typing import List, Dict, Any
import json


class GenerativeUIAgent(BaseAgent):
    """
    Agent that generates role-specific content structures for frontend.
    
    Generates:
    - PM: Kanban data, User Stories, Timeline
    - Dev: Architecture, API Specs, Code examples
    - Designer: User Flows, Component Specs, States
    """
    
    def __init__(self):
        super().__init__(model="gpt-4o", temperature=0.8)
        
        self.pm_prompt = ChatPromptTemplate.from_template(PM_VIEW_GENERATION_PROMPT)
        self.dev_prompt = ChatPromptTemplate.from_template(DEV_VIEW_GENERATION_PROMPT)
        self.designer_prompt = ChatPromptTemplate.from_template(DESIGNER_VIEW_GENERATION_PROMPT)
    
    async def execute(self, brief: Dict, tasks: List[Dict], role: str) -> Dict[str, Any]:
        """Execute view generation"""
        return await self.generate_view_content(brief, tasks, role)
    
    async def generate_view_content(
        self,
        brief: Dict,
        tasks: List[Dict],
        role: str
    ) -> Dict[str, Any]:
        """
        Generate role-specific content structure.
        
        Args:
            brief: Brief dict
            tasks: List of tasks
            role: User role (pm, dev, designer)
            
        Returns:
            Dict with components for frontend rendering
        """
        if role == "pm":
            return await self._generate_pm_view(brief, tasks)
        elif role == "dev":
            return await self._generate_dev_view(brief, tasks)
        elif role == "designer":
            return await self._generate_designer_view(brief, tasks)
        else:
            return {"components": [], "error": f"Unknown role: {role}"}
    
    async def _generate_pm_view(self, brief: Dict, tasks: List[Dict]) -> Dict[str, Any]:
        """Generate PM view: Kanban, Stories, Timeline"""
        try:
            # Format tasks
            tasks_str = json.dumps(tasks, indent=2)
            
            messages = self.pm_prompt.format_messages(
                brief_name=brief.get("name", ""),
                brief_description=brief.get("description", ""),
                tasks=tasks_str
            )
            
            response = await self.llm.ainvoke(messages)
            content = response.content
            
            # Parse JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            result = json.loads(content)
            
            return {
                "role": "pm",
                "components": [
                    {
                        "type": "kanban",
                        "data": result.get("kanban", self._default_kanban(tasks))
                    },
                    {
                        "type": "user_stories",
                        "data": result.get("user_stories", [])
                    },
                    {
                        "type": "timeline",
                        "data": result.get("timeline", [])
                    }
                ]
            }
            
        except Exception as e:
            print(f"PM view generation error: {e}")
            return self._default_pm_view(brief, tasks)
    
    async def _generate_dev_view(self, brief: Dict, tasks: List[Dict]) -> Dict[str, Any]:
        """Generate Dev view: Architecture, API Specs, Code"""
        try:
            tasks_str = json.dumps(tasks, indent=2)
            
            messages = self.dev_prompt.format_messages(
                brief_name=brief.get("name", ""),
                brief_description=brief.get("description", ""),
                tasks=tasks_str
            )
            
            response = await self.llm.ainvoke(messages)
            content = response.content
            
            # Parse JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            result = json.loads(content)
            
            return {
                "role": "dev",
                "components": [
                    {
                        "type": "architecture",
                        "data": result.get("architecture", {})
                    },
                    {
                        "type": "api_specs",
                        "data": result.get("api_specs", [])
                    },
                    {
                        "type": "code_examples",
                        "data": result.get("code_examples", [])
                    }
                ]
            }
            
        except Exception as e:
            print(f"Dev view generation error: {e}")
            return self._default_dev_view(brief, tasks)
    
    async def _generate_designer_view(self, brief: Dict, tasks: List[Dict]) -> Dict[str, Any]:
        """Generate Designer view: User Flow, Components, States"""
        try:
            tasks_str = json.dumps(tasks, indent=2)
            
            messages = self.designer_prompt.format_messages(
                brief_name=brief.get("name", ""),
                brief_description=brief.get("description", ""),
                tasks=tasks_str
            )
            
            response = await self.llm.ainvoke(messages)
            content = response.content
            
            # Parse JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            result = json.loads(content)
            
            return {
                "role": "designer",
                "components": [
                    {
                        "type": "user_flow",
                        "data": result.get("user_flow", {})
                    },
                    {
                        "type": "components",
                        "data": result.get("components", [])
                    },
                    {
                        "type": "states",
                        "data": result.get("states", [])
                    }
                ]
            }
            
        except Exception as e:
            print(f"Designer view generation error: {e}")
            return self._default_designer_view(brief, tasks)
    
    def _default_kanban(self, tasks: List[Dict]) -> Dict:
        """Default kanban structure"""
        return {
            "columns": {
                "todo": [t.get("id") for t in tasks if t.get("status") == "todo"],
                "in_progress": [t.get("id") for t in tasks if t.get("status") == "in_progress"],
                "done": [t.get("id") for t in tasks if t.get("status") == "done"]
            }
        }
    
    def _default_pm_view(self, brief: Dict, tasks: List[Dict]) -> Dict:
        """Fallback PM view"""
        return {
            "role": "pm",
            "components": [
                {
                    "type": "kanban",
                    "data": self._default_kanban(tasks)
                },
                {
                    "type": "user_stories",
                    "data": []
                },
                {
                    "type": "timeline",
                    "data": []
                }
            ]
        }
    
    def _default_dev_view(self, brief: Dict, tasks: List[Dict]) -> Dict:
        """Fallback Dev view"""
        return {
            "role": "dev",
            "components": [
                {
                    "type": "architecture",
                    "data": {"components": [], "connections": []}
                },
                {
                    "type": "api_specs",
                    "data": []
                },
                {
                    "type": "code_examples",
                    "data": []
                }
            ]
        }
    
    def _default_designer_view(self, brief: Dict, tasks: List[Dict]) -> Dict:
        """Fallback Designer view"""
        return {
            "role": "designer",
            "components": [
                {
                    "type": "user_flow",
                    "data": {"steps": []}
                },
                {
                    "type": "components",
                    "data": []
                },
                {
                    "type": "states",
                    "data": []
                }
            ]
        }
