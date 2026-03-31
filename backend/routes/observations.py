"""
Observation session routes - CRUD operations for observation sessions (cloud sync).
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, timezone

import sys
sys.path.insert(0, '/app/backend')

from database import db, logger
from dependencies import (
    require_auth, 
    require_coach_developer,
    enforce_observation_limit_on_completion,
    check_observation_limit_for_coach
)

router = APIRouter(prefix="/observations", tags=["Observations"])


async def _get_user_org_id(user):
    """Get the organization_id for a user, checking user record then org ownership."""
    org_id = user.organization_id
    if not org_id:
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0, "org_id": 1})
        org_id = org.get("org_id") if org else None
    return org_id


async def _find_session_in_org(session_id, user):
    """Find a session accessible to the user (own session or same org)."""
    org_id = await _get_user_org_id(user)
    if org_id:
        session = await db.observation_sessions.find_one(
            {"session_id": session_id, "$or": [
                {"organization_id": org_id},
                {"observer_id": user.user_id}
            ]},
            {"_id": 0}
        )
        # Fallback: check if observer is in the same org (legacy sessions without organization_id)
        if not session:
            session = await db.observation_sessions.find_one({"session_id": session_id}, {"_id": 0})
            if session:
                obs_id = session.get("observer_id")
                in_org = await db.users.find_one({"user_id": obs_id, "organization_id": org_id}, {"_id": 0, "user_id": 1})
                if not in_org:
                    org_doc = await db.organizations.find_one({"org_id": org_id, "owner_id": obs_id}, {"_id": 0})
                    if not org_doc:
                        session = None
        return session
    else:
        return await db.observation_sessions.find_one(
            {"session_id": session_id, "observer_id": user.user_id},
            {"_id": 0}
        )




# Request/Response Models
class SessionListItem(BaseModel):
    session_id: str
    name: str
    coach_id: Optional[str] = None
    coach_name: Optional[str] = None
    status: str = "draft"
    observation_context: str = "training"
    planned_date: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    total_duration: float = 0
    event_count: int = 0

class ObservationSessionCreate(BaseModel):
    session_id: str
    name: str
    coach_id: Optional[str] = None
    observation_context: str = "training"
    status: str = "draft"
    planned_date: Optional[str] = None
    intervention_types: Optional[List[Any]] = []
    descriptor_group1: Optional[Any] = None
    descriptor_group2: Optional[Any] = None
    session_parts: Optional[List[Any]] = []
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_duration: float = 0
    ball_rolling_time: float = 0
    ball_not_rolling_time: float = 0
    ball_rolling: Optional[bool] = None
    active_part_id: Optional[str] = None
    events: Optional[List[Any]] = []
    ball_rolling_log: Optional[List[Any]] = []
    observer_notes: Optional[List[Any]] = []  # Notes taken during observation
    observer_reflections: Optional[List[Any]] = []
    coach_reflections: Optional[List[Any]] = []
    session_notes: Optional[str] = ""
    ai_summary: Optional[str] = ""
    attachments: Optional[List[Any]] = []
    # Reflection sharing flags (default to True - shared by default)
    observer_reflection_shared: Optional[bool] = True
    coach_reflection_shared: Optional[bool] = True
    # Structured reflection data
    observer_reflection: Optional[Any] = None
    coach_reflection: Optional[Any] = None
    # Reflection template IDs - permanently linked to this observation
    reflection_template_id: Optional[str] = None
    coach_reflection_template_id: Optional[str] = None
    # Edit tracking
    last_edited_at: Optional[str] = None
    last_edited_by: Optional[str] = None

class ObservationSessionResponse(BaseModel):
    session_id: str
    name: str
    coach_id: Optional[str] = None
    coach_name: Optional[str] = None
    observer_id: Optional[str] = None
    observer_name: Optional[str] = None
    observation_context: str = "training"
    status: str = "draft"
    planned_date: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    intervention_types: List[Any] = []
    descriptor_group1: Optional[Any] = None
    descriptor_group2: Optional[Any] = None
    session_parts: List[Any] = []
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_duration: float = 0
    ball_rolling_time: float = 0
    ball_not_rolling_time: float = 0
    events: List[Any] = []
    ball_rolling_log: List[Any] = []
    observer_notes: List[Any] = []  # Notes taken during observation
    observer_reflections: List[Any] = []
    coach_reflections: List[Any] = []
    session_notes: str = ""
    ai_summary: str = ""
    attachments: List[Any] = []
    # Reflection sharing flags
    observer_reflection_shared: bool = True
    coach_reflection_shared: bool = True
    # Structured reflection data
    observer_reflection: Optional[Any] = None
    coach_reflection: Optional[Any] = None
    # Reflection template IDs - permanently linked to this observation
    reflection_template_id: Optional[str] = None
    coach_reflection_template_id: Optional[str] = None
    # Other user's reflection (for shared view)
    other_reflection: Optional[Any] = None
    other_reflection_status: Optional[str] = None  # "not_completed", "not_shared", "shared"
    other_user_name: Optional[str] = None
    # Edit tracking
    last_edited_at: Optional[str] = None
    last_edited_by: Optional[str] = None
    last_edited_by_name: Optional[str] = None


@router.get("")
async def list_observation_sessions(request: Request, observer_id: str = None):
    """List all observation sessions for the authenticated Coach Developer.
    Optionally pass ?observer_id=user_xxx to view another coach developer's sessions in the same org."""
    user = await require_coach_developer(request)
    
    # CRITICAL: Get user's organization_id for data isolation
    org_id = user.organization_id
    if not org_id:
        # Try to find organization from ownership
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        org_id = org.get("org_id") if org else None
    
    # Determine which observer's sessions to load
    target_observer_id = user.user_id
    if observer_id and observer_id != user.user_id:
        # Verify the target observer is in the same organization
        target_user = await db.users.find_one(
            {"user_id": observer_id, "organization_id": org_id, "role": "coach_developer"},
            {"_id": 0, "user_id": 1}
        )
        if not target_user and org_id:
            # Also check if they're the org owner
            org_doc = await db.organizations.find_one({"org_id": org_id, "owner_id": observer_id}, {"_id": 0})
            if not org_doc:
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="Cannot view sessions for users outside your organization")
        target_observer_id = observer_id
    
    # Build query with organization check for data isolation
    query = {"observer_id": target_observer_id}
    
    # If organization_id exists, add it as an additional filter for safety
    # This prevents cross-organization data leakage even if observer_id somehow matches
    if org_id:
        # Also allow sessions from this organization (for backward compatibility)
        query = {
            "$or": [
                {"observer_id": target_observer_id, "organization_id": org_id},
                {"observer_id": target_observer_id, "organization_id": {"$exists": False}},  # Legacy sessions
                {"observer_id": target_observer_id, "organization_id": None}  # Legacy sessions
            ]
        }
    
    sessions_cursor = db.observation_sessions.find(
        query,
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
        # Calculate total time from ball rolling + ball stopped (same as ReviewSession)
        ball_rolling_time = s.get("ball_rolling_time", 0)
        ball_not_rolling_time = s.get("ball_not_rolling_time", 0)
        total_ball_time = ball_rolling_time + ball_not_rolling_time
        
        # Use ball time if available, otherwise fallback to total_duration
        display_duration = total_ball_time if total_ball_time > 0 else s.get("total_duration", 0)
        
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
            total_duration=display_duration,
            event_count=len(s.get("events", []))
        ))
    
    return result


