"""
Riverside Football Academy - Comprehensive Demo Data Seed Script
Deletes old sessions and creates new, realistic sessions with full data:
- Proper observation_context ("training" or "game")
- Complete event timelines with relativeTimestamp
- ball_rolling_log in segment format
- Session parts with timing data
- Structured observer_reflection and coach_reflection
- Observer notes and session notes
"""

import os
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

ORG_ID = "org_demo_0725dd5e668a"

# Coach Developers
COACH_DEVS = {
    "user_cb6e50051362": "Sarah Mitchell",
    "user_299c26e419a0": "James Patterson Updated",
}

# Coaches
COACHES = [
    {"id": "coach_988983aec6e5", "user_id": "user_a8900359c34d", "name": "Michael Thompson", "age_group": "U18"},
    {"id": "coach_43e3c3ee2eec", "user_id": "user_747e983430ca", "name": "Emma Richardson", "age_group": "U16"},
    {"id": "coach_edb7e60c89d6", "user_id": "user_8f10a38f82f3", "name": "David Chen", "age_group": "U14"},
    {"id": "coach_18e8fa0ec945", "user_id": "user_b29883754095", "name": "Sophie Williams", "age_group": "U12"},
    {"id": "coach_8b2f0bf53cc2", "user_id": "user_fefd5a89fe5f", "name": "Ryan O'Brien", "age_group": "All Ages"},
    {"id": "coach_fc8705b65d59", "user_id": "user_0ec9fb440ef1", "name": "Lisa Martinez", "age_group": "U18"},
    {"id": "coach_83289c41ab26", "user_id": "user_21120cde7555", "name": "Tom Bradley", "age_group": "U16"},
    {"id": "coach_531be1d0d105", "user_id": "user_47d381d5cce6", "name": "Hannah Clarke", "age_group": "U14-U18"},
    {"id": "coach_64b05a839ca6", "user_id": "user_0698b70ac2e2", "name": "Marcus Johnson", "age_group": "U9-U11"},
    {"id": "coach_df76e1ebcd94", "user_id": "user_18653ae26887", "name": "Priya Patel", "age_group": "All Ages"},
]

# Intervention types used by the training template
INTERVENTION_TYPES = [
    {"id": "command", "name": "Command", "color": "yellow"},
    {"id": "qa", "name": "Q&A", "color": "yellow"},
    {"id": "guided_discovery", "name": "Guided Discovery", "color": "yellow"},
    {"id": "transmission", "name": "Transmission", "color": "yellow"},
]

CONTENT_FOCUS = {
    "id": "content_focus", "name": "Content Focus", "color": "blue",
    "descriptors": [
        {"id": "technical", "name": "Technical"},
        {"id": "tactical", "name": "Tactical"},
        {"id": "physical", "name": "Physical"},
        {"id": "psych", "name": "Psych"},
        {"id": "social", "name": "Social"},
    ]
}

DELIVERY_METHOD = {
    "id": "delivery_method", "name": "Delivery Method", "color": "green",
    "descriptors": [
        {"id": "visual_demo", "name": "Visual Demo"},
        {"id": "triggers", "name": "Triggers"},
        {"id": "kinesthetic", "name": "Kinesthetic"},
    ]
}

TRAINING_PARTS = [
    {"id": "part_1", "name": "Part 1", "order": 0, "isDefault": True},
    {"id": "part_2", "name": "Part 2", "order": 1, "isDefault": True},
    {"id": "part_3", "name": "Part 3", "order": 2, "isDefault": True},
    {"id": "part_4", "name": "Part 4", "order": 3, "isDefault": True},
]

MATCH_PARTS = [
    {"id": "first_half", "name": "First Half", "order": 0, "isDefault": True},
    {"id": "second_half", "name": "Second Half", "order": 1, "isDefault": True},
]

# Reflection template references (MUST match actual DB templates exactly)
# Observer: q1=text, q2=scale(1-5), q3=checkbox(options)
OBSERVER_TEMPLATE = {
    "template_id": "admin_tpl_ee283c3c3a71",
    "name": "Post-Observation Reflection",
}

# Coach: q1=scale(1-5), q2=text, q3=text
COACH_TEMPLATE = {
    "template_id": "admin_tpl_coach_86293ddd",
    "name": "Coach Reflection",
}

