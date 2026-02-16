"""
Demo Data Seed Script for My Coach Developer
Creates a complete demo organization with realistic coaching data for showcasing the platform.
"""

import os
import sys
import uuid
import bcrypt
import random
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

# Connect to database
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

def generate_id():
    return uuid.uuid4().hex[:12]

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Demo organization details
DEMO_ORG = {
    "org_id": f"org_demo_{generate_id()}",
    "club_name": "Riverside Football Academy",
    "club_logo": None,
    "created_at": datetime.now(timezone.utc).isoformat()
}

# Demo coach developers (2)
DEMO_COACH_DEVELOPERS = [
    {
        "name": "Sarah Mitchell",
        "email": "sarah.mitchell@demo.mycoachdeveloper.com",
        "role_title": "Head of Coach Development"
    },
    {
        "name": "James Patterson",
        "email": "james.patterson@demo.mycoachdeveloper.com", 
        "role_title": "Senior Coach Developer"
    }
]

# Demo coaches (10) with realistic profiles
DEMO_COACHES = [
    {"name": "Michael Thompson", "role_title": "U18 Head Coach", "age_group": "U18", "department": "Academy", "bio": "Former professional player with 5 years coaching experience. UEFA A License holder focused on developing technical excellence."},
    {"name": "Emma Richardson", "role_title": "U16 Head Coach", "age_group": "U16", "department": "Academy", "bio": "Specializes in tactical development and game intelligence. Strong background in youth development pathways."},
    {"name": "David Chen", "role_title": "U14 Head Coach", "age_group": "U14", "department": "Academy", "bio": "Passionate about creating positive learning environments. Focus on fundamental skill development and player enjoyment."},
    {"name": "Sophie Williams", "role_title": "U12 Head Coach", "age_group": "U12", "department": "Foundation", "bio": "Early years specialist with education background. Believes in play-based learning and building confidence."},
    {"name": "Ryan O'Brien", "role_title": "Goalkeeping Coach", "age_group": "All Ages", "department": "Specialist", "bio": "Former academy goalkeeper with expertise in modern goalkeeping techniques and distribution."},
    {"name": "Lisa Martinez", "role_title": "U18 Assistant Coach", "age_group": "U18", "department": "Academy", "bio": "Working towards UEFA A License. Strong focus on set pieces and defensive organization."},
    {"name": "Tom Bradley", "role_title": "U16 Assistant Coach", "age_group": "U16", "department": "Academy", "bio": "Sports science background with interest in physical development and injury prevention."},
    {"name": "Hannah Clarke", "role_title": "Girls Development Coach", "age_group": "U14-U18", "department": "Girls Academy", "bio": "Leading the growth of girls football program. Focus on creating inclusive training environments."},
    {"name": "Marcus Johnson", "role_title": "Foundation Phase Lead", "age_group": "U9-U11", "department": "Foundation", "bio": "Child development specialist. Designs age-appropriate sessions that maximize learning through play."},
    {"name": "Priya Patel", "role_title": "Technical Development Coach", "age_group": "All Ages", "department": "Specialist", "bio": "Focuses on individual technique coaching. Works across all age groups on skill development."}
]

# Intervention types for sessions
INTERVENTION_TYPES = [
    {"id": "int_question", "name": "Question", "color": "#3B82F6"},
    {"id": "int_instruction", "name": "Instruction", "color": "#10B981"},
    {"id": "int_feedback", "name": "Feedback", "color": "#F59E0B"},
    {"id": "int_demonstration", "name": "Demonstration", "color": "#8B5CF6"},
    {"id": "int_encouragement", "name": "Encouragement", "color": "#EC4899"},
    {"id": "int_challenge", "name": "Challenge", "color": "#EF4444"}
]

# Descriptor groups
CONTENT_FOCUS = {
    "id": "desc_content",
    "name": "Content Focus",
    "descriptors": [
        {"id": "cf_technical", "name": "Technical"},
        {"id": "cf_tactical", "name": "Tactical"},
        {"id": "cf_physical", "name": "Physical"},
        {"id": "cf_psychological", "name": "Psychological"},
        {"id": "cf_social", "name": "Social"}
    ]
}

DELIVERY_METHOD = {
    "id": "desc_delivery",
    "name": "Delivery Method",
    "descriptors": [
        {"id": "dm_individual", "name": "Individual"},
        {"id": "dm_small_group", "name": "Small Group"},
        {"id": "dm_whole_group", "name": "Whole Group"},
        {"id": "dm_during_play", "name": "During Play"},
        {"id": "dm_stoppage", "name": "Stoppage"}
    ]
}

# Session parts
SESSION_PARTS = [
    {"id": "part_warmup", "name": "Warm Up"},
    {"id": "part_technical", "name": "Technical Practice"},
    {"id": "part_game", "name": "Game/Scrimmage"},
    {"id": "part_cooldown", "name": "Cool Down"}
]

