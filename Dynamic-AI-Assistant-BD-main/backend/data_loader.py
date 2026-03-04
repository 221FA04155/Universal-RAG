import pandas as pd
import json
import requests
from typing import List, Dict, Any, Optional
from langchain_core.documents import Document
import logging
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import os

logger = logging.getLogger(__name__)


class DataLoader:
    
    @staticmethod
    def load_file(file_path: str, limit: Optional[int] = None) -> tuple[List[Document], Optional[pd.DataFrame]]:
        """Auto-detect file type and load documents. Returns (documents, dataframe). supports optional limit for speed."""
        ext = os.path.splitext(file_path)[1].lower()
        try:
            if ext == '.csv':
                return DataLoader.load_from_csv(file_path, limit)
            elif ext == '.json':
                return DataLoader.load_from_json(file_path, limit)
            elif ext == '.pdf':
                logger.info(f"Loading PDF file: {file_path}")
                from langchain_community.document_loaders import PyPDFLoader
                loader = PyPDFLoader(file_path)
                return loader.load(), None
            elif ext in ['.doc', '.docx']:
                logger.info(f"Loading DOCX file: {file_path}")
                from langchain_community.document_loaders import Docx2txtLoader
                loader = Docx2txtLoader(file_path)
                return loader.load(), None
            elif ext == '.txt':
                logger.info(f"Loading TXT file: {file_path}")
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return [Document(page_content=content, metadata={"source": file_path})], None
            else:
                raise ValueError(f"Unsupported file extension: {ext}")
        except Exception as e:
            logger.error(f"Error loading {ext} file: {str(e)}")
            if "import" in str(e).lower():
                raise ValueError(f"Server is missing dependencies for {ext} files. Please contact administrator.")
            raise ValueError(f"Failed to process {ext} file: {str(e)}")

    @staticmethod
    def generate_graph_insights(file_path: str, data_type: str, df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
        """
        Generates statistical graph data for the frontend dashboard.
        """
        graph_data = {}
        try:
            if df is None:
                if not file_path or not os.path.exists(file_path):
                    return {}

                if data_type == "csv":
                    try:
                        df = pd.read_csv(file_path, on_bad_lines='skip')
                    except UnicodeDecodeError:
                        df = pd.read_csv(file_path, encoding='latin1', on_bad_lines='skip')
                    except Exception as e:
                        logger.warning(f"Could not read CSV for insights: {e}")
                        return {}
                elif data_type == "json":
                    try:
                        df = pd.read_json(file_path)
                    except Exception as e:
                        logger.warning(f"Could not read JSON for insights: {e}")
                        return {}
                else:
                    # PDF/DOCX/TXT: Extract semantic sections or summary properly
                    try:
                        ext = os.path.splitext(file_path)[1].lower()
                        text = ""
                        
                        if ext == '.pdf':
                            from langchain_community.document_loaders import PyPDFLoader
                            loader = PyPDFLoader(file_path)
                            pages = loader.load()
                            text = " ".join([p.page_content for p in pages[:10]]) # First 10 pages
                        elif ext in ['.doc', '.docx']:
                            from langchain_community.document_loaders import Docx2txtLoader
                            loader = Docx2txtLoader(file_path)
                            docs = loader.load()
                            text = " ".join([d.page_content for d in docs])
                        else:
                            # TXT or other text-like
                            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                                text = f.read(10000)
                        
                        # Basic cleanup: remove null bytes and common binary artifacts
                        text = text.replace('\x00', '')
                        
                        # Very basic semantic extraction
                        paragraphs = [p.strip() for p in text.split('\n') if len(p.strip()) > 50]
                        summary = paragraphs[0] if paragraphs else text[:500]
                        
                        # Generate simple chart data for unstructured (e.g. Word frequency or Page count)
                        words = [w.lower() for w in text.split() if len(w) > 4]
                        from collections import Counter
                        top_words = Counter(words).most_common(5)
                        
                        return {
                            "unstructured_summary": {
                                "title": "Content Overview",
                                "excerpt": summary[:300].strip() + ("..." if len(summary) > 300 else ""),
                                "sections_detected": max(1, len(paragraphs))
                            },
                            "donut_chart": {
                                "title": "Keyword Prevalence",
                                "center_label": str(len(words)),
                                "center_text": "Keywords",
                                "labels": [w[0].capitalize() for w in top_words],
                                "values": [w[1] for w in top_words]
                            }
                        }
                    except Exception as e:
                        logger.warning(f"Could not extract manual summary from {data_type}: {e}")
                        return {}
            
            if df is None or (isinstance(df, pd.DataFrame) and df.empty):
                return {}

            # Optimization: If dataframe is very large, sample it for insights
            # Generating charts from 50k rows is slow and unnecessary for high-level distribution
            original_len = len(df)
            if original_len > 2000:
                logger.info(f"Sampling large dataset ({original_len} rows) to 2000 rows for faster insight generation")
                df = df.sample(n=2000, random_state=42)

            # Define junk keywords to filter out of charts
            exclude_keywords = {
                'id', 'uuid', 'guid', 'key', 'assistant', 'user', 'index', 'number', 
                'row', 'created', 'updated', 'timestamp', 'date', 'time', 'token', 
                'session', 'version', 'hash', 'slug', 'link', 'url', 'uri', 'path'
            }
            
            def is_meaningful(col_name):
                col_lower = col_name.lower()
                # Exact matches or common suffixes
                if any(kw == col_lower or col_lower.endswith(f'_{kw}') or col_lower.startswith(f'{kw}_') for kw in exclude_keywords):
                    return False
                return True

            # 1. Bar Chart (Prefer categorical column with 2-15 unique values)
            # Prioritize columns that look like 'category', 'status', 'type', 'group', 'department'
            cat_cols = [c for c in df.select_dtypes(include=['object', 'category']).columns if is_meaningful(c)]
            
            # If no meaningful found, fallback to all cat_cols
            if not cat_cols:
                cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
            
            if cat_cols:
                # Find column with best cardinality for a bar chart
                # Prioritize columns with 'type' or 'status' in name if they exist
                priority_cols = [c for c in cat_cols if any(pk in c.lower() for pk in ['type', 'status', 'cat', 'group', 'dept', 'country', 'region'])]
                search_order = priority_cols + [c for c in cat_cols if c not in priority_cols]
                
                best_cat_col = search_order[0]
                for col in search_order:
                    unique_count = df[col].nunique()
                    # 2-8 unique values is the "sweet spot" for visualization
                    if 2 <= unique_count <= 8:
                        best_cat_col = col
                        break
                    elif 2 <= unique_count <= 15: # Second best range
                        best_cat_col = col
                
                top_values = df[best_cat_col].value_counts().head(5)
                graph_data['bar_chart'] = {
                    'title': f'{best_cat_col} Distribution',
                    'labels': top_values.index.astype(str).tolist(),
                    'values': [int(x) for x in top_values.values.tolist()]
                }
            
            # 2. Donut Chart (Second best categorical)
            if cat_cols:
                # Use a different column than the bar chart if possible
                used_col = best_cat_col if 'best_cat_col' in locals() else None
                sec_cat_cols = [c for c in cat_cols if c != used_col]
                
                if not sec_cat_cols: # Fallback to same if only one col
                    best_donut_col = cat_cols[0]
                else:
                    best_donut_col = sec_cat_cols[0]
                    for col in sec_cat_cols:
                        unique_count = df[col].nunique()
                        if 2 <= unique_count <= 6: # Even smaller sweet spot for donuts
                            best_donut_col = col
                            break
                        elif 2 <= unique_count <= 10:
                            best_donut_col = col

                top_3 = df[best_donut_col].value_counts().head(3)
                graph_data['donut_chart'] = {
                    'title': f'{best_donut_col} Analysis',
                    'center_label': str(df[best_donut_col].nunique()),
                    'center_text': 'Categories',
                    'labels': top_3.index.astype(str).tolist(),
                    'values': [int(x) for x in top_3.values.tolist()]
                }

            # 3. Line Chart (Numerical trend - avoid IDs)
            num_cols = [c for c in df.select_dtypes(include=['number']).columns if is_meaningful(c)]
            if not num_cols:
                num_cols = df.select_dtypes(include=['number']).columns.tolist()

            if num_cols:
                num_col = num_cols[0]
                stats_mean = float(df[num_col].mean())
                # Take 10 points
                if len(df) > 10:
                    trend_values = df[num_col].iloc[::max(1, len(df)//10)].head(10).tolist()
                else:
                    trend_values = df[num_col].tolist()
                
                if trend_values:
                    start, end = trend_values[0], trend_values[-1]
                    pct_change = ((end - start) / start) * 100 if start != 0 else 0
                    trend_sign = "+" if pct_change >= 0 else ""
                
                    graph_data['line_chart'] = {
                        'title': f'{num_col} Trend',
                        'avg_value': f"{stats_mean:.1f}",
                        'trend_label': 'Avg Value',
                        'trend_change': f"{trend_sign}{pct_change:.1f}%",
                        'data_points': [float(x) for x in trend_values]
                    }
                
        except Exception as e:
            logger.error(f"Error generating graph insights: {str(e)}")
            return {}
            
        return graph_data

    @staticmethod
    def load_from_csv(file_path: str, limit: Optional[int] = None) -> tuple[List[Document], pd.DataFrame]:
        try:
            # Optimization: Use low_memory=True for large files
            if limit:
                df = pd.read_csv(file_path, low_memory=True, nrows=limit)
            else:
                df = pd.read_csv(file_path, low_memory=True)
            
            # Optimization for very large CSVs in simple assistants: 
            # If the CSV is > 10,000 rows, we create slightly larger 'chunks' of rows
            # to reduce the absolute number of Document objects if the goal is general chat.
            # However, for now, we'll keep the 1-to-1 mapping but optimize the loop construction.
            
            documents = []
            
            # Optimization: If the dataset is massive, group multiple rows together
            # to reduce the number of Document objects and embedding operations.
            row_grouping = 1
            if len(df) > 50000:
                row_grouping = 10 # 10x reduction in embeddings
            elif len(df) > 10000:
                row_grouping = 5 # 5x reduction in embeddings
            
            # Faster construction using list comprehension and dict conversion
            records = df.where(pd.notnull(df), None).to_dict('records')
            
            if row_grouping > 1:
                logger.info(f"Grouping every {row_grouping} rows into one document to optimize neural indexing")
                for i in range(0, len(records), row_grouping):
                    batch_rows = records[i:i + row_grouping]
                    
                    combined_content = []
                    for idx_in_batch, row in enumerate(batch_rows):
                        clean_row = {k: v for k, v in row.items() if v is not None}
                        row_text = " | ".join([f"{k}: {v}" for k, v in clean_row.items()])
                        combined_content.append(f"[Row {i + idx_in_batch}]: {row_text}")
                    
                    content = "\n---\n".join(combined_content)
                    metadata = {"source": file_path, "row_start": i, "row_end": min(i + row_grouping - 1, len(records) - 1)}
                    # Add common metadata from first row of batch for filtering
                    first_row = batch_rows[0]
                    metadata.update({k: str(v) for k, v in first_row.items() if v is not None})
                    
                    documents.append(Document(page_content=content, metadata=metadata))
            else:
                for idx, row in enumerate(records):
                    # Filter out None values
                    clean_row = {k: v for k, v in row.items() if v is not None}
                    content = " | ".join([f"{k}: {v}" for k, v in clean_row.items()])
                    
                    metadata = {"source": file_path, "row_number": idx}
                    metadata.update({k: str(v) for k, v in clean_row.items()})
                    documents.append(Document(page_content=content, metadata=metadata))
            
            logger.info(f"Loaded {len(documents)} documents from CSV (Optimized via records)")
            return documents, df
            
        except Exception as e:
            logger.error(f"Error loading CSV: {str(e)}")
            raise ValueError(f"Failed to load CSV file: {str(e)}")
    
    @staticmethod
    def load_from_json(file_path: str, limit: Optional[int] = None) -> tuple[List[Document], Optional[pd.DataFrame]]:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if limit and isinstance(data, list):
                data = data[:limit]
            
            documents = []
            df = None
            try:
                df = pd.DataFrame(data) if isinstance(data, (list, dict)) else None
            except:
                pass

            if isinstance(data, list):
                # Optimization: Group massive arrays
                item_grouping = 1
                if len(data) > 50000:
                    item_grouping = 10
                elif len(data) > 10000:
                    item_grouping = 5
                
                if item_grouping > 1:
                    logger.info(f"Grouping every {item_grouping} JSON items into one document to optimize neural indexing")
                    for i in range(0, len(data), item_grouping):
                        batch_items = data[i:i + item_grouping]
                        combined_content = []
                        for idx_in_batch, item in enumerate(batch_items):
                            item_text = DataLoader._dict_to_content(item)
                            combined_content.append(f"[Item {i + idx_in_batch}]: {item_text}")
                        
                        content = "\n---\n".join(combined_content)
                        doc = Document(
                            page_content=content,
                            metadata={
                                "source": file_path,
                                "item_start": i,
                                "item_end": min(i + item_grouping - 1, len(data) - 1),
                                **DataLoader._flatten_dict(batch_items[0])
                            }
                        )
                        documents.append(doc)
                else:
                    for idx, item in enumerate(data):
                        content = DataLoader._dict_to_content(item)
                        doc = Document(
                            page_content=content,
                            metadata={
                                "source": file_path,
                                "item_number": idx,
                                **DataLoader._flatten_dict(item)
                            }
                        )
                        documents.append(doc)
            
            elif isinstance(data, dict):
                content = DataLoader._dict_to_content(data)
                doc = Document(
                    page_content=content,
                    metadata={
                        "source": file_path,
                        **DataLoader._flatten_dict(data)
                    }
                )
                documents.append(doc)
            
            else:
                raise ValueError("JSON must be either an array or object")
            
            logger.info(f"Loaded {len(documents)} documents from JSON")
            return documents, df
            
        except Exception as e:
            logger.error(f"Error loading JSON: {str(e)}")
            raise ValueError(f"Failed to load JSON file: {str(e)}")
    
    @staticmethod
    def load_from_url(url: str) -> tuple[List[Document], Optional[pd.DataFrame]]:
        try:
            response = requests.get(url, timeout=30, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            response.raise_for_status()
            
            content_type = response.headers.get('content-type', '').lower()
            
            if 'json' in content_type or url.endswith('.json'):
                try:
                    data = response.json()
                    documents = []
                    df = None
                    try:
                        df = pd.DataFrame(data)
                    except:
                        pass
                    
                    if isinstance(data, list):
                        for idx, item in enumerate(data):
                            content = DataLoader._dict_to_content(item)
                            doc = Document(
                                page_content=content,
                                metadata={
                                    "source": url,
                                    "item_number": idx,
                                    **DataLoader._flatten_dict(item)
                                }
                            )
                            documents.append(doc)
                    elif isinstance(data, dict):
                        content = DataLoader._dict_to_content(data)
                        doc = Document(
                            page_content=content,
                            metadata={"source": url, **DataLoader._flatten_dict(data)}
                        )
                        documents.append(doc)
                    
                    logger.info(f"Loaded {len(documents)} documents from URL (JSON)")
                    return documents, df
                except json.JSONDecodeError:
                    pass
            
            if 'csv' in content_type or url.endswith('.csv'):
                from io import StringIO
                df = pd.read_csv(StringIO(response.text))
                documents = []
                
                records = df.where(pd.notnull(df), None).to_dict('records')
                for idx, row in enumerate(records):
                    content_parts = [f"{k}: {v}" for k, v in row.items() if v is not None]
                    content = " | ".join(content_parts)
                    metadata = {"source": url, "row_number": idx}
                    metadata.update({k: str(v) for k, v in row.items() if v is not None})
                    documents.append(Document(page_content=content, metadata=metadata))
                
                logger.info(f"Loaded {len(documents)} documents from URL (CSV)")
                return documents, df
            
            logger.info(f"Processing URL as HTML website: {url}")
            soup = BeautifulSoup(response.content, 'html.parser')
            
            for element in soup(["script", "style", "noscript", "iframe"]):
                element.decompose()
            
            title = soup.title.string if soup.title else urlparse(url).path
            
            # Extract main content
            main_content = soup.find('main') or soup.find('article') or soup.find('div', class_='content') or soup.body
            
            if main_content:
                documents = []
                seen_texts = set()  # Avoid duplicates
                chunk_number = 0
                
                # Strategy 1: Extract sections with headings
                for heading in main_content.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
                    heading_text = heading.get_text(strip=True)
                    
                    # Skip very short headings but keep most
                    if not heading_text or len(heading_text) < 3:
                        continue
                    
                    # Normalize text to check duplicates
                    normalized_heading = ' '.join(heading_text.split())
                    if normalized_heading in seen_texts:
                        continue
                    
                    section_content = [heading_text]
                    seen_texts.add(normalized_heading)
                    
                    # Collect content until next heading (within reasonable limit)
                    content_count = 0
                    for sibling in heading.find_next_siblings():
                        if content_count >= 10:  # Limit to avoid too much content per section
                            break
                        if sibling.name and sibling.name.startswith('h'):  # Any heading
                            break
                        
                        if sibling.name in ['p', 'div', 'li', 'ul', 'ol', 'span']:
                            text = sibling.get_text(separator=' ', strip=True)
                            normalized_text = ' '.join(text.split())
                            
                            # Reduced minimum length to capture short descriptions like "Founder & CEO"
                            if normalized_text and len(normalized_text) > 5 and normalized_text not in seen_texts:
                                section_content.append(text)
                                seen_texts.add(normalized_text)
                                content_count += 1
                    
                    # Create document if there's content beyond just the heading (relaxed threshold)
                    full_content = '\n\n'.join(section_content)
                    if len(section_content) > 1 or len(full_content) > 20:
                        doc = Document(
                            page_content=full_content,
                            metadata={
                                "source": url,
                                "title": title,
                                "chunk": chunk_number,
                                "type": "website_section",
                                "heading": heading_text[:100]  # Truncate long headings in metadata
                            }
                        )
                        documents.append(doc)
                        chunk_number += 1
                
                for p in main_content.find_all('p'):
                    text = p.get_text(strip=True)
                    normalized_text = ' '.join(text.split())
                    
                    if normalized_text and len(normalized_text) > 50 and normalized_text not in seen_texts:
                        doc = Document(
                            page_content=text,
                            metadata={
                                "source": url,
                                "title": title,
                                "chunk": chunk_number,
                                "type": "website_paragraph"
                            }
                        )
                        documents.append(doc)
                        seen_texts.add(normalized_text)
                        chunk_number += 1
                
                if documents:
                    logger.info(f"Loaded {len(documents)} documents from website: {url}")
                    return documents, None
                else:
                    domain = urlparse(url).netloc.lower()
                    
                    if any(site in domain for site in ['youtube.com', 'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com']):
                        raise ValueError(
                            f"Cannot scrape {domain} - this site loads content dynamically with JavaScript. "
                            f"Web scraping works best with:\n"
                            f"- Blog posts and articles\n"
                            f"- Documentation sites\n"
                            f"- Company websites\n"
                            f"- News sites\n\n"
                            f"For {domain}, consider using their official API or providing structured data (CSV/JSON) instead."
                        )
                    else:
                        raise ValueError(
                            "Could not extract meaningful content from the website. "
                            "This may be because:\n"
                            "- The page loads content with JavaScript (try a different page)\n"
                            "- The page has no readable text content\n"
                            "- The content is behind a login/paywall\n\n"
                            "Try using a blog post, article, or documentation page instead."
                        )
            else:
                raise ValueError("Could not find main content in the webpage")
            
        except requests.RequestException as e:
            logger.error(f"Error fetching URL: {str(e)}")
            raise ValueError(f"Failed to fetch data from URL: {str(e)}")
        except Exception as e:
            logger.error(f"Error processing URL data: {str(e)}")
            raise ValueError(f"Failed to process URL data: {str(e)}")

    @staticmethod
    def _dict_to_content(data: Dict[str, Any], prefix: str = "") -> str:
        parts = []
        for key, value in data.items():
            full_key = f"{prefix}.{key}" if prefix else key
            
            if isinstance(value, dict):
                parts.append(DataLoader._dict_to_content(value, full_key))
            elif isinstance(value, list):
                parts.append(f"{full_key}: {', '.join(map(str, value))}")
            else:
                parts.append(f"{full_key}: {value}")
        
        return " | ".join(parts)
    
    @staticmethod
    def _flatten_dict(data: Dict[str, Any], prefix: str = "") -> Dict[str, str]:
        result = {}
        for key, value in data.items():
            full_key = f"{prefix}.{key}" if prefix else key
            
            if isinstance(value, dict):
                result.update(DataLoader._flatten_dict(value, full_key))
            elif isinstance(value, (list, tuple)):
                result[full_key] = str(value)
            else:
                result[full_key] = str(value)
        
        return result

    @staticmethod
    def extract_attributes(documents: List[Document]) -> List[str]:
        if not documents:
            return []
        
        # Define junk keywords to filter out of attributes
        exclude_keywords = {
            'id', 'uuid', 'guid', 'key', 'assistant', 'user', 'index', 'number', 
            'row', 'created', 'updated', 'timestamp', 'date', 'time', 'token', 
            'session', 'version', 'hash', 'slug', 'link', 'url', 'uri', 'path'
        }
        
        def is_meaningful(k):
            k_lower = k.lower()
            if any(kw == k_lower or k_lower.endswith(f'_{kw}') or k_lower.startswith(f'{kw}_') for kw in exclude_keywords):
                return False
            return True

        all_keys = set()
        # Look at more documents to find all possible attributes
        for doc in documents[:50]:
            all_keys.update(doc.metadata.keys())
            
        filtered_keys = []
        for k in all_keys:
            if not is_meaningful(k):
                continue
            filtered_keys.append(k)
            
        return sorted(filtered_keys)

    @staticmethod
    def generate_sample_questions(attributes: List[str], data_source_type: str) -> List[str]:
        if attributes:
            if data_source_type in ["csv", "json"]:
                # Professional analytical questions
                questions = [
                    f"Perform a deep-dive analysis on {attributes[0]} patterns.",
                    f"Verify consistency and outliers in {attributes[0]} records."
                ]
                
                if len(attributes) > 1:
                    questions.insert(1, f"Analyze the correlation between {attributes[0]} and {attributes[1]}.")
                    questions.append(f"Synthesize an executive summary focusing on {attributes[1]}.")
                
                return questions[:4]
            else:
                return [
                    "What are the core strategic insights presented here?",
                    "Identify the primary entities and their roles mentioned in this document.",
                    "Synthesize a summary of the key findings from this material.",
                    "Extract the most relevant technical or domain-specific terminology."
                ]
        return [
            "Perform a comprehensive initial analysis of this dataset.",
            "Identify the primary objective and highlight three key metrics.",
            "What strategic questions should I explore to maximize project value?"
        ]
