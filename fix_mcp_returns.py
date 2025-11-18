#!/usr/bin/env python
"""
Script to fix all MCP tool return types to str (JSON strings)
"""

import re

file_path = 'backend/mcp_server/server.py'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix get_user_information
content = re.sub(
    r'async def get_user_information\(user_ids: list\[int\]\) -> Dict:',
    r'async def get_user_information(user_ids: list[int]) -> str:',
    content
)
content = re.sub(
    r'(async def get_user_information.*?\n.*?return await fetch\(\))',
    lambda m: m.group(1).replace('return await fetch()', 'result_dict = await fetch()\n        return json.dumps(result_dict, ensure_ascii=False, indent=2)'),
    content,
    flags=re.DOTALL
)

# Fix get_user_pet_types (also fix pet.type -> pet.pet_type)
content = re.sub(
    r'async def get_user_pet_types\(user_ids: list\[int\]\) -> Dict:',
    r'async def get_user_pet_types(user_ids: list[int]) -> str:',
    content
)
content = re.sub(
    r"pet_types\[user\.id\] = \[pet\.type for pet in pets\]",
    r"pet_types[user.id] = [pet.pet_type for pet in pets]",
    content
)
# Find and replace the return statement for get_user_pet_types
pattern = r'(async def get_user_pet_types.*?)(        return await fetch\(\))'
replacement = r'\1        result_dict = await fetch()\n        return json.dumps(result_dict, ensure_ascii=False, indent=2)'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Fix get_pet_foods_details
content = re.sub(
    r'async def get_pet_foods_details\(\) -> list\[dict\]:',
    r'async def get_pet_foods_details() -> str:',
    content
)
pattern = r'(async def get_pet_foods_details.*?)(        return await fetch\(\))'
replacement = r'\1        result = await fetch()\n        return json.dumps(result, ensure_ascii=False, indent=2)'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Fix list_tutorial_topics
content = re.sub(
    r'async def list_tutorial_topics\(\) -> Dict\[str, str\]:',
    r'async def list_tutorial_topics() -> str:',
    content
)
pattern = r'(async def list_tutorial_topics.*?)(        return await fetch\(\))'
replacement = r'\1        result_dict = await fetch()\n        return json.dumps(result_dict, ensure_ascii=False, indent=2)'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Fix get_navigation_paths
content = re.sub(
    r'async def get_navigation_paths\(\) -> Dict:',
    r'async def get_navigation_paths() -> str:',
    content
)
# This one is different - no await fetch
pattern = r'(async def get_navigation_paths.*?)(            return paths_data)'
replacement = r'\1            return json.dumps(paths_data, ensure_ascii=False, indent=2)'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)
pattern = r'(async def get_navigation_paths.*?except.*?)(            return \{[^}]+\})'
def fix_nav_error(m):
    return m.group(1) + '''            result = {
                "error": f"Failed to load navigation paths: {str(e)}",
                "available_paths": [],
                "dynamic_paths": []
            }
            return json.dumps(result, ensure_ascii=False, indent=2)'''
content = re.sub(pattern, fix_nav_error, content, flags=re.DOTALL)

# Fix prepare_navigate
content = re.sub(
    r'async def prepare_navigate\([^)]+\) -> Dict:',
    r'async def prepare_navigate(\n        path: str,\n        reason: Optional[str] = None\n    ) -> str:',
    content
)
pattern = r'(async def prepare_navigate.*?"expires_at": expires_at\s+\})'
replacement = r'\1\n        \n        return json.dumps(result, ensure_ascii=False, indent=2)'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Fix database_operation_list
content = re.sub(
    r'async def database_operation_list\(\) -> Dict:',
    r'async def database_operation_list() -> str:',
    content
)
pattern = r'(async def database_operation_list.*?)(        return await fetch\(\))'
replacement = r'\1        result_dict = await fetch()\n        return json.dumps(result_dict, ensure_ascii=False, indent=2)'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Fix perform_database_operation
content = re.sub(
    r'async def perform_database_operation\([^)]+\) -> Dict:',
    lambda m: m.group(0).replace(' -> Dict:', ' -> str:'),
    content
)
pattern = r'(async def perform_database_operation.*?)(        return await execute\(\))'
replacement = r'\1        result_dict = await execute()\n        return json.dumps(result_dict, ensure_ascii=False, indent=2)'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed all MCP tool return types to str (JSON strings)")
