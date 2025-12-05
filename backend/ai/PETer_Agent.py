"""
PETer Agent - Main AI Agent for the PETer pet care app.

This agent uses a mix of:
- Local tools (instant, no network) for static data lookups
- MCP tools (network) for database operations
"""

from datetime import datetime
from agents import Agent, ModelSettings, Runner, RunConfig, trace, function_tool
from agents.mcp import MCPServerSse
from agents.memory import OpenAIConversationsSession
from pydantic import BaseModel, Field
import json

# Import from local_tools
from ai.local_tools import (
    LOCAL_TOOLS_REGISTRY,
    get_local_tools_summary,
    execute_local_tool,
)

workflow_id = "wf_68fee4a8907881908aad9aaf9cf500b2000a3772ba65199b"


# =============================================================================
# Meta-Tools (wrap registry functions with @function_tool)
# =============================================================================

@function_tool
def list_local_tools() -> str:
    """
    List all available local tools with their descriptions and parameters.
    Call this first to see what local tools are available before using use_local_tool.
    Local tools are fast (no network) and handle: database operation lookups, navigation,
    glossary/FAQ search, tutorials, and OCR preparation.
    """
    return json.dumps(get_local_tools_summary(), ensure_ascii=False, indent=2)


@function_tool
def use_local_tool(tool_name: str, params: str = "{}") -> str:
    """
    Execute a local tool by name with JSON parameters.
    
    Args:
        tool_name: Name of the tool (from list_local_tools)
        params: JSON string of parameters, e.g. '{"query": "飼料", "limit": 5}'
    
    Examples:
        use_local_tool("search_glossary", '{"query": "疾病檔案"}')
        use_local_tool("get_db_operation_details", '{"operation": "add_pet"}')
        use_local_tool("prepare_navigate", '{"path": "/home"}')
    """
    try:
        parsed_params = json.loads(params) if params else {}
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON params: {e}"}, ensure_ascii=False)
    
    result = execute_local_tool(tool_name, parsed_params)
    return json.dumps(result, ensure_ascii=False, indent=2)


# =============================================================================
# MCP Server Configuration (with tool caching for performance)
# =============================================================================

MCP_SERVER_URL = "https://peter.geniusbee.net/mcp/sse"
MCP_ALLOWED_TOOLS = [
    "get_user_pet_info_detailed",
    "get_user_pet_list",
    "get_post_recommendations",
    "get_user_information",
    "get_user_pet_types",
    "get_pet_foods_details",
    "resolve_entity_context",
    "perform_database_operation",
]


def create_mcp_server():
    """Create MCP server with tool caching enabled."""
    from agents.mcp import create_static_tool_filter
    return MCPServerSse(
        name="PETer MCP Server",
        params={"url": MCP_SERVER_URL},
        cache_tools_list=True,  # Cache tool schemas for faster subsequent calls
        tool_filter=create_static_tool_filter(allowed_tool_names=MCP_ALLOWED_TOOLS),
    )


# =============================================================================
# Schema Definitions
# =============================================================================

class WorkflowInput(BaseModel):
    """Top-level input to the workflow."""
    input_as_text: str = Field(..., description="End-user message in plain text.")


class SummaryAgentSchema__OperationsItem(BaseModel):
    """One UI operation the app should perform for the user."""
    operation_type: str = Field(..., description="Operation type: 'navigate', 'ocr_feed_analysis', etc.")
    operation_data: str = Field(
        ...,
        description=(
            "JSON string with operation parameters. "
            "For 'navigate': {\"path\": \"/target\", \"destination\": \"頁面名稱\"}. "
            "For 'post_created': {\"post_id\": 123, \"status\": \"pending_images\"}."
        )
    )


class RecommendedUser(BaseModel):
    """One recommended user."""
    user_id: str | int = Field(..., description="Unique identifier of the user.")
    display_name: str = Field(..., description="User-facing display name.")
    user_details: str = Field(..., description="Short description why this user is recommended.")
    headshot_url: str | None = Field(None, description="URL of the user's profile picture.")
    user_account: str | None = Field(None, description="User's account name/username.")
    user_fullname: str | None = Field(None, description="User's full name.")


