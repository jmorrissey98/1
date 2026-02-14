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
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage


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
APP_URL = os.environ.get('APP_URL')

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
    user_count: int = 0
    coach_count: int = 0
    created_at: Optional[str] = None

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

# Default session parts
DEFAULT_SESSION_PARTS = [
    {"part_id": "default_technique", "name": "Develop The Technique", "is_default": True},
    {"part_id": "default_game_model", "name": "Develop The Game Model", "is_default": True},
    {"part_id": "default_performance", "name": "Develop Performance", "is_default": True},
    {"part_id": "default_mentality", "name": "Develop Mentality", "is_default": True},
]

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
        
        if existing_coach:
            # Link user to existing coach profile
            linked_coach_id = existing_coach.get("id")
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {"linked_coach_id": linked_coach_id}}
            )
            user.linked_coach_id = linked_coach_id
        else:
            # Create new coach profile for this user
            coach_id = f"coach_{uuid.uuid4().hex[:12]}"
            new_coach = {
                "id": coach_id,
                "name": user.name,
                "email": user.email,
                "photo": user.picture,
                "targets": [],
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
            await db.coaches.insert_one(new_coach)
            
            # Link user to new coach profile
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {"linked_coach_id": coach_id}}
            )
            user.linked_coach_id = coach_id
            logger.info(f"Auto-created coach profile {coach_id} for user {user.email}")
    
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
    session = await db.sessions.find_one({"session_id": session_id}, {"_id": 0})
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
async def upload_file(file: UploadFile = File(...)):
    """Upload a file and return its metadata"""
    try:
        file_id = str(uuid.uuid4())
        file_ext = Path(file.filename).suffix
        safe_filename = f"{file_id}{file_ext}"
        file_path = UPLOAD_DIR / safe_filename
        
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        return FileUploadResponse(
            id=file_id,
            name=file.filename,
            type=file.content_type or 'application/octet-stream',
            size=len(content),
            url=f"/api/files/{safe_filename}",
            uploadedAt=datetime.now(timezone.utc).isoformat()
        )
    except Exception as e:
        logger.error(f"File upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@api_router.get("/files/{filename}")
async def get_file(filename: str):
    """Retrieve an uploaded file"""
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

@api_router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """Delete an uploaded file"""
    # Find file with this ID
    for f in UPLOAD_DIR.iterdir():
        if f.stem == file_id:
            f.unlink()
            return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="File not found")

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
    
    # Check expiry
    expires_at = session_doc.get("expires_at")
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

