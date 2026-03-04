"""
Subscription Configuration and Entitlement System
================================================
Phase 1: New subscription tiers and entitlement resolution
Phase 2: Stripe plan mapping and migration fields

Tier Keys:
- individual_coach: Single user who analyses their own coaching
- coach_developer: Single coach developer working with multiple coaches  
- club: Full organization with multiple coach developers and coaches

Role Behaviour Change:
- Coach developers can now also be observed (not just observers)
- Coach developers appear in observation target lists
- My Development tab visible to both coaches AND coach developers who have been observed

Migration Fields (stored on subscription documents):
- current_tier_key: The active tier key
- is_legacy_tier: Whether this is a legacy subscription
- legacy_tier_key: Original tier key if migrated
- current_period_end: When the current billing period ends
- pending_tier_key: Tier to switch to after period ends
"""

from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timezone
from enum import Enum


class SubscriptionTier(str, Enum):
    """New subscription tier keys"""
    INDIVIDUAL_COACH = "individual_coach"
    COACH_DEVELOPER = "coach_developer"
    CLUB = "club"
    # Legacy tiers (for migration)
    LEGACY_INDIVIDUAL = "individual"
    LEGACY_DEVELOPER = "developer"
    LEGACY_CLUB = "legacy_club"


# ============================================
# STRIPE PRICE CONFIGURATION (Phase 2)
# ============================================
# Price IDs will be added by admin after creating products in Stripe Dashboard
# Use placeholder values until real price IDs are configured
#
# To set up in Stripe:
# 1. Create "Individual Coach" product with monthly (£6) and annual (£60) prices
# 2. Create "Coach Developer" product with monthly (£10) and annual (£100) prices
# 3. Copy the price_XXX IDs here
# 4. Club tier keeps existing price IDs

STRIPE_NEW_PRICE_IDS = {
    "individual_coach": {
        "product_name": "Individual Coach",
        "monthly": {
            "price_id": None,  # TODO: Add after creating in Stripe
            "amount": 600,     # £6.00 in pence
        },
        "annual": {
            "price_id": None,  # TODO: Add after creating in Stripe
            "amount": 6000,    # £60.00 in pence
        }
    },
    "coach_developer": {
        "product_name": "Coach Developer",
        "monthly": {
            "price_id": None,  # TODO: Add after creating in Stripe
            "amount": 1000,    # £10.00 in pence
        },
        "annual": {
            "price_id": None,  # TODO: Add after creating in Stripe
            "amount": 10000,   # £100.00 in pence
        }
    },
    "club": {
        "product_name": "Club",
        "monthly": {
            # Existing price ID from server.py STRIPE_PRODUCTS["club"]
            "price_id": "price_1T3yMN0YRwRcrAVx7HCM1cI9",
            "amount": 6000,    # £60.00 in pence
        },
        "annual": {
            "price_id": "price_1T4jkp0YRwRcrAVxAkntx6Q4",
            "amount": 60000,   # £600.00 in pence
        }
    }
}

# Mapping from legacy tier IDs to new Stripe prices
# Used during checkout to determine which price to use
LEGACY_TO_NEW_STRIPE = {
    "individual": "coach_developer",   # Old Individual -> Coach Developer pricing
    "developer": "coach_developer",    # Old Developer -> Coach Developer pricing
    "club": "club",                    # Club pricing unchanged
}


def get_stripe_price_id(tier_key: str, billing_period: str) -> Optional[str]:
    """
    Get the Stripe price ID for a tier and billing period.
    Returns None if the price ID hasn't been configured yet.
    """
    tier_config = STRIPE_NEW_PRICE_IDS.get(tier_key, {})
    period_config = tier_config.get(billing_period, {})
    return period_config.get("price_id")


