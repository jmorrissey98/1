"""
Subscription and Entitlement Routes
===================================
Phase 1: New API endpoints for subscription management and entitlement resolution
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import logging

import sys
sys.path.insert(0, '/app/backend')

from database import db, logger
from dependencies import require_auth, require_coach_developer, require_admin
from subscription_config import (
    SUBSCRIPTION_TIERS,
    LEGACY_TIER_MAPPING,
    STRIPE_NEW_PRICE_IDS,
    resolve_organization_entitlements,
    check_observation_limit,
    get_all_coaches_observation_status,
    get_coach_observation_count,
    format_tier_for_display,
    get_tier_config,
    get_tier_limits,
    get_stripe_price_id,
    is_tier_stripe_ready,
    prepare_subscription_for_migration,
    apply_migration_fields,
    get_available_tiers_for_signup,
    get_tier_comparison
)

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


# Response Models
class TierLimitsResponse(BaseModel):
    max_coach_developers: int
    max_coaches: Optional[int] = None  # None = unlimited
    max_observations_per_coach: Optional[int] = None  # None = unlimited


class TierConfigResponse(BaseModel):
    tier_key: str
    name: str
    description: str
    limits: TierLimitsResponse
    pricing_monthly: int  # in pence
    pricing_annual: int   # in pence
    currency: str
    features: Dict[str, Any]


class EntitlementResponse(BaseModel):
    tier_key: str
    tier_name: str
    is_legacy: bool
    legacy_tier_key: Optional[str] = None
    limits: Dict[str, Any]
    features: Dict[str, Any]
    current_period_end: Optional[str] = None
    pending_tier_key: Optional[str] = None


class ObservationLimitCheckResponse(BaseModel):
    can_observe: bool
    current_count: int
    limit: Optional[int] = None  # None = unlimited
    is_unlimited: bool
    message: Optional[str] = None
    tier_key: str


class CoachObservationStatusResponse(BaseModel):
    coach_id: str
    current_count: int
    limit: Optional[int] = None
    is_unlimited: bool
    can_observe: bool
    display_text: str


# ============================================
# PUBLIC ENDPOINTS
# ============================================

@router.get("/tiers", response_model=List[TierConfigResponse])
async def get_subscription_tiers():
    """
    Get all available subscription tiers with their limits and pricing.
    Public endpoint for landing page and upgrade modals.
    """
    result = []
    
    for tier_key, config in SUBSCRIPTION_TIERS.items():
        result.append(TierConfigResponse(
            tier_key=tier_key,
            name=config["name"],
            description=config["description"],
            limits=TierLimitsResponse(
                max_coach_developers=config["limits"]["max_coach_developers"],
                max_coaches=config["limits"]["max_coaches"],
                max_observations_per_coach=config["limits"]["max_observations_per_coach"]
            ),
            pricing_monthly=config["pricing"]["monthly"],
            pricing_annual=config["pricing"]["annual"],
            currency=config["pricing"]["currency"],
            features=config["features"]
        ))
    
    return result


@router.get("/tiers/{tier_key}", response_model=TierConfigResponse)
async def get_tier_details(tier_key: str):
    """Get details for a specific subscription tier"""
    if tier_key not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=404, detail=f"Tier '{tier_key}' not found")
    
    config = SUBSCRIPTION_TIERS[tier_key]
    
    return TierConfigResponse(
        tier_key=tier_key,
        name=config["name"],
        description=config["description"],
        limits=TierLimitsResponse(
            max_coach_developers=config["limits"]["max_coach_developers"],
            max_coaches=config["limits"]["max_coaches"],
            max_observations_per_coach=config["limits"]["max_observations_per_coach"]
        ),
        pricing_monthly=config["pricing"]["monthly"],
        pricing_annual=config["pricing"]["annual"],
        currency=config["pricing"]["currency"],
        features=config["features"]
    )


@router.get("/tiers/{tier_key}/display")
async def get_tier_display_info(tier_key: str):
    """Get formatted tier information for UI display"""
    return format_tier_for_display(tier_key)


# ============================================
# AUTHENTICATED ENDPOINTS
# ============================================

@router.get("/entitlements", response_model=EntitlementResponse)
async def get_organization_entitlements(request: Request):
    """
    Get resolved entitlements for the current user's organization.
    Handles legacy tier protection and custom overrides.
    """
    user = await require_auth(request)
    
    # Get organization ID
    org_id = user.organization_id
    if not org_id:
        # Check if user owns an org
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    if not org_id:
        # Return default entitlements
        config = SUBSCRIPTION_TIERS["coach_developer"]
        return EntitlementResponse(
            tier_key="coach_developer",
            tier_name=config["name"],
            is_legacy=False,
            limits=config["limits"],
            features=config["features"]
        )
    
    entitlements = await resolve_organization_entitlements(db, org_id)
    
    return EntitlementResponse(
        tier_key=entitlements["tier_key"],
        tier_name=entitlements["tier_name"],
        is_legacy=entitlements["is_legacy"],
        legacy_tier_key=entitlements.get("legacy_tier_key"),
        limits=entitlements["limits"],
        features=entitlements["features"],
        current_period_end=entitlements["current_period_end"].isoformat() if entitlements.get("current_period_end") else None,
        pending_tier_key=entitlements.get("pending_tier_key")
    )


@router.get("/limits")
async def get_organization_limits(request: Request):
    """
    Get current limits and usage for the organization.
    Combines entitlements with actual usage counts.
    """
    user = await require_auth(request)
    
    # Get organization ID
    org_id = user.organization_id
    if not org_id:
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    if not org_id:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Get entitlements
    entitlements = await resolve_organization_entitlements(db, org_id)
    limits = entitlements["limits"]
    
    # Get current counts
    # Count coach developers in this org
    current_coach_developers = await db.users.count_documents({
        "organization_id": org_id,
        "role": "coach_developer"
    })
    
    # Also count the owner if they're a coach developer
    owner_org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if owner_org:
        owner = await db.users.find_one({"user_id": owner_org.get("owner_id")}, {"_id": 0})
        if owner and owner.get("role") == "coach_developer":
            # Check if already counted
            if owner.get("organization_id") != org_id:
                current_coach_developers += 1
    
    # Count coaches (coach profiles, not user accounts with coach role)
    current_coaches = await db.coaches.count_documents({
        "organization_id": org_id
    })
    
    # Also count coach users if coach profiles don't have org_id
    if current_coaches == 0:
        current_coaches = await db.users.count_documents({
            "organization_id": org_id,
            "role": "coach"
        })
    
    return {
        "tier_key": entitlements["tier_key"],
        "tier_name": entitlements["tier_name"],
        "is_legacy": entitlements["is_legacy"],
        "coach_developers": {
            "current": current_coach_developers,
            "limit": limits["max_coach_developers"],
            "can_add": current_coach_developers < limits["max_coach_developers"],
            "is_unlimited": False  # Coach developers always have a limit
        },
        "coaches": {
            "current": current_coaches,
            "limit": limits["max_coaches"],
            "can_add": limits["max_coaches"] is None or current_coaches < limits["max_coaches"],
            "is_unlimited": limits["max_coaches"] is None
        },
        "observations_per_coach": {
            "limit": limits["max_observations_per_coach"],
            "is_unlimited": limits["max_observations_per_coach"] is None
        },
        "features": entitlements["features"]
    }


@router.get("/observation-limit/{coach_id}", response_model=ObservationLimitCheckResponse)
async def check_coach_observation_limit(coach_id: str, request: Request):
    """
    Check if an observation can be created for a specific coach.
    Returns current count, limit, and whether observation is allowed.
    """
    user = await require_auth(request)
    
    # Get organization ID
    org_id = user.organization_id
    if not org_id:
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    if not org_id:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    result = await check_observation_limit(db, org_id, coach_id)
    
    return ObservationLimitCheckResponse(**result)


@router.post("/observation-limit/batch")
async def check_coaches_observation_limits(request: Request):
    """
    Check observation limits for multiple coaches at once.
    Used in coach selection UI to show which coaches are at their limit.
    
    Request body: { "coach_ids": ["coach_1", "coach_2", ...] }
    """
    user = await require_auth(request)
    
    body = await request.json()
    coach_ids = body.get("coach_ids", [])
    
    if not coach_ids:
        return {}
    
    # Get organization ID
    org_id = user.organization_id
    if not org_id:
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    if not org_id:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    result = await get_all_coaches_observation_status(db, org_id, coach_ids)
    
    return result


@router.get("/coach/{coach_id}/observation-count")
async def get_coach_observations_count(coach_id: str, request: Request):
    """
    Get the number of observations recorded for a specific coach.
    """
    await require_auth(request)
    
    count = await get_coach_observation_count(db, coach_id)
    
    return {
        "coach_id": coach_id,
        "observation_count": count
    }


# ============================================
# ADMIN ENDPOINTS
# ============================================

@router.get("/admin/tiers")
async def admin_get_all_tiers(request: Request):
    """
    Get all subscription tiers including legacy mapping (Admin only).
    """
    await require_admin(request)
    
    return {
        "current_tiers": SUBSCRIPTION_TIERS,
        "legacy_mapping": LEGACY_TIER_MAPPING
    }


@router.get("/admin/organization/{org_id}/entitlements")
async def admin_get_org_entitlements(org_id: str, request: Request):
    """
    Get resolved entitlements for a specific organization (Admin only).
    """
    await require_admin(request)
    
    entitlements = await resolve_organization_entitlements(db, org_id)
    
    # Get additional org info
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    subscription = await db.subscriptions.find_one(
        {"$or": [{"org_id": org_id}, {"organization_id": org_id}]},
        {"_id": 0}
    )
    custom_limits = await db.organization_custom_limits.find_one(
        {"org_id": org_id},
        {"_id": 0}
    )
    
    return {
        "entitlements": entitlements,
        "organization": org,
        "subscription": subscription,
        "custom_limits": custom_limits
    }


class AdminSetOrgTierRequest(BaseModel):
    tier_key: str
    immediate: bool = False  # If true, changes tier immediately (bypass billing period)


@router.put("/admin/organization/{org_id}/tier")
async def admin_set_org_tier(org_id: str, data: AdminSetOrgTierRequest, request: Request):
    """
    Manually set an organization's subscription tier (Admin only).
    Can optionally bypass the billing period protection.
    """
    await require_admin(request)
    
    # Validate tier key
    if data.tier_key not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=400, detail=f"Invalid tier key: {data.tier_key}")
    
    # Get tier config
    tier_config = SUBSCRIPTION_TIERS[data.tier_key]
    
    now = datetime.now(timezone.utc)
    
    # Update subscription record
    subscription = await db.subscriptions.find_one(
        {"$or": [{"org_id": org_id}, {"organization_id": org_id}]},
        {"_id": 0}
    )
    
    update_data = {
        "updated_at": now.isoformat(),
        "tier_updated_by": "admin_manual"
    }
    
    if data.immediate:
        # Immediate change - no legacy protection
        update_data["current_tier_key"] = data.tier_key
        update_data["is_legacy_tier"] = False
        update_data["legacy_tier_key"] = None
        update_data["pending_tier_key"] = None
        
        # Update limits
        update_data["coaches_limit"] = tier_config["limits"]["max_coaches"]
        update_data["admins_limit"] = tier_config["limits"]["max_coach_developers"]
    else:
        # Set as pending tier (will apply at period end)
        update_data["pending_tier_key"] = data.tier_key
    
    if subscription:
        await db.subscriptions.update_one(
            {"$or": [{"org_id": org_id}, {"organization_id": org_id}]},
            {"$set": update_data}
        )
    else:
        # Create new subscription record
        new_sub = {
            "organization_id": org_id,
            "org_id": org_id,
            "current_tier_key": data.tier_key if data.immediate else None,
            "pending_tier_key": None if data.immediate else data.tier_key,
            "is_legacy_tier": False,
            "status": "active",
            "created_at": now.isoformat(),
            **update_data
        }
        await db.subscriptions.insert_one(new_sub)
    
    # Also update organization document
    await db.organizations.update_one(
        {"org_id": org_id},
        {"$set": {
            "subscription_tier_id": data.tier_key if data.immediate else None,
            "tier_updated_at": now.isoformat()
        }}
    )
    
    # Log the change
    logger.info(f"Admin changed org {org_id} tier to {data.tier_key} (immediate={data.immediate})")
    
    return {
        "success": True,
        "message": f"Organization tier {'changed to' if data.immediate else 'will change to'} {data.tier_key}",
        "org_id": org_id,
        "new_tier": data.tier_key,
        "immediate": data.immediate
    }


class AdminSetOrgLimitsRequest(BaseModel):
    max_coach_developers: Optional[int] = None
    max_coaches: Optional[int] = None  # 0 = unlimited
    max_observations_per_coach: Optional[int] = None  # 0 = unlimited
    data_retention_months: Optional[int] = None  # 0 = unlimited


@router.put("/admin/organization/{org_id}/limits")
async def admin_set_org_limits(org_id: str, data: AdminSetOrgLimitsRequest, request: Request):
    """
    Set custom limit overrides for an organization (Admin only).
    These override the tier defaults.
    """
    await require_admin(request)
    
    now = datetime.now(timezone.utc)
    
    # Build update document
    update_data = {
        "org_id": org_id,
        "updated_at": now.isoformat()
    }
    
    if data.max_coach_developers is not None:
        update_data["max_coach_developers"] = data.max_coach_developers
    if data.max_coaches is not None:
        update_data["max_coaches"] = None if data.max_coaches == 0 else data.max_coaches
    if data.max_observations_per_coach is not None:
        update_data["max_observations_per_coach"] = None if data.max_observations_per_coach == 0 else data.max_observations_per_coach
    if data.data_retention_months is not None:
        update_data["data_retention_months"] = None if data.data_retention_months == 0 else data.data_retention_months
    
    # Upsert custom limits
    await db.organization_custom_limits.update_one(
        {"org_id": org_id},
        {"$set": update_data},
        upsert=True
    )
    
    logger.info(f"Admin set custom limits for org {org_id}: {data}")
    
    return {
        "success": True,
        "message": "Custom limits updated",
        "org_id": org_id,
        "limits": update_data
    }


@router.delete("/admin/organization/{org_id}/limits")
async def admin_clear_org_limits(org_id: str, request: Request):
    """
    Clear custom limit overrides for an organization (Admin only).
    Organization will use tier defaults.
    """
    await require_admin(request)
    
    result = await db.organization_custom_limits.delete_one({"org_id": org_id})
    
    return {
        "success": True,
        "message": "Custom limits cleared" if result.deleted_count > 0 else "No custom limits found",
        "org_id": org_id
    }


# ============================================
# DEBUG ENDPOINTS (Admin only)
# ============================================

@router.get("/admin/debug/{org_id}")
async def admin_debug_org_subscription(org_id: str, request: Request):
    """
    Debug endpoint showing full subscription state for an organization (Admin only).
    """
    await require_admin(request)
    
    # Get all related documents
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    subscription = await db.subscriptions.find_one(
        {"$or": [{"org_id": org_id}, {"organization_id": org_id}]},
        {"_id": 0}
    )
    custom_limits = await db.organization_custom_limits.find_one(
        {"org_id": org_id},
        {"_id": 0}
    )
    
    # Get user counts
    coach_developer_count = await db.users.count_documents({
        "organization_id": org_id,
        "role": "coach_developer"
    })
    coach_count = await db.coaches.count_documents({"organization_id": org_id})
    user_coach_count = await db.users.count_documents({
        "organization_id": org_id,
        "role": "coach"
    })
    
    # Resolve entitlements
    entitlements = await resolve_organization_entitlements(db, org_id)
    
    return {
        "org_id": org_id,
        "organization_document": org,
        "subscription_document": subscription,
        "custom_limits_document": custom_limits,
        "resolved_entitlements": entitlements,
        "current_usage": {
            "coach_developers": coach_developer_count,
            "coach_profiles": coach_count,
            "coach_users": user_coach_count
        },
        "tier_config": SUBSCRIPTION_TIERS.get(entitlements["tier_key"])
    }


# ============================================
# PHASE 2: STRIPE MAPPING & MIGRATION ENDPOINTS
# ============================================

@router.get("/stripe/config")
async def get_stripe_configuration():
    """
    Get current Stripe price configuration for all tiers.
    Public endpoint for debugging and admin verification.
    Shows which tiers are ready for Stripe checkout.
    """
    config = {}
    
    for tier_key in SUBSCRIPTION_TIERS.keys():
        stripe_config = STRIPE_NEW_PRICE_IDS.get(tier_key, {})
        config[tier_key] = {
            "product_name": stripe_config.get("product_name", tier_key),
            "monthly": {
                "price_id": stripe_config.get("monthly", {}).get("price_id"),
                "amount": stripe_config.get("monthly", {}).get("amount"),
                "configured": stripe_config.get("monthly", {}).get("price_id") is not None
            },
            "annual": {
                "price_id": stripe_config.get("annual", {}).get("price_id"),
                "amount": stripe_config.get("annual", {}).get("amount"),
                "configured": stripe_config.get("annual", {}).get("price_id") is not None
            },
            "stripe_ready": is_tier_stripe_ready(tier_key)
        }
    
    return {
        "tiers": config,
        "legacy_mapping": LEGACY_TIER_MAPPING
    }


@router.get("/available-tiers")
async def get_available_subscription_tiers():
    """
    Get tiers available for new signups and upgrades.
    Excludes legacy tiers and shows Stripe readiness status.
    """
    return get_available_tiers_for_signup()


@router.get("/pricing-comparison")
async def get_pricing_comparison():
    """
    Get tier comparison data for pricing pages.
    Returns ordered list of tiers with all pricing and feature info.
    """
    return {
        "tiers": get_tier_comparison(),
        "currency": "gbp",
        "annual_discount_text": "2 months free with annual billing"
    }


@router.get("/migration/check/{org_id}")
async def check_migration_status(org_id: str, request: Request):
    """
    Check if an organization needs migration to the new tier system.
    Admin only - used for migration planning.
    """
    await require_admin(request)
    
    migration_data = await prepare_subscription_for_migration(db, org_id)
    
    return {
        "org_id": org_id,
        "migration_status": migration_data
    }


class ApplyMigrationRequest(BaseModel):
    current_period_end: Optional[str] = None  # ISO format datetime


@router.post("/migration/apply/{org_id}")
async def apply_migration(org_id: str, data: ApplyMigrationRequest, request: Request):
    """
    Apply migration fields to a subscription.
    Admin only - call after verifying the migration plan.
    """
    await require_admin(request)
    
    # First check current state
    migration_data = await prepare_subscription_for_migration(db, org_id)
    
    if not migration_data.get("needs_migration", True):
        return {
            "success": False,
            "message": "Organization already has migration fields applied",
            "current_state": migration_data
        }
    
    # Parse period end if provided
    period_end = None
    if data.current_period_end:
        try:
            period_end = datetime.fromisoformat(data.current_period_end.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid datetime format for current_period_end")
    
    # Apply migration
    success = await apply_migration_fields(db, org_id, migration_data, period_end)
    
    if success:
        logger.info(f"Applied migration fields to org {org_id}")
        
        # Fetch updated subscription
        updated_sub = await db.subscriptions.find_one(
            {"$or": [{"org_id": org_id}, {"organization_id": org_id}]},
            {"_id": 0}
        )
        
        return {
            "success": True,
            "message": "Migration fields applied successfully",
            "updated_subscription": updated_sub
        }
    else:
        return {
            "success": False,
            "message": "Failed to apply migration - subscription not found"
        }


@router.get("/migration/bulk-status")
async def get_bulk_migration_status(request: Request):
    """
    Get migration status for all organizations.
    Admin only - used for migration dashboard.
    """
    await require_admin(request)
    
    # Get all subscriptions
    subscriptions = await db.subscriptions.find({}, {"_id": 0}).to_list(1000)
    
    results = {
        "total": len(subscriptions),
        "already_migrated": 0,
        "needs_migration": 0,
        "legacy_individual": 0,
        "legacy_developer": 0,
        "legacy_club": 0,
        "organizations": []
    }
    
    for sub in subscriptions:
        org_id = sub.get("org_id") or sub.get("organization_id")
        if not org_id:
            continue
        
        # Check migration status
        has_migration = sub.get("current_tier_key") is not None
        old_tier = sub.get("tier_id") or sub.get("tier")
        
        org_status = {
            "org_id": org_id,
            "has_migration_fields": has_migration,
            "old_tier": old_tier,
            "stripe_subscription_id": sub.get("subscription_id"),
            "status": sub.get("status")
        }
        
        if has_migration:
            results["already_migrated"] += 1
            org_status["current_tier_key"] = sub.get("current_tier_key")
            org_status["is_legacy"] = sub.get("is_legacy_tier", False)
        else:
            results["needs_migration"] += 1
            if old_tier == "individual":
                results["legacy_individual"] += 1
            elif old_tier == "developer":
                results["legacy_developer"] += 1
            elif old_tier == "club":
                results["legacy_club"] += 1
        
        results["organizations"].append(org_status)
    
    return results


class SetStripePriceRequest(BaseModel):
    tier_key: str
    billing_period: str  # "monthly" or "annual"
    price_id: str


@router.put("/admin/stripe/price")
async def admin_set_stripe_price(data: SetStripePriceRequest, request: Request):
    """
    Set a Stripe price ID for a tier.
    Admin only - used to configure new tier pricing after creating in Stripe Dashboard.
    
    Note: This updates the in-memory config. For production, these should be
    stored in the database or environment variables.
    """
    await require_admin(request)
    
    # Validate tier
    if data.tier_key not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {data.tier_key}")
    
    # Validate billing period
    if data.billing_period not in ["monthly", "annual"]:
        raise HTTPException(status_code=400, detail="Billing period must be 'monthly' or 'annual'")
    
    # Update config (in-memory only for now)
    if data.tier_key not in STRIPE_NEW_PRICE_IDS:
        STRIPE_NEW_PRICE_IDS[data.tier_key] = {"monthly": {}, "annual": {}}
    
    STRIPE_NEW_PRICE_IDS[data.tier_key][data.billing_period]["price_id"] = data.price_id
    
    logger.info(f"Admin set Stripe price for {data.tier_key} {data.billing_period}: {data.price_id}")
    
    # Also store in database for persistence
    await db.stripe_config.update_one(
        {"tier_key": data.tier_key, "billing_period": data.billing_period},
        {"$set": {
            "tier_key": data.tier_key,
            "billing_period": data.billing_period,
            "price_id": data.price_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "message": f"Stripe price ID set for {data.tier_key} ({data.billing_period})",
        "tier_key": data.tier_key,
        "billing_period": data.billing_period,
        "price_id": data.price_id,
        "tier_now_ready": is_tier_stripe_ready(data.tier_key)
    }
