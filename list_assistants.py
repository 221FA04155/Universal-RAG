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
    
    cursor = db.assistants.find().sort("created_at", -1)
    async for asst in cursor:
        print(f"Name: {asst.get('name')} | ID: {asst.get('assistant_id')}")
        print(f"  Questions: {len(asst.get('sample_questions', []))}")
        print(f"  Graph Data: {bool(asst.get('graph_data'))}")
        print(f"  Files: {asst.get('uploaded_files')}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(check())
