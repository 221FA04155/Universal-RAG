from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from typing import Dict, Optional
import uuid
import os
import logging
from datetime import datetime
from dotenv import load_dotenv
import shutil
import anyio
from sse_starlette.sse import EventSourceResponse
from backend.s3_storage import S3Manager
import tempfile
import io
import traceback

from backend.models import (
    AssistantCreateRequest,
    AssistantCreateResponse,
    ChatRequest,
    ChatResponse,
    AssistantInfo,
    ErrorResponse,
    HealthResponse,
    DataSourceType
)
from backend.assistant_engine import AssistantEngine
from backend.data_loader import DataLoader
from backend.vector_store import VectorStoreManager
from backend.database.mongodb import connect_to_mongo, close_mongo_connection
from backend.database import crud
from backend.auth.dependencies import get_current_user
from backend.routes import auth
from backend.database.models import UserInDB

load_dotenv()

# Configure logging
file_handler = logging.FileHandler("c:/Users/Manikanta/Desktop/Dynamic-AI-Assistant/live_backend.log")
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))

logging.basicConfig(
    level=logging.INFO,
    handlers=[
        file_handler,
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Also capture uvicorn access logs
logging.getLogger("uvicorn.access").addHandler(file_handler)
logging.getLogger("uvicorn.error").addHandler(file_handler)

app = FastAPI(
    title="Dynamic AI Assistant API",
    description="Create and chat with custom AI assistants dynamically",
    version="1.0.0"
)

# Add MongoDB lifecycle events
@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",

    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth router
app.include_router(auth.router)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL_NAME = os.getenv("GROQ_MODEL_NAME", "llama-3.3-70b-versatile")
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "100"))
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

if not GROQ_API_KEY:
    logger.error("GROQ_API_KEY not found in environment variables")
    raise ValueError("GROQ_API_KEY must be set in .env file")

try:
    vector_store_manager = VectorStoreManager() # Init first to ensure shared embeddings
    assistant_engine = AssistantEngine(
        groq_api_key=GROQ_API_KEY,
        model_name=GROQ_MODEL_NAME,
        vector_store_manager=vector_store_manager
    )
    data_loader = DataLoader()
    logger.info("Assistant engine initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize assistant engine: {str(e)}")
    raise

assistants_store: Dict[str, Dict] = {}



@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat()
    )