# Auth endpoints
@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id from Emergent Auth for session_token"""
    try:
        body = await request.json()
        session_id = body.get("session_id")
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id required")
        
        logger.info(f"Auth session exchange started for session_id: {session_id[:20]}...")
        
        # Exchange session_id with Emergent Auth
        async with httpx.AsyncClient(timeout=30.0) as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            logger.info(f"Emergent auth response status: {auth_response.status_code}")
            
            if auth_response.status_code != 200:
                logger.error(f"Emergent auth failed: {auth_response.text}")
                raise HTTPException(status_code=401, detail="Invalid session")
            
            auth_data = auth_response.json()
        
        email = auth_data.get("email")
        name = auth_data.get("name")
        picture = auth_data.get("picture")
        session_token = auth_data.get("session_token")
        
        logger.info(f"Auth data received for email: {email}")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        logger.info(f"Existing user lookup result: {bool(existing_user)}")
        
        if existing_user:
            # Update existing user
            logger.info(f"Updating existing user: {existing_user.get('user_id')}")
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": name, "picture": picture}}
            )
            user_role = existing_user.get("role", "coach")
            linked_coach_id = existing_user.get("linked_coach_id")
        else:
            # Check if there's an invite for this email
            invite = await db.invites.find_one({"email": email, "used": False}, {"_id": 0})
            
            # Check if this is the first user (becomes Coach Developer)
            user_count = await db.users.count_documents({})
            
            if user_count == 0:
                # First user becomes Coach Developer
                user_role = "coach_developer"
                linked_coach_id = None
            elif invite:
                # Use invite role and coach_id
                user_role = invite.get("role", "coach")
                linked_coach_id = invite.get("coach_id")
                invited_by = invite.get("invited_by")
                
                # Mark invite as used
                await db.invites.update_one(
                    {"invite_id": invite["invite_id"]},
                    {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Auto-create coach profile if role is coach
                if user_role == "coach":
                    # First, check if a coach profile already exists for this email
                    # (created manually by Coach Developer)
                    existing_coach = await db.coaches.find_one(
                        {"email": {"$regex": f"^{email}$", "$options": "i"}},
                        {"_id": 0}
                    )
                    
                    if existing_coach:
                        # Link to existing profile
                        linked_coach_id = existing_coach.get("id")
                        logger.info(f"Linking user {email} to existing coach profile {linked_coach_id}")
                    else:
                        # Create new coach profile
                        coach_id = f"coach_{uuid.uuid4().hex[:12]}"
                        new_coach = {
                            "id": coach_id,
                            "user_id": None,  # Will be set after user creation
                            "name": name,
                            "email": email,
                            "photo": picture,
                            "role_title": None,
                            "age_group": None,
                            "department": None,
                            "bio": None,
                            "targets": [],
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "created_by": invited_by
                        }
                        await db.coaches.insert_one(new_coach)
                        linked_coach_id = coach_id
                        logger.info(f"Auto-created coach profile {coach_id} for invited user {email}")
            else:
                # No invite - reject registration
                raise HTTPException(
                    status_code=403, 
                    detail="Registration requires an invite. Please contact a Coach Developer."
                )
            
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            new_user = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "role": user_role,
                "linked_coach_id": linked_coach_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "auth_provider": "google"
            }
            await db.users.insert_one(new_user)
            
            # Update coach profile with user_id if coach role
            if user_role == "coach" and linked_coach_id:
                await db.coaches.update_one(
                    {"id": linked_coach_id},
                    {"$set": {
                        "user_id": user_id,
                        "photo": picture,  # Update photo from Google account
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
        
        # Store session
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,  # 7 days
            path="/"
        )
        
        return {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": user_role,
            "linked_coach_id": linked_coach_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Auth error: {str(e)}\nTraceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(request: Request):
    """Get current authenticated user"""
    user = await require_auth(request)
    
    # Get auth_provider and organization_id from database
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    auth_provider = user_doc.get("auth_provider", "google") if user_doc else "google"
    organization_id = user_doc.get("organization_id") if user_doc else user.organization_id
    
    return UserResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        role=user.role,
        linked_coach_id=user.linked_coach_id,
        organization_id=organization_id,
        auth_provider=auth_provider
    )

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout - clear session"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"status": "logged out"}

@api_router.get("/users/check-first")
async def check_first_user():
    """Check if there are any users in the system (for showing club fields on signup)"""
    user_count = await db.users.count_documents({})
    return {"is_first": user_count == 0}

@api_router.get("/admin/check")
async def check_admin_exists():
    """Check if the admin user exists (for debugging deployment issues)"""
    admin_email = "hello@mycoachdeveloper.com"
    admin_user = await db.users.find_one(
        {"email": admin_email}, 
        {"_id": 0, "password_hash": 0}
    )
    if admin_user:
        return {
            "exists": True,
            "user_id": admin_user.get("user_id"),
            "role": admin_user.get("role"),
            "email": admin_user.get("email")
        }
    return {"exists": False}

# Email/Password Auth Endpoints
@api_router.post("/auth/signup")
async def signup(signup_data: SignupRequest, response: Response):
    """Create a new account with email and password"""
    try:
        # Validate email format
        if not validate_email(signup_data.email):
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Validate password
        is_valid, error_msg = validate_password(signup_data.password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Normalize email to lowercase for consistency
        email_lower = signup_data.email.lower()
        
        # Check if user already exists (case-insensitive)
        existing_user = await db.users.find_one(
            {"email": {"$regex": f"^{email_lower}$", "$options": "i"}}, 
            {"_id": 0}
        )
        if existing_user:
            raise HTTPException(status_code=400, detail="An account with this email already exists")
        
        # Check if this is the first user (becomes Coach Developer)
        user_count = await db.users.count_documents({})
        
        if user_count == 0:
            # First user becomes Coach Developer
            user_role = "coach_developer"
            linked_coach_id = None
        else:
            # Check if there's an invite for this email (case-insensitive)
            invite = await db.invites.find_one(
                {"email": {"$regex": f"^{email_lower}$", "$options": "i"}, "used": False}, 
                {"_id": 0}
            )
            
            if invite:
                # Use invite role and coach_id
                user_role = invite.get("role", "coach")
                linked_coach_id = invite.get("coach_id")
                # Mark invite as used
                await db.invites.update_one(
                    {"invite_id": invite["invite_id"]},
                    {"$set": {"used": True}}
                )
            else:
                # No invite - reject registration
                raise HTTPException(
                    status_code=403, 
                    detail="Registration requires an invite. Please contact a Coach Developer."
                )
        
        # Hash password
        password_hash = hash_password(signup_data.password)
        
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        session_token = secrets.token_urlsafe(32)
        
        new_user = {
            "user_id": user_id,
            "email": signup_data.email,
            "name": signup_data.name,
            "password_hash": password_hash,
            "picture": None,
            "role": user_role,
            "linked_coach_id": linked_coach_id,
            "auth_provider": "email",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
        
        # If this is the first user (Coach Developer) and club info provided, create organization
        if user_role == "coach_developer" and (signup_data.club_name or signup_data.club_logo):
            org_id = f"org_{uuid.uuid4().hex[:12]}"
            org_doc = {
                "org_id": org_id,
                "owner_id": user_id,
                "club_name": signup_data.club_name,
                "club_logo": signup_data.club_logo,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.organizations.insert_one(org_doc)
            logger.info(f"Created organization {org_id} for user {user_id}")
        
        # Update coach profile if this is a coach user with a linked coach profile
        if user_role == "coach" and linked_coach_id:
            await db.coaches.update_one(
                {"id": linked_coach_id},
                {"$set": {
                    "user_id": user_id,
                    "has_account": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"Linked user {user_id} to coach profile {linked_coach_id}")
        
        # Create session
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Set cookie (for same-domain scenarios)
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        # Return token in body as well (for cross-domain scenarios where cookies don't work)
        return {
            "user_id": user_id,
            "email": signup_data.email,
            "name": signup_data.name,
            "role": user_role,
            "linked_coach_id": linked_coach_id,
            "auth_provider": "email",
            "token": session_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

@api_router.post("/auth/login")
async def login(login_data: LoginRequest, response: Response):
    """Login with email and password"""
    try:
        # Find user by email
        user_doc = await db.users.find_one({"email": login_data.email}, {"_id": 0})
        
        if not user_doc:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Check if user has password (might be Google-only user)
        password_hash = user_doc.get("password_hash")
        if not password_hash:
            raise HTTPException(
                status_code=401, 
                detail="This account uses Google sign-in. Please use 'Sign in with Google'."
            )
        
        # Verify password
        if not verify_password(login_data.password, password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Create session
        user_id = user_doc["user_id"]
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Set cookie (for same-domain scenarios)
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        # Return token in body as well (for cross-domain scenarios where cookies don't work)
        return {
            "user_id": user_id,
            "email": user_doc["email"],
            "name": user_doc["name"],
            "picture": user_doc.get("picture"),
            "role": user_doc.get("role", "coach"),
            "linked_coach_id": user_doc.get("linked_coach_id"),
            "auth_provider": user_doc.get("auth_provider", "email"),
            "token": session_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@api_router.post("/auth/forgot-password")
async def forgot_password(forgot_data: ForgotPasswordRequest):
    """Request password reset email"""
    try:
        # Find user by email
        user_doc = await db.users.find_one({"email": forgot_data.email}, {"_id": 0})
        
        # Always return success to prevent email enumeration
        if not user_doc:
            return {"message": "If an account with this email exists, a password reset link has been sent."}
        
        # Check if user has email auth (not Google-only)
        if user_doc.get("auth_provider") == "google" and not user_doc.get("password_hash"):
            return {"message": "If an account with this email exists, a password reset link has been sent."}
        
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        
        # Store reset token
        await db.password_resets.delete_many({"email": forgot_data.email})  # Remove old tokens
        await db.password_resets.insert_one({
            "email": forgot_data.email,
            "token": reset_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Send email
        try:
            await send_password_reset_email(
                email=forgot_data.email,
                reset_token=reset_token,
                user_name=user_doc.get("name", "User")
            )
        except Exception as e:
            logger.error(f"Failed to send password reset email: {str(e)}")
            # Don't expose email sending errors to user
        
        return {"message": "If an account with this email exists, a password reset link has been sent."}
        
    except Exception as e:
        logger.error(f"Forgot password error: {str(e)}")
        return {"message": "If an account with this email exists, a password reset link has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(reset_data: ResetPasswordRequest):
    """Reset password using token"""
    try:
        # Find reset token
        reset_doc = await db.password_resets.find_one({"token": reset_data.token}, {"_id": 0})
        
        if not reset_doc:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
        # Check expiry
        expires_at = datetime.fromisoformat(reset_doc["expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            await db.password_resets.delete_one({"token": reset_data.token})
            raise HTTPException(status_code=400, detail="Reset token has expired")
        
        # Validate new password
        is_valid, error_msg = validate_password(reset_data.new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Hash new password
        password_hash = hash_password(reset_data.new_password)
        
        # Update user password
        result = await db.users.update_one(
            {"email": reset_doc["email"]},
            {"$set": {"password_hash": password_hash, "auth_provider": "email"}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=400, detail="User not found")
        
        # Delete reset token
        await db.password_resets.delete_one({"token": reset_data.token})
        
        # Invalidate all existing sessions for this user
        user_doc = await db.users.find_one({"email": reset_doc["email"]}, {"_id": 0})
        if user_doc:
            await db.user_sessions.delete_many({"user_id": user_doc["user_id"]})
        
        return {"message": "Password has been reset successfully. Please log in with your new password."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to reset password")

@api_router.post("/auth/change-password")
async def change_password(change_data: ChangePasswordRequest, request: Request):
    """Change password for authenticated user"""
    user = await require_auth(request)
    
    try:
        # Get user with password hash
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if user has password
        password_hash = user_doc.get("password_hash")
        if not password_hash:
            raise HTTPException(
                status_code=400, 
                detail="Cannot change password for Google-only accounts"
            )
        
        # Verify current password
        if not verify_password(change_data.current_password, password_hash):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        
        # Validate new password
        is_valid, error_msg = validate_password(change_data.new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Hash and update new password
        new_password_hash = hash_password(change_data.new_password)
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"password_hash": new_password_hash}}
        )
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Change password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to change password")

@api_router.get("/auth/verify-reset-token/{token}")
async def verify_reset_token(token: str):
    """Verify if a password reset token is valid"""
    try:
        reset_doc = await db.password_resets.find_one({"token": token}, {"_id": 0})
        
        if not reset_doc:
            return {"valid": False, "message": "Invalid reset token"}
        
        expires_at = datetime.fromisoformat(reset_doc["expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            return {"valid": False, "message": "Reset token has expired"}
        
        return {"valid": True, "email": reset_doc["email"]}
        
    except Exception as e:
        logger.error(f"Verify reset token error: {str(e)}")
        return {"valid": False, "message": "Failed to verify token"}

# ============================================
# COACHES API (Coach Developer access)
# ============================================

@api_router.get("/coaches")
async def list_all_coaches(request: Request):
    """
    List all coaches in the system.
    Coach Developer only - returns all coach profiles.
    Also syncs users with role='coach' who don't have profiles yet.
    """
    await require_coach_developer(request)
    
    # First, find any users with role='coach' who don't have a coach profile
    # and create profiles for them (migration/sync)
    coach_users = await db.users.find({"role": "coach"}, {"_id": 0}).to_list(200)
    
    for coach_user in coach_users:
        user_id = coach_user.get("user_id")
        linked_coach_id = coach_user.get("linked_coach_id")
        
        # If user has no linked coach profile, create one
        if not linked_coach_id:
            coach_id = f"coach_{uuid.uuid4().hex[:12]}"
            new_coach = {
                "id": coach_id,
                "user_id": user_id,
                "name": coach_user.get("name", "Unknown"),
                "email": coach_user.get("email"),
                "photo": coach_user.get("picture"),
                "role_title": None,
                "age_group": None,
                "department": None,
                "bio": None,
                "targets": [],
                "created_at": coach_user.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "created_by": None  # Unknown - created via migration
            }
            await db.coaches.insert_one(new_coach)
            
            # Link the user to this coach profile
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"linked_coach_id": coach_id}}
            )
            logger.info(f"Auto-created coach profile {coach_id} for existing user {coach_user.get('email')}")
        else:
            # Ensure the coach profile exists
            existing_profile = await db.coaches.find_one({"id": linked_coach_id}, {"_id": 0})
            if not existing_profile:
                # Coach profile missing - create it
                new_coach = {
                    "id": linked_coach_id,
                    "user_id": user_id,
                    "name": coach_user.get("name", "Unknown"),
                    "email": coach_user.get("email"),
                    "photo": coach_user.get("picture"),
                    "role_title": None,
                    "age_group": None,
                    "department": None,
                    "bio": None,
                    "targets": [],
                    "created_at": coach_user.get("created_at", datetime.now(timezone.utc).isoformat()),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": None
                }
                await db.coaches.insert_one(new_coach)
                logger.info(f"Recreated missing coach profile {linked_coach_id} for user {coach_user.get('email')}")
    
    # Now fetch all coach profiles
    coaches = await db.coaches.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Batch fetch user accounts to avoid N+1 queries
    user_ids = [c.get("user_id") for c in coaches if c.get("user_id")]
    users_map = {}
    if user_ids:
        users = await db.users.find(
            {"user_id": {"$in": user_ids}}, 
            {"_id": 0, "user_id": 1, "email": 1}
        ).to_list(200)
        users_map = {u["user_id"]: u for u in users}
    
    # Batch fetch session counts for all coaches using aggregation (avoids N+1 queries)
    coach_ids = [c.get("id") for c in coaches if c.get("id")]
    session_counts_map = {}
    upcoming_counts_map = {}
    
    if coach_ids:
        # Use aggregation pipeline to get all counts in a single query
        pipeline = [
            {"$match": {"coach_id": {"$in": coach_ids}, "status": {"$in": ["completed", "planned"]}}},
            {"$group": {
                "_id": {"coach_id": "$coach_id", "status": "$status"},
                "count": {"$sum": 1}
            }}
        ]
        
        counts_cursor = db.observation_sessions.aggregate(pipeline)
        counts_result = await counts_cursor.to_list(length=None)
        
        # Process aggregation results into maps
        for item in counts_result:
            coach_id = item["_id"]["coach_id"]
            status = item["_id"]["status"]
            count = item["count"]
            
            if status == "completed":
                session_counts_map[coach_id] = count
            elif status == "planned":
                upcoming_counts_map[coach_id] = count
    
    # Enrich with user account status and session counts
    result = []
    for coach in coaches:
        user_id = coach.get("user_id")
        coach_id = coach.get("id")
        has_account = False
        user_email = coach.get("email")
        
        if user_id and user_id in users_map:
            has_account = True
            user_email = users_map[user_id].get("email", user_email)
        
        result.append({
            "id": coach_id,
            "name": coach.get("name"),
            "email": user_email,
            "photo": coach.get("photo"),
            "role_title": coach.get("role_title"),
            "age_group": coach.get("age_group"),
            "department": coach.get("department"),
            "bio": coach.get("bio"),
            "targets": coach.get("targets", []),
            "created_at": coach.get("created_at"),
            "updated_at": coach.get("updated_at"),
            "has_account": has_account,
            "user_id": user_id,
            "sessionCount": session_counts_map.get(coach_id, 0),
            "upcomingCount": upcoming_counts_map.get(coach_id, 0)
        })
    
    return result

@api_router.post("/coaches")
async def create_coach_manually(request: Request):
    """
    Manually create a coach profile (Coach Developer only).
    Also creates an invite if the user doesn't exist.
    Email is required to ensure proper linking.
    """
    user = await require_coach_developer(request)
    body = await request.json()
    
    name = body.get("name", "").strip()
    email = body.get("email", "").strip().lower() if body.get("email") else None
    role_title = body.get("role_title", "").strip() if body.get("role_title") else None
    
    if not name:
        raise HTTPException(status_code=400, detail="Coach name is required")
    
    if not email:
        raise HTTPException(status_code=400, detail="Coach email is required")
    
    if not validate_email(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check if a coach profile already exists with this email
    existing_coach = await db.coaches.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    if existing_coach:
        raise HTTPException(
            status_code=400, 
            detail=f"A coach profile already exists for {email}"
        )
    
    # Check if a user with this email exists
    existing_user = await db.users.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    
    coach_id = f"coach_{uuid.uuid4().hex[:12]}"
    
    if existing_user:
        # User exists - create profile and link
        new_coach = {
            "id": coach_id,
            "user_id": existing_user.get("user_id"),
            "name": name,
            "email": email,
            "photo": existing_user.get("picture"),
            "role_title": role_title,
            "age_group": None,
            "department": None,
            "bio": None,
            "targets": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user.user_id
        }
        await db.coaches.insert_one(new_coach)
        
        # Link user to coach profile and set role to coach
        await db.users.update_one(
            {"user_id": existing_user.get("user_id")},
            {"$set": {"linked_coach_id": coach_id, "role": "coach"}}
        )
        
        logger.info(f"Coach profile {coach_id} created and linked to existing user {email}")
        
        return {
            **new_coach,
            "_id": None,
            "has_account": True,
            "invite_sent": False
        }
    
    # User doesn't exist - create coach profile AND an invite
    new_coach = {
        "id": coach_id,
        "user_id": None,
        "name": name,
        "email": email,
        "photo": None,
        "role_title": role_title,
        "age_group": None,
        "department": None,
        "bio": None,
        "targets": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.user_id
    }
    await db.coaches.insert_one(new_coach)
    
    # Check if invite already exists for this email
    existing_invite = await db.invites.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}, "used": False},
        {"_id": 0}
    )
    
    invite_sent = False
    if not existing_invite:
        # Create invite with coach role, linked to this coach profile
        invite_id = f"inv_{uuid.uuid4().hex[:12]}"
        invite = {
            "invite_id": invite_id,
            "email": email,
            "role": "coach",
            "coach_id": coach_id,  # Link invite to coach profile
            "invited_by": user.user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "used": False
        }
        await db.invites.insert_one(invite)
        
        # Send invite email
        try:
            await send_invite_email(
                email=email,
                inviter_name=user.name,
                role="coach",
                invite_id=invite_id,
                invitee_name=name  # Pass the coach's name for personalized email
            )
            invite_sent = True
            logger.info(f"Invite sent to {email} for coach profile {coach_id}")
        except Exception as e:
            logger.error(f"Failed to send invite email to {email}: {str(e)}")
    
    logger.info(f"Coach profile {coach_id} created manually by {user.user_id}")
    
    return {
        **{k: v for k, v in new_coach.items() if k != "_id"},
        "has_account": False,
        "invite_sent": invite_sent
    }

@api_router.get("/coaches/{coach_id}")
async def get_coach_detail(coach_id: str, request: Request):
    """
    Get detailed coach profile.
    Coach Developer can access any coach in their org.
    Coach can access their own linked coach profile.
    """
    user = await get_current_user(request)
    
    coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Check access: either coach developer OR coach accessing their own profile
    is_coach_developer = user.role in ["coach_developer", "admin"]
    is_own_profile = getattr(user, 'linked_coach_id', None) == coach_id
    
    if not is_coach_developer and not is_own_profile:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get linked user info
    user_id = coach.get("user_id")
    has_account = False
    if user_id:
        linked_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        has_account = linked_user is not None
    
    return {
        **coach,
        "has_account": has_account
    }

@api_router.get("/coaches/{coach_id}/sessions")
async def get_coach_sessions_by_id(coach_id: str, request: Request):
    """
    Get all observation sessions for a specific coach.
    Coach Developer only - used to view a coach's session history.
    """
    await require_coach_developer(request)
    
    # Verify coach exists
    coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Get all observation sessions for this coach
    sessions_cursor = db.observation_sessions.find(
        {"coach_id": coach_id},
        {"_id": 0}
    ).sort("updated_at", -1)
    
    sessions = await sessions_cursor.to_list(100)
    
    # Get observer names in batch
    observer_ids = list(set(s.get("observer_id") for s in sessions if s.get("observer_id")))
    observers_map = {}
    if observer_ids:
        observers = await db.users.find(
            {"user_id": {"$in": observer_ids}},
            {"_id": 0, "user_id": 1, "name": 1}
        ).to_list(100)
        observers_map = {o["user_id"]: o.get("name") for o in observers}
    
    result = []
    for s in sessions:
        result.append({
            "session_id": s.get("session_id"),
            "id": s.get("session_id"),  # Also include 'id' for frontend compatibility
            "name": s.get("name", "Untitled"),
            "title": s.get("name", "Untitled"),  # Also include 'title' for compatibility
            "coach_id": coach_id,
            "observer_id": s.get("observer_id"),
            "observer_name": observers_map.get(s.get("observer_id")),
            "observation_context": s.get("observation_context", "training"),
            "status": s.get("status", "draft"),
            "created_at": s.get("created_at", ""),
            "createdAt": s.get("created_at", ""),  # Also include camelCase for compatibility
            "updated_at": s.get("updated_at", ""),
            "total_duration": s.get("total_duration", 0),
            "totalDuration": s.get("total_duration", 0),  # Also include camelCase
            "events": s.get("events", []),
            "event_count": len(s.get("events", [])),
            "sessionParts": s.get("session_parts", []),
            "eventTypes": s.get("intervention_types", [])
        })
    
    return result

@api_router.put("/coaches/{coach_id}")
async def update_coach(coach_id: str, request: Request):
    """
    Update coach profile (Coach Developer only).
    """
    user = await require_coach_developer(request)
    
    coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    body = await request.json()
    
    # Allowed fields for update
    allowed_fields = ["name", "role_title", "age_group", "department", "bio", "targets"]
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.coaches.update_one(
        {"id": coach_id},
        {"$set": update_data}
    )
    
    logger.info(f"Coach {coach_id} updated by {user.user_id}")
    
    return await get_coach_detail(coach_id, request)

@api_router.delete("/coaches/{coach_id}")
async def delete_coach(coach_id: str, request: Request):
    """
    Delete a coach profile (Coach Developer only).
    Query params:
      - delete_user=true: Also delete the associated user account
    """
    try:
        user = await require_coach_developer(request)
        
        # Check query param for full user deletion
        delete_user = request.query_params.get("delete_user", "").lower() == "true"
        
        coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
        if not coach:
            raise HTTPException(status_code=404, detail="Coach not found")
        
        coach_user_id = coach.get("user_id")
        
        if delete_user and coach_user_id:
            # Delete the user account entirely
            await db.users.delete_one({"user_id": coach_user_id})
            logger.info(f"Deleted user account {coach_user_id} for coach {coach_id}")
        elif coach_user_id:
            # Just unlink from user account
            await db.users.update_one(
                {"user_id": coach_user_id},
                {"$set": {"linked_coach_id": None, "role": "coach_developer"}}  # Promote to developer or set neutral role
            )
        
        # Delete any associated pending invites (by coach_id or by email)
        coach_email = (coach.get("email") or "").strip().lower()
        
        # Build delete query for invites
        invite_query_conditions = [{"coach_id": coach_id}]
        if coach_email:
            invite_query_conditions.append({
                "email": {"$regex": f"^{coach_email}$", "$options": "i"}, 
                "used": {"$ne": True}
            })
        
        delete_result = await db.invites.delete_many({"$or": invite_query_conditions})
        if delete_result.deleted_count > 0:
            logger.info(f"Deleted {delete_result.deleted_count} associated invite(s) for coach {coach_id}")
        
        # Delete the coach profile
        await db.coaches.delete_one({"id": coach_id})
        
        logger.info(f"Coach {coach_id} deleted by {user.user_id}")
        
        return {"status": "deleted", "user_deleted": delete_user and coach_user_id is not None}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting coach {coach_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete coach: {str(e)}")

# ============================================
# END COACHES API
# ============================================

# Invite endpoints
@api_router.post("/invites", response_model=InviteResponse)
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
            "email": email_lower,  # Store lowercase
            "role": invite_data.role,
            "coach_id": invite_data.coach_id,
            "invited_by": user.user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "used": False
        }
        
        # Insert invite into database
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
                invitee_name=None  # No name for direct invites (not from coach profile)
            )
            email_sent = True
            logger.info(f"Invite email sent successfully to {email_lower}")
            
            # Update invite record with email status
            await db.invites.update_one(
                {"invite_id": invite_id},
                {"$set": {"email_sent": True, "email_sent_at": datetime.now(timezone.utc).isoformat()}}
            )
        except Exception as email_err:
            email_error = str(email_err)
            logger.error(f"Failed to send invite email to {email_lower}: {email_error}")
            
            # Update invite record with failure status
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

@api_router.get("/invites", response_model=List[InviteResponse])
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

@api_router.delete("/invites/{invite_id}")
async def delete_invite(invite_id: str, request: Request):
    """Delete an invite (Coach Developer only)"""
    await require_coach_developer(request)
    
    result = await db.invites.delete_one({"invite_id": invite_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found")
    return {"status": "deleted"}

@api_router.delete("/invites/by-email/{email}")
async def delete_invite_by_email(email: str, request: Request):
    """Delete an invite by email address (Coach Developer only)"""
    await require_coach_developer(request)
    
    email_lower = email.lower().strip()
    result = await db.invites.delete_many({"email": {"$regex": f"^{email_lower}$", "$options": "i"}})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No invite found for this email")
    return {"status": "deleted", "count": result.deleted_count}

@api_router.post("/invites/{invite_id}/resend")
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

@api_router.get("/invites/validate/{invite_id}", response_model=InviteValidationResponse)
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

class InviteRegistrationRequest(BaseModel):
    invite_id: str
    password: str
    photo: Optional[str] = None  # Base64 or URL

@api_router.post("/auth/register-invite")
async def register_from_invite(data: InviteRegistrationRequest):
    """
    Register a new user from an invite link.
    Bypasses payment - creates account directly with invite role.
    """
    invite = await db.invites.find_one({"invite_id": data.invite_id}, {"_id": 0})
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite")
    
    if invite.get("used"):
        raise HTTPException(status_code=400, detail="This invitation has already been used")
    
    email = invite["email"]
    role = invite.get("role", "coach")
    coach_id = invite.get("coach_id")
    invited_by = invite.get("invited_by")
    
    # Check if user already exists
    existing_user = await db.users.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    
    # Get name from coach profile if exists
    name = email.split("@")[0]  # Default to email prefix
    if coach_id:
        coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
        if coach:
            name = coach.get("name", name)
    
    # Validate password
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Hash password
    password_hash = hash_password(data.password)
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    new_user = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "password_hash": password_hash,
        "role": role,
        "picture": data.photo,
        "linked_coach_id": coach_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": None  # Will be set based on inviter's org
    }
    
    # Get organization from inviter
    if invited_by:
        inviter = await db.users.find_one({"user_id": invited_by}, {"_id": 0, "organization_id": 1})
        if inviter and inviter.get("organization_id"):
            new_user["organization_id"] = inviter["organization_id"]
    
    await db.users.insert_one(new_user)
    
    # Update coach profile to link to user
    if coach_id:
        await db.coaches.update_one(
            {"id": coach_id},
            {"$set": {
                "user_id": user_id,
                "photo": data.photo,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    # Mark invite as used
    await db.invites.update_one(
        {"invite_id": data.invite_id},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    logger.info(f"User {email} registered via invite {data.invite_id}")
    
    # Generate session token
    session_token = secrets.token_urlsafe(32)
    
    # Create session
    session = {
        "user_id": user_id,
        "email": email,
        "session_token": session_token,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session)
    
    return {
        "token": session_token,
        "user": {
            "user_id": user_id,
            "email": email,
            "name": name,
            "role": role,
            "picture": data.photo
        }
    }

# User management endpoints
@api_router.get("/users", response_model=List[UserResponse])
async def list_users(request: Request):
    """List all users (Coach Developer only)"""
    await require_coach_developer(request)
    
    users = await db.users.find({}, {"_id": 0}).to_list(100)
    return [
        UserResponse(
            user_id=u["user_id"],
            email=u["email"],
            name=u["name"],
            picture=u.get("picture"),
            role=u.get("role", "coach"),
            linked_coach_id=u.get("linked_coach_id")
        )
        for u in users
    ]

@api_router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, role_data: RoleUpdateRequest, request: Request):
    """Update a user's role (Coach Developer only)"""
    current_user = await require_coach_developer(request)
    
    # Prevent changing own role
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    
    if role_data.new_role not in ["coach_developer", "coach"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": role_data.new_role}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "updated", "new_role": role_data.new_role}

@api_router.put("/users/{user_id}/link-coach")
async def link_user_to_coach(user_id: str, request: Request):
    """Link a user to a coach profile (Coach Developer only)"""
    await require_coach_developer(request)
    
    body = await request.json()
    coach_id = body.get("coach_id")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"linked_coach_id": coach_id}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "linked", "coach_id": coach_id}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete a user (Coach Developer only, cannot delete yourself)"""
    current_user = await require_coach_developer(request)
    
    # Cannot delete yourself
    if current_user.user_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    
    # Check if user exists
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get linked coach profile
    linked_coach_id = target_user.get("linked_coach_id")
    user_email = target_user.get("email", "").lower()
    
    # Delete user's sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    
    # Delete user's password reset tokens
    await db.password_resets.delete_many({"email": target_user["email"]})
    
    # Delete associated coach profile if exists
    if linked_coach_id:
        await db.coaches.delete_one({"id": linked_coach_id})
        logger.info(f"Deleted coach profile {linked_coach_id} when deleting user {user_id}")
    
    # Delete any pending invites for this email
    if user_email:
        invite_delete = await db.invites.delete_many({
            "email": {"$regex": f"^{user_email}$", "$options": "i"},
            "used": {"$ne": True}
        })
        if invite_delete.deleted_count > 0:
            logger.info(f"Deleted {invite_delete.deleted_count} pending invite(s) for {user_email}")
    
    # Delete the user
    result = await db.users.delete_one({"user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "deleted", "user_id": user_id, "coach_deleted": linked_coach_id is not None}

@api_router.post("/users/link-by-email")
async def link_user_by_email(request: Request):
    """Link a user to a coach profile by email (Coach Developer only)"""
    await require_coach_developer(request)
    
    body = await request.json()
    email = body.get("email", "").lower().strip()
    coach_id = body.get("coach_id")
    
    if not email or not coach_id:
        raise HTTPException(status_code=400, detail="Email and coach_id are required")
    
    # Find user by email (case-insensitive)
    user = await db.users.find_one(
        {"email": {"$regex": f"^{email}$", "$options": "i"}},
        {"_id": 0}
    )
    
    if not user:
        return {"linked": False, "message": "No user found with that email"}
    
    # Update the user to link them to the coach profile
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"linked_coach_id": coach_id}}
    )
    
    return {"linked": True, "user_id": user["user_id"], "coach_id": coach_id}

# ============================================
# OBSERVATION SESSIONS CRUD (Cloud Sync)
# ============================================

@api_router.get("/observations")
async def list_observation_sessions(request: Request):
    """List all observation sessions for the authenticated Coach Developer"""
    user = await require_coach_developer(request)
    
    sessions_cursor = db.observation_sessions.find(
        {"observer_id": user.user_id},
        {"_id": 0}
    ).sort("updated_at", -1)
    
    sessions = await sessions_cursor.to_list(200)
    
    # Get coach names in batch
    coach_ids = list(set(s.get("coach_id") for s in sessions if s.get("coach_id")))
    coaches_map = {}
    if coach_ids:
        coaches = await db.coaches.find({"id": {"$in": coach_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        coaches_map = {c["id"]: c.get("name") for c in coaches}
    
    result = []
    for s in sessions:
        result.append(SessionListItem(
            session_id=s.get("session_id"),
            name=s.get("name", "Untitled"),
            coach_id=s.get("coach_id"),
            coach_name=coaches_map.get(s.get("coach_id")),
            status=s.get("status", "draft"),
            observation_context=s.get("observation_context", "training"),
            planned_date=s.get("planned_date"),
            created_at=s.get("created_at", ""),
            updated_at=s.get("updated_at", ""),
            total_duration=s.get("total_duration", 0),
            event_count=len(s.get("events", []))
        ))
    
    return result

@api_router.get("/observations/{session_id}")
async def get_observation_session(session_id: str, request: Request):
    """Get a specific observation session"""
    user = await require_coach_developer(request)
    
    session = await db.observation_sessions.find_one(
        {"session_id": session_id, "observer_id": user.user_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get coach name if applicable
    coach_name = None
    if session.get("coach_id"):
        coach = await db.coaches.find_one({"id": session.get("coach_id")}, {"_id": 0, "name": 1})
        coach_name = coach.get("name") if coach else None
    
    # Get observer name
    observer = await db.users.find_one({"user_id": session.get("observer_id")}, {"_id": 0, "name": 1})
    observer_name = observer.get("name") if observer else None
    
    # Get coach reflections from the reflections collection (coach-submitted)
    # and merge with any reflections stored directly on the session
    coach_reflections = session.get("coach_reflections", [])
    
    coach_reflection = await db.reflections.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    if coach_reflection:
        # Convert the coach's reflection to the expected format
        coach_reflections_from_db = [{
            "id": coach_reflection.get("reflection_id"),
            "text": coach_reflection.get("reflection", ""),
            "rating": coach_reflection.get("self_rating"),
            "what_went_well": coach_reflection.get("what_went_well", ""),
            "areas_for_development": coach_reflection.get("areas_for_development", ""),
            "timestamp": coach_reflection.get("updated_at") or coach_reflection.get("created_at"),
            "source": "coach"  # Mark this as from the coach
        }]
        # Merge - don't duplicate if same reflection ID
        existing_ids = {r.get("id") for r in coach_reflections}
        for ref in coach_reflections_from_db:
            if ref.get("id") not in existing_ids:
                coach_reflections.append(ref)
    
    return ObservationSessionResponse(
        session_id=session.get("session_id"),
        name=session.get("name", "Untitled"),
        coach_id=session.get("coach_id"),
        coach_name=coach_name,
        observer_id=session.get("observer_id"),
        observer_name=observer_name,
        observation_context=session.get("observation_context", "training"),
        status=session.get("status", "draft"),
        planned_date=session.get("planned_date"),
        created_at=session.get("created_at", ""),
        updated_at=session.get("updated_at", ""),
        intervention_types=session.get("intervention_types", []),
        descriptor_group1=session.get("descriptor_group1"),
        descriptor_group2=session.get("descriptor_group2"),
        session_parts=session.get("session_parts", []),
        start_time=session.get("start_time"),
        end_time=session.get("end_time"),
        total_duration=session.get("total_duration", 0),
        ball_rolling_time=session.get("ball_rolling_time", 0),
        ball_not_rolling_time=session.get("ball_not_rolling_time", 0),
        events=session.get("events", []),
        ball_rolling_log=session.get("ball_rolling_log", []),
        observer_reflections=session.get("observer_reflections", []),
        coach_reflections=coach_reflections,
        session_notes=session.get("session_notes", ""),
        ai_summary=session.get("ai_summary", ""),
        attachments=session.get("attachments", [])
    )

@api_router.post("/observations")
async def create_observation_session(data: ObservationSessionCreate, request: Request):
    """Create a new observation session"""
    try:
        user = await require_coach_developer(request)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Auth error in create_observation_session: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
    
    now = datetime.now(timezone.utc).isoformat()
    
    logger.info(f"Creating/updating observation session: {data.session_id}, status: {data.status}")
    
    session_doc = {
        "session_id": data.session_id,
        "name": data.name,
        "coach_id": data.coach_id,
        "observer_id": user.user_id,
        "observation_context": data.observation_context,
        "status": data.status,
        "planned_date": data.planned_date,
        "created_at": now,
        "updated_at": now,
        "intervention_types": data.intervention_types,
        "descriptor_group1": data.descriptor_group1,
        "descriptor_group2": data.descriptor_group2,
        "session_parts": data.session_parts,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "total_duration": data.total_duration,
        "ball_rolling_time": data.ball_rolling_time,
        "ball_not_rolling_time": data.ball_not_rolling_time,
        "ball_rolling": data.ball_rolling,
        "active_part_id": data.active_part_id,
        "events": data.events,
        "ball_rolling_log": data.ball_rolling_log,
        "observer_reflections": data.observer_reflections,
        "coach_reflections": data.coach_reflections,
        "session_notes": data.session_notes,
        "ai_summary": data.ai_summary,
        "attachments": data.attachments
    }
    
    # Check if session already exists (upsert)
    existing = await db.observation_sessions.find_one({"session_id": data.session_id})
    if existing:
        # Update existing session
        await db.observation_sessions.update_one(
            {"session_id": data.session_id},
            {"$set": {**session_doc, "created_at": existing.get("created_at", now)}}
        )
    else:
        await db.observation_sessions.insert_one(session_doc)
    
    # Also save to the sessions collection for coach access
    if data.coach_id and data.status == "completed":
        coach_session = {
            "session_id": data.session_id,
            "coach_id": data.coach_id,
            "observer_id": user.user_id,
            "title": data.name,
            "date": data.start_time or now,
            "observations": data.events,
            "ai_summary": data.ai_summary,
            "total_duration": data.total_duration,
            "status": data.status
        }
        await db.sessions.update_one(
            {"session_id": data.session_id},
            {"$set": coach_session},
            upsert=True
        )
    
    return {"success": True, "session_id": data.session_id, "synced_at": now}

@api_router.put("/observations/{session_id}")
async def update_observation_session(session_id: str, data: ObservationSessionCreate, request: Request):
    """Update an existing observation session"""
    user = await require_coach_developer(request)
    
    # Verify ownership
    existing = await db.observation_sessions.find_one(
        {"session_id": session_id, "observer_id": user.user_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Session not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {
        "name": data.name,
        "coach_id": data.coach_id,
        "observation_context": data.observation_context,
        "status": data.status,
        "planned_date": data.planned_date,
        "updated_at": now,
        "intervention_types": data.intervention_types,
        "descriptor_group1": data.descriptor_group1,
        "descriptor_group2": data.descriptor_group2,
        "session_parts": data.session_parts,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "total_duration": data.total_duration,
        "ball_rolling_time": data.ball_rolling_time,
        "ball_not_rolling_time": data.ball_not_rolling_time,
        "ball_rolling": data.ball_rolling,
        "active_part_id": data.active_part_id,
        "events": data.events,
        "ball_rolling_log": data.ball_rolling_log,
        "observer_reflections": data.observer_reflections,
        "coach_reflections": data.coach_reflections,
        "session_notes": data.session_notes,
        "ai_summary": data.ai_summary,
        "attachments": data.attachments
    }
    
    await db.observation_sessions.update_one(
        {"session_id": session_id},
        {"$set": update_data}
    )
    
    # Also update sessions collection for coach access
    if data.coach_id and data.status == "completed":
        coach_session = {
            "session_id": session_id,
            "coach_id": data.coach_id,
            "observer_id": user.user_id,
            "title": data.name,
            "date": data.start_time or now,
            "observations": data.events,
            "ai_summary": data.ai_summary,
            "total_duration": data.total_duration,
            "status": data.status
        }
        await db.sessions.update_one(
            {"session_id": session_id},
            {"$set": coach_session},
            upsert=True
        )
    
    return {"success": True, "session_id": session_id, "synced_at": now}

@api_router.delete("/observations/{session_id}")
async def delete_observation_session(session_id: str, request: Request):
    """Delete an observation session"""
    user = await require_coach_developer(request)
    
    result = await db.observation_sessions.delete_one(
        {"session_id": session_id, "observer_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Also delete from sessions collection
    await db.sessions.delete_one({"session_id": session_id})
    
    return {"success": True, "deleted": True}

# ============================================
# ORGANIZATION / CLUB ENDPOINTS
# ============================================

@api_router.get("/organization")
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

@api_router.put("/organization")
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

# Session Parts endpoints
@api_router.get("/session-parts", response_model=List[SessionPartResponse])
async def get_session_parts(request: Request):
    """Get all session parts (defaults + custom)"""
    await require_auth(request)
    
    # Initialize defaults if not present
    existing_defaults = await db.session_parts.find({"is_default": True}, {"_id": 0}).to_list(100)
    existing_ids = {p["part_id"] for p in existing_defaults}
    
    # Add missing defaults
    for default_part in DEFAULT_SESSION_PARTS:
        if default_part["part_id"] not in existing_ids:
            await db.session_parts.insert_one({
                **default_part,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Get all parts
    parts = await db.session_parts.find({}, {"_id": 0}).to_list(200)
    
    return [
        SessionPartResponse(
            part_id=p["part_id"],
            name=p["name"],
            is_default=p.get("is_default", False),
            created_by=p.get("created_by"),
            created_at=p.get("created_at", "")
        )
        for p in parts
    ]

@api_router.get("/session-parts/defaults", response_model=List[SessionPartResponse])
async def get_default_session_parts(request: Request):
    """Get only default session parts"""
    await require_auth(request)
    
    # Initialize defaults if not present
    existing_defaults = await db.session_parts.find({"is_default": True}, {"_id": 0}).to_list(100)
    existing_ids = {p["part_id"] for p in existing_defaults}
    
    for default_part in DEFAULT_SESSION_PARTS:
        if default_part["part_id"] not in existing_ids:
            await db.session_parts.insert_one({
                **default_part,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    parts = await db.session_parts.find({"is_default": True}, {"_id": 0}).to_list(100)
    
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

@api_router.post("/session-parts", response_model=SessionPartResponse)
async def create_session_part(part_data: SessionPartCreate, request: Request):
    """Create a new session part (Coach Developer only for defaults)"""
    user = await require_auth(request)
    
    # Only Coach Developers can create default parts
    if part_data.is_default and user.role != "coach_developer":
        raise HTTPException(status_code=403, detail="Only Coach Developers can create default session parts")
    
    # Check if name already exists
    existing = await db.session_parts.find_one({"name": part_data.name}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Session part with this name already exists")
    
    part_id = f"part_{uuid.uuid4().hex[:12]}"
    new_part = {
        "part_id": part_id,
        "name": part_data.name,
        "is_default": part_data.is_default,
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
    """Delete a custom session part (Coach Developer only)"""
    await require_coach_developer(request)
    
    # Check if it's a built-in default
    builtin_ids = {p["part_id"] for p in DEFAULT_SESSION_PARTS}
    if part_id in builtin_ids:
        raise HTTPException(status_code=400, detail="Cannot delete built-in default session parts")
    
    result = await db.session_parts.delete_one({"part_id": part_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session part not found")
    
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
    
    # Get active targets
    targets = [t for t in coach.get("targets", []) if t.get("status") != "achieved"]
    
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

@api_router.get("/coach/session/{session_id}")
async def get_coach_session_detail(session_id: str, request: Request):
    """
    Get detailed session information for a coach.
    Only returns the session if it belongs to the authenticated coach.
    """
    user = await require_coach(request)
    
    # Verify coach owns this session
    session = await verify_coach_owns_session(user, session_id)
    
    # Get reflection if exists
    reflection = await db.reflections.find_one({
        "session_id": session_id,
        "coach_id": user.linked_coach_id
    }, {"_id": 0})
    
    # Get observer details if available
    observer_name = None
    if session.get("observer_id"):
        observer = await db.users.find_one({"user_id": session.get("observer_id")}, {"_id": 0, "name": 1})
        observer_name = observer.get("name") if observer else None
    
    return {
        "session": session,
        "reflection": reflection,
        "observer_name": observer_name,
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

@api_router.get("/coach/targets")
async def get_coach_targets(request: Request):
    """Get all targets for the authenticated coach"""
    user = await require_coach(request)
    
    coach = await db.coaches.find_one({"id": user.linked_coach_id}, {"_id": 0, "targets": 1})
    targets = coach.get("targets", []) if coach else []
    
    return {"targets": targets}

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
async def admin_list_organizations(request: Request):
    """List all organizations (Admin only)"""
    await require_admin(request)
    
    orgs = await db.organizations.find({}, {"_id": 0}).to_list(1000)
    
    # Get user and coach counts for each organization
    result = []
    for org in orgs:
        org_id = org.get("org_id")
        owner_id = org.get("owner_id")
        
        # Count users in this organization
        user_count = await db.users.count_documents({
            "$or": [
                {"organization_id": org_id},
                {"user_id": owner_id}
            ]
        })
        
        # Count coaches in this organization
        coach_count = await db.coaches.count_documents({"created_by": owner_id})
        
        result.append(AdminOrganizationListItem(
            org_id=org_id,
            club_name=org.get("club_name"),
            club_logo=org.get("club_logo"),
            owner_id=owner_id,
            user_count=user_count,
            coach_count=coach_count,
            created_at=org.get("created_at")
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
    
    # Update the user's password
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"password": hashed_pw, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Password reset successfully", "user_id": user_id}

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
    
    # Get the admin's current session token to preserve it
    admin_session_token = request.cookies.get("session_token")
    
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
    # Get current session token
    current_session_token = request.cookies.get("session_token")
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
    
    return {"message": "Exited impersonation mode", "redirect": "/admin"}

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, request: Request):
    """Delete a user (Admin only)"""
    await require_admin(request)
    
    # Find the user
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow deleting admin users
    if user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin users")
    
    # Delete the user
    await db.users.delete_one({"user_id": user_id})
    
    # If user was a coach, optionally delete their coach profile
    if user.get("linked_coach_id"):
        await db.coaches.delete_one({"coach_id": user.get("linked_coach_id")})
    
    return {"message": "User deleted successfully", "user_id": user_id}

@api_router.delete("/admin/organizations/{org_id}")
async def admin_delete_organization(org_id: str, request: Request):
    """Delete an organization and all its users (Admin only)"""
    await require_admin(request)
    
    # Find the organization
    org = await db.organizations.find_one({"org_id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    owner_id = org.get("owner_id")
    
    # Delete all users in this organization
    delete_result = await db.users.delete_many({
        "$or": [
            {"organization_id": org_id},
            {"user_id": owner_id}
        ],
        "role": {"$ne": "admin"}  # Never delete admins
    })
    
    # Delete all coaches created by the owner
    await db.coaches.delete_many({"created_by": owner_id})
    
    # Delete the organization
    await db.organizations.delete_one({"org_id": org_id})
    
    return {
        "message": "Organization deleted successfully",
        "org_id": org_id,
        "users_deleted": delete_result.deleted_count
    }

# ============================================
# END ADMIN API ENDPOINTS
# ============================================

# ============================================
# STRIPE PAYMENT ENDPOINTS
# ============================================

from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

# Stripe configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Define pricing tiers (amounts in GBP)
PRICING_TIERS = {
    "starter": {
        "name": "Starter",
        "monthly": 20.00,
        "annual": 200.00,
        "coaches": 5,
        "admins": 1
    },
    "pro": {
        "name": "Pro",
        "monthly": 35.00,
        "annual": 350.00,
        "coaches": 15,
        "admins": 1
    },
    "club_hub": {
        "name": "Club Hub",
        "monthly": 50.00,
        "annual": 500.00,
        "coaches": 40,
        "admins": 5
    }
}

class CheckoutRequest(BaseModel):
    tier_id: str
    billing_period: str  # "monthly" or "annual"
    origin_url: str

@api_router.post("/payments/checkout")
async def create_checkout_session(data: CheckoutRequest, request: Request):
    """Create a Stripe checkout session for subscription"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Validate tier
    if data.tier_id not in PRICING_TIERS:
        raise HTTPException(status_code=400, detail="Invalid pricing tier")
    
    # Validate billing period
    if data.billing_period not in ["monthly", "annual"]:
        raise HTTPException(status_code=400, detail="Invalid billing period")
    
    tier = PRICING_TIERS[data.tier_id]
    amount = tier["monthly"] if data.billing_period == "monthly" else tier["annual"]
    
    # Build success and cancel URLs
    success_url = f"{data.origin_url}?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}?canceled=true"
    
    # Initialize Stripe checkout
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session with custom amount
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency="gbp",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "tier_id": data.tier_id,
            "tier_name": tier["name"],
            "billing_period": data.billing_period,
            "coaches_limit": str(tier["coaches"]),
            "admins_limit": str(tier["admins"])
        }
    )
    
    try:
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "session_id": session.session_id,
            "tier_id": data.tier_id,
            "tier_name": tier["name"],
            "billing_period": data.billing_period,
            "amount": amount,
            "currency": "gbp",
            "payment_status": "pending",
            "status": "initiated",
            "metadata": {
                "coaches_limit": tier["coaches"],
                "admins_limit": tier["admins"]
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "url": session.url,
            "session_id": session.session_id
        }
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    """Get the status of a payment session"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    # Initialize Stripe checkout
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update payment transaction in database
        update_data = {
            "payment_status": status.payment_status,
            "status": status.status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total": status.amount_total,
            "currency": status.currency,
            "metadata": status.metadata
        }
    except Exception as e:
        logger.error(f"Payment status check error: {e}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Payment system not configured")
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update payment transaction based on webhook event
        if webhook_response.session_id:
            update_data = {
                "payment_status": webhook_response.payment_status,
                "event_type": webhook_response.event_type,
                "event_id": webhook_response.event_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": update_data}
            )
        
        return {"received": True}
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
    
    if org_id:
        query["organization_id"] = org_id
    else:
        # Fallback: show templates created by this user
        query["created_by"] = user.user_id
    
    if target_role:
        query["target_role"] = target_role
    
    templates = await db.reflection_templates.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return templates

@api_router.get("/reflection-templates/{template_id}")
async def get_reflection_template(template_id: str, request: Request):
    """Get a specific reflection template"""
    user = await require_auth(request)
    
    template = await db.reflection_templates.find_one(
        {"template_id": template_id},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template

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
    
    # Find the template
    template = await db.reflection_templates.find_one(
        {"template_id": template_id},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Verify ownership - only creator can edit
    if template.get("created_by") != user.user_id:
        raise HTTPException(status_code=403, detail="You can only edit templates you created")
    
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
            org_id = template.get("organization_id")
            target_role = template.get("target_role")
            if org_id:
                await db.reflection_templates.update_many(
                    {
                        "organization_id": org_id,
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
    
    # Find the template
    template = await db.reflection_templates.find_one(
        {"template_id": template_id},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Verify ownership - only creator can delete
    if template.get("created_by") != user.user_id:
        raise HTTPException(status_code=403, detail="You can only delete templates you created")
    
    await db.reflection_templates.delete_one({"template_id": template_id})
    
    return {"status": "deleted", "template_id": template_id}

@api_router.post("/reflection-templates/{template_id}/set-default")
async def set_template_as_default(template_id: str, request: Request):
    """Set a template as the default for its target_role"""
    user = await require_coach_developer(request)
    
    # Find the template
    template = await db.reflection_templates.find_one(
        {"template_id": template_id},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    org_id = template.get("organization_id")
    target_role = template.get("target_role")
    
    # Unset any existing default for the same target_role in the org
    if org_id:
        await db.reflection_templates.update_many(
            {"organization_id": org_id, "target_role": target_role, "is_default": True},
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

# Add CORS middleware BEFORE including routes (order matters!)
# Build comprehensive list of allowed origins for CORS with credentials
cors_origins_env = os.environ.get('CORS_ORIGINS', '')

# IMPORTANT: When using credentials (cookies), we CANNOT use wildcard '*'
# We must explicitly list allowed origins
# Start with known origins - production and development
allowed_origins = [
    "https://mycoachdeveloper.com",
    "https://www.mycoachdeveloper.com",
    "http://localhost:3000",
    "http://localhost:8001",
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
    """Create default admin user if it doesn't exist"""
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
        
        if updates:
            await db.users.update_one(
                {"email": admin_email},
                {"$set": updates}
            )
            logger.info(f"Updated admin user: {admin_email} with {list(updates.keys())}")
        else:
            logger.info(f"Admin user already configured: {admin_email} (role={existing_admin.get('role')})")
        return
    
    # Create default admin user
    admin_user_id = f"admin_{uuid.uuid4().hex[:12]}"
    hashed_pw = hash_password(admin_password)
    
    admin_doc = {
        "user_id": admin_user_id,
        "email": admin_email,
        "name": "Coach Developer Admin",
        "password_hash": hashed_pw,
        "role": "admin",
        "organization_id": None,  # Admin is not tied to any organization
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin_doc)
    logger.info(f"Created default admin user: {admin_email}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()