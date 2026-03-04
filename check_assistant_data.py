import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def check():
    load_dotenv()
    url = os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017/")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    # Get latest assistant
    assistant = await db.assistants.find_one(sort=[("created_at", -1)])
    if assistant:
        print(f"Assistant Name: {assistant.get('name')}")
        print(f"Assistant ID: {assistant.get('assistant_id')}")
        print(f"Sample Questions: {assistant.get('sample_questions')}")
        print(f"Graph Data Keys: {list(assistant.get('graph_data', {}).keys())}")
        print(f"Attributes Count: {len(assistant.get('attributes', []))}")
    else:
        print("No assistant found")

if __name__ == "__main__":
    asyncio.run(check())
