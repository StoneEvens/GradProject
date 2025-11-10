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
    "prepare_navigate",
    "database_operation_list",
    "perform_database_operation"
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
  """One UI operation the app should perform for the user."""
  operation_name: str = Field(..., description="Canonical operation id, e.g., 'navigate_health_records', 'navigate_social'.")
  operation_data: str = Field(..., description="Parameters or context for the operation (stringified if structured).")


class RecommendedUser(BaseModel):
  """One recommended user with explicit user_id inside the object.

  IMPORTANT: Do NOT emit dynamic keys. Always provide user_id as a field on the object.
  """
  user_id: str | int = Field(..., description="Unique identifier of the user.")
  display_name: str = Field(..., description="User-facing display name (e.g., nickname).")
  user_details: str = Field(..., description="Short rationale or description why this user is recommended.")


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
  has_calculator: bool = Field(..., description="Whether to surface the nutrition calculator UI toggle.")
  operation_type: str = Field(..., description="High-level operation type for quick UI routing, e.g., 'navigate_social'.")
  operations: list[SummaryAgentSchema__OperationsItem] = Field(
    default_factory=list,
    description="List of concrete operations for the client to perform."
  )
  recommended_users: list[RecommendedUser] = Field(
    default_factory=list,
    description="List of recommended users. Each item includes user_id, display_name, user_details."
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
  instructions="Understand the user's intention, then plan out the workflow by checking what tools the mcp server provides and how these tools can help achieve the user's intention. You SHOULD NOT retrieve data by yourself. Do not spend too much time constructing the instruction; allowing the next agent to complete the task is enough. The final output should all be relevant to the user's needs.",
  model="gpt-5",
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
    "Please understand the user's intent and filter out any irrelevant information from the tool outputs."
    "Use the organizer's Instruction to decide which MCP tools to call. Populate ONLY the JSON schema fields. "
    "In 'reply', provide a concise user-facing answer (no raw data tables). For post recommendations, return lists: "
    "'recommended_social_posts' and 'recommended_forum_posts' as arrays of objects each with post_id, title, post_details, created_at. If available, also include user_fullname (author display name) and location. "
    "Return empty lists when no recommendations. Do NOT invent placeholder ids or titles. Do not use dynamic property names keyed by ids."
  ),
  model="gpt-5-mini",
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
    # State variables, not used for now
    state = {

    }
    workflow = workflow_input.model_dump()

    # Create or reuse an OpenAIConversationsSession for stateful memory
    base_session = OpenAIConversationsSession(conversation_id=session_id) if session_id else OpenAIConversationsSession()

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

    summary_agent_result = {
      "output_text": summary_agent_result_temp.final_output.json(),
      "output_parsed": summary_agent_result_temp.final_output.model_dump(),
      # Standardized: session_id is the OpenAI id used to continue the same conversation
      "session_id": final_session_id
    }

    return summary_agent_result