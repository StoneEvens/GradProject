from openai import OpenAI
import requests
import asyncio
import os
import json
import logging
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIController:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.mcp_url = os.getenv("MCP_SERVER_URL", "http://localhost:5000")
        self.mcp_key = os.getenv("MCP_API_KEY", "your-default-api-key")
        self.sessions = {}
        self.features = self.load_website_features()

    def load_website_features(self) -> Dict:
        """Load the website features documentation"""
        features_path = os.path.join(os.path.dirname(__file__), 'website_features.json')
        with open(features_path, 'r') as f:
            return json.load(f)

    async def _create_mcp_session(self) -> Dict[str, Any]:
        """Create a new browser session in the MCP server"""
        headers = {"X-API-Key": self.mcp_key}
        async with requests.Session() as session:
            response = await session.post(f"{self.mcp_url}/session/create", headers=headers)
            response.raise_for_status()
            return response.json()

    async def _execute_mcp_action(self, session_id: str, action: Dict[str, Any]) -> Dict[str, Any]:
        """Execute an action through the MCP server"""
        headers = {"X-API-Key": self.mcp_key}
        async with requests.Session() as session:
            response = await session.post(
                f"{self.mcp_url}/session/{session_id}/action",
                headers=headers,
                json=action
            )
            response.raise_for_status()
            return response.json()

    def get_element_selector(self, feature: str, element: str) -> Optional[str]:
        """Get the selector for a specific element in a feature"""
        feature_data = self.features.get('features', {}).get(feature, {})
        if 'elements' in feature_data:
            element_data = feature_data['elements'].get(element, {})
            return element_data.get('selector')
        return None

    def get_workflow(self, workflow_name: str) -> Optional[Dict]:
        """Get the steps for a specific workflow"""
        return self.features.get('workflows', {}).get(workflow_name)

    async def execute_workflow(self, session_id: str, workflow_name: str, params: Dict[str, Any] = None):
        """Execute a predefined workflow"""
        workflow = self.get_workflow(workflow_name)
        if not workflow:
            raise ValueError(f"Workflow '{workflow_name}' not found")

        results = []
        for step in workflow['steps']:
            action = step['action']
            if action == 'navigate':
                results.append(await self._execute_mcp_action(session_id, {
                    'action': 'navigate',
                    'url': self.features['website_info']['base_url'] + step['path']
                }))
            elif action == 'click':
                selector = self.get_element_selector(step['feature'], step['element'])
                if selector:
                    results.append(await self._execute_mcp_action(session_id, {
                        'action': 'click',
                        'selector': selector
                    }))
            elif action == 'fill_form':
                form_data = step.get('fields', {})
                for field, value in form_data.items():
                    if params and field in params:
                        results.append(await self._execute_mcp_action(session_id, {
                            'action': 'type',
                            'selector': self.get_element_selector(step['form'], f"{field}_input"),
                            'text': params[field]
                        }))
        return results

    def _create_assistant(self):
        """Create an OpenAI assistant with web control capabilities"""
        website_info = self.features.get('website_info', {})
        features_list = self.features.get('features', {})
        workflows = self.features.get('workflows', {})

        instructions = f"""You are a web automation assistant for {website_info.get('name', 'the website')}.
        
        Base URL: {website_info.get('base_url')}
        Description: {website_info.get('description')}

        Available Features:
        {json.dumps(features_list, indent=2)}

        Common Workflows:
        {json.dumps(workflows, indent=2)}

        You can control the website using the following actions:
        1. navigate - Go to specific pages
        2. click - Click on buttons and elements
        3. type - Enter text into input fields
        4. get_text - Read text from elements

        Use the documented selectors and workflows to interact with the website accurately.
        Always follow the predefined workflows when available."""

        return self.client.beta.assistants.create(
            name="Web Control Assistant",
            instructions=instructions,
            model="gpt-4-1106-preview",
            tools=[{
                "type": "function",
                "function": {
                    "name": "control_website",
                    "description": "Control the website through MCP server",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "enum": ["navigate", "click", "type", "get_text", "workflow"]
                            },
                            "selector": {
                                "type": "string",
                                "description": "CSS selector for the element"
                            },
                            "text": {
                                "type": "string",
                                "description": "Text to type or expected text to verify"
                            },
                            "url": {
                                "type": "string",
                                "description": "URL to navigate to"
                            },
                            "workflow": {
                                "type": "string",
                                "description": "Name of the predefined workflow to execute"
                            },
                            "parameters": {
                                "type": "object",
                                "description": "Parameters for the workflow"
                            }
                        },
                        "required": ["action"]
                    }
                }
            }]
        )

    async def handle_user_request(self, user_id: str, request: str) -> Dict[str, Any]:
        """Handle a user's request to control the website"""
        try:
            # Create or get existing session
            if user_id not in self.sessions:
                session = await self._create_mcp_session()
                self.sessions[user_id] = session["session_id"]

            # Create assistant if needed (you might want to cache this)
            assistant = self._create_assistant()

            # Create a thread for the conversation
            thread = self.client.beta.threads.create()

            # Add the user's message to the thread
            message = self.client.beta.threads.messages.create(
                thread_id=thread.id,
                role="user",
                content=request
            )

            # Run the assistant
            run = self.client.beta.threads.runs.create(
                thread_id=thread.id,
                assistant_id=assistant.id
            )

            # Wait for the run to complete
            while True:
                run_status = self.client.beta.threads.runs.retrieve(
                    thread_id=thread.id,
                    run_id=run.id
                )
                if run_status.status == "completed":
                    break
                elif run_status.status in ["failed", "cancelled", "expired"]:
                    raise Exception(f"Assistant run failed with status: {run_status.status}")
                await asyncio.sleep(1)

            # Get the assistant's response
            messages = self.client.beta.threads.messages.list(thread_id=thread.id)
            
            # Execute any actions the assistant requested
            for message in messages.data:
                if message.role == "assistant" and message.tool_calls:
                    for tool_call in message.tool_calls:
                        if tool_call.function.name == "control_website":
                            action = json.loads(tool_call.function.arguments)
                            if action.get('action') == 'workflow':
                                results = await self.execute_workflow(
                                    self.sessions[user_id],
                                    action['workflow'],
                                    action.get('parameters', {})
                                )
                            else:
                                results = await self._execute_mcp_action(self.sessions[user_id], action)

            return {
                "status": "success",
                "thread_id": thread.id,
                "session_id": self.sessions[user_id]
            }

        except Exception as e:
            logger.error(f"Error handling user request: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }