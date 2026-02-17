"""
Coach management routes - CRUD operations for coach profiles.
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

import sys
sys.path.insert(0, '/app/backend')

from database import db, logger
from dependencies import require_coach_developer, get_current_user
from utils import validate_email, send_invite_email

router = APIRouter(prefix="/coaches", tags=["Coaches"])


@router.get("")
async def list_all_coaches(request: Request):
    """
    List all coaches in the system.
    Coach Developer only - returns all coach profiles.
    Also syncs users with role='coach' who don't have profiles yet.
    """
    await require_coach_developer(request)
    
    # First, find any users with role='coach' who don't have a coach profile
    # and create profiles for them (migration/sync)
    coach_users = await db.users.find({"role": "coach"}, {"_id": 0}).to_list(200)
    
    for coach_user in coach_users:
        user_id = coach_user.get("user_id")
        linked_coach_id = coach_user.get("linked_coach_id")
        
        # If user has no linked coach profile, create one
        if not linked_coach_id:
            coach_id = f"coach_{uuid.uuid4().hex[:12]}"
            new_coach = {
                "id": coach_id,
                "user_id": user_id,
                "name": coach_user.get("name", "Unknown"),
                "email": coach_user.get("email"),
                "photo": coach_user.get("picture"),
                "role_title": None,
                "age_group": None,
                "department": None,
                "bio": None,
                "targets": [],
                "created_at": coach_user.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "created_by": None  # Unknown - created via migration
            }
            await db.coaches.insert_one(new_coach)
            
            # Link the user to this coach profile
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"linked_coach_id": coach_id}}
            )
            logger.info(f"Auto-created coach profile {coach_id} for existing user {coach_user.get('email')}")
        else:
            # Ensure the coach profile exists
            existing_profile = await db.coaches.find_one({"id": linked_coach_id}, {"_id": 0})
            if not existing_profile:
                # Coach profile missing - create it
                new_coach = {
                    "id": linked_coach_id,
                    "user_id": user_id,
                    "name": coach_user.get("name", "Unknown"),
                    "email": coach_user.get("email"),
                    "photo": coach_user.get("picture"),
                    "role_title": None,
                    "age_group": None,
                    "department": None,
                    "bio": None,
                    "targets": [],
                    "created_at": coach_user.get("created_at", datetime.now(timezone.utc).isoformat()),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": None
                }
                await db.coaches.insert_one(new_coach)
                logger.info(f"Recreated missing coach profile {linked_coach_id} for user {coach_user.get('email')}")
    
    # Now fetch all coach profiles
    coaches = await db.coaches.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Batch fetch user accounts to avoid N+1 queries
    user_ids = [c.get("user_id") for c in coaches if c.get("user_id")]
    users_map = {}
    if user_ids:
        users = await db.users.find(
            {"user_id": {"$in": user_ids}}, 
            {"_id": 0, "user_id": 1, "email": 1}
        ).to_list(200)
        users_map = {u["user_id"]: u for u in users}
    
    # Batch fetch session counts for all coaches using aggregation (avoids N+1 queries)
    coach_ids = [c.get("id") for c in coaches if c.get("id")]
    session_counts_map = {}
    upcoming_counts_map = {}
    
    if coach_ids:
        # Use aggregation pipeline to get all counts in a single query
        pipeline = [
            {"$match": {"coach_id": {"$in": coach_ids}, "status": {"$in": ["completed", "planned"]}}},
            {"$group": {
                "_id": {"coach_id": "$coach_id", "status": "$status"},
                "count": {"$sum": 1}
            }}
        ]
        
        counts_cursor = db.observation_sessions.aggregate(pipeline)
        counts_result = await counts_cursor.to_list(length=None)
        
        # Process aggregation results into maps
        for item in counts_result:
            coach_id = item["_id"]["coach_id"]
            status = item["_id"]["status"]
            count = item["count"]
            
            if status == "completed":
                session_counts_map[coach_id] = count
            elif status == "planned":
                upcoming_counts_map[coach_id] = count
    
    # Enrich with user account status and session counts
    result = []
    for coach in coaches:
        user_id = coach.get("user_id")
        coach_id = coach.get("id")
        has_account = False
        user_email = coach.get("email")
        
        if user_id and user_id in users_map:
            has_account = True
            user_email = users_map[user_id].get("email", user_email)
        
        result.append({
            "id": coach_id,
            "name": coach.get("name"),
            "email": user_email,
            "photo": coach.get("photo"),
            "role_title": coach.get("role_title"),
            "age_group": coach.get("age_group"),
            "department": coach.get("department"),
            "bio": coach.get("bio"),
            "targets": coach.get("targets", []),
            "created_at": coach.get("created_at"),
            "updated_at": coach.get("updated_at"),
            "has_account": has_account,
            "user_id": user_id,
            "sessionCount": session_counts_map.get(coach_id, 0),
            "upcomingCount": upcoming_counts_map.get(coach_id, 0)
        })
    
    return result


@router.post("")
async def create_coach_manually(request: Request):
    """
    Manually create a coach profile (Coach Developer only).
    Also creates an invite if the user doesn't exist.
    Email is required to ensure proper linking.
    """
    user = await require_coach_developer(request)
    body = await request.json()
    
    name = body.get("name", "").strip()
    email = body.get("email", "").strip().lower() if body.get("email") else None
    role_title = body.get("role_title", "").strip() if body.get("role_title") else None
    
    if not name:
        raise HTTPException(status_code=400, detail="Coach name is required")
    
    if not email:
        raise HTTPException(status_code=400, detail="Coach email is required")
    
    if not validate_email(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check if a coach profile already exists with this email
    existing_coach = await db.coaches.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    if existing_coach:
        raise HTTPException(
            status_code=400, 
            detail=f"A coach profile already exists for {email}"
        )
    
    # Check if a user with this email exists
    existing_user = await db.users.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    
    coach_id = f"coach_{uuid.uuid4().hex[:12]}"
    
    if existing_user:
        # User exists - create profile and link
        new_coach = {
            "id": coach_id,
            "user_id": existing_user.get("user_id"),
            "name": name,
            "email": email,
            "photo": existing_user.get("picture"),
            "role_title": role_title,
            "age_group": None,
            "department": None,
            "bio": None,
            "targets": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user.user_id
        }
        await db.coaches.insert_one(new_coach)
        
        # Link user to coach profile and set role to coach
        await db.users.update_one(
            {"user_id": existing_user.get("user_id")},
            {"$set": {"linked_coach_id": coach_id, "role": "coach"}}
        )
        
        logger.info(f"Coach profile {coach_id} created and linked to existing user {email}")
        
        return {
            **new_coach,
            "_id": None,
            "has_account": True,
            "invite_sent": False
        }
    
    # User doesn't exist - create coach profile AND an invite
    new_coach = {
        "id": coach_id,
        "user_id": None,
        "name": name,
        "email": email,
        "photo": None,
        "role_title": role_title,
        "age_group": None,
        "department": None,
        "bio": None,
        "targets": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.user_id
    }
    await db.coaches.insert_one(new_coach)
    
    # Check if invite already exists for this email
    existing_invite = await db.invites.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}, "used": False},
        {"_id": 0}
    )
    
    invite_sent = False
    if not existing_invite:
        # Create invite with coach role, linked to this coach profile
        invite_id = f"inv_{uuid.uuid4().hex[:12]}"
        invite = {
            "invite_id": invite_id,
            "email": email,
            "role": "coach",
            "coach_id": coach_id,  # Link invite to coach profile
            "invited_by": user.user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "used": False
        }
        await db.invites.insert_one(invite)
        
        # Send invite email
        try:
            await send_invite_email(
                email=email,
                inviter_name=user.name,
                role="coach",
                invite_id=invite_id,
                invitee_name=name  # Pass the coach's name for personalized email
            )
            invite_sent = True
            logger.info(f"Invite sent to {email} for coach profile {coach_id}")
        except Exception as e:
            logger.error(f"Failed to send invite email to {email}: {str(e)}")
    
    logger.info(f"Coach profile {coach_id} created manually by {user.user_id}")
    
    return {
        **{k: v for k, v in new_coach.items() if k != "_id"},
        "has_account": False,
        "invite_sent": invite_sent
    }


@router.get("/{coach_id}")
async def get_coach_detail(coach_id: str, request: Request):
    """
    Get detailed coach profile.
    Coach Developer can access any coach in their org.
    Coach can access their own linked coach profile.
    """
    user = await get_current_user(request)
    
    # Require authentication
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Check access: either coach developer OR coach accessing their own profile
    is_coach_developer = user.role in ["coach_developer", "admin"]
    is_own_profile = getattr(user, 'linked_coach_id', None) == coach_id
    
    if not is_coach_developer and not is_own_profile:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get linked user info
    user_id = coach.get("user_id")
    has_account = False
    if user_id:
        linked_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        has_account = linked_user is not None
    
    return {
        **coach,
        "has_account": has_account
    }


@router.get("/{coach_id}/sessions")
async def get_coach_sessions_by_id(coach_id: str, request: Request):
    """
    Get all observation sessions for a specific coach.
    Coach Developer only - used to view a coach's session history.
    """
    await require_coach_developer(request)
    
    # Verify coach exists
    coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Get all observation sessions for this coach
    sessions_cursor = db.observation_sessions.find(
        {"coach_id": coach_id},
        {"_id": 0}
    ).sort("updated_at", -1)
    
    sessions = await sessions_cursor.to_list(100)
    
    # Get observer names in batch
    observer_ids = list(set(s.get("observer_id") for s in sessions if s.get("observer_id")))
    observers_map = {}
    if observer_ids:
        observers = await db.users.find(
            {"user_id": {"$in": observer_ids}},
            {"_id": 0, "user_id": 1, "name": 1}
        ).to_list(100)
        observers_map = {o["user_id"]: o.get("name") for o in observers}
    
    result = []
    for s in sessions:
        result.append({
            "session_id": s.get("session_id"),
            "id": s.get("session_id"),  # Also include 'id' for frontend compatibility
            "name": s.get("name", "Untitled"),
            "title": s.get("name", "Untitled"),  # Also include 'title' for compatibility
            "coach_id": coach_id,
            "observer_id": s.get("observer_id"),
            "observer_name": observers_map.get(s.get("observer_id")),
            "observation_context": s.get("observation_context", "training"),
            "status": s.get("status", "draft"),
            "created_at": s.get("created_at", ""),
            "createdAt": s.get("created_at", ""),  # Also include camelCase for compatibility
            "updated_at": s.get("updated_at", ""),
            "total_duration": s.get("total_duration", 0),
            "totalDuration": s.get("total_duration", 0),  # Also include camelCase
            "events": s.get("events", []),
            "event_count": len(s.get("events", [])),
            "sessionParts": s.get("session_parts", []),
            "eventTypes": s.get("intervention_types", [])
        })
    
    return result


@router.put("/{coach_id}")
async def update_coach(coach_id: str, request: Request):
    """
    Update coach profile (Coach Developer only).
    """
    user = await require_coach_developer(request)
    
    coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    body = await request.json()
    
    # Allowed fields for update
    allowed_fields = ["name", "role_title", "age_group", "department", "bio", "targets"]
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.coaches.update_one(
        {"id": coach_id},
        {"$set": update_data}
    )
    
    logger.info(f"Coach {coach_id} updated by {user.user_id}")
    
    return await get_coach_detail(coach_id, request)


@router.delete("/{coach_id}")
async def delete_coach(coach_id: str, request: Request):
    """
    Delete a coach profile (Coach Developer only).
    Query params:
      - delete_user=true: Also delete the associated user account
    """
    try:
        user = await require_coach_developer(request)
        
        # Check query param for full user deletion
        delete_user = request.query_params.get("delete_user", "").lower() == "true"
        
        coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
        if not coach:
            raise HTTPException(status_code=404, detail="Coach not found")
        
        coach_user_id = coach.get("user_id")
        
        if delete_user and coach_user_id:
            # Delete the user account entirely
            await db.users.delete_one({"user_id": coach_user_id})
            logger.info(f"Deleted user account {coach_user_id} for coach {coach_id}")
        elif coach_user_id:
            # Just unlink from user account
            await db.users.update_one(
                {"user_id": coach_user_id},
                {"$set": {"linked_coach_id": None, "role": "coach_developer"}}  # Promote to developer or set neutral role
            )
        
        # Delete any associated pending invites (by coach_id or by email)
        coach_email = (coach.get("email") or "").strip().lower()
        
        # Build delete query for invites
        invite_query_conditions = [{"coach_id": coach_id}]
        if coach_email:
            invite_query_conditions.append({
                "email": {"$regex": f"^{coach_email}$", "$options": "i"}, 
                "used": {"$ne": True}
            })
        
        delete_result = await db.invites.delete_many({"$or": invite_query_conditions})
        if delete_result.deleted_count > 0:
            logger.info(f"Deleted {delete_result.deleted_count} associated invite(s) for coach {coach_id}")
        
        # Delete the coach profile
        await db.coaches.delete_one({"id": coach_id})
        
        logger.info(f"Coach {coach_id} deleted by {user.user_id}")
        
        return {"status": "deleted", "user_deleted": delete_user and coach_user_id is not None}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting coach {coach_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete coach: {str(e)}")
