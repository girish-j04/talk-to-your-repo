import os
import asyncio
import shutil
import tempfile
from typing import List, Dict, Any, Optional
from pathlib import Path
import subprocess
import hashlib
import logging
import json

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import google.generativeai as genai
import numpy as np
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Talk-to-Your-Repo API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyDcYbr7xqUwTknLkUvOu8eyvqzmNuLmCwo")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

genai.configure(api_key=GEMINI_API_KEY)

# In-memory storage (replace with proper DB in production)
repos_data: Dict[str, Dict] = {}

# Pydantic models
class RepoRequest(BaseModel):
    github_url: HttpUrl

class ChatRequest(BaseModel):
    repo_id: str
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = []

class ChatResponse(BaseModel):
    response: str
    sources: List[Dict[str, Any]]

class RepoInfo(BaseModel):
    repo_id: str
    name: str
    status: str
    file_count: int
    processed_chunks: int

# Utility functions
def get_repo_id(github_url: str) -> str:
    """Generate a unique ID for the repository"""
    return hashlib.md5(github_url.encode()).hexdigest()

def clone_repository(github_url: str, target_dir: Path) -> bool:
    """Clone a GitHub repository to target directory"""
    try:
        result = subprocess.run(
            ["git", "clone", "--depth", "1", github_url, str(target_dir)],
            capture_output=True,
            text=True,
            timeout=60
        )
        return result.returncode == 0
    except Exception as e:
        logger.error(f"Failed to clone repository: {e}")
        return False

def get_file_content(file_path: Path) -> Optional[str]:
    """Read file content with encoding detection"""
    try:
        # Try UTF-8 first
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except UnicodeDecodeError:
        try:
            # Try latin-1 as fallback
            with open(file_path, 'r', encoding='latin-1') as f:
                return f.read()
        except Exception:
            return None
    except Exception:
        return None

def should_process_file(file_path: Path) -> bool:
    """Determine if a file should be processed"""
    # Skip common non-text files and directories
    skip_extensions = {
        # Images
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
        # Fonts
        '.woff', '.woff2', '.ttf', '.eot', '.otf',
        # Archives
        '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
        # Compiled
        '.pyc', '.pyo', '.class', '.o', '.so', '.dll', '.exe',
        # Minified
        '.min.js', '.min.css', '.min.html',
        # Maps and logs
        '.map', '.log', '.tmp', '.temp',
        # Media
        '.mp4', '.mp3', '.avi', '.mov', '.wav', '.pdf',
        # Lock files
        '.lock',
        # Database files (optional - you might want to include some)
        '.db', '.sqlite', '.sqlite3'
    }
    
    skip_dirs = {
        # Version control
        '.git', '.svn', '.hg',
        # Dependencies
        'node_modules', 'vendor', 'packages',
        # Python
        '__pycache__', '.venv', 'venv', 'env', 'site-packages',
        # Build outputs
        'dist', 'build', 'out', 'target', 'bin', 'obj',
        # IDE
        '.vscode', '.idea', '.eclipse',
        # Next.js / React
        '.next', '.nuxt', 'coverage', '.nyc_output',
        # Testing
        '.pytest_cache', 'htmlcov', 'test-results',
        # Temporary
        'tmp', 'temp', '.tmp', '.temp',
        # OS
        '.DS_Store', 'Thumbs.db'
    }
    
    # Whitelist important config files that start with .
    important_dotfiles = {'.env', '.gitignore', '.dockerignore', '.editorconfig', '.eslintrc'}
    
    # Debug logging
    relative_path_str = str(file_path)
    logger.info(f"Checking file: {relative_path_str}")
    
    # Skip if any parent directory is in skip_dirs
    for part in file_path.parts:
        if part in skip_dirs:
            logger.info(f"Skipped {relative_path_str}: directory '{part}' in skip list")
            return False
    
    # Handle dotfiles
    filename = file_path.name
    if filename.startswith('.'):
        if filename not in important_dotfiles:
            logger.info(f"Skipped {relative_path_str}: dotfile not in whitelist")
            return False
    
    # Skip by extension
    if file_path.suffix.lower() in skip_extensions:
        logger.info(f"Skipped {relative_path_str}: extension '{file_path.suffix}' in skip list")
        return False
    
    # Skip very large files (> 1MB)
    try:
        file_size = file_path.stat().st_size
        if file_size > 1024 * 1024:
            logger.info(f"Skipped {relative_path_str}: too large ({file_size / 1024 / 1024:.1f}MB)")
            return False
    except Exception as e:
        logger.warning(f"Skipped {relative_path_str}: could not get file size - {e}")
        return False
    
    # Skip empty files
    try:
        if file_path.stat().st_size == 0:
            logger.info(f"Skipped {relative_path_str}: empty file")
            return False
    except Exception as e:
        logger.warning(f"Skipped {relative_path_str}: could not check if empty - {e}")
        return False
    
    logger.info(f"✅ Will process: {relative_path_str}")
    return True

