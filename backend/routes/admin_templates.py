"""
Admin Template Management Routes
================================
Allows admin to create, manage, and distribute templates across the platform.

Template Categories:
- observation: Coach Observation templates
- coach_reflection: Reflection templates for Coaches
- coach_developer_reflection: Reflection templates for Coach Developers

Features:
- Create templates with custom qualification tags
- Set templates as global (default for all users)
- Assign templates to specific users/organizations
- Users can edit/delete personal copies and revert to admin version
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid

import sys
sys.path.insert(0, '/app/backend')

from database import db, logger
from dependencies import require_auth

router = APIRouter(prefix="/admin/templates", tags=["Admin Templates"])


# ============================================
# HELPER FUNCTIONS
# ============================================

async def require_admin(request: Request):
    """Require admin role for access"""
    user = await require_auth(request)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class AdminTemplateCreate(BaseModel):
    """Create a new admin template"""
    category: str  # "observation", "coach_reflection", "coach_developer_reflection"
    name: str
    description: Optional[str] = None
    qualification_tags: List[str] = []  # e.g., ["CAIS", "UEFA B"]
    is_global: bool = False
    assigned_user_ids: List[str] = []
    assigned_org_ids: List[str] = []
    template_data: Dict[str, Any] = {}


class AdminTemplateUpdate(BaseModel):
    """Update an admin template"""
    name: Optional[str] = None
    description: Optional[str] = None
    qualification_tags: Optional[List[str]] = None
    is_global: Optional[bool] = None
    is_bootstrap_default: Optional[bool] = None
    assigned_user_ids: Optional[List[str]] = None
    assigned_org_ids: Optional[List[str]] = None
    template_data: Optional[Dict[str, Any]] = None


class AssignTemplateRequest(BaseModel):
    """Assign template to users/orgs"""
    user_ids: List[str] = []
    org_ids: List[str] = []


# ============================================
# ADMIN TEMPLATE CRUD ENDPOINTS
# ============================================

@router.get("")
async def list_admin_templates(
    request: Request,
    category: Optional[str] = None
):
    """
    List all admin templates.
    Optionally filter by category: observation, coach_reflection, coach_developer_reflection
    """
    await require_admin(request)
    
    query = {"is_admin_template": True}
    if category:
        query["category"] = category
    
    templates = await db.admin_templates.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    return {"templates": templates, "count": len(templates)}


@router.get("/tags")
async def list_qualification_tags(request: Request):
    """
    List all unique qualification tags used across admin templates.
    """
    await require_admin(request)
    
    # Get all unique tags from admin templates
    pipeline = [
        {"$match": {"is_admin_template": True}},
        {"$unwind": "$qualification_tags"},
        {"$group": {"_id": "$qualification_tags"}},
        {"$sort": {"_id": 1}}
    ]
    
    result = await db.admin_templates.aggregate(pipeline).to_list(100)
    tags = [r["_id"] for r in result if r["_id"]]
    
    return {"tags": tags}


@router.get("/system-defaults")
async def list_system_default_templates(request: Request, category: Optional[str] = None):
    """
    List all system-created default templates across organizations.
    These are templates automatically created when new organizations are bootstrapped.
    Admin can view and potentially promote them to global admin templates.
    """
    await require_admin(request)
    
    # Query observation templates with is_default = true
    obs_query = {"is_default": True}
    if category == "observation" or not category:
        obs_templates = await db.observation_templates.find(
            obs_query, 
            {"_id": 0}
        ).sort("created_at", -1).to_list(500)
    else:
        obs_templates = []
    
    # Query reflection templates with is_default = true  
    ref_query = {"is_default": True}
    if category in ["coach_reflection", "coach_developer_reflection", None]:
        if category == "coach_reflection":
            ref_query["target_role"] = "coach"
        elif category == "coach_developer_reflection":
            ref_query["target_role"] = "coach_educator"
        ref_templates = await db.reflection_templates.find(
            ref_query,
            {"_id": 0}
        ).sort("created_at", -1).to_list(500)
    else:
        ref_templates = []
    
    # Format the response
    formatted_templates = []
    
    # Add observation templates
    for tpl in obs_templates:
        formatted_templates.append({
            "template_id": tpl.get("template_id"),
            "name": tpl.get("name"),
            "description": tpl.get("description"),
            "category": "observation",
            "observation_context": tpl.get("observation_context"),
            "is_default": True,
            "is_system_default": True,  # Mark as system-created
            "organization_id": tpl.get("organization_id"),
            "created_by": tpl.get("created_by"),
            "created_at": tpl.get("created_at"),
            "updated_at": tpl.get("updated_at"),
            "template_data": {
                "observationContext": tpl.get("observation_context"),
                "includeBallRolling": tpl.get("include_ball_rolling", True),
                "interventionTypes": tpl.get("intervention_types", []),
                "eventTypes": tpl.get("intervention_types", []),
                "descriptorGroup1": tpl.get("descriptor_group1"),
                "descriptorGroup2": tpl.get("descriptor_group2"),
                "sessionParts": tpl.get("session_parts", [])
            }
        })
    
    # Add reflection templates
    for tpl in ref_templates:
        cat = "coach_reflection" if tpl.get("target_role") == "coach" else "coach_developer_reflection"
        formatted_templates.append({
            "template_id": tpl.get("template_id"),
            "name": tpl.get("name"),
            "description": tpl.get("description"),
            "category": cat,
            "target_role": tpl.get("target_role"),
            "is_default": True,
            "is_system_default": True,
            "organization_id": tpl.get("organization_id"),
            "created_by": tpl.get("created_by"),
            "created_at": tpl.get("created_at"),
            "updated_at": tpl.get("updated_at"),
            "template_data": {
                "questions": tpl.get("questions", [])
            }
        })
    
    return {
        "templates": formatted_templates, 
        "count": len(formatted_templates),
        "note": "These are templates automatically created for organizations. To make a template globally available, create an Admin Template and mark it as Global."
    }


@router.get("/{template_id}")
async def get_admin_template(template_id: str, request: Request):
    """Get a specific admin template"""
    await require_admin(request)
    
    template = await db.admin_templates.find_one(
        {"template_id": template_id, "is_admin_template": True},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    return template


@router.post("")
async def create_admin_template(data: AdminTemplateCreate, request: Request):
    """
    Create a new admin template.
    """
    user = await require_admin(request)
    
    # Validate category
    valid_categories = ["observation", "coach_reflection", "coach_developer_reflection"]
    if data.category not in valid_categories:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
        )
    
    now = datetime.now(timezone.utc).isoformat()
    template_id = f"admin_tpl_{uuid.uuid4().hex[:12]}"
    
    template_doc = {
        "template_id": template_id,
        "is_admin_template": True,
        "category": data.category,
        "name": data.name,
        "description": data.description,
        "qualification_tags": data.qualification_tags,
        "is_global": data.is_global,
        "assigned_user_ids": data.assigned_user_ids,
        "assigned_org_ids": data.assigned_org_ids,
        "template_data": data.template_data,
        "created_by": user.user_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.admin_templates.insert_one(template_doc)
    
    logger.info(f"Admin template created: {template_id} ({data.name}) by {user.user_id}")
    
    # Remove _id before returning
    template_doc.pop("_id", None)
    return template_doc


@router.put("/{template_id}")
async def update_admin_template(template_id: str, data: AdminTemplateUpdate, request: Request):
    """
    Update an admin template.
    """
    user = await require_admin(request)
    
    # Check template exists
    existing = await db.admin_templates.find_one(
        {"template_id": template_id, "is_admin_template": True}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    # Build update document
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.qualification_tags is not None:
        update_data["qualification_tags"] = data.qualification_tags
    if data.is_global is not None:
        update_data["is_global"] = data.is_global
    if data.is_bootstrap_default is not None:
        update_data["is_bootstrap_default"] = data.is_bootstrap_default
    if data.assigned_user_ids is not None:
        update_data["assigned_user_ids"] = data.assigned_user_ids
    if data.assigned_org_ids is not None:
        update_data["assigned_org_ids"] = data.assigned_org_ids
    if data.template_data is not None:
        update_data["template_data"] = data.template_data
    
    await db.admin_templates.update_one(
        {"template_id": template_id},
        {"$set": update_data}
    )
    
    logger.info(f"Admin template updated: {template_id} by {user.user_id}")
    
    # Return updated template
    updated = await db.admin_templates.find_one(
        {"template_id": template_id},
        {"_id": 0}
    )
    return updated


@router.delete("/{template_id}")
async def delete_admin_template(template_id: str, request: Request):
    """
    Delete an admin template.
    Note: User overrides of this template will remain but lose their source reference.
    """
    user = await require_admin(request)
    
    # Check template exists
    existing = await db.admin_templates.find_one(
        {"template_id": template_id, "is_admin_template": True}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    await db.admin_templates.delete_one({"template_id": template_id})
    
    logger.info(f"Admin template deleted: {template_id} by {user.user_id}")
    
    return {"success": True, "deleted_template_id": template_id}


@router.post("/{template_id}/set-global")
async def set_template_global(template_id: str, request: Request):
    """
    Mark a template as global (appears for all users).
    """
    user = await require_admin(request)
    
    result = await db.admin_templates.update_one(
        {"template_id": template_id, "is_admin_template": True},
        {"$set": {"is_global": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    logger.info(f"Admin template set as global: {template_id} by {user.user_id}")
    
    return {"success": True, "template_id": template_id, "is_global": True}


@router.post("/{template_id}/unset-global")
async def unset_template_global(template_id: str, request: Request):
    """
    Remove global status from a template.
    """
    user = await require_admin(request)
    
    result = await db.admin_templates.update_one(
        {"template_id": template_id, "is_admin_template": True},
        {"$set": {"is_global": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    logger.info(f"Admin template removed from global: {template_id} by {user.user_id}")
    
    return {"success": True, "template_id": template_id, "is_global": False}


@router.post("/{template_id}/assign")
async def assign_template(template_id: str, data: AssignTemplateRequest, request: Request):
    """
    Assign a template to specific users and/or organizations.
    """
    user = await require_admin(request)
    
    # Check template exists
    existing = await db.admin_templates.find_one(
        {"template_id": template_id, "is_admin_template": True}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.user_ids:
        # Add to existing user IDs (don't replace)
        current_users = set(existing.get("assigned_user_ids", []))
        current_users.update(data.user_ids)
        update_data["assigned_user_ids"] = list(current_users)
    
    if data.org_ids:
        # Add to existing org IDs (don't replace)
        current_orgs = set(existing.get("assigned_org_ids", []))
        current_orgs.update(data.org_ids)
        update_data["assigned_org_ids"] = list(current_orgs)
    
    await db.admin_templates.update_one(
        {"template_id": template_id},
        {"$set": update_data}
    )
    
    logger.info(f"Admin template assigned: {template_id} to users={data.user_ids}, orgs={data.org_ids}")
    
    return {
        "success": True, 
        "template_id": template_id,
        "assigned_user_ids": update_data.get("assigned_user_ids", existing.get("assigned_user_ids", [])),
        "assigned_org_ids": update_data.get("assigned_org_ids", existing.get("assigned_org_ids", []))
    }


@router.post("/{template_id}/unassign")
async def unassign_template(template_id: str, data: AssignTemplateRequest, request: Request):
    """
    Remove template assignment from specific users and/or organizations.
    """
    user = await require_admin(request)
    
    # Check template exists
    existing = await db.admin_templates.find_one(
        {"template_id": template_id, "is_admin_template": True}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.user_ids:
        current_users = set(existing.get("assigned_user_ids", []))
        current_users -= set(data.user_ids)
        update_data["assigned_user_ids"] = list(current_users)
    
    if data.org_ids:
        current_orgs = set(existing.get("assigned_org_ids", []))
        current_orgs -= set(data.org_ids)
        update_data["assigned_org_ids"] = list(current_orgs)
    
    await db.admin_templates.update_one(
        {"template_id": template_id},
        {"$set": update_data}
    )
    
    logger.info(f"Admin template unassigned: {template_id} from users={data.user_ids}, orgs={data.org_ids}")
    
    return {
        "success": True, 
        "template_id": template_id,
        "assigned_user_ids": update_data.get("assigned_user_ids", []),
        "assigned_org_ids": update_data.get("assigned_org_ids", [])
    }


# ============================================
# USER OVERRIDE ENDPOINTS
# ============================================

@router.get("/user-overrides/{user_id}")
async def list_user_overrides(user_id: str, request: Request):
    """
    List all template overrides for a specific user (admin only).
    """
    await require_admin(request)
    
    overrides = await db.user_template_overrides.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"overrides": overrides, "count": len(overrides)}


# ============================================
# STATISTICS ENDPOINT
# ============================================

@router.get("/stats/summary")
async def get_template_stats(request: Request):
    """
    Get summary statistics for admin templates.
    """
    await require_admin(request)
    
    # Count by category
    pipeline = [
        {"$match": {"is_admin_template": True}},
        {"$group": {
            "_id": "$category",
            "total": {"$sum": 1},
            "global_count": {"$sum": {"$cond": ["$is_global", 1, 0]}},
            "bootstrap_count": {"$sum": {"$cond": ["$is_bootstrap_default", 1, 0]}}
        }}
    ]
    
    category_stats = await db.admin_templates.aggregate(pipeline).to_list(10)
    
    # Total templates
    total = await db.admin_templates.count_documents({"is_admin_template": True})
    
    # Total global
    total_global = await db.admin_templates.count_documents({"is_admin_template": True, "is_global": True})
    
    # Total bootstrap defaults
    total_bootstrap = await db.admin_templates.count_documents({"is_admin_template": True, "is_bootstrap_default": True})
    
    # User overrides count
    override_count = await db.user_template_overrides.count_documents({})
    
    return {
        "total_templates": total,
        "total_global": total_global,
        "total_bootstrap_defaults": total_bootstrap,
        "total_user_overrides": override_count,
        "by_category": {item["_id"]: {"total": item["total"], "global": item["global_count"], "bootstrap": item.get("bootstrap_count", 0)} for item in category_stats}
    }


# ============================================
# LIST ALL USERS/ORGS FOR ASSIGNMENT UI
# ============================================

@router.get("/assignable/users")
async def list_assignable_users(request: Request, search: Optional[str] = None):
    """
    List users that can be assigned templates.
    """
    await require_admin(request)
    
    query = {"role": {"$in": ["coach_developer", "coach"]}}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    users = await db.users.find(
        query,
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "organization_id": 1}
    ).limit(50).to_list(50)
    
    return {"users": users}


@router.get("/assignable/organizations")
async def list_assignable_organizations(request: Request, search: Optional[str] = None):
    """
    List organizations that can be assigned templates.
    """
    await require_admin(request)
    
    query = {}
    if search:
        query["club_name"] = {"$regex": search, "$options": "i"}
    
    orgs = await db.organizations.find(
        query,
        {"_id": 0, "org_id": 1, "club_name": 1, "owner_id": 1}
    ).limit(50).to_list(50)
    
    return {"organizations": orgs}
