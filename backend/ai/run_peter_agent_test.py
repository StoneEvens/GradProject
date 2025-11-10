"""
Simple runner to test PETer_Agent.run_workflow

Usage (PowerShell):
  python -m backend.ai.run_peter_agent_test -m "幫我看看有什麼貼文推薦" -u 1 -n testuser

Optional:
  - Pass an existing session id to continue the same conversation:
    python -m backend.ai.run_peter_agent_test -m "繼續" -u 1 -n testuser -s sess_abc123

Notes:
  - Requires environment variables for OpenAI agent runtime if applicable.
  - The script prints the raw JSON text returned by the Summary Agent.
"""

import os
import sys
import json
import asyncio
import argparse

# Allow script to be executed directly (python backend/ai/run_peter_agent_test.py)
# by fixing import path when __package__ is None.
if __package__ is None:  # running as a standalone script
  CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
  PROJECT_ROOT = os.path.dirname(os.path.dirname(CURRENT_DIR))  # /backend/.. => project root
  if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
  # Ensure 'backend' is importable as a package
  # If backend/__init__.py does not exist, create a runtime package shim
  backend_init = os.path.join(os.path.dirname(CURRENT_DIR), '__init__.py')
  if not os.path.exists(backend_init):
    try:
      with open(backend_init, 'a', encoding='utf-8'):
        pass
    except Exception:
      pass

try:
  # When run as module: python -m backend.ai.run_peter_agent_test
  from .PETer_Agent import WorkflowInput, run_workflow  # type: ignore
except ImportError:
  # When run as script: python backend/ai/run_peter_agent_test.py
  from backend.ai.PETer_Agent import WorkflowInput, run_workflow  # type: ignore


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("-m", "--message", default="我的貓幾公斤？", help="User message to send")
    p.add_argument("-u", "--user-id", default="", help="User id (string or int)")
    p.add_argument("-n", "--username", default="Steven", help="Username")
    p.add_argument("-s", "--session-id", default="conv_690e006ff1ec8193b7506ede6d96c0ad0700ae4f9ba8f824", help="OpenAI session id to continue conversation")
    return p.parse_args()


def main():
    args = parse_args()

    workflow_input = WorkflowInput(input_as_text=args.message)

    print("Sending message:", args.message)
    print("Using session:", args.session_id or "<new>")

    # Run the async workflow and print the result
    result = asyncio.run(
        run_workflow(
            workflow_input=workflow_input,
            user_id=int(args.user_id) if str(args.user_id).isdigit() else args.user_id,
            username=args.username,
            session_id=args.session_id,
        )
    )
    # Normalize result for display
    if isinstance(result, dict) and 'output_text' in result:
        result_json_text = result.get('output_text', '')
        returned_session_id = result.get('session_id')
    else:
        # Backward compatibility: returned a JSON string
        result_json_text = result
        returned_session_id = None

    print("\nRaw result (JSON string):")
    print(result_json_text)
    if returned_session_id:
        print(f"\nSession ID: {returned_session_id}")

    # Pretty-print if it looks like JSON
    try:
        parsed = json.loads(result_json_text)
        print("\nPretty result:")
        print(json.dumps(parsed, ensure_ascii=False, indent=2))
    except Exception:
        pass


if __name__ == "__main__":
    main()
