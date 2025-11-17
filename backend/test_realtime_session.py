"""
Test script for OpenAI Realtime API session creation

This script tests the backend endpoint that creates realtime sessions.
Run from the backend directory:
    python test_realtime_session.py
"""

import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gradProject.settings')
django.setup()

from django.contrib.auth import get_user_model
from ai.views import create_realtime_session
from rest_framework.test import APIRequestFactory
from rest_framework.authtoken.models import Token

User = get_user_model()

def test_create_realtime_session():
    """Test the realtime session creation endpoint"""
    
    print("=" * 60)
    print("Testing OpenAI Realtime Session Creation")
    print("=" * 60)
    
    # Get or create a test user
    try:
        user = User.objects.first()
        if not user:
            print("❌ No users found in database. Please create a user first.")
            return
            
        print(f"✅ Using user: {user.username} (ID: {user.id})")
    except Exception as e:
        print(f"❌ Error getting user: {e}")
        return
    
    # Create API request
    factory = APIRequestFactory()
    
    # Test 1: Basic session creation
    print("\n" + "-" * 60)
    print("Test 1: Basic session creation (no conversation)")
    print("-" * 60)
    
    request = factory.post('/api/ai/realtime/session/create/', {
        'voice': 'alloy'
    }, format='json')
    request.user = user
    
    try:
        response = create_realtime_session(request)
        
        if response.status_code == 201:
            data = response.data
            print("✅ Session created successfully!")
            print(f"   - Session ID: {data.get('session_id')}")
            print(f"   - Model: {data.get('model')}")
            print(f"   - Voice: {data.get('voice')}")
            print(f"   - User ID: {data.get('user_id')}")
            print(f"   - Ephemeral key: {data.get('client_secret', {}).get('value', '')[:20]}...")
            print(f"   - Expires at: {data.get('client_secret', {}).get('expires_at')}")
        else:
            print(f"❌ Failed with status {response.status_code}")
            print(f"   Error: {response.data}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    # Test 2: Session with custom voice
    print("\n" + "-" * 60)
    print("Test 2: Session with different voice")
    print("-" * 60)
    
    request = factory.post('/api/ai/realtime/session/create/', {
        'voice': 'nova',
        'model': 'gpt-4o-realtime-preview-2024-12-17'
    }, format='json')
    request.user = user
    
    try:
        response = create_realtime_session(request)
        
        if response.status_code == 201:
            data = response.data
            print("✅ Session created successfully!")
            print(f"   - Voice: {data.get('voice')}")
            print(f"   - Model: {data.get('model')}")
        else:
            print(f"❌ Failed with status {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 60)
    print("Testing Complete")
    print("=" * 60)

if __name__ == '__main__':
    # Check if OpenAI API key is set
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("⚠️  WARNING: OPENAI_API_KEY environment variable not set")
        print("   The test will likely fail. Please set your API key first.")
        print()
    
    test_create_realtime_session()