@router.get("/{session_id}")
async def get_observation_session(session_id: str, request: Request):
    """Get a specific observation session - accessible by both coach developers and coaches"""
    user = await require_auth(request)
    
    is_coach_view = user.role == 'coach'
    
    # Build query based on user role
    if is_coach_view:
        # Coaches can only access sessions where they are the assigned coach
        session = await db.observation_sessions.find_one(
            {"session_id": session_id, "coach_id": user.linked_coach_id},
            {"_id": 0}
        )
    else:
        # Coach developers can access sessions within their organization
        session = await _find_session_in_org(session_id, user)
    
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
    
    coach_reflection_from_db = await db.reflections.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    if coach_reflection_from_db:
        # Convert the coach's reflection to the expected format
        coach_reflections_from_db = [{
            "id": coach_reflection_from_db.get("reflection_id"),
            "text": coach_reflection_from_db.get("reflection", ""),
            "rating": coach_reflection_from_db.get("self_rating"),
            "what_went_well": coach_reflection_from_db.get("what_went_well", ""),
            "areas_for_development": coach_reflection_from_db.get("areas_for_development", ""),
            "timestamp": coach_reflection_from_db.get("updated_at") or coach_reflection_from_db.get("created_at"),
            "source": "coach"  # Mark this as from the coach
        }]
        # Merge - don't duplicate if same reflection ID
        existing_ids = {r.get("id") for r in coach_reflections}
        for ref in coach_reflections_from_db:
            if ref.get("id") not in existing_ids:
                coach_reflections.append(ref)
    
    # Get sharing flags (default to True for backwards compatibility)
    observer_reflection_shared = session.get("observer_reflection_shared", True)
    coach_reflection_shared = session.get("coach_reflection_shared", True)
    
    # Get the structured reflections
    observer_reflection = session.get("observer_reflection")
    coach_reflection = session.get("coach_reflection")
    
    # Determine the "other" user's reflection status and content
    other_reflection = None
    other_reflection_status = None
    other_user_name = None
    
    if is_coach_view:
        # Coach is viewing - show observer's reflection if shared
        other_user_name = observer_name
        if observer_reflection and observer_reflection.get("completedAt"):
            # Observer has completed a reflection
            if observer_reflection_shared:
                other_reflection = observer_reflection
                other_reflection_status = "shared"
            else:
                other_reflection_status = "not_shared"
        else:
            other_reflection_status = "not_completed"
    else:
        # Coach developer is viewing - show coach's reflection if shared
        other_user_name = coach_name
        # Check if coach has completed a reflection (either structured or free-form)
        has_coach_reflection = (coach_reflection and coach_reflection.get("completedAt")) or len(coach_reflections) > 0
        if has_coach_reflection:
            if coach_reflection_shared:
                # Return the structured reflection if available, otherwise the free-form ones
                if coach_reflection and coach_reflection.get("completedAt"):
                    other_reflection = coach_reflection
                else:
                    other_reflection = {"freeFormReflections": coach_reflections}
                other_reflection_status = "shared"
            else:
                other_reflection_status = "not_shared"
        else:
            other_reflection_status = "not_completed"
    
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
        observer_notes=session.get("observer_notes", []),
        observer_reflections=session.get("observer_reflections", []),
        coach_reflections=coach_reflections,
        session_notes=session.get("session_notes", ""),
        ai_summary=session.get("ai_summary", ""),
        attachments=session.get("attachments", []),
        observer_reflection_shared=observer_reflection_shared,
        coach_reflection_shared=coach_reflection_shared,
        observer_reflection=observer_reflection,
        coach_reflection=coach_reflection,
        # Reflection template IDs - now correctly returned
        reflection_template_id=session.get("reflection_template_id"),
        coach_reflection_template_id=session.get("coach_reflection_template_id"),
        other_reflection=other_reflection,
        other_reflection_status=other_reflection_status,
        other_user_name=other_user_name,
        # Edit tracking
        last_edited_at=session.get("last_edited_at"),
        last_edited_by=session.get("last_edited_by"),
        last_edited_by_name=session.get("last_edited_by_name")
    )


