"""
Free Trial Routes
=================
Handles 1-month free trial functionality for monthly billing plans.

Trial Flow:
1. User selects tier + monthly billing
2. User clicks "Start Free Trial"
3. Account created with full tier access for 1 calendar month
4. Trial expires → User gated behind subscribe modal
5. User subscribes → Access restored with existing data
"""

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
import uuid
import secrets

import sys
sys.path.insert(0, '/app/backend')

from database import db, logger
from dependencies import require_auth, get_current_user
from utils import (
    hash_password, validate_password, validate_email,
    bootstrap_default_templates, send_email_with_retry
)
from database import SENDER_EMAIL, APP_URL
from subscription_config import SUBSCRIPTION_TIERS

router = APIRouter(prefix="/trial", tags=["Trial"])


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class StartTrialRequest(BaseModel):
    """Request to start a free trial"""
    email: EmailStr
    password: str
    name: str
    tier_key: str  # Which tier to trial
    club_name: str  # REQUIRED: Organization name for data isolation
    club_logo: Optional[str] = None


class TrialStatusResponse(BaseModel):
    """Response for trial status check"""
    is_trial: bool
    is_expired: bool
    tier_key: Optional[str] = None
    tier_name: Optional[str] = None
    trial_start_date: Optional[str] = None
    trial_end_date: Optional[str] = None
    days_remaining: Optional[int] = None
    subscription_status: str  # trial_active, trial_expired, active, inactive


# ============================================
# HELPER FUNCTIONS
# ============================================

def calculate_trial_end_date(start_date: datetime) -> datetime:
    """
    Calculate trial end date as 1 calendar month from start.
    Uses relativedelta to handle month variations properly.
    E.g., March 12 → April 12, January 31 → February 28/29
    """
    return start_date + relativedelta(months=1)


def get_days_remaining(end_date: datetime) -> int:
    """Calculate days remaining until trial expires"""
    now = datetime.now(timezone.utc)
    delta = end_date - now
    return max(0, delta.days)


async def send_trial_started_email(email: str, user_name: str, tier_name: str, trial_end_date: datetime):
    """Send email confirming trial has started"""
    end_date_formatted = trial_end_date.strftime("%B %d, %Y")
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">Welcome to My Coach Developer!</h2>
        <p>Hi {user_name},</p>
        <p>Your <strong>1-month free trial</strong> of the <strong>{tier_name}</strong> plan has started.</p>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #1e293b; margin-top: 0;">Your Trial Details</h3>
            <p style="margin: 8px 0;"><strong>Plan:</strong> {tier_name}</p>
            <p style="margin: 8px 0;"><strong>Trial Ends:</strong> {end_date_formatted}</p>
            <p style="margin: 8px 0;"><strong>Access:</strong> Full features included</p>
        </div>
        
        <p>During your trial, you have complete access to all {tier_name} features. Create observations, build coach portfolios, and explore everything the platform has to offer.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{APP_URL}/login" 
               style="background-color: #1e293b; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
                Get Started
            </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            We'll send you a reminder before your trial ends. No payment is required until you're ready to subscribe.
        </p>
    </div>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": "Welcome to My Coach Developer - Your Free Trial Has Started!",
        "html": html_content
    }
    
    try:
        return await send_email_with_retry(params, "trial started")
    except Exception as e:
        logger.error(f"Failed to send trial started email to {email}: {e}")
        # Don't fail the trial start if email fails
        return None


async def send_trial_expiring_email(email: str, user_name: str, tier_name: str, days_remaining: int):
    """Send email warning that trial is expiring soon"""
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">Your Trial Is Ending Soon</h2>
        <p>Hi {user_name},</p>
        <p>Your free trial of the <strong>{tier_name}</strong> plan ends in <strong>{days_remaining} days</strong>.</p>
        
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0;">
                <strong>Don't lose access!</strong> Subscribe now to keep using all your data and continue developing your coaches.
            </p>
        </div>
        
        <p>When your trial ends:</p>
        <ul style="color: #64748b;">
            <li>Your account and all data will be safely preserved</li>
            <li>You'll need to subscribe to regain access</li>
            <li>Everything will be exactly where you left it</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{APP_URL}/settings" 
               style="background-color: #1e293b; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
                Subscribe Now
            </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">
            Questions? Reply to this email and we'll help you out.
        </p>
    </div>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": f"Your My Coach Developer Trial Ends in {days_remaining} Days",
        "html": html_content
    }
    
    try:
        return await send_email_with_retry(params, "trial expiring")
    except Exception as e:
        logger.error(f"Failed to send trial expiring email to {email}: {e}")
        return None


