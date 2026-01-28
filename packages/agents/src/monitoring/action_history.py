"""Action history tracker for detecting loops and repeated actions."""
import json
from typing import Dict, List, Tuple
from datetime import datetime
from difflib import SequenceMatcher


class ActionLoopDetected(Exception):
    """Raised when an action loop is detected."""
    pass


class ActionHistory:
    """Singleton tracker for all tool invocations to detect loops."""

    _instance = None
    _history: List[Tuple[str, Dict, datetime]] = []

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._history = []
        return cls._instance

    @classmethod
    def reset(cls):
        """Reset history (useful for testing or new task execution)."""
        cls._history = []

    @classmethod
    def register_action(cls, tool_name: str, params: Dict) -> None:
        """
        Register a tool invocation and check for loops.

        Args:
            tool_name: Name of the tool being called
            params: Parameters passed to the tool

        Raises:
            ActionLoopDetected: If a duplicate or loop is detected
        """
        # Add to history
        cls._history.append((tool_name, params, datetime.now()))

        # Only check after we have at least 3 actions
        if len(cls._history) < 3:
            return

        # Get recent actions
        recent_actions = cls._history[-5:]  # Last 5 actions
        current_action = (tool_name, params)

        # Check for EXACT duplicate in last 3 actions
        for i in range(max(0, len(recent_actions) - 3), len(recent_actions) - 1):
            past_tool, past_params, _ = recent_actions[i]
            if past_tool == tool_name and cls._params_match(params, past_params, threshold=1.0):
                # Exact duplicate detected
                raise ActionLoopDetected(
                    f"ERROR: Loop detected - Already executed {tool_name} with identical parameters.\n"
                    f"Previous: {cls._format_params(past_params)}\n"
                    f"Current:  {cls._format_params(params)}\n"
                    f"This means you are stuck in a loop. Choose a DIFFERENT approach."
                )

        # Check for SIMILAR duplicate in last 5 actions (80% similarity)
        for i in range(len(recent_actions) - 1):
            past_tool, past_params, _ = recent_actions[i]
            if past_tool == tool_name and cls._params_match(params, past_params, threshold=0.8):
                # Similar duplicate - warning but don't block
                print(f"\n⚠️  WARNING: Detected similar action to previous attempt")
                print(f"   Tool: {tool_name}")
                print(f"   Previous: {cls._format_params(past_params)}")
                print(f"   Current:  {cls._format_params(params)}")
                print(f"   Consider trying a different approach if this fails.\n")

        # Check for same tool 5+ times in recent history
        same_tool_count = sum(1 for t, _, _ in recent_actions if t == tool_name)
        if same_tool_count >= 5:
            raise ActionLoopDetected(
                f"ERROR: Loop detected - Used {tool_name} tool {same_tool_count} times in last 5 actions.\n"
                f"This suggests you are stuck. Try a completely different approach."
            )

    @classmethod
    def _params_match(cls, params1: Dict, params2: Dict, threshold: float = 1.0) -> bool:
        """
        Check if two parameter dictionaries match with given similarity threshold.

        Args:
            params1: First parameter dict
            params2: Second parameter dict
            threshold: Similarity threshold (0.0-1.0). 1.0 = exact match, 0.8 = 80% similar

        Returns:
            True if parameters match above threshold
        """
        # Convert to JSON strings for comparison
        try:
            str1 = json.dumps(params1, sort_keys=True)
            str2 = json.dumps(params2, sort_keys=True)
        except (TypeError, ValueError):
            # If params can't be serialized, compare string representations
            str1 = str(params1)
            str2 = str(params2)

        if threshold >= 1.0:
            # Exact match
            return str1 == str2
        else:
            # Similarity matching
            ratio = SequenceMatcher(None, str1, str2).ratio()
            return ratio >= threshold

    @classmethod
    def _format_params(cls, params: Dict) -> str:
        """Format parameters for display (truncate long values)."""
        formatted = {}
        for key, value in params.items():
            if isinstance(value, str) and len(value) > 100:
                formatted[key] = value[:97] + "..."
            else:
                formatted[key] = value
        return str(formatted)

    @classmethod
    def get_history(cls) -> List[Tuple[str, Dict, datetime]]:
        """Get the full action history."""
        return cls._history.copy()

    @classmethod
    def get_summary(cls) -> str:
        """Get a summary of recent actions."""
        if not cls._history:
            return "No actions recorded"

        recent = cls._history[-10:]  # Last 10 actions
        summary = [f"Recent action history ({len(recent)} actions):"]

        for i, (tool, params, timestamp) in enumerate(recent, 1):
            time_str = timestamp.strftime("%H:%M:%S")
            summary.append(f"  {i}. [{time_str}] {tool}: {cls._format_params(params)}")

        return "\n".join(summary)