# Checkbox options for observer template q3
OBSERVER_Q3_OPTIONS = ["Communication", "Planning", "Time Management", "Engagement", "Technical Skills"]

# Realistic session titles
TRAINING_TITLES = [
    "{ag} Training - Attacking Play",
    "{ag} Training - Defensive Shape",
    "{ag} Training - Possession Game",
    "{ag} Training - Set Pieces",
    "{ag} Training - Transition Play",
    "{ag} Training - Pressing & Counter-Press",
    "{ag} Training - Build Up Play",
    "{ag} Training - Final Third",
    "{ag} Training - 1v1 Defending",
    "{ag} Training - Crossing & Finishing",
    "{ag} Training - Passing Combinations",
    "{ag} Technical - Ball Mastery",
    "{ag} Training - Small Sided Games",
    "{ag} Training - Game Model Integration",
]

MATCH_TITLES = [
    "{ag} Match vs Oak Academy",
    "{ag} Cup Game vs Southbank FC",
    "{ag} League Match vs Hilltop United",
    "{ag} Friendly vs City Youth",
    "{ag} Match Day vs Riverside Reserves",
]

# Observer reflection answer pools
OBSERVER_BEHAVIOURS = [
    "The coach demonstrated excellent questioning technique, using open-ended questions that encouraged players to think critically about their positioning and decision-making. The transition between activities was smooth.",
    "Strong use of demonstrations throughout the session. The coach positioned themselves well to show technique from multiple angles. Voice projection was clear and players were attentive.",
    "Good balance between guided discovery and direct instruction. The coach allowed players to explore solutions before stepping in with feedback. The session had a natural progression from simple to complex.",
    "The coach showed strong awareness of individual player needs, adapting challenges for different ability levels. Positive reinforcement was used effectively to build confidence.",
    "Excellent session management and energy. The coach maintained a high tempo throughout with minimal transition time. Players were engaged and motivated from start to finish.",
    "The coach effectively used the game as the teacher, setting up scenarios that naturally created the learning opportunities. Intervention timing was appropriate - not too frequent, not too sparse.",
    "Good tactical communication using visual positioning and spatial references. The coach moved players physically to show shape, which was more effective than verbal instruction alone.",
    "The coach created a positive learning environment where players felt safe to make mistakes. Feedback was constructive and specific, rather than generic praise.",
]

OBSERVER_OPPORTUNITIES = [
    "Consider allowing more time for player-led problem solving before intervening. Some questions could be more open to encourage deeper thinking.",
    "Work on varying the delivery method - the session relied heavily on whole group instruction. Small group work would allow for more differentiated learning.",
    "The cool-down phase felt rushed. Building in more structured reflection time at the end could help reinforce the session's learning objectives.",
    "Could develop more challenging variations for the advanced players in the group. The session was well-pitched for the middle ability but some players needed stretching.",
    "Voice projection during the outdoor session could improve. Consider positioning relative to wind direction and using the whistle less frequently.",
    "The session plan was strong but flexibility to adapt when the game created different learning moments would enhance the coaching further.",
    "Individual feedback during play was excellent, but the group stoppages could be shorter and more focused on one key coaching point at a time.",
    "Building stronger connections between the warm-up activities and the main session theme would help players understand the session's purpose earlier.",
]

# Coach reflection answer pools
COACH_WENT_WELL = [
    "I felt the players really engaged with the session topic today. The small-sided game at the end brought everything together and I could see the players applying what we worked on in the technical phase.",
    "The warm-up flowed well into the main activity and players seemed to understand the progression. I was pleased with how the less confident players contributed.",
    "Good energy throughout. I managed my time better today and got through all four parts without rushing. The questioning technique I've been working on felt more natural.",
    "Players responded well to the challenge. The competitive element in Part 3 really brought out the best in them. I also felt more confident with my demonstrations today.",
    "The session objectives were clear from the start and I think the players understood what we were trying to achieve. Feedback from the group at the end was positive.",
    "I managed to give more individual feedback during the game phase today. I also felt I used my positioning better to observe without interrupting the flow of play.",
]

