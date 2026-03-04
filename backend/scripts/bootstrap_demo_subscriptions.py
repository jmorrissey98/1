"""
Bootstrap Demo Subscriptions
============================
This script creates active subscription records for demo accounts,
making them usable in both preview and production environments.

Fixes the issue where demo accounts were created without subscriptions,
causing the "Subscription Required" modal to appear incorrectly.
"""

import os
import sys
import uuid
import bcrypt
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

# Real Stripe Price IDs from subscription_config.py
STRIPE_PRICE_IDS = {
    "individual_coach": {
        "monthly": "price_1T7Kgy0YRwRcrAVxBwbIvDOD",
        "annual": "price_1T7Kg80YRwRcrAVxMEuEDVjn"
    },
    "coach_developer": {
        "monthly": "price_1T7KeW0YRwRcrAVxg2SJo8RJ",
        "annual": "price_1T7KcY0YRwRcrAVxko7tQMGN"
    },
    "club": {
        "monthly": "price_1T3yMN0YRwRcrAVx7HCM1cI9",
        "annual": "price_1T4jkp0YRwRcrAVxAkntx6Q4"
    }
}

def create_subscription_record(org_id, tier_key, billing_period="annual"):
    """Create an active subscription record for an organization"""
    now = datetime.now(timezone.utc)
    # Set period end to 1 year from now
    period_end = now + timedelta(days=365)
    
    price_id = STRIPE_PRICE_IDS.get(tier_key, {}).get(billing_period)
    
    subscription = {
        "subscription_id": f"sub_demo_{generate_id()}",  # Demo subscription ID
        "organization_id": org_id,
        "org_id": org_id,
        "customer_id": f"cus_demo_{generate_id()}",
        "tier_id": tier_key,
        "price_id": price_id,
        "status": "active",
        "cancel_at_period_end": False,
        "current_period_start": now.isoformat(),
        "current_period_end": period_end.isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        # New tier system fields
        "current_tier_key": tier_key,
        "is_legacy_tier": False,
        "legacy_tier_key": None,
        "pending_tier_key": None,
        "is_demo": True  # Mark as demo subscription
    }
    
    return subscription


def create_demo_accounts():
    """Create or update demo accounts with proper subscriptions"""
    print("\n" + "="*60)
    print("BOOTSTRAPPING DEMO SUBSCRIPTIONS")
    print("="*60)
    
    # Demo account configurations
    demo_accounts = [
        {
            "email": "demo.coachdeveloper@mycoachdeveloper.com",
            "password": "DemoCD2024!",
            "name": "Demo Coach Developer",
            "role": "coach_developer",
            "tier": "coach_developer",
            "org_name": "Demo Coach Developer Organization"
        },
        {
            "email": "demo.individualcoach@mycoachdeveloper.com", 
            "password": "DemoIC2024!",
            "name": "Demo Individual Coach",
            "role": "coach_developer",  # Individual coach tier user is still coach_developer role
            "tier": "individual_coach",
            "org_name": "Demo Individual Coach Organization"
        }
    ]
    
    for account in demo_accounts:
        print(f"\n--- Processing: {account['email']} ---")
        
        # Find or create user
        user = db.users.find_one({"email": account["email"]})
        
        if user:
            print(f"  User exists: {user.get('user_id')}")
            user_id = user["user_id"]
            org_id = user.get("organization_id")
            
            # Update password to ensure it's correct
            db.users.update_one(
                {"user_id": user_id},
                {"$set": {"password_hash": hash_password(account["password"])}}
            )
            print(f"  Password updated")
        else:
            # Create new user
            user_id = f"user_{generate_id()}"
            org_id = f"org_demo_{generate_id()}"
            
            # Create organization first
            org_doc = {
                "org_id": org_id,
                "club_name": account["org_name"],
                "owner_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "subscription_tier_id": account["tier"]  # Legacy field for backup
            }
            db.organizations.insert_one(org_doc)
            print(f"  Created organization: {org_id}")
            
            # Create user
            user_doc = {
                "user_id": user_id,
                "email": account["email"],
                "name": account["name"],
                "password_hash": hash_password(account["password"]),
                "role": account["role"],
                "organization_id": org_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "terms_accepted_at": datetime.now(timezone.utc).isoformat()
            }
            db.users.insert_one(user_doc)
            print(f"  Created user: {user_id}")
        
        # Ensure organization has subscription_tier_id for legacy fallback
        if org_id:
            db.organizations.update_one(
                {"org_id": org_id},
                {"$set": {"subscription_tier_id": account["tier"]}}
            )
        
        # Create or update subscription
        if org_id:
            # Check if subscription exists
            existing_sub = db.subscriptions.find_one({"organization_id": org_id})
            
            if existing_sub:
                # Update existing subscription to be active
                db.subscriptions.update_one(
                    {"organization_id": org_id},
                    {"$set": {
                        "status": "active",
                        "tier_id": account["tier"],
                        "current_tier_key": account["tier"],
                        "is_legacy_tier": False,
                        "current_period_end": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                print(f"  Updated subscription to active")
            else:
                # Create new subscription
                sub_doc = create_subscription_record(org_id, account["tier"])
                db.subscriptions.insert_one(sub_doc)
                print(f"  Created subscription: {sub_doc['subscription_id']}")
        
        print(f"  DONE - {account['email']} ready with {account['tier']} tier")
    
    return demo_accounts


def bootstrap_riverside_academy():
    """Bootstrap the Riverside Football Academy demo organization with active subscription"""
    print("\n" + "="*60)
    print("BOOTSTRAPPING RIVERSIDE FOOTBALL ACADEMY")
    print("="*60)
    
    # Find the Riverside org
    riverside_org = db.organizations.find_one({"club_name": "Riverside Football Academy"})
    
    if not riverside_org:
        print("  Riverside Football Academy not found. Run seed_demo_data.py first.")
        return None
    
    org_id = riverside_org["org_id"]
    print(f"  Found org: {org_id}")
    
    # Check if subscription exists
    existing_sub = db.subscriptions.find_one({"organization_id": org_id})
    
    if existing_sub:
        # Update to active club tier
        db.subscriptions.update_one(
            {"organization_id": org_id},
            {"$set": {
                "status": "active",
                "tier_id": "club",
                "current_tier_key": "club",
                "is_legacy_tier": False,
                "current_period_end": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "subscription_id": existing_sub.get("subscription_id") or f"sub_demo_{generate_id()}"
            }}
        )
        print(f"  Updated Riverside subscription to Club tier")
    else:
        # Create club subscription
        sub_doc = create_subscription_record(org_id, "club")
        db.subscriptions.insert_one(sub_doc)
        print(f"  Created Club subscription: {sub_doc['subscription_id']}")
    
    # Also set legacy fallback on org
    db.organizations.update_one(
        {"org_id": org_id},
        {"$set": {"subscription_tier_id": "club"}}
    )
    
    # Get all users in Riverside org
    riverside_users = list(db.users.find({"organization_id": org_id}))
    print(f"  Found {len(riverside_users)} users in Riverside org")
    
    # Update passwords for all users to a known value
    default_password = "Demo123!"
    for user in riverside_users:
        db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"password_hash": hash_password(default_password)}}
        )
    print(f"  Updated all {len(riverside_users)} user passwords to: {default_password}")
    
    return org_id


