from enum import IntEnum


class MarketType(IntEnum):
    SPEECH_EVENT = 0
    IMAGE_EVENT = 1
    WEATHER_EVENT = 2
    SOCIAL_MEDIA_EVENT = 3
    CUSTOM = 4


class MarketStatus(IntEnum):
    OPEN = 0
    CLOSED = 1
    RESOLVED = 2
    DISPUTED = 3
    CANCELLED = 4