COACH_CHANGE = [
    "I would spend more time on the technical practice before moving to the game. Some players needed more repetition before applying the skill under pressure.",
    "I'd like to have more differentiated challenges ready. The advanced group finished quickly and needed extending. I'll prepare additional progressions next time.",
    "I think I could have used more questioning during the game phase rather than giving direct instruction. I want to develop the players' ability to self-correct.",
    "The transition between Part 2 and Part 3 was too long. I need to think about how to reorganize the group more efficiently.",
    "I would change the group sizes in the possession game. 4v4 worked better than 5v5 for the objective we were working on.",
    "Next time I'd involve the players more in setting up the session. Getting them to take ownership of the equipment and space could save time and build responsibility.",
]

# Session notes pools
SESSION_NOTES_POOL = [
    "Weather was good, full squad available. Strong session with clear progression. Follow up on pressing triggers next session.",
    "Two players absent due to school commitments. Adapted the session to work with smaller numbers which actually improved the intensity.",
    "Post-match review session following Saturday's game. Focused on the areas discussed in the team talk. Players engaged well with video analysis.",
    "First session back after half-term break. Started with fun games to rebuild team cohesion before moving into structured practice.",
    "Joint session with {other_ag} to prepare for the upcoming tournament. Good competition between the age groups.",
    "Indoor session due to weather. Adapted the plan to focus on technical work in the sports hall. Players enjoyed the change of environment.",
    "Assessment session as part of the mid-season review. Recorded observations for player development reports.",
    "Pre-match preparation. Focused on set pieces and tactical organisation for tomorrow's cup game.",
]


def gen_id():
    return uuid.uuid4().hex[:12]


def generate_ball_rolling_log(total_duration_ms):
    """Generate realistic ball rolling segments in the correct format"""
    log = []
    current_time = 0
    rolling = True
    while current_time < total_duration_ms:
        if rolling:
            segment_duration = random.randint(90000, 360000)  # 1.5-6 min
        else:
            segment_duration = random.randint(20000, 120000)  # 20s-2min
        segment_duration = min(segment_duration, total_duration_ms - current_time)
        log.append({"start": current_time, "duration": segment_duration, "rolling": rolling})
        current_time += segment_duration
        rolling = not rolling
    return log


def assign_part_timing(parts, session_start_dt, total_duration_sec):
    """Assign startTime, endTime, duration, ballRollingTime to each session part.
    All duration values stored in SECONDS (frontend formatTime expects seconds).
    startTime/endTime are ISO strings."""
    num_parts = len(parts)
    total_duration_ms = total_duration_sec * 1000
    weights = [random.uniform(0.8, 1.5) for _ in range(num_parts)]
    total_weight = sum(weights)
    
    timed_parts = []
    current_ms = 0
    for i, part in enumerate(parts):
        part_duration_ms = int((weights[i] / total_weight) * total_duration_ms)
        if i == num_parts - 1:
            part_duration_ms = total_duration_ms - current_ms
        
        part_start_dt = session_start_dt + timedelta(milliseconds=current_ms)
        part_end_dt = session_start_dt + timedelta(milliseconds=current_ms + part_duration_ms)
        
        part_duration_sec = part_duration_ms / 1000
        ball_rolling_pct = random.uniform(0.55, 0.85)
        ball_rolling_sec = int(part_duration_sec * ball_rolling_pct)
        
        timed_part = {
            **part,
            "startTime": part_start_dt.isoformat(),
            "endTime": part_end_dt.isoformat(),
            "duration": part_duration_sec,
            "ballRollingTime": ball_rolling_sec,
            "ballNotRollingTime": int(part_duration_sec - ball_rolling_sec),
        }
        timed_parts.append(timed_part)
        current_ms += part_duration_ms
    
    return timed_parts


