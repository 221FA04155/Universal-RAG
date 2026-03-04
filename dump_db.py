
import asyncio
import os
import json
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return super().default(o)

async def dump_db():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    data = {
        "users": await db.users.find({}).to_list(length=100),
        "assistants": await db.assistants.find({}).to_list(length=100)
    }
    
    with open("c:/Users/Manikanta/Desktop/Dynamic-AI-Assistant/db_dump.json", "w") as f:
        json.dump(data, f, cls=JSONEncoder, indent=2)
        
    client.close()

if __name__ == "__main__":
    asyncio.run(dump_db())