@router.post("")
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
    
    # CRITICAL: Get user's organization_id for data isolation
    org_id = user.organization_id
    if not org_id:
        org = await db.organizations.find_one({"owner_id": user.user_id}, {"_id": 0})
        org_id = org.get("org_id") if org else None
    
    # Check if session already exists (upsert)
    existing = await db.observation_sessions.find_one({"session_id": data.session_id})
    
    # PHASE 3: Enforce observation limit when completing a session
    # Only check if:
    # 1. There's a coach assigned
    # 2. The new status is "completed"
    # 3. The session wasn't already completed before
    is_becoming_completed = (
        data.status == "completed" and 
        data.coach_id and
        (not existing or existing.get("status") != "completed")
    )
    
    if is_becoming_completed:
        limit_check = await enforce_observation_limit_on_completion(
            user, data.coach_id, data.session_id
        )
        if not limit_check["allowed"]:
            logger.warning(f"Observation limit reached for coach {data.coach_id}: {limit_check['message']}")
            raise HTTPException(
                status_code=403,
                detail=limit_check["message"] or "Observation limit reached for this coach. Please upgrade your subscription."
            )
    
    session_doc = {
        "session_id": data.session_id,
        "name": data.name,
        "coach_id": data.coach_id,
        "observer_id": user.user_id,
        "organization_id": org_id,  # CRITICAL: Store for data isolation
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
        "observer_notes": data.observer_notes,
        "observer_reflections": data.observer_reflections,
        "coach_reflections": data.coach_reflections,
        "session_notes": data.session_notes,
        "ai_summary": data.ai_summary,
        "attachments": data.attachments,
        # Reflection template IDs - permanently linked to this observation
        "reflection_template_id": data.reflection_template_id,
        "coach_reflection_template_id": data.coach_reflection_template_id,
        # Structured reflection data
        "observer_reflection": data.observer_reflection,
        "coach_reflection": data.coach_reflection,
        # Reflection sharing flags
        "observer_reflection_shared": data.observer_reflection_shared,
        "coach_reflection_shared": data.coach_reflection_shared
    }
    
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