def generate_events(parts, total_duration_ms, num_events):
    """Generate realistic intervention events distributed across parts"""
    events = []
    for _ in range(num_events):
        part = random.choice(parts)
        
        # Calculate event time within the part
        part_start = 0
        part_end = total_duration_ms
        if "startTime" in part and "endTime" in part:
            # Use relative ms within session
            for p in parts:
                if p["id"] == part["id"]:
                    break
            part_start = int(part.get("duration", 0) * parts.index(part) / len(parts) * len(parts))
        
        # Simple: random time within session
        event_time = random.randint(0, total_duration_ms)
        
        intervention = random.choice(INTERVENTION_TYPES)
        content = random.choice(CONTENT_FOCUS["descriptors"])
        delivery = random.choice(DELIVERY_METHOD["descriptors"])
        
        event = {
            "id": f"evt_{gen_id()}",
            "eventTypeId": intervention["id"],
            "eventTypeName": intervention["name"],
            "relativeTimestamp": event_time,
            "sessionPartId": part["id"],
            "ballRolling": random.random() > 0.25,
            "descriptors1": [content["id"]],
            "descriptors2": [delivery["id"]],
            "note": "",
        }
        
        if random.random() < 0.15:
            event["note"] = random.choice([
                "Good timing on this intervention",
                "Players responded well to the question",
                "Consider giving players more time to respond",
                "Effective use of demonstration",
                "Clear instruction, well received",
                "Nice use of guided discovery here",
                "Players solving the problem themselves",
                "Positive reinforcement at the right moment",
            ])
        
        events.append(event)
    
    events.sort(key=lambda x: x["relativeTimestamp"])
    
    # Re-assign sessionPartId based on actual timing
    if parts and "duration" in parts[0]:
        cumulative = 0
        part_ranges = []
        for p in parts:
            dur = p.get("duration", total_duration_ms // len(parts))
            part_ranges.append((cumulative, cumulative + dur, p["id"]))
            cumulative += dur
        
        for event in events:
            t = event["relativeTimestamp"]
            for start, end, pid in part_ranges:
                if start <= t < end:
                    event["sessionPartId"] = pid
                    break
    
    return events


def generate_observer_reflection(session_dt):
    """Generate a structured observer reflection matching actual template:
    q1=text, q2=scale(1-5), q3=checkbox(array of selected options)"""
    # Pick 1-3 checkbox options
    num_selected = random.randint(1, 3)
    selected_options = random.sample(OBSERVER_Q3_OPTIONS, num_selected)
    
    return {
        "templateId": OBSERVER_TEMPLATE["template_id"],
        "templateName": OBSERVER_TEMPLATE["name"],
        "responses": {
            "q1": random.choice(OBSERVER_BEHAVIOURS),        # text
            "q2": random.randint(3, 5),                       # scale
            "q3": selected_options,                            # checkbox (array)
        },
        "completedAt": (session_dt + timedelta(minutes=random.randint(5, 30))).isoformat(),
    }


def generate_coach_reflection(session_dt):
    """Generate a structured coach reflection matching actual template:
    q1=scale(1-5), q2=text, q3=text"""
    return {
        "templateId": COACH_TEMPLATE["template_id"],
        "templateName": COACH_TEMPLATE["name"],
        "responses": {
            "q1": random.randint(3, 5),                    # scale
            "q2": random.choice(COACH_WENT_WELL),          # text
            "q3": random.choice(COACH_CHANGE),             # text
        },
        "completedAt": (session_dt + timedelta(hours=random.randint(1, 48))).isoformat(),
    }


def generate_observer_notes(session_dt, observer_id, num_notes=None):
    """Generate observer notes taken during the session"""
    if num_notes is None:
        num_notes = random.randint(1, 4)
    
    note_pool = [
        "Good energy from the group at the start. Players arrived focused and ready to go.",
        "The technical practice phase was well-structured. Clear progressions and good use of space.",
        "Noticed the coach using more open questions today - improvement from last observation.",
        "Transition between activities was smooth. Players knew what to do and where to go.",
        "The game phase brought out some excellent tactical understanding. Players making good decisions.",
        "Coach adapted well when the drill wasn't working. Changed the constraints to improve the outcome.",
        "Great balance of positive reinforcement and constructive feedback throughout.",
        "The coach positioned themselves well to observe the whole group. Good scanning of the session.",
        "Players were encouraged to communicate. The coach modelled the language they wanted to hear.",
        "Session ended with a strong review. Players could articulate what they learned today.",
        "Noticed a couple of players struggling with the 1v1 element. Coach provided good individual support.",
        "The competitive element raised the intensity. Players were fully engaged in the final game.",
    ]
    
    notes = []
    used = set()
    for i in range(num_notes):
        note_text = random.choice([n for n in note_pool if n not in used])
        used.add(note_text)
        note_time = session_dt + timedelta(minutes=random.randint(5, 60))
        notes.append({
            "id": f"note_{gen_id()}",
            "text": note_text,
            "content": note_text,
            "relativeTimestamp": random.randint(300000, 3600000),
            "timestamp": note_time.isoformat(),
            "created_by": observer_id,
        })
    
    return notes


def delete_old_sessions():
    """Delete all existing sessions for the Riverside org"""
    result = db.observation_sessions.delete_many({"organization_id": ORG_ID})
    print(f"Deleted {result.deleted_count} old sessions for {ORG_ID}")
    
    # Also delete any reflections for the org's sessions
    old_session_ids = [s["session_id"] for s in db.observation_sessions.find({"organization_id": ORG_ID}, {"session_id": 1, "_id": 0})]
    if old_session_ids:
        ref_result = db.reflections.delete_many({"session_id": {"$in": old_session_ids}})
        print(f"Deleted {ref_result.deleted_count} old reflections")


def create_sessions():
    """Create comprehensive demo sessions"""
    print("\nCreating new sessions...")
    
    coach_dev_ids = list(COACH_DEVS.keys())
    sessions_created = 0
    
    for coach in COACHES:
        num_sessions = random.randint(3, 5)
        
        for s_idx in range(num_sessions):
            session_id = f"session_{gen_id()}"
            
            # Spread sessions over past 10 weeks
            weeks_ago = random.randint(0, 9)
            days_offset = random.randint(0, 6)
            
            # Sessions happen in afternoon (14:00-18:00)
            hour = random.randint(14, 17)
            minute = random.choice([0, 15, 30, 45])
            session_date = datetime.now(timezone.utc).replace(hour=hour, minute=minute, second=0, microsecond=0) - timedelta(weeks=weeks_ago, days=days_offset)
            
            # 80% training, 20% match
            is_match = random.random() < 0.2
            
            if is_match:
                title = random.choice(MATCH_TITLES).format(ag=coach["age_group"])
                obs_context = "game"
                base_parts = [dict(p) for p in MATCH_PARTS]
                duration_minutes = random.randint(50, 90)
            else:
                title = random.choice(TRAINING_TITLES).format(ag=coach["age_group"])
                obs_context = "training"
                base_parts = [dict(p) for p in TRAINING_PARTS]
                duration_minutes = random.randint(45, 90)
            
            duration_sec = duration_minutes * 60
            duration_ms = duration_sec * 1000  # for events/ball_rolling_log (ms)
            observer_id = random.choice(coach_dev_ids)
            
            # Most sessions are completed, a couple recent ones might be planned
            if weeks_ago == 0 and days_offset <= 1 and s_idx == num_sessions - 1:
                status = "planned"
            else:
                status = "completed"
            
            # Assign timing to parts (pass seconds)
            timed_parts = assign_part_timing(base_parts, session_date, duration_sec)
            
            session = {
                "session_id": session_id,
                "name": title,
                "coach_id": coach["id"],
                "coach_name": coach["name"],
                "observer_id": observer_id,
                "organization_id": ORG_ID,
                "observation_context": obs_context,
                "status": status,
                "planned_date": session_date.isoformat(),
                "created_at": (session_date - timedelta(days=random.randint(1, 3))).isoformat(),
                "updated_at": session_date.isoformat(),
                "intervention_types": INTERVENTION_TYPES,
                "descriptor_group1": CONTENT_FOCUS,
                "descriptor_group2": DELIVERY_METHOD,
                "session_parts": timed_parts,
                "include_ball_rolling": True,
                "reflection_template_id": OBSERVER_TEMPLATE["template_id"],
                "coach_reflection_template_id": COACH_TEMPLATE["template_id"],
                "observer_reflection_shared": True,
                "coach_reflection_shared": True,
            }
            
            if status == "completed":
                session["start_time"] = session_date.isoformat()
                end_time = session_date + timedelta(seconds=duration_sec)
                session["end_time"] = end_time.isoformat()
                session["total_duration"] = duration_sec  # SECONDS
                
                # Ball rolling/stopped (in SECONDS)
                ball_rolling_pct = random.uniform(0.55, 0.80)
                session["ball_rolling_time"] = int(duration_sec * ball_rolling_pct)
                session["ball_not_rolling_time"] = duration_sec - session["ball_rolling_time"]
                
                # Ball rolling log (in MILLISECONDS for timeline)
                session["ball_rolling_log"] = generate_ball_rolling_log(duration_ms)
                
                # Events (relativeTimestamp in MILLISECONDS)
                num_events = random.randint(18, 45)
                session["events"] = generate_events(timed_parts, duration_ms, num_events)
                
                # Observer notes
                session["observer_notes"] = generate_observer_notes(session_date, observer_id)
                
                # Observer reflection (85% chance)
                if random.random() < 0.85:
                    session["observer_reflection"] = generate_observer_reflection(session_date)
                
                # Coach reflection (70% chance)
                if random.random() < 0.70:
                    session["coach_reflection"] = generate_coach_reflection(session_date)
                
                # Session notes (60% chance)
                if random.random() < 0.60:
                    other_ags = ["U12", "U14", "U16", "U18"]
                    other_ag = random.choice([a for a in other_ags if a != coach["age_group"]] or other_ags)
                    session["session_notes"] = random.choice(SESSION_NOTES_POOL).format(other_ag=other_ag)
                else:
                    session["session_notes"] = ""
                
                # Empty defaults for non-populated fields
                session["ai_summary"] = ""
                session["attachments"] = []
                session["observer_reflections"] = []
                session["coach_reflections"] = []
            else:
                # Planned session - minimal data
                session["start_time"] = None
                session["end_time"] = None
                session["total_duration"] = 0
                session["ball_rolling_time"] = 0
                session["ball_not_rolling_time"] = 0
                session["ball_rolling_log"] = []
                session["events"] = []
                session["observer_notes"] = []
                session["observer_reflections"] = []
                session["coach_reflections"] = []
                session["session_notes"] = ""
                session["ai_summary"] = ""
                session["attachments"] = []
            
            db.observation_sessions.insert_one(session)
            sessions_created += 1
    
    print(f"Created {sessions_created} sessions")
    return sessions_created


def verify_sessions():
    """Print verification summary"""
    total = db.observation_sessions.count_documents({"organization_id": ORG_ID})
    completed = db.observation_sessions.count_documents({"organization_id": ORG_ID, "status": "completed"})
    planned = db.observation_sessions.count_documents({"organization_id": ORG_ID, "status": "planned"})
    
    with_observer_ref = db.observation_sessions.count_documents({
        "organization_id": ORG_ID,
        "observer_reflection.completedAt": {"$exists": True}
    })
    with_coach_ref = db.observation_sessions.count_documents({
        "organization_id": ORG_ID,
        "coach_reflection.completedAt": {"$exists": True}
    })
    with_events = db.observation_sessions.count_documents({
        "organization_id": ORG_ID,
        "events.0": {"$exists": True}
    })
    with_ball_log = db.observation_sessions.count_documents({
        "organization_id": ORG_ID,
        "ball_rolling_log.0": {"$exists": True}
    })
    with_notes = db.observation_sessions.count_documents({
        "organization_id": ORG_ID,
        "observer_notes.0": {"$exists": True}
    })
    
    training = db.observation_sessions.count_documents({"organization_id": ORG_ID, "observation_context": "training"})
    game = db.observation_sessions.count_documents({"organization_id": ORG_ID, "observation_context": "game"})
    
    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    print(f"Total sessions:           {total}")
    print(f"  Completed:              {completed}")
    print(f"  Planned:                {planned}")
    print(f"  Training:               {training}")
    print(f"  Match/Game:             {game}")
    print(f"With events:              {with_events}")
    print(f"With ball rolling log:    {with_ball_log}")
    print(f"With observer notes:      {with_notes}")
    print(f"With observer reflection: {with_observer_ref}")
    print(f"With coach reflection:    {with_coach_ref}")
    
    # Per-coach breakdown
    print("\nPer-coach breakdown:")
    for coach in COACHES:
        count = db.observation_sessions.count_documents({"organization_id": ORG_ID, "coach_id": coach["id"]})
        print(f"  {coach['name']:25s} {count} sessions")
    
    print("=" * 60)


def main():
    print("=" * 60)
    print("RIVERSIDE FOOTBALL ACADEMY - DEMO DATA SEED")
    print("=" * 60)
    print(f"Database: {DB_NAME}")
    print(f"Organization: {ORG_ID}\n")
    
    delete_old_sessions()
    create_sessions()
    verify_sessions()
    
    print("\nDemo data seeding complete!")


if __name__ == "__main__":
    main()
