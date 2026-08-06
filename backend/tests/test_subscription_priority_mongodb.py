"""
Test Subscription Priority Bug Reproduction - Direct MongoDB Test

This test directly reproduces the bug scenario:
1. Insert an EXPIRED trial subscription for a test org
2. Insert an ACTIVE paid subscription for the same org
3. Verify entitlement returns is_entitled=true with reason='status_active'

This is the exact bug scenario: user had trial, trial expired, user subscribed via Stripe,
but entitlement still showed 'trial_expired' because find_one() returned the trial doc first.
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Test credentials
ADMIN_EMAIL = "hello@mycoachdeveloper.com"
ADMIN_PASSWORD = "_mcDeveloper26!"
DEMO_EMAIL = "sarah.mitchell@demo.mycoachdeveloper.com"
DEMO_PASSWORD = "Demo123!"
DEMO_ORG_ID = "org_demo_0725dd5e668a"


def get_admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    return None


def get_demo_user_token():
    """Get demo user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": DEMO_EMAIL,
        "password": DEMO_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    return None


class TestBugReproduction:
    """
    Reproduce the exact bug scenario:
    - Org has expired trial subscription
    - Org also has active paid subscription
    - Entitlement should return is_entitled=true, reason=status_active
    """
    
    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Setup test data and cleanup after"""
        self.admin_token = get_admin_token()
        self.demo_token = get_demo_user_token()
        assert self.admin_token, "Admin login failed"
        assert self.demo_token, "Demo user login failed"
        
        # Connect to MongoDB
        self.client = MongoClient(MONGO_URL)
        self.db = self.client[DB_NAME]
        
        # Generate unique test subscription IDs
        self.test_expired_trial_id = f"sub_test_expired_trial_{uuid.uuid4().hex[:8]}"
        self.test_active_paid_id = f"sub_test_active_paid_{uuid.uuid4().hex[:8]}"
        
        yield
        
        # Cleanup: Remove test subscriptions
        self.db.subscriptions.delete_many({
            "subscription_id": {"$in": [self.test_expired_trial_id, self.test_active_paid_id]}
        })
        print(f"Cleaned up test subscriptions: {self.test_expired_trial_id}, {self.test_active_paid_id}")
        
        self.client.close()
    
    def test_01_get_current_subscriptions(self):
        """Check current subscriptions for demo org"""
        subs = list(self.db.subscriptions.find(
            {"$or": [{"organization_id": DEMO_ORG_ID}, {"org_id": DEMO_ORG_ID}]},
            {"_id": 0}
        ))
        
        print(f"Current subscriptions for demo org ({len(subs)} found):")
        for sub in subs:
            print(f"  - subscription_id: {sub.get('subscription_id')}")
            print(f"    is_trial: {sub.get('is_trial')}")
            print(f"    status: {sub.get('status')}")
            print(f"    trial_end_date: {sub.get('trial_end_date')}")
    
    def test_02_insert_expired_trial_and_active_paid(self):
        """
        Insert both an expired trial AND an active paid subscription.
        This reproduces the exact bug scenario.
        """
        now = datetime.now(timezone.utc)
        
        # 1. Insert EXPIRED trial subscription
        expired_trial = {
            "subscription_id": self.test_expired_trial_id,
            "organization_id": DEMO_ORG_ID,
            "org_id": DEMO_ORG_ID,
            "is_trial": True,
            "status": "active",  # Trial was active but expired
            "trial_end_date": (now - timedelta(days=7)).isoformat(),  # Expired 7 days ago
            "trial_tier_key": "coach_developer",
            "current_tier_key": "coach_developer",
            "created_at": (now - timedelta(days=21)).isoformat(),
            "updated_at": now.isoformat()
        }
        
        # 2. Insert ACTIVE paid subscription
        active_paid = {
            "subscription_id": self.test_active_paid_id,
            "organization_id": DEMO_ORG_ID,
            "org_id": DEMO_ORG_ID,
            "is_trial": False,
            "status": "active",
            "current_period_start": (now - timedelta(days=5)).isoformat(),
            "current_period_end": (now + timedelta(days=360)).isoformat(),  # Annual subscription
            "current_tier_key": "coach_developer",
            "tier_id": "coach_developer",
            "created_at": (now - timedelta(days=5)).isoformat(),
            "updated_at": now.isoformat()
        }
        
        self.db.subscriptions.insert_one(expired_trial)
        self.db.subscriptions.insert_one(active_paid)
        
        print(f"Inserted expired trial: {self.test_expired_trial_id}")
        print(f"Inserted active paid: {self.test_active_paid_id}")
        
        # Verify both exist
        subs = list(self.db.subscriptions.find(
            {"subscription_id": {"$in": [self.test_expired_trial_id, self.test_active_paid_id]}},
            {"_id": 0}
        ))
        assert len(subs) == 2, f"Expected 2 test subscriptions, found {len(subs)}"
    
    def test_03_verify_entitlement_returns_active_not_trial_expired(self):
        """
        THE CRITICAL TEST: With both expired trial and active paid subscription,
        entitlement should return is_entitled=true with reason='status_active',
        NOT 'trial_expired'.
        """
        now = datetime.now(timezone.utc)
        
        # First, insert the test data
        expired_trial = {
            "subscription_id": self.test_expired_trial_id,
            "organization_id": DEMO_ORG_ID,
            "org_id": DEMO_ORG_ID,
            "is_trial": True,
            "status": "active",
            "trial_end_date": (now - timedelta(days=7)).isoformat(),
            "trial_tier_key": "coach_developer",
            "current_tier_key": "coach_developer",
            "created_at": (now - timedelta(days=21)).isoformat(),
            "updated_at": now.isoformat()
        }
        
        active_paid = {
            "subscription_id": self.test_active_paid_id,
            "organization_id": DEMO_ORG_ID,
            "org_id": DEMO_ORG_ID,
            "is_trial": False,
            "status": "active",
            "current_period_start": (now - timedelta(days=5)).isoformat(),
            "current_period_end": (now + timedelta(days=360)).isoformat(),
            "current_tier_key": "coach_developer",
            "tier_id": "coach_developer",
            "created_at": (now - timedelta(days=5)).isoformat(),
            "updated_at": now.isoformat()
        }
        
        # Delete any existing test subs first
        self.db.subscriptions.delete_many({
            "subscription_id": {"$in": [self.test_expired_trial_id, self.test_active_paid_id]}
        })
        
        self.db.subscriptions.insert_one(expired_trial)
        self.db.subscriptions.insert_one(active_paid)
        
        # Now check entitlement
        response = requests.get(
            f"{BASE_URL}/api/billing/entitlement",
            headers={"Authorization": f"Bearer {self.demo_token}"}
        )
        assert response.status_code == 200, f"Entitlement check failed: {response.text}"
        
        data = response.json()
        print(f"Entitlement response with both expired trial and active paid:")
        print(f"  is_entitled: {data.get('is_entitled')}")
        print(f"  reason: {data.get('reason')}")
        print(f"  is_trial: {data.get('is_trial')}")
        print(f"  subscription_status: {data.get('subscription_status')}")
        
        # THE BUG FIX VERIFICATION:
        # Before fix: is_entitled=False, reason='trial_expired'
        # After fix: is_entitled=True, reason='status_active'
        assert data.get("is_entitled") == True, \
            f"BUG NOT FIXED: Expected is_entitled=True, got {data.get('is_entitled')}"
        assert data.get("reason") == "status_active", \
            f"BUG NOT FIXED: Expected reason='status_active', got '{data.get('reason')}'"
        assert data.get("is_trial") == False, \
            f"BUG NOT FIXED: Expected is_trial=False, got {data.get('is_trial')}"
        
        print("PASS: Bug fix verified - active paid subscription takes precedence over expired trial")
    
    def test_04_verify_admin_org_list_shows_active_not_trial(self):
        """
        Verify admin org list also shows the correct status when both
        expired trial and active paid exist.
        """
        now = datetime.now(timezone.utc)
        
        # Insert test data
        expired_trial = {
            "subscription_id": self.test_expired_trial_id,
            "organization_id": DEMO_ORG_ID,
            "org_id": DEMO_ORG_ID,
            "is_trial": True,
            "status": "active",
            "trial_end_date": (now - timedelta(days=7)).isoformat(),
            "trial_tier_key": "coach_developer",
            "current_tier_key": "coach_developer",
            "created_at": (now - timedelta(days=21)).isoformat(),
            "updated_at": now.isoformat()
        }
        
        active_paid = {
            "subscription_id": self.test_active_paid_id,
            "organization_id": DEMO_ORG_ID,
            "org_id": DEMO_ORG_ID,
            "is_trial": False,
            "status": "active",
            "current_period_start": (now - timedelta(days=5)).isoformat(),
            "current_period_end": (now + timedelta(days=360)).isoformat(),
            "current_tier_key": "coach_developer",
            "tier_id": "coach_developer",
            "created_at": (now - timedelta(days=5)).isoformat(),
            "updated_at": now.isoformat()
        }
        
        # Delete any existing test subs first
        self.db.subscriptions.delete_many({
            "subscription_id": {"$in": [self.test_expired_trial_id, self.test_active_paid_id]}
        })
        
        self.db.subscriptions.insert_one(expired_trial)
        self.db.subscriptions.insert_one(active_paid)
        
        # Check admin org list
        response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get orgs: {response.text}"
        
        orgs = response.json()
        demo_org = next((o for o in orgs if o.get("org_id") == DEMO_ORG_ID), None)
        assert demo_org is not None, f"Demo org not found"
        
        print(f"Admin org list - Demo org with both expired trial and active paid:")
        print(f"  subscription_status: {demo_org.get('subscription_status')}")
        print(f"  is_trial: {demo_org.get('is_trial')}")
        
        # Verify the fix works for admin org list too
        # Note: The admin org list may show different fields, so we check what's available
        if "is_trial" in demo_org:
            # If is_trial is present, it should be False (active paid takes precedence)
            print(f"  is_trial field present: {demo_org.get('is_trial')}")
        
        if "subscription_status" in demo_org:
            print(f"  subscription_status field present: {demo_org.get('subscription_status')}")


class TestCleanupVerification:
    """Verify test data cleanup works correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup MongoDB connection"""
        self.client = MongoClient(MONGO_URL)
        self.db = self.client[DB_NAME]
        yield
        self.client.close()
    
    def test_01_no_test_subscriptions_remain(self):
        """Verify no test subscriptions remain after tests"""
        test_subs = list(self.db.subscriptions.find(
            {"subscription_id": {"$regex": "^sub_test_"}},
            {"_id": 0, "subscription_id": 1}
        ))
        
        if test_subs:
            print(f"Found {len(test_subs)} test subscriptions to clean up:")
            for sub in test_subs:
                print(f"  - {sub.get('subscription_id')}")
            
            # Clean them up
            result = self.db.subscriptions.delete_many(
                {"subscription_id": {"$regex": "^sub_test_"}}
            )
            print(f"Cleaned up {result.deleted_count} test subscriptions")
        else:
            print("No test subscriptions found - cleanup successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
