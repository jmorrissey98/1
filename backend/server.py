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

SESSION: {request.session_name}
DURATION: {format_time(request.total_duration)}
TOTAL EVENTS LOGGED: {request.total_events}

BALL IN PLAY:
- Ball Rolling: {format_time(request.ball_rolling_time)} ({ball_rolling_pct}%)
- Ball Stopped: {format_time(request.ball_not_rolling_time)} ({100 - ball_rolling_pct}%)

COACHING INTERVENTIONS:
{chr(10).join([f"- {k}: {v} times" for k, v in request.event_breakdown.items()])}

{request.descriptor1_name.upper()}:
{chr(10).join([f"- {k}: {v}" for k, v in request.descriptor1_breakdown.items()])}

{request.descriptor2_name.upper()}:
{chr(10).join([f"- {k}: {v}" for k, v in request.descriptor2_breakdown.items()])}

SESSION PARTS:
{chr(10).join([f"- {p.get('name', 'Part')}: {p.get('events', 0)} events, Ball rolling {p.get('ballRollingPct', 0)}%" for p in request.session_parts])}

"""
        if request.user_notes:
            prompt += f"""
OBSERVER'S NOTES:
{request.user_notes}

"""
        
        prompt += """Please provide:
1. A brief overview of the session patterns observed
2. Strengths noted in the coaching approach
3. Areas for reflection and development (framed constructively)
4. Questions the coach might consider for self-reflection

Keep the tone professional, supportive, and non-judgmental. Focus on observable patterns, not judgments of quality. Write 3-4 paragraphs maximum."""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"session-summary-{uuid.uuid4()}",
            system_message="You are a supportive coach educator assistant that helps coaches reflect on their practice. Your feedback is always constructive, specific, and focused on development rather than judgment."
        ).with_model("openai", "gpt-5.2")
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        return SessionSummaryResponse(summary=response)
        
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

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