@router.put("/{session_id}")
async def update_observation_session(session_id: str, data: ObservationSessionCreate, request: Request):
    """Update an existing observation session"""
    user = await require_coach_developer(request)
    
    # Verify access - owner or same organization
    existing = await _find_session_in_org(session_id, user)
    # Need _id for update, re-fetch without projection
    if existing:
        existing = await db.observation_sessions.find_one({"session_id": session_id})
    
    if not existing:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # PHASE 3: Enforce observation limit when completing a session
    # Only check if status is changing TO "completed" and wasn't completed before
    is_becoming_completed = (
        data.status == "completed" and 
        data.coach_id and
        existing.get("status") != "completed"
    )
    
    if is_becoming_completed:
        limit_check = await enforce_observation_limit_on_completion(
            user, data.coach_id, session_id
        )
        if not limit_check["allowed"]:
            logger.warning(f"Observation limit reached for coach {data.coach_id}: {limit_check['message']}")
            raise HTTPException(
                status_code=403,
                detail=limit_check["message"] or "Observation limit reached for this coach. Please upgrade your subscription."
            )
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get user name for edit tracking
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "name": 1})
    user_name = user_doc.get("name", "Unknown") if user_doc else "Unknown"
    
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
        "observer_notes": data.observer_notes,
        "observer_reflections": data.observer_reflections,
        "coach_reflections": data.coach_reflections,
        "session_notes": data.session_notes,
        "ai_summary": data.ai_summary,
        "attachments": data.attachments,
        # Reflection template IDs - permanently linked to this observation
        "reflection_template_id": data.reflection_template_id,
        "coach_reflection_template_id": data.coach_reflection_template_id,
        # Structured reflection data
        "observer_reflection": data.observer_reflection,
        "coach_reflection": data.coach_reflection,
        # Reflection sharing flags
        "observer_reflection_shared": data.observer_reflection_shared,
        "coach_reflection_shared": data.coach_reflection_shared,
        # Edit tracking - always update on PUT
        "last_edited_at": now,
        "last_edited_by": user.user_id,
        "last_edited_by_name": user_name
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


class ReflectionSharingUpdate(BaseModel):
    shared: bool


@router.put("/{session_id}/observer-reflection-sharing")
async def update_observer_reflection_sharing(session_id: str, data: ReflectionSharingUpdate, request: Request):
    """Toggle observer reflection sharing"""
    user = await require_coach_developer(request)
    
    existing = await _find_session_in_org(session_id, user)
    
    if not existing:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.observation_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"observer_reflection_shared": data.shared}}
    )
    
    return {"success": True, "shared": data.shared}


@router.put("/{session_id}/coach-reflection-sharing")
async def update_coach_reflection_sharing(session_id: str, data: ReflectionSharingUpdate, request: Request):
    """Toggle coach reflection sharing - only coaches can toggle their own sharing"""
    user = await require_auth(request)
    
    if user.role != 'coach':
        raise HTTPException(status_code=403, detail="Only coaches can toggle their reflection sharing")
    
    # Verify coach is assigned to this session
    existing = await db.observation_sessions.find_one(
        {"session_id": session_id, "coach_id": user.linked_coach_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.observation_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"coach_reflection_shared": data.shared}}
    )
    
    return {"success": True, "shared": data.shared}


class StructuredReflectionData(BaseModel):
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    responses: dict = {}
    completed_at: Optional[str] = None


@router.put("/{session_id}/observer-reflection")
async def save_observer_reflection(session_id: str, data: StructuredReflectionData, request: Request):
    """Save observer's structured reflection"""
    user = await require_coach_developer(request)
    
    # Any coach developer in the org can save/update the observer reflection
    existing = await _find_session_in_org(session_id, user)
    
    if not existing:
        raise HTTPException(status_code=404, detail="Session not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    reflection_data = {
        "templateId": data.template_id,
        "templateName": data.template_name,
        "responses": data.responses,
        "completedAt": data.completed_at or now,
        "updatedAt": now
    }
    
    await db.observation_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"observer_reflection": reflection_data, "updated_at": now}}
    )
    
    return {"success": True, "reflection": reflection_data}


@router.put("/{session_id}/coach-reflection")
async def save_coach_reflection(session_id: str, data: StructuredReflectionData, request: Request):
    """Save coach's structured reflection"""
    user = await require_auth(request)
    
    if user.role != 'coach':
        raise HTTPException(status_code=403, detail="Only coaches can save their reflection")
    
    # Verify coach is assigned to this session
    existing = await db.observation_sessions.find_one(
        {"session_id": session_id, "coach_id": user.linked_coach_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Session not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    reflection_data = {
        "templateId": data.template_id,
        "templateName": data.template_name,
        "responses": data.responses,
        "completedAt": data.completed_at or now,
        "updatedAt": now
    }
    
    await db.observation_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"coach_reflection": reflection_data, "updated_at": now}}
    )
    
    return {"success": True, "reflection": reflection_data}


@router.delete("/{session_id}")
async def delete_observation_session(session_id: str, request: Request):
    """Delete an observation session"""
    user = await require_coach_developer(request)
    
    # Verify access - any coach developer in the org can delete
    existing = await _find_session_in_org(session_id, user)
    if not existing:
        raise HTTPException(status_code=404, detail="Session not found")
    
    result = await db.observation_sessions.delete_one({"session_id": session_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Also delete from sessions collection
    await db.sessions.delete_one({"session_id": session_id})
    
    return {"success": True, "deleted": True}