def chunk_content(content: str, file_path: str, max_chunk_size: int = 1000) -> List[Dict[str, Any]]:
    """Split content into chunks with metadata"""
    chunks = []
    lines = content.split('\n')
    
    current_chunk = []
    current_size = 0
    
    for i, line in enumerate(lines):
        line_size = len(line)
        
        if current_size + line_size > max_chunk_size and current_chunk:
            # Save current chunk
            chunk_content = '\n'.join(current_chunk)
            chunks.append({
                'content': chunk_content,
                'file_path': file_path,
                'start_line': i - len(current_chunk) + 1,
                'end_line': i,
                'chunk_id': len(chunks)
            })
            current_chunk = []
            current_size = 0
        
        current_chunk.append(line)
        current_size += line_size
    
    # Add remaining chunk
    if current_chunk:
        chunk_content = '\n'.join(current_chunk)
        chunks.append({
            'content': chunk_content,
            'file_path': file_path,
            'start_line': len(lines) - len(current_chunk) + 1,
            'end_line': len(lines),
            'chunk_id': len(chunks)
        })
    
    return chunks

async def get_gemini_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings using Gemini API"""
    try:
        embeddings = []
        
        # Process in batches to avoid rate limits
        batch_size = 10
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = []
            
            for text in batch:
                # Use the text embedding model - simplified parameters
                try:
                    result = genai.embed_content(
                        model="models/text-embedding-004",
                        content=text,
                        task_type="semantic_similarity"
                        # Removed title parameter to avoid the warning
                    )
                    batch_embeddings.append(result['embedding'])
                except Exception as e:
                    logger.warning(f"Failed to get embedding for text: {e}")
                    # Create a zero vector as fallback
                    batch_embeddings.append([0.0] * 768)
                
                # Small delay to respect rate limits
                await asyncio.sleep(0.1)
            
            embeddings.extend(batch_embeddings)
            
        return embeddings
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        # Return zero vectors as fallback
        return [[0.0] * 768 for _ in texts]

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors"""
    try:
        dot_product = sum(x * y for x, y in zip(a, b))
        magnitude_a = sum(x * x for x in a) ** 0.5
        magnitude_b = sum(x * x for x in b) ** 0.5
        
        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0
            
        return dot_product / (magnitude_a * magnitude_b)
    except:
        return 0.0

async def process_repository(github_url: str, repo_id: str):
    """Process repository in background"""
    logger.info(f"Processing repository: {github_url}")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        repo_dir = Path(temp_dir) / "repo"
        
        # Clone repository
        if not clone_repository(github_url, repo_dir):
            repos_data[repo_id]["status"] = "failed"
            repos_data[repo_id]["error"] = "Failed to clone repository"
            return
        
        # Process files
        all_chunks = []
        file_count = 0
        skipped_count = 0
        
        logger.info("Scanning files...")
        for file_path in repo_dir.rglob("*"):
            if file_path.is_file():
                if should_process_file(file_path):
                    content = get_file_content(file_path)
                    if content:
                        file_count += 1
                        relative_path = file_path.relative_to(repo_dir)
                        logger.info(f"Processing: {relative_path}")
                        chunks = chunk_content(content, str(relative_path))
                        all_chunks.extend(chunks)
                        
                        # Limit total chunks to avoid excessive processing
                        if len(all_chunks) > 500:
                            logger.info("Reached chunk limit (500), stopping processing")
                            break
                    else:
                        logger.info(f"Skipped (encoding issues): {file_path.relative_to(repo_dir)}")
                        skipped_count += 1
                else:
                    skipped_count += 1
        
        logger.info(f"File scan complete: {file_count} files processed, {skipped_count} files skipped")
        
        # Generate embeddings
        logger.info(f"Generating embeddings for {len(all_chunks)} chunks")
        chunk_contents = [chunk['content'] for chunk in all_chunks]
        embeddings = await get_gemini_embeddings(chunk_contents)
        
        # Store in memory
        repos_data[repo_id].update({
            "status": "ready",
            "chunks": all_chunks,
            "embeddings": embeddings,
            "file_count": file_count,
            "processed_chunks": len(all_chunks)
        })
        
        logger.info(f"Repository processed successfully: {file_count} files, {len(all_chunks)} chunks")

