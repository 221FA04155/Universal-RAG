from typing import List, Optional, Dict, Any
from langchain_core.documents import Document
from langchain_groq import ChatGroq
import logging
import os
import json
from datetime import datetime
import anyio
import time

from backend.vector_store import VectorStoreManager
from backend.data_loader import DataLoader

logger = logging.getLogger(__name__)


MODEL_MAPPING = {
    "Llama 3.3 70B": "llama-3.3-70b-versatile",
    "Llama 3.1 8B": "llama-3.1-8b-instant",
    "Mixtral 8x7B": "mixtral-8x7b-32768"
}

REJECTION_MESSAGE = "I apologize, but the current query falls outside the scope of the indexed dataset. For optimal results, please focus your investigation on the verified corporate data nodes currently active in the workspace."


class AssistantEngine:
    
    def __init__(self, groq_api_key: str, model_name: str = "llama-3.3-70b-versatile", vector_store_manager: Optional[VectorStoreManager] = None):
        if not groq_api_key or "placeholder" in groq_api_key.lower():
             logger.warning("GROQ_API_KEY is missing or using placeholder! AI chat will not work.")
             
        self.groq_api_key = groq_api_key
        self.model_name = model_name
        self.vector_store_manager = vector_store_manager or VectorStoreManager()
        
        self.llm = self._get_llm(model_name)
        
        logger.info(f"Assistant engine initialized with model: {model_name}")

    def _get_llm(self, model_name: str):
        # Map friendly name if provided
        actual_model = MODEL_MAPPING.get(model_name, model_name)
        return ChatGroq(
            api_key=self.groq_api_key,
            model=actual_model,
            temperature=0.1, # High precision for data analysis
            max_tokens=2048,
            max_retries=0 # Handle retries/fallbacks manually for speed
        )
    
    def create_assistant(
        self,
        assistant_id: str,
        name: str,
        documents: List[Document],
        custom_instructions: str,
        enable_statistics: bool = False,
        enable_alerts: bool = False,
        enable_recommendations: bool = False,
        attributes: List[str] = None
    ) -> Dict[str, Any]:
        try:
            logger.info(f"Creating assistant '{name}' with {len(documents)} documents")
            
            # Create vector store for this assistant
            vector_store = self.vector_store_manager.create_vector_store(documents, assistant_id)
            
            # Build system instructions
            system_instructions = self._build_system_instructions(
                custom_instructions,
                enable_statistics,
                enable_alerts,
                enable_recommendations,
                attributes=attributes
            )
            
            assistant_config = {
                "assistant_id": assistant_id,
                "name": name,
                "vector_store": vector_store,
                "custom_instructions": custom_instructions,
                "system_instructions": system_instructions,
                "documents_count": len(documents),
                "enable_statistics": enable_statistics,
                "enable_alerts": enable_alerts,
                "enable_recommendations": enable_recommendations,
                "created_at": datetime.utcnow().isoformat()
            }
            
            logger.info(f"Assistant '{name}' created successfully")
            return assistant_config
            
        except Exception as e:
            logger.error(f"Error creating assistant: {str(e)}")
            raise
    
    async def chat_stream(
        self,
        assistant_config: Dict[str, Any],
        user_message: str,
        history: Optional[List[Dict[str, str]]] = None,
        model_name: Optional[str] = None
    ):
        try:
            vector_store = assistant_config["vector_store"]
            system_instructions = assistant_config["system_instructions"]
            assistant_id = assistant_config.get("assistant_id")
            
            # Use requested model or default
            llm = self.llm
            if model_name and model_name != self.model_name:
                logger.info(f"Switching model: {model_name}")
                llm = self._get_llm(model_name)
            
            logger.info(f"Processing chat stream for assistant: {assistant_config['name']}")
            
            # 1. Similarity Search
            # Unified Strategic Keyword Detection
            comparison_keywords = [
                'highest', 'lowest', 'best', 'worst', 'maximum', 'minimum', 
                'most', 'least', 'compare', 'all', 'which', 'top', 'bottom',
                'summary', 'overview', 'columns', 'fields', 'attributes',
                'distribution', 'trend', 'analytics', 'statistics', 'calculate',
                'average', 'total', 'count', 'percentage', 'share', 'distribution'
            ]
            is_comparison = any(word in user_message.lower() for word in comparison_keywords)
            
            # Optimized k_docs to balance retrieval depth with Groq TPM limits
            # Llama 3 70B is heavy on context; Mixtral/Llama 8B can handle more.
            k_docs = 12 if is_comparison else 6
            
            search_filter = {"assistant_id": assistant_id}
            
            if vector_store is None:
                logger.error(f"Vector store not found for assistant: {assistant_id}")
                yield json.dumps({"type": "error", "data": "Assistant knowledge base is not ready. Please try again in a moment."}) + "\n"
                return

            scored_docs = self.vector_store_manager.similarity_search_with_score(
                vector_store=vector_store,
                query=user_message,
                k=k_docs,
                filter=search_filter
            )
            
            threshold = 1.8
            relevant_docs = [doc for doc, score in scored_docs if score < threshold]
            
            # 2. Build Prompt
            if not relevant_docs:
                logger.info(f"No documents found, providing empty context but keeping instructions for {user_message[:50]}...")
                context = "No specific data chunks retrieved for this query. Use KNOWN DATA FIELDS to explain what is available."
            else:
                context = self._build_context(relevant_docs)
            
            prompt = self._build_prompt(
                system_instructions=system_instructions, 
                context=context, 
                user_message=user_message, 
                history=history,
                documents=relevant_docs
            )
            
            # 3. Stream Response with Resilience
            # First, send metadata about sources
            sources_info = []
            for doc in relevant_docs:
                safe_metadata = {
                    k: v for k, v in doc.metadata.items() 
                    if k in ['page', 'row_number', 'item_number', 'title', 'heading', 'url']
                }
                if 'source' in doc.metadata:
                    src = str(doc.metadata['source'])
                    if '/tmp' not in src and '\\tmp' not in src:
                        safe_metadata['source'] = src
                    else:
                        safe_metadata['source'] = "Uploaded File"

                sources_info.append({
                    "content": doc.page_content[:150] + "...",
                    "metadata": safe_metadata
                })

            yield json.dumps({"type": "sources", "data": sources_info}) + "\n"
            
            # Streaming with Triple-Tier Automatic Model Fallback
            try:
                async for chunk in llm.astream(prompt):
                    if chunk.content:
                        yield json.dumps({"type": "content", "data": chunk.content}) + "\n"
            except Exception as se:
                se_str = str(se).lower()
                # Enhanced detection for Groq rate limit/capacity/overload errors
                if any(x in se_str for x in ["429", "rate_limit", "overloaded", "capacity", "exhausted", "tokens", "tpm", "rpm"]):
                    logger.warning(f"Primary stream capacity restricted ({self.model_name}). Initiating Protocol Tier 2: Llama 3.1 8B...")
                    try:
                        # Slight pause to let API buffers clear
                        await anyio.sleep(0.2)
                        fallback_llm = self._get_llm("llama-3.1-8b-instant")
                        async for chunk in fallback_llm.astream(prompt):
                            if chunk.content:
                                yield json.dumps({"type": "content", "data": chunk.content}) + "\n"
                    except Exception as fe:
                        fe_str = str(fe).lower()
                        if any(x in fe_str for x in ["429", "rate_limit", "overloaded", "capacity", "exhausted", "tokens", "tpm", "rpm"]):
                            logger.warning("Tier 2 capacity also restricted. Initiating Tier 3 Emergency Protocol: Mixtral 8x7B...")
                            await anyio.sleep(0.3)
                            tertiary_llm = self._get_llm("mixtral-8x7b-32768")
                            async for chunk in tertiary_llm.astream(prompt):
                                if chunk.content:
                                    yield json.dumps({"type": "content", "data": chunk.content}) + "\n"
                        else:
                            raise fe
                else:
                    raise se
            
        except Exception as e:
            logger.error(f"Error during chat stream: {str(e)}")
            error_msg = str(e)
            if "invalid_api_key" in error_msg.lower():
                error_msg = "Invalid Groq API Key. Please check your .env file."
            yield json.dumps({"type": "error", "data": error_msg}) + "\n"

    def chat(
        self,
        assistant_config: Dict[str, Any],
        user_message: str,
        history: Optional[List[Dict[str, str]]] = None,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            vector_store = assistant_config["vector_store"]
            system_instructions = assistant_config["system_instructions"]
            assistant_id = assistant_config.get("assistant_id")
            
            # Use requested model or default
            llm = self.llm
            if model_name and model_name != self.model_name:
                logger.info(f"Switching model: {model_name}")
                llm = self._get_llm(model_name)
            
            logger.info(f"Processing chat for assistant: {assistant_config['name']}")
            
            # Unified Strategic Keyword Detection
            comparison_keywords = [
                'highest', 'lowest', 'best', 'worst', 'maximum', 'minimum', 
                'most', 'least', 'compare', 'all', 'which', 'top', 'bottom',
                'summary', 'overview', 'columns', 'fields', 'attributes',
                'distribution', 'trend', 'analytics', 'statistics', 'calculate',
                'average', 'total', 'count', 'percentage', 'share', 'distribution'
            ]
            is_comparison = any(word in user_message.lower() for word in comparison_keywords)
            k_docs = 12 if is_comparison else 6
            
            # Filter by assistant_id to prevent data leakage and ensure retrieval accuracy
            search_filter = {"assistant_id": assistant_id}
            
            scored_docs = self.vector_store_manager.similarity_search_with_score(
                vector_store=vector_store,
                query=user_message,
                k=k_docs,
                filter=search_filter
            )
            
            threshold = 1.8
            relevant_docs = [doc for doc, score in scored_docs if score < threshold]
            
            if not relevant_docs:
                return {
                    "response": REJECTION_MESSAGE,
                    "sources_used": 0,
                    "timestamp": datetime.utcnow().isoformat()
                }
            
            logger.info(f"Retrieved {len(relevant_docs)} documents for query: {user_message[:50]}...")
            
            context = self._build_context(relevant_docs)
            prompt = self._build_prompt(
                system_instructions=system_instructions, 
                context=context, 
                user_message=user_message, 
                history=history,
                documents=relevant_docs
            )
            
            try:
                response = llm.invoke(prompt)
            except Exception as le:
                le_str = str(le).lower()
                # Detection for broad range of rate limit / capacity / Daily Quota errors
                if any(x in le_str for x in ["429", "rate_limit", "overloaded", "capacity", "exhausted", "tokens", "tpm", "rpm"]):
                    logger.warning(f"Capacity limit detected on {self.model_name}. Initiating Multi-Tier Fallback.")
                    
                    # Try Tier 2: Llama 8B
                    try:
                        time.sleep(0.2)
                        logger.info("Switching to Tier 2 Protocol: Llama 3.1 8B")
                        fallback_llm = self._get_llm("llama-3.1-8b-instant")
                        response = fallback_llm.invoke(prompt)
                    except Exception as fe:
                        fe_str = str(fe).lower()
                        if any(x in fe_str for x in ["429", "rate_limit", "overloaded", "capacity", "exhausted", "tokens", "tpm", "rpm"]):
                            # Try Tier 3: Mixtral
                            logger.warning("Tier 2 capacity also restricted. Switching to Tier 3 Emergency Protocol: Mixtral 8x7B.")
                            time.sleep(0.3)
                            tertiary_llm = self._get_llm("mixtral-8x7b-32768")
                            response = tertiary_llm.invoke(prompt)
                        else:
                            raise fe
                else:
                    raise le
            
            result = {
                "response": response.content,
                "sources_used": len(relevant_docs),
                "timestamp": datetime.utcnow().isoformat(),
                "relevant_documents": [
                    {
                        "content": doc.page_content[:200] + "...",
                        "metadata": doc.metadata
                    }
                    for doc in relevant_docs
                ]
            }
            
            logger.info(f"Generated response using {len(relevant_docs)} sources")
            return result
            
        except Exception as e:
            logger.error(f"Error during chat: {str(e)}")
            raise
    
    def _build_system_instructions(
        self,
        custom_instructions: str,
        enable_statistics: bool,
        enable_alerts: bool,
        enable_recommendations: bool,
        attributes: List[str] = None
    ) -> str:
        
        instructions = [custom_instructions]
        
        if attributes:
            instructions.append(f"\nCONTEXTUAL METADATA: This dataset contains the following attributes/columns: {', '.join(attributes)}")

        instructions.append(
            "\nCRITICAL RESPONSE PROTOCOLS:\n"
            "- You are a High-Precision Enterprise AI Architect. Accuracy is paramount.\n"
            "- MANDATORY: Ground every claim in the provided CONTEXT_DATA or CONTEXTUAL METADATA.\n"
            "- NUMERICAL PRECISION: When reporting values (dates, counts, prices), report them EXACTLY as they appear in the data.\n"
            "- SCHEMA AWARENESS: Use the 'CONTEXTUAL METADATA' to understand the dataset structure even if specific rows are missing certain fields.\n"
            "- If a user asks for a distribution or count, use the provided samples and attributes to calculate the most accurate synthesis possible.\n"
            "- Highlight relevant excerpts or values by using **bold text** to emphasize accuracy.\n"
            "- Maintain an enterprise-grade tone: professional, objective, and analytical.\n"
            "- ZERO HALLUCINATION: If a specific data point is not in the context, do not invent it. State what IS available instead.\n"
            "- Speak with absolute authority based on the verified data nodes."
        )
        
        if enable_statistics:
            instructions.append(
                "\nANALYTICAL DEEP-DIVE: Provide statistical insights such as averages, "
                "totals, trends, and correlations found in the data. "
                "Use established patterns to make informed predictions when asked about hypothetical scenarios."
            )
        
        if enable_alerts:
            instructions.append(
                "\nANOMALY DETECTION: Identify and report outliers, irregularities, or critical "
                "patterns in the data that warrant immediate executive attention."
            )
        
        if enable_recommendations:
            instructions.append(
                "\nSTRATEGIC RECOMMENDATIONS: Provide actionable strategic recommendations "
                "based on verified data patterns. When analyzing 'what if' scenarios, "
                "provide reasoned projections supported by existing data trends."
            )
        
        return "\n".join(instructions)
    
    def _build_context(self, documents: List[Document]) -> str:
        context_parts = []
        
        for idx, doc in enumerate(documents, 1):
            context_parts.append(f"--- DATA SOURCE {idx} ---")
            
            # Show most metadata to the LLM so it can answer technical questions
            # Only hide very internal technical keys
            internal_keys = {'source', 'chunk', 'row_number', 'item_number'}
            relevant_meta = {k: v for k, v in doc.metadata.items() if k not in internal_keys}
            
            if relevant_meta:
                 meta_str = " | ".join([f"{k}: {v}" for k, v in relevant_meta.items()])
                 context_parts.append(f"Fields/Attributes: {meta_str}")
            
            context_parts.append(f"Content: {doc.page_content}")
            context_parts.append("-" * 25)
        
        return "\n".join(context_parts)
    
    def _build_prompt(
        self,
        system_instructions: str,
        context: str,
        user_message: str,
        history: Optional[List[Dict[str, str]]] = None,
        documents: List[Document] = None
    ) -> str:
        
        is_structured_data = False
        is_website_data = False
        is_comparison_query = any(word in user_message.lower() for word in [
            'highest', 'lowest', 'best', 'worst', 'maximum', 'minimum', 
            'most', 'least', 'which', 'top', 'bottom', 'largest', 'smallest',
            'greatest', 'biggest'
        ])
        
        if documents:
            for doc in documents[:3]:
                doc_type = doc.metadata.get('type', '')
                if doc_type in ['website_content', 'website_section', 'website_paragraph']:
                    is_website_data = True
                    break
                elif 'row_number' in doc.metadata or 'item_number' in doc.metadata:
                    is_structured_data = True
                    break
        
        if is_website_data:
            answering_instructions = """Answer the user's question directly and naturally.
Write in clear paragraphs as if you're a knowledgeable expert explaining the topic.
Focus on providing useful information without meta-commentary. Do not mention that you are an AI or which sources you are using."""
        elif is_structured_data and is_comparison_query:
            answering_instructions = """⚠️ CRITICAL ANALYTICAL INSTRUCTIONS ⚠️

You are a Senior Data Analyst. You MUST follow these steps:
1. SCAN every source provided in the context below.
2. EXTRACT all relevant comparative values (prices, dates, rankings, names).
3. If values are found, identifying the absolute best match (highest, lowest, etc.) as requested.
4. If the exact answer isn't clear, provide the top 3 most relevant matches found.

OUTPUT FORMAT:
- Provide the final answer DIRECTLY and naturally.
- Explain WHY this is the answer based on specific values in the data.
- NO meta-commentary like "based on source 1" or "I have processed the data"."""
        elif is_structured_data:
            answering_instructions = """You are a domain expert analyzing a business dataset. 
Provide professional, detailed answers based on the specific fields and values in the context.
If the data contains patterns, mention them. If asked practical questions, combine data facts with professional advice."""
        else:
            answering_instructions = """Provide a clear, direct, and comprehensive answer. 
Speak with authority and clarity. Avoid meta-talk about files or your AI nature."""
        
        prompt = f"""<SYSTEM_INSTRUCTIONS>
{system_instructions}
</SYSTEM_INSTRUCTIONS>

<CONVERSATION_HISTORY>
{self._format_history(history) if history else "No previous context."}
</CONVERSATION_HISTORY>

<CONTEXT_DATA>
{context}
</CONTEXT_DATA>

<USER_QUERY>
{user_message}
</USER_QUERY>

<FINAL_DIRECTIVES>
{answering_instructions}
</FINAL_DIRECTIVES>"""

        return prompt

    def _format_history(self, history: List[Dict[str, str]]) -> str:
        formatted = []
        for msg in history[-10:]:  # Keep last 10 messages for context
            role = "USER" if msg.get("role") == "user" else "ASSISTANT"
            content = msg.get("content", "")
            formatted.append(f"{role}: {content}")
        return "\n".join(formatted)
    
    def get_assistant_stats(self, assistant_config: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "assistant_id": assistant_config["assistant_id"],
            "name": assistant_config["name"],
            "documents_count": assistant_config["documents_count"],
            "created_at": assistant_config["created_at"],
            "features": {
                "statistics": assistant_config["enable_statistics"],
                "alerts": assistant_config["enable_alerts"],
                "recommendations": assistant_config["enable_recommendations"]
            }
        }

    def generate_sample_questions(self, attributes: List[str], documents: List[Document]) -> List[str]:
        try:
            if not attributes or not documents:
                return [
                    "Perform a comprehensive initial analysis of this dataset.",
                    "Identify the primary objective and highlight three key metrics.",
                    "What strategic questions should I explore to maximize project value?",
                    "Identify any anomalies or patterns in the available data."
                ]

            # Use LLM to generate professional, context-aware questions
            # Sampling a few documents to provide context to the LLM
            sample_content = self._build_context(documents[:3])
            
            prompt = f"""You are a senior business intelligence analyst.
Review the following dataset schema and sample content:

ATTRIBUTES: {', '.join(attributes[:15])}

SAMPLE DATA:
{sample_content}

Based on this specific data, generate 4 highly specific, professional, and analytical questions that a user should ask this dataset to gain maximum strategic value.
CRITICAL: The questions MUST refer to the actual attributes found in the list above.

Return ONLY a JSON list of 4 strings. No other text.
Example format: ["Question 1", "Question 2", "Question 3", "Question 4"]"""

            # Use a faster, higher-availability model for background tasks to preserve 70B quota
            try:
                background_llm = self._get_llm("llama-3.1-8b-instant")
                response = background_llm.invoke(prompt)
            except Exception as be:
                logger.warning(f"Tier 3 failed for questions, attempting Tier 2 (70B): {be}")
                background_llm = self._get_llm("llama-3.3-70b-versatile")
                response = background_llm.invoke(prompt)
            content = response.content.strip()
            
            try:
                # Basic cleaning if LLM adds markdown
                clean_content = content
                if "```json" in content:
                    clean_content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    clean_content = content.split("```")[1].split("```")[0].strip()
                    
                questions = json.loads(clean_content)
                if isinstance(questions, list) and len(questions) > 0:
                    return [str(q) for q in questions[:4]]
            except Exception as pe:
                logger.error(f"Failed to parse LLM generated questions: {str(pe)} | Content: {content}")
                
            # Fallback to DataLoader's basic generation
            return DataLoader.generate_sample_questions(attributes, "csv")
            
        except Exception as e:
            logger.error(f"Error in LLM question generation: {str(e)}")
            return DataLoader.generate_sample_questions(attributes, "csv")
