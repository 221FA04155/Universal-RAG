
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def check_user_assistants():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    out = []
    out.append("--- Assistants ---")
    cursor = db.assistants.find({})
    async for asst in cursor:
        out.append(f"Name: {asst.get('name')} | UID: {asst.get('user_id')}")
        
    out.append("\n--- Users ---")
    cursor = db.users.find({})
    async for user in cursor:
        out.append(f"Email: {user.get('email')} | ID: {str(user.get('_id'))}")
        
    print("\n".join(out))
    client.close()

if __name__ == "__main__":
    asyncio.run(check_user_assistants())
