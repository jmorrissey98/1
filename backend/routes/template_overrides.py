"""
User Template Override Routes
=============================
Allows users to create personal copies of admin templates, 
edit them, and revert to the original admin version.

When a user edits or deletes a global admin template:
- A personal override is created in user_template_overrides collection
- The original admin template remains unchanged
- User can revert to original at any time

These endpoints work alongside existing template endpoints.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid

import sys
sys.path.insert(0, '/app/backend')

from database import db, logger
from dependencies import require_auth

router = APIRouter(prefix="/template-overrides", tags=["Template Overrides"])


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class CreateOverrideRequest(BaseModel):
    """Create a user override of an admin template"""
    admin_template_id: str
    template_data: Dict[str, Any]  # User's modified version


class UpdateOverrideRequest(BaseModel):
    """Update a user override"""
    template_data: Dict[str, Any]


# ============================================
# USER OVERRIDE ENDPOINTS
# ============================================

@router.get("")
async def list_my_overrides(request: Request):
    """
    List all template overrides for the current user.
    """
    user = await require_auth(request)
    
    overrides = await db.user_template_overrides.find(
        {"user_id": user.user_id, "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).to_list(100)
    
    return {"overrides": overrides}


@router.get("/{admin_template_id}")
async def get_my_override(admin_template_id: str, request: Request):
    """
    Get user's override for a specific admin template (if exists).
    """
    user = await require_auth(request)
    
    override = await db.user_template_overrides.find_one(
        {"user_id": user.user_id, "admin_template_id": admin_template_id},
        {"_id": 0}
    )
    
    if not override:
        return {"has_override": False, "override": None}
    
    return {"has_override": True, "override": override}


@router.post("")
async def create_override(data: CreateOverrideRequest, request: Request):
    """
    Create a personal override of an admin template.
    Called when user edits a global/assigned admin template.
    """
    user = await require_auth(request)
    
    # Verify admin template exists
    admin_template = await db.admin_templates.find_one(
        {"template_id": data.admin_template_id, "is_admin_template": True},
        {"_id": 0}
    )
    
    if not admin_template:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    # Check if override already exists
    existing = await db.user_template_overrides.find_one({
        "user_id": user.user_id,
        "admin_template_id": data.admin_template_id
    })
    
    if existing:
        # Update existing override instead
        await db.user_template_overrides.update_one(
            {"override_id": existing["override_id"]},
            {"$set": {
                "template_data": data.template_data,
                "is_deleted": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        updated = await db.user_template_overrides.find_one(
            {"override_id": existing["override_id"]},
            {"_id": 0}
        )
        return updated
    
    # Get user's organization
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    now = datetime.now(timezone.utc).isoformat()
    override_id = f"override_{uuid.uuid4().hex[:12]}"
    
    override_doc = {
        "override_id": override_id,
        "admin_template_id": data.admin_template_id,
        "user_id": user.user_id,
        "organization_id": org_id,
        "category": admin_template.get("category"),
        "original_name": admin_template.get("name"),
        "template_data": data.template_data,
        "is_deleted": False,
        "created_at": now,
        "updated_at": now
    }
    
    await db.user_template_overrides.insert_one(override_doc)
    
    logger.info(f"User {user.user_id} created override for admin template {data.admin_template_id}")
    
    override_doc.pop("_id", None)
    return override_doc


@router.put("/{admin_template_id}")
async def update_override(admin_template_id: str, data: UpdateOverrideRequest, request: Request):
    """
    Update user's override of an admin template.
    """
    user = await require_auth(request)
    
    result = await db.user_template_overrides.update_one(
        {"user_id": user.user_id, "admin_template_id": admin_template_id},
        {"$set": {
            "template_data": data.template_data,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Override not found")
    
    updated = await db.user_template_overrides.find_one(
        {"user_id": user.user_id, "admin_template_id": admin_template_id},
        {"_id": 0}
    )
    
    return updated


@router.delete("/{admin_template_id}")
async def delete_override(admin_template_id: str, request: Request):
    """
    Soft-delete user's override (marks as deleted but keeps record for potential revert).
    """
    user = await require_auth(request)
    
    result = await db.user_template_overrides.update_one(
        {"user_id": user.user_id, "admin_template_id": admin_template_id},
        {"$set": {
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Override not found")
    
    logger.info(f"User {user.user_id} deleted override for admin template {admin_template_id}")
    
    return {"success": True, "admin_template_id": admin_template_id}


@router.post("/{admin_template_id}/revert")
async def revert_to_original(admin_template_id: str, request: Request):
    """
    Revert to the original admin template by removing user's override.
    The admin template will be shown instead of user's modified version.
    """
    user = await require_auth(request)
    
    # Check if override exists
    override = await db.user_template_overrides.find_one({
        "user_id": user.user_id,
        "admin_template_id": admin_template_id
    })
    
    if not override:
        return {"success": True, "message": "No override exists - already using admin version"}
    
    # Remove the override completely
    await db.user_template_overrides.delete_one({
        "user_id": user.user_id,
        "admin_template_id": admin_template_id
    })
    
    logger.info(f"User {user.user_id} reverted to original admin template {admin_template_id}")
    
    # Get the original admin template to return
    admin_template = await db.admin_templates.find_one(
        {"template_id": admin_template_id},
        {"_id": 0}
    )
    
    return {
        "success": True,
        "message": "Reverted to original admin template",
        "admin_template": admin_template
    }


@router.post("/{admin_template_id}/hide")
async def hide_admin_template(admin_template_id: str, request: Request):
    """
    Hide an admin template from user's view without editing it.
    Creates an override with is_hidden=True.
    """
    user = await require_auth(request)
    
    # Verify admin template exists
    admin_template = await db.admin_templates.find_one(
        {"template_id": admin_template_id, "is_admin_template": True},
        {"_id": 0}
    )
    
    if not admin_template:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    # Check if override already exists
    existing = await db.user_template_overrides.find_one({
        "user_id": user.user_id,
        "admin_template_id": admin_template_id
    })
    
    if existing:
        await db.user_template_overrides.update_one(
            {"override_id": existing["override_id"]},
            {"$set": {
                "is_hidden": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Get user's organization
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        org_id = user_doc.get("organization_id") if user_doc else None
        
        now = datetime.now(timezone.utc).isoformat()
        override_id = f"override_{uuid.uuid4().hex[:12]}"
        
        override_doc = {
            "override_id": override_id,
            "admin_template_id": admin_template_id,
            "user_id": user.user_id,
            "organization_id": org_id,
            "category": admin_template.get("category"),
            "original_name": admin_template.get("name"),
            "template_data": admin_template.get("template_data", {}),
            "is_hidden": True,
            "is_deleted": False,
            "created_at": now,
            "updated_at": now
        }
        
        await db.user_template_overrides.insert_one(override_doc)
    
    logger.info(f"User {user.user_id} hid admin template {admin_template_id}")
    
    return {"success": True, "admin_template_id": admin_template_id, "is_hidden": True}


@router.post("/{admin_template_id}/unhide")
async def unhide_admin_template(admin_template_id: str, request: Request):
    """
    Unhide a previously hidden admin template.
    """
    user = await require_auth(request)
    
    result = await db.user_template_overrides.update_one(
        {"user_id": user.user_id, "admin_template_id": admin_template_id},
        {"$set": {
            "is_hidden": False,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        return {"success": True, "message": "Template was not hidden"}
    
    logger.info(f"User {user.user_id} unhid admin template {admin_template_id}")
    
    return {"success": True, "admin_template_id": admin_template_id, "is_hidden": False}
