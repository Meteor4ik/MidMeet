"""
Хранилище сессий встреч.
"""

import random
import time
from dataclasses import dataclass, field
from typing import Optional


CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6


def generate_code() -> str:
    return "".join(random.choices(CODE_ALPHABET, k=CODE_LENGTH))


@dataclass
class Participant:
    role: str
    name: str = "Участник"
    lat: Optional[float] = None
    lng: Optional[float] = None
    accuracy: Optional[float] = None
    last_seen: float = field(default_factory=time.time)


@dataclass
class Room:
    code: str
    created_at: float = field(default_factory=time.time)
    host: Participant = field(default_factory=lambda: Participant(role="host"))
    guest: Optional[Participant] = None


_rooms: dict[str, Room] = {}
ROOM_TTL = 3600


def create_room(custom_code: Optional[str] = None) -> Room:
    if custom_code:
        code = custom_code.strip().upper()
        if not (4 <= len(code) <= 20):
            raise ValueError("Код должен быть от 4 до 20 символов")
        if not code.isalnum():
            raise ValueError("Код может содержать только буквы и цифры")
        if code in _rooms:
            raise ValueError(f"Код '{code}' уже занят")
        room = Room(code=code)
        _rooms[code] = room
        return room

    for _ in range(10):
        code = generate_code()
        if code not in _rooms:
            room = Room(code=code)
            _rooms[code] = room
            return room
    raise RuntimeError("Не удалось сгенерировать уникальный код")


def get_room(code: str) -> Optional[Room]:
    cleanup_old_rooms()
    return _rooms.get(code.upper())


def join_room(code: str) -> Optional[Room]:
    room = get_room(code)
    if room is None:
        return None
    if room.guest is None:
        room.guest = Participant(role="guest")
    return room


def leave_room(code: str, role: str) -> bool:
    """Участник выходит из комнаты."""
    room = get_room(code)
    if room is None:
        return False

    if role == "guest":
        room.guest = None
    elif role == "host":
        # Хост уходит — удаляем всю комнату
        if code.upper() in _rooms:
            del _rooms[code.upper()]

    return True


def update_position(code: str, role: str, name: str, lat: float, lng: float, accuracy: float) -> bool:
    room = get_room(code)
    if room is None:
        return False
    participant = room.host if role == "host" else room.guest
    if participant is None:
        return False
    participant.name = name
    participant.lat = lat
    participant.lng = lng
    participant.accuracy = accuracy
    participant.last_seen = time.time()
    return True


def get_room_state(code: str) -> Optional[dict]:
    room = get_room(code)
    if room is None:
        return None
    return {
        "code": room.code,
        "host": _participant_to_dict(room.host),
        "guest": _participant_to_dict(room.guest) if room.guest else None,
    }


def _participant_to_dict(p: Participant) -> dict:
    return {
        "role": p.role,
        "name": p.name,
        "lat": p.lat,
        "lng": p.lng,
        "accuracy": p.accuracy,
        "last_seen": p.last_seen,
    }


def cleanup_old_rooms():
    now = time.time()
    dead = [code for code, room in _rooms.items() if now - room.created_at > ROOM_TTL]
    for code in dead:
        del _rooms[code]