from abc import ABC, abstractmethod
from langchain_openai import ChatOpenAI
from typing import List, Optional, Any


class BaseAgent(ABC):
    """
    Base class for all DRIFT agents.
    
    Provides common functionality:
    - LLM initialization
    - Memory management
    - Tool management
    - Abstract execute method
    """
    
    def __init__(self, model: str = "gpt-4o", temperature: float = 0.7):
        """
        Initialize base agent.
        
        Args:
            model: LLM model name (default: gpt-4o)
            temperature: LLM temperature for creativity (default: 0.7)
        """
        self.llm = ChatOpenAI(model=model, temperature=temperature)
        self.memory: Optional[Any] = None
        self.tools: List[Any] = []
    
    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        """
        Execute agent's main task.
        
        Must be implemented by subclasses.
        
        Args:
            **kwargs: Task-specific parameters
            
        Returns:
            Task-specific result
        """
        pass
    
    def add_tool(self, tool: Any) -> None:
        """
        Add a tool to the agent's toolkit.
        
        Args:
            tool: LangChain tool instance
        """
        self.tools.append(tool)
    
    def set_memory(self, memory: Any) -> None:
        """
        Set conversation memory for the agent.
        
        Args:
            memory: LangChain memory instance
        """
        self.memory = memory
    
    def get_llm(self) -> ChatOpenAI:
        """Get the agent's LLM instance"""
        return self.llm
