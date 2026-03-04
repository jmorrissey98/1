"""
Coach management routes - CRUD operations for coach profiles.
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid

import sys
sys.path.insert(0, '/app/backend')

from database import db, logger
from dependencies import require_coach_developer, get_current_user, check_coach_limit, get_data_retention_info
from utils import validate_email, send_invite_email

router = APIRouter(prefix="/coaches", tags=["Coaches"])


@router.get("")
async def list_all_coaches(request: Request):
    """
    List all coaches in the organization.
    Coach Developer only - returns coach profiles for their organization.
    Also syncs users with role='coach' who don't have profiles yet.
    """
    user = await require_coach_developer(request)
    
    # Get the organization_id for proper data isolation
    org_id = user.organization_id
    if not org_id:
        # Legacy user without organization - return empty list
        # This can happen for users created before the organization system
        logger.warning(f"User {user.email} has no organization_id - returning empty coach list")
        return []
    
    # First, find any users with role='coach' IN THIS ORGANIZATION who don't have a coach profile
    # and create profiles for them (migration/sync)
    coach_users = await db.users.find(
        {"role": "coach", "organization_id": org_id}, 
        {"_id": 0}
    ).to_list(200)
    
    for coach_user in coach_users:
        user_id = coach_user.get("user_id")
        linked_coach_id = coach_user.get("linked_coach_id")
        
        # If user has no linked coach profile, create one
        if not linked_coach_id:
            coach_id = f"coach_{uuid.uuid4().hex[:12]}"
            new_coach = {
                "id": coach_id,
                "user_id": user_id,
                "organization_id": org_id,  # Critical for data isolation
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
            # Ensure the coach profile exists and has correct organization_id
            existing_profile = await db.coaches.find_one({"id": linked_coach_id}, {"_id": 0})
            if not existing_profile:
                # Coach profile missing - create it
                new_coach = {
                    "id": linked_coach_id,
                    "user_id": user_id,
                    "organization_id": org_id,  # Critical for data isolation
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
            elif not existing_profile.get("organization_id"):
                # Coach profile exists but missing organization_id - update it
                await db.coaches.update_one(
                    {"id": linked_coach_id},
                    {"$set": {"organization_id": org_id}}
                )
                logger.info(f"Updated coach profile {linked_coach_id} with organization_id {org_id}")
    
    # Now fetch coach profiles for this organization only
    # We filter by organization_id to ensure data isolation between organizations
    coaches = await db.coaches.find(
        {"organization_id": org_id}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
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
    
    # Get the organization_id for proper data isolation
    org_id = user.organization_id
    
    # If no org_id on user, try to find one they own or are associated with
    if not org_id:
        # Check if user owns an organization
        owned_org = await db.organizations.find_one(
            {"owner_id": user.user_id},
            {"_id": 0, "org_id": 1}
        )
        if owned_org:
            org_id = owned_org.get("org_id")
            # Update user with the org_id for future requests
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {"organization_id": org_id}}
            )
            logger.info(f"Updated user {user.user_id} with organization_id {org_id}")
    
    if not org_id:
        raise HTTPException(
            status_code=400, 
            detail="Your account is not linked to an organization. Please contact support or re-register."
        )
    
    # Check subscription limit before creating coach
    limit_check = await check_coach_limit(user.user_id)
    if not limit_check["can_add"]:
        raise HTTPException(
            status_code=403,
            detail=f"Coach limit reached ({limit_check['current']}/{limit_check['limit']}). Please upgrade your subscription to add more coaches."
        )
    
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
            "organization_id": org_id,  # Critical for data isolation
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
        "organization_id": org_id,  # Critical for data isolation
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
    Individual tier users only see last 3 months of data.
    """
    user = await require_coach_developer(request)
    
    # Verify coach exists
    coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Get data retention info for the user
    retention_info = await get_data_retention_info(user.user_id)
    
    # Build query - filter by date if user has limited retention
    query = {"coach_id": coach_id}
    if retention_info["is_limited"] and retention_info["cutoff_date"]:
        query["created_at"] = {"$gte": retention_info["cutoff_date"].isoformat()}
    
    # Get observation sessions for this coach
    sessions_cursor = db.observation_sessions.find(
        query,
        {"_id": 0}
    ).sort("updated_at", -1)
    
    sessions = await sessions_cursor.to_list(100)
    
    # Also get count of sessions outside retention window (for upgrade prompt)
    hidden_sessions_count = 0
    if retention_info["is_limited"] and retention_info["cutoff_date"]:
        hidden_sessions_count = await db.observation_sessions.count_documents({
            "coach_id": coach_id,
            "created_at": {"$lt": retention_info["cutoff_date"].isoformat()}
        })
    
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
            "ball_rolling_time": s.get("ball_rolling_time", 0),
            "ball_not_rolling_time": s.get("ball_not_rolling_time", 0),
            "ballRollingTime": s.get("ball_rolling_time", 0),  # camelCase for frontend
            "ballNotRollingTime": s.get("ball_not_rolling_time", 0),  # camelCase for frontend
            "events": s.get("events", []),
            "event_count": len(s.get("events", [])),
            "sessionParts": s.get("session_parts", []),
            "eventTypes": s.get("intervention_types", [])
        })
    
    # Return with metadata about data retention
    return {
        "sessions": result,
        "data_retention": {
            "is_limited": retention_info["is_limited"],
            "months_limit": retention_info["months_limit"],
            "hidden_sessions_count": hidden_sessions_count,
            "tier": retention_info["tier"],
            "upgrade_message": f"You have {hidden_sessions_count} more sessions from before {retention_info['cutoff_date'].strftime('%B %Y')}. Upgrade to Developer or Club plan to access all historical data." if hidden_sessions_count > 0 else None
        }
    }


