from django.apps import AppConfig


class McpServerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'mcp_server'

    def ready(self):
        from utils import mcp_server
        self.mcp = mcp_server.create_mcp_server()

        try:
            self.mcp.run(transport="sse", host="0.0.0.0", port=5000)
        except Exception as e:
            raise ValueError(f"Server error: {e}")