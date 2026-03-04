
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

load_dotenv()

def get_password_hash(password: str) -> str:
    """Hash a password"""
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

async def reset_password():
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    
    email = "universalrag@gmail.com"
    new_password = "Universal"
    hashed_password = get_password_hash(new_password)
    
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"password_hash": hashed_password}}
    )
    
    if result.modified_count > 0:
        print(f"Successfully reset password for {email}")
    else:
        print(f"Could not find user {email} or password already matches")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(reset_password())