def is_tier_stripe_ready(tier_key: str) -> bool:
    """Check if a tier has all required Stripe price IDs configured."""
    tier_config = STRIPE_NEW_PRICE_IDS.get(tier_key, {})
    monthly_id = tier_config.get("monthly", {}).get("price_id")
    annual_id = tier_config.get("annual", {}).get("price_id")
    return monthly_id is not None and annual_id is not None


# New subscription tier configuration
SUBSCRIPTION_TIERS = {
    "individual_coach": {
        "name": "Individual Coach",
        "description": "For a single user who wants to analyse their own coaching",
        "limits": {
            "max_coach_developers": 1,
            "max_coaches": 0,  # No additional coaches - self-observation only
            "max_observations_per_coach": None,  # Unlimited
        },
        "pricing": {
            "monthly": 600,   # £6.00 in pence
            "annual": 6000,   # £60.00 in pence
            "currency": "gbp"
        },
        "features": {
            "self_observation": True,
            "history_access": "unlimited",  # Full history access
            "data_retention_months": None,  # Unlimited
        }
    },
    "coach_developer": {
        "name": "Coach Developer",
        "description": "For a single coach developer working with multiple coaches",
        "limits": {
            "max_coach_developers": 1,
            "max_coaches": None,  # Unlimited coaches
            "max_observations_per_coach": 10,  # 10 observations per coach
        },
        "pricing": {
            "monthly": 1000,  # £10.00 in pence
            "annual": 10000,  # £100.00 in pence
            "currency": "gbp"
        },
        "features": {
            "self_observation": False,
            "history_access": "unlimited",
            "data_retention_months": None,
        }
    },
    "club": {
        "name": "Club",
        "description": "For organizations with multiple coach developers",
        "limits": {
            "max_coach_developers": 5,
            "max_coaches": 30,
            "max_observations_per_coach": None,  # Unlimited
        },
        "pricing": {
            "monthly": 6000,  # £60.00 in pence (unchanged)
            "annual": 60000,  # £600.00 in pence
            "currency": "gbp"
        },
        "features": {
            "self_observation": False,
            "history_access": "unlimited",
            "data_retention_months": None,
        }
    }
}


# Legacy tier mapping for migration
LEGACY_TIER_MAPPING = {
    "individual": "coach_developer",   # Old Individual -> Coach Developer
    "developer": "coach_developer",    # Old Developer -> Coach Developer
    "club": "club",                    # Club -> Club (unchanged)
    "free": "coach_developer",         # Free/trial -> Coach Developer
}


def get_tier_config(tier_key: str) -> Dict[str, Any]:
    """
    Get the configuration for a subscription tier.
    Falls back to coach_developer tier if tier not found.
    """
    # Normalize tier key
    tier_key_lower = tier_key.lower() if tier_key else "coach_developer"
    
    # Check if it's a legacy tier that needs mapping
    if tier_key_lower in LEGACY_TIER_MAPPING:
        tier_key_lower = LEGACY_TIER_MAPPING[tier_key_lower]
    
    return SUBSCRIPTION_TIERS.get(tier_key_lower, SUBSCRIPTION_TIERS["coach_developer"])


def get_tier_limits(tier_key: str) -> Dict[str, Any]:
    """Get just the limits for a tier"""
    config = get_tier_config(tier_key)
    return config.get("limits", {})


def get_max_observations_per_coach(tier_key: str) -> Optional[int]:
    """
    Get the maximum observations allowed per coach for a tier.
    Returns None for unlimited.
    """
    limits = get_tier_limits(tier_key)
    return limits.get("max_observations_per_coach")


def is_observation_limit_unlimited(tier_key: str) -> bool:
    """Check if tier has unlimited observations per coach"""
    return get_max_observations_per_coach(tier_key) is None


