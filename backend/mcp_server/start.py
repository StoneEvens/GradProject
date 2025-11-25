import os
import sys
import logging
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    # Mark this as MCP server process
    os.environ['MCP_SERVER_PROCESS'] = 'true'

    # Add the backend directory to Python path
    backend_dir = Path(__file__).resolve().parent.parent
    sys.path.append(str(backend_dir))

    # Set up Django environment with minimal configuration
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gradProject.settings')

    try:
        # Configure Django settings before importing models
        import django
        from django.conf import settings
        
        if not settings.configured:
            django.setup()
            
        # Only import what we need after Django is set up
        from django.apps import apps
        if not apps.ready:
            apps.populate([
                'accounts',  # Required for CustomUser model
                'pets',      # Required for Pet model
                'social',    # Required for PostFrame model
                'feeds',     # Required for Feed model
            ])
            
        logger.info("Django environment initialized successfully with minimal configuration")
    except Exception as e:
        logger.error(f"Failed to initialize Django: {e}")
        sys.exit(1)

    # Import and start MCP server
    try:
        from mcp_server.server import create_mcp_server
        #from mcp_server.new_server import create_mcp_server
        
        logger.info("Starting MCP server...")
        mcp_server = create_mcp_server()
        mcp_server.run(transport="sse", host="0.0.0.0", port=5000)
    except Exception as e:
        logger.error(f"Failed to start MCP server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()