class PostRecommendation(BaseModel):
    """One recommended post."""
    post_id: str | int = Field(..., description="Unique identifier of the post.")
    title: str = Field(..., description="Post title or succinct label.")
    post_details: str = Field(..., description="Short rationale for why this post is recommended.")
    created_at: str | None = Field(None, description="ISO8601 timestamp if available.")
    user_fullname: str | None = Field(None, description="Author display name.")
    location: str | None = Field(None, description="Location string if applicable.")


class SummaryAgentSchema(BaseModel):
    """Final structured response returned to the app."""
    reply: str = Field(..., description="Natural language reply for the user (no raw JSON).")
    tutorial: str = Field(..., description="Tutorial id if applicable; else empty string.")
    operations: list[SummaryAgentSchema__OperationsItem] = Field(
        default_factory=list,
        description="List of operations for the client to perform."
    )
    recommended_users: list[RecommendedUser] = Field(
        default_factory=list,
        description="List of recommended users."
    )
    recommended_social_posts: list[PostRecommendation] = Field(
        default_factory=list,
        description="List of recommended social posts."
    )
    recommended_forum_posts: list[PostRecommendation] = Field(
        default_factory=list,
        description="List of recommended forum posts."
    )


# =============================================================================
# Agent Instructions
# =============================================================================

