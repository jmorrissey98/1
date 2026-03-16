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


@router.post("/migrate-system-defaults")
async def migrate_system_defaults_to_admin(request: Request):
    """
    Migrate and deduplicate system defaults into admin templates.
    
    This endpoint:
    1. Finds all unique template names from observation_templates and reflection_templates
    2. Creates ONE admin template for each unique name (picks the first/oldest one as source)
    3. Marks them as global (so they're visible to all current users)
    4. Marks them as bootstrap_default (so new orgs will get them)
    5. Returns a summary of what was created
    
    After running this, the bootstrap_default_templates() function will use
    admin templates instead of creating copies for each new org.
    """
    user = await require_admin(request)
    
    now = datetime.now(timezone.utc).isoformat()
    created_templates = []
    skipped_templates = []
    
    # Get existing admin template names to avoid duplicates
    existing_admin_templates = await db.admin_templates.find(
        {"is_admin_template": True},
        {"name": 1, "category": 1, "_id": 0}
    ).to_list(100)
    existing_names = {(t["name"], t["category"]) for t in existing_admin_templates}
    
    # Process observation templates - group by name and pick one
    obs_pipeline = [
        {"$match": {"is_default": True}},
        {"$sort": {"created_at": 1}},  # Oldest first
        {"$group": {
            "_id": "$name",
            "first_template": {"$first": "$$ROOT"},
            "count": {"$sum": 1}
        }}
    ]
    
    obs_groups = await db.observation_templates.aggregate(obs_pipeline).to_list(50)
    
    for group in obs_groups:
        template = group["first_template"]
        name = template.get("name")
        
        if (name, "observation") in existing_names:
            skipped_templates.append({"name": name, "category": "observation", "reason": "Already exists as admin template"})
            continue
        
        # Create admin template
        admin_template = {
            "template_id": f"admin_tpl_{uuid.uuid4().hex[:12]}",
            "is_admin_template": True,
            "category": "observation",
            "name": name,
            "description": template.get("description", ""),
            "qualification_tags": [],
            "is_global": True,
            "is_bootstrap_default": True,
            "assigned_user_ids": [],
            "assigned_org_ids": [],
            "template_data": {
                "observationContext": template.get("observation_context", "training"),
                "includeBallRolling": template.get("include_ball_rolling", True),
                "interventionTypes": template.get("intervention_types", []),
                "descriptorGroup1": template.get("descriptor_group1", []),
                "descriptorGroup2": template.get("descriptor_group2", []),
                "sessionParts": template.get("session_parts", [])
            },
            "created_by": user.user_id,
            "migrated_from": template.get("template_id"),
            "created_at": now,
            "updated_at": now
        }
        
        await db.admin_templates.insert_one(admin_template)
        created_templates.append({
            "name": name, 
            "category": "observation", 
            "template_id": admin_template["template_id"],
            "duplicates_found": group["count"]
        })
    
    # Process reflection templates - group by name and target_role
    ref_pipeline = [
        {"$match": {"is_default": True}},
        {"$sort": {"created_at": 1}},
        {"$group": {
            "_id": {"name": "$name", "target_role": "$target_role"},
            "first_template": {"$first": "$$ROOT"},
            "count": {"$sum": 1}
        }}
    ]
    
    ref_groups = await db.reflection_templates.aggregate(ref_pipeline).to_list(50)
    
    for group in ref_groups:
        template = group["first_template"]
        name = template.get("name")
        target_role = template.get("target_role", "coach")
        
        # Determine category based on target_role
        category = "coach_reflection" if target_role == "coach" else "coach_developer_reflection"
        
        if (name, category) in existing_names:
            skipped_templates.append({"name": name, "category": category, "reason": "Already exists as admin template"})
            continue
        
        # Create admin template
        admin_template = {
            "template_id": f"admin_tpl_{uuid.uuid4().hex[:12]}",
            "is_admin_template": True,
            "category": category,
            "name": name,
            "description": template.get("description", ""),
            "qualification_tags": [],
            "is_global": True,
            "is_bootstrap_default": True,
            "assigned_user_ids": [],
            "assigned_org_ids": [],
            "template_data": {
                "targetRole": target_role,
                "questions": template.get("questions", [])
            },
            "created_by": user.user_id,
            "migrated_from": template.get("template_id"),
            "created_at": now,
            "updated_at": now
        }
        
        await db.admin_templates.insert_one(admin_template)
        created_templates.append({
            "name": name, 
            "category": category,
            "template_id": admin_template["template_id"],
            "duplicates_found": group["count"]
        })
    
    logger.info(f"Migration completed by {user.user_id}: created {len(created_templates)} admin templates")
    
    return {
        "success": True,
        "created": created_templates,
        "skipped": skipped_templates,
        "summary": {
            "total_created": len(created_templates),
            "total_skipped": len(skipped_templates)
        },
        "next_steps": "New organizations will now see these global templates. Use the cleanup endpoint to remove duplicates."
    }