# Observation contexts
OBSERVATION_CONTEXTS = [
    "Regular training session - focus on attacking play",
    "Match preparation session",
    "Technical development focus",
    "Tactical session - defensive shape",
    "Small-sided games emphasis",
    "Set piece practice",
    "Physical conditioning integrated session",
    "Tournament preparation",
    "Post-match recovery and review",
    "Individual skill development"
]

# Target templates
TARGET_TEMPLATES = [
    {"title": "Improve questioning technique", "description": "Develop more open-ended questions that promote player problem-solving and decision making."},
    {"title": "Increase player-led activities", "description": "Create more opportunities for players to take ownership of their learning through player-led warm-ups and cool-downs."},
    {"title": "Balance feedback types", "description": "Provide a better balance between positive reinforcement and constructive feedback."},
    {"title": "Develop demonstration skills", "description": "Improve the clarity and effectiveness of technical demonstrations."},
    {"title": "Enhance session flow", "description": "Reduce transition times between activities to maximize player engagement."},
    {"title": "Individual player focus", "description": "Spend more one-on-one time with players who need additional support."},
    {"title": "Tactical communication", "description": "Improve clarity when explaining tactical concepts using visual aids and player positioning."},
    {"title": "Challenge differentiation", "description": "Create more differentiated challenges to meet varying ability levels within the group."}
]

# Progress note templates
PROGRESS_NOTES = [
    "Showed great improvement in questioning technique today. Players were more engaged and thinking through problems themselves.",
    "Session flow was much better - transitions under 30 seconds consistently.",
    "Good use of demonstrations but could slow down to ensure all players can see clearly.",
    "Excellent balance of encouragement and constructive feedback. Players responded well.",
    "Need to work on voice projection during outdoor sessions - some players struggled to hear instructions.",
    "Really positive session. Players took ownership during the warm-up activity.",
    "Tactical explanations were clear today. Visual positioning helped players understand the concept.",
    "Good progress on differentiation - three different challenge levels worked well.",
    "Maintained high energy throughout the session. Players were motivated and focused.",
    "Effective use of questioning to prompt tactical awareness during the game phase."
]

def create_demo_organization():
    """Create the demo organization"""
    print("Creating demo organization...")
    
    # Check if demo org already exists
    existing = db.organizations.find_one({"club_name": DEMO_ORG["club_name"]})
    if existing:
        print(f"  Demo organization already exists: {existing['org_id']}")
        return existing['org_id']
    
    db.organizations.insert_one(DEMO_ORG)
    print(f"  Created: {DEMO_ORG['club_name']} ({DEMO_ORG['org_id']})")
    return DEMO_ORG['org_id']

def create_coach_developers(org_id):
    """Create coach developer users"""
    print("Creating coach developers...")
    
    coach_dev_ids = []
    for cd in DEMO_COACH_DEVELOPERS:
        user_id = f"user_{generate_id()}"
        
        # Check if user already exists
        existing = db.users.find_one({"email": cd["email"]})
        if existing:
            print(f"  Coach developer already exists: {cd['email']}")
            coach_dev_ids.append(existing['user_id'])
            continue
        
        user = {
            "user_id": user_id,
            "email": cd["email"],
            "name": cd["name"],
            "password_hash": hash_password("Demo123!"),
            "role": "coach_developer",
            "organization_id": org_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "terms_accepted_at": datetime.now(timezone.utc).isoformat()
        }
        
        db.users.insert_one(user)
        coach_dev_ids.append(user_id)
        print(f"  Created: {cd['name']} ({cd['email']})")
    
    # Update org owner
    db.organizations.update_one(
        {"org_id": org_id},
        {"$set": {"owner_id": coach_dev_ids[0]}}
    )
    
    return coach_dev_ids

def create_coaches(org_id, coach_dev_ids):
    """Create coach profiles and user accounts"""
    print("Creating coaches...")
    
    coach_ids = []
    for coach in DEMO_COACHES:
        coach_id = f"coach_{generate_id()}"
        user_id = f"user_{generate_id()}"
        email = f"{coach['name'].lower().replace(' ', '.')}@demo.mycoachdeveloper.com"
        
        # Check if coach already exists
        existing = db.coaches.find_one({"email": email})
        if existing:
            print(f"  Coach already exists: {email}")
            coach_ids.append(existing['id'])
            continue
        
        # Create coach profile
        coach_profile = {
            "id": coach_id,
            "user_id": user_id,
            "name": coach["name"],
            "email": email,
            "photo": None,
            "role_title": coach["role_title"],
            "age_group": coach["age_group"],
            "department": coach["department"],
            "bio": coach["bio"],
            "targets": [],
            "created_at": (datetime.now(timezone.utc) - timedelta(weeks=10)).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "created_by": random.choice(coach_dev_ids)
        }
        
        db.coaches.insert_one(coach_profile)
        
        # Create user account for coach
        user = {
            "user_id": user_id,
            "email": email,
            "name": coach["name"],
            "password_hash": hash_password("Demo123!"),
            "role": "coach",
            "linked_coach_id": coach_id,
            "organization_id": org_id,
            "created_at": (datetime.now(timezone.utc) - timedelta(weeks=10)).isoformat(),
            "terms_accepted_at": datetime.now(timezone.utc).isoformat()
        }
        
        db.users.insert_one(user)
        coach_ids.append(coach_id)
        print(f"  Created: {coach['name']} ({coach['role_title']})")
    
    return coach_ids

