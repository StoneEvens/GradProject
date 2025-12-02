"""
Local tool helpers for PETer Agent.

These functions contain the logic for tools that don't need database access.
They read from static JSON files and can be used by both the main agent
and the real-time conversation agent.

Benefits:
- No network latency (local execution)
- Single source of truth (shared with MCP server data files)
- Reusable across different agents
"""

import json
import os
import re
from typing import Dict, Optional
from datetime import datetime, timezone, timedelta
import uuid

# =============================================================================
# Path Configuration
# =============================================================================

# Base path for MCP server data files
MCP_SERVER_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'mcp_server')
AIAGENT_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'aiAgent', 'data')


# =============================================================================
# JSON Caching - Load once, reuse forever
# =============================================================================

_NAVIGATION_PATHS_CACHE = None
_GLOSSARY_CACHE = None
_SYSTEM_FAQ_CACHE = None


def _get_navigation_paths():
    """Get cached navigation paths (loads from file on first call)."""
    global _NAVIGATION_PATHS_CACHE
    if _NAVIGATION_PATHS_CACHE is None:
        json_path = os.path.join(MCP_SERVER_DIR, 'navigation_paths.json')
        with open(json_path, 'r', encoding='utf-8') as f:
            _NAVIGATION_PATHS_CACHE = json.load(f)
    return _NAVIGATION_PATHS_CACHE


def _get_glossary():
    """Get cached glossary (loads from file on first call)."""
    global _GLOSSARY_CACHE
    if _GLOSSARY_CACHE is None:
        glossary_path = os.path.join(MCP_SERVER_DIR, 'glossary.json')
        with open(glossary_path, 'r', encoding='utf-8') as f:
            _GLOSSARY_CACHE = json.load(f)
    return _GLOSSARY_CACHE


def _get_system_faq():
    """Get cached system FAQ (loads from file on first call)."""
    global _SYSTEM_FAQ_CACHE
    if _SYSTEM_FAQ_CACHE is None:
        faq_path = os.path.join(AIAGENT_DATA_DIR, 'system_faq.json')
        with open(faq_path, 'r', encoding='utf-8') as f:
            _SYSTEM_FAQ_CACHE = json.load(f)
    return _SYSTEM_FAQ_CACHE


# =============================================================================
# Database Operations (from database_operations.py)
# =============================================================================

from mcp_server.database_operations import get_operation_list_summary, get_operation_usage


def list_database_operations() -> Dict:
    """
    List all available database operations with their required parameters.
    
    Returns:
        Dict with operation names, descriptions, and required/optional params.
    """
    return get_operation_list_summary()


def get_db_operation_details(operation: str) -> Dict:
    """
    Get full details for a specific database operation.
    
    Args:
        operation: The operation name (e.g., 'add_pet', 'create_social_post')
        
    Returns:
        Dict with complete param_details, notes, workflow, response_handling.
    """
    return get_operation_usage(operation)


# =============================================================================
# Tutorial Topics
# =============================================================================

def list_tutorial_topics() -> Dict:
    """
    List available interactive tutorial topics.
    
    Returns:
        Dict mapping tutorial IDs to descriptions.
    """
    try:
        # Hardcoded to match frontend tutorialOptionsMap.json
        topics_map = {
            "tagPet": "學習如何標註寵物",
            "createPost": "學習如何建立發布貼文",
            "calculate": "學習如何使用計算機計算寵物天數及餵食量",
            "addAbnormalPost": "學習如何新增一篇異常貼文",
            "addPet": "學習如何將您的寵物新增到系統中"
        }
        return {
            "success": True,
            "topics": topics_map
        }
    except Exception as e:
        return {"error": f"Failed to list tutorial topics: {str(e)}"}


# =============================================================================
# Navigation
# =============================================================================

