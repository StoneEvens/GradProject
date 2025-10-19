from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
import sys
import os

# Add the AgentTest directory to the Python path
agent_test_path = os.path.join(settings.BASE_DIR.parent, 'AgentTest')
sys.path.append(agent_test_path)

from AgentTest.ai_controller import AIController
import asyncio

# Initialize the AI Controller (singleton pattern)
ai_controller = None

def get_ai_controller():
    global ai_controller
    if ai_controller is None:
        ai_controller = AIController()
    return ai_controller

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_assist(request):
    """
    Endpoint for AI assistance requests
    
    Expected JSON body:
    {
        "request": "User's natural language request"
    }
    """
    try:
        user_request = request.data.get('request')
        if not user_request:
            return Response({
                'error': 'Request text is required'
            }, status=400)
        
        # Get user ID
        user_id = str(request.user.id)
        
        # Get AI Controller
        controller = get_ai_controller()
        
        # Handle the request asynchronously
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            controller.handle_user_request(user_id, user_request)
        )
        loop.close()
        
        return Response(result)
    
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_status(request):
    """
    Check if AI assistance is available
    """
    try:
        controller = get_ai_controller()
        return Response({
            'status': 'available',
            'features_loaded': len(controller.features.get('features', {}))
        })
    except Exception as e:
        return Response({
            'status': 'unavailable',
            'error': str(e)
        }, status=500)