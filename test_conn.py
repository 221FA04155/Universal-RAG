
import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_connection():
    session = requests.Session()
    try:
        # 1. Health check
        print("Checking health...")
        resp = session.get(f"{BASE_URL}/health")
        print(f"Health status: {resp.status_code}")
        print(f"Health response: {resp.json()}")

        # 2. Try Signup
        print("\nTrying Signup...")
        email = "test_user_antigravity@example.com"
        password = "password123"
        signup_data = {"email": email, "password": password}
        resp = session.post(f"{BASE_URL}/api/auth/signup", json=signup_data)
        print(f"Signup status: {resp.status_code}")
        if resp.status_code != 201:
            print(f"Signup failed or already exists: {resp.text}")

        # 3. Try Login
        print("\nTrying Login...")
        login_data = {"email": email, "password": password}
        resp = session.post(f"{BASE_URL}/api/auth/login", json=login_data)
        print(f"Login status: {resp.status_code}")
        print(f"Login response: {resp.json()}")

        # 4. Check auth session
        print("\nChecking /api/auth/check with session cookie...")
        resp = session.get(f"{BASE_URL}/api/auth/check")
        print(f"Auth check status: {resp.status_code}")
        print(f"Auth check response: {resp.json()}")

        # 5. List assistants
        print("\nListing assistants...")
        resp = session.get(f"{BASE_URL}/api/assistants")
        print(f"List assistants status: {resp.status_code}")
        if resp.status_code == 200:
            print(f"Found {len(resp.json())} assistants")
        
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_connection()
