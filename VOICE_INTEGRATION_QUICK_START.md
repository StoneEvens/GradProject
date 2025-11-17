# Quick Integration Guide: Adding Voice to Existing Chat

This guide shows how to add voice capabilities to your existing PETer chat interface.

## Step 1: Install Dependencies

```bash
cd frontend
npm install @openai/realtime-api-beta
```

## Step 2: Import the Service

In your existing chat component (e.g., `Chat.tsx` or `AiAssist.tsx`):

```typescript
import { realtimeVoiceService } from '../services/realtimeVoiceService';
```

## Step 3: Add Voice State

```typescript
const [isVoiceMode, setIsVoiceMode] = useState(false);
const [isRecording, setIsRecording] = useState(false);
const [voiceError, setVoiceError] = useState<string | null>(null);
```

## Step 4: Add Voice Toggle Function

```typescript
const toggleVoiceMode = async () => {
  if (!isVoiceMode) {
    // Enable voice mode
    try {
      // Create session with current conversation
      await realtimeVoiceService.createSession({
        conversationId: currentConversationId,
        voice: 'alloy'
      });
      
      // Connect to OpenAI
      await realtimeVoiceService.connect();
      
      // Set up event listeners
      realtimeVoiceService.setupEventListeners({
        onTranscriptUpdate: (event) => {
          // Add to your existing message handling
          const content = event.item?.content?.[0]?.text;
          if (content) {
            handleNewMessage(content, event.item.role);
          }
        },
        onError: (error) => {
          setVoiceError(error.message);
          setIsVoiceMode(false);
        }
      });
      
      setIsVoiceMode(true);
      setVoiceError(null);
    } catch (error) {
      setVoiceError('Failed to start voice mode');
      console.error(error);
    }
  } else {
    // Disable voice mode
    realtimeVoiceService.disconnect();
    setIsVoiceMode(false);
    setIsRecording(false);
  }
};
```

## Step 5: Add Voice Button to UI

```tsx
{/* In your chat header or toolbar */}
<IonButton
  onClick={toggleVoiceMode}
  color={isVoiceMode ? 'success' : 'medium'}
  size="small"
>
  <IonIcon 
    slot="start" 
    icon={isVoiceMode ? micOutline : micOffOutline} 
  />
  {isVoiceMode ? 'Voice On' : 'Voice Off'}
</IonButton>

{/* Recording button - only show when voice mode is active */}
{isVoiceMode && (
  <IonButton
    onClick={async () => {
      if (isRecording) {
        realtimeVoiceService.stopRecording();
        setIsRecording(false);
      } else {
        await realtimeVoiceService.startRecording();
        setIsRecording(true);
      }
    }}
    color={isRecording ? 'danger' : 'primary'}
  >
    <IonIcon 
      slot="start" 
      icon={isRecording ? stopCircleOutline : micOutline} 
    />
    {isRecording ? 'Stop' : 'Speak'}
  </IonButton>
)}
```

## Step 6: Handle Message Integration

Update your message handler to work with both text and voice:

```typescript
const handleNewMessage = (content: string, role: 'user' | 'assistant') => {
  // Add message to your existing message list
  setMessages(prev => [...prev, {
    role: role,
    content: content,
    timestamp: new Date().toISOString(),
    source: isVoiceMode ? 'voice' : 'text'
  }]);
  
  // Scroll to bottom
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
};
```

## Step 7: Add Visual Indicators

```tsx
{/* Show voice mode status */}
{isVoiceMode && (
  <div className="voice-mode-indicator">
    <IonIcon icon={micOutline} />
    <span>Voice Mode Active</span>
    {isRecording && (
      <div className="recording-pulse" />
    )}
  </div>
)}

{/* Show voice error */}
{voiceError && (
  <IonToast
    isOpen={!!voiceError}
    message={voiceError}
    duration={3000}
    color="danger"
    onDidDismiss={() => setVoiceError(null)}
  />
)}
```

## Step 8: Add CSS for Visual Feedback