def get_navigation_paths() -> Dict:
    """
    Get all valid page paths and their friendly names.
    
    Returns:
        Dict with available_paths and dynamic_paths arrays.
    """
    try:
        return _get_navigation_paths()
    except Exception as e:
        return {
            "error": f"Failed to load navigation paths: {str(e)}",
            "available_paths": [],
            "dynamic_paths": []
        }


def prepare_navigate(path: str, reason: Optional[str] = None) -> Dict:
    """
    Prepare navigation to a page.
    
    Args:
        path: The path to navigate to (e.g., '/home', '/pet/123/edit')
        reason: Optional reason for navigation
        
    Returns:
        Dict with operation details for frontend.
    """
    # Get cached navigation paths to find friendly name
    friendly_name = None
    
    try:
        paths_data = _get_navigation_paths()
        
        # Try static paths first
        for path_info in paths_data.get('available_paths', []):
            if path_info['path'] == path:
                friendly_name = path_info['name']
                break
        
        # Try dynamic paths if not found
        if not friendly_name:
            for path_info in paths_data.get('dynamic_paths', []):
                pattern = path_info['pattern']
                regex_pattern = re.escape(pattern)
                regex_pattern = re.sub(r'\\\{[^}]+\\\}', r'[^/?]+', regex_pattern)
                regex_pattern = f"^{regex_pattern}$"
                
                if re.match(regex_pattern, path):
                    friendly_name = path_info['name']
                    break
    except Exception:
        pass
    
    # Fallback to path itself
    if not friendly_name:
        friendly_name = path
    
    operation_id = f"nav_{uuid.uuid4().hex[:12]}"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    
    confirmation_msg = f"確定要前往{friendly_name}嗎？"
    if reason:
        confirmation_msg += f"\n\n{reason}"
    
    return {
        "operation_id": operation_id,
        "type": "navigate",
        "params": {"path": path},
        "confirmation_message": confirmation_msg,
        "preview": {
            "destination": friendly_name,
            "path": path,
            "reason": reason or "用戶要導航到此頁面"
        },
        "requires_confirmation": True,
        "expires_at": expires_at
    }


# =============================================================================
# Glossary Search
# =============================================================================

def search_glossary(query: str, category: Optional[str] = None, limit: int = 3) -> Dict:
    """
    Search glossary for term definitions.
    
    Args:
        query: Term or keyword to search for
        category: Optional category filter (health, feed, social, schedule, system)
        limit: Maximum number of results
        
    Returns:
        Dict with matching glossary entries.
    """
    try:
        glossary_data = _get_glossary()
        terms = glossary_data.get('terms', [])
        query_lower = query.lower()
        
        # Score each term
        scored_terms = []
        for term_entry in terms:
            if category and term_entry.get('category') != category:
                continue
            
            score = 0
            
            # Exact term match
            if query_lower == term_entry.get('term', '').lower():
                score += 20
            elif query_lower in term_entry.get('term', '').lower():
                score += 15
            elif term_entry.get('term', '').lower() in query_lower:
                score += 12
            
            # Aliases match
            for alias in term_entry.get('aliases', []):
                if query_lower == alias.lower():
                    score += 18
                elif query_lower in alias.lower():
                    score += 10
                elif alias.lower() in query_lower:
                    score += 8
            
            # Definition match
            if query_lower in term_entry.get('definition', '').lower():
                score += 3
            
            # Related terms
            for related in term_entry.get('related_terms', []):
                if query_lower in related.lower():
                    score += 2
            
            if score > 0:
                scored_terms.append({'term': term_entry, 'score': score})
        
        # Sort and limit
        scored_terms.sort(key=lambda x: x['score'], reverse=True)
        top_terms = scored_terms[:limit]
        
        if not top_terms:
            return {
                "success": True,
                "found": False,
                "message": "未找到相關的名詞解釋",
                "suggestion": "請嘗試使用不同的關鍵字"
            }
        
        # Format results
        results = []
        for item in top_terms:
            term = item['term']
            result = {
                "id": term.get('id'),
                "term": term.get('term'),
                "definition": term.get('definition'),
                "category": term.get('category'),
                "relevance_score": item['score']
            }
            
            # Optional fields
            for field in ['aliases', 'usage_example', 'related_terms', 'related_features', 
                         'navigation_path', 'tutorial_types', 'technical_note']:
                if term.get(field):
                    result[field] = term.get(field)
            
            results.append(result)
        
        return {
            "success": True,
            "found": True,
            "query": query,
            "count": len(results),
            "results": results,
            "message": f"找到 {len(results)} 個相關的名詞解釋"
        }
    
    except FileNotFoundError:
        return {"success": False, "error": "名詞詞彙表文件不存在"}
    except Exception as e:
        return {"success": False, "error": f"搜尋名詞解釋時發生錯誤: {str(e)}"}


