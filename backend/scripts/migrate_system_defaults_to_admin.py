"""
Migration script: Convert system default templates to admin templates.

This script:
1. Creates admin templates from the hardcoded default template definitions
2. Marks them as global and as bootstrap defaults
3. The bootstrap_default_templates() function will then copy these to new orgs

Run with: python scripts/migrate_system_defaults_to_admin.py
"""

import asyncio
import sys
import os
sys.path.insert(0, '/app/backend')

from database import db, logger
from datetime import datetime, timezone
import uuid

# Import the default template definitions
from utils import (
    DEFAULT_INTERVENTION_TYPES,
    DEFAULT_DESCRIPTOR_GROUP_1,
    DEFAULT_DESCRIPTOR_GROUP_2,
    TRAINING_TEMPLATE_PARTS,
    MATCH_DAY_TEMPLATE_PARTS
)


async def create_admin_observation_templates():
    """Create admin templates for observation windows"""
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Training Template
    training_admin = {
        "template_id": f"admin_tpl_training_{uuid.uuid4().hex[:8]}",
        "is_admin_template": True,
        "category": "observation",
        "name": "Training Template",
        "description": "Default template for training session observations",
        "qualification_tags": [],
        "is_global": True,
        "is_bootstrap_default": True,  # New flag: used when bootstrapping new orgs
        "assigned_user_ids": [],
        "assigned_org_ids": [],
        "template_data": {
            "observationContext": "training",
            "includeBallRolling": True,
            "interventionTypes": DEFAULT_INTERVENTION_TYPES,
            "descriptorGroup1": DEFAULT_DESCRIPTOR_GROUP_1,
            "descriptorGroup2": DEFAULT_DESCRIPTOR_GROUP_2,
            "sessionParts": TRAINING_TEMPLATE_PARTS
        },
        "created_by": "system",
        "created_at": now,
        "updated_at": now
    }
    
    # Match Day Template
    match_day_admin = {
        "template_id": f"admin_tpl_matchday_{uuid.uuid4().hex[:8]}",
        "is_admin_template": True,
        "category": "observation",
        "name": "Match Day Template",
        "description": "Default template for match day observations",
        "qualification_tags": [],
        "is_global": True,
        "is_bootstrap_default": True,
        "assigned_user_ids": [],
        "assigned_org_ids": [],
        "template_data": {
            "observationContext": "game",
            "includeBallRolling": True,
            "interventionTypes": DEFAULT_INTERVENTION_TYPES,
            "descriptorGroup1": DEFAULT_DESCRIPTOR_GROUP_1,
            "descriptorGroup2": DEFAULT_DESCRIPTOR_GROUP_2,
            "sessionParts": MATCH_DAY_TEMPLATE_PARTS
        },
        "created_by": "system",
        "created_at": now,
        "updated_at": now
    }
    
    return [training_admin, match_day_admin]


async def create_admin_reflection_templates():
    """Create admin templates for reflections"""
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Coach Educator Reflection Template
    coach_educator_admin = {
        "template_id": f"admin_tpl_cdeducator_{uuid.uuid4().hex[:8]}",
        "is_admin_template": True,
        "category": "coach_developer_reflection",
        "name": "Coach Educator Reflection",
        "description": "Comprehensive reflection template for coach educators after observing sessions",
        "qualification_tags": [],
        "is_global": True,
        "is_bootstrap_default": True,
        "assigned_user_ids": [],
        "assigned_org_ids": [],
        "template_data": {
            "targetRole": "coach_educator",
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
            ]
        },
        "created_by": "system",
        "created_at": now,
        "updated_at": now
    }
    
    # Coach Reflection Template
    coach_admin = {
        "template_id": f"admin_tpl_coach_{uuid.uuid4().hex[:8]}",
        "is_admin_template": True,
        "category": "coach_reflection",
        "name": "Coach Reflection",
        "description": "Simple reflection template for coaches after being observed",
        "qualification_tags": [],
        "is_global": True,
        "is_bootstrap_default": True,
        "assigned_user_ids": [],
        "assigned_org_ids": [],
        "template_data": {
            "targetRole": "coach",
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
            ]
        },
        "created_by": "system",
        "created_at": now,
        "updated_at": now
    }
    
    return [coach_educator_admin, coach_admin]


async def migrate():
    """Main migration function"""
    print("=" * 60)
    print("Migrating System Defaults to Admin Templates")
    print("=" * 60)
    
    # Check if bootstrap default admin templates already exist
    existing_bootstrap = await db.admin_templates.count_documents({
        "is_admin_template": True,
        "is_bootstrap_default": True
    })
    
    if existing_bootstrap > 0:
        print(f"\nFound {existing_bootstrap} existing bootstrap default admin templates.")
        response = input("Do you want to delete them and recreate? (y/N): ")
        if response.lower() == 'y':
            result = await db.admin_templates.delete_many({
                "is_admin_template": True,
                "is_bootstrap_default": True
            })
            print(f"Deleted {result.deleted_count} existing bootstrap templates.")
        else:
            print("Skipping observation templates creation.")
            return
    
    # Create observation admin templates
    print("\n1. Creating Admin Observation Templates...")
    obs_templates = await create_admin_observation_templates()
    for tpl in obs_templates:
        await db.admin_templates.insert_one(tpl)
        print(f"   - Created: {tpl['name']} ({tpl['template_id']})")
    
    # Create reflection admin templates
    print("\n2. Creating Admin Reflection Templates...")
    ref_templates = await create_admin_reflection_templates()
    for tpl in ref_templates:
        await db.admin_templates.insert_one(tpl)
        print(f"   - Created: {tpl['name']} ({tpl['template_id']})")
    
    # Summary
    total = len(obs_templates) + len(ref_templates)
    print(f"\n{'=' * 60}")
    print(f"Migration Complete!")
    print(f"Created {total} admin templates marked as bootstrap defaults.")
    print(f"{'=' * 60}")
    
    # Show current admin template counts
    admin_count = await db.admin_templates.count_documents({"is_admin_template": True})
    global_count = await db.admin_templates.count_documents({"is_admin_template": True, "is_global": True})
    bootstrap_count = await db.admin_templates.count_documents({"is_admin_template": True, "is_bootstrap_default": True})
    
    print(f"\nCurrent Admin Template Stats:")
    print(f"  - Total admin templates: {admin_count}")
    print(f"  - Global templates: {global_count}")
    print(f"  - Bootstrap defaults: {bootstrap_count}")


if __name__ == "__main__":
    asyncio.run(migrate())
