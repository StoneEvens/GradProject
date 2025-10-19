from fastapi import FastAPI, WebSocket, HTTPException, Security, Depends
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from playwright.async_api import async_playwright
import asyncio
import json
import logging
import uvicorn
import os
import sys
from datetime import datetime

# Fix for Windows asyncio event loop policy
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security setup
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME)
API_KEY = os.getenv("MCP_API_KEY", "your-default-api-key")  # Set this in production
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:4173").split(",")

app = FastAPI(title="Web Control MCP Server")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store browser instances
browser_sessions: Dict[str, Any] = {}

class WebAction(BaseModel):
    action: str
    selector: Optional[str] = None
    text: Optional[str] = None
    url: Optional[str] = None
    timeout: Optional[int] = 30000  # 30 seconds default timeout

async def cleanup_old_sessions():
    while True:
        current_time = datetime.now()
        to_remove = []
        for session_id, session in browser_sessions.items():
            if (current_time - session["last_accessed"]).seconds > 3600:  # 1 hour timeout
                to_remove.append(session_id)
        
        for session_id in to_remove:
            try:
                await close_session(session_id)
            except Exception as e:
                logger.error(f"Error cleaning up session {session_id}: {str(e)}")
        
        await asyncio.sleep(300)  # Check every 5 minutes

@app.on_event("startup")
async def startup_event():
    logger.info("Starting MCP Server...")
    asyncio.create_task(cleanup_old_sessions())

@app.on_event("shutdown")
async def shutdown_event():
    # Clean up browser sessions
    for session_id, session in browser_sessions.items():
        if 'browser' in session:
            try:
                await session['browser'].close()
                await session['playwright'].stop()
            except Exception as e:
                logger.error(f"Error closing session {session_id}: {str(e)}")
    logger.info("Shutting down MCP Server...")

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(
            status_code=403,
            detail="Invalid API key"
        )
    return api_key

@app.post("/session/create")
async def create_session(api_key: str = Depends(verify_api_key)):
    try:
        playwright = await async_playwright().start()
        # Launch browser in headless mode for server deployment
        browser = await playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        context = await browser.new_context()
        page = await context.new_page()
        
        session_id = f"session_{datetime.now().timestamp()}"
        browser_sessions[session_id] = {
            "playwright": playwright,
            "browser": browser,
            "context": context,
            "page": page,
            "created_at": datetime.now(),
            "last_accessed": datetime.now()
        }
        
        return {"session_id": session_id, "status": "created"}
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/session/{session_id}/action")
async def execute_action(session_id: str, action: WebAction):
    if session_id not in browser_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    page = browser_sessions[session_id]["page"]
    try:
        if action.action == "navigate":
            if not action.url:
                raise HTTPException(status_code=400, detail="URL is required for navigation")
            await page.goto(action.url, timeout=action.timeout)
            return {"status": "success", "action": "navigate", "url": action.url}
            
        elif action.action == "click":
            if not action.selector:
                raise HTTPException(status_code=400, detail="Selector is required for clicking")
            await page.click(action.selector, timeout=action.timeout)
            return {"status": "success", "action": "click", "selector": action.selector}
            
        elif action.action == "type":
            if not action.selector or action.text is None:
                raise HTTPException(status_code=400, detail="Selector and text are required for typing")
            await page.fill(action.selector, action.text, timeout=action.timeout)
            return {"status": "success", "action": "type", "selector": action.selector}
            
        elif action.action == "get_text":
            if not action.selector:
                raise HTTPException(status_code=400, detail="Selector is required for getting text")
            text = await page.text_content(action.selector, timeout=action.timeout)
            return {"status": "success", "action": "get_text", "text": text}
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported action: {action.action}")
            
    except Exception as e:
        logger.error(f"Error executing action: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/session/{session_id}")
async def close_session(session_id: str):
    if session_id not in browser_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        session = browser_sessions[session_id]
        await session["browser"].close()
        await session["playwright"].stop()
        del browser_sessions[session_id]
        return {"status": "success", "message": f"Session {session_id} closed"}
    except Exception as e:
        logger.error(f"Error closing session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Use a different event loop implementation for Windows
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # Disable reload on Windows to avoid event loop issues
    uvicorn.run("mcp_server:app", host="127.0.0.1", port=5000, reload=False)