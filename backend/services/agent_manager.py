from typing import Optional, Dict, Any


class AgentManager:
    """
    Singleton manager for all DRIFT agents.
    
    Manages agent lifecycle and provides centralized access.
    Lazy-loads agents on first access for efficiency.
    """
    
    _instance: Optional['AgentManager'] = None
    _initialized: bool = False
    
    def __new__(cls) -> 'AgentManager':
        """Singleton pattern: ensure only one instance exists"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize agent manager (only once)"""
        if self._initialized:
            return
        
        # Agent instances (lazy-loaded)
        self._brief_agent: Optional[Any] = None
        self._task_matching_agent: Optional[Any] = None
        self._submission_agent: Optional[Any] = None
        self._ui_agent: Optional[Any] = None
        
        self._initialized = True
    
    def get_agent(self, agent_type: str) -> Any:
        """
        Get agent by type (lazy-loaded).
        
        Args:
            agent_type: One of 'brief', 'matching', 'submission', 'ui'
            
        Returns:
            Agent instance
            
        Raises:
            ValueError: If agent_type is invalid
        """
        if agent_type == "brief":
            if self._brief_agent is None:
                from agents.brief_agent import BriefProcessingAgent
                self._brief_agent = BriefProcessingAgent()
            return self._brief_agent
        
        elif agent_type == "matching":
            if self._task_matching_agent is None:
                from agents.task_matching_agent import TaskMatchingAgent
                self._task_matching_agent = TaskMatchingAgent()
            return self._task_matching_agent
        
        elif agent_type == "submission":
            if self._submission_agent is None:
                from agents.submission_agent import SubmissionAnalysisAgent
                self._submission_agent = SubmissionAnalysisAgent()
            return self._submission_agent
        
        elif agent_type == "ui":
            if self._ui_agent is None:
                from agents.generative_ui_agent import GenerativeUIAgent
                self._ui_agent = GenerativeUIAgent()
            return self._ui_agent
        
        else:
            raise ValueError(f"Unknown agent type: {agent_type}")
    
    @property
    def brief_agent(self):
        """Get Brief Processing Agent"""
        return self.get_agent("brief")
    
    @property
    def task_matching_agent(self):
        """Get Task Matching Agent"""
        return self.get_agent("matching")
    
    @property
    def submission_agent(self):
        """Get Submission Analysis Agent"""
        return self.get_agent("submission")
    
    @property
    def ui_agent(self):
        """Get Generative UI Agent"""
        return self.get_agent("ui")


# Global agent manager instance
_agent_manager_instance: Optional[AgentManager] = None


def get_agent_manager() -> AgentManager:
    """
    Dependency injection function for FastAPI.
    
    Returns:
        AgentManager singleton instance
    """
    global _agent_manager_instance
    if _agent_manager_instance is None:
        _agent_manager_instance = AgentManager()
    return _agent_manager_instance