@app.post("/api/assistants/create", response_model=AssistantCreateResponse)
async def create_assistant(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    data_source_type: str = Form(..., regex="^(csv|json|pdf|doc|docx|txt|url)$"),
    data_source_url: Optional[str] = Form(None),
    custom_instructions: str = Form(
        "You are a helpful AI assistant. Analyze the data and answer questions. If a question is not related to the provided data or uploaded documents, respond with: \"This question is not related to the provided data or uploaded documents.\""
    ),
    enable_statistics: bool = Form(False),
    enable_alerts: bool = Form(False),
    enable_recommendations: bool = Form(False),
    file: Optional[UploadFile] = File(None),
    current_user: UserInDB = Depends(get_current_user)
):
    try:
        logger.info(f"Creating assistant: {name} for user: {current_user.email}")
        
        if data_source_type not in ["csv", "json", "url", "pdf", "doc", "docx", "txt"]:
            raise HTTPException(400, f"Invalid data_source_type: {data_source_type}")
        
        assistant_id = str(uuid.uuid4())
        
        documents = []
        df = None
        file_path = None
        
        if data_source_type == "url":
            if not data_source_url:
                raise HTTPException(400, "data_source_url required for URL type")
            
            logger.info(f"Loading data from URL: {data_source_url}")
            documents, df = DataLoader.load_from_url(data_source_url)
        
        else:
            if not file:
                raise HTTPException(400, "File required for CSV/JSON type")
            
            file_size = 0
            # file.size is usually available in starlette UploadFile
            file_size = (file.size if file.size else 0) / (1024 * 1024)
            
            if file_size > MAX_FILE_SIZE_MB:
                raise HTTPException(
                    400, 
                    f"File size exceeds {MAX_FILE_SIZE_MB}MB limit"
                )
            
            # Save to temporary file using streaming to avoid memory spikes
            safe_filename = file.filename or "uploaded_file.data"
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{safe_filename}") as tmp:
                shutil.copyfileobj(file.file, tmp)
                temp_file_path = tmp.name
            
            logger.info(f"Temp file created (streaming): {temp_file_path}")
            
            try:
                # 1. Upload to S3 if configured
                s3_bucket = os.getenv("AWS_BUCKET_NAME")
                if s3_bucket:
                    logger.info("Uploading to S3 (streaming)...")
                    object_name = f"{current_user.id}/{assistant_id}_{safe_filename}"
                    s3_manager = S3Manager()
                    with open(temp_file_path, "rb") as f:
                        s3_url = s3_manager.upload_file(f, object_name)
                    data_source_url = s3_url
                else:
                    logger.info("AWS_BUCKET_NAME not set, using local storage fallback")
                    user_upload_dir = os.path.join(UPLOAD_DIR, current_user.id)
                    os.makedirs(user_upload_dir, exist_ok=True)
                    
                    permanent_filename = f"{assistant_id}_{safe_filename}"
                    permanent_path = os.path.join(user_upload_dir, permanent_filename)
                    
                    # Copy from temp to permanent
                    shutil.copy2(temp_file_path, permanent_path)
                    data_source_url = f"/api/files/{current_user.id}/{permanent_filename}"

                # 2. Process for Vector DB (using local temp file) - PHASED INDEXING
                # Immediate sample for speed (limit=1000)
                logger.info("Performing Rapid Neural Pre-scan (1,000 nodes)...")
                documents, df = await anyio.to_thread.run_sync(DataLoader.load_file, temp_file_path, 1000)
                
                # Check for empty documents
                if not documents:
                    raise HTTPException(400, "Could not extract any content from the uploaded file.")
                file_path = temp_file_path  # For graph generation
                # data_source_url is already set above
                
            except Exception as e:
                # If loading fails, clean up temp file
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
                logger.error(f"Error in file processing try block: {str(e)}")
                raise HTTPException(500, f"Error processing file: {str(e)}")
        
        if not documents:
            raise HTTPException(400, "No data could be loaded from the source")
        
        logger.info(f"Loaded {len(documents)} documents")
        
        # Inject Contextual Metadata (CRITICAL for multi-tenant isolation)
        for doc in documents:
            doc.metadata["assistant_id"] = assistant_id
            doc.metadata["user_id"] = current_user.id

        
        # Prepare initial assistant data - INSTANT response
        # Attributes are extracted from the sample for immediate UI population
        attributes = DataLoader.extract_attributes(documents)
        
        # NEW: Generate initial insights/questions from sample IMMEDIATELY for sub-second visibility
        initial_questions = DataLoader.generate_sample_questions(attributes, data_source_type)
        initial_graph = DataLoader.generate_graph_insights(None, data_source_type, df=df)
        
        assistant_data = {
            "user_id": current_user.id,
            "assistant_id": assistant_id,
            "name": name,
            "data_source_type": data_source_type,
            "data_source_url": data_source_url,
            "custom_instructions": custom_instructions,
            "enable_statistics": enable_statistics,
            "enable_alerts": enable_alerts,
            "enable_recommendations": enable_recommendations,
            "documents_count": len(documents),
            "vector_store_path": "",
            "attributes": attributes,
            "sample_questions": initial_questions, # Seeded from sample
            "uploaded_files": [file.filename] if data_source_type != "url" else [name],
            "file_history": [
                {
                    "filename": file.filename if data_source_type != "url" else name,
                    "upload_date": datetime.utcnow().isoformat(),
                    "size": file.size if data_source_type != "url" else 0
                }
            ],
            "graph_data": initial_graph, # Seeded from sample
            "created_at": datetime.utcnow().isoformat()
        }
        await crud.create_assistant(assistant_data)

        # Phase 2: Background Full Synthesis (Deep Indexing + LLM Insights)
        async def background_indexing_task(asst_id, asst_name, path_to_process, instructions, stats, alerts, recs, ds_type, sample_docs, sample_df):
             try:
                 logger.info(f"Background: Starting full analytical synthesis for {asst_id}...")
                 
                 # Step 0: Immediate LLM-based Question Generation (using Phase 1 sample)
                 # This makes "Neural Starters" highly relevant in < 3 seconds
                 logger.info(f"Background: Generating initial AI Starters for {asst_id}...")
                 ai_qs_fast = await anyio.to_thread.run_sync(assistant_engine.generate_sample_questions, attributes, sample_docs)
                 await crud.update_assistant(asst_id, current_user.id, {"sample_questions": ai_qs_fast})
                 
                 # 1. Load the FULL dataset
                 full_docs, full_df = await anyio.to_thread.run_sync(DataLoader.load_file, path_to_process)
                 
                 # 2. Extract Full Attributes & AI Questions
                 f_attrs = DataLoader.extract_attributes(full_docs)
                 ai_qs = await anyio.to_thread.run_sync(assistant_engine.generate_sample_questions, f_attrs, full_docs)
                 
                 # 3. Generate Deep Graph Insights
                 f_graph = await anyio.to_thread.run_sync(DataLoader.generate_graph_insights, path_to_process, ds_type, full_df)
                 
                 # 4. Update Database
                 u_meta = {
                     "documents_count": len(full_docs),
                     "attributes": f_attrs,
                     "sample_questions": ai_qs,
                     "graph_data": f_graph
                 }
                 await crud.update_assistant(asst_id, current_user.id, u_meta)
                 
                 # 5. Build Vector Store
                 for doc in full_docs:
                     doc.metadata["assistant_id"] = asst_id
                     doc.metadata["user_id"] = current_user.id

                 asst_cfg = await anyio.to_thread.run_sync(
                    assistant_engine.create_assistant,
                    asst_id, asst_name, full_docs, instructions,
                    stats, alerts, recs, f_attrs
                 )
                 assistants_store[asst_id] = asst_cfg
                 logger.info(f"Background: Full synthesis complete for {asst_id}")
             except Exception as bg_e:
                 logger.error(f"Background Task Failed for {asst_id}: {str(bg_e)}")
             finally:
                 if path_to_process and os.path.exists(path_to_process) and ds_type != "url":
                     os.remove(path_to_process)
                     logger.info(f"Background: Cleaned up cache: {path_to_process}")

        # Handle path for URL type (it might not have a local file if load_from_url used directly)
        # Note: load_file currently handles both local and remote if logic is set up, 
        # but here we pass temp_file_path if available.
        process_path = temp_file_path if data_source_type != "url" else data_source_url

        background_tasks.add_task(
            background_indexing_task,
            assistant_id, name, process_path, custom_instructions,
            enable_statistics, enable_alerts, enable_recommendations, data_source_type,
            documents, df # Pass sample for faster starter generation
        )
        
        logger.info(f"Assistant created (Sub-1s response): {assistant_id}")
        
        return AssistantCreateResponse(
            assistant_id=assistant_id,
            name=name,
            data_source_type=data_source_type,
            documents_loaded=len(documents),
            created_at=assistant_data["created_at"],
            message="Assistant created successfully! Neural processing continues in background."
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating assistant: {str(e)}")
        raise HTTPException(500, f"Failed to create assistant: {str(e)}")


@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_assistant(
    request: ChatRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    import time
    start_time = time.time()
    
    try:
        logger.info(f"Chat request for assistant: {request.assistant_id} by user: {current_user.email}")
        
        # Verify user owns this assistant
        assistant_db = await crud.get_assistant_by_id(request.assistant_id, current_user.id)
        if not assistant_db:
            raise HTTPException(404, "Assistant not found or access denied")
        
        # Load assistant config if not in memory
        if request.assistant_id not in assistants_store:
            load_start = time.time()
            logger.info(f"Loading assistant {request.assistant_id} from database...")
            
            # Since we are using MongoDB Vector Search, we don't need to load files 
            # and rebuild the index in memory anymore! We just connect to it.
            
            # Get access to the shared vector store
            vector_store = vector_store_manager.get_vector_store(request.assistant_id)
            
            # Build system instructions
            system_instructions = assistant_engine._build_system_instructions(
                custom_instructions=assistant_db.custom_instructions,
                enable_statistics=assistant_db.enable_statistics,
                enable_alerts=assistant_db.enable_alerts,
                enable_recommendations=assistant_db.enable_recommendations,
                attributes=getattr(assistant_db, 'attributes', [])
            )
            
            # Restore assistant config
            assistant_config = {
                "assistant_id": request.assistant_id,
                "name": assistant_db.name,
                "custom_instructions": assistant_db.custom_instructions,
                "system_instructions": system_instructions,
                "vector_store": vector_store,
                "documents_count": assistant_db.documents_count,
                "enable_statistics": assistant_db.enable_statistics,
                "enable_alerts": assistant_db.enable_alerts,
                "enable_recommendations": assistant_db.enable_recommendations,
                "created_at": assistant_db.created_at
            }
            
            assistants_store[request.assistant_id] = assistant_config
            load_time = time.time() - load_start
            logger.info(f"Assistant {request.assistant_id} loaded in {load_time:.2f}s")

        else:
            logger.info(f"Using cached assistant {request.assistant_id}")
        
        assistant_config = assistants_store[request.assistant_id]
        
        # Call LLM
        llm_start = time.time()
        
        result = assistant_engine.chat(
            assistant_config=assistant_config,
            user_message=request.message,
            history=request.history,
            model_name=request.model_id
        )
        llm_time = time.time() - llm_start
        logger.info(f"LLM response received in {llm_time:.2f}s")
        
        # Save chat history
        await crud.save_chat_message(current_user.id, request.assistant_id, "user", request.message)
        await crud.save_chat_message(current_user.id, request.assistant_id, "assistant", result["response"])
        
        total_time = time.time() - start_time
        logger.info(f"Total chat request time: {total_time:.2f}s")
        
        return ChatResponse(
            assistant_id=request.assistant_id,
            user_message=request.message,
            assistant_response=result["response"],
            sources_used=result["sources_used"],
            timestamp=result["timestamp"]
        )
    
    except Exception as e:
        logger.error(f"Error during chat: {str(e)}")
        raise HTTPException(500, f"Chat failed: {str(e)}")


@app.post("/api/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    try:
        logger.info(f"Stream chat request for assistant: {request.assistant_id}")
        
        # Verify user owns this assistant
        assistant_db = await crud.get_assistant_by_id(request.assistant_id, current_user.id)
        if not assistant_db:
            raise HTTPException(404, "Assistant not found or access denied")
            
        # Load assistant config if not in memory
        if request.assistant_id not in assistants_store:
            # Get access to the shared vector store
            vector_store = vector_store_manager.get_vector_store(request.assistant_id)
            
            system_instructions = assistant_engine._build_system_instructions(
                custom_instructions=assistant_db.custom_instructions,
                enable_statistics=assistant_db.enable_statistics,
                enable_alerts=assistant_db.enable_alerts,
                enable_recommendations=assistant_db.enable_recommendations,
                attributes=getattr(assistant_db, 'attributes', [])
            )
            
            assistants_store[request.assistant_id] = {
                "assistant_id": request.assistant_id,
                "name": assistant_db.name,
                "vector_store": vector_store,
                "system_instructions": system_instructions,
                "documents_count": assistant_db.documents_count,
                "created_at": assistant_db.created_at
            }
        
        assistant_config = assistants_store[request.assistant_id]
        
        async def wrap_generator():
            full_response = ""
            # Save User Message immediately
            await crud.save_chat_message(current_user.id, request.assistant_id, "user", request.message)
            
            async for chunk in assistant_engine.chat_stream(
                assistant_config=assistant_config,
                user_message=request.message,
                history=request.history,
                model_name=request.model_id
            ):
                import json
                try:
                    data = json.loads(chunk.strip())
                    if data.get("type") == "content":
                        full_response += data.get("data", "")
                except:
                    pass
                yield chunk
            
            # Save Assistant Message once stream is complete
            if full_response:
                await crud.save_chat_message(current_user.id, request.assistant_id, "assistant", full_response)

        return StreamingResponse(wrap_generator(), media_type="text/plain")
            
    except Exception as e:
        logger.error(f"Error during stream chat: {str(e)}")
        raise HTTPException(500, str(e))


@app.get("/api/assistants/{assistant_id}", response_model=AssistantInfo)
async def get_assistant_info(
    assistant_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    try:
        # Verify user owns this assistant
        assistant_db = await crud.get_assistant_by_id(assistant_id, current_user.id)
        if not assistant_db:
            raise HTTPException(404, "Assistant not found")
            
        # Lazy load graph data if missing (for legacy assistants)
        graph_data = getattr(assistant_db, 'graph_data', {})
        if not graph_data:
            try:
                # Try to regenerate from source file
                user_upload_dir = os.path.join(UPLOAD_DIR, current_user.id)
                if os.path.exists(user_upload_dir):
                     for file in os.listdir(user_upload_dir):
                        if file.startswith(f"{assistant_id}_"):
                            file_path = os.path.join(user_upload_dir, file)
                            documents, df = DataLoader.load_file(file_path)
                            graph_data = DataLoader.generate_graph_insights(file_path, assistant_db.data_source_type, df=df)
                            if graph_data:
                                pass
                            break
            except Exception as e:
                logger.warning(f"Failed to regenerate graph data: {e}")

        # Fallback to Mock Data if still empty
        if not graph_data:
             graph_data = {
                "bar_chart": {
                    "title": "Value Distribution",
                    "labels": ["Mock A", "Mock B", "Mock C"],
                    "values": [30, 50, 20]
                },
                "donut_chart": {
                    "title": "Category Breakdown",
                    "center_label": "3",
                    "center_text": "Types",
                    "labels": ["Type X", "Type Y", "Type Z"],
                    "values": [30, 50, 20]
                },
                 "line_chart": {
                    "title": "Data Trend",
                    "avg_value": "0.0",
                    "trend_label": "Avg Value",
                    "trend_change": "+0.0%",
                    "data_points": [10, 30, 15, 40, 20, 50, 30, 60]
                }
            }

        return AssistantInfo(
            assistant_id=assistant_db.assistant_id,
            name=assistant_db.name,
            data_source_type=assistant_db.data_source_type,
            custom_instructions=assistant_db.custom_instructions,
            documents_count=assistant_db.documents_count,
            enable_statistics=assistant_db.enable_statistics,
            enable_alerts=assistant_db.enable_alerts,
            enable_recommendations=assistant_db.enable_recommendations,
            attributes=getattr(assistant_db, 'attributes', []),
            sample_questions=getattr(assistant_db, 'sample_questions', []),
            uploaded_files=getattr(assistant_db, 'uploaded_files', []),
            file_history=getattr(assistant_db, 'file_history', []),
            graph_data=graph_data,
            created_at=assistant_db.created_at.isoformat()
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting assistant info: {str(e)}")
        raise HTTPException(500, f"Failed to get assistant info: {str(e)}")


@app.get("/api/assistants")
async def list_assistants(current_user: UserInDB = Depends(get_current_user)):
    try:
        logger.info(f"Listing assistants for user: {current_user.id} ({current_user.email})")
        # Get assistants from MongoDB for this user
        assistants = await crud.get_user_assistants(current_user.id)
        logger.info(f"Found {len(assistants)} assistants in DB")
        
        assistants_list = [
            {
                "assistant_id": asst.assistant_id,
                "name": asst.name,
                "documents_count": asst.documents_count,
                "data_source_type": asst.data_source_type,
                "uploaded_files": getattr(asst, 'uploaded_files', []),
                "file_history": getattr(asst, 'file_history', []),
                "created_at": asst.created_at.isoformat()
            }
            for asst in assistants
        ]
        
        return {"assistants": assistants_list, "count": len(assistants_list)}
    
    except Exception as e:
        logger.error(f"Error listing assistants: {str(e)}")
        raise HTTPException(500, f"Failed to list assistants: {str(e)}")


@app.delete("/api/assistants/{assistant_id}")
async def delete_assistant(
    assistant_id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    try:
        # Delete from MongoDB
        deleted = await crud.delete_assistant(assistant_id, current_user.id)
        if not deleted:
            raise HTTPException(404, "Assistant not found or access denied")
        
        # Remove from memory store
        if assistant_id in assistants_store:
            del assistants_store[assistant_id]
        
        # Delete from Vector Store (Local or Atlas)
        vector_store_manager.delete_vector_store(assistant_id)
        
        # Clean up user files
        user_upload_dir = os.path.join(UPLOAD_DIR, current_user.id)
        if os.path.exists(user_upload_dir):
            for file in os.listdir(user_upload_dir):
                if file.startswith(assistant_id):
                    os.remove(os.path.join(user_upload_dir, file))
        
        logger.info(f"Assistant deleted: {assistant_id}")
        
        return {"message": "Assistant deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting assistant: {str(e)}")
        raise HTTPException(500, f"Failed to delete assistant: {str(e)}")


@app.post("/api/assistants/{assistant_id}/upload")
async def add_documents_to_assistant(
    assistant_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_current_user)
):
    try:
        logger.info(f"Uploading more data to assistant: {assistant_id} for user: {current_user.email}")
        
        # Verify user owns this assistant
        logger.info(f"Checking ownership: Asst={assistant_id}, User={current_user.id}")
        assistant_db = await crud.get_assistant_by_id(assistant_id, current_user.id)
        if not assistant_db:
            logger.warning(f"Ownership check FAILED: Asst {assistant_id} not found for User {current_user.id}")
            raise HTTPException(404, "Assistant not found or access denied")
        
        # Determine upload directory (imported top-level)
        user_upload_dir = os.path.join(UPLOAD_DIR, current_user.id)
        os.makedirs(user_upload_dir, exist_ok=True)
        
        timestamp = int(datetime.utcnow().timestamp())
        safe_filename = file.filename or "upload"
        file_path = os.path.join(user_upload_dir, f"{assistant_id}_{timestamp}_{safe_filename}")
        
        # Use streaming write
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Load and process new documents - PHASED INDEXING
        # Initial sample for speed
        logger.info("Performing Rapid Neural Pre-scan (1,000 nodes)...")
        sample_documents, df = await anyio.to_thread.run_sync(DataLoader.load_file, file_path, 1000)
        if not sample_documents:
            raise HTTPException(400, "Could not extract content from the uploaded file")
        
        # Prepare additive logic
        current_active_files = assistant_db.uploaded_files if hasattr(assistant_db, 'uploaded_files') else []
        new_active_files = list(set(current_active_files + [file.filename]))
        
        existing_history = assistant_db.file_history if hasattr(assistant_db, 'file_history') and assistant_db.file_history else []
        # Remove existing entry if it's a duplicate to replace it with the fresh upload
        new_file_history = [f for f in existing_history if (isinstance(f, dict) and f.get("filename") != file.filename) or (isinstance(f, str) and f != file.filename)]
        new_file_history.append({
            "filename": file.filename,
            "upload_date": datetime.utcnow().isoformat(),
            "size": file.size if hasattr(file, 'size') else 0
        })
        
        # Immediate Database Update (Phased Metadata)
        attributes = DataLoader.extract_attributes(sample_documents)
        initial_questions = DataLoader.generate_sample_questions(attributes, assistant_db.data_source_type)
        initial_graph = DataLoader.generate_graph_insights(None, assistant_db.data_source_type, df=df)

        update_data = {
            "uploaded_files": new_active_files,
            "attributes": attributes,
            "file_history": new_file_history,
            "sample_questions": initial_questions, # Seed from sample
            "graph_data": initial_graph # Seed from sample
        }
        await crud.update_assistant(assistant_id, current_user.id, update_data)

        # Phase 2: Asynchronous Full Synthesis
        async def background_upload_task(asst_id, u_id, f_path, orig_name, smp_docs):
            try:
                # Step 0: Fast LLM Questions from Sample
                logger.info(f"Background: Generating initial AI Starters for {asst_id} (Upload)...")
                ai_qs_fast = await anyio.to_thread.run_sync(assistant_engine.generate_sample_questions, attributes, smp_docs)
                await crud.update_assistant(asst_id, u_id, {"sample_questions": ai_qs_fast})

                # 1. Load Whole File
                full_docs, full_df = await anyio.to_thread.run_sync(DataLoader.load_file, f_path)
                
                # 2. Extract Full AI Questions & Attributes
                f_attrs = DataLoader.extract_attributes(full_docs)
                ai_qs = await anyio.to_thread.run_sync(assistant_engine.generate_sample_questions, f_attrs, full_docs)
                
                # 3. Graph Insights
                f_ext = os.path.splitext(f_path)[1].lower().replace('.', '')
                i_type = f_ext if f_ext in ['csv', 'json'] else 'unstructured'
                f_graph = await anyio.to_thread.run_sync(DataLoader.generate_graph_insights, f_path, i_type, full_df)
                
                # 4. Update Database
                u_meta = {
                    "documents_count": (assistant_db.documents_count or 0) + len(full_docs),
                    "attributes": f_attrs,
                    "sample_questions": ai_qs,
                    "graph_data": f_graph
                }
                await crud.update_assistant(asst_id, u_id, u_meta)
                
                # 5. Build Vector Store
                for doc in full_docs:
                    doc.metadata["assistant_id"] = asst_id
                    doc.metadata["user_id"] = u_id
                    doc.metadata["filename"] = orig_name

                v_store = None
                try: v_store = vector_store_manager.get_vector_store(asst_id)
                except: pass
                
                if v_store:
                    await anyio.to_thread.run_sync(vector_store_manager.add_documents, v_store, full_docs, asst_id)
                else:
                    v_store = await anyio.to_thread.run_sync(vector_store_manager.create_vector_store, full_docs, asst_id)

                if asst_id in assistants_store:
                    # Refresh the whole config to include new attributes and vector store
                    assistants_store[asst_id].update({
                        "vector_store": v_store,
                        "documents_count": u_meta["documents_count"],
                        "system_instructions": assistant_engine._build_system_instructions(
                            assistant_db.custom_instructions,
                            assistant_db.enable_statistics,
                            assistant_db.enable_alerts,
                            assistant_db.enable_recommendations,
                            attributes=f_attrs
                        )
                    })
                
                logger.info(f"Background: Full synthesis complete for {orig_name}")
            except Exception as e:
                logger.error(f"Background Synthesis Failed for {orig_name}: {str(e)}")

        background_tasks.add_task(background_upload_task, assistant_id, current_user.id, file_path, file.filename, sample_documents)
        
        return {
            "message": f"Dataset indexed. Neural synthesis proceeding in background.",
            "filename": file.filename,
            "active_files": new_active_files
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding documents to assistant {assistant_id}: {str(e)}")
        raise HTTPException(500, f"Upload failed: {str(e)}")


@app.get("/api/assistants/{assistant_id}/chat-history")
async def get_assistant_chat_history(
    assistant_id: str,
    limit: int = 50,
    current_user: UserInDB = Depends(get_current_user)
):
    try:
        # Verify user owns this assistant
        assistant_db = await crud.get_assistant_by_id(assistant_id, current_user.id)
        if not assistant_db:
            raise HTTPException(404, "Assistant not found or access denied")
        
        # Get chat history
        messages = await crud.get_chat_history(current_user.id, assistant_id, limit)
        
        return {
            "assistant_id": assistant_id,
            "messages": messages,
            "total": len(messages)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving chat history: {str(e)}")
        raise HTTPException(500, f"Failed to retrieve chat history: {str(e)}")


@app.get("/api/insights")
async def get_insights(time_range: str = "7d", current_user: UserInDB = Depends(get_current_user)):
    """Get aggregated insights for the user"""
    try:
        insights = await crud.get_user_insights(current_user.id, time_range)
        return insights
    except Exception as e:
        logger.error(f"Error getting insights: {str(e)}")
        raise HTTPException(500, f"Failed to get insights: {str(e)}")


@app.delete("/api/assistants/{assistant_id}/files/{filename}")
async def delete_assistant_file(
    assistant_id: str,
    filename: str,
    current_user: UserInDB = Depends(get_current_user)
):
    """Delete a specific file from an assistant and re-index remaining data"""
    try:
        logger.info(f"Removing file {filename} from assistant {assistant_id}")
        
        # 1. Verify ownership
        assistant_db = await crud.get_assistant_by_id(assistant_id, current_user.id)
        if not assistant_db:
            raise HTTPException(404, "Assistant not found or access denied")
            
        current_files = assistant_db.uploaded_files if hasattr(assistant_db, 'uploaded_files') else []
        if filename not in current_files:
            raise HTTPException(404, f"File {filename} not found in this assistant")
            
        # 2. Update file list
        new_files = [f for f in current_files if f != filename]
        
        # 3. Delete physical files from disk
        user_upload_dir = os.path.join(UPLOAD_DIR, current_user.id)
        files_removed = 0
        if os.path.exists(user_upload_dir):
            for f in os.listdir(user_upload_dir):
                # Format is assistant_id_timestamp_filename or assistant_id_filename
                if f.startswith(assistant_id) and f.endswith(filename):
                    try:
                        os.remove(os.path.join(user_upload_dir, f))
                        files_removed += 1
                        logger.info(f"Physically deleted: {f}")
                    except Exception as e:
                        logger.warning(f"Failed to delete file {f}: {e}")

        # 4. Re-index remaining files
        all_new_documents = []
        new_total_docs = 0
        
        if new_files:
            logger.info(f"Re-indexing remaining {len(new_files)} files...")
            for f_name in new_files:
                # Find the latest version of this file on disk
                latest_path = None
                for disk_f in os.listdir(user_upload_dir):
                    if disk_f.startswith(assistant_id) and disk_f.endswith(f_name):
                        latest_path = os.path.join(user_upload_dir, disk_f)
                        # We could break but better to find the one with highest timestamp if possible
                        # For now, simplest path
                
                if latest_path:
                    try:
                        docs, _ = DataLoader.load_file(latest_path)
                        for d in docs:
                            d.metadata["assistant_id"] = assistant_id
                            d.metadata["user_id"] = current_user.id
                            d.metadata["filename"] = f_name
                        all_new_documents.extend(docs)
                    except Exception as e:
                        logger.error(f"Error re-loading {f_name} during re-index: {e}")
            
            new_total_docs = len(all_new_documents)
            # Create fresh vector store
            vector_store = vector_store_manager.create_vector_store(all_new_documents, assistant_id)
        else:
            # No files left, clear vector store
            vector_store_manager.delete_vector_store(assistant_id)
            vector_store = None
            new_total_docs = 0

        # 5. Update Database
        # Extract new attributes/questions from the remaining set (or empty)
        attributes = []
        graph_data = {}
        if all_new_documents:
            # Exclude internal metadata from attributes
            raw_attributes = DataLoader.extract_attributes(all_new_documents)
            internal_fields = {'assistant_id', 'user_id', 'filename'}
            attributes = [a for a in raw_attributes if a not in internal_fields]
            
            # Regenerate graph data if we have a representative dataframe
            # We use the first file for graph context if possible
            if new_files:
                for disk_f in os.listdir(user_upload_dir):
                    if disk_f.startswith(assistant_id) and disk_f.endswith(new_files[0]):
                        graph_data = DataLoader.generate_graph_insights(os.path.join(user_upload_dir, disk_f))
                        break
        
        sample_questions = await anyio.to_thread.run_sync(
            assistant_engine.generate_sample_questions, attributes, all_new_documents
        )
        
        # Filter file history
        current_history = assistant_db.file_history if hasattr(assistant_db, 'file_history') else []
        new_history = [h for h in current_history if (isinstance(h, dict) and h.get('filename') != filename) or h != filename]

        update_data = {
            "documents_count": new_total_docs,
            "uploaded_files": new_files,
            "file_history": new_history,
            "attributes": attributes,
            "sample_questions": sample_questions,
            "graph_data": graph_data
        }
        await crud.update_assistant(assistant_id, current_user.id, update_data)
        
        # 6. Update Memory Store
        if assistant_id in assistants_store:
            if not new_files:
                del assistants_store[assistant_id]
            else:
                assistants_store[assistant_id].update({
                    "documents_count": new_total_docs,
                    "vector_store": vector_store,
                    "attributes": attributes,
                    "system_instructions": assistant_engine._build_system_instructions(
                        custom_instructions=assistant_db.custom_instructions,
                        enable_statistics=assistant_db.enable_statistics,
                        enable_alerts=assistant_db.enable_alerts,
                        enable_recommendations=assistant_db.enable_recommendations,
                        attributes=attributes
                    )
                })

        return {
            "message": f"File {filename} removed. Assistant re-indexed.",
            "remaining_files": new_files,
            "new_total": new_total_docs
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file {filename}: {str(e)}")
        raise HTTPException(500, f"Failed to delete file: {str(e)}")


@app.get("/api/files/{user_id}/{filename}")
async def get_uploaded_file(user_id: str, filename: str, current_user: UserInDB = Depends(get_current_user)):
    """Serve uploaded files locally"""
    # Simple security check: user can only access their own files
    if user_id != current_user.id:
        logger.warning(f"Unauthorized file access attempt: {current_user.id} tried to access {user_id}")
        raise HTTPException(403, "Access denied")
    
    file_path = os.path.join(UPLOAD_DIR, user_id, filename)
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        raise HTTPException(404, "File not found")
    
    return FileResponse(file_path)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    error_trace = traceback.format_exc()
    logger.error(f"Unhandled exception: {str(exc)}\n{error_trace}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc),
            "timestamp": datetime.utcnow().isoformat()
        }
    )


# Serve React build
FRONTEND_DIR = "frontend"

if os.path.exists(FRONTEND_DIR):
    # Mount the static directory for hashed assets
    if os.path.exists(os.path.join(FRONTEND_DIR, "static")):
        app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "static")), name="static")
    
    # Mount the images directory
    if os.path.exists(os.path.join(FRONTEND_DIR, "img")):
        app.mount("/img", StaticFiles(directory=os.path.join(FRONTEND_DIR, "img")), name="img")

    @app.get("/")
    async def serve_frontend():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
    
    # Serve other files in the frontend root (like logo, favicon)
    @app.get("/{filename}")
    async def serve_root_files(filename: str):
        # Skip if it looks like an API call (to avoid intercepting valid 404s from API)
        if filename.startswith("api"):
             raise HTTPException(404)
             
        file_path = os.path.join(FRONTEND_DIR, filename)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # If not a file, it might be a React Router path, so serve index.html
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
else:
    logger.warning("Frontend directory not found. Skipping static file serving.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
