/**
 * Realtime Voice Service using OpenAI GA Endpoint
 * 
 * Uses the OpenAI Realtime GA API with full MCP tool support:
 * - Ephemeral token authentication via client_secret
 * - MCP tool integration (tools configured in backend session)
 * - Audio streaming and playback
 * - Session management
 * 
 * Architecture:
 * 1. Backend creates session via /v1/realtime/sessions (GA) with MCP tools configured
 * 2. Frontend connects to GA WebSocket endpoint with ephemeral token
 * 3. MCP tools are registered in the session and callable by the AI
 * 4. Audio handled via Web Audio API
 */

import { OpenAIRealtimeWebSocket } from 'openai/realtime/websocket';
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
  tools: any[];
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
  private sessionConfig: RealtimeSessionConfig | null = null;
  private transport: OpenAIRealtimeWebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private audioQueue: Float32Array[] = [];
  private isPlayingAudio: boolean = false;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private isCapturing: boolean = false;

  /**
   * Create a new realtime session through the backend
   * Backend configures MCP tools and returns ephemeral token
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

      console.log('[RealtimeVoice] ✅ Session created:', {
        session_id: this.sessionConfig.session_id,
        model: this.sessionConfig.model,
        voice: this.sessionConfig.voice,
        modalities: this.sessionConfig.modalities,
        tools_count: this.sessionConfig.tools?.length || 0,
        conversation_id: this.sessionConfig.conversation_id
      });

      return this.sessionConfig;
    } catch (error) {
      console.error('[RealtimeVoice] ❌ Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Connect to OpenAI Realtime API
   * Uses the OpenAI SDK's WebSocket transport with ephemeral client_secret
   */
  async connect(): Promise<void> {
    if (!this.sessionConfig) {
      throw new Error('No session config. Call createSession() first.');
    }

    const token = this.sessionConfig.client_secret.value;
    const model = this.sessionConfig.model;
    
    console.log('[RealtimeVoice] Connecting to OpenAI Realtime API...');
    console.log('[RealtimeVoice] Model:', model);
    console.log('[RealtimeVoice] Session ID:', this.sessionConfig.session_id);
    console.log('[RealtimeVoice] Token type:', token.startsWith('ek_') ? 'ephemeral' : 'unknown');
    console.log('[RealtimeVoice] MCP Tools:', this.sessionConfig.tools?.length || 0);

    try {
      // Create WebSocket using the ephemeral client_secret from GA endpoint
      // Use GA baseURL to connect to wss://api.openai.com/v1/realtime
      // This matches the backend's /v1/realtime/sessions endpoint
      this.transport = new OpenAIRealtimeWebSocket(
        {
          model: model,
          dangerouslyAllowBrowser: true,  // Required for browser usage
        },
        {
          apiKey: token,  // Use the ephemeral client_secret from GA endpoint
          baseURL: 'https://api.openai.com/v1',  // GA endpoint
        }
      );

      // Set up event listeners after creating the transport
      this.setupTransportEventListeners();
      
      // Wait for WebSocket to be fully open before proceeding
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000); // 10 second timeout
        
        if (this.transport!.socket) {
          const socket = this.transport!.socket;
          
          socket.addEventListener('open', () => {
            clearTimeout(timeout);
            console.log('[RealtimeVoice] WebSocket opened successfully');
            resolve();
          });
          
          socket.addEventListener('error', (event) => {
            clearTimeout(timeout);
            console.error('[RealtimeVoice] WebSocket error event:', event);
            reject(new Error('WebSocket connection failed'));
          });
          
          socket.addEventListener('close', (event) => {
            console.log('[RealtimeVoice] WebSocket closed:', {
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean
            });
            if (!event.wasClean) {
              clearTimeout(timeout);
              reject(new Error(`WebSocket closed abnormally: ${event.code} ${event.reason}`));
            }
          });
          
          // Check if already open
          if (socket.readyState === 1) { // OPEN
            clearTimeout(timeout);
            console.log('[RealtimeVoice] WebSocket already open');
            resolve();
          }
        } else {
          clearTimeout(timeout);
          reject(new Error('No WebSocket created'));
        }
      });

      console.log('[RealtimeVoice] ✅ Connected successfully');
      console.log('[RealtimeVoice] WebSocket URL:', this.transport.url?.toString());

      // Initialize audio context for playback
      this.audioContext = new AudioContext({ sampleRate: 24000 });

      // Update session configuration (voice, modalities, etc.)
      // These settings weren't included in the initial session creation
      console.log('[RealtimeVoice] Updating session configuration...');
      this.transport.send({
        type: 'session.update',
        session: {
          type: 'realtime',  // Required parameter
          modalities: ['text', 'audio'],
          voice: this.sessionConfig.voice || 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      });
      console.log('[RealtimeVoice] Session configuration updated');

      this.emit({ type: 'connection.opened' });

    } catch (error) {
      console.error('[RealtimeVoice] ❌ Connection failed:', error);
      this.emit({ type: 'error', error });
      throw error;
    }
  }

  /**
   * Set up event listeners for the transport layer
   * These forward events from the OpenAI SDK to our event handlers
   */
  private setupTransportEventListeners(): void {
    if (!this.transport) return;

    // Listen to all server events (uses 'event' listener for all events)
    this.transport.on('event', (event: any) => {
      console.log('[RealtimeVoice] Server event:', event.type);
      
      // Forward to our event handlers
      this.emit(event);
      
      // Handle specific events
      switch (event.type) {
        case 'session.created':
          console.log('[RealtimeVoice] Session created on server');
          break;
          
        case 'session.updated':
          console.log('[RealtimeVoice] Session updated');
          break;
          
        case 'conversation.created':
          console.log('[RealtimeVoice] Conversation created');
          break;
          
        case 'conversation.item.created':
          console.log('[RealtimeVoice] Item created:', event.item?.type);
          break;
          
        case 'conversation.item.completed':
          console.log('[RealtimeVoice] Item completed:', event.item?.id);
          break;
          
        case 'response.created':
          console.log('[RealtimeVoice] Response created');
          break;
          
        case 'response.done':
          console.log('[RealtimeVoice] Response done');
          break;
          
        case 'response.audio.delta':
          // Handle audio delta - play the audio
          if (event.delta) {
            this.handleAudioDelta(event.delta);
          }
          break;
          
        case 'response.audio_transcript.delta':
          console.log('[RealtimeVoice] Audio transcript delta:', event.delta);
          break;
          
        case 'response.function_call_arguments.delta':
          console.log('[RealtimeVoice] Function call args delta:', event.delta);
          break;
          
        case 'input_audio_buffer.speech_started':
          console.log('[RealtimeVoice] User started speaking');
          break;
          
        case 'input_audio_buffer.speech_stopped':
          console.log('[RealtimeVoice] User stopped speaking');
          break;
          
        case 'error':
          console.error('[RealtimeVoice] Server error:', event.error);
          break;
      }
    });
    
    // Listen for errors
    this.transport.on('error', (error: any) => {
      console.error('[RealtimeVoice] Error:', error);
      this.emit({ type: 'error', error });
    });
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Handle incoming audio delta from the server
   * Convert base64 audio to PCM16 and play it
   */
  private handleAudioDelta(deltaBase64: string): void {
    if (!this.audioContext) return;

    try {
      // Decode base64 to binary
      const binaryString = atob(deltaBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM16 to Float32
      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      // Add to playback queue
      this.audioQueue.push(float32);
      
      // Start playback if not already playing
      if (!this.isPlayingAudio) {
        this.playNextAudioChunk();
      }
      
    } catch (error) {
      console.error('[RealtimeVoice] Error handling audio delta:', error);
    }
  }

  /**
   * Play audio chunks from the queue
   */
  private playNextAudioChunk(): void {
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlayingAudio = false;
      return;
    }

    this.isPlayingAudio = true;
    const audioData = this.audioQueue.shift()!;

    // Create audio buffer
    const audioBuffer = this.audioContext.createBuffer(
      1, // mono
      audioData.length,
      24000 // 24kHz sample rate
    );
    
    // Copy audio data
    const channelData = audioBuffer.getChannelData(0);
    channelData.set(audioData);

    // Create source and play
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    source.onended = () => {
      this.playNextAudioChunk();
    };
    
    source.start();
  }

  /**
   * Start capturing audio from microphone and sending to server
   * Uses Web Audio API to capture raw PCM16 audio
   */
  async startAudioCapture(): Promise<void> {
    try {
      console.log('[RealtimeVoice] Starting audio capture...');

      // Check if we're still connected
      if (!this.transport) {
        throw new Error('Not connected to transport');
      }

      // Check AudioContext state
      if (!this.audioContext || this.audioContext.state === 'closed') {
        console.warn('[RealtimeVoice] AudioContext not initialized or closed, creating new one');
        this.audioContext = new AudioContext({ sampleRate: 24000 });
      }

      // Resume AudioContext if suspended (browser security requirement)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('[RealtimeVoice] AudioContext resumed');
      }

      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create audio source from microphone
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create ScriptProcessor for audio processing
      // Using 4096 buffer size for good balance between latency and performance
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isCapturing || !this.transport) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const inputData = inputBuffer.getChannelData(0); // Float32Array

        // Convert Float32 to Int16 (PCM16)
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Clamp values to [-1, 1] and convert to Int16 range
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);

        // Send to Realtime API
        try {
          this.transport.send({
            type: 'input_audio_buffer.append',
            audio: base64Audio
          });
        } catch (error) {
          console.error('[RealtimeVoice] Error sending audio:', error);
        }
      };

      // Connect nodes: microphone -> processor -> destination
      source.connect(processor);
      processor.connect(this.audioContext.destination);

      // Store reference for cleanup
      this.audioWorkletNode = processor as any; // Store for later disconnection
      this.isCapturing = true;

      console.log('[RealtimeVoice] ✅ Audio capture started (PCM16 24kHz)');

    } catch (error) {
      console.error('[RealtimeVoice] ❌ Failed to start audio capture:', error);
      throw error;
    }
  }

  /**
   * Alias for startAudioCapture for compatibility with ChatWindow
   */
  async startRecording(): Promise<void> {
    return this.startAudioCapture();
  }

  /**
   * Stop capturing audio from microphone
   */
  stopAudioCapture(): void {
    console.log('[RealtimeVoice] Stopping audio capture...');

    this.isCapturing = false;

    // Disconnect audio worklet/processor
    if (this.audioWorkletNode) {
      try {
        this.audioWorkletNode.disconnect();
      } catch (error) {
        console.warn('[RealtimeVoice] Error disconnecting audio node:', error);
      }
      this.audioWorkletNode = null;
    }

    // Stop media recorder (legacy)
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop all media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.mediaRecorder = null;
    console.log('[RealtimeVoice] ✅ Audio capture stopped');
  }

  /**
   * Alias for stopAudioCapture for compatibility with ChatWindow
   */
  stopRecording(): void {
    return this.stopAudioCapture();
  }

  /**
   * Send a text message to the conversation
   */
  sendText(text: string): void {
    if (!this.transport) {
      throw new Error('Not connected');
    }

    console.log('[RealtimeVoice] Sending text:', text);
    
    this.transport.send({
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

    // Trigger response
    this.transport.send({
      type: 'response.create'
    });
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
    // Emit to specific event type handlers
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }

    // Emit to wildcard handlers
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => handler(event));
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.transport !== null && this.transport.socket?.readyState === 1; // WebSocket.OPEN = 1
  }

  /**
   * Get connection details
   */
  getConnectionStatus(): any {
    const socketState = this.transport?.socket?.readyState;
    let status = 'disconnected';
    if (socketState === 0) status = 'connecting';
    else if (socketState === 1) status = 'connected';
    else if (socketState === 2) status = 'closing';
    else if (socketState === 3) status = 'closed';
    
    return {
      connected: this.isConnected(),
      status,
      session_id: this.sessionConfig?.session_id,
      model: this.sessionConfig?.model
    };
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    console.log('[RealtimeVoice] Disconnecting...');

    this.stopAudioCapture();

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch (error) {
        console.warn('[RealtimeVoice] Error closing AudioContext:', error);
      }
      this.audioContext = null;
    }

    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.sessionConfig = null;

    console.log('[RealtimeVoice] ✅ Disconnected');
    this.emit({ type: 'connection.closed' });
  }
}

// Export singleton instance
export const realtimeVoiceService = new RealtimeVoiceService();
export default realtimeVoiceService;
