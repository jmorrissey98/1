"""
Authentication and authorization dependencies.
"""
from fastapi import Request, HTTPException
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from database import db, logger
from models import User


async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token (cookie-based auth)"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        return None
    
    session = await db.sessions_auth.find_one({"session_token": session_token})
    
    if not session:
        return None
    
    # Check if session is expired
    expires_at = session.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expires_at:
            await db.sessions_auth.delete_one({"session_token": session_token})
            return None
    
    # Check for impersonation
    impersonating_user_id = session.get("impersonating_user_id")
    
    if impersonating_user_id:
        user_data = await db.users.find_one({"user_id": impersonating_user_id}, {"_id": 0})
        if user_data:
            return User(**user_data)
    
    user_data = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    
    if not user_data:
        return None
    
    return User(**user_data)


async def require_auth(request: Request) -> User:
    """Require authentication - raises 401 if not authenticated"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_coach_developer(request: Request) -> User:
    """Require Coach Developer role"""
    user = await require_auth(request)
    if user.role != "coach_developer" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Coach Developer role required")
    return user


async def require_admin(request: Request) -> User:
    """Require Admin role"""
    user = await require_auth(request)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_coach(request: Request) -> User:
    """
    Require authenticated user with coach role.
    Auto-creates coach profile if none exists.
    """
    user = await require_auth(request)
    if user.role != "coach":
        raise HTTPException(status_code=403, detail="Coach access required")
    
    # If no linked_coach_id, try to find or create one
    if not user.linked_coach_id:
        existing_coach = await db.coaches.find_one({"email": user.email}, {"_id": 0})
        
        if existing_coach and existing_coach.get("id"):
            linked_coach_id = existing_coach.get("id")
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {"linked_coach_id": linked_coach_id}}
            )
            user.linked_coach_id = linked_coach_id
            logger.info(f"Linked user {user.email} to existing coach profile {linked_coach_id}")
        else:
            coach_id = f"coach_{uuid.uuid4().hex[:12]}"
            
            if existing_coach:
                await db.coaches.update_one(
                    {"email": user.email},
                    {"$set": {
                        "id": coach_id,
                        "user_id": user.user_id,
                        "updatedAt": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logger.info(f"Fixed coach profile for {user.email} with id {coach_id}")
            else:
                new_coach = {
                    "id": coach_id,
                    "user_id": user.user_id,
                    "name": user.name,
                    "email": user.email,
                    "photo": user.picture,
                    "targets": [],
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
                await db.coaches.insert_one(new_coach)
                logger.info(f"Created new coach profile {coach_id} for user {user.email}")
            
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {"linked_coach_id": coach_id}}
            )
            user.linked_coach_id = coach_id
    
    return user


async def get_coach_profile_for_user(user: User) -> Optional[Dict[str, Any]]:
    """Get the coach profile linked to a user"""
    if not user.linked_coach_id:
        return None
    coach = await db.coaches.find_one({"id": user.linked_coach_id}, {"_id": 0})
    return coach


async def verify_coach_owns_session(user: User, session_id: str) -> Dict[str, Any]:
    """
    Verify a coach has access to a specific session.
    """
    session = await db.sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.get("coach_id") != user.linked_coach_id:
        raise HTTPException(status_code=403, detail="You do not have access to this session")
    
    return session


async def filter_coach_data(user: User, query: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add coach-specific filtering to a database query.
    """
    if user.role == "coach":
        if not user.linked_coach_id:
            raise HTTPException(status_code=403, detail="No coach profile linked")
        query["coach_id"] = user.linked_coach_id
    return query
