# OpenAI Realtime Voice API Integration Guide

This guide explains how to use the OpenAI Realtime API for voice interaction with the PETer AI agent.

## Overview

The implementation follows a secure architecture where:
1. **Backend** creates the session with OpenAI using the server's API key
2. **Backend** returns an ephemeral session token to the frontend
3. **Frontend** uses the ephemeral token to establish a WebSocket connection
4. **No API keys are exposed** to the client

## Architecture

```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│  Frontend   │────1───▶│   Backend   │────2───▶│   OpenAI     │
│  (Browser)  │         │   (Django)  │         │   Realtime   │
└─────────────┘         └─────────────┘         └──────────────┘
      │                        │                        │
      │◀─────3─────────────────┘                        │
      │  (Ephemeral Token)                              │
      │                                                  │
      └──────────────────4──────────────────────────────┘
         (WebSocket with Ephemeral Token)
```

## Backend Implementation

### 1. New Endpoint: `/api/ai/realtime/session/create/`

**Location:** `backend/ai/views.py` - `create_realtime_session()`

**Purpose:** Securely create OpenAI Realtime sessions without exposing API keys

**Request:**
```http
POST /api/ai/realtime/session/create/
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "conversation_id": 123,  // Optional: link to existing conversation
  "model": "gpt-4o-realtime-preview-2024-12-17",  // Optional
  "voice": "alloy"  // Optional: alloy, echo, fable, onyx, nova, shimmer
}
```

**Response:**
```json
{
  "session_id": "sess_abc123",
  "client_secret": {
    "value": "ephemeral_key_xyz789",
    "expires_at": 1700000000
  },
  "model": "gpt-4o-realtime-preview-2024-12-17",
  "voice": "alloy",
  "instructions": "You are Peter, a helpful AI assistant...",
  "modalities": ["text", "audio"],
  "user_id": 42,
  "conversation_id": 123  // If provided in request
}
```

### 2. System Instructions

The backend automatically provides context to the AI agent:
- User ID, username, and full name
- Role as PETer assistant
- Available features (pet profiles, health records, feeding, etc.)
- Optimized for voice interaction

## Frontend Implementation

### 1. Install Required Package

```bash
npm install @openai/realtime-api-beta
```

### 2. Service Layer: `realtimeVoiceService.ts`

**Location:** `frontend/src/services/realtimeVoiceService.ts`

The service provides:
- `createSession()` - Initialize session via backend
- `connect()` - Connect to OpenAI WebSocket
- `setupEventListeners()` - Handle events
- `startRecording()` - Begin voice input
- `stopRecording()` - Stop voice input
- `sendText()` - Send text messages
- `disconnect()` - Clean up connection

**Example Usage:**

```typescript
import { realtimeVoiceService } from './services/realtimeVoiceService';

// 1. Create session
const config = await realtimeVoiceService.createSession({
  conversationId: 123,
  voice: 'alloy'
});

// 2. Connect to OpenAI
await realtimeVoiceService.connect();

// 3. Set up listeners
realtimeVoiceService.setupEventListeners({
  onConversationUpdated: (event) => {
    console.log('Conversation updated:', event);
  },
  onAudioResponse: (event) => {
    // Audio is automatically played
  },
  onTranscriptUpdate: (event) => {
    // Display transcript
  },
  onError: (error) => {
    console.error('Error:', error);
  }
});

// 4. Start recording
await realtimeVoiceService.startRecording();

// 5. Stop when done
realtimeVoiceService.stopRecording();

// 6. Disconnect
realtimeVoiceService.disconnect();
```

### 3. React Component: `VoiceChat.tsx`

**Location:** `frontend/src/components/VoiceChat.tsx`

A complete example component showing:
- Session initialization
- Recording controls
- Transcript display
- Error handling
- Connection status

**Usage in your app:**

```tsx
import { VoiceChat } from './components/VoiceChat';

function MyPage() {
  return (
    <VoiceChat
      conversationId={123}  // Optional
      onTranscriptUpdate={(text) => {
        console.log('New transcript:', text);
      }}
    />
  );
}
```

## Security Features