async def resolve_organization_entitlements(
    db,
    org_id: str,
    current_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Resolve the effective entitlements for an organization.
    
    This function:
    1. Checks for legacy tier protection during billing period
    2. Applies custom organization overrides
    3. Returns the resolved limits and tier information
    
    Args:
        db: Database connection
        org_id: Organization ID
        current_time: Current time for period checks (defaults to now)
    
    Returns:
        Dict with resolved entitlements:
        {
            "tier_key": str,
            "tier_name": str,
            "is_legacy": bool,
            "limits": {
                "max_coach_developers": int,
                "max_coaches": int or None,
                "max_observations_per_coach": int or None
            },
            "features": {...},
            "current_period_end": datetime or None,
            "pending_tier_key": str or None
        }
    """
    if current_time is None:
        current_time = datetime.now(timezone.utc)
    
    # Get organization document
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if not org:
        # Return default (coach_developer tier)
        config = SUBSCRIPTION_TIERS["coach_developer"]
        return {
            "tier_key": "coach_developer",
            "tier_name": config["name"],
            "is_legacy": False,
            "limits": config["limits"].copy(),
            "features": config["features"].copy(),
            "current_period_end": None,
            "pending_tier_key": None
        }
    
    # Check for subscription record
    subscription = await db.subscriptions.find_one(
        {"$or": [{"org_id": org_id}, {"organization_id": org_id}]},
        {"_id": 0}
    )
    
    # Determine current tier
    current_tier_key = None
    is_legacy = False
    legacy_tier_key = None
    pending_tier_key = None
    current_period_end = None
    
    if subscription:
        # Check new fields first
        current_tier_key = subscription.get("current_tier_key")
        is_legacy = subscription.get("is_legacy_tier", False)
        legacy_tier_key = subscription.get("legacy_tier_key")
        pending_tier_key = subscription.get("pending_tier_key")
        
        # Parse period end
        period_end_str = subscription.get("current_period_end")
        if period_end_str:
            if isinstance(period_end_str, str):
                current_period_end = datetime.fromisoformat(period_end_str.replace('Z', '+00:00'))
            elif isinstance(period_end_str, datetime):
                current_period_end = period_end_str
            elif isinstance(period_end_str, (int, float)):
                # Unix timestamp
                current_period_end = datetime.fromtimestamp(period_end_str, tz=timezone.utc)
        
        # Fallback to old tier_id field
        if not current_tier_key:
            old_tier = subscription.get("tier_id") or subscription.get("tier")
            if old_tier:
                # Map legacy tier to new tier
                if old_tier in LEGACY_TIER_MAPPING:
                    is_legacy = True
                    legacy_tier_key = old_tier
                    pending_tier_key = LEGACY_TIER_MAPPING[old_tier]
                    # Use legacy limits until period ends
                    current_tier_key = old_tier
                else:
                    current_tier_key = old_tier
    
    # Also check org document for tier
    if not current_tier_key:
        org_tier = org.get("subscription_tier_id") or org.get("subscription_tier")
        if org_tier:
            if org_tier in LEGACY_TIER_MAPPING and org_tier not in SUBSCRIPTION_TIERS:
                is_legacy = True
                legacy_tier_key = org_tier
                pending_tier_key = LEGACY_TIER_MAPPING[org_tier]
                current_tier_key = org_tier
            else:
                current_tier_key = org_tier
    
    # Default to coach_developer if still no tier
    if not current_tier_key:
        current_tier_key = "coach_developer"
    
    # Apply legacy tier protection rules
    effective_tier_key = current_tier_key
    
    if is_legacy and current_period_end:
        # Check if billing period has ended
        if current_time >= current_period_end:
            # Period ended - switch to pending tier
            if pending_tier_key:
                effective_tier_key = pending_tier_key
                is_legacy = False
        else:
            # Still in legacy period - use legacy limits
            effective_tier_key = legacy_tier_key or current_tier_key
    
    # Get tier configuration
    # For legacy tiers, we need to provide the old limits
    if is_legacy and effective_tier_key in ["individual", "developer"]:
        # Legacy limits (from old system)
        legacy_limits = {
            "individual": {
                "max_coach_developers": 1,
                "max_coaches": 5,
                "max_observations_per_coach": None,  # Was unlimited
            },
            "developer": {
                "max_coach_developers": 1,
                "max_coaches": 10,
                "max_observations_per_coach": None,  # Was unlimited
            }
        }
        limits = legacy_limits.get(effective_tier_key, SUBSCRIPTION_TIERS["coach_developer"]["limits"])
        tier_name = effective_tier_key.title()
        features = {"history_access": "unlimited", "data_retention_months": None, "self_observation": False}
    else:
        config = get_tier_config(effective_tier_key)
        limits = config["limits"].copy()
        tier_name = config["name"]
        features = config["features"].copy()
    
    # Check for custom organization overrides
    custom_limits = await db.organization_custom_limits.find_one(
        {"org_id": org_id},
        {"_id": 0}
    )
    
    if custom_limits:
        # Apply custom overrides
        if custom_limits.get("max_coach_developers") is not None:
            limits["max_coach_developers"] = custom_limits["max_coach_developers"]
        if custom_limits.get("max_coaches") is not None:
            limits["max_coaches"] = custom_limits["max_coaches"]
        if custom_limits.get("max_observations_per_coach") is not None:
            # 0 means unlimited in custom limits
            val = custom_limits["max_observations_per_coach"]
            limits["max_observations_per_coach"] = None if val == 0 else val
        if custom_limits.get("data_retention_months") is not None:
            val = custom_limits["data_retention_months"]
            features["data_retention_months"] = None if val == 0 else val
    
    return {
        "tier_key": effective_tier_key,
        "tier_name": tier_name,
        "is_legacy": is_legacy,
        "legacy_tier_key": legacy_tier_key,
        "limits": limits,
        "features": features,
        "current_period_end": current_period_end,
        "pending_tier_key": pending_tier_key
    }


async def get_coach_observation_count(db, coach_id: str) -> int:
    """
    Get the number of observations recorded for a specific coach.
    This is the per-coach observation count, not per-observer.
    """
    count = await db.observation_sessions.count_documents({
        "coach_id": coach_id,
        "status": "completed"
    })
    return count


async def check_observation_limit(
    db,
    org_id: str,
    coach_id: str
) -> Dict[str, Any]:
    """
    Check if an observation can be created for a coach.
    
    Args:
        db: Database connection
        org_id: Organization ID
        coach_id: Coach profile ID being observed
    
    Returns:
        {
            "can_observe": bool,
            "current_count": int,
            "limit": int or None,
            "is_unlimited": bool,
            "message": str or None
        }
    """
    # Resolve entitlements
    entitlements = await resolve_organization_entitlements(db, org_id)
    limit = entitlements["limits"].get("max_observations_per_coach")
    
    # Get current count for this coach
    current_count = await get_coach_observation_count(db, coach_id)
    
    is_unlimited = limit is None
    can_observe = is_unlimited or current_count < limit
    
    message = None
    if not can_observe:
        message = (
            f"This coach has reached the maximum number of observations for your subscription ({limit}). "
            "To continue observing this coach you will need to upgrade your subscription or contact an administrator."
        )
    
    return {
        "can_observe": can_observe,
        "current_count": current_count,
        "limit": limit,
        "is_unlimited": is_unlimited,
        "message": message,
        "tier_key": entitlements["tier_key"]
    }


async def get_all_coaches_observation_status(
    db,
    org_id: str,
    coach_ids: list
) -> Dict[str, Dict[str, Any]]:
    """
    Get observation status for multiple coaches at once.
    Used for UI to show which coaches are at their limit.
    
    Returns dict keyed by coach_id with observation status.
    """
    entitlements = await resolve_organization_entitlements(db, org_id)
    limit = entitlements["limits"].get("max_observations_per_coach")
    is_unlimited = limit is None
    
    result = {}
    
    for coach_id in coach_ids:
        current_count = await get_coach_observation_count(db, coach_id)
        can_observe = is_unlimited or current_count < limit
        
        result[coach_id] = {
            "current_count": current_count,
            "limit": limit,
            "is_unlimited": is_unlimited,
            "can_observe": can_observe,
            "display_text": "Unlimited observations" if is_unlimited else f"{current_count} of {limit} observations recorded"
        }
    
    return result


def format_tier_for_display(tier_key: str) -> Dict[str, str]:
    """Format tier information for UI display"""
    config = get_tier_config(tier_key)
    limits = config["limits"]
    
    # Format coach developers
    cd_limit = limits["max_coach_developers"]
    cd_text = f"{cd_limit} Coach developer{'s' if cd_limit != 1 else ''}"
    
    # Format coaches
    coach_limit = limits["max_coaches"]
    if coach_limit is None:
        coach_text = "Unlimited coaches"
    elif coach_limit == 0:
        coach_text = "Self observation enabled"
    else:
        coach_text = f"{coach_limit} coaches"
    
    # Format observations
    obs_limit = limits["max_observations_per_coach"]
    if obs_limit is None:
        obs_text = "Unlimited observations"
    else:
        obs_text = f"{obs_limit} observations per coach"
    
    return {
        "tier_name": config["name"],
        "coach_developers": cd_text,
        "coaches": coach_text,
        "observations": obs_text,
        "pricing_monthly": f"£{config['pricing']['monthly'] / 100:.0f}",
        "pricing_annual": f"£{config['pricing']['annual'] / 100:.0f}"
    }


# ============================================
# PHASE 2: SUBSCRIPTION MIGRATION HELPERS
# ============================================

async def prepare_subscription_for_migration(
    db,
    org_id: str,
    current_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Prepare a subscription document with all required migration fields.
    This ensures the document has:
    - current_tier_key
    - is_legacy_tier
    - legacy_tier_key (if applicable)
    - current_period_end
    - pending_tier_key (if migrating)
    
    Returns the updated subscription state.
    """
    if current_time is None:
        current_time = datetime.now(timezone.utc)
    
    # Get existing subscription
    subscription = await db.subscriptions.find_one(
        {"$or": [{"org_id": org_id}, {"organization_id": org_id}]},
        {"_id": 0}
    )
    
    if not subscription:
        return {
            "needs_creation": True,
            "suggested_tier": "coach_developer",
            "is_legacy": False
        }
    
    # Check if already has migration fields
    has_migration_fields = (
        subscription.get("current_tier_key") is not None or
        subscription.get("is_legacy_tier") is not None
    )
    
    if has_migration_fields:
        return {
            "needs_migration": False,
            "current_tier_key": subscription.get("current_tier_key"),
            "is_legacy_tier": subscription.get("is_legacy_tier", False),
            "legacy_tier_key": subscription.get("legacy_tier_key"),
            "current_period_end": subscription.get("current_period_end"),
            "pending_tier_key": subscription.get("pending_tier_key")
        }
    
    # Determine legacy tier from old fields
    old_tier = subscription.get("tier_id") or subscription.get("tier")
    
    migration_data = {
        "needs_migration": True,
        "old_tier": old_tier
    }
    
    if old_tier in LEGACY_TIER_MAPPING:
        migration_data.update({
            "is_legacy_tier": True,
            "legacy_tier_key": old_tier,
            "pending_tier_key": LEGACY_TIER_MAPPING[old_tier],
            "suggested_tier": LEGACY_TIER_MAPPING[old_tier]
        })
    else:
        # Already on a new tier or unknown
        migration_data.update({
            "is_legacy_tier": False,
            "legacy_tier_key": None,
            "pending_tier_key": None,
            "suggested_tier": old_tier if old_tier in SUBSCRIPTION_TIERS else "coach_developer"
        })
    
    # Get current period end from Stripe if available
    stripe_sub_id = subscription.get("subscription_id")
    if stripe_sub_id:
        migration_data["stripe_subscription_id"] = stripe_sub_id
        # Note: Actual period end should be fetched from Stripe API
        # This is just the value we have stored
        migration_data["current_period_end"] = subscription.get("current_period_end")
    
    return migration_data


async def apply_migration_fields(
    db,
    org_id: str,
    migration_data: Dict[str, Any],
    current_period_end: Optional[datetime] = None
) -> bool:
    """
    Apply migration fields to a subscription document.
    Call this after verifying the migration is safe to proceed.
    """
    now = datetime.now(timezone.utc)
    
    update_data = {
        "is_legacy_tier": migration_data.get("is_legacy_tier", False),
        "legacy_tier_key": migration_data.get("legacy_tier_key"),
        "pending_tier_key": migration_data.get("pending_tier_key"),
        "migration_prepared_at": now.isoformat(),
        "migration_version": "phase_2"
    }
    
    # Set current_tier_key based on whether it's legacy
    if migration_data.get("is_legacy_tier"):
        # Keep using legacy tier until period ends
        update_data["current_tier_key"] = migration_data.get("legacy_tier_key")
    else:
        update_data["current_tier_key"] = migration_data.get("suggested_tier", "coach_developer")
    
    # Set period end if provided
    if current_period_end:
        if isinstance(current_period_end, datetime):
            update_data["current_period_end"] = current_period_end.isoformat()
        else:
            update_data["current_period_end"] = current_period_end
    
    result = await db.subscriptions.update_one(
        {"$or": [{"org_id": org_id}, {"organization_id": org_id}]},
        {"$set": update_data}
    )
    
    return result.modified_count > 0


def get_available_tiers_for_signup() -> Dict[str, Dict[str, Any]]:
    """
    Get tiers available for new signups.
    Excludes legacy tiers and tiers without Stripe configuration.
    
    Returns dict of tier_key -> tier_config for display in signup/upgrade UI.
    """
    available = {}
    
    # Legacy tier keys that should be excluded from signup
    # These are the OLD tier names that no longer exist
    legacy_only_tiers = {"individual", "developer", "free"}
    
    for tier_key, config in SUBSCRIPTION_TIERS.items():
        # Skip legacy-only tiers (old tier names that have been replaced)
        if tier_key in legacy_only_tiers:
            continue
        
        # Check if Stripe is configured for this tier
        stripe_ready = is_tier_stripe_ready(tier_key)
        
        available[tier_key] = {
            "name": config["name"],
            "description": config["description"],
            "limits": config["limits"],
            "pricing": config["pricing"],
            "features": config["features"],
            "stripe_ready": stripe_ready,
            "available_for_signup": stripe_ready  # Only allow signup if Stripe is ready
        }
    
    return available


def get_tier_comparison() -> list:
    """
    Get tier comparison data for pricing page.
    Returns list of tiers ordered from cheapest to most expensive.
    """
    tiers = []
    
    # Order: individual_coach, coach_developer, club
    tier_order = ["individual_coach", "coach_developer", "club"]
    
    for tier_key in tier_order:
        if tier_key not in SUBSCRIPTION_TIERS:
            continue
        
        config = SUBSCRIPTION_TIERS[tier_key]
        
        tiers.append({
            "tier_key": tier_key,
            "name": config["name"],
            "description": config["description"],
            "pricing": {
                "monthly": config["pricing"]["monthly"] / 100,  # Convert pence to pounds
                "annual": config["pricing"]["annual"] / 100,
                "annual_monthly_equivalent": config["pricing"]["annual"] / 100 / 12,
                "currency": config["pricing"]["currency"]
            },
            "limits": {
                "coach_developers": config["limits"]["max_coach_developers"],
                "coaches": config["limits"]["max_coaches"],
                "observations_per_coach": config["limits"]["max_observations_per_coach"]
            },
            "features": config["features"],
            "stripe_ready": is_tier_stripe_ready(tier_key),
            "highlight": tier_key == "coach_developer"  # Most popular
        })
    
    return tiers