async def find_relevant_chunks(query: str, repo_id: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Find most relevant chunks for a query"""
    if repo_id not in repos_data or repos_data[repo_id]["status"] != "ready":
        return []
    
    # Get query embedding
    query_embeddings = await get_gemini_embeddings([query])
    if not query_embeddings:
        return []
    
    query_embedding = query_embeddings[0]
    
    # Calculate similarities
    similarities = []
    for embedding in repos_data[repo_id]["embeddings"]:
        similarity = cosine_similarity(query_embedding, embedding)
        similarities.append(similarity)
    
    # Get top-k most similar chunks
    indexed_similarities = list(enumerate(similarities))
    indexed_similarities.sort(key=lambda x: x[1], reverse=True)
    top_indices = [idx for idx, _ in indexed_similarities[:top_k]]
    
    relevant_chunks = []
    for idx in top_indices:
        chunk = repos_data[repo_id]["chunks"][idx].copy()
        chunk["similarity"] = similarities[idx]
        relevant_chunks.append(chunk)
    
    return relevant_chunks

async def generate_response(query: str, relevant_chunks: List[Dict], conversation_history: List[Dict]) -> str:
    """Generate response using Gemini"""
    
    # Build context from relevant chunks
    context = "\n\n".join([
        f"File: {chunk['file_path']} (lines {chunk['start_line']}-{chunk['end_line']})\n```\n{chunk['content']}\n```"
        for chunk in relevant_chunks
    ])
    
    # Build conversation history
    history_text = ""
    if conversation_history:
        history_text = "\n".join([
            f"{'User' if msg['role'] == 'user' else 'Assistant'}: {msg['content']}"
            for msg in conversation_history[-5:]  # Last 5 messages
        ])
    
    prompt = f"""You are an expert code assistant helping developers understand and work with codebases. 

Based on the following code context from the repository, please answer the user's question:

{context}

{"Previous conversation:" + history_text if history_text else ""}

User Question: {query}

Please provide a helpful, accurate response. When referencing specific code, mention the file name and line numbers. If you're suggesting code changes or generating new code, make sure it's consistent with the existing codebase style and patterns."""

    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = await asyncio.to_thread(model.generate_content, prompt)
        return response.text
    except Exception as e:
        logger.error(f"Error generating response: {e}")
        return "I encountered an error while processing your request. Please try again."

# API Routes
@app.post("/api/repos/process", response_model=RepoInfo)
async def process_repo(request: RepoRequest, background_tasks: BackgroundTasks):
    """Process a GitHub repository"""
    github_url = str(request.github_url)
    repo_id = get_repo_id(github_url)
    
    # Extract repo name
    repo_name = github_url.split('/')[-1].replace('.git', '')
    
    # Initialize repo data
    repos_data[repo_id] = {
        "name": repo_name,
        "github_url": github_url,
        "status": "processing",
        "file_count": 0,
        "processed_chunks": 0
    }
    
    # Start background processing
    background_tasks.add_task(process_repository, github_url, repo_id)
    
    return RepoInfo(
        repo_id=repo_id,
        name=repo_name,
        status="processing",
        file_count=0,
        processed_chunks=0
    )

@app.get("/api/repos/{repo_id}/status", response_model=RepoInfo)
async def get_repo_status(repo_id: str):
    """Get repository processing status"""
    if repo_id not in repos_data:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    repo_data = repos_data[repo_id]
    return RepoInfo(
        repo_id=repo_id,
        name=repo_data["name"],
        status=repo_data["status"],
        file_count=repo_data.get("file_count", 0),
        processed_chunks=repo_data.get("processed_chunks", 0)
    )

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_repo(request: ChatRequest):
    """Chat with a processed repository"""
    if request.repo_id not in repos_data:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    if repos_data[request.repo_id]["status"] != "ready":
        raise HTTPException(status_code=400, detail="Repository is not ready for chat")
    
    # Find relevant chunks
    relevant_chunks = await find_relevant_chunks(request.message, request.repo_id)
    
    # Generate response
    response_text = await generate_response(
        request.message, 
        relevant_chunks, 
        request.conversation_history
    )
    
    return ChatResponse(
        response=response_text,
        sources=[{
            "file_path": chunk["file_path"],
            "start_line": chunk["start_line"],
            "end_line": chunk["end_line"],
            "similarity": chunk["similarity"]
        } for chunk in relevant_chunks]
    )

@app.get("/api/repos/{repo_id}/files")
async def get_repo_files(repo_id: str):
    """Get file tree for a repository"""
    if repo_id not in repos_data or repos_data[repo_id]["status"] != "ready":
        raise HTTPException(status_code=404, detail="Repository not found or not ready")
    
    # Extract unique file paths from chunks
    chunks = repos_data[repo_id]["chunks"]
    files = list(set(chunk["file_path"] for chunk in chunks))
    
    # Build file tree structure
    file_tree = {}
    for file_path in sorted(files):
        parts = file_path.split('/')
        current = file_tree
        
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        
        # Add file
        current[parts[-1]] = {
            "type": "file",
            "path": file_path
        }
    
    return {"file_tree": file_tree}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "embedding_model": "gemini-text-embedding-004"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)