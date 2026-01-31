"""Prompts for Submission Analysis Agent"""

SUBMISSION_ANALYSIS_PROMPT = """You are analyzing a work session for a {role}.

Activities:
{activities}

Brief Context: {brief_context}

Analyze the work session and generate a professional summary.

Tasks:
1. Group related activities together
2. Identify key accomplishments
3. Extract technical details (if applicable)
4. Generate 3-5 clear bullet points

For Developers: Focus on code, APIs, bugs fixed, tests
For PMs: Focus on planning, decisions, stakeholder work
For Designers: Focus on UI/UX work, prototypes, design systems

Output JSON:
{{
  "summary": ["Bullet point 1", "Bullet point 2", ...],
  "key_accomplishments": ["Achievement 1", ...],
  "suggested_task_keywords": ["keyword1", "keyword2"]
}}

Be concise but specific. Use action verbs (implemented, fixed, designed, etc).
"""


ACTIVITY_GROUPING_PROMPT = """Group these activities by context:

Activities:
{activities}

Group related activities together (e.g., all work in same file, related functionality).
Output JSON with groups:
{{
  "groups": [
    {{
      "context": "Brief description of what these activities are about",
      "activities": [indices of activities in this group]
    }}
  ]
}}
"""
