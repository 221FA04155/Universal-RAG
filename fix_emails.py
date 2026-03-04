
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def fix_emails():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    users = await db.users.find({}).to_list(length=1000)
    for user in users:
        original_email = user['email']
        lower_email = original_email.lower().strip()
        if original_email != lower_email:
            print(f"Updating {original_email} to {lower_email}")
            # Check if lower_email already exists (to avoid duplicates)
            existing = await db.users.find_one({"email": lower_email})
            if existing:
                print(f"  Warning: {lower_email} already exists. Skipping or merging might be needed.")
            else:
                await db.users.update_one({"_id": user['_id']}, {"$set": {"email": lower_email}})
    
    print("Done fixing emails.")
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_emails())
