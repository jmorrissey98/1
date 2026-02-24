"""
Utility functions for the application.
"""
import bcrypt
import re
import asyncio
import resend
import uuid
import logging
from datetime import datetime, timezone
from database import logger, db, RESEND_API_KEY, SENDER_EMAIL, APP_URL

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def validate_password(password: str) -> tuple:
    """Validate password meets requirements"""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Za-z]', password):
        return False, "Password must contain at least one letter"
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    return True, ""


def validate_email(email: str) -> bool:
    """Basic email format validation"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


# ============================================
# DEFAULT TEMPLATE DEFINITIONS
# ============================================

# Default intervention types (same for all templates)
DEFAULT_INTERVENTION_TYPES = [
    {"id": "command", "name": "Command", "color": "yellow"},
    {"id": "qa", "name": "Q&A", "color": "yellow"},
    {"id": "guided_discovery", "name": "Guided Discovery", "color": "yellow"},
    {"id": "transmission", "name": "Transmission", "color": "yellow"}
]

# Default descriptor groups (same for all templates)
DEFAULT_DESCRIPTOR_GROUP_1 = {
    "id": "content_focus",
    "name": "Content Focus",
    "color": "blue",
    "descriptors": [
        {"id": "technical", "name": "Technical"},
        {"id": "tactical", "name": "Tactical"},
        {"id": "physical", "name": "Physical"},
        {"id": "psych", "name": "Psych"},
        {"id": "social", "name": "Social"}
    ]
}

DEFAULT_DESCRIPTOR_GROUP_2 = {
    "id": "delivery_method",
    "name": "Delivery Method",
    "color": "green",
    "descriptors": [
        {"id": "visual_demo", "name": "Visual Demo"},
        {"id": "triggers", "name": "Triggers"},
        {"id": "kinesthetic", "name": "Kinesthetic"}
    ]
}

# Training Template - 4 parts
TRAINING_TEMPLATE_PARTS = [
    {"id": "part_1", "name": "Part 1", "order": 0, "isDefault": True},
    {"id": "part_2", "name": "Part 2", "order": 1, "isDefault": True},
    {"id": "part_3", "name": "Part 3", "order": 2, "isDefault": True},
    {"id": "part_4", "name": "Part 4", "order": 3, "isDefault": True}
]

# Match Day Template - 2 parts
MATCH_DAY_TEMPLATE_PARTS = [
    {"id": "first_half", "name": "First Half", "order": 0, "isDefault": True},
    {"id": "second_half", "name": "Second Half", "order": 1, "isDefault": True}
]


def get_default_training_template(org_id: str, user_id: str) -> dict:
    """Get default Training Template for a new organization"""
    return {
        "template_id": f"obs_tmpl_training_{uuid.uuid4().hex[:8]}",
        "name": "Training Template",
        "description": "Default template for training session observations",
        "observation_context": "training",
        "intervention_types": DEFAULT_INTERVENTION_TYPES,
        "descriptor_group1": DEFAULT_DESCRIPTOR_GROUP_1,
        "descriptor_group2": DEFAULT_DESCRIPTOR_GROUP_2,
        "session_parts": TRAINING_TEMPLATE_PARTS,
        "is_default": True,
        "organization_id": org_id,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }


def get_default_match_day_template(org_id: str, user_id: str) -> dict:
    """Get default Match Day Template for a new organization"""
    return {
        "template_id": f"obs_tmpl_matchday_{uuid.uuid4().hex[:8]}",
        "name": "Match Day Template",
        "description": "Default template for match day observations",
        "observation_context": "game",
        "intervention_types": DEFAULT_INTERVENTION_TYPES,
        "descriptor_group1": DEFAULT_DESCRIPTOR_GROUP_1,
        "descriptor_group2": DEFAULT_DESCRIPTOR_GROUP_2,
        "session_parts": MATCH_DAY_TEMPLATE_PARTS,
        "is_default": True,
        "organization_id": org_id,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }


def get_default_coach_educator_reflection_template(org_id: str, user_id: str) -> dict:
    """Get default reflection template for Coach Educators/Developers"""
    return {
        "template_id": f"reftmpl_educator_{uuid.uuid4().hex[:8]}",
        "name": "Coach Educator Reflection",
        "target_role": "coach_educator",
        "description": "Comprehensive reflection template for coach educators after observing sessions",
        "questions": [
            {
                "question_id": "q1",
                "question_text": "How effective was your observation today?",
                "question_type": "scale",
                "required": True,
                "scale_min": 1,
                "scale_max": 5,
                "scale_min_label": "Not Effective",
                "scale_max_label": "Very Effective"
            },
            {
                "question_id": "q2",
                "question_text": "What coaching behaviours stood out during this session?",
                "question_type": "text",
                "required": True
            },
            {
                "question_id": "q3",
                "question_text": "What development opportunities did you identify for the coach?",
                "question_type": "text",
                "required": True
            },
            {
                "question_id": "q4",
                "question_text": "How will you approach the feedback conversation?",
                "question_type": "text",
                "required": False
            },
            {
                "question_id": "q5",
                "question_text": "What would you do differently next time you observe?",
                "question_type": "text",
                "required": False
            }
        ],
        "is_default": True,
        "created_by": user_id,
        "organization_id": org_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }


def get_default_coach_reflection_template(org_id: str, user_id: str) -> dict:
    """Get simple/minimal reflection template for Coaches"""
    return {
        "template_id": f"reftmpl_coach_{uuid.uuid4().hex[:8]}",
        "name": "Coach Reflection",
        "target_role": "coach",
        "description": "Simple reflection template for coaches after being observed",
        "questions": [
            {
                "question_id": "q1",
                "question_text": "How do you feel the session went overall?",
                "question_type": "scale",
                "required": True,
                "scale_min": 1,
                "scale_max": 5,
                "scale_min_label": "Poor",
                "scale_max_label": "Excellent"
            },
            {
                "question_id": "q2",
                "question_text": "What went well?",
                "question_type": "text",
                "required": True
            },
            {
                "question_id": "q3",
                "question_text": "What would you change next time?",
                "question_type": "text",
                "required": False
            }
        ],
        "is_default": True,
        "created_by": user_id,
        "organization_id": org_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }


async def bootstrap_default_templates(org_id: str, user_id: str):
    """
    Bootstrap all default templates for a new organization.
    Called during signup/organization creation.
    """
    try:
        # Create observation window templates
        training_template = get_default_training_template(org_id, user_id)
        match_day_template = get_default_match_day_template(org_id, user_id)
        
        await db.observation_templates.insert_one(training_template)
        await db.observation_templates.insert_one(match_day_template)
        
        # Create reflection templates
        coach_educator_template = get_default_coach_educator_reflection_template(org_id, user_id)
        coach_template = get_default_coach_reflection_template(org_id, user_id)
        
        await db.reflection_templates.insert_one(coach_educator_template)
        await db.reflection_templates.insert_one(coach_template)
        
        logger.info(f"Bootstrapped default templates for organization {org_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to bootstrap templates for org {org_id}: {e}")
        return False


async def send_email_with_retry(params: dict, email_type: str, max_retries: int = 3):
    """
    Send email with retry logic for resilience.
    """
    last_error = None
    
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Sending {email_type} email to {params['to']} (attempt {attempt}/{max_retries})")
            logger.info(f"Using sender: {params['from']}, API key prefix: {resend.api_key[:10]}...")
            
            result = await asyncio.to_thread(resend.Emails.send, params)
            
            logger.info(f"Email sent successfully: {result}")
            return result
            
        except Exception as e:
            last_error = e
            error_msg = str(e)
            logger.error(f"Email attempt {attempt} failed: {error_msg}")
            
            permanent_errors = [
                "api_key",
                "unauthorized", 
                "forbidden",
                "verify",
                "domain",
                "testing emails"
            ]
            
            if any(err in error_msg.lower() for err in permanent_errors):
                logger.error(f"Permanent email error, not retrying: {error_msg}")
                raise
            
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.info(f"Waiting {wait_time}s before retry...")
                await asyncio.sleep(wait_time)
    
    raise last_error


async def send_password_reset_email(email: str, reset_token: str, user_name: str):
    """Send password reset email via Resend"""
    reset_link = f"{APP_URL}/reset-password?token={reset_token}"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">Reset Your Password</h2>
        <p>Hi {user_name},</p>
        <p>We received a request to reset your password for your My Coach Developer account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}" 
               style="background-color: #1e293b; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
            </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #64748b; word-break: break-all;">{reset_link}</p>
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            This link will expire in 1 hour. If you didn't request a password reset, 
            you can safely ignore this email.
        </p>
    </div>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": "Reset Your Password - My Coach Developer",
        "html": html_content
    }
    
    return await send_email_with_retry(params, "password reset")


async def send_invite_email(email: str, inviter_name: str, role: str, invite_id: str, invitee_name: str = None):
    """Send invitation email via Resend"""
    registration_link = f"{APP_URL}/register/{invite_id}"
    role_display = "Coach Developer" if role == "coach_developer" else "Coach"
    greeting = f"Hi {invitee_name}," if invitee_name else "Hi there,"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">You're Invited to My Coach Developer</h2>
        <p>{greeting}</p>
        <p><strong>{inviter_name}</strong> has invited you to join My Coach Developer as a <strong>{role_display}</strong>.</p>
        <p>My Coach Developer is a coaching observation app that helps track and analyze coaching sessions.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{registration_link}" 
               style="background-color: #1e293b; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
                Complete Your Registration
            </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #64748b; word-break: break-all;">{registration_link}</p>
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            This invitation link is unique to you and can only be used once.
        </p>
    </div>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": "You're invited to My Coach Developer",
        "html": html_content
    }
    
    return await send_email_with_retry(params, "invite")
