from agents import HostedMCPTool, Agent, ModelSettings, TResponseInputItem, Runner, RunConfig, trace
from agents.memory import OpenAIConversationsSession
from pydantic import BaseModel, Field
from openai.types.shared.reasoning import Reasoning

workflow_id = "wf_68fee4a8907881908aad9aaf9cf500b2000a3772ba65199b"

# Tool definitions
mcp = HostedMCPTool(tool_config={
  "type": "mcp",
  "server_label": "MCP",
  "allowed_tools": [
    "get_user_pet_info_detailed",
    "get_post_recommendations",
    "get_user_information",
    "get_user_pet_types",
    "get_pet_foods_details",
    "list_tutorial_topics",
    "get_navigation_paths",
    "resolve_entity_context",
    "database_operation_list",
    "perform_database_operation",
    "prepare_feed_ocr"
  ],
  "require_approval": "never",
  "server_description": "MCP",
  "server_url": "https://peter.geniusbee.net/mcp/sse"
})

# Input definitions
class WorkflowInput(BaseModel):
  """Top-level input to the workflow.

  The assistant will read this as the user's latest message.
  """
  input_as_text: str = Field(..., description="End-user message in plain text; do not include system text here.")

# Return schemas definitions
#---------------------------------------------------------------------
class WorkflowOrganizerSchema__ToolsToUseItem(BaseModel):
  """One step in the proposed tool plan for the next turn."""
  Order: float = Field(..., description="The 1-based order for executing this tool step, e.g., 1, 2, 3…")
  ToolName: str = Field(..., description="Exact tool name to invoke (must exist in allowed MCP tools).")


class WorkflowOrganizerSchema(BaseModel):
  """Planner output guiding which tools to call and how to guide the next agent."""
  ToolsToUse: list[WorkflowOrganizerSchema__ToolsToUseItem] = Field(
    default_factory=list,
    description="An ordered plan of MCP tools to call for this user query."
  )
  Instruction: str = Field(..., description="Concise, actionable instruction for the next agent to follow.")
  UserPrompt: str = Field(..., description="The exact user prompt to use for the next agent (do not invent facts).")


class SummaryAgentSchema__OperationsItem(BaseModel):
  """One UI operation the app should perform for the user.

  For navigation operations, use operation_type='navigate' and include the target path in operation_data as JSON.
  Example: {"operation_type": "navigate", "operation_data": "{\"path\": \"/social\", \"reason\": \"user wants to see posts\"}"}
  """
  operation_type: str = Field(..., description="Operation type: 'navigate', 'navigate_health_records', 'navigate_social', etc.")
  operation_data: str = Field(..., description="Parameters for the operation (JSON stringified). For 'navigate': {\"path\": \"/target/path\", \"reason\": \"...\"}")


class RecommendedUser(BaseModel):
  """One recommended user with explicit user_id inside the object.

  IMPORTANT: Do NOT emit dynamic keys. Always provide user_id as a field on the object.
  """
  user_id: str | int = Field(..., description="Unique identifier of the user.")
  display_name: str = Field(..., description="User-facing display name (e.g., nickname).")
  user_details: str = Field(..., description="Short rationale or description why this user is recommended.")
  headshot_url: str | None = Field(None, description="URL of the user's profile picture/headshot if available.")
  user_account: str | None = Field(None, description="User's account name/username if available.")
  user_fullname: str | None = Field(None, description="User's full name if available.")


class PostRecommendation(BaseModel):
  """One recommended post.

  IMPORTANT: You MUST include the id inside the object as 'post_id'. Do NOT emit dynamic JSON property names keyed by the id.
  Return an empty list if there are no recommendations of that type.
  """
  post_id: str | int = Field(..., description="Unique identifier of the post.")
  title: str = Field(..., description="Post title or succinct label.")
  post_details: str = Field(..., description="Short rationale or context for why this post is recommended.")
  created_at: str | None = Field(None, description="ISO8601 timestamp if available.")
  user_fullname: str | None = Field(None, description="Author display name (e.g., poster's full name) if available.")
  location: str | None = Field(None, description="Location string if applicable (e.g., where the post was made).")


