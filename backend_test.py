import requests
import sys
import json
from datetime import datetime

class CoachDeveloperAPITester:
    def __init__(self, base_url="https://coaching-sync-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:500]}")

            return success, response.json() if success and response.text else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test("Root API Endpoint", "GET", "", 200)

    def test_status_create(self):
        """Test creating a status check"""
        test_data = {
            "client_name": f"test_client_{datetime.now().strftime('%H%M%S')}"
        }
        return self.run_test("Create Status Check", "POST", "status", 200, data=test_data)

    def test_status_get(self):
        """Test getting status checks"""
        return self.run_test("Get Status Checks", "GET", "status", 200)

    def test_ai_summary_generation(self):
        """Test AI summary generation with realistic coaching data"""
        test_data = {
            "session_name": "Test Coaching Session",
            "total_duration": 3600,  # 1 hour
            "total_events": 25,
            "ball_rolling_time": 2400,  # 40 minutes
            "ball_not_rolling_time": 1200,  # 20 minutes
            "event_breakdown": {
                "Command": 8,
                "Q&A": 12,
                "Guided Discovery": 5
            },
            "descriptor1_name": "Content Focus",
            "descriptor1_breakdown": {
                "Technical": 10,
                "Tactical": 8,
                "Physical": 4,
                "Psych": 2,
                "Social": 1
            },
            "descriptor2_name": "Delivery Method", 
            "descriptor2_breakdown": {
                "Visual Demo": 6,
                "Triggers": 12,
                "Kinesthetic": 7
            },
            "session_parts": [
                {"name": "Part 1", "events": 8, "ballRollingPct": 75},
                {"name": "Part 2", "events": 10, "ballRollingPct": 65},
                {"name": "Part 3", "events": 5, "ballRollingPct": 80},
                {"name": "Part 4", "events": 2, "ballRollingPct": 60}
            ],
            "user_notes": "Coach showed good energy and clear communication. Players were engaged throughout most of the session."
        }
        
        print(f"   Testing AI summary with sample coaching data...")
        success, response = self.run_test("AI Summary Generation", "POST", "generate-summary", 200, data=test_data)
        
        if success and 'summary' in response:
            summary = response['summary']
            print(f"   ✅ AI Summary generated successfully")
            print(f"   Summary length: {len(summary)} characters")
            print(f"   Summary preview: {summary[:150]}...")
            
            # Check if summary contains expected elements
            expected_elements = ['session', 'coaching', 'ball', 'events']
            found_elements = [elem for elem in expected_elements if elem.lower() in summary.lower()]
            print(f"   Found expected elements: {found_elements}")
            
            return True, response
        else:
            print(f"   ❌ AI Summary generation failed or missing summary field")
            return False, response

    def test_ai_summary_with_empty_data(self):
        """Test AI summary generation with minimal data"""
        test_data = {
            "session_name": "Empty Test Session",
            "total_duration": 0,
            "total_events": 0,
            "ball_rolling_time": 0,
            "ball_not_rolling_time": 0,
            "event_breakdown": {},
            "descriptor1_name": "Content Focus",
            "descriptor1_breakdown": {},
            "descriptor2_name": "Delivery Method",
            "descriptor2_breakdown": {},
            "session_parts": [],
            "user_notes": ""
        }
        
        return self.run_test("AI Summary with Empty Data", "POST", "generate-summary", 200, data=test_data)

    def test_ai_summary_missing_fields(self):
        """Test AI summary generation with missing required fields"""
        test_data = {
            "session_name": "Incomplete Test Session"
            # Missing required fields
        }
        
        # This should fail with 422 (validation error) or 400 (bad request)
        success, response = self.run_test("AI Summary Missing Fields", "POST", "generate-summary", 422, data=test_data)
        if not success:
            # Try 400 as alternative expected status
            success, response = self.run_test("AI Summary Missing Fields (400)", "POST", "generate-summary", 400, data=test_data)
        return success, response

def main():
    print("🚀 Starting My Coach Developer API Tests")
    print("=" * 50)
    
    # Setup
    tester = CoachDeveloperAPITester()
    
    # Run basic API tests
    print("\n📡 Testing Basic API Endpoints...")
    tester.test_root_endpoint()
    tester.test_status_create()
    tester.test_status_get()
    
    # Run AI Summary tests
    print("\n🤖 Testing AI Summary Generation...")
    tester.test_ai_summary_generation()
    tester.test_ai_summary_with_empty_data()
    tester.test_ai_summary_missing_fields()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())