def print_summary():
    """Print summary of all demo accounts"""
    print("\n" + "="*60)
    print("DEMO ACCOUNTS SUMMARY")
    print("="*60)
    
    print("\n--- Individual Demo Accounts ---")
    demo_emails = [
        "demo.coachdeveloper@mycoachdeveloper.com",
        "demo.individualcoach@mycoachdeveloper.com"
    ]
    
    for email in demo_emails:
        user = db.users.find_one({"email": email})
        if user:
            org_id = user.get("organization_id")
            sub = db.subscriptions.find_one({"organization_id": org_id})
            org = db.organizations.find_one({"org_id": org_id})
            
            print(f"\n  Email: {email}")
            print(f"  Org: {org.get('club_name') if org else 'N/A'}")
            print(f"  Tier: {sub.get('current_tier_key') if sub else 'N/A'}")
            print(f"  Status: {sub.get('status') if sub else 'NO SUBSCRIPTION'}")
    
    print("\n--- Riverside Football Academy ---")
    riverside_org = db.organizations.find_one({"club_name": "Riverside Football Academy"})
    if riverside_org:
        org_id = riverside_org["org_id"]
        sub = db.subscriptions.find_one({"organization_id": org_id})
        user_count = db.users.count_documents({"organization_id": org_id})
        
        print(f"\n  Org ID: {org_id}")
        print(f"  Club: Riverside Football Academy")
        print(f"  Tier: {sub.get('current_tier_key') if sub else 'N/A'}")
        print(f"  Status: {sub.get('status') if sub else 'NO SUBSCRIPTION'}")
        print(f"  Users: {user_count}")
        print(f"  Password for all users: Demo123!")
        
        # List some users
        users = list(db.users.find({"organization_id": org_id}).limit(5))
        print(f"\n  Sample accounts:")
        for u in users:
            print(f"    - {u.get('email')} ({u.get('role')})")
        if user_count > 5:
            print(f"    ... and {user_count - 5} more")
    else:
        print("  Riverside Football Academy not found")
    
    print("\n" + "="*60)
    print("All demo accounts are ready!")
    print("="*60)


def main():
    print("="*60)
    print("DEMO SUBSCRIPTION BOOTSTRAP SCRIPT")
    print("="*60)
    print(f"\nDatabase: {DB_NAME}")
    print(f"MongoDB: {MONGO_URL}\n")
    
    # Create individual demo accounts with subscriptions
    create_demo_accounts()
    
    # Bootstrap Riverside Football Academy
    bootstrap_riverside_academy()
    
    # Print summary
    print_summary()


if __name__ == "__main__":
    main()
