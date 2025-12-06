import os
import sys
import logging
import asyncio
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def setup_asyncio_exception_handler():
    """
    Set up a custom exception handler for asyncio to suppress expected connection errors.
    These errors occur when SSE clients disconnect (which is normal behavior).
    """
    def exception_handler(loop, context):
        exception = context.get('exception')
        message = context.get('message', '')
        
        # Suppress expected connection reset errors
        if exception:
            error_name = type(exception).__name__
            # These are expected when clients disconnect from SSE
            suppressed_errors = (
                'ConnectionResetError',
                'BrokenPipeError', 
                'ConnectionAbortedError',
                'LocalProtocolError',  # h11 state machine errors
            )
            if error_name in suppressed_errors:
                logger.debug(f"Client disconnected (suppressed {error_name})")
                return
            
            # Also suppress h11 LocalProtocolError messages
            if 'LocalProtocolError' in str(exception) or 'MUST_CLOSE' in str(exception):
                logger.debug(f"HTTP protocol state error (suppressed): {exception}")
                return
        
        # Log other unexpected errors
        logger.error(f"Asyncio error: {message}", exc_info=exception)
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.set_exception_handler(exception_handler)
    return loop

def main():
    # Set up custom asyncio exception handler to suppress connection reset errors
    setup_asyncio_exception_handler()
    
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

    # Import and start MCP server with custom routes
    try:
        from mcp_server.server import create_mcp_server
        from starlette.routing import Route
        from starlette.responses import JSONResponse
        
        # Health check endpoint for monitoring and to handle random scanners gracefully
        async def health_check(request):
            return JSONResponse({
                "status": "healthy",
                "service": "PETer MCP Server",
                "transport": "SSE"
            })
        
        # Root endpoint to handle scanners/bots hitting /
        async def root_handler(request):
            return JSONResponse({
                "service": "PETer MCP Server",
                "endpoints": {
                    "/sse": "SSE endpoint for MCP clients",
                    "/health": "Health check endpoint"
                }
            }, status_code=200)
        
        custom_routes = [
            Route("/", endpoint=root_handler, methods=["GET"]),
            Route("/health", endpoint=health_check, methods=["GET"]),
        ]
        
        logger.info("Starting MCP server on port 5000...")
        mcp_server = create_mcp_server()
        
        # Add custom routes for health checks (must be added before run())
        mcp_server._additional_http_routes.extend(custom_routes)
        
        mcp_server.run(
            transport="sse",
            host="0.0.0.0",
            port=5000
        )
    except Exception as e:
        logger.error(f"Failed to start MCP server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()