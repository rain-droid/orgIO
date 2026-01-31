"""Prompts for Task Matching Agent"""

TASK_MATCHING_PROMPT = """You are an expert at matching work submissions to project tasks.

Available Tasks:
{tasks}

Work Submission:
Summary:
{summary}

Activities:
{activities}

{snippets}

Your job: Match the work done to the appropriate task IDs from the list above.

Rules:
1. ONLY return task IDs that were CLEARLY worked on
2. Be conservative - only match if you're confident (at least 70% sure)
3. Look for evidence in both summary and activities
4. Consider code snippets if provided
5. A task can be partially completed (that's still a match)
6. Multiple tasks can match if work spans multiple areas

Output ONLY valid JSON in this exact format:
{{
  "matched_task_ids": ["task_id_1", "task_id_2"],
  "confidence": "high",
  "reasoning": "Brief explanation of why these tasks were matched"
}}

Confidence levels: "high" (>80% sure), "medium" (60-80%), "low" (<60%)
"""


SEMANTIC_VALIDATION_PROMPT = """Validate if this work submission matches the given task:

Task: {task_title}
Description: {task_description}

Work Done:
{work_summary}

Does the work meaningfully contribute to this task?
Consider:
- Direct implementation of task requirements
- Supporting work (research, setup, debugging)
- Partial completion counts as a match

Output JSON:
{{
  "is_match": true/false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation"
}}
"""
