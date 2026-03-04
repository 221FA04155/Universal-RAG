
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def verify_history():
    load_dotenv("c:/Users/Manikanta/Desktop/Dynamic-AI-Assistant/Dynamic-AI-Assistant-BD-main/backend/.env")
    url = os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017/")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    asst_id = "ae140f99-2309-43de-af24-8741bd98130f"
    assistant = await db.assistants.find_one({"assistant_id": asst_id})
    if assistant:
        history = assistant.get("file_history", [])
        print(f"Current History for {asst_id}:")
        for entry in history:
            print(f" - {entry}")
    else:
        print("Assistant not found")

if __name__ == "__main__":
    asyncio.run(verify_history())
