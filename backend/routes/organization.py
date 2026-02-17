"""
Organization/Club management routes.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

import sys
sys.path.insert(0, '/app/backend')

from database import db, logger
from dependencies import require_auth, require_coach_developer

router = APIRouter(prefix="/organization", tags=["Organization"])


# Request/Response Models
class OrganizationResponse(BaseModel):
    org_id: Optional[str] = None
    club_name: Optional[str] = None
    club_logo: Optional[str] = None
    owner_id: Optional[str] = None
    created_at: Optional[str] = None

class OrganizationUpdate(BaseModel):
    club_name: Optional[str] = None
    club_logo: Optional[str] = None


@router.get("")
async def get_organization(request: Request):
    """Get the organization/club info for the current user"""
    user = await require_auth(request)
    
    # Get full user doc to check for organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    user_org_id = user_doc.get("organization_id") if user_doc else None
    
    # Find org by owner (Coach Developer) or by user's linked org
    org = None
    
    # First priority: Check if user has a direct organization_id (admin-created users)
    if user_org_id:
        org = await db.organizations.find_one({"org_id": user_org_id}, {"_id": 0})
    
    # Second priority: Coach Developer owns the org
    if not org and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        
        # Create org if doesn't exist
        if not org:
            org = {
                "org_id": f"org_{uuid.uuid4().hex[:12]}",
                "owner_id": user.user_id,
                "club_name": None,
                "club_logo": None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.organizations.insert_one(org)
    
    # Third priority: Coach - find org through their linked coach profile
    if not org and user.linked_coach_id:
        coach = await db.coaches.find_one({"id": user.linked_coach_id}, {"_id": 0})
        if coach:
            # First check if coach has organization_id
            coach_org_id = coach.get("organization_id")
            if coach_org_id:
                org = await db.organizations.find_one({"org_id": coach_org_id}, {"_id": 0})
            # Fallback to created_by
            if not org and coach.get("created_by"):
                org = await db.organizations.find_one({"owner_id": coach["created_by"]}, {"_id": 0})
    
    if not org:
        return {"org_id": None, "club_name": None, "club_logo": None, "owner_id": None}
    
    return OrganizationResponse(
        org_id=org.get("org_id"),
        club_name=org.get("club_name"),
        club_logo=org.get("club_logo"),
        owner_id=org.get("owner_id"),
        created_at=org.get("created_at")
    )


@router.put("")
async def update_organization(data: OrganizationUpdate, request: Request):
    """Update organization/club info (Coach Developer only)"""
    user = await require_coach_developer(request)
    
    # Find or create org
    org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
    
    if not org:
        org = {
            "org_id": f"org_{uuid.uuid4().hex[:12]}",
            "owner_id": user.user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.organizations.insert_one(org)
    
    # Update fields
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.club_name is not None:
        update_data["club_name"] = data.club_name
    if data.club_logo is not None:
        update_data["club_logo"] = data.club_logo
    
    await db.organizations.update_one(
        {"owner_id": user.user_id},
        {"$set": update_data}
    )
    
    # Return updated org
    updated_org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
    
    return OrganizationResponse(
        org_id=updated_org.get("org_id"),
        club_name=updated_org.get("club_name"),
        club_logo=updated_org.get("club_logo"),
        owner_id=updated_org.get("owner_id"),
        created_at=updated_org.get("created_at")
    )


@router.get("/subscription")
async def get_organization_subscription(request: Request):
    """Get organization subscription tier (Coach Developer only)"""
    user = await require_coach_developer(request)
    
    # Find organization
    org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
    
    if not org:
        # Check if user belongs to an org
        if hasattr(user, 'organization_id') and user.organization_id:
            org = await db.organizations.find_one({"org_id": user.organization_id}, {"_id": 0})
    
    # Check for bootstrapped status (QPR Academy or specific org)
    bootstrapped_orgs = ["org_4b76a7344640"]  # QPR Academy org_id
    
    if org and org.get("org_id") in bootstrapped_orgs:
        return {
            "tier": "club",
            "is_bootstrapped": True,
            "coaches_limit": 999,
            "admins_limit": 999
        }
    
    # Get subscription from database or default to individual
    subscription = None
    if org:
        subscription = await db.subscriptions.find_one({"org_id": org.get("org_id")}, {"_id": 0})
    
    if subscription:
        return {
            "tier": subscription.get("tier", "individual"),
            "is_bootstrapped": False,
            "coaches_limit": subscription.get("coaches_limit", 5),
            "admins_limit": subscription.get("admins_limit", 1),
            "expires_at": subscription.get("expires_at")
        }
    
    # Default to individual tier
    return {
        "tier": "individual",
        "is_bootstrapped": False,
        "coaches_limit": 5,
        "admins_limit": 1
    }