```css
.voice-mode-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--ion-color-success-tint);
  border-radius: 20px;
  font-size: 14px;
  color: var(--ion-color-success-contrast);
}

.recording-pulse {
  width: 8px;
  height: 8px;
  background: red;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

/* Voice message styling */
.message.voice {
  position: relative;
}

.message.voice::before {
  content: '🎤';
  position: absolute;
  left: -20px;
  top: 50%;
  transform: translateY(-50%);
}
```

## Step 9: Cleanup on Unmount

```typescript
useEffect(() => {
  return () => {
    if (isVoiceMode) {
      realtimeVoiceService.disconnect();
    }
  };
}, [isVoiceMode]);
```

## Complete Example Integration

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { IonButton, IonIcon, IonToast } from '@ionic/react';
import { micOutline, micOffOutline, stopCircleOutline } from 'ionicons/icons';
import { realtimeVoiceService } from '../services/realtimeVoiceService';

const ChatWithVoice = () => {
  const [messages, setMessages] = useState([]);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const messagesEndRef = useRef(null);

  const toggleVoiceMode = async () => {
    if (!isVoiceMode) {
      try {
        await realtimeVoiceService.createSession({ voice: 'alloy' });
        await realtimeVoiceService.connect();
        
        realtimeVoiceService.setupEventListeners({
          onTranscriptUpdate: (event) => {
            const content = event.item?.content?.[0]?.text;
            if (content) {
              setMessages(prev => [...prev, {
                role: event.item.role,
                content,
                timestamp: new Date().toISOString(),
                source: 'voice'
              }]);
            }
          },
          onError: (error) => {
            setVoiceError(error.message);
            setIsVoiceMode(false);
          }
        });
        
        setIsVoiceMode(true);
      } catch (error) {
        setVoiceError('Failed to start voice mode');
      }
    } else {
      realtimeVoiceService.disconnect();
      setIsVoiceMode(false);
      setIsRecording(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      realtimeVoiceService.stopRecording();
      setIsRecording(false);
    } else {
      await realtimeVoiceService.startRecording();
      setIsRecording(true);
    }
  };

  useEffect(() => {
    return () => {
      if (isVoiceMode) {
        realtimeVoiceService.disconnect();
      }
    };
  }, [isVoiceMode]);

  return (
    <div className="chat-container">
      {/* Voice Controls */}
      <div className="chat-header">
        <IonButton onClick={toggleVoiceMode} color={isVoiceMode ? 'success' : 'medium'}>
          <IonIcon slot="start" icon={isVoiceMode ? micOutline : micOffOutline} />
          {isVoiceMode ? 'Voice On' : 'Voice Off'}
        </IonButton>
        
        {isVoiceMode && (
          <IonButton onClick={toggleRecording} color={isRecording ? 'danger' : 'primary'}>
            <IonIcon slot="start" icon={isRecording ? stopCircleOutline : micOutline} />
            {isRecording ? 'Stop' : 'Speak'}
          </IonButton>
        )}
      </div>

      {/* Messages */}
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role} ${msg.source}`}>
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Toast */}
      <IonToast
        isOpen={!!voiceError}
        message={voiceError}
        duration={3000}
        color="danger"
        onDidDismiss={() => setVoiceError(null)}
      />
    </div>
  );
};

export default ChatWithVoice;
```

## Testing Checklist

- [ ] Voice button toggles correctly
- [ ] Session creates successfully
- [ ] Microphone permission requested
- [ ] Recording starts/stops
- [ ] AI responds with voice
- [ ] Transcript appears in chat
- [ ] Voice mode disconnects cleanly
- [ ] Errors are handled gracefully
- [ ] Works alongside text chat
- [ ] UI updates reflect state changes

## Tips

1. **User Experience**
   - Show clear visual feedback for voice state
   - Provide microphone permission explanation
   - Handle errors gracefully with user-friendly messages

2. **Performance**
   - Initialize voice only when needed
   - Clean up connections properly
   - Monitor memory usage for long sessions

3. **Accessibility**
   - Provide text fallback option
   - Add keyboard shortcuts
   - Include screen reader announcements

4. **Mobile Considerations**
   - Test on iOS and Android
   - Handle app backgrounding
   - Manage battery usage

Ready to go! 🎤
