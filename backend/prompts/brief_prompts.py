"""Prompts for Brief Processing Agent"""

BRIEF_TASK_GENERATION_PROMPT = """You are a project planning expert. Generate tasks for different team roles based on a brief.

Brief Name: {brief_name}
Description: {description}

Generate 3-5 tasks for EACH role: PM (Product Manager), Developer, Designer

For each task provide:
- role: "pm", "dev", or "designer"
- title: Clear, actionable task name (max 100 chars)
- description: Detailed description of what needs to be done
- acceptance_criteria: List of 2-4 criteria that define "done"

Output ONLY valid JSON in this exact format:
{{
  "tasks": [
    {{
      "role": "pm",
      "title": "...",
      "description": "...",
      "acceptance_criteria": ["...", "..."]
    }}
  ]
}}

Guidelines:
- PM tasks: Planning, stakeholder communication, requirements, timeline, priorities
- Dev tasks: Implementation, APIs, architecture, database, testing, deployment
- Designer tasks: UI/UX design, user flows, component specs, prototypes, visual design

Be specific and actionable. Each task should be completable in 1-3 days.
"""


BRIEF_ANALYSIS_PROMPT = """Analyze this brief and extract key requirements:

Brief: {brief_name}
Description: {description}

Identify:
1. Core features/functionality
2. Technical requirements
3. User experience considerations
4. Success criteria

Output as structured analysis.
"""
