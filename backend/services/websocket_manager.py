from typing import Dict, Set
from fastapi import WebSocket
import json


class WebSocketManager:
    """
    Manages WebSocket connections for real-time updates.
    
    Features:
    - Connection management per organization
    - Broadcasting messages to all clients in an org
    - Connection tracking
    """
    
    def __init__(self):
        # Active connections: org_id -> set of websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, org_id: str):
        """
        Accept and register a WebSocket connection.
        
        Args:
            websocket: WebSocket instance
            org_id: Organization ID
        """
        await websocket.accept()
        
        if org_id not in self.active_connections:
            self.active_connections[org_id] = set()
        
        self.active_connections[org_id].add(websocket)
    
    def disconnect(self, websocket: WebSocket, org_id: str):
        """
        Remove a WebSocket connection.
        
        Args:
            websocket: WebSocket instance
            org_id: Organization ID
        """
        if org_id in self.active_connections:
            self.active_connections[org_id].discard(websocket)
            
            # Clean up empty org sets
            if not self.active_connections[org_id]:
                del self.active_connections[org_id]
    
    async def broadcast_to_org(self, org_id: str, message: dict):
        """
        Broadcast message to all connections in an organization.
        
        Args:
            org_id: Organization ID
            message: Message dict to broadcast
        """
        if org_id not in self.active_connections:
            return
        
        # Remove disconnected clients
        disconnected = set()
        
        for websocket in self.active_connections[org_id]:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.add(websocket)
        
        # Clean up disconnected clients
        for websocket in disconnected:
            self.active_connections[org_id].discard(websocket)
    
    async def broadcast_event(self, event_type: str, payload: dict, org_id: str):
        """
        Broadcast an event to an organization.
        
        Args:
            event_type: Event type (e.g., 'submission:new')
            payload: Event payload
            org_id: Organization ID
        """
        message = {
            "type": event_type,
            "payload": payload
        }
        await self.broadcast_to_org(org_id, message)


# Global WebSocket manager instance
websocket_manager = WebSocketManager()


def get_websocket_manager() -> WebSocketManager:
    """Get WebSocket manager instance"""
    return websocket_manager