# =============================================================================
# System FAQ Search
# =============================================================================

def search_system_faq(query: str, category: Optional[str] = None, limit: int = 3) -> Dict:
    """
    Search FAQ for how-to questions about app features.
    
    Args:
        query: User's question or keywords
        category: Optional category filter (account, social, pet, health, feed, forum, setting, system)
        limit: Maximum number of results
        
    Returns:
        Dict with matching FAQ entries.
    """
    try:
        faq_data = _get_system_faq()
        faqs = faq_data.get('faqs', [])
        query_lower = query.lower()
        
        # Score each FAQ
        scored_faqs = []
        for faq in faqs:
            if category and faq.get('category') != category:
                continue
            
            score = 0
            
            # Name match
            if query_lower in faq.get('name', '').lower():
                score += 10
            
            # Use cases match
            for use_case in faq.get('use_cases', []):
                if query_lower in use_case.lower() or use_case.lower() in query_lower:
                    score += 8
            
            # Keywords match
            for keyword in faq.get('keywords', []):
                if keyword.lower() in query_lower:
                    score += 3
            
            # Description match
            if query_lower in faq.get('description', '').lower():
                score += 2
            
            if score > 0:
                scored_faqs.append({'faq': faq, 'score': score})
        
        # Sort and limit
        scored_faqs.sort(key=lambda x: x['score'], reverse=True)
        top_faqs = scored_faqs[:limit]
        
        if not top_faqs:
            return {
                "success": True,
                "found": False,
                "message": "未找到相關的 FAQ 項目",
                "suggestion": "請嘗試使用不同的關鍵字"
            }
        
        # Format results
        results = []
        for item in top_faqs:
            faq = item['faq']
            result = {
                "id": faq.get('id'),
                "question": faq.get('name'),
                "answer": faq.get('answer'),
                "category": faq.get('category'),
                "relevance_score": item['score']
            }
            
            # Tutorial info
            if faq.get('has_tutorial'):
                result['has_tutorial'] = True
                result['tutorial_type'] = faq.get('tutorial_type')
                result['tutorial_note'] = "可提供互動式教學"
            
            # Optional fields
            for field in ['keywords', 'navigation_path', 'related_faqs', 'steps']:
                if faq.get(field):
                    result[field] = faq.get(field)
            
            results.append(result)
        
        return {
            "success": True,
            "found": True,
            "query": query,
            "count": len(results),
            "results": results,
            "message": f"找到 {len(results)} 個相關的 FAQ"
        }
    
    except FileNotFoundError:
        return {"success": False, "error": "FAQ 文件不存在"}
    except Exception as e:
        return {"success": False, "error": f"搜尋 FAQ 時發生錯誤: {str(e)}"}


# =============================================================================
# Feed OCR Preparation
# =============================================================================

