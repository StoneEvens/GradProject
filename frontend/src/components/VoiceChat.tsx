/**
 * Voice Chat Component
 * 
 * Example component demonstrating how to use the Realtime Voice Service
 * for voice interaction with the PETer AI agent.
 * 
 * Note: This is a standalone example component. The actual implementation
 * is integrated in ChatWindow.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import { realtimeVoiceService } from '../services/realtimeVoiceService';

interface VoiceChatProps {
  conversationId?: number;
  onTranscriptUpdate?: (transcript: string) => void;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({ 
  conversationId, 
  onTranscriptUpdate 
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);

  /**
   * Initialize the realtime session
   */
  const initializeSession = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Step 1: Create session through backend (secure - no API key exposed)
      console.log('Creating realtime session...');
      const sessionConfig = await realtimeVoiceService.createSession({
        conversationId,
        voice: 'alloy', // Options: alloy, echo, fable, onyx, nova, shimmer
      });

      console.log('Session created:', sessionConfig.session_id);

      // Step 2: Connect to OpenAI with the ephemeral key
      await realtimeVoiceService.connect();

      // Step 3: Set up event listeners
      realtimeVoiceService.on('conversation.updated', (event) => {
        console.log('Conversation updated:', event);
      });

      realtimeVoiceService.on('response.audio.delta', (event) => {
        console.log('Receiving audio response...');
      });

      realtimeVoiceService.on('conversation.item.completed', (event) => {
        // Update transcript when items are completed
        const item = event.item;
        if (item?.type === 'message') {
          const content = item.content?.[0]?.text || item.content?.[0]?.transcript;
          if (content) {
            setTranscript(prev => [...prev, content]);
            onTranscriptUpdate?.(content);
          }
        }
      });

      realtimeVoiceService.on('error', (event) => {
        console.error('Realtime error:', event);
        setError(event.message || 'An error occurred');
        setIsConnected(false);
      });

      setIsConnected(true);
      console.log('Successfully connected to realtime API');
    } catch (err: any) {
      console.error('Failed to initialize session:', err);
      setError(err.message || 'Failed to connect');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [conversationId, onTranscriptUpdate]);

  /**
   * Start voice recording
   */
  const startVoiceRecording = useCallback(async () => {
    if (!isConnected) {
      setError('Not connected. Please connect first.');
      return;
    }

    try {
      await realtimeVoiceService.startRecording();
      setIsRecording(true);
      setError(null);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setError(err.message || 'Failed to start recording');
    }
  }, [isConnected]);

  /**
   * Stop voice recording
   */
  const stopVoiceRecording = useCallback(() => {
    realtimeVoiceService.stopRecording();
    setIsRecording(false);
  }, []);

  /**
   * Disconnect from the realtime session
   */
  const disconnect = useCallback(() => {
    realtimeVoiceService.disconnect();
    setIsConnected(false);
    setIsRecording(false);
    setTranscript([]);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="voice-chat-container" style={{ padding: '20px' }}>
      <h2>Voice Chat with Peter</h2>

      {/* Connection Status */}
      <div style={{ marginBottom: '20px' }}>
        {isConnecting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>⏳</span>
            <span>Connecting to voice service...</span>
          </div>
        )}

        {isConnected && (
          <div style={{ color: '#4caf50' }}>
            ✓ Connected to voice chat
          </div>
        )}

        {error && (
          <div style={{ color: '#f44336' }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {!isConnected ? (
          <button
            onClick={initializeSession}
            disabled={isConnecting}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isConnecting ? 'not-allowed' : 'pointer',
              opacity: isConnecting ? 0.6 : 1
            }}
          >
            {isConnecting ? 'Connecting...' : 'Start Voice Chat'}
          </button>
        ) : (
          <>
            <button
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              style={{
                padding: '10px 20px',
                backgroundColor: isRecording ? '#f44336' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{isRecording ? '🎤' : '🎙️'}</span>
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            <button
              onClick={disconnect}
              style={{
                padding: '10px 20px',
                backgroundColor: '#757575',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>⏹️</span>
              Disconnect
            </button>
          </>
        )}
      </div>

      {/* Transcript Display */}
      {transcript.length > 0 && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '8px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <h3>Conversation Transcript</h3>
          {transcript.map((text, index) => (
            <p key={index} style={{ 
              margin: '8px 0', 
              padding: '8px',
              backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9',
              borderRadius: '4px'
            }}>
              {text}
            </p>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        <h4>How to use:</h4>
        <ol>
          <li>Click "Start Voice Chat" to connect</li>
          <li>Click "Start Recording" and speak to Peter</li>
          <li>The AI will respond with voice</li>
          <li>View the conversation transcript below</li>
          <li>Click "Disconnect" when finished</li>
        </ol>
      </div>
    </div>
  );
};

export default VoiceChat;
