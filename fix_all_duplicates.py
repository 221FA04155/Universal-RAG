
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def fix_all_duplicates():
    # Load env from backend directory if needed, otherwise try current
    load_dotenv("c:/Users/Manikanta/Desktop/Dynamic-AI-Assistant/Dynamic-AI-Assistant-BD-main/backend/.env")
    url = os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017/")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    asst_id = "ae140f99-2309-43de-af24-8741bd98130f"
    
    # Get the assistant
    assistant = await db.assistants.find_one({"assistant_id": asst_id})
    if not assistant:
        print("Assistant not found")
        return
        
    history = assistant.get("file_history", [])
    if not history:
        print("No file history found")
        return
        
    # Remove duplicates based on filename
    new_history = []
    seen_filenames = set()
    
    for entry in history:
        filename = None
        if isinstance(entry, dict):
            filename = entry.get("filename")
        elif isinstance(entry, str):
            filename = entry
            
        if filename:
            if filename not in seen_filenames:
                new_history.append(entry)
                seen_filenames.add(filename)
                print(f"Keeping: {filename}")
            else:
                print(f"Removing duplicate: {filename}")
        else:
            new_history.append(entry)
            
    # Update the database
    result = await db.assistants.update_one(
        {"assistant_id": asst_id},
        {"$set": {"file_history": new_history}}
    )
    
    if result.modified_count > 0:
        print(f"Successfully cleaned duplicates. Modified count: {result.modified_count}")
    else:
        print("No changes made (no duplicates found or already clean)")

if __name__ == "__main__":
    asyncio.run(fix_all_duplicates())