def prepare_feed_ocr(reason: str = "辨識飼料資訊") -> Dict:
    """
    Prepare feed OCR analysis operation.
    
    Args:
        reason: Analysis reason (displayed to user)
        
    Returns:
        Dict with operation details for frontend.
    """
    return {
        "operation_id": f"ocr_{int(datetime.now().timestamp())}",
        "type": "ocr_feed_analysis",
        "purpose": "feed_nutrition",
        "requires_user_action": False,
        "next_step": "前端將自動辨識並回傳結果"
    }


# =============================================================================
# Local Tools Registry (for meta-tool pattern)
# =============================================================================

LOCAL_TOOLS_REGISTRY = {
    "list_database_operations": {
        "function": list_database_operations,
        "description": "List all database operations with required/optional params",
        "params": {},
        "use_when": "Need to know what database operations are available",
    },
    "get_db_operation_details": {
        "function": get_db_operation_details,
        "description": "Get full workflow details for a database operation",
        "params": {"operation": "Operation name (e.g., 'add_pet', 'create_social_post')"},
        "use_when": "About to call perform_database_operation - MUST call this first",
    },
    "list_tutorial_topics": {
        "function": list_tutorial_topics,
        "description": "List interactive tutorial topics",
        "params": {},
        "use_when": "User asks how to do something or wants to learn a feature",
    },
    "get_navigation_paths": {
        "function": get_navigation_paths,
        "description": "Get all valid page paths and friendly names",
        "params": {},
        "use_when": "Need to find correct path before navigating",
    },
    "prepare_navigate": {
        "function": prepare_navigate,
        "description": "Prepare navigation operation for frontend",
        "params": {"path": "Target path (e.g., '/home', '/pet/123')", "reason": "(optional) Reason for navigation"},
        "use_when": "User wants to go to a specific page",
    },
    "search_glossary": {
        "function": search_glossary,
        "description": "Search for term definitions and concepts",
        "params": {"query": "Term to search", "category": "(optional) Filter category", "limit": "(optional) Max results, default 3"},
        "use_when": "User asks '什麼是...', '...是什麼意思' (what is X?)",
    },
    "search_system_faq": {
        "function": search_system_faq,
        "description": "Search FAQ for how-to questions",
        "params": {"query": "Question keywords", "category": "(optional) Filter category", "limit": "(optional) Max results, default 3"},
        "use_when": "User asks '如何...', '怎麼...' (how to do X?)",
    },
    "prepare_feed_ocr": {
        "function": prepare_feed_ocr,
        "description": "Trigger OCR for feed nutrition labels",
        "params": {"reason": "(optional) Analysis reason"},
        "use_when": "User uploads 2 images for feed analysis (hasImages=true, imageCount>=2)",
    },
}


def get_local_tools_summary() -> Dict:
    """
    Get a summary of all local tools for the agent.
    
    Returns:
        Dict with tool names, descriptions, params, and use_when hints.
    """
    tools_summary = {}
    for name, info in LOCAL_TOOLS_REGISTRY.items():
        tools_summary[name] = {
            "description": info["description"],
            "params": info["params"],
            "use_when": info["use_when"],
        }
    return tools_summary


def execute_local_tool(tool_name: str, params: Dict = None) -> Dict:
    """
    Execute a local tool by name with parameters.
    
    Args:
        tool_name: Name of the tool from LOCAL_TOOLS_REGISTRY
        params: Dict of parameters to pass to the tool
        
    Returns:
        Tool result or error dict.
    """
    if tool_name not in LOCAL_TOOLS_REGISTRY:
        return {
            "error": f"Unknown tool: {tool_name}",
            "available_tools": list(LOCAL_TOOLS_REGISTRY.keys())
        }
    
    try:
        tool_info = LOCAL_TOOLS_REGISTRY[tool_name]
        params = params or {}
        result = tool_info["function"](**params)
        return result if isinstance(result, dict) else {"result": result}
    except TypeError as e:
        return {
            "error": f"Invalid parameters: {e}",
            "expected_params": tool_info["params"]
        }
    except Exception as e:
        return {"error": f"Tool execution failed: {e}"}
