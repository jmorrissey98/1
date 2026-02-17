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
from dependencies import require_auth, require_coach_developer

router = APIRouter(prefix="/observations", tags=["Observations"])


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
    total_duration: int = 0
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
    total_duration: int = 0
    ball_rolling_time: int = 0
    ball_not_rolling_time: int = 0
    ball_rolling: Optional[bool] = None
    active_part_id: Optional[str] = None
    events: Optional[List[Any]] = []
    ball_rolling_log: Optional[List[Any]] = []
    observer_reflections: Optional[List[Any]] = []
    coach_reflections: Optional[List[Any]] = []
    session_notes: Optional[str] = ""
    ai_summary: Optional[str] = ""
    attachments: Optional[List[Any]] = []

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
    total_duration: int = 0
    ball_rolling_time: int = 0
    ball_not_rolling_time: int = 0
    events: List[Any] = []
    ball_rolling_log: List[Any] = []
    observer_reflections: List[Any] = []
    coach_reflections: List[Any] = []
    session_notes: str = ""
    ai_summary: str = ""
    attachments: List[Any] = []


@router.get("")
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


@router.get("/{session_id}")
async def get_observation_session(session_id: str, request: Request):
    """Get a specific observation session - accessible by both coach developers and coaches"""
    user = await require_auth(request)
    
    # Build query based on user role
    if user.role == 'coach':
        # Coaches can only access sessions where they are the assigned coach
        session = await db.observation_sessions.find_one(
            {"session_id": session_id, "coach_id": user.linked_coach_id},
            {"_id": 0}
        )
    else:
        # Coach developers can access their own observed sessions
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


@router.put("/{session_id}")
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


@router.delete("/{session_id}")
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