async def send_trial_expired_email(email: str, user_name: str, tier_name: str):
    """Send email notifying that trial has expired"""
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">Your Trial Has Ended</h2>
        <p>Hi {user_name},</p>
        <p>Your free trial of the <strong>{tier_name}</strong> plan has ended.</p>
        
        <div style="background-color: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="color: #166534; margin: 0;">
                <strong>Good news!</strong> All your data is safely preserved. Subscribe anytime to pick up right where you left off.
            </p>
        </div>
        
        <p>Your account contains:</p>
        <ul style="color: #64748b;">
            <li>All your coaches and observations</li>
            <li>Development plans and reflections</li>
            <li>Reports and session history</li>
        </ul>
        
        <p>Subscribe now to regain full access:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{APP_URL}/login" 
               style="background-color: #1e293b; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
                Subscribe & Continue
            </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">
            Need more time? Reply to this email and let us know.
        </p>
    </div>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": "Your My Coach Developer Trial Has Ended - Subscribe to Continue",
        "html": html_content
    }
    
    try:
        return await send_email_with_retry(params, "trial expired")
    except Exception as e:
        logger.error(f"Failed to send trial expired email to {email}: {e}")
        return None


# ============================================
# ENDPOINTS
# ============================================

@router.post("/start")
async def start_free_trial(data: StartTrialRequest, response: Response):
    """
    Start a 1-month free trial for a new user.
    
    - Creates user account
    - Creates organization
    - Sets up trial subscription with selected tier
    - Sends confirmation email
    - Returns auth token for immediate login
    """
    try:
        # Validate tier
        if data.tier_key not in SUBSCRIPTION_TIERS:
            raise HTTPException(status_code=400, detail=f"Invalid tier: {data.tier_key}")
        
        tier_config = SUBSCRIPTION_TIERS[data.tier_key]
        
        # Validate email
        if not validate_email(data.email):
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Validate password
        is_valid, error_msg = validate_password(data.password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        email_lower = data.email.lower()
        
        # Check if user already exists
        existing_user = await db.users.find_one(
            {"email": {"$regex": f"^{email_lower}$", "$options": "i"}},
            {"_id": 0}
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="An account with this email already exists")
        
        # Calculate trial dates
        now = datetime.now(timezone.utc)
        trial_end = calculate_trial_end_date(now)
        
        # Create user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        password_hash = hash_password(data.password)
        
        new_user = {
            "user_id": user_id,
            "email": data.email,
            "name": data.name,
            "password_hash": password_hash,
            "picture": None,
            "role": "coach_developer",
            "linked_coach_id": None,
            "auth_provider": "email",
            "created_at": now.isoformat()
        }
        await db.users.insert_one(new_user)
        
        # Create organization
        org_id = f"org_{uuid.uuid4().hex[:12]}"
        org_doc = {
            "org_id": org_id,
            "owner_id": user_id,
            "club_name": data.club_name,
            "club_logo": data.club_logo,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        await db.organizations.insert_one(org_doc)
        
        # Update user with organization_id
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"organization_id": org_id}}
        )
        
        # Create trial subscription
        subscription_id = f"sub_trial_{uuid.uuid4().hex[:12]}"
        subscription_doc = {
            "subscription_id": subscription_id,
            "org_id": org_id,
            "organization_id": org_id,
            "user_id": user_id,
            
            # Trial fields
            "is_trial": True,
            "trial_start_date": now.isoformat(),
            "trial_end_date": trial_end.isoformat(),
            "trial_tier_key": data.tier_key,
            
            # Subscription status
            "status": "trialing",
            "subscription_status": "trial_active",
            "current_tier_key": data.tier_key,
            "is_legacy_tier": False,
            
            # Timestamps
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        await db.subscriptions.insert_one(subscription_doc)
        
        # Bootstrap default templates
        await bootstrap_default_templates(org_id, user_id)
        
        # Create session token
        session_token = secrets.token_urlsafe(32)
        expires_at = now + timedelta(days=7)
        
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": now.isoformat()
        })
        
        # Set session cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        logger.info(f"Started free trial for user {user_id} ({data.email}) on tier {data.tier_key}")
        
        # Send trial started email (async, don't block response)
        try:
            await send_trial_started_email(
                email=data.email,
                user_name=data.name,
                tier_name=tier_config["name"],
                trial_end_date=trial_end
            )
        except Exception as e:
            logger.error(f"Failed to send trial email: {e}")
        
        return {
            "success": True,
            "user_id": user_id,
            "email": data.email,
            "name": data.name,
            "role": "coach_developer",
            "organization_id": org_id,
            "token": session_token,
            "trial": {
                "tier_key": data.tier_key,
                "tier_name": tier_config["name"],
                "start_date": now.isoformat(),
                "end_date": trial_end.isoformat(),
                "days_remaining": get_days_remaining(trial_end)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start trial: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start trial: {str(e)}")


@router.get("/status")
async def get_trial_status(request: Request):
    """
    Get trial status for the current user.
    
    Returns:
    - is_trial: Whether user is on a trial
    - is_expired: Whether trial has expired
    - days_remaining: Days until trial expires
    - subscription_status: Current status label
    """
    user = await get_current_user(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get organization ID
    org_id = user.organization_id
    if not org_id:
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    if not org_id:
        return TrialStatusResponse(
            is_trial=False,
            is_expired=False,
            subscription_status="inactive"
        )
    
    # Get subscription
    subscription = await db.subscriptions.find_one(
        {"$or": [{"org_id": org_id}, {"organization_id": org_id}]},
        {"_id": 0}
    )
    
    if not subscription:
        return TrialStatusResponse(
            is_trial=False,
            is_expired=False,
            subscription_status="inactive"
        )
    
    # Check if on trial
    is_trial = subscription.get("is_trial", False)
    
    if not is_trial:
        # Not a trial - return regular subscription status
        status = subscription.get("status", "inactive")
        return TrialStatusResponse(
            is_trial=False,
            is_expired=False,
            tier_key=subscription.get("current_tier_key"),
            subscription_status="active" if status == "active" else "inactive"
        )
    
    # Parse trial dates
    trial_end_str = subscription.get("trial_end_date")
    trial_start_str = subscription.get("trial_start_date")
    trial_tier_key = subscription.get("trial_tier_key") or subscription.get("current_tier_key")
    
    trial_end = None
    trial_start = None
    
    if trial_end_str:
        try:
            trial_end = datetime.fromisoformat(trial_end_str.replace('Z', '+00:00'))
        except:
            pass
    
    if trial_start_str:
        try:
            trial_start = datetime.fromisoformat(trial_start_str.replace('Z', '+00:00'))
        except:
            pass
    
    # Check if expired
    now = datetime.now(timezone.utc)
    is_expired = trial_end and now >= trial_end
    days_remaining = get_days_remaining(trial_end) if trial_end else 0
    
    # Get tier name
    tier_name = None
    if trial_tier_key and trial_tier_key in SUBSCRIPTION_TIERS:
        tier_name = SUBSCRIPTION_TIERS[trial_tier_key]["name"]
    
    # Determine status
    if is_expired:
        subscription_status = "trial_expired"
    else:
        subscription_status = "trial_active"
    
    return TrialStatusResponse(
        is_trial=True,
        is_expired=is_expired,
        tier_key=trial_tier_key,
        tier_name=tier_name,
        trial_start_date=trial_start_str,
        trial_end_date=trial_end_str,
        days_remaining=days_remaining,
        subscription_status=subscription_status
    )


@router.post("/check-expiring")
async def check_and_notify_expiring_trials():
    """
    Background job endpoint to check for expiring trials and send notifications.
    Should be called daily by a cron job or scheduler.
    
    Sends notifications:
    - 7 days before expiry
    - On expiry day
    """
    now = datetime.now(timezone.utc)
    seven_days_from_now = now + timedelta(days=7)
    
    notifications_sent = {
        "expiring_7_days": 0,
        "expired_today": 0,
        "errors": []
    }
    
    # Find trials expiring in 7 days (± 12 hours to catch daily runs)
    expiring_soon = await db.subscriptions.find({
        "is_trial": True,
        "subscription_status": "trial_active",
        "trial_end_date": {
            "$gte": (seven_days_from_now - timedelta(hours=12)).isoformat(),
            "$lt": (seven_days_from_now + timedelta(hours=12)).isoformat()
        },
        "expiring_email_sent": {"$ne": True}
    }, {"_id": 0}).to_list(100)
    
    for sub in expiring_soon:
        try:
            user_id = sub.get("user_id")
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            if user:
                tier_key = sub.get("trial_tier_key") or sub.get("current_tier_key")
                tier_name = SUBSCRIPTION_TIERS.get(tier_key, {}).get("name", "your selected plan")
                
                await send_trial_expiring_email(
                    email=user.get("email"),
                    user_name=user.get("name"),
                    tier_name=tier_name,
                    days_remaining=7
                )
                
                # Mark as sent
                await db.subscriptions.update_one(
                    {"subscription_id": sub.get("subscription_id")},
                    {"$set": {"expiring_email_sent": True, "expiring_email_sent_at": now.isoformat()}}
                )
                
                notifications_sent["expiring_7_days"] += 1
        except Exception as e:
            notifications_sent["errors"].append(f"Expiring notification error: {str(e)}")
    
    # Find trials that expired today
    expired_today = await db.subscriptions.find({
        "is_trial": True,
        "subscription_status": "trial_active",
        "trial_end_date": {"$lt": now.isoformat()},
        "expired_email_sent": {"$ne": True}
    }, {"_id": 0}).to_list(100)
    
    for sub in expired_today:
        try:
            user_id = sub.get("user_id")
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            if user:
                tier_key = sub.get("trial_tier_key") or sub.get("current_tier_key")
                tier_name = SUBSCRIPTION_TIERS.get(tier_key, {}).get("name", "your selected plan")
                
                await send_trial_expired_email(
                    email=user.get("email"),
                    user_name=user.get("name"),
                    tier_name=tier_name
                )
                
                # Update subscription status
                await db.subscriptions.update_one(
                    {"subscription_id": sub.get("subscription_id")},
                    {"$set": {
                        "subscription_status": "trial_expired",
                        "expired_email_sent": True,
                        "expired_email_sent_at": now.isoformat()
                    }}
                )
                
                notifications_sent["expired_today"] += 1
        except Exception as e:
            notifications_sent["errors"].append(f"Expired notification error: {str(e)}")
    
    logger.info(f"Trial notification check complete: {notifications_sent}")
    
    return {
        "success": True,
        "checked_at": now.isoformat(),
        "notifications": notifications_sent
    }