@router.get("/{coach_id}/analytics")
async def get_coach_analytics_by_id(coach_id: str, request: Request):
    """
    Get aggregated analytics for a specific coach (Coach Developer only).
    Returns same structure as /coach/analytics but for any coach by ID.
    Individual tier users only see analytics from last 3 months of data.
    """
    user = await require_coach_developer(request)
    
    # Verify coach exists
    coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Get data retention info for the user
    retention_info = await get_data_retention_info(user.user_id)
    
    # Build query - filter by date if user has limited retention
    query = {"coach_id": coach_id}
    if retention_info["is_limited"] and retention_info["cutoff_date"]:
        query["created_at"] = {"$gte": retention_info["cutoff_date"].isoformat()}
    
    # Fetch sessions with full event data for this coach
    sessions = await db.observation_sessions.find(
        query,
        {"_id": 0, "session_id": 1, "events": 1, "ball_rolling_time": 1, 
         "ball_not_rolling_time": 1, "total_duration": 1, "created_at": 1}
    ).to_list(length=1000)
    
    # Count hidden sessions for upgrade prompt
    hidden_sessions_count = 0
    if retention_info["is_limited"] and retention_info["cutoff_date"]:
        hidden_sessions_count = await db.observation_sessions.count_documents({
            "coach_id": coach_id,
            "created_at": {"$lt": retention_info["cutoff_date"].isoformat()}
        })
    
    total_sessions = len(sessions)
    total_interventions = 0
    total_ball_rolling = 0
    total_ball_stopped = 0
    total_duration = 0
    intervention_type_count = {}
    intervention_combinations = {}
    
    for session in sessions:
        events = session.get("events", [])
        total_interventions += len(events)
        
        # Ball rolling stats
        total_ball_rolling += session.get("ball_rolling_time", 0) or 0
        total_ball_stopped += session.get("ball_not_rolling_time", 0) or 0
        total_duration += session.get("total_duration", 0) or 0
        
        # Count intervention types
        for event in events:
            type_name = event.get("eventTypeName") or event.get("eventTypeId") or "Unknown"
            intervention_type_count[type_name] = intervention_type_count.get(type_name, 0) + 1
            
            # Track combinations for pattern analysis
            desc1 = ", ".join(event.get("descriptors1", [])) or "None"
            desc2 = ", ".join(event.get("descriptors2", [])) or "None"
            combo = f"{type_name}|{desc1}|{desc2}"
            intervention_combinations[combo] = intervention_combinations.get(combo, 0) + 1
    
    # Calculate averages
    avg_per_session = round(total_interventions / total_sessions, 1) if total_sessions > 0 else 0
    avg_ball_rolling = round((total_ball_rolling / total_duration) * 100) if total_duration > 0 else 0
    
    # Build intervention distribution chart data
    intervention_chart_data = [
        {
            "name": name,
            "count": count,
            "percentage": round((count / total_interventions) * 100) if total_interventions > 0 else 0
        }
        for name, count in sorted(intervention_type_count.items(), key=lambda x: -x[1])
    ]
    
    # Calculate variety score using Normalized Shannon Entropy (Pielou's Evenness)
    # This measures how evenly distributed interventions are across types
    # 100% = perfectly even, 0% = only one type used
    import math
    variety_percentage = 0
    num_types = len(intervention_type_count)
    
    if num_types > 1 and total_interventions > 0:
        # Calculate Shannon Entropy: H = -Σ(p_i * log(p_i))
        shannon_entropy = 0
        for count in intervention_type_count.values():
            if count > 0:
                p = count / total_interventions
                shannon_entropy -= p * math.log(p)
        
        # Maximum entropy for n types: H_max = log(n)
        max_entropy = math.log(num_types)
        
        # Normalized entropy (evenness): E = H / H_max
        if max_entropy > 0:
            variety_percentage = round((shannon_entropy / max_entropy) * 100)
    # If only 1 type used, variety is 0%
    # If 0 types/interventions, variety is 0%
    
    # Get most common pattern - find the intervention TYPE with highest total count
    # NOT the combination with highest count (which could give wrong results)
    sorted_types = sorted(intervention_type_count.items(), key=lambda x: -x[1])
    most_common_pattern = None
    if sorted_types:
        most_common_pattern = {
            "pattern": sorted_types[0][0],
            "count": sorted_types[0][1]
        }
    
    return {
        "total_sessions": total_sessions,
        "total_interventions": total_interventions,
        "avg_per_session": avg_per_session,
        "avg_ball_rolling": avg_ball_rolling,
        "total_ball_rolling_time": total_ball_rolling,
        "total_ball_stopped_time": total_ball_stopped,
        "intervention_chart_data": intervention_chart_data,
        "variety_percentage": variety_percentage,
        "most_common_pattern": most_common_pattern,
        "data_retention": {
            "is_limited": retention_info["is_limited"],
            "months_limit": retention_info["months_limit"],
            "hidden_sessions_count": hidden_sessions_count,
            "tier": retention_info["tier"],
            "upgrade_message": f"Analytics based on last {retention_info['months_limit']} months. You have {hidden_sessions_count} older sessions. Upgrade to see complete history." if hidden_sessions_count > 0 else None
        }
    }


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
    
    # Allowed fields for update (including photo for profile pictures)
    allowed_fields = ["name", "role_title", "age_group", "department", "bio", "targets", "photo"]
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


