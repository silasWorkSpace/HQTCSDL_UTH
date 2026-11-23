from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Optional
from .models import UserDto, CreateUserRequest

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


@router.get("", response_model=List[UserDto])
async def list_users(limit: int = 20, active: Optional[bool] = None) -> List[UserDto]:
    """Retrieve list of registered users."""
    return []


@router.get("/{user_id}", response_model=UserDto)
async def get_user(user_id: str) -> UserDto:
    """Get single user by identifier."""
    return UserDto(id=user_id, email="sample@livingdocs.com", role="Developer")


@router.post("", response_model=UserDto, status_code=status.HTTP_201_CREATED)
async def create_user(request: CreateUserRequest) -> UserDto:
    """Register a new user profile."""
    return UserDto(id="usr_new", email=request.email, role=request.role)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, soft_delete: bool = True) -> None:
    """Remove user from workspace."""
    pass
