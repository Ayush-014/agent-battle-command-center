"""JWT token authentication for MCP clients."""

import logging
from datetime import datetime, timedelta
from typing import Optional

import jwt
from pydantic import BaseModel

from src.config import settings

logger = logging.getLogger(__name__)


class TokenPayload(BaseModel):
    """JWT token payload."""

    agent_id: str
    exp: datetime


class TokenManager:
    """Manages JWT tokens for MCP client authentication."""

    def __init__(self):
        """Initialize token manager."""
        self.secret = settings.jwt_secret
        self.algorithm = settings.jwt_algorithm
        self.expiration = settings.jwt_expiration

    def create_token(self, agent_id: str) -> str:
        """Create JWT token for agent.

        Args:
            agent_id: Agent ID

        Returns:
            JWT token string
        """
        payload = {
            "agent_id": agent_id,
            "exp": datetime.utcnow() + timedelta(seconds=self.expiration),
        }

        token = jwt.encode(payload, self.secret, algorithm=self.algorithm)
        logger.info(f"Created token for agent {agent_id}")

        return token

    def verify_token(self, token: str) -> Optional[TokenPayload]:
        """Verify JWT token.

        Args:
            token: JWT token string

        Returns:
            Token payload if valid, None otherwise
        """
        try:
            payload = jwt.decode(token, self.secret, algorithms=[self.algorithm])
            return TokenPayload(**payload)

        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return None

        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None

    def refresh_token(self, token: str) -> Optional[str]:
        """Refresh JWT token.

        Args:
            token: Existing JWT token

        Returns:
            New JWT token if valid, None otherwise
        """
        payload = self.verify_token(token)
        if not payload:
            return None

        # Create new token with same agent_id
        return self.create_token(payload.agent_id)


# Global token manager instance
token_manager = TokenManager()