AGENT_INSTRUCTIONS = """
You are PETer, a helpful assistant for a pet care app.
Your job: understand user intent → call tools → return structured response.

=== OUTPUT SCHEMA RULES ===
ALWAYS return ALL fields. Use empty string/list if not applicable.

1. reply (REQUIRED string):
   - Friendly, SHORT conversational text for the user
   - Same language as user's question
   - NO raw JSON, NO technical IDs, NO data dumps, NO internal references, NO urls
   - DO NOT repeat/list data that's already in operations, recommended_users, recommended_posts, confirmation messages
   - DO NOT say [[NEEDS_CONFIRMATION_DISEASE_ARCHIVE]]
   - If data is in structured fields, just say "這是我找到的結果" or similar brief response
   - Only elaborate in reply when there's NO structured data to show

2. tutorial (string, empty if none):
   - Set ONLY if user asks 'how to' do something AND list_tutorial_topics has a match
   - Values: 'tagPet', 'createPost', 'calculate', 'addAbnormalPost', 'addPet'

3. operations (list, empty if none):
   - Add when frontend needs to DO something (navigate, OCR, upload images, etc.)
   - navigate: {path, destination} - GET destination from prepare_navigate result's preview.destination
   - post_created: {post_id, status: 'pending_images'} - triggers image upload
   - abnormal_post_created: {abnormal_post_id, pet_id, status: 'pending_images'}
   - feed_created: {feed_id, status: 'pending_images'}

4-6. recommendation lists: Populate ONLY from tool results, include IDs.
   - Frontend will display these, so DON'T repeat them in reply text.

=== TOOL SELECTION GUIDE ===

-- LOCAL TOOLS (use_local_tool) --
For fast local operations, use: use_local_tool(tool_name, params_json)
Call list_local_tools() first if unsure which tool to use.

Examples:
  use_local_tool("search_glossary", '{"query": "疾病檔案"}')
  use_local_tool("get_db_operation_details", '{"operation": "add_pet"}')
  use_local_tool("prepare_navigate", '{"path": "/home"}')

Available local tools:
- search_glossary: User asks '什麼是...' (what is X?)
- search_system_faq: User asks '如何...' (how to do X?)
- list_tutorial_topics: User wants to learn a feature
- get_navigation_paths: Get valid paths before navigating
- prepare_navigate: User wants to go somewhere
- list_database_operations: See available database operations
- get_db_operation_details: Get workflow before database operation
- prepare_feed_ocr: User uploads feed images

-- MCP TOOLS (PET & USER INFO) --
User asks about THEIR pets/health records → get_user_pet_info_detailed
User asks pet names/types only → get_user_pet_list
User asks details about SPECIFIC users (by ID/name) → get_user_information
User asks what pets a user owns → get_user_pet_types

-- MCP TOOLS (CONTENT & RECOMMENDATIONS) --
User wants social post recommendations → get_post_recommendations(isSocial=true)
User wants forum/article recommendations → get_post_recommendations(isForum=true)
User wants to FIND/RECOMMEND users (e.g., "養貓的用戶") → get_post_recommendations, then extract post authors as recommended_users
User asks about pet food/nutrition → get_pet_foods_details

TIPS for get_post_recommendations:
- EXPAND user's query with RELEVANT synonyms and related terms
- content_description: include user's terms + related words
  Example: "貓咪" → "貓咪 貓貓 喵星人 可愛 日常"
  Example: "走失" → "走失 失蹤 不見 協尋 找貓"
  Example: "狗狗健康" → "狗狗 健康 生病 看醫生 獸醫 照護"
- hashtags: extract main topics as tags
- Do NOT add unrelated terms - only expand with semantically related words

-- NAVIGATION --
User wants to go somewhere → use_local_tool("get_navigation_paths"), then use_local_tool("prepare_navigate", ...)
User mentions specific pet/post/report → resolve_entity_context to get ID first

-- DATA OPERATIONS --
User wants to add/update/delete data:
  1. use_local_tool("list_database_operations") → see available operations
  2. use_local_tool("get_db_operation_details", '{"operation": "..."}') → get FULL workflow
  3. Follow the workflow, ASK user for required params - NEVER invent values
  4. Show preview and wait for confirmation
  5. Call perform_database_operation with BOTH parameters:
     - operation: the operation name (e.g., "create_disease_archive")
     - data: a dict with ALL required params (e.g., {"user_id": 1, "pet_id": 2, "archive_title": "...", "abnormal_post_ids": [1,2,3], ...})
     Example: perform_database_operation(operation="create_disease_archive", data={"user_id": 1, "pet_id": 5, "archive_title": "Joe的感冒記錄", "abnormal_post_ids": [10, 11], "main_cause": "感冒"})
  6. Follow response_handling to format reply and add operations

-- SCHEDULE/PLAN OPERATIONS --
NOTE: 'plan' is NOT supported by resolve_entity_context.
User wants to view/cancel/modify a plan:
  1. Get user's pet ID via get_user_pet_list
  2. perform_database_operation('list_plans', {user_id, pet_id, start_date, end_date})
  3. Find matching plan from list
  4. perform_database_operation('delete_plan', {user_id, plan_id}) or 'update_plan'

-- ENTITY RESOLUTION --
User refers to 'my cat' or 'latest post' → resolve_entity_context
Supports: pet, social_post, feed, user, health_report, disease_archive, abnormal_post
NOT supported: plan/schedule (use list_plans instead)

=== CRITICAL RULES ===
- NEVER invent data. Only use what tools return.
- NEVER invent user input for database operations.
- NEVER dump raw JSON to user in reply.
- NEVER use placeholder values like 'new' or 'X' in operations.
- ALWAYS call get_db_operation_details before perform_database_operation.
- ALWAYS show preview and get confirmation before write operations.
- ALWAYS include IDs in recommendation objects.
- Use 'add_plan' for schedules, NOT 'create_schedule'.
"""


# =============================================================================
# Agent Definition
# =============================================================================

def create_peter_agent(mcp_server):
    """Create the PETer agent with MCP server."""
    return Agent(
        name="PETer Agent",
        instructions=AGENT_INSTRUCTIONS,
        model="gpt-5.1",
        mcp_servers=[mcp_server],  # MCP tools (database operations) - with caching
        tools=[
            # Meta-tools for local operations (2 tools instead of 8)
            list_local_tools,
            use_local_tool,
        ],
        output_type=SummaryAgentSchema,
        model_settings=ModelSettings(
            store=True,
            truncation="auto",
            temperature=0.2,
            parallel_tool_calls=True,
            max_output_tokens=512,
        )
    )


# =============================================================================
# Workflow Functions
# =============================================================================

# Global MCP server instance for connection reuse
_mcp_server = None
_mcp_server_connected = False


