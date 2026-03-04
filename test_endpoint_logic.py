import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime
from dotenv import load_dotenv
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

# Mocking the models for printing
class AssistantInfo(BaseModel):
    assistant_id: str
    name: str
    data_source_type: str
    custom_instructions: str
    documents_count: int
    enable_statistics: bool
    enable_alerts: bool
    enable_recommendations: bool
    attributes: List[str] = []
    sample_questions: List[str] = []
    uploaded_files: List[str] = []
    file_history: List[Dict[str, Any]] = []
    graph_data: Dict[str, Any] = {}
    created_at: str

async def test_endpoint():
    load_dotenv()
    url = os.getenv("MONGODB_URL", "mongodb://127.0.0.1:27017/")
    db_name = os.getenv("DATABASE_NAME", "dynamic_assistant_db")
    client = AsyncIOMotorClient(url)
    db = client[db_name]
    
    asst_id = "ae140f99-2309-43de-af24-8741bd98130f"
    user_id = "699560a7dc3ad91364813ac4" # From logs
    
    doc = await db.assistants.find_one({"assistant_id": asst_id, "user_id": user_id})
    if not doc:
        print("Not found")
        return

    # Similar logic to main.py:get_assistant_info
    graph_data = doc.get('graph_data', {})
    
    # If it's empty, main.py adds mock data
    if not graph_data:
        graph_data = {"mock": "data"} # Simplified

    info = AssistantInfo(
        assistant_id=doc['assistant_id'],
        name=doc['name'],
        data_source_type=doc['data_source_type'],
        custom_instructions=doc['custom_instructions'],
        documents_count=doc.get('documents_count', 0),
        enable_statistics=doc.get('enable_statistics', False),
        enable_alerts=doc.get('enable_alerts', False),
        enable_recommendations=doc.get('enable_recommendations', False),
        attributes=doc.get('attributes', []),
        sample_questions=doc.get('sample_questions', []),
        uploaded_files=doc.get('uploaded_files', []),
        file_history=doc.get('file_history', []),
        graph_data=graph_data,
        created_at=doc['created_at'].isoformat()
    )
    
    print(info.model_dump_json(indent=2))

if __name__ == "__main__":
    asyncio.run(test_endpoint())
