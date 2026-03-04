
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def fix_ownership():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    # Get the user ID
    user = await db.users.find_one({"email": "Abcd123@gmail.com"})
    if not user:
        print("User Abcd123@gmail.com not found!")
        return
        
    user_id = str(user["_id"])
    print(f"Target User ID: {user_id}")
    
    # Update all assistants to this user
    result = await db.assistants.update_many({}, {"$set": {"user_id": user_id}})
    print(f"Updated {result.modified_count} assistants.")
    
    # Also update chat history
    result = await db.chat_history.update_many({}, {"$set": {"user_id": user_id}})
    print(f"Updated {result.modified_count} chat history records.")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_ownership())
