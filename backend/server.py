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

# Resend configuration for password reset emails
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
APP_URL = os.environ.get('APP_URL', 'http://localhost:3000')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


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
    role: str = "coach"  # "coach_developer" or "coach"
    linked_coach_id: Optional[str] = None  # Links to coach profile
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str
    linked_coach_id: Optional[str] = None
    auth_provider: Optional[str] = None  # "email" or "google"

# Email/Password Auth Models
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

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
    
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return result
    except Exception as e:
        logging.error(f"Failed to send password reset email: {str(e)}")
        raise

async def send_invite_email(email: str, inviter_name: str, role: str):
    """Send invitation email via Resend"""
    signup_link = f"{APP_URL}/login"
    role_display = "Coach Developer" if role == "coach_developer" else "Coach"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e293b;">You're Invited to My Coach Developer</h2>
        <p>Hi there,</p>
        <p><strong>{inviter_name}</strong> has invited you to join My Coach Developer as a <strong>{role_display}</strong>.</p>
        <p>My Coach Developer is a coaching observation app that helps track and analyze coaching sessions.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{signup_link}" 
               style="background-color: #1e293b; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
                Create Your Account
            </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #64748b; word-break: break-all;">{signup_link}</p>
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            Use this email address ({email}) when signing up to activate your invitation.
        </p>
    </div>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": f"You're invited to My Coach Developer",
        "html": html_content
    }
    
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        return result
    except Exception as e:
        logging.error(f"Failed to send invite email: {str(e)}")
        raise

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

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
        
        # Build the prompt
        prompt = f"""You are a coach educator assistant. Analyze this coaching observation session data and write a constructive, developmental summary suitable for coach reflection and mentoring conversations.

IMPORTANT FORMATTING RULES:
- Do NOT use asterisks, bullet points with *, or markdown formatting
- Write in clear paragraphs with natural flow
- Use numbered lists only where specifically asked
- Keep language conversational and professional

SESSION: {request.session_name}
DURATION: {format_time(request.total_duration)}
TOTAL EVENTS LOGGED: {request.total_events}

BALL IN PLAY:
Ball Rolling: {format_time(request.ball_rolling_time)} ({ball_rolling_pct}%)
Ball Stopped: {format_time(request.ball_not_rolling_time)} ({100 - ball_rolling_pct}%)

COACHING INTERVENTIONS:
{chr(10).join([f"{k}: {v} times" for k, v in request.event_breakdown.items()])}

{request.descriptor1_name.upper()}:
{chr(10).join([f"{k}: {v}" for k, v in request.descriptor1_breakdown.items()])}

{request.descriptor2_name.upper()}:
{chr(10).join([f"{k}: {v}" for k, v in request.descriptor2_breakdown.items()])}

SESSION PARTS USED:
{chr(10).join([f"{p.get('name', 'Part')}: {p.get('events', 0)} events, Ball rolling {p.get('ballRollingPct', 0)}%" for p in request.session_parts])}
"""
        
        if request.coach_name:
            prompt += f"\nCOACH: {request.coach_name}\n"
        
        if request.coach_targets and len(request.coach_targets) > 0:
            prompt += f"\nCOACH'S CURRENT DEVELOPMENT TARGETS:\n"
            for i, target in enumerate(request.coach_targets, 1):
                prompt += f"{i}. {target}\n"
            prompt += "\nPlease reference these targets in your analysis where relevant.\n"
        
        if request.previous_sessions_summary:
            prompt += f"\nPREVIOUS SESSIONS CONTEXT:\n{request.previous_sessions_summary}\n"
            prompt += "\nNote any changes or progress compared to previous observations.\n"
        
        if request.user_notes:
            prompt += f"\nOBSERVER'S NOTES:\n{request.user_notes}\n"
        
        prompt += """
Please provide your response in this structure (use plain text, no markdown):

OVERVIEW
Write 1-2 paragraphs summarizing the key patterns observed in this session.

STRENGTHS OBSERVED
Write 1 paragraph highlighting what the coach did well.

AREAS FOR REFLECTION
Write 1 paragraph with constructive areas the coach might consider developing.

REFLECTIVE QUESTIONS
Write 3-4 questions (numbered 1, 2, 3, 4) the coach might consider for self-reflection.

SUGGESTED DEVELOPMENT TARGETS
Based on this observation, suggest 2-3 specific, actionable development targets (numbered 1, 2, 3) the coach could work on.

Keep the tone professional, supportive, and non-judgmental throughout."""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"session-summary-{uuid.uuid4()}",
            system_message="You are a supportive coach educator assistant that helps coaches reflect on their practice. Your feedback is always constructive, specific, and focused on development rather than judgment. Never use asterisks or markdown formatting in your responses."
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
    if user.role != "coach_developer":
        raise HTTPException(status_code=403, detail="Coach Developer role required")
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
        
        # Exchange session_id with Emergent Auth
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            auth_data = auth_response.json()
        
        email = auth_data.get("email")
        name = auth_data.get("name")
        picture = auth_data.get("picture")
        session_token = auth_data.get("session_token")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            # Update existing user
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
            
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            new_user = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "role": user_role,
                "linked_coach_id": linked_coach_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(new_user)
        
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
        logger.error(f"Auth error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(request: Request):
    """Get current authenticated user"""
    user = await require_auth(request)
    
    # Get auth_provider from database
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    auth_provider = user_doc.get("auth_provider", "google") if user_doc else "google"
    
    return UserResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        role=user.role,
        linked_coach_id=user.linked_coach_id,
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
        
        # Create session
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
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        return {
            "user_id": user_id,
            "email": signup_data.email,
            "name": signup_data.name,
            "role": user_role,
            "linked_coach_id": linked_coach_id,
            "auth_provider": "email"
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
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=7 * 24 * 60 * 60,
            path="/"
        )
        
        return {
            "user_id": user_id,
            "email": user_doc["email"],
            "name": user_doc["name"],
            "picture": user_doc.get("picture"),
            "role": user_doc.get("role", "coach"),
            "linked_coach_id": user_doc.get("linked_coach_id"),
            "auth_provider": user_doc.get("auth_provider", "email")
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

# Invite endpoints
@api_router.post("/invites", response_model=InviteResponse)
async def create_invite(invite_data: InviteCreate, request: Request):
    """Create an invite (Coach Developer only)"""
    user = await require_coach_developer(request)
    
    # Check if invite already exists for this email
    existing_invite = await db.invites.find_one(
        {"email": invite_data.email, "used": False},
        {"_id": 0}
    )
    if existing_invite:
        raise HTTPException(status_code=400, detail="Invite already exists for this email")
    
    # Check if user already exists with this email
    existing_user = await db.users.find_one({"email": invite_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    invite_id = f"inv_{uuid.uuid4().hex[:12]}"
    invite = {
        "invite_id": invite_id,
        "email": invite_data.email,
        "role": invite_data.role,
        "coach_id": invite_data.coach_id,
        "invited_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "used": False
    }
    await db.invites.insert_one(invite)
    
    # Send invitation email
    try:
        await send_invite_email(
            email=invite_data.email,
            inviter_name=user.name,
            role=invite_data.role
        )
        logger.info(f"Invite email sent to {invite_data.email}")
    except Exception as e:
        logger.error(f"Failed to send invite email to {invite_data.email}: {str(e)}")
        # Don't fail the invite creation if email fails
    
    return InviteResponse(
        invite_id=invite_id,
        email=invite_data.email,
        role=invite_data.role,
        coach_id=invite_data.coach_id,
        created_at=invite["created_at"]
    )

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
            created_at=inv["created_at"]
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

@api_router.post("/invites/{invite_id}/resend")
async def resend_invite(invite_id: str, request: Request):
    """Resend an invitation email (Coach Developer only)"""
    user = await require_coach_developer(request)
    
    invite = await db.invites.find_one({"invite_id": invite_id, "used": False}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or already used")
    
    try:
        await send_invite_email(
            email=invite["email"],
            inviter_name=user.name,
            role=invite["role"]
        )
        return {"status": "sent", "email": invite["email"]}
    except Exception as e:
        logger.error(f"Failed to resend invite email: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send invitation email")

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
    
    # Delete user's sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    
    # Delete user's password reset tokens
    await db.password_resets.delete_many({"email": target_user["email"]})
    
    # Delete the user
    result = await db.users.delete_one({"user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "deleted", "user_id": user_id}

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

# Add CORS middleware BEFORE including routes (order matters!)
# When allow_credentials=True, we cannot use "*" for origins with some browsers
# We must explicitly list allowed origins or use allow_origin_regex
cors_origins_env = os.environ.get('CORS_ORIGINS', '')
app_url = os.environ.get('APP_URL', '')

# Build list of allowed origins
allowed_origins = []
if cors_origins_env and cors_origins_env != '*':
    allowed_origins = [origin.strip() for origin in cors_origins_env.split(',') if origin.strip()]

# Always include APP_URL if set
if app_url and app_url not in allowed_origins:
    allowed_origins.append(app_url)

# Add common development origins
dev_origins = [
    "http://localhost:3000",
    "http://localhost:8001",
    "https://coach-observer.preview.emergentagent.com"
]
for origin in dev_origins:
    if origin not in allowed_origins:
        allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_origin_regex=r"https://.*\.emergentagent\.com|https://.*\.preview\.emergentagent\.com|https://mycoachdeveloper\.com|https://.*mycoachdeveloper\.com",
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include the router in the main app AFTER middleware
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()