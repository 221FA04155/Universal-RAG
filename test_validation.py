
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from backend.database.models import AssistantInDB
from pydantic import ValidationError

load_dotenv()

async def check_validation():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    cursor = db.assistants.find({})
    async for doc in cursor:
        print(f"Checking assistant: {doc.get('name')} (ID: {doc.get('assistant_id')})")
        doc["_id"] = str(doc["_id"])
        try:
            AssistantInDB(**doc)
            print("  - Validation PASSED")
        except ValidationError as e:
            print("  - Validation FAILED")
            print(f"  - Error: {e}")
            
    client.close()

if __name__ == "__main__":
    asyncio.run(check_validation())