class SummaryAgentSchema(BaseModel):
  """Final structured response returned to the app.

  The agent must fill all fields faithfully. Put explanatory text for the user in 'reply'; put
  machine-readable actions in 'operations' and recommendation dictionaries.
  """
  reply: str = Field(..., description="Natural language reply for the user (do not dump raw data here).")
  tutorial: str = Field(..., description="If a tutorial is applicable, set its id or slug; else use an empty string.")
  operations: list[SummaryAgentSchema__OperationsItem] = Field(
    default_factory=list,
    description="List of concrete operations for the client to perform."
  )
  recommended_users: list[RecommendedUser] = Field(
    default_factory=list,
    description="List of recommended users. Each item includes user_id, display_name, user_details, headshot_url, user_account, user_fullname."
  )
  recommended_social_posts: list[PostRecommendation] = Field(
    default_factory=list,
    description="List of recommended social posts. Each item includes post_id/title/post_details/created_at and, when available, user_fullname and location."
  )
  recommended_forum_posts: list[PostRecommendation] = Field(
    default_factory=list,
    description="List of recommended forum posts. Each item includes post_id/title/post_details/created_at and, when available, user_fullname and location."
  )

# End of schema definitions
#---------------------------------------------------------------------

# Agent definitions
#---------------------------------------------------------------------
workflow_organizer = Agent(
  name="Workflow Organizer",
  instructions=(
    "Understand the user's intention, then plan out the workflow by checking what tools the mcp server provides and how these tools can help achieve the user's intention. "
    "If the user's request is beyond available tools, simply state that the task cannot be completed with current capabilities. You do not need to assist with these requests or provide any information or suggestions. "
    "You SHOULD NOT retrieve data by yourself. Do not spend too much time constructing the instruction; allowing the next agent to complete the task is enough. The final output should all be relevant to the user's needs.\n\n"

    "IMPORTANT - Information Gathering:\n"
    "Before planning any tool execution, check if ALL required parameters are available by reviewing the ENTIRE conversation history, not just the current message.\n"
    "Each tool's description specifies its REQUIRED and OPTIONAL parameters. Read them carefully.\n"
    "ONLY collect parameters that are explicitly listed in required_params or optional_params.\n"
    "DO NOT collect or ask for parameters that are not listed, even if they seem logical or common (e.g., visibility, privacy settings).\n"
    "If a tool has a FORBIDDEN_params section, absolutely DO NOT collect or ask for those parameters.\n"
    "Look through previous messages to collect any parameters the user has already provided.\n"
    "If REQUIRED information is missing from the conversation history, indicate in the Instruction that the next agent should ask the user BEFORE calling the tool.\n"
    "The tool descriptions also provide suggested wording for asking users - use those suggestions when available.\n"
    "When the user modifies one parameter, remember to retain all other parameters they've already provided in earlier messages.\n\n"

    "IMPORTANT - Feed Creation:\n"
    "When user wants to add feed: images → OCR → confirm → add_feed.\n"
    "Check prepare_feed_ocr and add_feed tool descriptions for detailed workflow.\n"
    "DO NOT call add_feed before OCR completes and user confirms.\n\n"

    "IMPORTANT - Health Report Creation:\n"
    "When user wants to add health report: image → OCR → collect info → confirm → add_health_report.\n"
    "Check prepare_health_report_ocr and add_health_report tool descriptions for detailed workflow.\n"
    "DO NOT call add_health_report before OCR completes and user confirms all information.\n"
    "When you see '[健康報告 OCR 已完成...]' in message, OCR has finished and data is ready to use.\n\n"

    "CRITICAL - Image Status Understanding:\n"
    "When you see '[用戶已準備 N 張相片待上傳]' in the message, it means:\n"
    "- User HAS ALREADY selected images in the frontend\n"
    "- Images are ready and cached in frontend\n"
    "- You should IMMEDIATELY proceed with OCR (call prepare_feed_ocr)\n"
    "- DO NOT ask user to upload images again\n"
    "- DO NOT instruct next agent to ask for upload\n\n"
    "Example: 'gooddog P1 [用戶已準備 2 張相片待上傳]' → Plan to call prepare_feed_ocr immediately"
  ),
  model="gpt-5.1",
  tools=[
    mcp
  ],
  output_type=WorkflowOrganizerSchema,
  model_settings=ModelSettings(
    store=True,
    reasoning=Reasoning(
      effort="low"
    )
  )
)

