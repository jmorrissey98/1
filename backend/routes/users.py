"""
User management routes - list, role updates, linking, and deletion.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

import sys
sys.path.insert(0, '/app/backend')

from database import db, logger
from dependencies import require_coach_developer

router = APIRouter(prefix="/users", tags=["Users"])


# Request/Response Models
class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "coach"
    linked_coach_id: Optional[str] = None

class RoleUpdateRequest(BaseModel):
    new_role: str


@router.get("", response_model=List[UserResponse])
async def list_users(request: Request):
    """List all users (Coach Developer only)"""
    await require_coach_developer(request)
    
    users = await db.users.find({}, {"_id": 0}).to_list(100)
    return [
        UserResponse(
            user_id=u["user_id"],
            email=u["email"],
            name=u["name"],
            picture=u.get("picture"),
            role=u.get("role", "coach"),
            linked_coach_id=u.get("linked_coach_id")
        )
        for u in users
    ]


@router.put("/{user_id}/role")
async def update_user_role(user_id: str, role_data: RoleUpdateRequest, request: Request):
    """Update a user's role (Coach Developer only)"""
    current_user = await require_coach_developer(request)
    
    # Prevent changing own role
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    
    if role_data.new_role not in ["coach_developer", "coach"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": role_data.new_role}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "updated", "new_role": role_data.new_role}


@router.put("/{user_id}/link-coach")
async def link_user_to_coach(user_id: str, request: Request):
    """Link a user to a coach profile (Coach Developer only)"""
    await require_coach_developer(request)
    
    body = await request.json()
    coach_id = body.get("coach_id")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"linked_coach_id": coach_id}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "linked", "coach_id": coach_id}


@router.delete("/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete a user (Coach Developer only, cannot delete yourself)"""
    current_user = await require_coach_developer(request)
    
    # Cannot delete yourself
    if current_user.user_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    
    # Check if user exists
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get linked coach profile
    linked_coach_id = target_user.get("linked_coach_id")
    user_email = target_user.get("email", "").lower()
    
    # Delete user's sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    
    # Delete user's password reset tokens
    await db.password_resets.delete_many({"email": target_user["email"]})
    
    # Delete associated coach profile if exists
    if linked_coach_id:
        await db.coaches.delete_one({"id": linked_coach_id})
        logger.info(f"Deleted coach profile {linked_coach_id} when deleting user {user_id}")
    
    # Delete any pending invites for this email
    if user_email:
        invite_delete = await db.invites.delete_many({
            "email": {"$regex": f"^{user_email}$", "$options": "i"},
            "used": {"$ne": True}
        })
        if invite_delete.deleted_count > 0:
            logger.info(f"Deleted {invite_delete.deleted_count} pending invite(s) for {user_email}")
    
    # Delete the user
    result = await db.users.delete_one({"user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "deleted", "user_id": user_id, "coach_deleted": linked_coach_id is not None}


@router.post("/link-by-email")
async def link_user_by_email(request: Request):
    """Link a user to a coach profile by email (Coach Developer only)"""
    await require_coach_developer(request)
    
    body = await request.json()
    email = body.get("email", "").lower().strip()
    coach_id = body.get("coach_id")
    
    if not email or not coach_id:
        raise HTTPException(status_code=400, detail="Email and coach_id are required")
    
    # Find user by email (case-insensitive)
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    
    if not user:
        return {"linked": False, "message": "No user found with that email"}
    
    # Update the user to link them to the coach profile
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"linked_coach_id": coach_id}}
    )
    
    return {"linked": True, "user_id": user["user_id"], "coach_id": coach_id}


@router.get("/check-first")
async def check_first_user():
    """Check if this is the first user (for initial setup)"""
    count = await db.users.count_documents({})
    return {"is_first": count == 0}