def create_targets_for_coaches(coach_ids, coach_dev_ids):
    """Create development targets for coaches"""
    print("Creating targets for coaches...")
    
    for coach_id in coach_ids:
        # Each coach gets 2-3 targets
        num_targets = random.randint(2, 3)
        targets = random.sample(TARGET_TEMPLATES, num_targets)
        
        coach_targets = []
        for i, target in enumerate(targets):
            # Vary the dates
            created_weeks_ago = random.randint(4, 8)
            created_date = datetime.now(timezone.utc) - timedelta(weeks=created_weeks_ago)
            
            # Some targets are completed, some in progress
            status = random.choice(["active", "active", "active", "completed"])
            
            target_entry = {
                "id": f"target_{generate_id()}",
                "title": target["title"],
                "description": target["description"],
                "status": status,
                "created_at": created_date.isoformat(),
                "created_by": random.choice(coach_dev_ids),
                "progress_notes": []
            }
            
            # Add progress notes
            if status == "completed" or random.random() > 0.3:
                num_notes = random.randint(1, 4)
                for j in range(num_notes):
                    note_date = created_date + timedelta(weeks=j+1)
                    if note_date < datetime.now(timezone.utc):
                        target_entry["progress_notes"].append({
                            "id": f"note_{generate_id()}",
                            "content": random.choice(PROGRESS_NOTES),
                            "created_at": note_date.isoformat(),
                            "created_by": random.choice(coach_dev_ids)
                        })
            
            if status == "completed":
                target_entry["completed_at"] = (created_date + timedelta(weeks=random.randint(3, 6))).isoformat()
            
            coach_targets.append(target_entry)
        
        # Update coach with targets
        db.coaches.update_one(
            {"id": coach_id},
            {"$set": {"targets": coach_targets}}
        )
    
    print(f"  Created targets for {len(coach_ids)} coaches")

