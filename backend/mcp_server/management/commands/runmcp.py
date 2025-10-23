from django.core.management.base import BaseCommand
from asgiref.sync import sync_to_async
from fastmcp import FastMCP

class Command(BaseCommand):
    help = 'Runs the MCP server integrated with Django'

    def handle(self, *args, **options):
        mcp = self.create_mcp_server()
        try:
            self.stdout.write(self.style.SUCCESS('Starting MCP server...'))
            mcp.run(transport="sse", host="0.0.0.0", port=5000)
        except Exception as e:
            raise ValueError(f"Server error: {e}")

    def create_mcp_server(self):
        server_instructions = """This is a sample MCP server that provides basic tools for demonstration purposes."""
        mcp = FastMCP(name="Sample MCP Server", instructions=server_instructions)

        @mcp.tool()
        async def get_greeting(name: str) -> str:
            """Get a personalized greeting"""
            return f"Hello, {name}!"

        @mcp.tool()
        async def get_user_pet_info(user_id: str):
            from accounts.models import CustomUser
            from pets.models import Pet

            @sync_to_async
            def fetch():
                user = CustomUser.objects.filter(id=user_id).first()
                pets = list(Pet.objects.filter(owner=user).values("id", "name", "species"))
                return {"user": user.username, "pets": pets}

            return await fetch()

        return mcp