"""
Invite management routes - create, list, validate, and resend invites.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

import sys
sys.path.insert(0, '/app/backend')

from database import db, logger
from dependencies import require_coach_developer
from utils import send_invite_email

router = APIRouter(prefix="/invites", tags=["Invites"])


# Request/Response Models
class InviteCreate(BaseModel):
    email: str
    role: str = "coach"
    coach_id: Optional[str] = None

class InviteResponse(BaseModel):
    invite_id: str
    email: str
    role: str
    coach_id: Optional[str] = None
    created_at: str
    email_sent: Optional[bool] = None

class InviteValidationResponse(BaseModel):
    valid: bool
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    error: Optional[str] = None


@router.post("", response_model=InviteResponse)
async def create_invite(invite_data: InviteCreate, request: Request):
    """Create an invite (Coach Developer only)"""
    try:
        user = await require_coach_developer(request)
        
        # Normalize email to lowercase
        email_lower = invite_data.email.lower().strip()
        
        # Check if invite already exists for this email (case-insensitive)
        existing_invite = await db.invites.find_one(
            {"email": {"$regex": f"^{email_lower}$", "$options": "i"}, "used": False},
            {"_id": 0}
        )
        if existing_invite:
            raise HTTPException(status_code=400, detail="An invite already exists for this email address")
        
        # Check if user already exists with this email (case-insensitive)
        existing_user = await db.users.find_one(
            {"email": {"$regex": f"^{email_lower}$", "$options": "i"}}, 
            {"_id": 0}
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="A user with this email already exists")
        
        invite_id = f"inv_{uuid.uuid4().hex[:12]}"
        invite = {
            "invite_id": invite_id,
            "email": email_lower,
            "role": invite_data.role,
            "coach_id": invite_data.coach_id,
            "invited_by": user.user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "used": False
        }
        
        await db.invites.insert_one(invite)
        logger.info(f"Invite created for {email_lower} by {user.email}")
        
        # Send invitation email
        email_sent = False
        email_error = None
        try:
            await send_invite_email(
                email=email_lower,
                inviter_name=user.name,
                role=invite_data.role,
                invite_id=invite_id,
                invitee_name=None
            )
            email_sent = True
            logger.info(f"Invite email sent successfully to {email_lower}")
            
            await db.invites.update_one(
                {"invite_id": invite_id},
                {"$set": {"email_sent": True, "email_sent_at": datetime.now(timezone.utc).isoformat()}}
            )
        except Exception as email_err:
            email_error = str(email_err)
            logger.error(f"Failed to send invite email to {email_lower}: {email_error}")
            
            await db.invites.update_one(
                {"invite_id": invite_id},
                {"$set": {"email_sent": False, "email_error": email_error}}
            )
        
        return InviteResponse(
            invite_id=invite_id,
            email=email_lower,
            role=invite_data.role,
            coach_id=invite_data.coach_id,
            created_at=invite["created_at"],
            email_sent=email_sent
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Invite creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create invite: {str(e)}")


@router.get("", response_model=List[InviteResponse])
async def list_invites(request: Request):
    """List all pending invites (Coach Developer only)"""
    await require_coach_developer(request)
    
    invites = await db.invites.find({"used": False}, {"_id": 0}).to_list(100)
    return [
        InviteResponse(
            invite_id=inv["invite_id"],
            email=inv["email"],
            role=inv["role"],
            coach_id=inv.get("coach_id"),
            created_at=inv["created_at"],
            email_sent=inv.get("email_sent")
        )
        for inv in invites
    ]


@router.delete("/{invite_id}")
async def delete_invite(invite_id: str, request: Request):
    """Delete an invite (Coach Developer only)"""
    await require_coach_developer(request)
    
    result = await db.invites.delete_one({"invite_id": invite_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found")
    return {"status": "deleted"}


@router.delete("/by-email/{email}")
async def delete_invite_by_email(email: str, request: Request):
    """Delete an invite by email address (Coach Developer only)"""
    await require_coach_developer(request)
    
    email_lower = email.lower().strip()
    result = await db.invites.delete_many({"email": {"$regex": f"^{email_lower}$", "$options": "i"}})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No invite found for this email")
    return {"status": "deleted", "count": result.deleted_count}


@router.post("/{invite_id}/resend")
async def resend_invite(invite_id: str, request: Request):
    """Resend an invitation email (Coach Developer only)"""
    user = await require_coach_developer(request)
    
    invite = await db.invites.find_one({"invite_id": invite_id, "used": False}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or already used")
    
    # Get invitee name from coach profile if exists
    invitee_name = None
    if invite.get("coach_id"):
        coach = await db.coaches.find_one({"id": invite["coach_id"]}, {"_id": 0, "name": 1})
        if coach:
            invitee_name = coach.get("name")
    
    try:
        await send_invite_email(
            email=invite["email"],
            inviter_name=user.name,
            role=invite["role"],
            invite_id=invite_id,
            invitee_name=invitee_name
        )
        return {"status": "sent", "email": invite["email"]}
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to resend invite email to {invite['email']}: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Email failed: {error_msg}")


@router.get("/validate/{invite_id}", response_model=InviteValidationResponse)
async def validate_invite(invite_id: str):
    """
    Validate an invite token and return pre-populated data.
    This is a public endpoint (no auth required).
    """
    invite = await db.invites.find_one({"invite_id": invite_id}, {"_id": 0})
    
    if not invite:
        return InviteValidationResponse(valid=False, error="Invite not found")
    
    if invite.get("used"):
        return InviteValidationResponse(valid=False, error="This invitation has already been used")
    
    # Get invitee name from coach profile if exists
    invitee_name = None
    if invite.get("coach_id"):
        coach = await db.coaches.find_one({"id": invite["coach_id"]}, {"_id": 0, "name": 1})
        if coach:
            invitee_name = coach.get("name")
    
    return InviteValidationResponse(
        valid=True,
        email=invite["email"],
        name=invitee_name,
        role=invite.get("role", "coach")
    )