# ============================================
# COACH NOTES ENDPOINTS
# ============================================

from pydantic import BaseModel
from typing import Optional

class CoachNoteCreate(BaseModel):
    text: str
    is_private: bool = False  # If True, only coach developers can see it (not the coach)


class CoachNoteUpdate(BaseModel):
    text: Optional[str] = None
    is_private: Optional[bool] = None


@router.get("/{coach_id}/notes")
async def get_coach_notes(coach_id: str, request: Request):
    """
    Get notes for a coach profile.
    - Coach developers see: all shared notes + all private notes (from any coach developer)
    - Coaches see: all shared notes + their own private notes
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    is_coach_developer = user.role in ['admin', 'coach_developer']
    is_coach = user.role == 'coach'
    
    # Verify access
    if is_coach:
        # Coach can only access their own notes
        if user.linked_coach_id != coach_id:
            raise HTTPException(status_code=403, detail="Cannot access notes for another coach")
    
    # Build query based on role
    if is_coach_developer:
        # Coach developers see all notes (shared + all private notes from coach developers)
        notes = await db.coach_notes.find(
            {"coach_id": coach_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(500)
    else:
        # Coaches see: shared notes + their own private notes
        notes = await db.coach_notes.find(
            {
                "coach_id": coach_id,
                "$or": [
                    {"is_private": False},  # All shared notes
                    {"is_private": True, "author_role": "coach", "author_id": user.user_id}  # Their own private notes
                ]
            },
            {"_id": 0}
        ).sort("created_at", -1).to_list(500)
    
    return notes


@router.post("/{coach_id}/notes")
async def create_coach_note(coach_id: str, data: CoachNoteCreate, request: Request):
    """
    Add a note to a coach's profile.
    Both coach developers and coaches can add notes.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    is_coach_developer = user.role in ['admin', 'coach_developer']
    is_coach = user.role == 'coach'
    
    # Verify access
    if is_coach:
        # Coach can only add notes to their own profile
        if user.linked_coach_id != coach_id:
            raise HTTPException(status_code=403, detail="Cannot add notes to another coach's profile")
    
    # Verify coach exists
    coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0, "name": 1})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Get author name
    author_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "name": 1})
    author_name = author_doc.get("name") if author_doc else user.email
    
    now = datetime.now(timezone.utc).isoformat()
    note_id = f"note_{uuid.uuid4().hex[:12]}"
    
    note = {
        "note_id": note_id,
        "coach_id": coach_id,
        "text": data.text.strip(),
        "is_private": data.is_private,
        "author_id": user.user_id,
        "author_name": author_name,
        "author_role": "coach_developer" if is_coach_developer else "coach",
        "created_at": now,
        "updated_at": now
    }
    
    await db.coach_notes.insert_one(note)
    
    # Remove _id before returning
    note.pop("_id", None)
    
    logger.info(f"Note {note_id} created for coach {coach_id} by {user.user_id} (private: {data.is_private})")
    
    return note