summary_agent = Agent(
  name="Summary Agent",
  instructions=(
    "Understand user intent, filter irrelevant tool outputs. Use organizer's Instruction to decide which MCP tools to call. Populate ONLY JSON schema fields. "
    "In reply: concise answer, no raw data. Post recommendations: use recommended_social_posts and recommended_forum_posts arrays with post_id, title, post_details, created_at, user_fullname, location. "
    "Do not display raw data such as JSON dumps, urls, internal tutorial name, internal mcp tool name, internal database operation name, internal ids of the data from the database, or lists directly to the user. Also, please try to avoid using technical terms like \"id\" or \"ids\", just to name a few. Instead, summarize the information in a user-friendly manner within the 'reply' field. Do not summarize the content of each posts. "
    "If the user's request is beyond available tools, simply state that the task cannot be completed with current capabilities. You do not need to assist with these requests or provide any information or suggestions. "
    "Return empty lists if none. Do NOT invent ids/titles or use dynamic property names.\n\n"

    "IMPORTANT - User Communication Style:\n"
    "ALWAYS communicate in a friendly, conversational manner. Use natural language instead of technical terms:\n"
    "- Say '貼文內容' NOT 'content'\n"
    "- Say '地點' NOT 'location'\n"
    "- Say '標籤' NOT 'hashtags' (but #標籤 is OK)\n"
    "- NEVER mention: user_id, post_id, media_urls, or any technical parameter names\n"
    "- NEVER ask for 'media_urls' (this doesn't exist - just remind users to select images using the photo button)\n"
    "Follow the user_responses guidance in tool descriptions for proper wording.\n\n"

    "IMPORTANT - Information Gathering & Memory:\n"
    "If the organizer's Instruction says to ask the user for information, you MUST ask in the reply field and NOT call any tools yet.\n"
    "ALWAYS review the ENTIRE conversation history to collect parameters the user has already provided in previous messages.\n"
    "Only ask for information that is truly missing from the conversation history.\n"
    "When the user modifies one parameter (e.g., changes the content), automatically retain all other parameters they provided earlier (e.g., hashtags, location, images).\n"
    "Wait for the user to provide the missing information in the next turn, then call the appropriate tool with ALL collected parameters.\n"
    "Each tool's description provides suggested wording for asking users - follow those suggestions.\n\n"

    "NAVIGATION: Add to operations array: {operation_type: navigate, operation_data: json.dumps({path: /target, destination: name})}. "
    "User will see a button to navigate - do NOT say 'navigating' or 'redirecting'. Instead say: 您可以點擊下方按鈕前往[頁面]。\n"
    "Static paths: get_navigation_paths, match intent, add to operations.\n"
    "Dynamic paths: resolve_entity_context(entity_type, user_id, conditions), use resolved_path.\n"
    "Not found: inform user, suggest alternatives.\n"
    "Entities: social_post, feed, pet, user, health_report, disease_archive, abnormal_post, plan\n\n"

    "Feed Creation:\n"
    "Check prepare_feed_ocr and add_feed tool descriptions for complete workflow.\n"
    "Key reminders:\n"
    "- When organizer says 'call prepare_feed_ocr': Call it immediately and add {operation_type: 'ocr_feed_analysis', operation_data: {...}} to operations array\n"
    "- '[用戶已準備 N 張相片待上傳]' means images are ALREADY selected in frontend, proceed with OCR immediately\n"
    "- After calling prepare_feed_ocr: MUST add ocr_feed_analysis operation to trigger frontend OCR execution\n"
    "- Keep hasImages and ocrData in context throughout conversation\n\n"

    "Health Report Creation:\n"
    "Check prepare_health_report_ocr and add_health_report tool descriptions for complete workflow.\n"
    "Key reminders:\n"
    "- When organizer says 'call prepare_health_report_ocr': Call it immediately and add {operation_type: 'ocr_health_report_analysis', operation_data: json.dumps({'pet_id': X})} to operations array\n"
    "- '[健康報告 OCR 已完成 - 辨識到 N 項健康數據: ...]' means OCR has completed successfully with health data\n"
    "- After OCR completes: Use the recognized health data to populate the health_data parameter\n"
    "- The OCR result is available in the message context - extract all health metrics from '[健康報告 OCR 已完成...]'\n"
    "- Keep hasImages and healthReportOcrData in context throughout conversation\n"
    "- MUST collect check_type, check_date, check_location from user before calling add_health_report\n\n"

    "CRITICAL - After calling perform_database_operation('add_feed', ...):\n"
    "1. Extract feed_id and is_existing from the tool's return value\n"
    "2. ALWAYS add feed_created operation to operations array with this EXACT format:\n"
    "   {operation_name: 'feed_created', operation_data: json.dumps({feed_id: X, is_existing: true/false, status: 'matched' or 'pending_images'})}\n"
    "3. If is_existing=true: ALSO add navigate operation: {operation_name: 'navigate', operation_data: json.dumps({path: '/feeds/{feed_id}', destination: '飼料詳情頁面'})}\n"
    "4. If is_existing=false: Only add feed_created operation (frontend handles image upload automatically)\n"
    "DO NOT add empty operation_data - it MUST contain at least feed_id, is_existing, and status!"
  ),
  model="gpt-5.1",
  tools=[
    mcp
  ],
  output_type=SummaryAgentSchema,
  model_settings=ModelSettings(
    store=True,
    reasoning=Reasoning(
      effort="low"
    )
  )
)

