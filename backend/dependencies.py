"""
Authentication and authorization dependencies.
"""
from fastapi import Request, HTTPException
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timezone
import uuid

from database import db, logger
from models import User

# Default limits for free tier / no subscription
DEFAULT_COACHES_LIMIT = 5
DEFAULT_ADMINS_LIMIT = 1

# Bootstrapped organizations that bypass limits
BOOTSTRAPPED_ORG_IDS = ["org_4b76a7344640"]  # QPR Academy


async def get_subscription_limits(user_id: str) -> Tuple[int, int, str]:
    """
    Get subscription limits for a user's organization.
    Returns: (coaches_limit, admins_limit, tier_name)
    Checks for custom organization overrides first.
    """
    # Tier limits lookup
    TIER_LIMITS = {
        "individual": {"coaches": 5, "admins": 1},
        "developer": {"coaches": 10, "admins": 1},
        "club": {"coaches": 30, "admins": 5}
    }
    
    # Find user's organization
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        return DEFAULT_COACHES_LIMIT, DEFAULT_ADMINS_LIMIT, "free"
    
    # Admin users bypass all limits
    if user_doc.get("role") == "admin":
        return 999, 999, "admin"
    
    # Get organization
    org = await db.organizations.find_one({"owner_id": user_id}, {"_id": 0})
    if not org:
        # Check if user belongs to an org
        org_id = user_doc.get("organization_id")
        if org_id:
            org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    
    if not org:
        return DEFAULT_COACHES_LIMIT, DEFAULT_ADMINS_LIMIT, "free"
    
    org_id = org.get("org_id")
    
    # Check for custom organization overrides FIRST
    custom_limits = await db.organization_custom_limits.find_one(
        {"org_id": org_id},
        {"_id": 0}
    )
    
    # Check if bootstrapped (unlimited)
    if org_id in BOOTSTRAPPED_ORG_IDS:
        coaches = custom_limits.get("coaches_limit") if custom_limits and custom_limits.get("coaches_limit") else 999
        admins = custom_limits.get("admins_limit") if custom_limits and custom_limits.get("admins_limit") else 999
        return coaches, admins, "bootstrapped"
    
    # Find active subscription for this org (try both field names)
    subscription = await db.subscriptions.find_one(
        {"$or": [{"org_id": org_id}, {"organization_id": org_id}], "status": {"$in": ["active", "trialing"]}},
        {"_id": 0}
    )
    
    # Also check by owner's customer_id
    if not subscription:
        # Look up subscription by owner
        subscription = await db.subscriptions.find_one(
            {"user_id": user_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        # Try to match by examining payment transactions
        if not subscription:
            txn = await db.payment_transactions.find_one(
                {"user_id": user_id, "status": "completed"},
                {"_id": 0},
                sort=[("created_at", -1)]
            )
            if txn and txn.get("subscription_id"):
                subscription = await db.subscriptions.find_one(
                    {"subscription_id": txn.get("subscription_id")},
                    {"_id": 0}
                )
    
    if subscription:
        # Apply custom overrides if they exist
        base_coaches = subscription.get("coaches_limit", DEFAULT_COACHES_LIMIT)
        base_admins = subscription.get("admins_limit", DEFAULT_ADMINS_LIMIT)
        tier = subscription.get("tier_id") or subscription.get("tier") or "unknown"
        
        if custom_limits:
            coaches = custom_limits.get("coaches_limit") if custom_limits.get("coaches_limit") is not None else base_coaches
            admins = custom_limits.get("admins_limit") if custom_limits.get("admins_limit") is not None else base_admins
            return coaches, admins, tier
        
        return base_coaches, base_admins, tier
    
    # Fall back to organization's subscription_tier_id if no subscription record exists
    org_tier = org.get("subscription_tier_id")
    if org_tier and org_tier in TIER_LIMITS:
        tier_config = TIER_LIMITS[org_tier]
        base_coaches = tier_config["coaches"]
        base_admins = tier_config["admins"]
        
        if custom_limits:
            coaches = custom_limits.get("coaches_limit") if custom_limits.get("coaches_limit") is not None else base_coaches
            admins = custom_limits.get("admins_limit") if custom_limits.get("admins_limit") is not None else base_admins
            return coaches, admins, org_tier
        
        return base_coaches, base_admins, org_tier
    
    # Apply custom overrides even without subscription
    if custom_limits:
        coaches = custom_limits.get("coaches_limit") if custom_limits.get("coaches_limit") is not None else DEFAULT_COACHES_LIMIT
        admins = custom_limits.get("admins_limit") if custom_limits.get("admins_limit") is not None else DEFAULT_ADMINS_LIMIT
        return coaches, admins, "free"
    
    return DEFAULT_COACHES_LIMIT, DEFAULT_ADMINS_LIMIT, "free"


async def get_current_counts(user_id: str) -> Tuple[int, int]:
    """
    Get current coach and admin counts for a user's organization.
    Returns: (current_coaches, current_admins)
    
    NOTE: "coaches" here refers to USER ACCOUNTS with role="coach", 
    NOT coach profiles in the coaches collection.
    """
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    org_id = None
    
    if user_doc:
        # Admin users see all counts
        if user_doc.get("role") == "admin":
            coaches_count = await db.users.count_documents({"role": "coach"})
            admins_count = await db.users.count_documents({
                "role": {"$in": ["coach_developer", "admin"]}
            })
            return coaches_count, max(1, admins_count)
        
        # For coach_developer, find their org
        org = await db.organizations.find_one({"owner_id": user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
        elif user_doc.get("organization_id"):
            org_id = user_doc.get("organization_id")
    
    # Count coach users (users with role="coach") in the organization
    if org_id:
        # Count users with role="coach" in this organization
        coaches_count = await db.users.count_documents({
            "organization_id": org_id,
            "role": "coach"
        })
        
        # If no coaches found with org_id, try invited_by fallback
        if coaches_count == 0:
            coaches_count = await db.users.count_documents({
                "invited_by": user_id,
                "role": "coach"
            })
        
        # For bootstrapped orgs, if still no coaches, count all coach users
        if coaches_count == 0 and org_id in BOOTSTRAPPED_ORG_IDS:
            coaches_count = await db.users.count_documents({"role": "coach"})
    else:
        # Fallback: count coach users invited by this user
        coaches_count = await db.users.count_documents({
            "invited_by": user_id,
            "role": "coach"
        })
    
    # Count admin users (coach_developer role) in the organization
    if org_id:
        # First try: by organization_id
        admins_count = await db.users.count_documents({
            "$or": [
                {"organization_id": org_id, "role": {"$in": ["coach_developer", "admin"]}},
                {"user_id": user_id}  # Include the owner
            ]
        })
        
        # For bootstrapped orgs, if only the owner was found, count all coach_developers
        if admins_count <= 1 and org_id in BOOTSTRAPPED_ORG_IDS:
            admins_count = await db.users.count_documents({
                "role": {"$in": ["coach_developer", "admin"]}
            })
    else:
        # Count the user themselves plus any users they've invited
        admins_count = await db.users.count_documents({
            "$or": [
                {"user_id": user_id},
                {"invited_by": user_id, "role": {"$in": ["coach_developer", "admin"]}}
            ]
        })
    
    return coaches_count, max(1, admins_count)


# Data retention limits by tier (in months, None = unlimited)
DATA_RETENTION_LIMITS = {
    "individual": 3,  # 3 months rolling window
    "free": 3,        # Free tier also 3 months
    "developer": None,  # Unlimited
    "club": None,       # Unlimited
    "admin": None,      # Unlimited
    "bootstrapped": None,  # Unlimited
}


async def get_data_retention_info(user_id: str) -> Dict[str, Any]:
    """
    Get data retention information for a user based on their subscription tier.
    Checks for custom organization overrides.
    Returns: {
        "months_limit": int or None (None = unlimited),
        "tier": str,
        "cutoff_date": datetime or None,
        "is_limited": bool
    }
    """
    _, _, tier = await get_subscription_limits(user_id)
    
    # Normalize tier name for lookup
    tier_lower = tier.lower() if tier else "free"
    months_limit = DATA_RETENTION_LIMITS.get(tier_lower, 3)  # Default to 3 months if unknown
    
    # Check for custom organization override
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if user_doc:
        org_id = user_doc.get("organization_id")
        if not org_id:
            # Check if user owns an org
            org = await db.organizations.find_one({"owner_id": user_id}, {"_id": 0})
            org_id = org.get("org_id") if org else None
        
        if org_id:
            custom_limits = await db.organization_custom_limits.find_one(
                {"org_id": org_id},
                {"_id": 0}
            )
            if custom_limits and custom_limits.get("data_retention_months") is not None:
                months_limit = custom_limits.get("data_retention_months")
                # None in custom means unlimited
                if months_limit == 0:
                    months_limit = None
    
    cutoff_date = None
    if months_limit is not None:
        from dateutil.relativedelta import relativedelta
        cutoff_date = datetime.now(timezone.utc) - relativedelta(months=months_limit)
    
    return {
        "months_limit": months_limit,
        "tier": tier,
        "cutoff_date": cutoff_date,
        "is_limited": months_limit is not None
    }


async def check_coach_limit(user_id: str) -> Dict[str, Any]:
    """
    Check if the user can add more coaches.
    Returns: {"can_add": bool, "current": int, "limit": int, "tier": str, "message": str}
    """
    coaches_limit, _, tier = await get_subscription_limits(user_id)
    current_coaches, _ = await get_current_counts(user_id)
    
    can_add = current_coaches < coaches_limit
    
    return {
        "can_add": can_add,
        "current": current_coaches,
        "limit": coaches_limit,
        "tier": tier,
        "message": f"Coach limit reached ({current_coaches}/{coaches_limit}). Please upgrade your subscription." if not can_add else None
    }


async def check_admin_limit(user_id: str) -> Dict[str, Any]:
    """
    Check if the user can add more admins/coach developers.
    Returns: {"can_add": bool, "current": int, "limit": int, "tier": str, "message": str}
    """
    _, admins_limit, tier = await get_subscription_limits(user_id)
    _, current_admins = await get_current_counts(user_id)
    
    can_add = current_admins < admins_limit
    
    return {
        "can_add": can_add,
        "current": current_admins,
        "limit": admins_limit,
        "tier": tier,
        "message": f"Admin limit reached ({current_admins}/{admins_limit}). Please upgrade your subscription." if not can_add else None
    }


async def require_coach_slot(request: Request) -> None:
    """
    Dependency that checks if user can add a coach.
    Raises HTTPException if limit reached.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    result = await check_coach_limit(user.user_id)
    if not result["can_add"]:
        raise HTTPException(
            status_code=403, 
            detail=result["message"]
        )


async def require_admin_slot(request: Request) -> None:
    """
    Dependency that checks if user can add an admin.
    Raises HTTPException if limit reached.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    result = await check_admin_limit(user.user_id)
    if not result["can_add"]:
        raise HTTPException(
            status_code=403, 
            detail=result["message"]
        )


async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token in cookie or Authorization header"""
    session_token = None
    
    # Check Authorization header FIRST (takes priority)
    # This ensures that explicitly set tokens (from localStorage) override cookies
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        session_token = auth_header[7:]
    
    # Fallback to cookie if no Authorization header
    if not session_token:
        session_token = request.cookies.get("session_token")
    
    if not session_token:
        return None
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    
    if not session:
        return None
    
    # Check if session is expired
    expires_at = session.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expires_at:
            await db.user_sessions.delete_one({"session_token": session_token})
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
