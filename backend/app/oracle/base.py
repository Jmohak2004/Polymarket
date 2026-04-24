from abc import ABC, abstractmethod
from typing import Tuple, Optional


class BaseOracle(ABC):
    """
    Every oracle pipeline must implement resolve().
    Returns: (outcome: bool, confidence: int 0-100, raw_output: str)
    """

    def __init__(self, market) -> None:
        self.market = market

    @abstractmethod
    async def resolve(self) -> Tuple[bool, int, str]:
        """
        Analyse the event and return:
          - outcome (True = YES, False = NO)
          - confidence score (0–100)
          - raw_output (transcript, JSON, etc.)
        """
        ...