# End of agent definitions
#---------------------------------------------------------------------

async def run_workflow(workflow_input: WorkflowInput, user_id: int, username: str, session_id: str | None) -> dict:
  with trace("PETer Agent"):
    print(f"[PETer_Agent] run_workflow called with session_id: {session_id}")
    # State variables, not used for now
    state = {

    }
    workflow = workflow_input.model_dump()

    # Create or reuse an OpenAIConversationsSession for stateful memory
    base_session = OpenAIConversationsSession(conversation_id=session_id) if session_id else OpenAIConversationsSession()
    print(f"[PETer_Agent] Created base_session with _session_id: {getattr(base_session, '_session_id', None)}")

    format_run_kwargs_kwargs = {
        "input": workflow_input.input_as_text + " user_id: " + str(user_id) + " username: " + username,
        "session": base_session,
        "run_config": RunConfig(
            trace_metadata={
                "__trace_source__": "agent-builder",
                "workflow_id": workflow_id,
                "session_id": getattr(base_session, "_session_id", None) or (session_id if session_id else "new"),
            }
        )
    }

    workflow_organizer_result_temp = await Runner.run(
      workflow_organizer,
      **format_run_kwargs_kwargs
    )
    workflow_organizer_result = {
      "output_text": workflow_organizer_result_temp.final_output.json(),
      "output_parsed": workflow_organizer_result_temp.final_output.model_dump()
    }

    # DEBUG: print/log the organizer instruction and refined prompt (temporary)
    try:
      organizer_instruction = workflow_organizer_result_temp.final_output.Instruction
      organizer_user_prompt = workflow_organizer_result_temp.final_output.UserPrompt
      print(f"[PETer_Agent DEBUG] Organizer Instruction: {organizer_instruction}")
      print(f"[PETer_Agent DEBUG] Organizer UserPrompt: {organizer_user_prompt}")
    except Exception as _e:
      print(f"[PETer_Agent DEBUG] Failed to access organizer fields: {_e}")

    # Ensure the second agent explicitly receives the refined UserPrompt if available.
    refined_user_prompt = None
    try:
      refined_user_prompt = workflow_organizer_result_temp.final_output.UserPrompt
    except Exception:
      # Fallback: use raw input
      refined_user_prompt = workflow_input.input_as_text

    # Inject the refined prompt into the input for summary agent while preserving user/context data.
    summary_input_text = refined_user_prompt + " user_id: " + str(user_id) + " username: " + username
    summary_run_kwargs = {
      **format_run_kwargs_kwargs,
      "input": summary_input_text
    }

    summary_agent_result_temp = await Runner.run(
      summary_agent,
      **summary_run_kwargs
    )

    # conversation_history.extend([item.to_input_item() for item in summary_agent_result_temp.new_items])

    # Extract the session id from the session object after runs (assigned lazily by OpenAI)
    final_session_id = getattr(base_session, "_session_id", None) or session_id
    print(f"[PETer_Agent] final_session_id after agent runs: {final_session_id} (input was: {session_id})")

    summary_agent_result = {
      "output_text": summary_agent_result_temp.final_output.json(),
      "output_parsed": summary_agent_result_temp.final_output.model_dump(),
      # Standardized: session_id is the OpenAI id used to continue the same conversation
      "session_id": final_session_id
    }

    return summary_agent_result