from typing import List, Optional, Any
from langchain_core.documents import Document
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_community.embeddings import HuggingFaceEmbeddings
from pymongo import MongoClient
import logging
import os

logger = logging.getLogger(__name__)


class VectorStoreManager:
    
    def __init__(self):
        logger.info("Initializing HuggingFace embeddings...")
        
        # Limit CPU threads to prevent server freeze on single-core instances
        try:
            import torch
            # Increase to 2 threads for better performance during background indexing
            # but still limit to prevent total server saturation.
            torch.set_num_threads(2)
        except ImportError:
            pass
            
        self.embeddings = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
        # Initialize MongoDB Client
        self.mongo_uri = os.getenv("MONGODB_URL")
        self.db_name = "dynamic_assistant_db"
        self.collection_name = "embeddings"
        self.client = MongoClient(self.mongo_uri)
        self.collection = self.client[self.db_name][self.collection_name]
        
        # Local Vector Store (FAISS) fallback for easier local development
        # MongoDB Atlas requires specific setup that is hard for users to do locally
        self.use_local = os.getenv("USE_LOCAL_VECTOR_STORE", "true").lower() == "true"
        self.local_dir = os.path.join(os.getcwd(), "vector_indices")
        os.makedirs(self.local_dir, exist_ok=True)
        
        if self.use_local:
            from langchain_community.vectorstores import FAISS
            self.vector_store_class = FAISS
            logger.info("Vector Store Manager initialized with Local FAISS fallback")
        else:
            self.vector_store_class = MongoDBAtlasVectorSearch
            logger.info("Vector Store Manager initialized with MongoDB Atlas")
    
    def add_documents(self, vector_store: Any, documents: List[Document], assistant_id: str) -> Any:
        if not documents:
            return vector_store
        
        try:
            if self.use_local:
                logger.info(f"Adding {len(documents)} documents to local FAISS store in batches for {assistant_id}...")
                
                # Process in larger batches to speed up indexing on CPU
                batch_size = 500
                total_batches = (len(documents) + batch_size - 1) // batch_size
                
                for i in range(0, len(documents), batch_size):
                    batch = documents[i:i + batch_size]
                    logger.info(f"Processing batch {i//batch_size + 1}/{total_batches} for {assistant_id}")
                    vector_store.add_documents(batch)
                    # Yield slightly to OS to let other CPU tasks (like login/auth) handle requests
                    import time
                    time.sleep(0.05)
                
                assistant_dir = os.path.join(self.local_dir, assistant_id)
                vector_store.save_local(assistant_dir)
                logger.info(f"Local FAISS store updated at {assistant_dir}")
                return vector_store
            else:
                logger.info(f"Adding {len(documents)} documents to MongoDB Atlas Vector Store...")
                vector_store.add_documents(documents)
                logger.info("Documents added to Atlas Vector Store successfully")
                return vector_store
        except Exception as e:
            logger.error(f"Error adding documents to vector store: {str(e)}")
            raise ValueError(f"Failed to update vector store: {str(e)}")

    def create_vector_store(self, documents: List[Document], assistant_id: str) -> Any:
        if not documents:
            raise ValueError("Cannot create vector store with empty documents")
        
        try:
            if self.use_local:
                logger.info(f"Creating local FAISS vector store in batches for {assistant_id}...")
                
                # Create initial store with first batch
                batch_size = 500
                first_batch = documents[:batch_size]
                vector_store = self.vector_store_class.from_documents(
                    documents=first_batch,
                    embedding=self.embeddings
                )
                
                # Add remaining batches
                if len(documents) > batch_size:
                    total_batches = (len(documents) + batch_size - 1) // batch_size
                    for i in range(batch_size, len(documents), batch_size):
                        batch = documents[i:i + batch_size]
                        logger.info(f"Processing batch {i//batch_size + 1}/{total_batches} for {assistant_id}")
                        vector_store.add_documents(batch)
                        # Yield slightly to OS
                        import time
                        time.sleep(0.05)
                
                assistant_dir = os.path.join(self.local_dir, assistant_id)
                vector_store.save_local(assistant_dir)
                logger.info(f"Local FAISS store saved to {assistant_dir}")
                return vector_store
            else:
                logger.info(f"Adding {len(documents)} documents to MongoDB Atlas Vector Store...")
                vector_store = MongoDBAtlasVectorSearch.from_documents(
                    documents=documents,
                    embedding=self.embeddings,
                    collection=self.collection,
                    index_name="vector_index" 
                )
                logger.info("Documents added to Atlas Vector Store successfully")
                return vector_store
            
        except Exception as e:
            logger.error(f"Error creating vector store: {str(e)}")
            raise ValueError(f"Failed to create vector store: {str(e)}")
    
    def delete_vector_store(self, assistant_id: str):
        """Removes the entire vector store for a specific assistant"""
        try:
            if self.use_local:
                import shutil
                assistant_dir = os.path.join(self.local_dir, assistant_id)
                if os.path.exists(assistant_dir):
                    shutil.rmtree(assistant_dir)
                    logger.info(f"Local FAISS store deleted for {assistant_id}")
            else:
                # MongoDB Atlas - delete only documents belonging to this assistant
                result = self.collection.delete_many({"assistant_id": assistant_id})
                logger.info(f"Deleted {result.deleted_count} documents from Atlas for {assistant_id}")
        except Exception as e:
            logger.error(f"Error deleting vector store for {assistant_id}: {str(e)}")
    
    def similarity_search(
        self, 
        vector_store: Any,
        query: str, 
        k: int = 4,
        filter: Optional[dict] = None
    ) -> List[Document]:
        try:
            logger.info(f"Performing similarity search for: {query[:50]}...")
            
            if self.use_local:
                # Local FAISS doesn't use the 'pre_filter' argument
                results = vector_store.similarity_search(query=query, k=k)
            else:
                # MongoDB Atlas uses 'pre_filter' argument for metadata filtering
                results = vector_store.similarity_search(
                    query=query,
                    k=k,
                    pre_filter=filter
                )
            
            logger.info(f"Found {len(results)} relevant documents")
            return results
            
        except Exception as e:
            logger.error(f"Error during similarity search: {str(e)}")
            return []
    
    def similarity_search_with_score(
        self, 
        vector_store: Any, 
        query: str, 
        k: int = 4,
        filter: Optional[dict] = None
    ) -> List[tuple[Document, float]]:
        try:
            logger.info(f"Performing similarity search with scores for: {query[:50]}...")
            
            if self.use_local:
                # FAISS doesn't use the 'pre_filter' in this method in common langchain versions
                results = vector_store.similarity_search_with_score(query=query, k=k)
            else:
                results = vector_store.similarity_search_with_score(
                    query=query,
                    k=k,
                    pre_filter=filter
                )
            
            logger.info(f"Found {len(results)} relevant documents with scores")
            return results
            
        except Exception as e:
            logger.error(f"Error during similarity search: {str(e)}")
            return []

    def get_vector_store(self, assistant_id: str):
        """Helper to get an existing vector store object"""
        if self.use_local:
            from langchain_community.vectorstores import FAISS
            assistant_dir = os.path.join(self.local_dir, assistant_id)
            if not os.path.exists(assistant_dir):
                logger.warning(f"No local vector store found for assistant {assistant_id}")
                return None
            return FAISS.load_local(assistant_dir, self.embeddings, allow_dangerous_deserialization=True)
        else:
            return MongoDBAtlasVectorSearch(
                collection=self.collection,
                embedding=self.embeddings,
                index_name="vector_index"
            )