@router.put("/{coach_id}/notes/{note_id}")
async def update_coach_note(coach_id: str, note_id: str, data: CoachNoteUpdate, request: Request):
    """
    Update a note. Only the author can update their own note.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find the note
    note = await db.coach_notes.find_one(
        {"note_id": note_id, "coach_id": coach_id},
        {"_id": 0}
    )
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Only author can update
    if note.get("author_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Cannot update another user's note")
    
    # Build update
    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.text is not None:
        update_fields["text"] = data.text.strip()
    if data.is_private is not None:
        update_fields["is_private"] = data.is_private
    
    await db.coach_notes.update_one(
        {"note_id": note_id},
        {"$set": update_fields}
    )
    
    # Return updated note
    updated_note = await db.coach_notes.find_one({"note_id": note_id}, {"_id": 0})
    
    return updated_note


@router.delete("/{coach_id}/notes/{note_id}")
async def delete_coach_note(coach_id: str, note_id: str, request: Request):
    """
    Delete a note. Only the author can delete their own note.
    Coach developers (admins) can delete any note.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    is_admin = user.role == 'admin'
    
    # Find the note
    note = await db.coach_notes.find_one(
        {"note_id": note_id, "coach_id": coach_id},
        {"_id": 0}
    )
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Only author or admin can delete
    if note.get("author_id") != user.user_id and not is_admin:
        raise HTTPException(status_code=403, detail="Cannot delete another user's note")
    
    await db.coach_notes.delete_one({"note_id": note_id})
    
    logger.info(f"Note {note_id} deleted by {user.user_id}")
    
    return {"success": True, "deleted": True}

