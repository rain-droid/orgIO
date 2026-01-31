"""Utility helper functions"""

from typing import List, Dict, Any
import re


def sanitize_json_string(content: str) -> str:
    """
    Clean JSON string from markdown code blocks.
    
    Args:
        content: Raw content string
        
    Returns:
        Cleaned JSON string
    """
    # Remove markdown code blocks
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```" in content:
        content = content.split("```")[1].split("```")[0].strip()
    
    return content


def extract_keywords(text: str, min_length: int = 4) -> List[str]:
    """
    Extract keywords from text.
    
    Args:
        text: Input text
        min_length: Minimum word length
        
    Returns:
        List of keywords
    """
    # Convert to lowercase and split
    words = text.lower().split()
    
    # Filter by length and remove common words
    common_words = {'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'been'}
    keywords = [w for w in words if len(w) >= min_length and w not in common_words]
    
    # Remove duplicates while preserving order
    seen = set()
    unique_keywords = []
    for k in keywords:
        if k not in seen:
            seen.add(k)
            unique_keywords.append(k)
    
    return unique_keywords[:20]  # Limit to 20 keywords


def format_duration(minutes: int) -> str:
    """
    Format minutes as human-readable duration.
    
    Args:
        minutes: Duration in minutes
        
    Returns:
        Formatted string (e.g., "2h 30m")
    """
    if minutes < 60:
        return f"{minutes}m"
    
    hours = minutes // 60
    remaining_minutes = minutes % 60
    
    if remaining_minutes == 0:
        return f"{hours}h"
    
    return f"{hours}h {remaining_minutes}m"


def truncate_text(text: str, max_length: int = 200, suffix: str = "...") -> str:
    """
    Truncate text to maximum length.
    
    Args:
        text: Input text
        max_length: Maximum length
        suffix: Suffix to add when truncated
        
    Returns:
        Truncated text
    """
    if len(text) <= max_length:
        return text
    
    return text[:max_length - len(suffix)] + suffix


def merge_dicts(base: Dict, update: Dict) -> Dict:
    """
    Recursively merge two dictionaries.
    
    Args:
        base: Base dictionary
        update: Dictionary with updates
        
    Returns:
        Merged dictionary
    """
    result = base.copy()
    
    for key, value in update.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_dicts(result[key], value)
        else:
            result[key] = value
    
    return result


def validate_uuid(uuid_string: str) -> bool:
    """
    Validate UUID string format.
    
    Args:
        uuid_string: String to validate
        
    Returns:
        True if valid UUID
    """
    uuid_pattern = re.compile(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        re.IGNORECASE
    )
    return bool(uuid_pattern.match(uuid_string))


def chunk_list(lst: List[Any], chunk_size: int) -> List[List[Any]]:
    """
    Split list into chunks of specified size.
    
    Args:
        lst: List to chunk
        chunk_size: Size of each chunk
        
    Returns:
        List of chunks
    """
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]


def safe_get(dictionary: Dict, *keys: str, default: Any = None) -> Any:
    """
    Safely get nested dictionary value.
    
    Args:
        dictionary: Dictionary to search
        *keys: Nested keys
        default: Default value if not found
        
    Returns:
        Value or default
    """
    current = dictionary
    
    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return default
    
    return current
