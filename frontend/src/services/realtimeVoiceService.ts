/**
 * Realtime Voice Service
 * 
 * Browser-native implementation of OpenAI Realtime API client.
 * 
 * Architecture:
 * 1. Backend creates ephemeral session using OpenAI Python SDK
 * 2. Frontend receives session credentials (ephemeral token)
 * 3. Frontend connects directly to OpenAI WebSocket with token
 * 4. Audio is streamed via Web Audio API
 * 
 * No additional npm packages needed - uses native browser APIs:
 * - WebSocket for connection
 * - MediaRecorder for audio input
 * - Web Audio API for audio output
 */

import axiosInstance from '../utils/axios';

export interface RealtimeSessionConfig {
  session_id: string;
  client_secret: {
    value: string;
    expires_at: number;
  };
  model: string;
  voice: string;
  instructions: string;
  modalities: string[];
  user_id: number;
  conversation_id?: number;
  conversation_title?: string;
}

export interface CreateSessionOptions {
  conversationId?: number;
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
}

export interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

type EventHandler = (event: RealtimeEvent) => void;

class RealtimeVoiceService {
  private ws: WebSocket | null = null;
  private sessionConfig: RealtimeSessionConfig | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Create a new realtime session through the backend
   * Uses the shared axios instance for proper auth handling
   */
  async createSession(options: CreateSessionOptions = {}): Promise<RealtimeSessionConfig> {
    try {
      console.log('[RealtimeVoice] Creating session with backend...');
      console.log('[RealtimeVoice] Options:', options);
      
      const response = await axiosInstance.post('/ai/realtime/session/create/', options);

      this.sessionConfig = response.data;
      if (!this.sessionConfig) {
        throw new Error('Invalid session config received');
      }
      
      console.log('[RealtimeVoice] ✅ Session created successfully');
      console.log('[RealtimeVoice] Session ID:', this.sessionConfig.session_id);
      console.log('[RealtimeVoice] Model:', this.sessionConfig.model);
      console.log('[RealtimeVoice] Token expires at:', new Date(this.sessionConfig.client_secret.expires_at * 1000).toLocaleString());
      
      return this.sessionConfig;
    } catch (error: any) {
      console.error('[RealtimeVoice] ❌ Failed to create realtime session:', error);
      console.error('[RealtimeVoice] Error details:', error.response?.data);
      throw new Error(error.response?.data?.error || error.message || 'Failed to create session');
    }
  }

  /**
   * Connect to OpenAI Realtime API WebSocket
   */
  async connect(): Promise<void> {
    if (!this.sessionConfig) {
      throw new Error('No session config. Call createSession() first.');
    }

    const wsUrl = `wss://api.openai.com/v1/realtime?model=${this.sessionConfig.model}`;
    
    console.log('[RealtimeVoice] Connecting to OpenAI WebSocket...');
    console.log('[RealtimeVoice] Model:', this.sessionConfig.model);
    console.log('[RealtimeVoice] Session ID:', this.sessionConfig.session_id);
    
    return new Promise((resolve, reject) => {
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.error('[RealtimeVoice] WebSocket connection timeout');
          this.ws.close();
          reject(new Error('WebSocket connection timeout after 10 seconds'));
        }
      }, 10000); // 10 second timeout

      this.ws = new WebSocket(wsUrl, [
        'realtime',
        `openai-insecure-api-key.${this.sessionConfig!.client_secret.value}`
      ]);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('[RealtimeVoice] ✅ WebSocket connected to OpenAI Realtime API');
        console.log('[RealtimeVoice] WebSocket readyState:', this.ws?.readyState);
        this.setupSession();
        resolve();
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('[RealtimeVoice] ❌ WebSocket error:', error);
        console.error('[RealtimeVoice] WebSocket readyState:', this.ws?.readyState);
        reject(new Error('WebSocket connection failed. Check console for details.'));
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('[RealtimeVoice] WebSocket connection closed');
        console.log('[RealtimeVoice] Close code:', event.code, 'Reason:', event.reason);
        this.emit({ type: 'connection.closed', code: event.code, reason: event.reason });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleServerEvent(message);
        } catch (error) {
          console.error('[RealtimeVoice] Failed to parse server message:', error);
        }
      };
    });
  }

  /**
   * Setup session configuration
   */
  private setupSession(): void {
    console.log('[RealtimeVoice] Setting up session configuration...');
    this.sendEvent({
      type: 'session.update',
      session: {
        voice: this.sessionConfig!.voice,
        instructions: this.sessionConfig!.instructions,
        modalities: this.sessionConfig!.modalities,
        temperature: 0.8,
      }
    });
  }

  /**
   * Handle events from the server
   */
  private handleServerEvent(event: RealtimeEvent): void {
    console.log('Server event:', event.type);

    // Handle audio response
    if (event.type === 'response.audio.delta' && event.delta) {
      this.playAudioDelta(event.delta);
    }

    // Emit to registered handlers
    this.emit(event);
  }

  /**
   * Start recording audio from microphone
   */
  async startRecording(): Promise<void> {
    try {
      // Initialize audio context
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: 24000 });
      }

      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm',
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Convert to base64 and send to server
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            this.sendEvent({
              type: 'input_audio_buffer.append',
              audio: base64,
            });
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Start recording in small chunks
      this.mediaRecorder.start(100); // 100ms chunks
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording audio
   */
  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Commit the audio buffer
    this.sendEvent({
      type: 'input_audio_buffer.commit'
    });

    // Request response generation
    this.sendEvent({
      type: 'response.create'
    });
  }

  /**
   * Send text message
   */
  async sendTextMessage(text: string): Promise<void> {
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text
        }]
      }
    });

    // Request response
    this.sendEvent({
      type: 'response.create'
    });
  }

  /**
   * Play audio delta from server
   */
  private async playAudioDelta(base64Audio: string): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
    }

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
      
      // Create and play source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  }

  /**
   * Send an event to the server
   */
  private sendEvent(event: RealtimeEvent): void {
    if (!this.ws) {
      console.error('[RealtimeVoice] ❌ Cannot send event: WebSocket not initialized');
      console.error('[RealtimeVoice] Event type:', event.type);
      return;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error('[RealtimeVoice] ❌ Cannot send event: WebSocket not connected');
      console.error('[RealtimeVoice] WebSocket readyState:', this.ws.readyState);
      console.error('[RealtimeVoice] ReadyState meanings: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED');
      console.error('[RealtimeVoice] Event type:', event.type);
      return;
    }

    console.log('[RealtimeVoice] 📤 Sending event:', event.type);
    this.ws.send(JSON.stringify(event));
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Unregister event handler
   */
  off(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event to registered handlers
   */
  private emit(event: RealtimeEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }

    // Also emit to wildcard listeners
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => handler(event));
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    // Stop recording if active
    this.stopRecording();

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Close audio context
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Clear event handlers
    this.eventHandlers.clear();

    this.sessionConfig = null;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current session config
   */
  getSessionConfig(): RealtimeSessionConfig | null {
    return this.sessionConfig;
  }
}

// Export singleton instance
export const realtimeVoiceService = new RealtimeVoiceService();
export default realtimeVoiceService;
