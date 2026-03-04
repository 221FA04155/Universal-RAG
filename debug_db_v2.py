
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def debug_db():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    print("--- USERS ---")
    async for user in db.users.find({}):
        print(f"ID: {str(user['_id'])} | Email: {user['email']}")
        
    print("\n--- ASSISTANTS ---")
    async for asst in db.assistants.find({}):
        print(f"AsstID: {asst.get('assistant_id')} | UID: {asst.get('user_id')} | Name: {asst.get('name')}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(debug_db())
