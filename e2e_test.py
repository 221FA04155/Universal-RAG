
import requests
import time
import uuid

BASE_URL = "http://localhost:8000"
EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
PASSWORD = "Password123!"

session = requests.Session()

def test_health():
    print("Testing /health ...")
    resp = session.get(f"{BASE_URL}/health")
    assert resp.status_code == 200
    print("Health OK")

def test_signup():
    print(f"Testing /api/auth/signup with {EMAIL} ...")
    payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    resp = session.post(f"{BASE_URL}/api/auth/signup", json=payload)
    print(f"Status: {resp.status_code}, Body: {resp.text}")
    assert resp.status_code == 201
    print("Signup OK")

def test_login():
    print("Testing /api/auth/login ...")
    payload = {
        "email": EMAIL,
        "password": PASSWORD
    }
    resp = session.post(f"{BASE_URL}/api/auth/login", json=payload)
    print(f"Status: {resp.status_code}, Cookies: {session.cookies.get_dict()}")
    assert resp.status_code == 200
    print("Login OK")

def test_create_assistant():
    print("Testing /api/assistants/create ...")
    data = {
        "name": "Iris Test Assistant",
        "data_source_type": "url",
        "data_source_url": "https://raw.githubusercontent.com/dataprofessor/data/master/iris.csv",
        "custom_instructions": "You are a helpful assistant specialized in Iris flowers.",
        "enable_statistics": "false",
        "enable_alerts": "false",
        "enable_recommendations": "false"
    }
    # Note: backend uses Form data
    resp = session.post(f"{BASE_URL}/api/assistants/create", data=data)
    print(f"Status: {resp.status_code}, Body: {resp.text}")
    assert resp.status_code == 200
    res_json = resp.json()
    assistant_id = res_json["assistant_id"]
    print(f"Assistant created: {assistant_id}")
    return assistant_id

def test_chat(assistant_id):
    print(f"Testing /api/chat for assistant {assistant_id} ...")
    # Wait for vector index to be built in background
    print("Waiting 10 seconds for vector index...")
    time.sleep(10)
    
    payload = {
        "assistant_id": assistant_id,
        "message": "What are the unique species in this dataset?",
        "model_id": "llama-3.3-70b-versatile"
    }
    resp = session.post(f"{BASE_URL}/api/chat", json=payload)
    print(f"Status: {resp.status_code}, Body: {resp.text}")
    assert resp.status_code == 200
    res_json = resp.json()
    response_text = res_json["assistant_response"]
    print(f"AI Response: {response_text}")
    
    # Check if response makes sense for Iris dataset
    found = any(s in response_text.lower() for s in ["setosa", "versicolor", "virginica", "iris"])
    assert found
    print("Chat OK")

def test_get_assistant(assistant_id):
    print(f"Testing /api/assistants/{assistant_id} ...")
    resp = session.get(f"{BASE_URL}/api/assistants/{assistant_id}")
    print(f"Status: {resp.status_code}")
    assert resp.status_code == 200
    res_json = resp.json()
    assert res_json["assistant_id"] == assistant_id
    assert "graph_data" in res_json
    print("Get Assistant Info OK")

def test_insights():
    print("Testing /api/insights ...")
    resp = session.get(f"{BASE_URL}/api/insights?time_range=7d")
    print(f"Status: {resp.status_code}")
    assert resp.status_code == 200
    print("Insights OK")

if __name__ == "__main__":
    try:
        test_health()
        test_signup()
        test_login()
        asst_id = test_create_assistant()
        test_get_assistant(asst_id)
        test_insights()
        test_chat(asst_id)
        print("\nALL E2E TESTS PASSED SUCCESSFULLY!")
    except Exception as e:
        print(f"\nTEST FAILED: {str(e)}")
        import traceback
        traceback.print_exc()
