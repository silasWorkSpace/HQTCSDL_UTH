from dataclasses import dataclass
from typing import Optional


@dataclass
class UserDto:
    id: str
    email: str
    role: str


@dataclass
class CreateUserRequest:
    email: str
    role: str
    display_name: Optional[str] = None
