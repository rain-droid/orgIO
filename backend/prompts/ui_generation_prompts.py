"""Prompts for Generative UI Agent"""

PM_VIEW_GENERATION_PROMPT = """You are generating content for a Product Manager viewing a project brief.

Brief: {brief_name}
Description: {brief_description}

Tasks: {tasks}

Generate structured content for PM-specific visualizations:
1. Kanban Board data (todo, in_progress, done columns)
2. User Stories (as a [user], I want [action], so that [benefit])
3. Timeline/Milestones

Output JSON:
{{
  "kanban": {{
    "columns": {{
      "todo": [task_ids],
      "in_progress": [task_ids],
      "done": [task_ids]
    }}
  }},
  "user_stories": [
    {{
      "id": "story_1",
      "title": "...",
      "user_type": "...",
      "action": "...",
      "benefit": "...",
      "acceptance_criteria": ["..."]
    }}
  ],
  "timeline": [
    {{
      "phase": "Phase name",
      "tasks": [task_ids],
      "estimated_duration": "X days"
    }}
  ]
}}
"""


DEV_VIEW_GENERATION_PROMPT = """You are generating content for a Developer viewing a project brief.

Brief: {brief_name}
Description: {brief_description}

Tasks: {tasks}

Generate structured content for Developer-specific visualizations:
1. Architecture diagram (components and relationships)
2. API specifications
3. Code examples/snippets

Output JSON:
{{
  "architecture": {{
    "components": [
      {{
        "id": "component_1",
        "name": "Component Name",
        "type": "frontend|backend|database|external",
        "description": "..."
      }}
    ],
    "connections": [
      {{
        "from": "component_id",
        "to": "component_id",
        "type": "api_call|data_flow|dependency"
      }}
    ]
  }},
  "api_specs": [
    {{
      "method": "GET|POST|PUT|DELETE",
      "endpoint": "/api/...",
      "description": "...",
      "request_body": {{}},
      "response": {{}}
    }}
  ],
  "code_examples": [
    {{
      "title": "...",
      "language": "typescript|python|...",
      "code": "...",
      "explanation": "..."
    }}
  ]
}}
"""


DESIGNER_VIEW_GENERATION_PROMPT = """You are generating content for a Designer viewing a project brief.

Brief: {brief_name}
Description: {brief_description}

Tasks: {tasks}

Generate structured content for Designer-specific visualizations:
1. User flow diagram
2. Component specifications
3. UI states and variants

Output JSON:
{{
  "user_flow": {{
    "steps": [
      {{
        "id": "step_1",
        "screen": "Screen name",
        "action": "User action",
        "next": "step_2"
      }}
    ]
  }},
  "components": [
    {{
      "name": "Component Name",
      "type": "button|input|card|...",
      "description": "...",
      "props": {{
        "width": "...",
        "height": "...",
        "colors": "..."
      }}
    }}
  ],
  "states": [
    {{
      "component": "Component name",
      "states": ["default", "hover", "active", "disabled"],
      "description": "State behavior"
    }}
  ]
}}
"""
