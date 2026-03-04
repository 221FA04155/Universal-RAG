
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

load_dotenv()

async def check_db():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "dynamic_ai_assistant")
    
    print(f"Connecting to {mongodb_url}...")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    # List all assistants
    print("Fetching assistants...")
    cursor = db.assistants.find({})
    count = 0
    async for doc in cursor:
        count += 1
        print(f"\nAssistant {count}:")
        print(f"  Name: {doc.get('name')}")
        print(f"  Created At Type: {type(doc.get('created_at'))}")
        print(f"  Created At Value: {doc.get('created_at')}")
        
        # Check for missing fields
        missing = []
        for field in ["user_id", "assistant_id", "name", "data_source_type", "documents_count", "vector_store_path", "created_at"]:
            if field not in doc:
                missing.append(field)
        
        if missing:
            print(f"  MISSING FIELDS: {missing}")
            
    if count == 0:
        print("No assistants found in DB.")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_db())