def create_observation_sessions(coach_ids, coach_dev_ids, org_id):
    """Create observation sessions with events"""
    print("Creating observation sessions...")
    
    sessions_created = 0
    
    for coach_id in coach_ids:
        # Each coach gets 3-6 sessions over the past 8 weeks
        num_sessions = random.randint(3, 6)
        
        # Get coach info
        coach = db.coaches.find_one({"id": coach_id})
        if not coach:
            continue
        
        for s in range(num_sessions):
            session_id = f"session_{generate_id()}"
            
            # Spread sessions over past 8 weeks
            weeks_ago = random.randint(0, 7)
            days_offset = random.randint(0, 6)
            session_date = datetime.now(timezone.utc) - timedelta(weeks=weeks_ago, days=days_offset)
            
            # Session duration 60-90 minutes
            duration_ms = random.randint(60, 90) * 60 * 1000
            
            # Determine status based on date
            if weeks_ago == 0 and days_offset <= 1:
                status = random.choice(["planned", "in_progress"])
            else:
                status = "completed"
            
            observer_id = random.choice(coach_dev_ids)
            
            session = {
                "session_id": session_id,
                "name": f"Session {session_date.strftime('%d/%m/%Y')}",
                "coach_id": coach_id,
                "coach_name": coach["name"],
                "observer_id": observer_id,
                "organization_id": org_id,
                "observation_context": random.choice(OBSERVATION_CONTEXTS),
                "status": status,
                "planned_date": session_date.isoformat(),
                "created_at": (session_date - timedelta(days=random.randint(1, 7))).isoformat(),
                "updated_at": session_date.isoformat(),
                "intervention_types": INTERVENTION_TYPES,
                "descriptor_group1": CONTENT_FOCUS,
                "descriptor_group2": DELIVERY_METHOD,
                "session_parts": SESSION_PARTS,
                "events": [],
                "observer_notes": []
            }
            
            if status == "completed":
                # Add timing data
                session["start_time"] = session_date.isoformat()
                session["end_time"] = (session_date + timedelta(milliseconds=duration_ms)).isoformat()
                session["total_duration"] = duration_ms
                
                # Ball rolling time (typically 60-80% of session)
                ball_rolling_pct = random.uniform(0.6, 0.8)
                session["ball_rolling_time"] = int(duration_ms * ball_rolling_pct)
                session["ball_not_rolling_time"] = duration_ms - session["ball_rolling_time"]
                
                # Create events (15-40 per session)
                num_events = random.randint(15, 40)
                events = []
                
                for e in range(num_events):
                    event_time = random.randint(0, duration_ms)
                    event_type = random.choice(INTERVENTION_TYPES)
                    content_focus = random.choice(CONTENT_FOCUS["descriptors"])
                    delivery_method = random.choice(DELIVERY_METHOD["descriptors"])
                    session_part = random.choice(SESSION_PARTS)
                    
                    event = {
                        "id": f"event_{generate_id()}",
                        "eventTypeId": event_type["id"],
                        "eventTypeName": event_type["name"],
                        "relativeTimestamp": event_time,
                        "timestamp": (session_date + timedelta(milliseconds=event_time)).isoformat(),
                        "sessionPartId": session_part["id"],
                        "ballRolling": random.random() > 0.3,
                        "descriptors1": [content_focus["id"]],
                        "descriptors2": [delivery_method["id"]],
                        "note": ""
                    }
                    
                    # 20% chance of having a note
                    if random.random() < 0.2:
                        event["note"] = random.choice([
                            "Good timing on this intervention",
                            "Players responded well",
                            "Could have waited longer",
                            "Excellent demonstration",
                            "Clear and concise",
                            "Consider player positioning"
                        ])
                    
                    events.append(event)
                
                # Sort events by timestamp
                events.sort(key=lambda x: x["relativeTimestamp"])
                session["events"] = events
                
                # Add observer notes
                if random.random() > 0.3:
                    session["observer_notes"] = [{
                        "id": f"note_{generate_id()}",
                        "content": random.choice([
                            "Great session overall. Good energy and player engagement throughout.",
                            "Session structure was clear. Consider more differentiation in the technical phase.",
                            "Excellent questioning technique observed. Players were problem-solving effectively.",
                            "Good balance of activities. Transition times have improved significantly.",
                            "Strong start to the session. Game phase was particularly effective.",
                            "Session met objectives. Continue developing tactical communication."
                        ]),
                        "timestamp": session_date.isoformat(),
                        "created_by": observer_id
                    }]
                
                # Add ball rolling log
                session["ballRollingLog"] = generate_ball_rolling_log(duration_ms)
            
            db.observation_sessions.insert_one(session)
            sessions_created += 1
    
    print(f"  Created {sessions_created} observation sessions")

def generate_ball_rolling_log(total_duration):
    """Generate realistic ball rolling segments"""
    log = []
    current_time = 0
    rolling = True
    
    while current_time < total_duration:
        if rolling:
            # Ball rolling segments: 2-8 minutes
            segment_duration = random.randint(120000, 480000)
        else:
            # Ball stopped segments: 30 seconds to 3 minutes
            segment_duration = random.randint(30000, 180000)
        
        # Don't exceed total duration
        segment_duration = min(segment_duration, total_duration - current_time)
        
        log.append({
            "start": current_time,
            "duration": segment_duration,
            "rolling": rolling
        })
        
        current_time += segment_duration
        rolling = not rolling
    
    return log

def create_demo_login_summary():
    """Print summary of demo login credentials"""
    print("\n" + "="*60)
    print("DEMO ENVIRONMENT READY")
    print("="*60)
    print("\nOrganization: Riverside Football Academy")
    print("\nLogin Credentials (Password for all: Demo123!)")
    print("-"*60)
    print("\nCoach Developers:")
    for cd in DEMO_COACH_DEVELOPERS:
        print(f"  - {cd['name']}: {cd['email']}")
    print("\nCoaches (sample):")
    for coach in DEMO_COACHES[:3]:
        email = f"{coach['name'].lower().replace(' ', '.')}@demo.mycoachdeveloper.com"
        print(f"  - {coach['name']}: {email}")
    print(f"  ... and {len(DEMO_COACHES) - 3} more coaches")
    print("\n" + "="*60)

def main():
    print("="*60)
    print("MY COACH DEVELOPER - DEMO DATA SEED")
    print("="*60)
    print(f"\nDatabase: {DB_NAME}")
    print(f"MongoDB: {MONGO_URL}\n")
    
    # Create demo data
    org_id = create_demo_organization()
    coach_dev_ids = create_coach_developers(org_id)
    coach_ids = create_coaches(org_id, coach_dev_ids)
    create_targets_for_coaches(coach_ids, coach_dev_ids)
    create_observation_sessions(coach_ids, coach_dev_ids, org_id)
    
    # Print summary
    create_demo_login_summary()
    
    print("\nDemo data creation complete!")

if __name__ == "__main__":
    main()
