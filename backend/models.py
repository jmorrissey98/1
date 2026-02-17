"""
Pydantic models for the application.
"""
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


# ============================================
# BASE MODELS
# ============================================

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str


# ============================================
# AI/SUMMARY MODELS
# ============================================

class SessionSummaryRequest(BaseModel):
    session_name: str
    total_duration: int
    total_events: int
    ball_rolling_time: int
    ball_not_rolling_time: int
    event_breakdown: Dict[str, int]
    descriptor1_name: str
    descriptor1_breakdown: Dict[str, int]
    descriptor2_name: str
    descriptor2_breakdown: Dict[str, int]
    session_parts: List[Dict[str, Any]]
    user_notes: Optional[str] = ""
    coach_name: Optional[str] = None
    coach_targets: Optional[List[str]] = None
    previous_sessions_summary: Optional[str] = None

class SessionSummaryResponse(BaseModel):
    summary: str

class CoachTrendRequest(BaseModel):
    coach_name: str
    sessions_data: List[Dict[str, Any]]
    current_targets: List[str]

class CoachTrendResponse(BaseModel):
    trend_summary: str


# ============================================
# FILE MODELS
# ============================================

class FileUploadResponse(BaseModel):
    id: str
    name: str
    type: str
    size: int
    url: str
    uploadedAt: str


# ============================================
# USER & AUTH MODELS
# ============================================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "coach"
    linked_coach_id: Optional[str] = None
    organization_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str
    linked_coach_id: Optional[str] = None
    organization_id: Optional[str] = None
    auth_provider: Optional[str] = None

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
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


# ============================================
# ORGANIZATION MODELS
# ============================================

class OrganizationUpdate(BaseModel):
    club_name: Optional[str] = None
    club_logo: Optional[str] = None

class OrganizationResponse(BaseModel):
    org_id: str
    club_name: Optional[str] = None
    club_logo: Optional[str] = None
    owner_id: str
    created_at: Optional[str] = None


# ============================================
# ADMIN MODELS
# ============================================

class AdminCreateOrganizationRequest(BaseModel):
    club_name: str
    club_logo: Optional[str] = None

class AdminCreateUserRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    role: str
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

class AdminAddCoachDeveloperRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr


# ============================================
# INVITE MODELS
# ============================================

class Invite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    invite_id: str
    email: str
    role: str
    invited_by: str
    coach_id: Optional[str] = None
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
    email_sent: Optional[bool] = None
    name: Optional[str] = None

class InviteValidationResponse(BaseModel):
    valid: bool
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    error: Optional[str] = None

class RegisterInviteRequest(BaseModel):
    invite_id: str
    password: str
    name: str
    marketing_opt_in: Optional[bool] = False

class RoleUpdateRequest(BaseModel):
    user_id: str
    new_role: str


# ============================================
# SESSION PARTS MODELS
# ============================================

class SessionPart(BaseModel):
    part_id: str
    name: str
    is_default: bool = True
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SessionPartCreate(BaseModel):
    name: str
    is_default: bool = False

class SessionPartResponse(BaseModel):
    part_id: str
    name: str
    is_default: bool
    created_by: Optional[str] = None
    created_at: str


# ============================================
# COACH PORTAL MODELS
# ============================================

class CoachProfileUpdate(BaseModel):
    photo: Optional[str] = None
    role_title: Optional[str] = None
    age_group: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None

class CoachProfileResponse(BaseModel):
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
    session_id: str
    content: str
    self_assessment_rating: Optional[int] = None
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
    coach_id: str
    scheduled_date: str
    session_context: Optional[str] = None

class ScheduledObservationResponse(BaseModel):
    schedule_id: str
    coach_id: str
    coach_name: Optional[str] = None
    observer_id: str
    observer_name: Optional[str] = None
    scheduled_date: str
    session_context: Optional[str] = None
    status: str
    created_at: str

class CoachDashboardResponse(BaseModel):
    profile: CoachProfileResponse
    targets: List[Dict[str, Any]]
    upcoming_observations: List[ScheduledObservationResponse]
    recent_session: Optional[Dict[str, Any]] = None
    has_pending_reflection: bool = False
    pending_reflection_session_id: Optional[str] = None

class CoachSessionSummary(BaseModel):
    session_id: str
    title: str
    date: str
    observer_name: Optional[str] = None
    has_observation: bool = False
    has_reflection: bool = False
    summary_preview: Optional[str] = None


# ============================================
# OBSERVATION SESSION MODELS
# ============================================

class ObservationSessionCreate(BaseModel):
    session_id: str
    name: str
    coach_id: Optional[str] = None
    observation_context: str = "training"
    status: str = "draft"
    planned_date: Optional[str] = None
    intervention_types: List[Dict[str, Any]] = []
    descriptor_group1: Optional[Dict[str, Any]] = None
    descriptor_group2: Optional[Dict[str, Any]] = None
    session_parts: List[Dict[str, Any]] = []
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_duration: Optional[float] = 0
    ball_rolling_time: Optional[float] = 0
    ball_not_rolling_time: Optional[float] = 0
    ball_rolling: bool = False
    active_part_id: Optional[str] = None
    events: List[Dict[str, Any]] = []
    ball_rolling_log: List[Dict[str, Any]] = []
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
    intervention_types: List[Dict[str, Any]] = []
    descriptor_group1: Optional[Dict[str, Any]] = None
    descriptor_group2: Optional[Dict[str, Any]] = None
    session_parts: List[Dict[str, Any]] = []
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_duration: Optional[float] = 0
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
    total_duration: Optional[float] = 0
    event_count: int = 0


# ============================================
# REFLECTION TEMPLATE MODELS
# ============================================

class ReflectionQuestionBase(BaseModel):
    question_id: str
    question_text: str
    question_type: str
    required: bool = False
    scale_min: Optional[int] = 1
    scale_max: Optional[int] = 5
    scale_min_label: Optional[str] = None
    scale_max_label: Optional[str] = None
    options: Optional[List[str]] = []

class ReflectionTemplateCreate(BaseModel):
    name: str
    target_role: str
    description: Optional[str] = None
    questions: List[ReflectionQuestionBase] = []
    is_default: bool = False

class ReflectionTemplateUpdate(BaseModel):
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
# COACH MANAGEMENT MODELS
# ============================================

class CoachCreate(BaseModel):
    name: str
    email: Optional[str] = None
    photo: Optional[str] = None
    role_title: Optional[str] = None
    age_group: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    targets: List[Dict[str, Any]] = []

class CoachUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    photo: Optional[str] = None
    role_title: Optional[str] = None
    age_group: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    targets: Optional[List[Dict[str, Any]]] = None

class CoachResponse(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    photo: Optional[str] = None
    role_title: Optional[str] = None
    age_group: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    targets: List[Dict[str, Any]] = []
    session_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    has_user_account: bool = False
    user_email: Optional[str] = None


# ============================================
# SUBSCRIPTION MODELS
# ============================================

class SubscriptionStatusResponse(BaseModel):
    plan: str
    coach_limit: int
    admin_limit: int
    current_coaches: int
    current_admins: int
    can_upgrade: bool
