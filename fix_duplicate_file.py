import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

async def fix_duplicates():
    load_dotenv()
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
        
    # Filter out duplicates of cotton_mix.json
    new_history = []
    seen_cotton_mix = False
    
    for entry in history:
        if isinstance(entry, dict) and entry.get("filename") == "cotton_mix.json":
            if not seen_cotton_mix:
                new_history.append(entry)
                seen_cotton_mix = True
                print("Kept first instance of cotton_mix.json")
            else:
                print("Removing duplicate instance of cotton_mix.json")
        else:
            new_history.append(entry)
            
    # Update the database
    result = await db.assistants.update_one(
        {"assistant_id": asst_id},
        {"$set": {"file_history": new_history}}
    )
    
    if result.modified_count > 0:
        print(f"Successfully removed duplicate. Modified count: {result.modified_count}")
    else:
        print("No changes made (perhaps no duplicate found)")

if __name__ == "__main__":
    asyncio.run(fix_duplicates())