async def get_mcp_server():
    """Get or create the global MCP server instance with automatic reconnection."""
    global _mcp_server, _mcp_server_connected
    
    # Create server instance if not exists
    if _mcp_server is None:
        print("[PETer_Agent] Creating new MCP server instance...")
        _mcp_server = create_mcp_server()
    
    # Connect if not connected
    if not _mcp_server_connected:
        print("[PETer_Agent] Connecting to MCP server...")
        try:
            await _mcp_server.__aenter__()
            _mcp_server_connected = True
            print("[PETer_Agent] MCP server connected successfully")
        except Exception as e:
            print(f"[PETer_Agent] MCP connection failed: {e}")
            # Reset and retry with fresh instance
            _mcp_server = create_mcp_server()
            await _mcp_server.__aenter__()
            _mcp_server_connected = True
            print("[PETer_Agent] MCP server reconnected with fresh instance")
    
    return _mcp_server


async def reset_mcp_connection():
    """Reset the MCP connection (call when connection errors occur)."""
    global _mcp_server, _mcp_server_connected
    print("[PETer_Agent] Resetting MCP connection...")
    
    if _mcp_server is not None:
        try:
            await _mcp_server.__aexit__(None, None, None)
        except Exception:
            pass  # Ignore cleanup errors
    
    _mcp_server = None
    _mcp_server_connected = False


async def run_workflow(workflow_input: WorkflowInput, user_id: int, username: str, session_id: str | None) -> dict:
    """
    Single-agent workflow with session memory for conversation continuity.
    Uses cached MCP server connection with automatic reconnection on failure.
    """
    with trace("PETer Agent"):
        print(f"[PETer_Agent] run_workflow called with session_id: {session_id}")

        # Get cached MCP server (will connect if needed)
        try:
            mcp_server = await get_mcp_server()
        except Exception as e:
            print(f"[PETer_Agent] Initial MCP connection failed: {e}, retrying...")
            await reset_mcp_connection()
            mcp_server = await get_mcp_server()
        
        # Create agent with MCP server
        peter_agent = create_peter_agent(mcp_server)

        # Create or reuse session for stateful memory
        base_session = OpenAIConversationsSession(conversation_id=session_id) if session_id else OpenAIConversationsSession()
        print(f"[PETer_Agent] Created base_session with _session_id: {getattr(base_session, '_session_id', None)}")

        # Prepare input with user context
        agent_input_text = (
            workflow_input.input_as_text +
            " Respond to the user in the same language the user asks questions. "
            f"<<Authentic data attached from backend>> requester_user_id: {user_id}; requester_username: {username}; time_stamp: {datetime.now()}"
        )

        # Run the agent with retry on MCP connection errors
        print("[PETer_Agent] Running PETer Agent...")
        try:
            result_temp = await Runner.run(
                peter_agent,
                input=agent_input_text,
                session=base_session,
                run_config=RunConfig(
                    trace_metadata={
                        "__trace_source__": "agent-builder",
                        "workflow_id": workflow_id,
                        "agent": "peter_agent",
                    }
                )
            )
        except Exception as e:
            error_str = str(e)
            # Check if it's an MCP connection error
            if "ClosedResourceError" in error_str or "MCP tool" in error_str or "ConnectionResetError" in error_str:
                print(f"[PETer_Agent] MCP connection error, reconnecting and retrying: {e}")
                await reset_mcp_connection()
                mcp_server = await get_mcp_server()
                peter_agent = create_peter_agent(mcp_server)
                
                # Retry the agent run
                result_temp = await Runner.run(
                    peter_agent,
                    input=agent_input_text,
                    session=base_session,
                    run_config=RunConfig(
                        trace_metadata={
                            "__trace_source__": "agent-builder",
                            "workflow_id": workflow_id,
                            "agent": "peter_agent",
                        }
                    )
                )
            else:
                raise  # Re-raise non-MCP errors

        # Extract session id
        final_session_id = getattr(base_session, "_session_id", None) or session_id
        print(f"[PETer_Agent] final_session_id: {final_session_id}")
        print(f"[PETer_Agent] Agent completed")

        return {
            "output_text": result_temp.final_output.json(),
            "output_parsed": result_temp.final_output.model_dump(),
            "session_id": final_session_id
        }
