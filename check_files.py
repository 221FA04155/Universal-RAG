
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def check_uploaded_files():
    load_dotenv("c:/Users/Manikanta/Desktop/Dynamic-AI-Assistant/Dynamic-AI-Assistant-BD-main/backend/.env")
    url = os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017/")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    asst_id = "ae140f99-2309-43de-af24-8741bd98130f"
    assistant = await db.assistants.find_one({"assistant_id": asst_id})
    if assistant:
        uploaded_files = assistant.get("uploaded_files", [])
        print(f"Uploaded Files for {asst_id}: {uploaded_files}")
        
        # Also let's check for any other assistants for this user
        user_id = assistant.get("user_id")
        print(f"Checking for other assistants for user: {user_id}")
        async for asst in db.assistants.find({"user_id": user_id}):
             print(f" - Assistant {asst['assistant_id']} ({asst['name']}): {asst.get('uploaded_files', [])}")
    else:
        print("Assistant not found")

if __name__ == "__main__":
    asyncio.run(check_uploaded_files())
