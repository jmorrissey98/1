"""
My Coach Developer - Backend Server
====================================
A coaching observation and development platform.

Architecture Notes:
- This file contains all API routes for the application
- Shared modules are in separate files:
  - database.py: MongoDB connection and configuration
  - models.py: Pydantic models for request/response validation
  - dependencies.py: Auth middleware and helpers
  - utils.py: Utility functions (password hashing, email sending)
  - routes/: Modular route files (for future migration)

Route Groups:
- /api/auth/* - Authentication (login, signup, password reset)
- /api/coaches/* - Coach management (CRUD)
- /api/users/* - User management
- /api/invites/* - Invitation system
- /api/observations/* - Session observations
- /api/organization/* - Organization settings
- /api/coach/* - Coach portal endpoints
- /api/admin/* - Admin dashboard
- /api/payments/* - Stripe integration
- /api/reflection-templates/* - Reflection templates
"""

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Request, Response, Depends
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import aiofiles
import httpx
import asyncio
import bcrypt
import resend
import secrets
import re
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
import base64
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText
import tempfile


ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend configuration - Read from environment (no fallbacks for deployment safety)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL')
# APP_URL for email links - default to production URL if not set
APP_URL = os.environ.get('APP_URL', 'https://mycoachdeveloper.com')

# Initialize Resend (only if API key is available)
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging early (needed for CORS setup logging)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add validation error handler to log details
from fastapi.exceptions import RequestValidationError
from starlette.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logger.error(f"Validation error: {exc.errors()}")
    logger.error(f"Request body: {await request.body()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": "See server logs for details"}
    )

# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class SessionSummaryRequest(BaseModel):
    session_name: str
    total_duration: int  # seconds
    total_events: int
    ball_rolling_time: int  # seconds
    ball_not_rolling_time: int
    event_breakdown: Dict[str, int]  # event_type: count
    descriptor1_name: str
    descriptor1_breakdown: Dict[str, int]
    descriptor2_name: str
    descriptor2_breakdown: Dict[str, int]
    session_parts: List[Dict[str, Any]]
    user_notes: Optional[str] = ""
    # Coach context (optional)
    coach_name: Optional[str] = None
    coach_targets: Optional[List[str]] = None
    previous_sessions_summary: Optional[str] = None

class SessionSummaryResponse(BaseModel):
    summary: str

class CoachTrendRequest(BaseModel):
    coach_name: str
    sessions_data: List[Dict[str, Any]]  # List of session summaries
    current_targets: List[str]

class CoachTrendResponse(BaseModel):
    trend_summary: str

class FileUploadResponse(BaseModel):
    id: str
    name: str
    type: str
    size: int
    url: str
    uploadedAt: str

# User & Auth Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "coach"  # "admin", "coach_developer" or "coach"
    linked_coach_id: Optional[str] = None  # Links to coach profile
    organization_id: Optional[str] = None  # For non-admin users, links to their organization
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str
    linked_coach_id: Optional[str] = None
    organization_id: Optional[str] = None
    auth_provider: Optional[str] = None  # "email" or "google"

# Email/Password Auth Models
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    # Optional club branding for first user (Coach Developer)
    club_name: Optional[str] = None
    club_logo: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# Organization/Club Model
class OrganizationUpdate(BaseModel):
    club_name: Optional[str] = None
    club_logo: Optional[str] = None  # Base64 or URL

class OrganizationResponse(BaseModel):
    org_id: str
    club_name: Optional[str] = None
    club_logo: Optional[str] = None
    owner_id: str
    created_at: Optional[str] = None

# Admin Models
class AdminCreateOrganizationRequest(BaseModel):
    club_name: str
    club_logo: Optional[str] = None  # Base64 or URL

class AdminCreateUserRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    role: str  # "coach_developer" or "coach"
    organization_id: str

class AdminResetPasswordRequest(BaseModel):
    new_password: str

class AdminUserListItem(BaseModel):
    user_id: str
    email: str
    name: str
    role: str
    organization_id: Optional[str] = None
    linked_coach_id: Optional[str] = None
    created_at: Optional[str] = None

class AdminOrganizationListItem(BaseModel):
    org_id: str
    club_name: Optional[str] = None
    club_logo: Optional[str] = None
    owner_id: str
    owner_email: Optional[str] = None
    user_count: int = 0
    coach_count: int = 0
    session_count: int = 0
    subscription_tier: Optional[str] = None
    status: str = "active"  # "active" or "archived"
    created_at: Optional[str] = None
    # Effective limits (considering custom overrides)
    effective_coaches_limit: Optional[int] = None
    effective_admins_limit: Optional[int] = None
    effective_data_retention_months: Optional[int] = None
    has_custom_limits: bool = False

class Invite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    invite_id: str
    email: str
    role: str  # "coach_developer" or "coach"
    invited_by: str  # user_id of inviter
    coach_id: Optional[str] = None  # Link to coach profile if inviting a coach
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    used: bool = False

class InviteCreate(BaseModel):
    email: str
    role: str
    coach_id: Optional[str] = None

class InviteResponse(BaseModel):
    invite_id: str
    email: str
    role: str
    coach_id: Optional[str] = None
    created_at: str
    email_sent: Optional[bool] = None  # Track if invite email was sent successfully
    name: Optional[str] = None  # Name from coach profile if exists

class InviteValidationResponse(BaseModel):
    valid: bool
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    error: Optional[str] = None

class RoleUpdateRequest(BaseModel):
    user_id: str
    new_role: str

# Session Parts Models
class SessionPart(BaseModel):
    part_id: str
    name: str
    is_default: bool = True
    created_by: Optional[str] = None  # user_id of creator
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SessionPartCreate(BaseModel):
    name: str
    is_default: bool = False  # Whether to add as global default

class SessionPartResponse(BaseModel):
    part_id: str
    name: str
    is_default: bool
    created_by: Optional[str] = None
    created_at: str

# ============================================
# COACH ROLE MODELS
# ============================================

class CoachProfileUpdate(BaseModel):
    """Limited fields coaches can edit on their own profile"""
    photo: Optional[str] = None
    role_title: Optional[str] = None  # e.g., "Head Coach U16s"
    age_group: Optional[str] = None   # e.g., "Under 16s"
    department: Optional[str] = None  # e.g., "Academy"
    bio: Optional[str] = None         # Short coaching focus/bio

class CoachProfileResponse(BaseModel):
    """Coach profile data visible to the coach"""
    id: str
    name: str
    email: Optional[str] = None
    photo: Optional[str] = None
    role_title: Optional[str] = None
    age_group: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    targets: List[Dict[str, Any]] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class ReflectionCreate(BaseModel):
    """Coach's self-reflection on a session"""
    session_id: str
    content: str
    self_assessment_rating: Optional[int] = None  # 1-5 scale
    strengths: Optional[str] = None
    areas_for_development: Optional[str] = None

class ReflectionResponse(BaseModel):
    reflection_id: str
    session_id: str
    coach_id: str
    content: str
    self_assessment_rating: Optional[int] = None
    strengths: Optional[str] = None
    areas_for_development: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None

class ScheduledObservationCreate(BaseModel):
    """Observer scheduling an observation for a coach"""
    coach_id: str
    scheduled_date: str
    session_context: Optional[str] = None  # e.g., "U16 Training Session"

class ScheduledObservationResponse(BaseModel):
    schedule_id: str
    coach_id: str
    coach_name: Optional[str] = None
    observer_id: str
    observer_name: Optional[str] = None
    scheduled_date: str
    session_context: Optional[str] = None
    status: str  # "scheduled", "completed", "cancelled"
    created_at: str

class CoachDashboardResponse(BaseModel):
    """Aggregated data for coach dashboard"""
    profile: CoachProfileResponse
    targets: List[Dict[str, Any]]
    upcoming_observations: List[ScheduledObservationResponse]
    recent_session: Optional[Dict[str, Any]] = None
    has_pending_reflection: bool = False
    pending_reflection_session_id: Optional[str] = None

class CoachSessionSummary(BaseModel):
    """Summary of a session for coach's view"""
    session_id: str
    title: str
    date: str
    observer_name: Optional[str] = None
    has_observation: bool = False
    has_reflection: bool = False
    summary_preview: Optional[str] = None

# ============================================
# END COACH ROLE MODELS
# ============================================

# ============================================
# OBSERVATION SESSION MODELS (Cloud Sync)
# ============================================

class ObservationSessionCreate(BaseModel):
    """Create a new observation session"""
    session_id: str
    name: str
    coach_id: Optional[str] = None
    observation_context: str = "training"  # "training" or "game"
    status: str = "draft"  # "planned", "draft", "active", "completed"
    planned_date: Optional[str] = None
    # Template configuration
    intervention_types: List[Dict[str, Any]] = []
    descriptor_group1: Optional[Dict[str, Any]] = None
    descriptor_group2: Optional[Dict[str, Any]] = None
    session_parts: List[Dict[str, Any]] = []
    # Runtime data
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_duration: Optional[float] = 0  # Accept float or int
    ball_rolling_time: Optional[float] = 0
    ball_not_rolling_time: Optional[float] = 0
    ball_rolling: bool = False
    active_part_id: Optional[str] = None
    # Events/interventions log
    events: List[Dict[str, Any]] = []
    ball_rolling_log: List[Dict[str, Any]] = []
    # Reflections
    observer_reflections: List[Dict[str, Any]] = []
    coach_reflections: List[Dict[str, Any]] = []
    session_notes: str = ""
    ai_summary: str = ""
    attachments: List[Dict[str, Any]] = []

class ObservationSessionResponse(BaseModel):
    session_id: str
    name: str
    coach_id: Optional[str] = None
    coach_name: Optional[str] = None
    observer_id: str
    observer_name: Optional[str] = None
    observation_context: str
    status: str
    planned_date: Optional[str] = None
    created_at: str
    updated_at: str
    # Include all session data
    intervention_types: List[Dict[str, Any]] = []
    descriptor_group1: Optional[Dict[str, Any]] = None
    descriptor_group2: Optional[Dict[str, Any]] = None
    session_parts: List[Dict[str, Any]] = []
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_duration: Optional[float] = 0  # Accept float
    ball_rolling_time: Optional[float] = 0
    ball_not_rolling_time: Optional[float] = 0
    events: List[Dict[str, Any]] = []
    ball_rolling_log: List[Dict[str, Any]] = []
    observer_reflections: List[Dict[str, Any]] = []
    coach_reflections: List[Dict[str, Any]] = []
    session_notes: str = ""
    ai_summary: str = ""
    attachments: List[Dict[str, Any]] = []

class SessionListItem(BaseModel):
    session_id: str
    name: str
    coach_id: Optional[str] = None
    coach_name: Optional[str] = None
    status: str
    observation_context: str
    planned_date: Optional[str] = None
    created_at: str
    updated_at: str
    total_duration: Optional[float] = 0  # Accept float
    event_count: int = 0

# ============================================
# END OBSERVATION SESSION MODELS
# ============================================

# ============================================
# REFLECTION TEMPLATE MODELS
# ============================================

class ReflectionQuestionBase(BaseModel):
    """Base question structure for reflection templates"""
    question_id: str
    question_text: str
    question_type: str  # "text", "scale", "dropdown", "checkbox"
    required: bool = False
    # For scale type
    scale_min: Optional[int] = 1
    scale_max: Optional[int] = 5
    scale_min_label: Optional[str] = None
    scale_max_label: Optional[str] = None
    # For dropdown/checkbox type
    options: Optional[List[str]] = []

class ReflectionTemplateCreate(BaseModel):
    """Create a new reflection template"""
    name: str
    target_role: str  # "coach_educator" or "coach"
    description: Optional[str] = None
    questions: List[ReflectionQuestionBase] = []
    is_default: bool = False

class ReflectionTemplateUpdate(BaseModel):
    """Update an existing reflection template"""
    name: Optional[str] = None
    description: Optional[str] = None
    questions: Optional[List[ReflectionQuestionBase]] = None
    is_default: Optional[bool] = None

class ReflectionTemplateResponse(BaseModel):
    template_id: str
    name: str
    target_role: str
    description: Optional[str] = None
    questions: List[Dict[str, Any]] = []
    is_default: bool = False
    created_by: str
    organization_id: Optional[str] = None
    created_at: str
    updated_at: str

# ============================================
# END REFLECTION TEMPLATE MODELS
# ============================================

# Default session parts (legacy - kept for backwards compatibility)
DEFAULT_SESSION_PARTS = [
    {"part_id": "part_1", "name": "Part 1", "is_default": True},
    {"part_id": "part_2", "name": "Part 2", "is_default": True},
    {"part_id": "part_3", "name": "Part 3", "is_default": True},
    {"part_id": "part_4", "name": "Part 4", "is_default": True},
]

# ============================================
# DEFAULT OBSERVATION WINDOW TEMPLATES
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
        # Check if templates already exist for this org
        existing_obs = await db.observation_templates.count_documents({"organization_id": org_id})
        if existing_obs == 0:
            # Create observation window templates
            training_template = get_default_training_template(org_id, user_id)
            match_day_template = get_default_match_day_template(org_id, user_id)
            
            await db.observation_templates.insert_one(training_template)
            await db.observation_templates.insert_one(match_day_template)
            logger.info(f"Created observation templates for org {org_id}")
        
        existing_ref = await db.reflection_templates.count_documents({"organization_id": org_id})
        if existing_ref == 0:
            # Create reflection templates
            coach_educator_template = get_default_coach_educator_reflection_template(org_id, user_id)
            coach_template = get_default_coach_reflection_template(org_id, user_id)
            
            await db.reflection_templates.insert_one(coach_educator_template)
            await db.reflection_templates.insert_one(coach_template)
            logger.info(f"Created reflection templates for org {org_id}")
        
        logger.info(f"Bootstrapped default templates for organization {org_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to bootstrap templates for org {org_id}: {e}")
        return False

# Password hashing helpers
def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def validate_password(password: str) -> tuple[bool, str]:
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
# COACH ROLE AUTHORIZATION HELPERS
# ============================================

async def require_coach(request: Request) -> "User":
    """
    Require authenticated user with coach role.
    Returns the user if authenticated and has coach role.
    Auto-creates coach profile if none exists.
    """
    user = await require_auth(request)
    if user.role != "coach":
        raise HTTPException(status_code=403, detail="Coach access required")
    
    # If no linked_coach_id, try to find or create one
    if not user.linked_coach_id:
        # Check if a coach profile exists with this user's email
        existing_coach = await db.coaches.find_one({"email": user.email}, {"_id": 0})
        
        if existing_coach and existing_coach.get("id"):
            # Link user to existing coach profile
            linked_coach_id = existing_coach.get("id")
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {"linked_coach_id": linked_coach_id}}
            )
            user.linked_coach_id = linked_coach_id
            logger.info(f"Linked user {user.email} to existing coach profile {linked_coach_id}")
        else:
            # Create new coach profile for this user (or fix broken one)
            coach_id = f"coach_{uuid.uuid4().hex[:12]}"
            
            if existing_coach:
                # Fix existing coach profile that has no id
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
                # Create brand new coach profile
                new_coach = {
                    "id": coach_id,
                    "user_id": user.user_id,
                    "organization_id": user.organization_id,  # Critical for data isolation
                    "name": user.name,
                    "email": user.email,
                    "photo": user.picture,
                    "targets": [],
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
                await db.coaches.insert_one(new_coach)
                logger.info(f"Created new coach profile {coach_id} for user {user.email}")
            
            # Link user to coach profile
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {"linked_coach_id": coach_id}}
            )
            user.linked_coach_id = coach_id
    
    return user

async def get_coach_profile_for_user(user: "User") -> Optional[Dict[str, Any]]:
    """Get the coach profile linked to a user"""
    if not user.linked_coach_id:
        return None
    # Coach profiles are stored in local storage on frontend, 
    # but we need a backend representation for server-side filtering
    coach = await db.coaches.find_one({"id": user.linked_coach_id}, {"_id": 0})
    return coach

async def verify_coach_owns_session(user: "User", session_id: str) -> Dict[str, Any]:
    """
    Verify a coach has access to a specific session.
    Returns the session if authorized, raises 403 if not.
    """
    session = await db.observation_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if this session belongs to the coach
    if session.get("coach_id") != user.linked_coach_id:
        raise HTTPException(status_code=403, detail="You do not have access to this session")
    
    return session

async def filter_coach_data(user: "User", query: Dict[str, Any]) -> Dict[str, Any]:
    """
    Add coach-specific filtering to a database query.
    Ensures coaches only see their own data.
    """
    if user.role == "coach":
        if not user.linked_coach_id:
            raise HTTPException(status_code=403, detail="No coach profile linked")
        query["coach_id"] = user.linked_coach_id
    return query

# ============================================
# END COACH AUTHORIZATION HELPERS
# ============================================

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
    # Use the direct registration link with invite token
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

