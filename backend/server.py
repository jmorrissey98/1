from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

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

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()