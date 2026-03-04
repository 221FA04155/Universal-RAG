
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

async def list_users():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    async for user in db.users.find({}):
        print(f"User: {user['email']} | ID: {str(user['_id'])}")
    client.close()

if __name__ == "__main__":
    asyncio.run(list_users())