async def send_email_with_retry(params: dict, email_type: str, max_retries: int = 3):
    """
    Send email with retry logic for resilience.
    Retries on transient failures, fails fast on permanent errors.
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
            
            # Don't retry on permanent errors (invalid API key, unverified domain, etc.)
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
            
            # Wait before retry (exponential backoff)
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.info(f"Waiting {wait_time}s before retry...")
                await asyncio.sleep(wait_time)
    
    # All retries exhausted
    raise last_error

# ============================================
# ROUTE MODULES (Modular Architecture)
# ============================================
# Import modular route files
# Note: These routes are being gradually migrated from this monolithic file.
# The routes below in server.py will be removed once migration is complete.

try:
    from routes.auth import router as auth_router
    api_router.include_router(auth_router)
    logger.info("Auth routes loaded from routes/auth.py")
except Exception as e:
    logger.warning(f"Could not load modular auth routes: {e}. Using inline routes.")

try:
    from routes.coaches import router as coaches_router
    api_router.include_router(coaches_router)
    logger.info("Coaches routes loaded from routes/coaches.py")
except Exception as e:
    logger.warning(f"Could not load modular coaches routes: {e}. Using inline routes.")

try:
    from routes.invites import router as invites_router
    api_router.include_router(invites_router)
    logger.info("Invites routes loaded from routes/invites.py")
except Exception as e:
    logger.warning(f"Could not load modular invites routes: {e}. Using inline routes.")

try:
    from routes.users import router as users_router
    api_router.include_router(users_router)
    logger.info("Users routes loaded from routes/users.py")
except Exception as e:
    logger.warning(f"Could not load modular users routes: {e}. Using inline routes.")

try:
    from routes.observations import router as observations_router
    api_router.include_router(observations_router)
    logger.info("Observations routes loaded from routes/observations.py")
except Exception as e:
    logger.warning(f"Could not load modular observations routes: {e}. Using inline routes.")

try:
    from routes.organization import router as organization_router
    api_router.include_router(organization_router)
    logger.info("Organization routes loaded from routes/organization.py")
except Exception as e:
    logger.warning(f"Could not load modular organization routes: {e}. Using inline routes.")

try:
    from routes.subscriptions import router as subscriptions_router
    api_router.include_router(subscriptions_router)
    logger.info("Subscriptions routes loaded from routes/subscriptions.py")
except Exception as e:
    logger.warning(f"Could not load subscriptions routes: {e}")

try:
    from routes.trial import router as trial_router
    api_router.include_router(trial_router)
    logger.info("Trial routes loaded from routes/trial.py")
except Exception as e:
    logger.warning(f"Could not load trial routes: {e}")

try:
    from routes.admin_templates import router as admin_templates_router
    api_router.include_router(admin_templates_router)
    logger.info("Admin templates routes loaded from routes/admin_templates.py")
except Exception as e:
    logger.warning(f"Could not load admin templates routes: {e}")

try:
    from routes.template_overrides import router as template_overrides_router
    api_router.include_router(template_overrides_router)
    logger.info("Template overrides routes loaded from routes/template_overrides.py")
except Exception as e:
    logger.warning(f"Could not load template overrides routes: {e}")

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.get("/config-check")
async def config_check():
    """Diagnostic endpoint to verify email configuration"""
    return {
        "sender_email": SENDER_EMAIL,
        "app_url": APP_URL,
        "resend_key_set": bool(resend.api_key),
        "resend_key_prefix": resend.api_key[:10] + "..." if resend.api_key else "NOT SET"
    }

@api_router.post("/upload", response_model=FileUploadResponse)
async def upload_file(request: Request, file: UploadFile = File(...)):
    """Upload a file and store it persistently in MongoDB"""
    user = await require_auth(request)
    
    try:
        file_id = str(uuid.uuid4())
        content = await file.read()
        
        # Limit file size to 16MB (MongoDB document limit minus overhead)
        max_size = 15 * 1024 * 1024  # 15MB to be safe
        if len(content) > max_size:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 15MB.")
        
        # Store file in MongoDB with base64 encoding
        file_doc = {
            "file_id": file_id,
            "filename": file.filename,
            "content_type": file.content_type or 'application/octet-stream',
            "size": len(content),
            "data": base64.b64encode(content).decode('utf-8'),
            "uploaded_by": user.user_id,
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.uploaded_files.insert_one(file_doc)
        
        return FileUploadResponse(
            id=file_id,
            name=file.filename,
            type=file.content_type or 'application/octet-stream',
            size=len(content),
            url=f"/api/files/{file_id}",
            uploadedAt=file_doc["uploaded_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@api_router.get("/files/{file_id}")
async def get_file(file_id: str):
    """Retrieve an uploaded file from MongoDB"""
    file_doc = await db.uploaded_files.find_one({"file_id": file_id}, {"_id": 0})
    
    if not file_doc:
        # Fallback: check local uploads folder for legacy files
        for f in UPLOAD_DIR.iterdir():
            if f.stem == file_id or f.name.startswith(file_id):
                return FileResponse(f)
        raise HTTPException(status_code=404, detail="File not found")
    
    # Decode base64 content
    content = base64.b64decode(file_doc["data"])
    
    return Response(
        content=content,
        media_type=file_doc.get("content_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{file_doc.get("filename", "download")}"'
        }
    )

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str, request: Request):
    """Delete an uploaded file from MongoDB"""
    user = await require_auth(request)
    
    # Try MongoDB first
    result = await db.uploaded_files.delete_one({"file_id": file_id})
    if result.deleted_count > 0:
        return {"status": "deleted"}
    
    # Fallback: check local uploads folder for legacy files
    for f in UPLOAD_DIR.iterdir():
        if f.stem == file_id:
            f.unlink()
            return {"status": "deleted"}
    
    raise HTTPException(status_code=404, detail="File not found")

# ============================================
# SPEECH-TO-TEXT ENDPOINT
# ============================================

@api_router.post("/speech-to-text")
async def transcribe_audio(request: Request, audio: UploadFile = File(...)):
    """
    Transcribe audio to text using OpenAI Whisper.
    Supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
    Max file size: 25MB
    """
    user = await require_auth(request)
    
    # Validate file type
    allowed_types = ['audio/mp3', 'audio/mp4', 'audio/mpeg', 'audio/mpga', 'audio/m4a', 
                     'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/x-wav',
                     'video/mp4', 'video/webm', 'application/octet-stream']
    allowed_extensions = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm']
    
    file_ext = Path(audio.filename).suffix.lower() if audio.filename else ''
    
    if audio.content_type not in allowed_types and file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported audio format. Supported: mp3, mp4, mpeg, mpga, m4a, wav, webm"
        )
    
    try:
        # Read audio content
        content = await audio.read()
        
        # Check file size (25MB limit)
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Audio file too large. Maximum size is 25MB.")
        
        # Initialize Whisper STT
        stt = OpenAISpeechToText(api_key=os.environ.get("EMERGENT_LLM_KEY"))
        
        # Create a temporary file with proper extension
        suffix = file_ext if file_ext else '.webm'
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_file:
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # Transcribe the audio
            with open(tmp_file_path, "rb") as audio_file:
                response = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="json",
                    language="en"  # Default to English, could be made configurable
                )
            
            logger.info(f"[speech-to-text] User {user.user_id} transcribed audio successfully")
            
            return {
                "success": True,
                "text": response.text,
                "language": "en"
            }
        finally:
            # Clean up temp file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[speech-to-text] Transcription error for user {user.user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

@api_router.post("/generate-summary", response_model=SessionSummaryResponse)
async def generate_session_summary(request: SessionSummaryRequest):
    """Generate an AI summary of the coaching observation session"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        # Calculate percentages
        total_time = request.ball_rolling_time + request.ball_not_rolling_time
        ball_rolling_pct = round((request.ball_rolling_time / total_time * 100) if total_time > 0 else 0)
        
        # Format duration
        def format_time(secs):
            mins = secs // 60
            secs_rem = secs % 60
            return f"{mins}m {secs_rem}s"
        
        # Build the prompt - concise version
        prompt = f"""Analyze this coaching observation and provide a brief developmental summary.

SESSION: {request.session_name} | DURATION: {format_time(request.total_duration)} | EVENTS: {request.total_events}
Ball Rolling: {ball_rolling_pct}% | Ball Stopped: {100 - ball_rolling_pct}%

INTERVENTIONS: {', '.join([f"{k}: {v}" for k, v in request.event_breakdown.items()])}
{request.descriptor1_name}: {', '.join([f"{k}: {v}" for k, v in request.descriptor1_breakdown.items()])}
{request.descriptor2_name}: {', '.join([f"{k}: {v}" for k, v in request.descriptor2_breakdown.items()])}
"""
        
        if request.coach_name:
            prompt += f"COACH: {request.coach_name}\n"
        
        if request.coach_targets and len(request.coach_targets) > 0:
            prompt += f"DEVELOPMENT TARGETS: {', '.join(request.coach_targets)}\n"
            prompt += "Reference these targets in your analysis.\n"
        
        if request.user_notes:
            prompt += f"OBSERVER NOTES: {request.user_notes}\n"
        
        prompt += """
Respond in plain text (no markdown/asterisks). Be concise - aim for ~150 words total.

SUMMARY (2-3 sentences on key patterns)

STRENGTHS (1-2 sentences)

AREAS TO DEVELOP (1-2 sentences)

2 REFLECTIVE QUESTIONS (numbered)"""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"session-summary-{uuid.uuid4()}",
            system_message="You are a coach educator. Provide brief, constructive feedback. No markdown or asterisks."
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Clean any remaining asterisks from the response
        clean_response = response.replace('*', '').replace('**', '')
        
        return SessionSummaryResponse(summary=clean_response)
        
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

@api_router.post("/generate-coach-trends", response_model=CoachTrendResponse)
async def generate_coach_trends(request: CoachTrendRequest):
    """Generate an AI summary of coaching trends across multiple sessions"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        sessions_text = ""
        for i, session in enumerate(request.sessions_data, 1):
            sessions_text += f"""
Session {i}: {session.get('name', 'Unnamed')} ({session.get('date', 'Unknown date')})
Duration: {session.get('duration', 'Unknown')}
Events: {session.get('events', 0)}
Ball Rolling: {session.get('ballRollingPct', 0)}%
Key interventions: {session.get('interventions', 'Not recorded')}
"""
        
        targets_text = ""
        if request.current_targets:
            targets_text = "\nCURRENT DEVELOPMENT TARGETS:\n" + "\n".join([f"{i}. {t}" for i, t in enumerate(request.current_targets, 1)])
        
        prompt = f"""You are a coach educator assistant. Analyze the observation data across multiple sessions for {request.coach_name} and identify trends, patterns, and development over time.

IMPORTANT FORMATTING RULES:
- Do NOT use asterisks, bullet points with *, or markdown formatting
- Write in clear paragraphs with natural flow
- Use numbered lists only where appropriate
- Keep language conversational and professional

COACH: {request.coach_name}
TOTAL SESSIONS OBSERVED: {len(request.sessions_data)}

SESSION HISTORY:
{sessions_text}
{targets_text}

Please provide your response in this structure (use plain text, no markdown):

OVERALL SUMMARY
Write 1-2 paragraphs summarizing this coach's observation history.

PATTERNS AND TRENDS
Write 1-2 paragraphs identifying consistent patterns or changes over time in their coaching approach.

PROGRESS ON TARGETS
If targets are listed, comment on observable progress or areas still needing attention.

DEVELOPMENT RECOMMENDATIONS
Write 1 paragraph with 2-3 specific recommendations for continued development.