@router.post("/cleanup-duplicates")
async def cleanup_duplicate_org_templates(request: Request, dry_run: bool = True):
    """
    Clean up duplicate organization templates after migration.
    
    This endpoint removes templates from observation_templates and reflection_templates
    that have been migrated to admin_templates (matching by name).
    
    Parameters:
    - dry_run: If True (default), only shows what would be deleted without actually deleting.
               Set to False to perform the actual deletion.
    
    Safety: Only deletes templates marked as is_default=True that have a matching
    global admin template. Custom templates created by organizations are preserved.
    """
    user = await require_admin(request)
    
    cleanup_results = {
        "observation_templates": {"would_delete": 0, "deleted": 0, "templates": []},
        "reflection_templates": {"would_delete": 0, "deleted": 0, "templates": []}
    }
    
    # Get all global admin template names by category
    admin_templates = await db.admin_templates.find(
        {"is_admin_template": True, "is_global": True},
        {"name": 1, "category": 1, "_id": 0}
    ).to_list(100)
    
    obs_admin_names = {t["name"] for t in admin_templates if t["category"] == "observation"}
    ref_admin_names = {t["name"] for t in admin_templates if t["category"] in ["coach_reflection", "coach_developer_reflection"]}
    
    # Find observation templates to delete (is_default=True and name matches admin template)
    obs_to_delete = await db.observation_templates.find(
        {"is_default": True, "name": {"$in": list(obs_admin_names)}},
        {"_id": 1, "template_id": 1, "name": 1, "organization_id": 1}
    ).to_list(1000)
    
    cleanup_results["observation_templates"]["would_delete"] = len(obs_to_delete)
    cleanup_results["observation_templates"]["templates"] = [
        {"name": t["name"], "org_id": t.get("organization_id", "unknown")[:12] + "..."}
        for t in obs_to_delete[:10]  # Show first 10
    ]
    if len(obs_to_delete) > 10:
        cleanup_results["observation_templates"]["templates"].append(
            {"note": f"... and {len(obs_to_delete) - 10} more"}
        )
    
    # Find reflection templates to delete
    ref_to_delete = await db.reflection_templates.find(
        {"is_default": True, "name": {"$in": list(ref_admin_names)}},
        {"_id": 1, "template_id": 1, "name": 1, "organization_id": 1}
    ).to_list(1000)
    
    cleanup_results["reflection_templates"]["would_delete"] = len(ref_to_delete)
    cleanup_results["reflection_templates"]["templates"] = [
        {"name": t["name"], "org_id": t.get("organization_id", "unknown")[:12] + "..."}
        for t in ref_to_delete[:10]
    ]
    if len(ref_to_delete) > 10:
        cleanup_results["reflection_templates"]["templates"].append(
            {"note": f"... and {len(ref_to_delete) - 10} more"}
        )
    
    if not dry_run:
        # Actually delete the templates
        if obs_to_delete:
            obs_ids = [t["_id"] for t in obs_to_delete]
            result = await db.observation_templates.delete_many({"_id": {"$in": obs_ids}})
            cleanup_results["observation_templates"]["deleted"] = result.deleted_count
        
        if ref_to_delete:
            ref_ids = [t["_id"] for t in ref_to_delete]
            result = await db.reflection_templates.delete_many({"_id": {"$in": ref_ids}})
            cleanup_results["reflection_templates"]["deleted"] = result.deleted_count
        
        logger.info(f"Cleanup completed by {user.user_id}: deleted {cleanup_results['observation_templates']['deleted']} obs templates, {cleanup_results['reflection_templates']['deleted']} ref templates")
    
    total_would_delete = cleanup_results["observation_templates"]["would_delete"] + cleanup_results["reflection_templates"]["would_delete"]
    total_deleted = cleanup_results["observation_templates"]["deleted"] + cleanup_results["reflection_templates"]["deleted"]
    
    return {
        "success": True,
        "dry_run": dry_run,
        "summary": {
            "total_would_delete": total_would_delete,
            "total_deleted": total_deleted if not dry_run else 0
        },
        "details": cleanup_results,
        "message": "Dry run complete. Set dry_run=false to actually delete." if dry_run else f"Cleanup complete. Deleted {total_deleted} duplicate templates."
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
    Also automatically sets is_bootstrap_default=True so new organizations get this template.
    """
    user = await require_admin(request)
    
    result = await db.admin_templates.update_one(
        {"template_id": template_id, "is_admin_template": True},
        {"$set": {
            "is_global": True, 
            "is_bootstrap_default": True,  # Global templates are always bootstrap defaults
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    logger.info(f"Admin template set as global (and bootstrap default): {template_id} by {user.user_id}")
    
    return {"success": True, "template_id": template_id, "is_global": True, "is_bootstrap_default": True}


@router.post("/{template_id}/unset-global")
async def unset_template_global(template_id: str, request: Request):
    """
    Remove global status from a template.
    Also removes bootstrap default status.
    """
    user = await require_admin(request)
    
    result = await db.admin_templates.update_one(
        {"template_id": template_id, "is_admin_template": True},
        {"$set": {
            "is_global": False, 
            "is_bootstrap_default": False,  # Non-global templates are not bootstrap defaults
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    logger.info(f"Admin template removed from global (and bootstrap default): {template_id} by {user.user_id}")
    
    return {"success": True, "template_id": template_id, "is_global": False, "is_bootstrap_default": False}


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