✅ **API Key Protection**
- OpenAI API key stays on the server
- Only ephemeral tokens sent to client
- Tokens expire automatically

✅ **User Authentication**
- Requires `IsAuthenticated` permission
- Session tied to authenticated user
- User context passed to AI

✅ **Conversation Linking**
- Optional link to existing conversations
- Maintains conversation history
- User can only access their own conversations

## Available Voices

Choose from OpenAI's voice options:
- `alloy` - Neutral, balanced
- `echo` - Clear, professional
- `fable` - Warm, engaging
- `onyx` - Deep, authoritative
- `nova` - Bright, friendly
- `shimmer` - Soft, soothing

## Event Types

The Realtime API emits various events:

### Conversation Events
- `conversation.updated` - Conversation state changed
- `conversation.item.created` - New item added
- `conversation.item.completed` - Item finished

### Audio Events
- `response.audio.delta` - Audio chunk received
- `response.audio.done` - Audio response complete
- `input_audio_buffer.speech_started` - User started speaking
- `input_audio_buffer.speech_stopped` - User stopped speaking

### Response Events
- `response.created` - New response started
- `response.done` - Response complete
- `response.text.delta` - Text chunk received

### Error Events
- `error` - Error occurred

## Advanced Features

### Function Calling

The Realtime API supports function calling. You can extend the agent to:
1. Access MCP tools via functions
2. Perform database operations
3. Navigate the app
4. Retrieve pet information

Example:
```typescript
const client = realtimeVoiceService.getClient();
client?.addTool({
  name: 'get_pet_info',
  description: 'Get information about a pet',
  parameters: {
    type: 'object',
    properties: {
      pet_id: { type: 'number' }
    }
  }
}, async (params) => {
  // Call your backend API
  const response = await fetch(`/api/pets/${params.pet_id}`);
  return await response.json();
});
```

### Audio Playback Control

```typescript
const client = realtimeVoiceService.getClient();

// Interrupt current playback
client?.cancelResponse();

// Adjust volume (future feature)
// client?.setVolume(0.8);
```

### Text Fallback

Users can send text instead of voice:
```typescript
await realtimeVoiceService.sendText("Tell me about my pet's health");
```

## Testing Checklist

- [ ] Backend endpoint creates session successfully
- [ ] Ephemeral token is returned and valid
- [ ] Frontend connects to WebSocket
- [ ] Microphone permission is granted
- [ ] Audio input is captured
- [ ] AI responds with voice
- [ ] Transcript updates correctly
- [ ] Conversation links work (if used)
- [ ] Disconnect cleans up properly
- [ ] Error handling works
- [ ] Session expiration is handled

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to OpenAI
- Check backend logs for API errors
- Verify OPENAI_API_KEY is set
- Ensure ephemeral key hasn't expired
- Check network/CORS settings

### Audio Issues

**Problem:** No audio input/output
- Check microphone permissions
- Verify browser supports Web Audio API
- Test with different browsers
- Check audio device settings

### Session Expires

**Problem:** Session timeout
- Ephemeral keys expire after ~60 minutes
- Create new session when needed
- Implement auto-refresh logic

## Performance Optimization

1. **Lazy Loading:** Only load realtime SDK when needed
2. **Connection Pooling:** Reuse sessions when possible
3. **Audio Buffering:** Implement proper buffering for smooth playback
4. **Network Quality:** Monitor latency and adjust quality

## Next Steps

1. **Integrate into existing chat UI**
   - Add voice button to chat interface
   - Toggle between text and voice modes
   - Show audio waveforms

2. **Enhance with MCP tools**
   - Enable function calling
   - Connect to database operations
   - Add navigation commands

3. **Improve UX**
   - Add voice activity detection
   - Show listening/speaking indicators
   - Implement push-to-talk mode

4. **Analytics**
   - Track voice usage
   - Monitor session duration
   - Measure user satisfaction

## Resources

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [Realtime API Beta Package](https://www.npmjs.com/package/@openai/realtime-api-beta)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

## Support

For issues or questions:
1. Check backend logs: `backend/logs/`
2. Check browser console for frontend errors
3. Review this documentation
4. Contact the development team