Keep the tone professional, supportive, and developmental throughout."""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"coach-trends-{uuid.uuid4()}",
            system_message="You are a supportive coach educator assistant that helps identify development trends and patterns. Your feedback is always constructive and focused on growth. Never use asterisks or markdown formatting."
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Clean any remaining asterisks
        clean_response = response.replace('*', '').replace('**', '')
        
        return CoachTrendResponse(trend_summary=clean_response)
        
    except Exception as e:
        logger.error(f"Error generating trends: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate trends: {str(e)}")

# Auth helper function
async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token in cookie or Authorization header"""
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        return None
    
    # Find session in database
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    # Check expiry - if no expires_at, treat as valid (legacy sessions)
    expires_at = session_doc.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        return None
    
    # Convert datetime if needed
    if isinstance(user_doc.get("created_at"), str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    
    return User(**user_doc)

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

# ============================================
# AUTH API - MOVED TO routes/auth.py
# ============================================

# COACHES API - MOVED TO routes/coaches.py
# ============================================


# ============================================
# INVITES API - MOVED TO routes/invites.py
# ============================================

# ============================================
# USERS API - MOVED TO routes/users.py
# ============================================


# ============================================
# OBSERVATIONS API - MOVED TO routes/observations.py
# ============================================


# ============================================
# ORGANIZATION API - MOVED TO routes/organization.py
# ============================================

# Session Parts endpoints
@api_router.get("/session-parts", response_model=List[SessionPartResponse])
async def get_session_parts(request: Request):
    """Get all session parts (system defaults + organization's custom parts)"""
    user = await require_auth(request)
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    # Initialize system defaults if not present (these have no organization_id and is_system_default=True)
    existing_system_defaults = await db.session_parts.find({"is_system_default": True}, {"_id": 0}).to_list(100)
    existing_ids = {p["part_id"] for p in existing_system_defaults}
    
    # Add missing system defaults
    for default_part in DEFAULT_SESSION_PARTS:
        if default_part["part_id"] not in existing_ids:
            await db.session_parts.insert_one({
                **default_part,
                "is_system_default": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Query: Get system defaults OR parts belonging to user's organization
    if org_id:
        query = {
            "$or": [
                {"is_system_default": True},
                {"organization_id": org_id}
            ]
        }
    else:
        # No org - only show system defaults and parts created by this user
        query = {
            "$or": [
                {"is_system_default": True},
                {"created_by": user.user_id}
            ]
        }
    
    parts = await db.session_parts.find(query, {"_id": 0}).to_list(200)
    
    return [
        SessionPartResponse(
            part_id=p["part_id"],
            name=p["name"],
            is_default=p.get("is_default", False) or p.get("is_system_default", False),
            created_by=p.get("created_by"),
            created_at=p.get("created_at", "")
        )
        for p in parts
    ]

@api_router.get("/session-parts/defaults", response_model=List[SessionPartResponse])
async def get_default_session_parts(request: Request):
    """Get default session parts (system defaults + organization defaults)"""
    user = await require_auth(request)
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    # Initialize system defaults if not present
    existing_system_defaults = await db.session_parts.find({"is_system_default": True}, {"_id": 0}).to_list(100)
    existing_ids = {p["part_id"] for p in existing_system_defaults}
    
    for default_part in DEFAULT_SESSION_PARTS:
        if default_part["part_id"] not in existing_ids:
            await db.session_parts.insert_one({
                **default_part,
                "is_system_default": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Query: Get system defaults OR organization defaults
    if org_id:
        query = {
            "$or": [
                {"is_system_default": True},
                {"organization_id": org_id, "is_default": True}
            ]
        }
    else:
        query = {"is_system_default": True}
    
    parts = await db.session_parts.find(query, {"_id": 0}).to_list(100)
    
    return [
        SessionPartResponse(
            part_id=p["part_id"],
            name=p["name"],
            is_default=True,
            created_by=p.get("created_by"),
            created_at=p.get("created_at", "")
        )
        for p in parts
    ]

@api_router.get("/session-parts/historical")
async def get_historical_session_parts(request: Request):
    """Get unique session parts used in past observations (for adding parts to edited sessions)"""
    user = await require_auth(request)
    
    # Get all observations for this organization
    observations = await db.observations.find(
        {"organization_id": user.organization_id},
        {"session_parts": 1, "_id": 0}
    ).to_list(1000)
    
    # Extract unique part names from all observations
    seen_names = set()
    historical_parts = []
    
    for obs in observations:
        for part in obs.get("session_parts", []):
            part_name = part.get("name", "")
            if part_name and part_name not in seen_names:
                seen_names.add(part_name)
                historical_parts.append({
                    "part_id": part.get("id", f"hist_{uuid.uuid4().hex[:8]}"),
                    "name": part_name,
                    "is_default": False,
                    "source": "historical"
                })
    
    return historical_parts

@api_router.post("/session-parts", response_model=SessionPartResponse)
async def create_session_part(part_data: SessionPartCreate, request: Request):
    """Create a new session part (Coach Developer only for defaults)
    
    Parts marked as 'is_default' become organization-wide defaults,
    visible to all users in the same organization.
    """
    user = await require_auth(request)
    
    # Only Coach Developers can create default parts
    if part_data.is_default and user.role != "coach_developer":
        raise HTTPException(status_code=403, detail="Only Coach Developers can create default session parts")
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    # Check if name already exists within the organization (or globally for system defaults)
    if org_id:
        existing = await db.session_parts.find_one({
            "name": part_data.name,
            "$or": [
                {"organization_id": org_id},
                {"is_system_default": True}
            ]
        }, {"_id": 0})
    else:
        existing = await db.session_parts.find_one({"name": part_data.name}, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="Session part with this name already exists")
    
    part_id = f"part_{uuid.uuid4().hex[:12]}"
    new_part = {
        "part_id": part_id,
        "name": part_data.name,
        "is_default": part_data.is_default,
        "organization_id": org_id,  # Store organization for isolation
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.session_parts.insert_one(new_part)
    
    return SessionPartResponse(
        part_id=part_id,
        name=part_data.name,
        is_default=part_data.is_default,
        created_by=user.user_id,
        created_at=new_part["created_at"]
    )

@api_router.delete("/session-parts/{part_id}")
async def delete_session_part(part_id: str, request: Request):
    """Delete a custom session part (Coach Developer only, within own organization)"""
    user = await require_coach_developer(request)
    
    # Check if it's a built-in default
    builtin_ids = {p["part_id"] for p in DEFAULT_SESSION_PARTS}
    if part_id in builtin_ids:
        raise HTTPException(status_code=400, detail="Cannot delete built-in default session parts")
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    # Only delete parts from the user's organization
    if org_id:
        result = await db.session_parts.delete_one({
            "part_id": part_id,
            "organization_id": org_id
        })
    else:
        # Fallback: delete by created_by
        result = await db.session_parts.delete_one({
            "part_id": part_id,
            "created_by": user.user_id
        })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session part not found or not authorized to delete")
    
    return {"status": "deleted"}

# ============================================
# COACH ROLE API ENDPOINTS
# ============================================

@api_router.get("/coach/dashboard", response_model=CoachDashboardResponse)
async def get_coach_dashboard(request: Request):
    """
    Get aggregated dashboard data for a coach.
    Returns profile, targets, upcoming observations, and recent session.
    """
    user = await require_coach(request)
    
    # Get coach profile from coaches collection
    coach = await db.coaches.find_one({"id": user.linked_coach_id}, {"_id": 0})
    if not coach:
        # Create a minimal profile if doesn't exist in DB
        coach = {
            "id": user.linked_coach_id,
            "name": user.name,
            "email": user.email,
            "photo": user.picture,
            "targets": []
        }
    
    profile = CoachProfileResponse(
        id=coach.get("id", user.linked_coach_id),
        name=coach.get("name", user.name),
        email=coach.get("email", user.email),
        photo=coach.get("photo") or user.picture,
        role_title=coach.get("role_title"),
        age_group=coach.get("age_group"),
        department=coach.get("department"),
        bio=coach.get("bio"),
        targets=coach.get("targets", []),
        created_at=coach.get("createdAt"),
        updated_at=coach.get("updatedAt")
    )
    
    # Get active targets - filter out achieved and targets without text
    targets = [t for t in coach.get("targets", []) if t.get("status") != "achieved" and t.get("text")]
    
    # Get upcoming scheduled observations for this coach
    # Check both scheduled_observations collection AND observation_sessions with status='planned'
    
    # First, check scheduled_observations
    upcoming_obs = await db.scheduled_observations.find({
        "coach_id": user.linked_coach_id,
        "status": "scheduled"
    }, {"_id": 0}).sort("scheduled_date", 1).limit(5).to_list(5)
    
    # Also check observation_sessions with status='planned' for this coach
    planned_sessions = await db.observation_sessions.find({
        "coach_id": user.linked_coach_id,
        "status": "planned"
    }, {"_id": 0}).sort("planned_date", 1).limit(5).to_list(5)
    
    upcoming_observations = []
    
    # Add scheduled observations
    for obs in upcoming_obs:
        observer = await db.users.find_one({"user_id": obs.get("observer_id")}, {"_id": 0, "name": 1})
        upcoming_observations.append(ScheduledObservationResponse(
            schedule_id=obs.get("schedule_id"),
            coach_id=obs.get("coach_id"),
            observer_id=obs.get("observer_id"),
            observer_name=observer.get("name") if observer else None,
            scheduled_date=obs.get("scheduled_date"),
            session_context=obs.get("session_context"),
            status=obs.get("status"),
            created_at=obs.get("created_at", "")
        ))
    
    # Add planned observation sessions (convert to same format)
    for session in planned_sessions:
        observer = await db.users.find_one({"user_id": session.get("observer_id")}, {"_id": 0, "name": 1})
        upcoming_observations.append(ScheduledObservationResponse(
            schedule_id=session.get("session_id"),  # Use session_id as schedule_id
            coach_id=session.get("coach_id"),
            observer_id=session.get("observer_id"),
            observer_name=observer.get("name") if observer else None,
            scheduled_date=session.get("planned_date"),  # Use planned_date
            session_context=session.get("observation_context"),
            status="planned",
            created_at=session.get("created_at", "")
        ))
    
    # Get most recent session for this coach
    recent_session = await db.sessions.find_one(
        {"coach_id": user.linked_coach_id},
        {"_id": 0}
    )
    # Sort by date descending - get most recent
    sessions_cursor = db.sessions.find(
        {"coach_id": user.linked_coach_id},
        {"_id": 0}
    ).sort("date", -1).limit(1)
    sessions_list = await sessions_cursor.to_list(1)
    recent_session = sessions_list[0] if sessions_list else None
    
    # Check if there's a pending reflection
    has_pending_reflection = False
    pending_reflection_session_id = None
    
    if recent_session:
        # Check if a reflection exists for this session
        reflection = await db.reflections.find_one({
            "session_id": recent_session.get("session_id"),
            "coach_id": user.linked_coach_id
        }, {"_id": 0})
        
        if not reflection:
            has_pending_reflection = True
            pending_reflection_session_id = recent_session.get("session_id")
    
    return CoachDashboardResponse(
        profile=profile,
        targets=targets,
        upcoming_observations=upcoming_observations,
        recent_session=recent_session,
        has_pending_reflection=has_pending_reflection,
        pending_reflection_session_id=pending_reflection_session_id
    )

@api_router.get("/coach/sessions")
async def get_coach_sessions(request: Request):
    """
    Get all sessions belonging to the authenticated coach.
    Returns a list of session summaries.
    """
    user = await require_coach(request)
    
    # Get all sessions for this coach
    sessions_cursor = db.sessions.find(
        {"coach_id": user.linked_coach_id},
        {"_id": 0}
    ).sort("date", -1)
    
    sessions = await sessions_cursor.to_list(100)
    
    if not sessions:
        return []
    
    # Batch fetch reflections to avoid N+1 queries
    session_ids = [s.get("session_id") for s in sessions]
    reflections = await db.reflections.find(
        {"session_id": {"$in": session_ids}, "coach_id": user.linked_coach_id},
        {"_id": 0, "session_id": 1}
    ).to_list(100)
    reflection_session_ids = {r["session_id"] for r in reflections}
    
    # Batch fetch observers to avoid N+1 queries
    observer_ids = list(set(s.get("observer_id") for s in sessions if s.get("observer_id")))
    observers_map = {}
    if observer_ids:
        observers = await db.users.find(
            {"user_id": {"$in": observer_ids}},
            {"_id": 0, "user_id": 1, "name": 1}
        ).to_list(100)
        observers_map = {o["user_id"]: o.get("name") for o in observers}
    
    result = []
    for session in sessions:
        session_id = session.get("session_id")
        has_observation = bool(session.get("observations") or session.get("ai_summary"))
        has_reflection = session_id in reflection_session_ids
        observer_name = observers_map.get(session.get("observer_id"))
        
        result.append({
            "session_id": session_id,
            "title": session.get("title", "Untitled Session"),
            "date": session.get("date", session.get("createdAt", "")),
            "observer_name": observer_name,
            "has_observation": has_observation,
            "has_reflection": has_reflection,
            "summary_preview": (session.get("ai_summary", "") or "")[:150] + "..." if session.get("ai_summary") else None
        })
    
    return result

@api_router.get("/coach/calendar")
async def get_coach_calendar_sessions(request: Request):
    """
    Get all sessions for the authenticated coach in calendar format.
    Returns both scheduled (upcoming) and historic observations for the coach.
    """
    user = await require_coach(request)
    coach_id = user.linked_coach_id
    
    # Get all observation sessions where this coach was observed
    sessions_cursor = db.sessions.find(
        {"coach_id": coach_id},
        {"_id": 0}
    ).sort("created_at", -1)
    
    sessions = await sessions_cursor.to_list(200)
    
    # Also get scheduled observations for this coach
    scheduled_obs = await db.scheduled_observations.find(
        {"coach_id": coach_id},
        {"_id": 0}
    ).to_list(50)
    
    result = []
    
    # Add historic/completed sessions
    for session in sessions:
        result.append({
            "id": session.get("session_id"),
            "name": session.get("name") or session.get("title", "Untitled Session"),
            "coachId": session.get("coach_id"),
            "coachName": user.name,
            "status": session.get("status", "completed"),
            "observationContext": session.get("observation_context"),
            "createdAt": session.get("created_at") or session.get("createdAt"),
            "updatedAt": session.get("updated_at") or session.get("updatedAt"),
            "plannedDate": session.get("planned_date"),
            "totalDuration": session.get("total_duration", 0),
            "events": session.get("events", [])
        })
    
    # Add scheduled observations as planned sessions
    for obs in scheduled_obs:
        # Check if this scheduled observation is already in sessions
        existing = any(s["id"] == obs.get("id") for s in result)
        if not existing and obs.get("status") == "scheduled":
            result.append({
                "id": obs.get("id") or f"sched_{obs.get('_id', '')}",
                "name": obs.get("title", "Scheduled Observation"),
                "coachId": obs.get("coach_id"),
                "coachName": user.name,
                "status": "planned",
                "observationContext": obs.get("observation_context"),
                "createdAt": obs.get("created_at"),
                "updatedAt": obs.get("updated_at"),
                "plannedDate": obs.get("scheduled_date"),
                "totalDuration": 0,
                "events": []
            })
    
    return result

@api_router.get("/coach/session/{session_id}")
async def get_coach_session_detail(session_id: str, request: Request):
    """
    Get detailed session information for a coach.
    Only returns the session if it belongs to the authenticated coach.
    """
    user = await require_coach(request)
    
    # Verify coach owns this session
    session = await verify_coach_owns_session(user, session_id)
    
    # Get coach's own reflection if exists
    reflection = await db.reflections.find_one({
        "session_id": session_id,
        "coach_id": user.linked_coach_id
    }, {"_id": 0})
    
    # Get observer details if available
    observer_name = None
    if session.get("observer_id"):
        observer = await db.users.find_one({"user_id": session.get("observer_id")}, {"_id": 0, "name": 1})
        observer_name = observer.get("name") if observer else None
    
    # Get observer reflections from the session (these are stored in the session document)
    observer_reflections = session.get("observer_reflections", [])
    
    return {
        "session": session,
        "reflection": reflection,
        "observer_name": observer_name,
        "observer_reflections": observer_reflections,
        "can_add_reflection": reflection is None
    }

@api_router.post("/coach/reflections", response_model=ReflectionResponse)
async def create_reflection(reflection_data: ReflectionCreate, request: Request):
    """
    Create a reflection for a session.
    Coaches can only create reflections for their own sessions.
    """
    user = await require_coach(request)
    
    # Verify coach owns this session
    await verify_coach_owns_session(user, reflection_data.session_id)
    
    # Check if reflection already exists
    existing = await db.reflections.find_one({
        "session_id": reflection_data.session_id,
        "coach_id": user.linked_coach_id
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="A reflection already exists for this session")
    
    reflection_id = f"ref_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    reflection = {
        "reflection_id": reflection_id,
        "session_id": reflection_data.session_id,
        "coach_id": user.linked_coach_id,
        "content": reflection_data.content,
        "self_assessment_rating": reflection_data.self_assessment_rating,
        "strengths": reflection_data.strengths,
        "areas_for_development": reflection_data.areas_for_development,
        "created_at": now,
        "updated_at": None
    }
    
    await db.reflections.insert_one(reflection)
    logger.info(f"Reflection created for session {reflection_data.session_id} by coach {user.linked_coach_id}")
    
    return ReflectionResponse(**reflection)

@api_router.put("/coach/reflections/{reflection_id}", response_model=ReflectionResponse)
async def update_reflection(reflection_id: str, reflection_data: ReflectionCreate, request: Request):
    """
    Update an existing reflection.
    Coaches can only update their own reflections.
    """
    user = await require_coach(request)
    
    # Find the reflection
    reflection = await db.reflections.find_one({"reflection_id": reflection_id}, {"_id": 0})
    if not reflection:
        raise HTTPException(status_code=404, detail="Reflection not found")
    
    # Verify coach owns this reflection
    if reflection.get("coach_id") != user.linked_coach_id:
        raise HTTPException(status_code=403, detail="You do not have access to this reflection")
    
    # Update the reflection
    now = datetime.now(timezone.utc).isoformat()
    update_data = {
        "content": reflection_data.content,
        "self_assessment_rating": reflection_data.self_assessment_rating,
        "strengths": reflection_data.strengths,
        "areas_for_development": reflection_data.areas_for_development,
        "updated_at": now
    }
    
    await db.reflections.update_one(
        {"reflection_id": reflection_id},
        {"$set": update_data}
    )
    
    # Return updated reflection
    updated = await db.reflections.find_one({"reflection_id": reflection_id}, {"_id": 0})
    return ReflectionResponse(**updated)

@api_router.get("/coach/profile", response_model=CoachProfileResponse)
async def get_coach_profile(request: Request):
    """Get the authenticated coach's profile"""
    user = await require_coach(request)
    
    coach = await db.coaches.find_one({"id": user.linked_coach_id}, {"_id": 0})
    if not coach:
        # Return minimal profile from user data
        return CoachProfileResponse(
            id=user.linked_coach_id,
            name=user.name,
            email=user.email,
            photo=user.picture,
            targets=[]
        )
    
    return CoachProfileResponse(
        id=coach.get("id"),
        name=coach.get("name", user.name),
        email=coach.get("email", user.email),
        photo=coach.get("photo") or user.picture,
        role_title=coach.get("role_title"),
        age_group=coach.get("age_group"),
        department=coach.get("department"),
        bio=coach.get("bio"),
        targets=coach.get("targets", []),
        created_at=coach.get("createdAt"),
        updated_at=coach.get("updatedAt")
    )

@api_router.put("/coach/profile", response_model=CoachProfileResponse)
async def update_coach_profile(profile_data: CoachProfileUpdate, request: Request):
    """
    Update coach profile with limited editable fields.
    Coaches cannot edit system-level fields like permissions or role.
    """
    user = await require_coach(request)
    
    # Build update document with only allowed fields
    update_fields = {}
    if profile_data.photo is not None:
        update_fields["photo"] = profile_data.photo
    if profile_data.role_title is not None:
        update_fields["role_title"] = profile_data.role_title
    if profile_data.age_group is not None:
        update_fields["age_group"] = profile_data.age_group
    if profile_data.department is not None:
        update_fields["department"] = profile_data.department
    if profile_data.bio is not None:
        update_fields["bio"] = profile_data.bio
    
    update_fields["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    # Upsert the coach profile
    await db.coaches.update_one(
        {"id": user.linked_coach_id},
        {"$set": update_fields},
        upsert=True
    )
    
    logger.info(f"Coach profile updated for {user.linked_coach_id}")
    
    # Return updated profile
    return await get_coach_profile(request)


@api_router.get("/coach/analytics")
async def get_coach_analytics(request: Request):
    """Get aggregated analytics for the authenticated coach's sessions"""
    import math
    from dependencies import get_data_retention_info
    
    user = await require_coach(request)
    
    # Get data retention info for the user
    retention_info = await get_data_retention_info(user.user_id)
    
    # Build query - filter by date if user has limited retention
    query = {"coach_id": user.linked_coach_id}
    if retention_info["is_limited"] and retention_info["cutoff_date"]:
        query["created_at"] = {"$gte": retention_info["cutoff_date"].isoformat()}
    
    # Fetch sessions with full event data for this coach
    # Include both snake_case and camelCase field names for backwards compatibility
    sessions = await db.observation_sessions.find(
        query,
        {"_id": 0, "session_id": 1, "events": 1, 
         "ball_rolling_time": 1, "ball_not_rolling_time": 1, 
         "ballRollingTime": 1, "ballNotRollingTime": 1,
         "session_parts": 1, "sessionParts": 1,
         "total_duration": 1, "totalDuration": 1, "created_at": 1}
    ).to_list(length=1000)
    
    # Count hidden sessions for upgrade prompt
    hidden_sessions_count = 0
    if retention_info["is_limited"] and retention_info["cutoff_date"]:
        hidden_sessions_count = await db.observation_sessions.count_documents({
            "coach_id": user.linked_coach_id,
            "created_at": {"$lt": retention_info["cutoff_date"].isoformat()}
        })
    
    total_sessions = len(sessions)
    total_interventions = 0
    total_ball_rolling = 0
    total_ball_stopped = 0
    total_duration = 0
    intervention_type_count = {}
    intervention_combinations = {}
    
    for session in sessions:
        events = session.get("events", [])
        total_interventions += len(events)
        
        # Ball rolling stats - check multiple sources for backwards compatibility:
        # 1. Top-level snake_case fields (new format)
        # 2. Top-level camelCase fields (legacy format)
        # 3. Aggregate from session parts (most reliable if parts have data)
        
        ball_rolling = 0
        ball_stopped = 0
        
        # First try to aggregate from session parts (most accurate)
        session_parts = session.get("session_parts") or session.get("sessionParts") or []
        if session_parts:
            for part in session_parts:
                ball_rolling += part.get("ball_rolling_time") or part.get("ballRollingTime") or 0
                ball_stopped += part.get("ball_not_rolling_time") or part.get("ballNotRollingTime") or 0
        
        # If parts don't have the data, fall back to top-level fields
        if ball_rolling == 0 and ball_stopped == 0:
            ball_rolling = session.get("ball_rolling_time") or session.get("ballRollingTime") or 0
            ball_stopped = session.get("ball_not_rolling_time") or session.get("ballNotRollingTime") or 0
        
        total_ball_rolling += ball_rolling
        total_ball_stopped += ball_stopped
        total_duration += session.get("total_duration") or session.get("totalDuration") or 0
        
        # Count intervention types
        for event in events:
            type_name = event.get("eventTypeName") or event.get("eventTypeId") or "Unknown"
            intervention_type_count[type_name] = intervention_type_count.get(type_name, 0) + 1
            
            # Track combinations for pattern analysis
            desc1 = ", ".join(event.get("descriptors1", [])) or "None"
            desc2 = ", ".join(event.get("descriptors2", [])) or "None"
            combo = f"{type_name}|{desc1}|{desc2}"
            intervention_combinations[combo] = intervention_combinations.get(combo, 0) + 1
    
    # Calculate averages
    avg_per_session = round(total_interventions / total_sessions, 1) if total_sessions > 0 else 0
    # Fix: Calculate ball rolling percentage from ball rolling + ball stopped times, not total session duration
    total_ball_time = total_ball_rolling + total_ball_stopped
    avg_ball_rolling = round((total_ball_rolling / total_ball_time) * 100) if total_ball_time > 0 else 0
    
    # Build intervention distribution chart data
    intervention_chart_data = [
        {
            "name": name,
            "count": count,
            "percentage": round((count / total_interventions) * 100) if total_interventions > 0 else 0
        }
        for name, count in sorted(intervention_type_count.items(), key=lambda x: -x[1])
    ]
    
    # Calculate variety score using Normalized Shannon Entropy (Pielou's Evenness)
    variety_percentage = 0
    num_types = len(intervention_type_count)
    
    if num_types > 1 and total_interventions > 0:
        shannon_entropy = 0
        for count in intervention_type_count.values():
            if count > 0:
                p = count / total_interventions
                shannon_entropy -= p * math.log(p)
        max_entropy = math.log(num_types)
        if max_entropy > 0:
            variety_percentage = round((shannon_entropy / max_entropy) * 100)
    
    # Get most common pattern
    sorted_combos = sorted(intervention_combinations.items(), key=lambda x: -x[1])
    most_common_pattern = None
    if sorted_combos:
        pattern_name = sorted_combos[0][0].split("|")[0]
        most_common_pattern = {
            "pattern": pattern_name,
            "count": sorted_combos[0][1]
        }
    
    return {
        "total_sessions": total_sessions,
        "total_interventions": total_interventions,
        "avg_per_session": avg_per_session,
        "avg_ball_rolling": avg_ball_rolling,
        "total_ball_rolling_time": total_ball_rolling,
        "total_ball_stopped_time": total_ball_stopped,
        "intervention_chart_data": intervention_chart_data,
        "variety_percentage": variety_percentage,
        "most_common_pattern": most_common_pattern,
        "data_retention": {
            "is_limited": retention_info["is_limited"],
            "months_limit": retention_info["months_limit"],
            "hidden_sessions_count": hidden_sessions_count,
            "tier": retention_info["tier"],
            "upgrade_message": f"Analytics based on last {retention_info['months_limit']} months. You have {hidden_sessions_count} older sessions. Upgrade to see complete history." if hidden_sessions_count > 0 else None
        }
    }


@api_router.get("/coach/targets")
async def get_coach_targets(request: Request):
    """Get all targets for the authenticated coach"""
    user = await require_coach(request)
    
    coach = await db.coaches.find_one({"id": user.linked_coach_id}, {"_id": 0, "targets": 1})
    targets = coach.get("targets", []) if coach else []
    
    return {"targets": targets}

@api_router.post("/coach/targets")
async def add_coach_target(request: Request, target_data: dict):
    """Add a new target for the authenticated coach"""
    user = await require_coach(request)
    
    target_text = target_data.get("text", "").strip()
    if not target_text:
        raise HTTPException(status_code=400, detail="Target text is required")
    
    target_id = f"target_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    new_target = {
        "id": target_id,
        "text": target_text,
        "status": "active",
        "created_at": now,
        "updated_at": now
    }
    
    await db.coaches.update_one(
        {"id": user.linked_coach_id},
        {"$push": {"targets": new_target}}
    )
    
    logger.info(f"Target {target_id} added for coach {user.linked_coach_id}")
    return new_target

@api_router.put("/coach/targets/{target_id}")
async def update_coach_target(target_id: str, request: Request, target_data: dict):
    """Update a target for the authenticated coach"""
    user = await require_coach(request)
    
    # Find the coach and target
    coach = await db.coaches.find_one({"id": user.linked_coach_id}, {"_id": 0, "targets": 1})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    targets = coach.get("targets", [])
    target_index = next((i for i, t in enumerate(targets) if t.get("id") == target_id), None)
    
    if target_index is None:
        raise HTTPException(status_code=404, detail="Target not found")
    
    # Update target fields
    now = datetime.now(timezone.utc).isoformat()
    
    if "text" in target_data:
        targets[target_index]["text"] = target_data["text"].strip()
    if "status" in target_data:
        targets[target_index]["status"] = target_data["status"]
    targets[target_index]["updated_at"] = now
    
    await db.coaches.update_one(
        {"id": user.linked_coach_id},
        {"$set": {"targets": targets}}
    )
    
    logger.info(f"Target {target_id} updated for coach {user.linked_coach_id}")
    return targets[target_index]

@api_router.delete("/coach/targets/{target_id}")
async def delete_coach_target(target_id: str, request: Request):
    """Delete a target for the authenticated coach"""
    user = await require_coach(request)
    
    result = await db.coaches.update_one(
        {"id": user.linked_coach_id},
        {"$pull": {"targets": {"id": target_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Target not found")
    
    logger.info(f"Target {target_id} deleted for coach {user.linked_coach_id}")
    return {"success": True}

# Scheduled Observations - for Coach Developers to schedule, Coaches to view
@api_router.post("/scheduled-observations", response_model=ScheduledObservationResponse)
async def create_scheduled_observation(obs_data: ScheduledObservationCreate, request: Request):
    """Create a scheduled observation (Coach Developer only)"""
    user = await require_coach_developer(request)
    
    schedule_id = f"sched_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    # Get coach name
    coach = await db.coaches.find_one({"id": obs_data.coach_id}, {"_id": 0, "name": 1})
    coach_name = coach.get("name") if coach else None
    
    scheduled_obs = {
        "schedule_id": schedule_id,
        "coach_id": obs_data.coach_id,
        "observer_id": user.user_id,
        "scheduled_date": obs_data.scheduled_date,
        "session_context": obs_data.session_context,
        "status": "scheduled",
        "created_at": now
    }
    
    await db.scheduled_observations.insert_one(scheduled_obs)
    logger.info(f"Scheduled observation created for coach {obs_data.coach_id} by {user.user_id}")
    
    return ScheduledObservationResponse(
        schedule_id=schedule_id,
        coach_id=obs_data.coach_id,
        coach_name=coach_name,
        observer_id=user.user_id,
        observer_name=user.name,
        scheduled_date=obs_data.scheduled_date,
        session_context=obs_data.session_context,
        status="scheduled",
        created_at=now
    )

@api_router.get("/scheduled-observations")
async def list_scheduled_observations(request: Request):
    """List scheduled observations - filtered by role"""
    user = await require_auth(request)
    
    query = {"status": "scheduled"}
    
    # Coaches only see their own scheduled observations
    if user.role == "coach":
        if not user.linked_coach_id:
            return []
        query["coach_id"] = user.linked_coach_id
    
    obs_list = await db.scheduled_observations.find(query, {"_id": 0}).sort("scheduled_date", 1).to_list(50)
    
    if not obs_list:
        return []
    
    # Batch fetch coaches and observers to avoid N+1 queries
    coach_ids = list(set(o.get("coach_id") for o in obs_list if o.get("coach_id")))
    observer_ids = list(set(o.get("observer_id") for o in obs_list if o.get("observer_id")))
    
    coaches_map = {}
    if coach_ids:
        coaches = await db.coaches.find(
            {"id": {"$in": coach_ids}},
            {"_id": 0, "id": 1, "name": 1}
        ).to_list(50)
        coaches_map = {c["id"]: c.get("name") for c in coaches}
    
    observers_map = {}
    if observer_ids:
        observers = await db.users.find(
            {"user_id": {"$in": observer_ids}},
            {"_id": 0, "user_id": 1, "name": 1}
        ).to_list(50)
        observers_map = {o["user_id"]: o.get("name") for o in observers}
    
    result = []
    for obs in obs_list:
        result.append(ScheduledObservationResponse(
            schedule_id=obs.get("schedule_id"),
            coach_id=obs.get("coach_id"),
            coach_name=coaches_map.get(obs.get("coach_id")),
            observer_id=obs.get("observer_id"),
            observer_name=observers_map.get(obs.get("observer_id")),
            scheduled_date=obs.get("scheduled_date"),
            session_context=obs.get("session_context"),
            status=obs.get("status"),
            created_at=obs.get("created_at", "")
        ))
    
    return result

# ============================================
# END COACH ROLE API ENDPOINTS
# ============================================

# ============================================
# ADMIN API ENDPOINTS
# ============================================

@api_router.get("/admin/organizations")
async def admin_list_organizations(request: Request, include_archived: bool = False):
    """List all organizations (Admin only)"""
    await require_admin(request)
    
    # Build query based on whether to include archived orgs
    query = {} if include_archived else {"status": {"$ne": "archived"}}
    orgs = await db.organizations.find(query, {"_id": 0}).to_list(1000)
    
    # Get subscription tiers for limit lookups
    tiers = await db.subscription_tiers.find({}, {"_id": 0}).to_list(100)
    tier_map = {t["tier_id"]: t for t in tiers} if tiers else {}
    
    # Default tier limits if not in DB
    default_tiers = {
        "individual": {"coaches_limit": 5, "admins_limit": 1, "data_retention_months": 3},
        "developer": {"coaches_limit": 10, "admins_limit": 1, "data_retention_months": None},
        "club": {"coaches_limit": 30, "admins_limit": 5, "data_retention_months": None}
    }
    
    # Get user and coach counts for each organization
    result = []
    for org in orgs:
        org_id = org.get("org_id")
        owner_id = org.get("owner_id")
        
        # Get owner email
        owner = await db.users.find_one({"user_id": owner_id}, {"_id": 0, "email": 1, "subscription_tier": 1})
        owner_email = owner.get("email") if owner else None
        subscription_tier = org.get("subscription_tier") or (owner.get("subscription_tier") if owner else None) or "individual"
        
        # Count users in this organization
        user_count = await db.users.count_documents({
            "$or": [
                {"organization_id": org_id},
                {"user_id": owner_id}
            ]
        })
        
        # Count coach users (users with role="coach") in this organization
        coach_count = await db.users.count_documents({
            "$or": [
                {"organization_id": org_id, "role": "coach"},
                {"invited_by": owner_id, "role": "coach"}
            ]
        })
        
        # Count sessions
        session_count = await db.sessions.count_documents({"created_by": owner_id})
        
        # Calculate effective limits
        custom_limits = org.get("custom_limits", {})
        tier_limits = tier_map.get(subscription_tier, default_tiers.get(subscription_tier, default_tiers["individual"]))
        
        effective_coaches_limit = custom_limits.get("coaches_limit") if custom_limits.get("coaches_limit") is not None else tier_limits.get("coaches_limit", 5)
        effective_admins_limit = custom_limits.get("admins_limit") if custom_limits.get("admins_limit") is not None else tier_limits.get("admins_limit", 1)
        effective_data_retention = custom_limits.get("data_retention_months") if custom_limits.get("data_retention_months") is not None else tier_limits.get("data_retention_months")
        
        has_custom_limits = bool(custom_limits and any(v is not None for v in custom_limits.values()))
        
        result.append(AdminOrganizationListItem(
            org_id=org_id,
            club_name=org.get("club_name"),
            club_logo=org.get("club_logo"),
            owner_id=owner_id,
            owner_email=owner_email,
            user_count=user_count,
            coach_count=coach_count,
            session_count=session_count,
            subscription_tier=subscription_tier,
            status=org.get("status", "active"),
            created_at=org.get("created_at"),
            effective_coaches_limit=effective_coaches_limit,
            effective_admins_limit=effective_admins_limit,
            effective_data_retention_months=effective_data_retention,
            has_custom_limits=has_custom_limits
        ))
    
    return result

@api_router.get("/admin/organizations/{org_id}/users")
async def admin_get_organization_users(org_id: str, request: Request):
    """Get all users in an organization (Admin only)"""
    await require_admin(request)
    
    # Get the organization
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    owner_id = org.get("owner_id")
    
    # Get all users in this organization (including owner and linked users)
    users = await db.users.find({
        "$or": [
            {"organization_id": org_id},
            {"user_id": owner_id}
        ]
    }, {"_id": 0, "password": 0}).to_list(1000)
    
    result = []
    for user in users:
        result.append(AdminUserListItem(
            user_id=user.get("user_id"),
            email=user.get("email"),
            name=user.get("name"),
            role=user.get("role"),
            organization_id=user.get("organization_id"),
            linked_coach_id=user.get("linked_coach_id"),
            created_at=user.get("created_at")
        ))
    
    return result

@api_router.post("/admin/organizations")
async def admin_create_organization(data: AdminCreateOrganizationRequest, request: Request):
    """Create a new organization/club (Admin only)"""
    await require_admin(request)
    
    # Generate organization ID
    org_id = f"org_{uuid.uuid4().hex[:12]}"
    
    org_doc = {
        "org_id": org_id,
        "club_name": data.club_name,
        "club_logo": data.club_logo,
        "owner_id": None,  # Will be set when a Coach Developer is assigned
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.organizations.insert_one(org_doc)
    
    return {
        "org_id": org_id,
        "club_name": data.club_name,
        "club_logo": data.club_logo,
        "message": "Organization created successfully"
    }

@api_router.post("/admin/users")
async def admin_create_user(data: AdminCreateUserRequest, request: Request):
    """Create a new user for any organization (Admin only)"""
    await require_admin(request)
    
    # Validate role
    if data.role not in ["coach_developer", "coach"]:
        raise HTTPException(status_code=400, detail="Role must be 'coach_developer' or 'coach'")
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": data.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Verify organization exists
    org = await db.organizations.find_one({"org_id": data.organization_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Generate user ID and temporary password
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    temp_password = f"Temp_{uuid.uuid4().hex[:8]}!"
    hashed_pw = hash_password(temp_password)
    
    full_name = f"{data.first_name} {data.last_name}"
    
    user_doc = {
        "user_id": user_id,
        "email": data.email.lower(),
        "name": full_name,
        "password": hashed_pw,
        "role": data.role,
        "organization_id": data.organization_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If creating a Coach Developer and org has no owner, set this user as owner
    if data.role == "coach_developer":
        if not org.get("owner_id"):
            await db.organizations.update_one(
                {"org_id": data.organization_id},
                {"$set": {"owner_id": user_id}}
            )
    
    # If creating a Coach, also create a coach profile
    linked_coach_id = None
    if data.role == "coach":
        coach_id = f"coach_{uuid.uuid4().hex[:12]}"
        coach_doc = {
            "id": coach_id,
            "coach_id": coach_id,
            "name": full_name,
            "email": data.email.lower(),
            "organization_id": data.organization_id,
            "created_by": org.get("owner_id"),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.coaches.insert_one(coach_doc)
        linked_coach_id = coach_id
        user_doc["linked_coach_id"] = coach_id
    
    await db.users.insert_one(user_doc)
    
    return {
        "user_id": user_id,
        "email": data.email,
        "name": full_name,
        "role": data.role,
        "temporary_password": temp_password,
        "linked_coach_id": linked_coach_id,
        "message": "User created successfully. They should reset their password on first login."
    }

@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_user_password(user_id: str, data: AdminResetPasswordRequest, request: Request):
    """Reset password for any user (Admin only)"""
    await require_admin(request)
    
    # Find the user
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow resetting admin passwords
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot reset admin password through this endpoint")
    
    # Hash the new password
    hashed_pw = hash_password(data.new_password)
    
    # Update the user's password (use password_hash, not password!)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "password_hash": hashed_pw, 
            "auth_provider": "email",  # Enable email login
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password reset successfully", "user_id": user_id}


@api_router.post("/admin/users/send-reset-email")
async def admin_send_reset_email(request: Request):
    """Force send a password reset email to any user, bypassing Google OAuth check (Admin only)"""
    await require_admin(request)
    
    body = await request.json()
    email = body.get("email")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Find the user
    user = await db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail=f"No user found with email: {email}")
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)  # 24 hours for admin-triggered resets
    
    # Delete any existing reset tokens for this email
    await db.password_resets.delete_many({"email": email})
    
    # Insert new reset token
    await db.password_resets.insert_one({
        "email": email,
        "token": reset_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "triggered_by": "admin"
    })
    
    # Send the email
    try:
        await send_password_reset_email(
            email=email,
            reset_token=reset_token,
            user_name=user.get("name", "User")
        )
        return {
            "message": f"Password reset email sent to {email}",
            "expires_in": "24 hours",
            "user_name": user.get("name"),
            "auth_provider": user.get("auth_provider", "unknown")
        }
    except Exception as e:
        logger.error(f"Failed to send admin-triggered password reset email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

@api_router.get("/admin/users")
async def admin_list_all_users(request: Request):
    """List all users in the system (Admin only)"""
    await require_admin(request)
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(10000)
    
    result = []
    for user in users:
        result.append(AdminUserListItem(
            user_id=user.get("user_id"),
            email=user.get("email"),
            name=user.get("name"),
            role=user.get("role"),
            organization_id=user.get("organization_id"),
            linked_coach_id=user.get("linked_coach_id"),
            created_at=user.get("created_at")
        ))
    
    return result

@api_router.post("/admin/impersonate/{user_id}")
async def admin_impersonate_user(user_id: str, request: Request, response: Response):
    """Generate a session token to impersonate a user (Admin only)"""
    admin_user = await require_admin(request)
    
    # Get the admin's current session token to preserve it (from cookie or Authorization header)
    admin_session_token = request.cookies.get("session_token")
    if not admin_session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            admin_session_token = auth_header.split(" ")[1]
    
    # Find the target user
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow impersonating other admins
    if target_user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot impersonate admin users")
    
    # Generate impersonation session token
    impersonate_token = secrets.token_urlsafe(32)
    
    # Store the impersonation session with reference to admin's original session
    await db.user_sessions.insert_one({
        "user_id": target_user.get("user_id"),
        "session_token": impersonate_token,
        "impersonated_by": admin_user.user_id,
        "admin_session_token": admin_session_token,  # Store admin's original session
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    })
    
    # Set the session cookie directly (same settings as regular login)
    response.set_cookie(
        key="session_token",
        value=impersonate_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=2 * 60 * 60,  # 2 hours
        path="/"
    )
    
    return {
        "token": impersonate_token,
        "user": {
            "user_id": target_user.get("user_id"),
            "email": target_user.get("email"),
            "name": target_user.get("name"),
            "role": target_user.get("role"),
            "organization_id": target_user.get("organization_id"),
            "linked_coach_id": target_user.get("linked_coach_id")
        },
        "impersonated_by": admin_user.user_id,
        "expires_in": "2 hours"
    }

@api_router.post("/admin/exit-impersonation")
async def admin_exit_impersonation(request: Request, response: Response):
    """Exit impersonation mode and restore admin session"""
    # Get current session token from either cookie or Authorization header
    current_session_token = request.cookies.get("session_token")
    
    # Check Authorization header as fallback
    if not current_session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            current_session_token = auth_header.split(" ")[1]
    
    if not current_session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find the current session
    current_session = await db.user_sessions.find_one(
        {"session_token": current_session_token},
        {"_id": 0}
    )
    
    if not current_session:
        raise HTTPException(status_code=401, detail="Session not found")
    
    # Check if this is an impersonation session
    admin_session_token = current_session.get("admin_session_token")
    if not admin_session_token:
        raise HTTPException(status_code=400, detail="Not in impersonation mode")
    
    # Verify the admin session is still valid
    admin_session = await db.user_sessions.find_one(
        {"session_token": admin_session_token},
        {"_id": 0}
    )
    
    if not admin_session:
        raise HTTPException(status_code=401, detail="Admin session expired. Please login again.")
    
    # Check admin session expiry
    expires_at = admin_session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Admin session expired. Please login again.")
    
    # Delete the impersonation session
    await db.user_sessions.delete_one({"session_token": current_session_token})
    
    # Restore the admin session cookie
    response.set_cookie(
        key="session_token",
        value=admin_session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,  # Match original admin session duration
        path="/"
    )
    
    # Return admin token so frontend can restore localStorage
    return {
        "message": "Exited impersonation mode", 
        "redirect": "/admin",
        "admin_token": admin_session_token
    }

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, request: Request):
    """Delete a user (Admin only) - also cleans up associated coach profiles and invites"""
    await require_admin(request)
    
    # Find the user
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow deleting admin users
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin users")
    
    user_email = (user.get("email") or "").strip().lower()
    linked_coach_id = user.get("linked_coach_id")
    
    # Delete the user
    await db.users.delete_one({"user_id": user_id})
    
    # Delete associated coach profile(s) - by linked_coach_id AND by email
    coaches_deleted = 0
    
    # Delete by linked_coach_id (correct field name is 'id', not 'coach_id')
    if linked_coach_id:
        result = await db.coaches.delete_one({"id": linked_coach_id})
        coaches_deleted += result.deleted_count
    
    # Also delete any coach profiles with matching email (orphaned profiles)
    if user_email:
        result = await db.coaches.delete_many({
            "email": {"$regex": f"^{user_email}$", "$options": "i"}
        })
        coaches_deleted += result.deleted_count
    
    # Delete any pending invites for this email
    invites_deleted = 0
    if user_email:
        result = await db.invites.delete_many({
            "email": {"$regex": f"^{user_email}$", "$options": "i"}
        })
        invites_deleted = result.deleted_count
    
    logger.info(f"Deleted user {user_id} ({user_email}), {coaches_deleted} coach profile(s), {invites_deleted} invite(s)")
    
    return {
        "message": "User deleted successfully", 
        "user_id": user_id,
        "coaches_deleted": coaches_deleted,
        "invites_deleted": invites_deleted
    }

@api_router.post("/admin/organizations/{org_id}/add-coach-developer")
async def admin_add_coach_developer(org_id: str, request: Request):
    """Add a coach developer to an organization (Admin only)"""
    await require_admin(request)
    
    body = await request.json()
    email = body.get("email", "").strip().lower()
    name = body.get("name", "").strip()
    
    if not email or not name:
        raise HTTPException(status_code=400, detail="Email and name are required")
    
    # Check if organization exists
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    
    # Create invite
    invite_id = f"inv_{uuid.uuid4().hex[:12]}"
    invite = {
        "invite_id": invite_id,
        "email": email,
        "name": name,
        "role": "coach_developer",
        "organization_id": org_id,
        "invited_by": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending"
    }
    
    await db.invites.insert_one({**invite, "_id": invite_id})
    
    # Try to send invite email
    try:
        resend_api_key = os.environ.get("RESEND_API_KEY")
        if resend_api_key:
            register_url = f"{os.environ.get('FRONTEND_URL', 'https://mycoachdeveloper.com')}/register/{invite_id}"
            
            html_content = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e293b;">You're Invited to My Coach Developer</h2>
              <p>Hello {name},</p>
              <p>You have been invited to join <strong>{org.get('club_name', 'an organization')}</strong> as a <strong>Coach Developer</strong>.</p>
              <p>Click the link below to create your account:</p>
              <p style="margin: 24px 0;">
                <a href="{register_url}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                  Accept Invitation
                </a>
              </p>
              <p style="color: #64748b; font-size: 14px;">This invitation was sent by the system administrator.</p>
            </div>
            """
            
            # Use the existing email sending mechanism
            email_params = {
                "from": "My Coach Developer <noreply@mycoachdeveloper.com>",
                "to": [email],
                "subject": "You're invited to My Coach Developer",
                "html": html_content
            }
            
            email_result = await send_email_with_retry(email_params, "invite")
            
            if email_result.get("success"):
                await db.invites.update_one({"invite_id": invite_id}, {"$set": {"email_sent": True}})
    except Exception as e:
        logger.error(f"Failed to send invite email: {e}")
    
    return {
        "message": "Coach developer invite created",
        "invite_id": invite_id,
        "email": email,
        "name": name,
        "organization_id": org_id
    }

@api_router.post("/admin/organizations/{org_id}/archive")
async def admin_archive_organization(org_id: str, request: Request):
    """Archive an organization (soft delete) - Admin only"""
    await require_admin(request)
    
    # Find the organization
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if org.get("status") == "archived":
        raise HTTPException(status_code=400, detail="Organization is already archived")
    
    # Update organization status to archived
    await db.organizations.update_one(
        {"org_id": org_id},
        {"$set": {
            "status": "archived",
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "archived_reason": "manual"  # Can be "manual" or "subscription_cancelled"
        }}
    )
    
    return {
        "message": "Organization archived successfully",
        "org_id": org_id,
        "status": "archived"
    }


@api_router.post("/admin/organizations/{org_id}/reinstate")
async def admin_reinstate_organization(org_id: str, request: Request):
    """Reinstate an archived organization - Admin only"""
    await require_admin(request)
    
    # Find the organization
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if org.get("status") != "archived":
        raise HTTPException(status_code=400, detail="Organization is not archived")
    
    # Update organization status to active
    await db.organizations.update_one(
        {"org_id": org_id},
        {
            "$set": {
                "status": "active",
                "reinstated_at": datetime.now(timezone.utc).isoformat()
            },
            "$unset": {
                "archived_at": "",
                "archived_reason": ""
            }
        }
    )
    
    return {
        "message": "Organization reinstated successfully",
        "org_id": org_id,
        "status": "active"
    }


@api_router.delete("/admin/organizations/{org_id}")
async def admin_delete_organization(org_id: str, request: Request):
    """Permanently delete an organization and all its data (Admin only) - USE WITH CAUTION"""
    await require_admin(request)
    
    # Find the organization
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    owner_id = org.get("owner_id")
    
    # Get all user emails before deleting (for coach profile cleanup)
    org_users = await db.users.find({
        "$or": [
            {"organization_id": org_id},
            {"user_id": owner_id}
        ],
        "role": {"$ne": "admin"}
    }, {"_id": 0, "email": 1}).to_list(1000)
    user_emails = [u.get("email", "").lower() for u in org_users if u.get("email")]
    
    # Delete all users in this organization
    delete_result = await db.users.delete_many({
        "$or": [
            {"organization_id": org_id},
            {"user_id": owner_id}
        ],
        "role": {"$ne": "admin"}  # Never delete admins
    })
    
    # Delete all coaches in this organization (by organization_id, created_by, OR email)
    coach_delete_conditions = [
        {"organization_id": org_id},
        {"created_by": owner_id}
    ]
    if user_emails:
        coach_delete_conditions.append({
            "email": {"$in": [{"$regex": f"^{e}$", "$options": "i"} for e in user_emails]}
        })
    
    coaches_result = await db.coaches.delete_many({"$or": coach_delete_conditions})
    
    # Delete all invites for this organization
    invites_result = await db.invites.delete_many({
        "$or": [
            {"organization_id": org_id},
            {"invited_by": owner_id}
        ]
    })
    
    # Delete the organization
    await db.organizations.delete_one({"org_id": org_id})
    
    return {
        "message": "Organization permanently deleted",
        "org_id": org_id,
        "users_deleted": delete_result.deleted_count,
        "coaches_deleted": coaches_result.deleted_count,
        "invites_deleted": invites_result.deleted_count
    }



@api_router.delete("/admin/cleanup/coach-by-email")
async def admin_cleanup_coach_by_email(request: Request):
    """
    Remove a coach profile by email address (Admin only).
    Used to clean up orphaned coach profiles that block users from joining new clubs.
    """
    await require_admin(request)
    
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Find and delete coach profile(s) with this email
    coach_result = await db.coaches.delete_many({
        "email": {"$regex": f"^{email}$", "$options": "i"}
    })
    
    # Also delete any pending invites for this email
    invite_result = await db.invites.delete_many({
        "email": {"$regex": f"^{email}$", "$options": "i"}
    })
    
    # Check if there's a user with this email and unlink their coach profile
    await db.users.update_many(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"$set": {"linked_coach_id": None}}
    )
    
    logger.info(f"Cleaned up coach data for {email}: {coach_result.deleted_count} coach(es), {invite_result.deleted_count} invite(s)")
    
    return {
        "message": f"Cleaned up coach data for {email}",
        "coaches_deleted": coach_result.deleted_count,
        "invites_deleted": invite_result.deleted_count
    }


@api_router.delete("/admin/cleanup/user-by-email")
async def admin_cleanup_user_by_email(request: Request):
    """
    COMPREHENSIVE cleanup: Remove ALL data for an email address (Admin only).
    Deletes: user account, coach profile(s), invites, and any linked data.
    Use this to completely remove a user so they can join a different club.
    
    WARNING: This permanently deletes the user account. They will need to re-register.
    """
    await require_admin(request)
    
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # First, find the user to get their linked_coach_id
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    
    linked_coach_id = user.get("linked_coach_id") if user else None
    user_id = user.get("user_id") if user else None
    
    # 1. Delete user account
    user_result = await db.users.delete_many({
        "email": {"$regex": f"^{email}$", "$options": "i"}
    })
    
    # 2. Delete coach profile(s) - by email AND by linked_coach_id
    coach_delete_conditions = [
        {"email": {"$regex": f"^{email}$", "$options": "i"}}
    ]
    if linked_coach_id:
        coach_delete_conditions.append({"id": linked_coach_id})
    if user_id:
        coach_delete_conditions.append({"user_id": user_id})
    
    coach_result = await db.coaches.delete_many({"$or": coach_delete_conditions})
    
    # 3. Delete any pending invites for this email
    invite_result = await db.invites.delete_many({
        "email": {"$regex": f"^{email}$", "$options": "i"}
    })
    
    # 4. Delete any reflections created by this user
    reflections_result = await db.reflections.delete_many({
        "user_id": user_id
    }) if user_id else type('obj', (object,), {'deleted_count': 0})()
    
    # 5. Clean up session parts created by this user (optional - keep for data integrity)
    # We don't delete session data as it may be valuable for the organization
    
    logger.info(f"Complete cleanup for {email}: user={user_result.deleted_count}, coaches={coach_result.deleted_count}, invites={invite_result.deleted_count}, reflections={reflections_result.deleted_count}")
    
    return {
        "message": f"Completely removed all data for {email}",
        "email": email,
        "user_deleted": user_result.deleted_count > 0,
        "user_id_removed": user_id,
        "coaches_deleted": coach_result.deleted_count,
        "invites_deleted": invite_result.deleted_count,
        "reflections_deleted": reflections_result.deleted_count,
        "note": "User can now register fresh with any organization"
    }



@api_router.get("/admin/cleanup/orphaned-users")
async def admin_find_orphaned_users(request: Request):
    """
    Find users that are missing organization_id (Admin only).
    These users cannot add coaches or perform organization-related actions.
    """
    await require_admin(request)
    
    # Find users without organization_id (excluding system admin)
    orphaned_users = await db.users.find(
        {
            "$or": [
                {"organization_id": None},
                {"organization_id": {"$exists": False}},
                {"organization_id": ""}
            ],
            "role": {"$ne": "admin"}  # Exclude system admins
        },
        {"_id": 0, "user_id": 1, "email": 1, "name": 1, "role": 1}
    ).to_list(100)
    
    # For each orphaned user, try to find their organization
    results = []
    for user in orphaned_users:
        user_id = user.get("user_id")
        email = user.get("email")
        
        # Check if they own an organization
        owned_org = await db.organizations.find_one(
            {"owner_id": user_id},
            {"_id": 0, "org_id": 1, "club_name": 1}
        )
        
        # Check if there's an invite for this email
        invite = await db.invites.find_one(
            {"email": {"$regex": f"^{email}$", "$options": "i"}, "used": True},
            {"_id": 0, "organization_id": 1}
        )
        
        results.append({
            "user_id": user_id,
            "email": email,
            "name": user.get("name"),
            "role": user.get("role"),
            "owned_organization": owned_org,
            "invite_organization_id": invite.get("organization_id") if invite else None
        })
    
    return {
        "orphaned_count": len(results),
        "orphaned_users": results
    }


@api_router.post("/admin/cleanup/fix-user-organization")
async def admin_fix_user_organization(request: Request):
    """
    Fix a user's organization_id by finding their owned organization or invite (Admin only).
    """
    await require_admin(request)
    
    body = await request.json()
    email = (body.get("email") or "").strip().lower()
    force_org_id = body.get("organization_id")  # Optional: force a specific org_id
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Find the user
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail=f"User not found: {email}")
    
    user_id = user.get("user_id")
    current_org_id = user.get("organization_id")
    
    if current_org_id and not force_org_id:
        return {
            "message": "User already has an organization_id",
            "email": email,
            "organization_id": current_org_id,
            "updated": False
        }
    
    # Determine the organization_id
    new_org_id = force_org_id
    source = "forced"
    
    if not new_org_id:
        # Check if they own an organization
        owned_org = await db.organizations.find_one(
            {"owner_id": user_id},
            {"_id": 0, "org_id": 1}
        )
        if owned_org:
            new_org_id = owned_org.get("org_id")
            source = "owned_organization"
    
    if not new_org_id:
        # Check if there's a used invite for this email
        invite = await db.invites.find_one(
            {"email": {"$regex": f"^{email}$", "$options": "i"}, "used": True},
            {"_id": 0, "organization_id": 1}
        )
        if invite:
            new_org_id = invite.get("organization_id")
            source = "invite"
    
    if not new_org_id:
        raise HTTPException(
            status_code=400, 
            detail="Could not determine organization_id. Please provide one manually."
        )
    
    # Update the user
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"organization_id": new_org_id}}
    )
    
    logger.info(f"Fixed organization_id for {email}: {new_org_id} (source: {source})")
    
    return {
        "message": f"Successfully linked user to organization",
        "email": email,
        "user_id": user_id,
        "organization_id": new_org_id,
        "source": source,
        "updated": True
    }



@api_router.get("/admin/cleanup/orphaned-coaches")
async def admin_find_orphaned_coaches(request: Request):
    """
    Find coach profiles that are orphaned (no matching user, or not visible in any club).
    Admin only.
    """
    await require_admin(request)
    
    # Get all coach profiles
    all_coaches = await db.coaches.find({}, {"_id": 0}).to_list(1000)
    
    orphaned = []
    for coach in all_coaches:
        coach_id = coach.get("id")
        email = coach.get("email", "").lower()
        user_id = coach.get("user_id")
        org_id = coach.get("organization_id")
        
        is_orphaned = False
        reason = []
        
        # Check 1: No organization_id
        if not org_id:
            is_orphaned = True
            reason.append("no_organization")
        else:
            # Check if organization exists
            org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0, "club_name": 1})
            if not org:
                is_orphaned = True
                reason.append("organization_deleted")
        
        # Check 2: Has user_id but user doesn't exist
        if user_id:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1})
            if not user:
                is_orphaned = True
                reason.append("user_deleted")
        
        # Check 3: Has email but no user with that email exists and no user_id linked
        if email and not user_id:
            user_by_email = await db.users.find_one(
                {"email": {"$regex": f"^{email}$", "$options": "i"}},
                {"_id": 0}
            )
            if not user_by_email:
                is_orphaned = True
                reason.append("email_not_registered")
        
        if is_orphaned:
            orphaned.append({
                "id": coach_id,
                "name": coach.get("name"),
                "email": email,
                "organization_id": org_id,
                "user_id": user_id,
                "reasons": reason
            })
    
    return {
        "total_coaches": len(all_coaches),
        "orphaned_count": len(orphaned),
        "orphaned_coaches": orphaned
    }


@api_router.post("/admin/cleanup/orphaned-coaches")
async def admin_delete_orphaned_coaches(request: Request):
    """
    Delete all orphaned coach profiles (Admin only).
    Use GET /admin/cleanup/orphaned-coaches first to preview what will be deleted.
    """
    await require_admin(request)
    
    # Get orphaned coaches using the same logic
    all_coaches = await db.coaches.find({}, {"_id": 0}).to_list(1000)
    
    orphaned_ids = []
    for coach in all_coaches:
        coach_id = coach.get("id")
        user_id = coach.get("user_id")
        org_id = coach.get("organization_id")
        email = coach.get("email", "").lower()
        
        is_orphaned = False
        
        # No organization
        if not org_id:
            is_orphaned = True
        else:
            org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
            if not org:
                is_orphaned = True
        
        # User was deleted
        if user_id:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            if not user:
                is_orphaned = True
        
        if is_orphaned and coach_id:
            orphaned_ids.append(coach_id)
    
    # Delete orphaned coaches
    if orphaned_ids:
        result = await db.coaches.delete_many({"id": {"$in": orphaned_ids}})
        deleted_count = result.deleted_count
    else:
        deleted_count = 0
    
    logger.info(f"Cleaned up {deleted_count} orphaned coach profiles")
    
    return {
        "message": f"Deleted {deleted_count} orphaned coach profiles",
        "deleted_count": deleted_count
    }



@api_router.get("/admin/subscription-tiers")
async def admin_get_subscription_tiers(request: Request):
    """Get all subscription tiers with their limits (Admin only)"""
    await require_admin(request)
    
    # Import new tiers from subscription_config
    from subscription_config import SUBSCRIPTION_TIERS
    
    # Convert to admin format with new tiers
    default_tiers = [
        {
            "tier_id": "individual_coach",
            "name": "Individual Coach",
            "monthly_price": 5,
            "annual_price": 50,
            "coaches_limit": 0,  # Self only
            "admins_limit": 1,
            "observations_limit": None,  # Unlimited
            "data_retention_months": None,
            "description": "For coaches observing themselves"
        },
        {
            "tier_id": "coach_developer",
            "name": "Coach Developer",
            "monthly_price": 15,
            "annual_price": 150,
            "coaches_limit": None,  # Unlimited
            "admins_limit": 1,
            "observations_limit": 10,  # Per coach
            "data_retention_months": None,
            "description": "For coach developers working with multiple coaches"
        },
        {
            "tier_id": "club",
            "name": "Club",
            "monthly_price": 60,
            "annual_price": 600,
            "coaches_limit": 30,
            "admins_limit": 5,
            "observations_limit": None,  # Unlimited
            "data_retention_months": None,
            "description": "For organizations"
        }
    ]
    
    # Get tiers from database (for any custom overrides)
    db_tiers = await db.subscription_tiers.find({}, {"_id": 0}).to_list(100)
    db_tier_map = {t["tier_id"]: t for t in db_tiers} if db_tiers else {}
    
    # Merge DB values with defaults (DB values override defaults)
    result = []
    for default_tier in default_tiers:
        tier_id = default_tier["tier_id"]
        if tier_id in db_tier_map:
            # Merge: start with default, update with DB values
            merged_tier = {**default_tier, **db_tier_map[tier_id]}
            result.append(merged_tier)
        else:
            result.append(default_tier)
    
    return result


@api_router.put("/admin/subscription-tiers/{tier_id}")
async def admin_update_subscription_tier(tier_id: str, request: Request):
    """Update a subscription tier's limits and pricing (Admin only)"""
    await require_admin(request)
    
    body = await request.json()
    
    # Allowed fields to update
    allowed_fields = ["name", "monthly_price", "annual_price", "coaches_limit", "admins_limit", "data_retention_months", "description"]
    
    update_data = {}
    for field in allowed_fields:
        if field in body:
            update_data[field] = body[field]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Upsert the tier
    result = await db.subscription_tiers.update_one(
        {"tier_id": tier_id},
        {"$set": update_data, "$setOnInsert": {"tier_id": tier_id, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    # Also update any active subscriptions with this tier
    await db.subscriptions.update_many(
        {"tier_id": tier_id},
        {"$set": {
            "coaches_limit": update_data.get("coaches_limit") if "coaches_limit" in update_data else None,
            "admins_limit": update_data.get("admins_limit") if "admins_limit" in update_data else None,
        }}
    )
    
    return {
        "message": f"Tier '{tier_id}' updated successfully",
        "updated_fields": list(update_data.keys())
    }



@api_router.get("/pricing/tiers")
async def get_public_pricing_tiers():
    """Get subscription tier pricing and limits (Public endpoint for landing page)"""
    from subscription_config import SUBSCRIPTION_TIERS
    
    # Build response from subscription config (single source of truth)
    result = []
    
    # Order: individual_coach, coach_developer, club
    tier_order = ["individual_coach", "coach_developer", "club"]
    tier_subtitles = {
        "individual_coach": "The Self-Improver",
        "coach_developer": "The Growth Specialist", 
        "club": "The Organization"
    }
    
    for tier_key in tier_order:
        if tier_key in SUBSCRIPTION_TIERS:
            config = SUBSCRIPTION_TIERS[tier_key]
            pricing = config.get("pricing", {})
            limits = config.get("limits", {})
            
            result.append({
                "tier_id": tier_key,
                "name": config.get("name", tier_key),
                "subtitle": tier_subtitles.get(tier_key, ""),
                "monthly_price": pricing.get("monthly", 0) / 100,  # Convert pence to pounds
                "annual_price": pricing.get("annual", 0) / 100,
                "coaches_limit": limits.get("max_coaches"),
                "admins_limit": limits.get("max_coach_developers", 1),
                "observations_per_coach": limits.get("max_observations_per_coach"),
                "data_retention_months": None,  # Unlimited for all
                "description": config.get("description", "")
            })
    
    return result



@api_router.get("/admin/organizations/{org_id}/limits")
async def admin_get_org_limits(org_id: str, request: Request):
    """Get custom limits for an organization (Admin only)"""
    await require_admin(request)
    
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Get subscription for this org
    subscription = await db.subscriptions.find_one(
        {"org_id": org_id},
        {"_id": 0}
    )
    
    # Get custom overrides
    custom_limits = await db.organization_custom_limits.find_one(
        {"org_id": org_id},
        {"_id": 0}
    )
    
    return {
        "org_id": org_id,
        "org_name": org.get("name") or org.get("club_name"),
        "subscription_tier": subscription.get("tier_id") if subscription else "free",
        "base_limits": {
            "coaches": subscription.get("coaches_limit", 5) if subscription else 5,
            "admins": subscription.get("admins_limit", 1) if subscription else 1,
            "data_retention_months": 3 if subscription and subscription.get("tier_id") == "individual" else None
        },
        "custom_overrides": custom_limits or {
            "coaches_limit": None,
            "admins_limit": None,
            "data_retention_months": None
        },
        "effective_limits": {
            "coaches": custom_limits.get("coaches_limit") if custom_limits and custom_limits.get("coaches_limit") else (subscription.get("coaches_limit", 5) if subscription else 5),
            "admins": custom_limits.get("admins_limit") if custom_limits and custom_limits.get("admins_limit") else (subscription.get("admins_limit", 1) if subscription else 1),
            "data_retention_months": custom_limits.get("data_retention_months") if custom_limits and custom_limits.get("data_retention_months") is not None else (3 if subscription and subscription.get("tier_id") == "individual" else None)
        }
    }


@api_router.put("/admin/organizations/{org_id}/limits")
async def admin_update_org_limits(org_id: str, request: Request):
    """Update custom limits for an organization (Admin only)"""
    await require_admin(request)
    
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    body = await request.json()
    
    # Allowed fields for custom overrides
    allowed_fields = ["coaches_limit", "admins_limit", "data_retention_months"]
    
    custom_limits = {}
    for field in allowed_fields:
        if field in body:
            # Allow None to clear override
            custom_limits[field] = body[field]
    
    # Update custom_limits directly on the organization document
    await db.organizations.update_one(
        {"org_id": org_id},
        {"$set": {
            "custom_limits": custom_limits,
            "custom_limits_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": f"Custom limits for organization updated",
        "org_id": org_id,
        "updated_fields": [f for f in allowed_fields if f in body]
    }


@api_router.put("/admin/organizations/{org_id}/tier")
async def admin_update_org_tier(org_id: str, request: Request):
    """Update organization's subscription tier (Admin only)"""
    await require_admin(request)
    
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    body = await request.json()
    new_tier = body.get("tier_id")
    
    if not new_tier:
        raise HTTPException(status_code=400, detail="tier_id is required")
    
    # Accept both new tier keys and legacy tier keys
    valid_tiers = ["individual_coach", "coach_developer", "club", "individual", "developer"]
    if new_tier not in valid_tiers:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Must be one of: {', '.join(valid_tiers)}")
    
    # Determine if this is a legacy tier or new tier
    is_legacy_tier = new_tier in ["individual", "developer"]
    
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Update organization's subscription tier
    org_update_fields = {
        "current_tier_key": new_tier,
        "is_legacy_tier": is_legacy_tier,
        "subscription_tier": new_tier,
        "tier_updated_at": now_iso,
        "tier_updated_by": "admin_manual"
    }
    
    await db.organizations.update_one(
        {"org_id": org_id},
        {"$set": org_update_fields}
    )
    
    # CRITICAL: Also update the subscriptions collection (this is where entitlements are read from)
    subscription_update_fields = {
        "current_tier_key": new_tier,
        "is_legacy_tier": is_legacy_tier,
        "tier_id": new_tier,
        "tier": new_tier,
        "updated_at": now_iso,
        "tier_updated_by": "admin_manual"
    }
    
    # Try to update existing subscription, or create one if it doesn't exist
    existing_sub = await db.subscriptions.find_one(
        {"$or": [{"org_id": org_id}, {"organization_id": org_id}]},
        {"_id": 0}
    )
    
    if existing_sub:
        # Update existing subscription
        await db.subscriptions.update_one(
            {"$or": [{"org_id": org_id}, {"organization_id": org_id}]},
            {"$set": subscription_update_fields}
        )
    else:
        # Create new subscription record
        new_subscription = {
            "org_id": org_id,
            "organization_id": org_id,
            "current_tier_key": new_tier,
            "is_legacy_tier": is_legacy_tier,
            "tier_id": new_tier,
            "tier": new_tier,
            "status": "active",
            "created_at": now_iso,
            "updated_at": now_iso,
            "tier_updated_by": "admin_manual"
        }
        await db.subscriptions.insert_one(new_subscription)
    
    # Also update the owner's user record
    owner_id = org.get("owner_id")
    if owner_id:
        await db.users.update_one(
            {"user_id": owner_id},
            {"$set": {"subscription_tier": new_tier}}
        )
    
    return {
        "message": f"Organization tier updated to {new_tier}",
        "org_id": org_id,
        "new_tier": new_tier,
        "is_legacy_tier": is_legacy_tier
    }


# ============================================
# END ADMIN API ENDPOINTS
# ============================================

# ============================================
# STRIPE PAYMENT ENDPOINTS
# ============================================

import stripe

# Stripe configuration
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY')
stripe.api_key = STRIPE_SECRET_KEY

# Product and Price IDs from Stripe Dashboard (Updated Feb 2026)
# Each tier has explicit monthly and annual price IDs - DO NOT dynamically lookup
# Note: Monthly and Annual are separate Products in Stripe
# Phase 6: Added mapping for new tier keys to Stripe products
STRIPE_PRODUCTS = {
    # Legacy tier mappings (still active for existing subscribers)
    "individual": {
        "name": "Individual",
        "coaches": 5,
        "admins": 1,
        "prices": {
            "monthly": {
                "product_id": "prod_TzxFEJM4rt7UyV",
                "price_id": "price_1T1xKf0YRwRcrAVx1mms3s6N",
                "amount": 2000,  # £20.00 in pence
                "currency": "gbp"
            },
            "annual": {
                "product_id": "prod_U2pOJtI3YOvo3m",
                "price_id": "price_1T4jjb0YRwRcrAVxBocH9SSX",
                "amount": 20000,  # £200.00 in pence
                "currency": "gbp"
            }
        }
    },
    "developer": {
        "name": "Developer",
        "coaches": 10,
        "admins": 1,
        "prices": {
            "monthly": {
                "product_id": "prod_TzxEC0P2ychhee",
                "price_id": "price_1T1xKX0YRwRcrAVxfhm6GAXI",
                "amount": 3500,  # £35.00 in pence
                "currency": "gbp"
            },
            "annual": {
                "product_id": "prod_U2pPifTHi8Hcru",
                "price_id": "price_1T4jkE0YRwRcrAVxAWcHnfkT",
                "amount": 35000,  # £350.00 in pence
                "currency": "gbp"
            }
        }
    },
    "club": {
        "name": "Club",
        "coaches": 30,
        "admins": 5,
        "prices": {
            "monthly": {
                "product_id": "prod_TzxE3SVtpPojK3",
                "price_id": "price_1T3yMN0YRwRcrAVx7HCM1cI9",
                "amount": 6000,  # £60.00 in pence
                "currency": "gbp"
            },
            "annual": {
                "product_id": "prod_U2pPFRreuxQtxf",
                "price_id": "price_1T4jkp0YRwRcrAVxAkntx6Q4",
                "amount": 60000,  # £600.00 in pence
                "currency": "gbp"
            }
        }
    },
    # New tier mappings (Phase 6)
    # Stripe products created - ready for checkout
    "individual_coach": {
        "name": "Individual Coach",
        "coaches": 0,  # Self only
        "admins": 1,
        "prices": {
            "monthly": {
                "product_id": None,
                "price_id": "price_1T7Kgy0YRwRcrAVxBwbIvDOD",
                "amount": 500,       # £5.00 in pence
                "currency": "gbp"
            },
            "annual": {
                "product_id": None,
                "price_id": "price_1T7Kg80YRwRcrAVxMEuEDVjn",
                "amount": 5000,      # £50.00 in pence
                "currency": "gbp"
            }
        }
    },
    "coach_developer": {
        "name": "Coach Developer",
        "coaches": None,  # Unlimited
        "admins": 1,
        "prices": {
            "monthly": {
                "product_id": None,
                "price_id": "price_1T7KeW0YRwRcrAVxg2SJo8RJ",
                "amount": 1500,      # £15.00 in pence
                "currency": "gbp"
            },
            "annual": {
                "product_id": None,
                "price_id": "price_1T7KcY0YRwRcrAVxko7tQMGN",
                "amount": 15000,     # £150.00 in pence
                "currency": "gbp"
            }
        }
    }
}

class CheckoutRequest(BaseModel):
    tier_id: str
    billing_period: str  # "monthly" or "annual"
    origin_url: str
    coupon_code: Optional[str] = None  # Optional discount/promotion code

class SubscriptionUpdateRequest(BaseModel):
    tier_id: str
    billing_period: str  # "monthly" or "annual"

@api_router.get("/payments/subscription-details")
async def get_subscription_details(request: Request):
    """Get detailed subscription information for the current user's organization.
    Returns tier, billing period, status, and Stripe details.
    Checks both subscriptions collection AND organization document for legacy data.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    user = await require_coach_developer(request)
    
    try:
        # Get user's organization
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        if not user_doc:
            return {"has_subscription": False, "tier": None, "status": None}
        
        org_id = user_doc.get("organization_id")
        org = None
        
        if not org_id:
            # Check if user owns an organization
            org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
            if org:
                org_id = org.get("org_id")
        else:
            org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
        
        if not org_id:
            return {"has_subscription": False, "tier": None, "status": None}
        
        # First, check subscriptions collection (for Stripe-managed subscriptions)
        subscription = await db.subscriptions.find_one(
            {"organization_id": org_id},
            {"_id": 0}
        )
        
        if subscription and subscription.get("subscription_id"):
            # Found Stripe subscription
            billing_period = "monthly"
            price_id = subscription.get("price_id")
            tier_id = subscription.get("tier_id")
            
            # Match price_id to determine billing period
            if price_id:
                for t_id, t_info in STRIPE_PRODUCTS.items():
                    if t_info["prices"]["annual"]["price_id"] == price_id:
                        billing_period = "annual"
                        tier_id = t_id
                        break
                    elif t_info["prices"]["monthly"]["price_id"] == price_id:
                        billing_period = "monthly"
                        tier_id = t_id
                        break
            
            tier_name = STRIPE_PRODUCTS.get(tier_id, {}).get("name", tier_id)
            tier_info = STRIPE_PRODUCTS.get(tier_id, {})
            
            # Always use current tier limits from STRIPE_PRODUCTS (not stale subscription values)
            coaches_limit = tier_info.get("coaches", 5)
            admins_limit = tier_info.get("admins", 1)
            
            return {
                "has_subscription": True,
                "tier": tier_id,
                "tier_name": tier_name,
                "billing_period": billing_period,
                "status": subscription.get("status", "active"),
                "price_id": price_id,
                "subscription_id": subscription.get("subscription_id"),
                "customer_id": subscription.get("customer_id"),
                "current_period_end": subscription.get("current_period_end"),
                "cancel_at_period_end": subscription.get("cancel_at_period_end", False),
                "coaches_limit": coaches_limit,
                "admins_limit": admins_limit,
                "is_stripe_managed": True
            }
        
        # Check organization document for legacy/manual subscription data
        if org:
            tier_id = org.get("subscription_tier_id") or org.get("subscription_tier")
            stripe_sub_id = org.get("stripe_subscription_id")
            stripe_customer_id = org.get("stripe_customer_id")
            
            if tier_id:
                # Normalize tier_id to lowercase
                tier_id = tier_id.lower() if tier_id else None
                
                # Validate tier exists
                if tier_id not in STRIPE_PRODUCTS:
                    # Try to match by name
                    for t_id, t_info in STRIPE_PRODUCTS.items():
                        if t_info["name"].lower() == tier_id:
                            tier_id = t_id
                            break
                
                tier_info = STRIPE_PRODUCTS.get(tier_id, {})
                tier_name = tier_info.get("name", tier_id.title() if tier_id else "Unknown")
                
                # Use current tier limits from STRIPE_PRODUCTS
                coaches_limit = tier_info.get("coaches", 5)
                admins_limit = tier_info.get("admins", 1)
                
                return {
                    "has_subscription": True,
                    "tier": tier_id,
                    "tier_name": tier_name,
                    "billing_period": org.get("billing_period", "monthly"),
                    "status": "active",  # Legacy subscriptions assumed active
                    "price_id": None,
                    "subscription_id": stripe_sub_id,
                    "customer_id": stripe_customer_id,
                    "current_period_end": None,
                    "cancel_at_period_end": False,
                    "coaches_limit": coaches_limit,
                    "admins_limit": admins_limit,
                    "is_stripe_managed": bool(stripe_sub_id)
                }
        
        return {"has_subscription": False, "tier": None, "status": None}
        
    except Exception as e:
        logger.error(f"Error fetching subscription details: {e}")
        return {"has_subscription": False, "tier": None, "status": None, "error": str(e)}



@api_router.get("/billing/entitlement")
async def get_billing_entitlement(request: Request):
    """
    Check if the current user/organization is entitled to use the app.
    
    Entitlement rules:
    - subscription status is 'active' or 'trialing' -> entitled
    - trial is active (is_trial=True and trial_end_date > now) -> entitled
    - trial is expired (is_trial=True and trial_end_date <= now) -> NOT entitled
    - cancelAtPeriodEnd is true AND current time < currentPeriodEnd -> entitled
    - no subscription OR status='canceled' AND time > currentPeriodEnd -> NOT entitled
    - status is 'unpaid', 'incomplete', 'incomplete_expired', 'past_due' -> NOT entitled
    
    Returns server time to avoid client timezone issues.
    Also returns trial information for banner display.
    """
    from subscription_config import SUBSCRIPTION_TIERS
    
    try:
        user = await require_auth(request)
        org_id = user.organization_id
        
        # Get current server time
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        
        # Default response (not entitled)
        response = {
            "is_entitled": False,
            "subscription_status": None,
            "cancel_at_period_end": False,
            "current_period_end": None,
            "active_tier": None,
            "active_price_id": None,
            "reason": "no_subscription",
            "server_time": now_iso,
            # Trial-specific fields
            "is_trial": False,
            "trial_expired": False,
            "trial_end_date": None,
            "trial_days_remaining": None,
            "trial_tier_name": None
        }
        
        if not org_id:
            response["reason"] = "no_organization"
            logger.info(f"Entitlement check for {user.user_id}: NOT entitled (no organization)")
            return response
        
        # Check subscriptions collection
        subscription = await db.subscriptions.find_one(
            {"$or": [{"organization_id": org_id}, {"org_id": org_id}]},
            {"_id": 0}
        )
        
        if subscription and subscription.get("subscription_id"):
            status = subscription.get("status", "").lower()
            cancel_at_period_end = subscription.get("cancel_at_period_end", False)
            current_period_end_str = subscription.get("current_period_end")
            tier_id = subscription.get("tier_id") or subscription.get("current_tier_key")
            price_id = subscription.get("price_id")
            
            # Check for trial status
            is_trial = subscription.get("is_trial", False)
            trial_end_date_str = subscription.get("trial_end_date")
            trial_tier_key = subscription.get("trial_tier_key") or tier_id
            
            # Parse current_period_end
            current_period_end = None
            if current_period_end_str:
                try:
                    current_period_end = datetime.fromisoformat(current_period_end_str.replace('Z', '+00:00'))
                except:
                    pass
            
            # Parse trial_end_date
            trial_end_date = None
            if trial_end_date_str:
                try:
                    trial_end_date = datetime.fromisoformat(trial_end_date_str.replace('Z', '+00:00'))
                except:
                    pass
            
            response["subscription_status"] = status
            response["cancel_at_period_end"] = cancel_at_period_end
            response["current_period_end"] = current_period_end_str
            response["active_tier"] = tier_id
            response["active_price_id"] = price_id
            response["is_trial"] = is_trial
            response["trial_end_date"] = trial_end_date_str
            
            # Calculate trial days remaining
            if is_trial and trial_end_date:
                days_remaining = (trial_end_date - now).days
                response["trial_days_remaining"] = max(0, days_remaining)
                
                # Get tier name
                if trial_tier_key and trial_tier_key in SUBSCRIPTION_TIERS:
                    response["trial_tier_name"] = SUBSCRIPTION_TIERS[trial_tier_key].get("name", trial_tier_key)
                
                # Check if trial is expired
                if now >= trial_end_date:
                    response["trial_expired"] = True
                    response["is_entitled"] = False
                    response["reason"] = "trial_expired"
                    logger.info(f"Entitlement check for {user.user_id}: NOT entitled (trial expired)")
                    return response
                else:
                    # Trial is active
                    response["is_entitled"] = True
                    response["reason"] = "trial_active"
                    logger.info(f"Entitlement check for {user.user_id}: entitled (trial active, {days_remaining} days remaining)")
                    return response
            
            # Regular subscription entitlement logic
            if status in ["active", "trialing"]:
                response["is_entitled"] = True
                response["reason"] = f"status_{status}"
                logger.info(f"Entitlement check for {user.user_id}: entitled (status={status})")
            elif cancel_at_period_end and current_period_end and now < current_period_end:
                # User canceled but still within paid period
                response["is_entitled"] = True
                response["reason"] = "cancel_at_period_end_not_reached"
                logger.info(f"Entitlement check for {user.user_id}: entitled (canceled but period not ended)")
            elif status == "canceled":
                response["is_entitled"] = False
                response["reason"] = "subscription_canceled"
                logger.info(f"Entitlement check for {user.user_id}: NOT entitled (canceled)")
            elif status in ["unpaid", "incomplete", "incomplete_expired", "past_due"]:
                response["is_entitled"] = False
                response["reason"] = f"status_{status}"
                logger.info(f"Entitlement check for {user.user_id}: NOT entitled (status={status})")
            else:
                # Unknown status - be conservative
                response["is_entitled"] = False
                response["reason"] = f"unknown_status_{status}"
                logger.warning(f"Entitlement check for {user.user_id}: unknown status {status}")
            
            return response
        
        # Check legacy subscription on organization
        org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
        if org:
            tier_id = org.get("subscription_tier_id") or org.get("subscription_tier")
            if tier_id:
                # Legacy subscription - treat as entitled
                response["is_entitled"] = True
                response["subscription_status"] = "active"
                response["active_tier"] = tier_id.lower() if tier_id else None
                response["reason"] = "legacy_subscription"
                logger.info(f"Entitlement check for {user.user_id}: entitled (legacy subscription)")
                return response
        
        # No subscription found
        response["reason"] = "no_subscription"
        logger.info(f"Entitlement check for {user.user_id}: NOT entitled (no subscription)")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking entitlement: {e}")
        # On error, don't block user but log it
        return {
            "is_entitled": True,  # Fail open to not block users on errors
            "subscription_status": None,
            "cancel_at_period_end": False,
            "current_period_end": None,
            "active_tier": None,
            "reason": "error_fail_open",
            "error": str(e),
            "server_time": datetime.now(timezone.utc).isoformat(),
            "is_trial": False,
            "trial_expired": False,
            "trial_end_date": None,
            "trial_days_remaining": None,
            "trial_tier_name": None
        }


@api_router.post("/payments/update-subscription")
async def update_subscription(data: SubscriptionUpdateRequest, request: Request):
    """Update an existing subscription to a different plan.
    Does NOT create a new subscription - updates the existing one.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Validate tier
    if data.tier_id not in STRIPE_PRODUCTS:
        raise HTTPException(status_code=400, detail="Invalid pricing tier")
    
    # Validate billing period
    if data.billing_period not in ["monthly", "annual"]:
        raise HTTPException(status_code=400, detail="Invalid billing period")
    
    user = await require_coach_developer(request)
    
    try:
        # Get user's organization
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        
        org_id = user_doc.get("organization_id")
        if not org_id:
            org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
            if org:
                org_id = org.get("org_id")
        
        if not org_id:
            raise HTTPException(status_code=400, detail="No organization found")
        
        # Find existing subscription
        subscription = await db.subscriptions.find_one(
            {"organization_id": org_id, "status": {"$in": ["active", "trialing", "past_due"]}},
            {"_id": 0}
        )
        
        if not subscription or not subscription.get("subscription_id"):
            raise HTTPException(
                status_code=400, 
                detail="No active subscription to update. Please create a new subscription."
            )
        
        stripe_subscription_id = subscription.get("subscription_id")
        
        # Get the new price ID
        new_price_id = STRIPE_PRODUCTS[data.tier_id]["prices"][data.billing_period]["price_id"]
        
        # Retrieve the current subscription from Stripe
        stripe_sub = stripe.Subscription.retrieve(stripe_subscription_id)
        
        # Get the subscription item ID (for updating)
        if not stripe_sub.get("items") or not stripe_sub["items"].get("data"):
            raise HTTPException(status_code=400, detail="Invalid subscription structure")
        
        subscription_item_id = stripe_sub["items"]["data"][0]["id"]
        
        # Update the subscription with the new price
        # This handles proration automatically
        updated_sub = stripe.Subscription.modify(
            stripe_subscription_id,
            items=[{
                "id": subscription_item_id,
                "price": new_price_id
            }],
            proration_behavior="create_prorations"  # Stripe handles proration
        )
        
        # Get tier limits
        tier_info = STRIPE_PRODUCTS[data.tier_id]
        
        # Update our database record
        await db.subscriptions.update_one(
            {"subscription_id": stripe_subscription_id},
            {"$set": {
                "tier_id": data.tier_id,
                "tier_name": tier_info["name"],
                "price_id": new_price_id,
                "billing_period": data.billing_period,
                "coaches_limit": tier_info["coaches"],
                "admins_limit": tier_info["admins"],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Also update organization's subscription_tier
        await db.organizations.update_one(
            {"org_id": org_id},
            {"$set": {
                "subscription_tier": data.tier_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Subscription {stripe_subscription_id} updated to {data.tier_id} ({data.billing_period})")
        
        return {
            "success": True,
            "message": f"Subscription updated to {tier_info['name']} ({data.billing_period})",
            "tier": data.tier_id,
            "billing_period": data.billing_period,
            "subscription_id": stripe_subscription_id
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error updating subscription: {e}")
        raise HTTPException(status_code=400, detail=str(e.user_message or e))
    except HTTPException:
        # Re-raise HTTPExceptions as-is (e.g., 400 for no active subscription)
        raise
    except Exception as e:
        logger.error(f"Error updating subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to update subscription")

@api_router.post("/payments/checkout")
async def create_checkout_session(data: CheckoutRequest, request: Request):
    """Create a Stripe checkout session for subscription"""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Validate tier
    if data.tier_id not in STRIPE_PRODUCTS:
        raise HTTPException(status_code=400, detail="Invalid pricing tier")
    
    # Validate billing period
    if data.billing_period not in ["monthly", "annual"]:
        raise HTTPException(status_code=400, detail="Invalid billing period")
    
    product = STRIPE_PRODUCTS[data.tier_id]
    
    # Build success and cancel URLs
    success_url = f"{data.origin_url}?session_id={{CHECKOUT_SESSION_ID}}&success=true"
    cancel_url = f"{data.origin_url}?canceled=true"
    
    try:
        # Use explicit Price ID from configuration - DO NOT dynamically search
        price_config = product["prices"].get(data.billing_period)
        if not price_config:
            raise HTTPException(status_code=400, detail=f"No {data.billing_period} price configured for {data.tier_id}")
        
        price_id = price_config["price_id"]
        
        # Phase 6: Check if Stripe price is configured for new tiers
        if price_id is None:
            logger.warning(f"Stripe price not configured for tier {data.tier_id} ({data.billing_period})")
            raise HTTPException(
                status_code=400, 
                detail=f"The {product['name']} tier is not yet available for purchase. Stripe products are being configured. Please contact support or try the Club tier."
            )
        
        # Build checkout session params
        checkout_params = {
            "mode": "subscription",
            "payment_method_types": ["card"],
            "line_items": [{
                "price": price_id,
                "quantity": 1,
            }],
            "success_url": success_url,
            "cancel_url": cancel_url,
            "allow_promotion_codes": True,  # Always allow promotion codes in UI
            "metadata": {
                "tier_id": data.tier_id,
                "tier_name": product["name"],
                "billing_period": data.billing_period,
                "coaches_limit": str(product["coaches"]),
                "admins_limit": str(product["admins"])
            },
            "subscription_data": {
                "metadata": {
                    "tier_id": data.tier_id,
                    "coaches_limit": str(product["coaches"]),
                    "admins_limit": str(product["admins"])
                }
            }
        }
        
        # If a specific coupon code was provided, apply it as a discount
        if data.coupon_code:
            try:
                # Try to find the promotion code in Stripe
                promo_codes = stripe.PromotionCode.list(code=data.coupon_code, active=True, limit=1)
                if promo_codes.data:
                    checkout_params["discounts"] = [{"promotion_code": promo_codes.data[0].id}]
                    # When using discounts, we can't also allow_promotion_codes
                    checkout_params.pop("allow_promotion_codes", None)
                else:
                    # Code not found - don't fail, just log and continue without it
                    logger.warning(f"Promotion code not found: {data.coupon_code}")
            except stripe.error.StripeError as promo_err:
                logger.warning(f"Error looking up promotion code: {promo_err}")
                # Continue without the discount code
        
        # Create Stripe Checkout Session
        session = stripe.checkout.Session.create(**checkout_params)
        
        # Create payment transaction record
        transaction = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "session_id": session.id,
            "tier_id": data.tier_id,
            "tier_name": product["name"],
            "billing_period": data.billing_period,
            "price_id": price_id,
            "currency": "gbp",
            "payment_status": "pending",
            "status": "initiated",
            "metadata": {
                "coaches_limit": product["coaches"],
                "admins_limit": product["admins"]
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "url": session.url,
            "session_id": session.id
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")
    except Exception as e:
        logger.error(f"Checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    """Get the status of a payment session"""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    try:
        # Retrieve the checkout session from Stripe with customer details
        session = stripe.checkout.Session.retrieve(session_id, expand=['customer'])
        
        # Update payment transaction in database
        update_data = {
            "payment_status": session.payment_status,
            "status": session.status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if session.subscription:
            update_data["subscription_id"] = session.subscription
        if session.customer:
            update_data["customer_id"] = session.customer if isinstance(session.customer, str) else session.customer.id
        
        # Get customer email from session
        customer_email = None
        if session.customer_details and session.customer_details.email:
            customer_email = session.customer_details.email
            update_data["customer_email"] = customer_email
        elif session.customer and hasattr(session.customer, 'email'):
            customer_email = session.customer.email
            update_data["customer_email"] = customer_email
        
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        
        return {
            "status": session.status,
            "payment_status": session.payment_status,
            "amount_total": session.amount_total,
            "currency": session.currency,
            "subscription_id": session.subscription,
            "customer_id": session.customer if isinstance(session.customer, str) else (session.customer.id if session.customer else None),
            "customer_email": customer_email,
            "metadata": dict(session.metadata) if session.metadata else {}
        }
    except stripe.error.StripeError as e:
        logger.error(f"Payment status check error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check payment status: {str(e)}")
    except Exception as e:
        logger.error(f"Payment status check error: {e}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    try:
        body = await request.body()
        event = stripe.Event.construct_from(
            json.loads(body), stripe.api_key
        )
        
        logger.info(f"Received Stripe webhook event: {event.type}")
        
        # Handle specific event types
        if event.type == "checkout.session.completed":
            session = event.data.object
            
            # Update payment transaction
            update_data = {
                "payment_status": session.get("payment_status"),
                "status": "completed",
                "event_type": event.type,
                "event_id": event.id,
                "subscription_id": session.get("subscription"),
                "customer_id": session.get("customer"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.payment_transactions.update_one(
                {"session_id": session.get("id")},
                {"$set": update_data}
            )
            
            # Create or update subscription record
            if session.get("subscription"):
                subscription = stripe.Subscription.retrieve(session.get("subscription"))
                metadata = dict(session.get("metadata", {}))
                
                # Get the organization_id from metadata or user
                org_id = metadata.get("organization_id")
                user_id = metadata.get("user_id")
                
                sub_record = {
                    "subscription_id": session.get("subscription"),
                    "customer_id": session.get("customer"),
                    "status": subscription.status,
                    "tier_id": metadata.get("tier_id"),
                    "tier": metadata.get("tier_id"),  # For backwards compatibility
                    "tier_name": metadata.get("tier_name"),
                    "coaches_limit": int(metadata.get("coaches_limit", 5)),
                    "admins_limit": int(metadata.get("admins_limit", 1)),
                    "current_period_start": datetime.fromtimestamp(subscription.current_period_start, timezone.utc).isoformat(),
                    "current_period_end": datetime.fromtimestamp(subscription.current_period_end, timezone.utc).isoformat(),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                
                if org_id:
                    sub_record["organization_id"] = org_id
                    sub_record["org_id"] = org_id  # For backwards compatibility
                if user_id:
                    sub_record["user_id"] = user_id
                
                await db.subscriptions.update_one(
                    {"subscription_id": session.get("subscription")},
                    {"$set": sub_record},
                    upsert=True
                )
                
                # Also store customer_id on user if we have user_id
                if user_id:
                    await db.users.update_one(
                        {"user_id": user_id},
                        {"$set": {"stripe_customer_id": session.get("customer")}}
                    )
                
                logger.info(f"Subscription created: {session.get('subscription')} for tier {metadata.get('tier_id')}")
        
        elif event.type == "customer.subscription.updated":
            subscription = event.data.object
            
            # Detect plan changes by checking the items
            items = subscription.get("items", {}).get("data", [])
            price_id = items[0].get("price", {}).get("id") if items else None
            product_id = items[0].get("price", {}).get("product") if items else None
            
            # Find the tier based on product_id (check both monthly and annual products)
            new_tier_id = None
            new_tier_name = None
            new_coaches_limit = None
            new_admins_limit = None
            billing_period = None
            
            if product_id:
                for tier_id, tier_info in STRIPE_PRODUCTS.items():
                    # Check monthly product
                    if tier_info["prices"]["monthly"]["product_id"] == product_id:
                        new_tier_id = tier_id
                        new_tier_name = tier_info["name"]
                        new_coaches_limit = tier_info["coaches"]
                        new_admins_limit = tier_info["admins"]
                        billing_period = "monthly"
                        break
                    # Check annual product
                    if tier_info["prices"]["annual"]["product_id"] == product_id:
                        new_tier_id = tier_id
                        new_tier_name = tier_info["name"]
                        new_coaches_limit = tier_info["coaches"]
                        new_admins_limit = tier_info["admins"]
                        billing_period = "annual"
                        break
            
            update_data = {
                "status": subscription.status,
                "current_period_start": datetime.fromtimestamp(subscription.current_period_start, timezone.utc).isoformat(),
                "current_period_end": datetime.fromtimestamp(subscription.current_period_end, timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "last_synced_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Store price_id if available
            if price_id:
                update_data["price_id"] = price_id
            
            # Update tier info if plan changed
            if new_tier_id:
                update_data["tier_id"] = new_tier_id
                update_data["tier_name"] = new_tier_name
                update_data["coaches_limit"] = new_coaches_limit
                update_data["admins_limit"] = new_admins_limit
                if billing_period:
                    update_data["billing_period"] = billing_period
                logger.info(f"Subscription {subscription.id} plan changed to {new_tier_name} ({billing_period})")
            
            # Handle cancel_at_period_end
            if subscription.cancel_at_period_end:
                update_data["cancel_at_period_end"] = True
                update_data["cancel_at"] = datetime.fromtimestamp(subscription.cancel_at, timezone.utc).isoformat() if subscription.cancel_at else None
            else:
                update_data["cancel_at_period_end"] = False
                update_data["cancel_at"] = None
            
            await db.subscriptions.update_one(
                {"subscription_id": subscription.id},
                {"$set": update_data}
            )
            
            logger.info(f"Subscription updated: {subscription.id}, status: {subscription.status}")
            
        elif event.type == "customer.subscription.deleted":
            subscription = event.data.object
            
            await db.subscriptions.update_one(
                {"subscription_id": subscription.id},
                {"$set": {
                    "status": "canceled",
                    "canceled_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            logger.info(f"Subscription canceled: {subscription.id}")
        
        elif event.type == "invoice.payment_succeeded":
            invoice = event.data.object
            subscription_id = invoice.get("subscription")
            
            if subscription_id:
                await db.subscriptions.update_one(
                    {"subscription_id": subscription_id},
                    {"$set": {
                        "status": "active",
                        "last_payment_status": "succeeded",
                        "last_payment_date": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Store invoice record
                await db.invoices.update_one(
                    {"invoice_id": invoice.get("id")},
                    {"$set": {
                        "invoice_id": invoice.get("id"),
                        "subscription_id": subscription_id,
                        "customer_id": invoice.get("customer"),
                        "amount_paid": invoice.get("amount_paid"),
                        "currency": invoice.get("currency"),
                        "status": invoice.get("status"),
                        "invoice_url": invoice.get("hosted_invoice_url"),
                        "invoice_pdf": invoice.get("invoice_pdf"),
                        "created_at": datetime.fromtimestamp(invoice.get("created"), timezone.utc).isoformat() if invoice.get("created") else None,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
                
                logger.info(f"Invoice payment succeeded for subscription: {subscription_id}")
        
        elif event.type == "invoice.payment_failed":
            invoice = event.data.object
            subscription_id = invoice.get("subscription")
            
            if subscription_id:
                await db.subscriptions.update_one(
                    {"subscription_id": subscription_id},
                    {"$set": {
                        "status": "past_due",
                        "last_payment_status": "failed",
                        "last_payment_failure_date": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                logger.warning(f"Invoice payment failed for subscription: {subscription_id}")
        
        elif event.type == "customer.subscription.trial_will_end":
            subscription = event.data.object
            # Log for now, could send notification email
            logger.info(f"Trial ending soon for subscription: {subscription.id}")
        
        return {"received": True}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/payments/transaction/{session_id}")
async def get_payment_transaction(session_id: str):
    """Get payment transaction details by session ID"""
    transaction = await db.payment_transactions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return transaction


class BillingPortalRequest(BaseModel):
    return_url: str


@api_router.post("/payments/billing-portal")
async def create_billing_portal_session(data: BillingPortalRequest, request: Request):
    """Create a Stripe Billing Portal session for subscription management"""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Require authentication
    user = await require_coach_developer(request)
    
    try:
        # Get the user's Stripe customer ID from their subscription
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        
        # First check if user has a stripe_customer_id stored directly
        customer_id = user_doc.get("stripe_customer_id")
        
        # If not, look for it in their organization's subscription
        if not customer_id:
            org_id = user_doc.get("organization_id")
            if not org_id:
                # Check if user owns an organization
                org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
                if org:
                    org_id = org.get("org_id")
            
            if org_id:
                # Find subscription by organization
                subscription = await db.subscriptions.find_one(
                    {"organization_id": org_id, "status": {"$in": ["active", "trialing", "past_due"]}},
                    {"_id": 0}
                )
                if subscription:
                    customer_id = subscription.get("customer_id")
            
            # If still no customer_id, check payment transactions
            if not customer_id:
                transaction = await db.payment_transactions.find_one(
                    {"user_id": user.user_id, "customer_id": {"$exists": True}},
                    {"_id": 0},
                    sort=[("created_at", -1)]
                )
                if transaction:
                    customer_id = transaction.get("customer_id")
        
        if not customer_id:
            raise HTTPException(
                status_code=400, 
                detail="No active subscription found. Please subscribe to a plan first."
            )
        
        # Create Stripe Billing Portal session
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=data.return_url
        )
        
        logger.info(f"Billing portal session created for user {user.user_id}, customer {customer_id}")
        
        return {
            "url": portal_session.url,
            "id": portal_session.id
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe billing portal error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create billing portal: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Billing portal error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create billing portal session")


@api_router.get("/payments/subscription-status")
async def get_subscription_status(request: Request):
    """Get the current user's subscription status"""
    user = await require_coach_developer(request)
    
    try:
        # Get user's organization
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        org_id = user_doc.get("organization_id") if user_doc else None
        
        if not org_id:
            org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
            if org:
                org_id = org.get("org_id")
        
        if not org_id:
            return {
                "has_subscription": False,
                "status": None,
                "tier": None,
                "current_period_end": None
            }
        
        # Find active subscription (try both field names)
        subscription = await db.subscriptions.find_one(
            {"$or": [
                {"organization_id": org_id},
                {"org_id": org_id}
            ]},
            {"_id": 0}
        )
        
        if not subscription:
            # Try to find by customer_id from payment transactions
            transaction = await db.payment_transactions.find_one(
                {"user_id": user.user_id, "status": "completed"},
                {"_id": 0},
                sort=[("created_at", -1)]
            )
            if transaction and transaction.get("subscription_id"):
                subscription = await db.subscriptions.find_one(
                    {"subscription_id": transaction.get("subscription_id")},
                    {"_id": 0}
                )
        
        if not subscription:
            # Fall back to organization's subscription_tier_id
            org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
            if org and org.get("subscription_tier_id"):
                tier_limits = {
                    "individual": {"coaches": 5, "admins": 1},
                    "developer": {"coaches": 10, "admins": 1},
                    "club": {"coaches": 30, "admins": 5}
                }
                tier_id = org.get("subscription_tier_id")
                limits = tier_limits.get(tier_id, tier_limits["individual"])
                
                return {
                    "has_subscription": True,
                    "status": "active",
                    "tier": tier_id,
                    "tier_name": tier_id.capitalize(),
                    "current_period_start": org.get("created_at"),
                    "current_period_end": None,
                    "canceled_at": None,
                    "coaches_limit": limits["coaches"],
                    "admins_limit": limits["admins"]
                }
            
            return {
                "has_subscription": False,
                "status": None,
                "tier": None,
                "current_period_end": None
            }
        
        return {
            "has_subscription": True,
            "status": subscription.get("status"),
            "tier": subscription.get("tier_id"),
            "tier_name": subscription.get("tier_name"),
            "current_period_start": subscription.get("current_period_start"),
            "current_period_end": subscription.get("current_period_end"),
            "canceled_at": subscription.get("canceled_at"),
            "coaches_limit": subscription.get("coaches_limit"),
            "admins_limit": subscription.get("admins_limit")
        }
        
    except Exception as e:
        logger.error(f"Subscription status error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get subscription status")


# ============================================
# END STRIPE PAYMENT ENDPOINTS
# ============================================

# ============================================
# REFLECTION TEMPLATE ENDPOINTS
# ============================================

@api_router.get("/reflection-templates")
async def list_reflection_templates(
    request: Request,
    target_role: Optional[str] = None
):
    """
    List all reflection templates for the user's organization.
    Includes global admin templates and templates assigned to user/org.
    Can filter by target_role: 'coach_educator' or 'coach'
    """
    user = await require_auth(request)
    
    # Build query based on user's organization
    query = {}
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    logger.info(f"[reflection-templates] User {user.user_id} (org: {org_id}) fetching templates")
    
    # Build query - VERY lenient to handle legacy data:
    # 1. Templates assigned to user's organization (new data)
    # 2. Templates created by this user (regardless of organization_id)
    # 3. Templates without organization_id (legacy/shared templates)
    if org_id:
        query = {
            "$or": [
                {"organization_id": org_id},
                {"created_by": user.user_id},
                {"organization_id": {"$exists": False}},
                {"organization_id": None}
            ]
        }
    else:
        # No org - show templates created by this user OR shared templates
        query = {
            "$or": [
                {"created_by": user.user_id},
                {"organization_id": {"$exists": False}},
                {"organization_id": None}
            ]
        }
    
    if target_role:
        query["target_role"] = target_role
    
    templates = await db.reflection_templates.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Also fetch global admin templates for reflection categories
    # Map target_role to admin template category
    admin_categories = []
    if target_role == "coach_educator" or not target_role:
        admin_categories.append("coach_developer_reflection")
    if target_role == "coach" or not target_role:
        admin_categories.append("coach_reflection")
    
    if admin_categories:
        admin_query = {
            "is_admin_template": True,
            "category": {"$in": admin_categories},
            "$or": [
                {"is_global": True},  # Global templates visible to everyone
                {"assigned_user_ids": user.user_id},  # Assigned to this user
            ]
        }
        if org_id:
            admin_query["$or"].append({"assigned_org_ids": org_id})  # Assigned to user's org
        
        global_admin_templates = await db.admin_templates.find(admin_query, {"_id": 0}).to_list(100)
        
        # Get user's template preferences (hidden templates and default admin templates)
        user_prefs = await db.user_template_preferences.find_one(
            {"user_id": user.user_id},
            {"_id": 0}
        )
        hidden_template_ids = set(user_prefs.get("hidden_template_ids", [])) if user_prefs else set()
        default_admin_templates = user_prefs.get("default_admin_templates", {}) if user_prefs else {}
        
        # Convert admin templates to reflection template format
        for admin_tpl in global_admin_templates:
            # Skip hidden templates
            if admin_tpl["template_id"] in hidden_template_ids:
                continue
                
            template_data = admin_tpl.get("template_data", {})
            # Map admin category to target_role
            tpl_target_role = "coach_educator" if admin_tpl.get("category") == "coach_developer_reflection" else "coach"
            
            # Determine preference key for checking default status
            pref_key = "coach_developer_reflection" if admin_tpl.get("category") == "coach_developer_reflection" else "coach_reflection"
            is_user_default = default_admin_templates.get(pref_key) == admin_tpl["template_id"]
            
            converted = {
                "template_id": admin_tpl["template_id"],
                "name": admin_tpl["name"],
                "description": admin_tpl.get("description"),
                "target_role": tpl_target_role,
                "questions": template_data.get("questions", []),
                "is_default": is_user_default,  # Check user's default preference
                "is_admin_template": True,  # Mark as admin template
                "is_global": admin_tpl.get("is_global", False),
                "qualification_tags": admin_tpl.get("qualification_tags", []),
                "created_by": admin_tpl.get("created_by"),
                "created_at": admin_tpl.get("created_at"),
                "updated_at": admin_tpl.get("updated_at")
            }
            # Only add if not already in templates (avoid duplicates)
            if not any(t.get("template_id") == converted["template_id"] for t in templates):
                templates.append(converted)
        
        logger.info(f"[reflection-templates] Found {len(templates)} templates (including admin templates, excluding {len(hidden_template_ids)} hidden) for user {user.user_id}")
    else:
        logger.info(f"[reflection-templates] Found {len(templates)} templates for user {user.user_id}")
    
    return templates

@api_router.get("/reflection-templates/{template_id}")
async def get_reflection_template(template_id: str, request: Request):
    """Get a specific reflection template"""
    user = await require_auth(request)
    
    # First check regular reflection templates
    template = await db.reflection_templates.find_one(
        {"template_id": template_id},
        {"_id": 0}
    )
    
    if template:
        return template
    
    # If not found, check admin templates
    admin_tpl = await db.admin_templates.find_one(
        {"template_id": template_id, "is_admin_template": True},
        {"_id": 0}
    )
    
    if admin_tpl:
        # Convert admin template to reflection template format
        template_data = admin_tpl.get("template_data", {})
        tpl_target_role = "coach_educator" if admin_tpl.get("category") == "coach_developer_reflection" else "coach"
        
        return {
            "template_id": admin_tpl["template_id"],
            "name": admin_tpl["name"],
            "description": admin_tpl.get("description"),
            "target_role": tpl_target_role,
            "questions": template_data.get("questions", []),
            "is_default": False,
            "is_admin_template": True,
            "is_global": admin_tpl.get("is_global", False),
            "created_by": admin_tpl.get("created_by"),
            "created_at": admin_tpl.get("created_at"),
            "updated_at": admin_tpl.get("updated_at")
        }
    
    raise HTTPException(status_code=404, detail="Template not found")

@api_router.post("/reflection-templates")
async def create_reflection_template(data: ReflectionTemplateCreate, request: Request):
    """Create a new reflection template"""
    user = await require_coach_developer(request)
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id:
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    template_id = f"reftmpl_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    # If setting as default, unset any existing default for the same target_role in the org
    if data.is_default and org_id:
        await db.reflection_templates.update_many(
            {"organization_id": org_id, "target_role": data.target_role, "is_default": True},
            {"$set": {"is_default": False}}
        )
    
    template_doc = {
        "template_id": template_id,
        "name": data.name,
        "target_role": data.target_role,
        "description": data.description,
        "questions": [q.model_dump() for q in data.questions],
        "is_default": data.is_default,
        "created_by": user.user_id,
        "organization_id": org_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.reflection_templates.insert_one(template_doc)
    
    # Return without MongoDB _id
    template_doc.pop("_id", None)
    return template_doc

@api_router.put("/reflection-templates/{template_id}")
async def update_reflection_template(
    template_id: str,
    data: ReflectionTemplateUpdate,
    request: Request
):
    """Update an existing reflection template"""
    user = await require_coach_developer(request)
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    # CRITICAL: Find template that belongs to user's organization
    query = {"template_id": template_id}
    if org_id:
        query["organization_id"] = org_id
    else:
        query["created_by"] = user.user_id
    
    template = await db.reflection_templates.find_one(query, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Build update
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.questions is not None:
        update_data["questions"] = [q.model_dump() for q in data.questions]
    if data.is_default is not None:
        # If setting as default, unset any existing default for the same target_role
        if data.is_default:
            template_org_id = template.get("organization_id")
            target_role = template.get("target_role")
            if template_org_id:
                await db.reflection_templates.update_many(
                    {
                        "organization_id": template_org_id,
                        "target_role": target_role,
                        "is_default": True,
                        "template_id": {"$ne": template_id}
                    },
                    {"$set": {"is_default": False}}
                )
        update_data["is_default"] = data.is_default
    
    await db.reflection_templates.update_one(
        {"template_id": template_id},
        {"$set": update_data}
    )
    
    # Return updated template
    updated = await db.reflection_templates.find_one(
        {"template_id": template_id},
        {"_id": 0}
    )
    
    return updated

@api_router.delete("/reflection-templates/{template_id}")
async def delete_reflection_template(template_id: str, request: Request):
    """Delete a reflection template"""
    user = await require_coach_developer(request)
    
    # Get user's organization_id - check multiple sources
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner of an organization
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    # Also check if the user belongs to any organization as a member
    if not org_id:
        # Check organizations where user might be a member
        org = await db.organizations.find_one(
            {"$or": [
                {"owner_id": user.user_id},
                {"member_ids": user.user_id}
            ]},
            {"_id": 0}
        )
        if org:
            org_id = org.get("org_id")
    
    # First, check if template exists at all
    template = await db.reflection_templates.find_one({"template_id": template_id}, {"_id": 0})
    
    if not template:
        # Also check admin_templates collection
        admin_tpl = await db.admin_templates.find_one({"template_id": template_id}, {"_id": 0})
        if admin_tpl:
            raise HTTPException(status_code=403, detail="Cannot delete admin templates from here. Use Admin Template Manager.")
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check authorization
    template_org = template.get("organization_id")
    template_creator = template.get("created_by")
    
    # Coach developers can delete any template in their organization
    # or any template they created
    is_authorized = False
    
    # 1. User created the template
    if template_creator == user.user_id:
        is_authorized = True
    
    # 2. User belongs to the same organization
    if org_id and template_org and org_id == template_org:
        is_authorized = True
    
    # 3. User is admin (superuser)
    if user.role == "admin":
        is_authorized = True
    
    # 4. Coach developer role should be able to delete templates in their org
    #    even if org_id matching fails (could be data inconsistency)
    if user.role == "coach_developer":
        # If template has no org or user has no org, allow the coach developer
        # This handles legacy templates or data inconsistencies
        if not template_org or not org_id:
            is_authorized = True
    
    if not is_authorized:
        logger.warning(f"Delete template denied: user {user.user_id} (org: {org_id}, role: {user.role}) tried to delete template {template_id} (org: {template_org}, creator: {template_creator})")
        raise HTTPException(status_code=403, detail="You don't have permission to delete this template")
    
    await db.reflection_templates.delete_one({"template_id": template_id})
    logger.info(f"Reflection template {template_id} deleted by {user.user_id}")
    
    return {"status": "deleted", "template_id": template_id}

@api_router.post("/reflection-templates/{template_id}/set-default")
async def set_template_as_default(template_id: str, request: Request):
    """Set a template as the default for its target_role"""
    user = await require_coach_developer(request)
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    # CRITICAL: Find template that belongs to user's organization
    query = {"template_id": template_id}
    if org_id:
        query["organization_id"] = org_id
    else:
        query["created_by"] = user.user_id
    
    template = await db.reflection_templates.find_one(query, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    template_org_id = template.get("organization_id")
    target_role = template.get("target_role")
    
    # Unset any existing default for the same target_role in the org
    if template_org_id:
        await db.reflection_templates.update_many(
            {"organization_id": template_org_id, "target_role": target_role, "is_default": True},
            {"$set": {"is_default": False}}
        )
    
    # Set this template as default
    await db.reflection_templates.update_one(
        {"template_id": template_id},
        {"$set": {"is_default": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "template_id": template_id, "is_default": True}

@api_router.post("/reflection-templates/{template_id}/unset-default")
async def unset_template_as_default(template_id: str, request: Request):
    """Remove default status from a template"""
    user = await require_coach_developer(request)
    
    # Find the template
    template = await db.reflection_templates.find_one(
        {"template_id": template_id},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Unset default
    await db.reflection_templates.update_one(
        {"template_id": template_id},
        {"$set": {"is_default": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "template_id": template_id, "is_default": False}

# ============================================
# END REFLECTION TEMPLATE ENDPOINTS
# ============================================

# ============================================
# OBSERVATION WINDOW TEMPLATE ENDPOINTS
# ============================================

@api_router.get("/observation-templates")
async def list_observation_templates(
    request: Request,
    observation_context: Optional[str] = None
):
    """
    List all observation window templates for the user's organization.
    Includes global admin templates and templates assigned to user/org.
    Can filter by observation_context: 'training' or 'game'
    """
    user = await require_auth(request)
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    logger.info(f"[observation-templates] User {user.user_id} (org: {org_id}) fetching templates")
    
    # Build query - VERY lenient to handle legacy data:
    # 1. Templates assigned to user's organization (new data)
    # 2. Templates created by this user (regardless of organization_id)
    # 3. Templates without organization_id (legacy/shared templates)
    if org_id:
        query = {
            "$or": [
                {"organization_id": org_id},
                {"created_by": user.user_id},
                {"organization_id": {"$exists": False}},
                {"organization_id": None}
            ]
        }
    else:
        # No org - show templates created by this user OR shared templates
        query = {
            "$or": [
                {"created_by": user.user_id},
                {"organization_id": {"$exists": False}},
                {"organization_id": None}
            ]
        }
    
    if observation_context:
        query["observation_context"] = observation_context
    
    templates = await db.observation_templates.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Also fetch global admin templates for observation category
    # These should be visible to ALL users unless they've hidden them
    admin_query = {
        "is_admin_template": True,
        "category": "observation",
        "$or": [
            {"is_global": True},  # Global templates visible to everyone
            {"assigned_user_ids": user.user_id},  # Assigned to this user
        ]
    }
    if org_id:
        admin_query["$or"].append({"assigned_org_ids": org_id})  # Assigned to user's org
    
    global_admin_templates = await db.admin_templates.find(admin_query, {"_id": 0}).to_list(100)
    
    # Get user's hidden templates list
    user_prefs = await db.user_template_preferences.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    hidden_template_ids = set(user_prefs.get("hidden_template_ids", [])) if user_prefs else set()
    
    # Get user's default admin template settings
    default_admin_templates = user_prefs.get("default_admin_templates", {}) if user_prefs else {}
    
    # Convert admin templates to observation template format
    for admin_tpl in global_admin_templates:
        # Skip hidden templates
        if admin_tpl["template_id"] in hidden_template_ids:
            continue
            
        template_data = admin_tpl.get("template_data", {})
        obs_context = template_data.get("observationContext", "training")
        
        # Check if this admin template is set as default by the user
        is_user_default = default_admin_templates.get(f"observation_{obs_context}") == admin_tpl["template_id"]
        
        converted = {
            "template_id": admin_tpl["template_id"],
            "name": admin_tpl["name"],
            "description": admin_tpl.get("description"),
            "observation_context": obs_context,
            "include_ball_rolling": template_data.get("includeBallRolling", True),
            "intervention_types": template_data.get("interventionTypes", template_data.get("eventTypes", [])),
            "descriptor_group1": template_data.get("descriptorGroup1"),
            "descriptor_group2": template_data.get("descriptorGroup2"),
            "session_parts": template_data.get("sessionParts", []),
            "is_default": is_user_default,  # User's default preference for admin template
            "is_admin_template": True,  # Mark as admin template
            "is_global": admin_tpl.get("is_global", False),
            "qualification_tags": admin_tpl.get("qualification_tags", []),
            "created_by": admin_tpl.get("created_by"),
            "created_at": admin_tpl.get("created_at"),
            "updated_at": admin_tpl.get("updated_at")
        }
        # Only add if not already in templates (avoid duplicates)
        if not any(t.get("template_id") == converted["template_id"] for t in templates):
            templates.append(converted)
    
    logger.info(f"[observation-templates] Found {len(templates)} templates (including admin templates, excluding {len(hidden_template_ids)} hidden) for user {user.user_id}")
    
    return templates


@api_router.get("/observation-templates/{template_id}")
async def get_observation_template(template_id: str, request: Request):
    """Get a specific observation window template"""
    user = await require_auth(request)
    
    template = await db.observation_templates.find_one(
        {"template_id": template_id},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template


class ObservationTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    observation_context: str = "training"  # "training" or "game"
    intervention_types: List[Dict[str, Any]] = []
    descriptor_group1: Optional[Dict[str, Any]] = None
    descriptor_group2: Optional[Dict[str, Any]] = None
    session_parts: List[Dict[str, Any]] = []
    is_default: bool = False
    include_ball_rolling: bool = True  # New field - default True for backwards compatibility


class ObservationTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    intervention_types: Optional[List[Dict[str, Any]]] = None
    descriptor_group1: Optional[Dict[str, Any]] = None
    descriptor_group2: Optional[Dict[str, Any]] = None
    session_parts: Optional[List[Dict[str, Any]]] = None
    is_default: Optional[bool] = None
    include_ball_rolling: Optional[bool] = None  # New field


@api_router.post("/observation-templates")
async def create_observation_template(data: ObservationTemplateCreate, request: Request):
    """Create a new observation window template"""
    user = await require_coach_developer(request)
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id:
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    template_id = f"obs_tmpl_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    
    # If setting as default, unset any existing default for the same context in the org
    if data.is_default and org_id:
        await db.observation_templates.update_many(
            {"organization_id": org_id, "observation_context": data.observation_context, "is_default": True},
            {"$set": {"is_default": False}}
        )
    
    template_doc = {
        "template_id": template_id,
        "name": data.name,
        "description": data.description,
        "observation_context": data.observation_context,
        "include_ball_rolling": data.include_ball_rolling,
        "intervention_types": data.intervention_types,
        "descriptor_group1": data.descriptor_group1,
        "descriptor_group2": data.descriptor_group2,
        "session_parts": data.session_parts,
        "is_default": data.is_default,
        "created_by": user.user_id,
        "organization_id": org_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.observation_templates.insert_one(template_doc)
    
    # Return without MongoDB _id
    template_doc.pop("_id", None)
    return template_doc


@api_router.put("/observation-templates/{template_id}")
async def update_observation_template(
    template_id: str,
    data: ObservationTemplateUpdate,
    request: Request
):
    """Update an existing observation window template"""
    user = await require_coach_developer(request)
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    # CRITICAL: Find template that belongs to user's organization
    query = {"template_id": template_id}
    if org_id:
        query["organization_id"] = org_id
    else:
        query["created_by"] = user.user_id
    
    template = await db.observation_templates.find_one(query, {"_id": 0})
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Build update dict with only provided fields
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.intervention_types is not None:
        update_data["intervention_types"] = data.intervention_types
    if data.descriptor_group1 is not None:
        update_data["descriptor_group1"] = data.descriptor_group1
    if data.descriptor_group2 is not None:
        update_data["descriptor_group2"] = data.descriptor_group2
    if data.session_parts is not None:
        update_data["session_parts"] = data.session_parts
    if data.include_ball_rolling is not None:
        update_data["include_ball_rolling"] = data.include_ball_rolling
    
    # Handle is_default special case
    if data.is_default is not None:
        update_data["is_default"] = data.is_default
        if data.is_default:
            # Unset default for other templates with same context
            template_org_id = template.get("organization_id")
            observation_context = template.get("observation_context")
            if template_org_id:
                await db.observation_templates.update_many(
                    {
                        "organization_id": template_org_id, 
                        "observation_context": observation_context,
                        "is_default": True,
                        "template_id": {"$ne": template_id}
                    },
                    {"$set": {"is_default": False}}
                )
    
    await db.observation_templates.update_one(
        {"template_id": template_id},
        {"$set": update_data}
    )
    
    # Return updated template
    updated = await db.observation_templates.find_one({"template_id": template_id}, {"_id": 0})
    return updated


@api_router.delete("/observation-templates/{template_id}")
async def delete_observation_template(template_id: str, request: Request):
    """Delete an observation window template"""
    user = await require_coach_developer(request)
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # For coach developers, also check if they're the owner
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    # First, check if template exists at all
    template = await db.observation_templates.find_one({"template_id": template_id}, {"_id": 0})
    
    if not template:
        # Also check admin_templates collection
        admin_tpl = await db.admin_templates.find_one({"template_id": template_id}, {"_id": 0})
        if admin_tpl:
            raise HTTPException(status_code=403, detail="Cannot delete admin templates from here. Use Admin Template Manager.")
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check authorization
    template_org = template.get("organization_id")
    template_creator = template.get("created_by")
    
    is_authorized = False
    
    # 1. User created the template
    if template_creator == user.user_id:
        is_authorized = True
    
    # 2. User belongs to the same organization
    if org_id and template_org and org_id == template_org:
        is_authorized = True
    
    # 3. User is admin (superuser)
    if user.role == "admin":
        is_authorized = True
    
    # 4. Coach developer role should be able to delete templates in their org
    if user.role == "coach_developer":
        if not template_org or not org_id:
            is_authorized = True
    
    if not is_authorized:
        logger.warning(f"Delete obs template denied: user {user.user_id} (org: {org_id}, role: {user.role}) tried to delete template {template_id} (org: {template_org}, creator: {template_creator})")
        raise HTTPException(status_code=403, detail="You don't have permission to delete this template")
    
    # Don't allow deleting if it's the only default template for that context
    if template.get("is_default"):
        template_org_id = template.get("organization_id")
        context = template.get("observation_context")
        other_defaults = await db.observation_templates.count_documents({
            "organization_id": template_org_id,
            "observation_context": context,
            "is_default": True,
            "template_id": {"$ne": template_id}
        })
        if other_defaults == 0:
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete the only default template for this context. Set another template as default first."
            )
    
    await db.observation_templates.delete_one({"template_id": template_id})
    
    return {"status": "success", "deleted": template_id}


@api_router.post("/observation-templates/{template_id}/set-default")
async def set_observation_template_default(template_id: str, request: Request):
    """Set an observation template as the default for its context"""
    user = await require_coach_developer(request)
    
    template = await db.observation_templates.find_one(
        {"template_id": template_id},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    org_id = template.get("organization_id")
    observation_context = template.get("observation_context")
    
    # Unset default for all other templates with same context in the org
    if org_id:
        await db.observation_templates.update_many(
            {"organization_id": org_id, "observation_context": observation_context, "is_default": True},
            {"$set": {"is_default": False}}
        )
    
    # Set this template as default
    await db.observation_templates.update_one(
        {"template_id": template_id},
        {"$set": {"is_default": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"status": "success", "template_id": template_id, "is_default": True}


@api_router.get("/observation-templates/default/{observation_context}")
async def get_default_observation_template(observation_context: str, request: Request):
    """Get the default observation template for a specific context (training or game)"""
    user = await require_auth(request)
    
    # Get user's organization_id
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    if not org_id and user.role == "coach_developer":
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        if org:
            org_id = org.get("org_id")
    
    if not org_id:
        raise HTTPException(status_code=404, detail="No organization found")
    
    # Find the default template for this context
    template = await db.observation_templates.find_one(
        {
            "organization_id": org_id,
            "observation_context": observation_context,
            "is_default": True
        },
        {"_id": 0}
    )
    
    if not template:
        # If no default set, return the first template for this context
        template = await db.observation_templates.find_one(
            {
                "organization_id": org_id,
                "observation_context": observation_context
            },
            {"_id": 0}
        )
    
    if not template:
        raise HTTPException(status_code=404, detail=f"No template found for context: {observation_context}")
    
    return template

# ============================================
# USER TEMPLATE PREFERENCES ENDPOINTS
# ============================================

@api_router.post("/user/templates/hide/{template_id}")
async def hide_template_for_user(template_id: str, request: Request):
    """Hide an admin/global template from user's view"""
    user = await require_auth(request)
    
    # Verify the template exists and is an admin template
    admin_tpl = await db.admin_templates.find_one(
        {"template_id": template_id, "is_admin_template": True},
        {"_id": 0}
    )
    
    if not admin_tpl:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    # Add to user's hidden templates list
    await db.user_template_preferences.update_one(
        {"user_id": user.user_id},
        {
            "$addToSet": {"hidden_template_ids": template_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    logger.info(f"User {user.user_id} hid template {template_id}")
    
    return {"success": True, "template_id": template_id, "hidden": True}


@api_router.post("/user/templates/show/{template_id}")
async def show_template_for_user(template_id: str, request: Request):
    """Unhide a previously hidden admin/global template"""
    user = await require_auth(request)
    
    # Remove from user's hidden templates list
    await db.user_template_preferences.update_one(
        {"user_id": user.user_id},
        {
            "$pull": {"hidden_template_ids": template_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    logger.info(f"User {user.user_id} unhid template {template_id}")
    
    return {"success": True, "template_id": template_id, "hidden": False}


@api_router.get("/user/templates/hidden")
async def get_hidden_templates(request: Request):
    """Get list of hidden template IDs for the current user"""
    user = await require_auth(request)
    
    user_prefs = await db.user_template_preferences.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    
    hidden_ids = user_prefs.get("hidden_template_ids", []) if user_prefs else []
    
    # Fetch details of hidden templates
    hidden_templates = []
    for tpl_id in hidden_ids:
        admin_tpl = await db.admin_templates.find_one(
            {"template_id": tpl_id},
            {"_id": 0, "template_id": 1, "name": 1, "category": 1}
        )
        if admin_tpl:
            hidden_templates.append(admin_tpl)
    
    return {"hidden_templates": hidden_templates, "count": len(hidden_templates)}


@api_router.post("/user/templates/set-default/{template_id}")
async def set_admin_template_as_user_default(template_id: str, request: Request):
    """Set an admin/global template as the user's default for its category"""
    user = await require_auth(request)
    
    # Verify the template exists and is an admin template
    admin_tpl = await db.admin_templates.find_one(
        {"template_id": template_id, "is_admin_template": True},
        {"_id": 0}
    )
    
    if not admin_tpl:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    category = admin_tpl.get("category")
    template_data = admin_tpl.get("template_data", {})
    
    # Get user's organization
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    org_id = user_doc.get("organization_id") if user_doc else None
    
    # Build query to find all templates accessible to this user
    if org_id:
        user_templates_query = {
            "$or": [
                {"organization_id": org_id},
                {"created_by": user.user_id},
                {"organization_id": {"$exists": False}},
                {"organization_id": None}
            ],
            "is_default": True
        }
    else:
        user_templates_query = {
            "$or": [
                {"created_by": user.user_id},
                {"organization_id": {"$exists": False}},
                {"organization_id": None}
            ],
            "is_default": True
        }
    
    # Determine the preference key based on category and context
    if category == "observation":
        obs_context = template_data.get("observationContext", "training")
        pref_key = f"observation_{obs_context}"
        # Unset default from regular observation templates
        user_templates_query["observation_context"] = obs_context
        await db.observation_templates.update_many(user_templates_query, {"$set": {"is_default": False}})
    elif category == "coach_reflection":
        pref_key = "coach_reflection"
        # Unset default from regular reflection templates (coach)
        user_templates_query["target_role"] = "coach"
        await db.reflection_templates.update_many(user_templates_query, {"$set": {"is_default": False}})
    elif category == "coach_developer_reflection":
        pref_key = "coach_developer_reflection"
        # Unset default from regular reflection templates (coach_educator)
        user_templates_query["target_role"] = "coach_educator"
        await db.reflection_templates.update_many(user_templates_query, {"$set": {"is_default": False}})
    else:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category}")
    
    # Update user preferences to set the admin template as the new default
    await db.user_template_preferences.update_one(
        {"user_id": user.user_id},
        {
            "$set": {
                f"default_admin_templates.{pref_key}": template_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    logger.info(f"User {user.user_id} set admin template {template_id} as default for {pref_key}")
    
    return {
        "success": True, 
        "template_id": template_id, 
        "is_default": True,
        "category": pref_key
    }


@api_router.post("/user/templates/unset-default/{template_id}")
async def unset_admin_template_as_user_default(template_id: str, request: Request):
    """Remove an admin/global template from being the user's default"""
    user = await require_auth(request)
    
    # Verify the template exists and is an admin template
    admin_tpl = await db.admin_templates.find_one(
        {"template_id": template_id, "is_admin_template": True},
        {"_id": 0}
    )
    
    if not admin_tpl:
        raise HTTPException(status_code=404, detail="Admin template not found")
    
    category = admin_tpl.get("category")
    template_data = admin_tpl.get("template_data", {})
    
    # Determine the preference key
    if category == "observation":
        obs_context = template_data.get("observationContext", "training")
        pref_key = f"observation_{obs_context}"
    elif category == "coach_reflection":
        pref_key = "coach_reflection"
    elif category == "coach_developer_reflection":
        pref_key = "coach_developer_reflection"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category}")
    
    # Remove from user preferences
    await db.user_template_preferences.update_one(
        {"user_id": user.user_id},
        {
            "$unset": {f"default_admin_templates.{pref_key}": ""},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    logger.info(f"User {user.user_id} removed admin template {template_id} as default for {pref_key}")
    
    return {
        "success": True, 
        "template_id": template_id, 
        "is_default": False
    }


# ============================================
# END OBSERVATION TEMPLATE ENDPOINTS
# ============================================

# Add CORS middleware BEFORE including routes (order matters!)
# Build comprehensive list of allowed origins for CORS with credentials
cors_origins_env = os.environ.get('CORS_ORIGINS', '')

# IMPORTANT: When using credentials (cookies), we CANNOT use wildcard '*'
# We must explicitly list allowed origins
# Start with known origins - production and development
allowed_origins = [
    "https://mycoachdeveloper.com",
    "https://www.mycoachdeveloper.com",
    "https://coachwatch.emergent.host",
    "http://localhost:3000",
    "http://localhost:8001",
    "https://system-defaults-tab.preview.emergentagent.com",
]

# Add APP_URL if set and not empty
if APP_URL and APP_URL not in allowed_origins:
    allowed_origins.append(APP_URL)

# Add preview URLs dynamically from environment
preview_url = os.environ.get('REACT_APP_BACKEND_URL', '')
if preview_url and preview_url not in allowed_origins:
    allowed_origins.append(preview_url)

# Add any additional origins from CORS_ORIGINS environment (except wildcard)
if cors_origins_env and cors_origins_env != '*':
    for origin in cors_origins_env.split(','):
        origin = origin.strip()
        if origin and origin != '*' and origin not in allowed_origins:
            allowed_origins.append(origin)

# Remove duplicates while preserving order, and filter out any empty strings
allowed_origins = [o for o in dict.fromkeys(allowed_origins) if o]

logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,  # Cache preflight for 24 hours
)

# Include the router in the main app AFTER middleware
app.include_router(api_router)

# ============================================
# ADMIN BOOTSTRAP - Create default admin user on startup
# ============================================
@app.on_event("startup")
async def bootstrap_admin():
    """Create default admin user if it doesn't exist, along with organization and templates"""
    admin_email = "hello@mycoachdeveloper.com"
    admin_password = "_mcDeveloper26!"
    
    # Check if admin user already exists
    existing_admin = await db.users.find_one({"email": admin_email})
    if existing_admin:
        # Always ensure this user has admin role and password
        updates = {}
        if existing_admin.get("role") != "admin":
            updates["role"] = "admin"
            logger.info(f"Updating user role to admin: {admin_email}")
        if not existing_admin.get("password_hash"):
            updates["password_hash"] = hash_password(admin_password)
            logger.info(f"Setting admin user password: {admin_email}")
        
        # Check if admin needs an organization
        admin_user_id = existing_admin.get("user_id")
        org_id = existing_admin.get("organization_id")
        
        if not org_id:
            # Create an organization for the admin
            org_id = f"org_{uuid.uuid4().hex[:12]}"
            org_doc = {
                "org_id": org_id,
                "owner_id": admin_user_id,
                "club_name": "My Coach Developer",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.organizations.insert_one(org_doc)
            updates["organization_id"] = org_id
            logger.info(f"Created organization for admin: {org_id}")
            
            # Bootstrap default templates for this organization
            await bootstrap_default_templates(org_id, admin_user_id)
            logger.info(f"Bootstrapped templates for admin org: {org_id}")
        
        if updates:
            await db.users.update_one(
                {"email": admin_email},
                {"$set": updates}
            )
            logger.info(f"Updated admin user: {admin_email} with {list(updates.keys())}")
        else:
            logger.info(f"Admin user already configured: {admin_email} (role={existing_admin.get('role')})")
        return
    
    # Create default admin user with organization
    admin_user_id = f"admin_{uuid.uuid4().hex[:12]}"
    org_id = f"org_{uuid.uuid4().hex[:12]}"
    hashed_pw = hash_password(admin_password)
    
    # Create the organization first
    org_doc = {
        "org_id": org_id,
        "owner_id": admin_user_id,
        "club_name": "My Coach Developer",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organizations.insert_one(org_doc)
    
    admin_doc = {
        "user_id": admin_user_id,
        "email": admin_email,
        "name": "Coach Developer Admin",
        "password_hash": hashed_pw,
        "role": "admin",
        "organization_id": org_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin_doc)
    logger.info(f"Created default admin user: {admin_email} with org: {org_id}")
    
    # Bootstrap default templates for the admin organization
    await bootstrap_default_templates(org_id, admin_user_id)
    logger.info(f"Bootstrapped default templates for admin organization")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()