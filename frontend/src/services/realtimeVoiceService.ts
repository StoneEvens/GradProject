/**
 * Realtime Voice Service using OpenAI Agents SDK
 * 
 * Uses the @openai/agents SDK for realtime voice interaction:
 * - RealtimeAgent for agent configuration with MCP tools
 * - RealtimeSession for managing the conversation
 * - Automatic MCP tool execution
 * - Audio streaming and playback
 * 
 * Architecture:
 * 1. Backend creates ephemeral token with session config
 * 2. Frontend creates RealtimeAgent with MCP tools
 * 3. RealtimeSession connects using the ephemeral token
 * 4. SDK handles tool calls automatically
 */

import { realtime } from '@openai/agents';
import axiosInstance from '../utils/axios';

const { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebSocket } = realtime;

export interface RealtimeSessionConfig {
  client_secret: {
    value: string;  // This is the ephemeral API key to use for connection
    expires_at: number;
  };
  model: string;
  voice: string;
  instructions: string;
  tools_count: number;  // Number of tools configured (not the full tool definitions)
  user_id: number;
  conversation_id?: number;
  conversation_title?: string;
  greeting?: string;  // Initial greeting message for the agent to speak
  language?: string;  // User's language preference
  audio?: {  // Audio configuration from backend (includes turn_detection)
    input?: {
      format?: any;
      turn_detection?: {
        type: string;
        threshold?: number;
        prefix_padding_ms?: number;
        silence_duration_ms?: number;
        create_response?: boolean;
      };
    };
    output?: any;
  };
}

export interface CreateSessionOptions {
  conversationId?: number;
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  language?: string; // User's current language (e.g., 'zh-TW', 'en', 'ja')
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
  private isSessionReady: boolean = false;

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

      console.log('[RealtimeVoice] ✅ Session configuration received:', {
        model: this.sessionConfig.model,
        voice: this.sessionConfig.voice,
        tools_count: this.sessionConfig.tools_count,
        conversation_id: this.sessionConfig.conversation_id,
        greeting: this.sessionConfig.greeting,
        language: this.sessionConfig.language,
        has_audio_config: !!this.sessionConfig.audio,
        has_turn_detection: !!this.sessionConfig.audio?.input?.turn_detection,
        turn_detection_type: this.sessionConfig.audio?.input?.turn_detection?.type,
        expires_at: new Date(this.sessionConfig.client_secret.expires_at * 1000).toISOString()
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

    const ephemeralKey = this.sessionConfig.client_secret.value;
    const model = this.sessionConfig.model;
    
    console.log('[RealtimeVoice] Connecting to OpenAI Realtime API...');
    console.log('[RealtimeVoice] Model:', model);
    console.log('[RealtimeVoice] Ephemeral key type:', ephemeralKey.startsWith('ek_') ? 'ek (ephemeral)' : 'unknown');
    console.log('[RealtimeVoice] MCP Tools configured on backend:', this.sessionConfig.tools_count);
    console.log('[RealtimeVoice] Key expires at:', new Date(this.sessionConfig.client_secret.expires_at * 1000).toLocaleString());

    try {
      // Create WebSocket using the ephemeral key as the API key
      // The ephemeral key contains the full session configuration (including tools)
      // When we connect, OpenAI will automatically create a session with those tools
      this.transport = new OpenAIRealtimeWebSocket(
        {
          model: model,
          dangerouslyAllowBrowser: true,  // The ephemeral key is safe to use in browser
        },
        {
          apiKey: ephemeralKey,  // Use the ephemeral key from /v1/realtime/client_secrets
          baseURL: 'https://api.openai.com/v1',
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

      // The session is automatically created with the configuration we specified
      // in the backend when creating the client_secret, including:
      // - Model, instructions, tools (MCP tools included!)
      // - Audio input/output format and voice
      // - Output modalities
      // We wait for session.created event to confirm the session is ready
      console.log('[RealtimeVoice] Waiting for session.created event...');
      console.log('[RealtimeVoice] Session will include', this.sessionConfig.tools_count, 'MCP tools');

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
      // Log ALL events to see what we're getting
      console.log('[RealtimeVoice] 📥 RAW EVENT:', event.type);
      
      // Forward to our event handlers
      this.emit(event);
      
      // Handle specific events
      switch (event.type) {
        case 'session.created':
          this.isSessionReady = true;
          console.log('[RealtimeVoice] ✅ Session created on server');
          
          // Check if VAD/turn detection is properly configured
          const session = event.session;
          
          // First check the event session, then fall back to our stored config
          const turnDetectionFromEvent = session?.turn_detection || session?.audio?.input?.turn_detection;
          const turnDetectionFromConfig = this.sessionConfig?.audio?.input?.turn_detection;
          const turnDetection = turnDetectionFromEvent || turnDetectionFromConfig;
          
          console.log('[RealtimeVoice] 📋 Session configuration:', {
            model: session?.model,
            modalities: session?.modalities,
            instructions_preview: session?.instructions?.substring(0, 100) + '...',
            tools_count: session?.tools?.length || 0,
            turn_detection_from_event: turnDetectionFromEvent,
            turn_detection_from_config: turnDetectionFromConfig,
            turn_detection_final: turnDetection,
            full_session: session
          });
          
          // Force enable VAD if not already configured
          if (!turnDetection) {
            console.warn('[RealtimeVoice] ⚠️ VAD not configured, sending session.update to enable it');
            this.transport!.send({
              type: 'session.update',
              session: {
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500
                }
              } as any
            });
          } else {
            console.log('[RealtimeVoice] 🎤 Server VAD is active - speak naturally, AI will respond when you pause');
            console.log('[RealtimeVoice] VAD config:', turnDetection);
          }
          
          // Send initial greeting from the agent (using the working test message approach)
          console.log('[RealtimeVoice] 👋 Sending initial greeting...');
          setTimeout(() => {
            if (this.transport) {
              const greetingText = this.sessionConfig?.greeting || 'Hi！我是 PETer 專員 Peter，很高興為您服務！有什麼問題都可以問我喔～';
              
              this.transport.send({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'user',
                  content: [{
                    type: 'input_text',
                    text: greetingText
                  }]
                }
              });
              
              // Trigger response generation
              this.transport.send({
                type: 'response.create'
              });
              
              console.log('[RealtimeVoice] 👋 Greeting sent, waiting for audio response...');
            }
          }, 1000);
          
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
          console.log('[RealtimeVoice] 🤖 Response created:', event.response?.id);
          break;
          
        case 'response.done':
          console.log('[RealtimeVoice] ✅ Response done:', {
            response_id: event.response?.id,
            status: event.response?.status,
            output: event.response?.output
          });
          break;
          
        case 'response.audio.delta':
        case 'response.output_audio.delta':
          // Handle both event names (API may use either)
          // The audio data is in event.audio for response.output_audio.delta
          // and event.delta for response.audio.delta
          const audioDelta = event.audio || event.delta;
          if (audioDelta) {
            console.log('[RealtimeVoice] 🔊 Audio delta received, base64 length:', audioDelta.length);
            this.handleAudioDelta(audioDelta);
          } else {
            console.warn('[RealtimeVoice] ⚠️ Audio delta event with no audio data:', event);
          }
          break;
          
        case 'response.audio.done':
        case 'response.output_audio.done':
          console.log('[RealtimeVoice] 🔊 Audio response complete');
          break;
          
        case 'response.output_item.added':
          console.log('[RealtimeVoice] Output item added:', event.item?.type);
          break;
          
        case 'response.output_item.done':
          console.log('[RealtimeVoice] Output item done:', event.item?.type);
          break;
          
        case 'response.audio_transcript.delta':
        case 'response.output_audio_transcript.delta':
          console.log('[RealtimeVoice] 📝 Audio transcript delta:', event.delta);
          break;
          
        case 'response.output_audio_transcript.done':
          console.log('[RealtimeVoice] 📝 Full transcript:', event.transcript);
          break;
          
        case 'response.content_part.added':
        case 'response.content_part.done':
        case 'conversation.item.added':
        case 'conversation.item.done':
        case 'rate_limits.updated':
          // Informational events, no action needed
          break;
          
        case 'response.function_call_arguments.delta':
          // Function arguments are being streamed
          console.log('[RealtimeVoice] 📞 Function call args delta:', event.delta);
          break;
          
        case 'response.function_call_arguments.done':
          // Function call is complete, execute it
          console.log('[RealtimeVoice] 📞 Function call complete:', {
            call_id: event.call_id,
            name: event.name,
            arguments: event.arguments
          });
          this.handleFunctionCall(event.call_id, event.name, event.arguments);
          break;
          
        case 'input_audio_buffer.speech_started':
          console.log('[RealtimeVoice] 🎤 User started speaking');
          console.log('[RealtimeVoice] 🎤 VAD detected voice activity!');
          this.emit({ type: 'speech.started' });
          break;
          
        case 'input_audio_buffer.speech_stopped':
          console.log('[RealtimeVoice] 🎤 User stopped speaking');
          console.log('[RealtimeVoice] 🔇 VAD detected end of speech');
          this.emit({ type: 'speech.stopped' });
          break;
          
        case 'input_audio_buffer.committed':
          console.log('[RealtimeVoice] ✅ Audio buffer committed');
          break;
          
        case 'error':
          console.error('[RealtimeVoice] Server error:', event.error);
          break;
          
        default:
          // Log any unhandled events
          console.log('[RealtimeVoice] ⚠️ Unhandled event type:', event.type, event);
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
    if (!this.audioContext) {
      console.warn('[RealtimeVoice] ⚠️ No AudioContext for playback');
      return;
    }

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

      console.log('[RealtimeVoice] 🎵 Decoded audio:', {
        base64_length: deltaBase64.length,
        bytes_length: bytes.length,
        samples: pcm16.length,
        duration_ms: (pcm16.length / 24000 * 1000).toFixed(2)
      });

      // Add to playback queue
      this.audioQueue.push(float32);
      console.log('[RealtimeVoice] Queue size:', this.audioQueue.length);
      
      // Start playback if not already playing
      if (!this.isPlayingAudio) {
        console.log('[RealtimeVoice] ▶️ Starting playback');
        this.playNextAudioChunk();
      }
      
    } catch (error) {
      console.error('[RealtimeVoice] ❌ Error handling audio delta:', error);
    }
  }

  /**
   * Play audio chunks from the queue
   */
  private playNextAudioChunk(): void {
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlayingAudio = false;
      console.log('[RealtimeVoice] ⏹️ Playback stopped, queue empty');
      return;
    }

    this.isPlayingAudio = true;
    const audioData = this.audioQueue.shift()!;

    // Only log first chunk and then every 5th chunk
    if (this.audioQueue.length === 0 || this.audioQueue.length % 5 === 0) {
      console.log('[RealtimeVoice] 🎵 Playing chunk:', {
        samples: audioData.length,
        duration_ms: (audioData.length / 24000 * 1000).toFixed(2),
        remaining_chunks: this.audioQueue.length
      });
    }

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
      if (!this.transport || this.transport.socket?.readyState !== 1) {
        throw new Error('Not connected to transport');
      }

      // Check AudioContext state
      if (!this.audioContext || this.audioContext.state === 'closed') {
        console.warn('[RealtimeVoice] AudioContext not initialized or closed, creating new one');
        this.audioContext = new AudioContext({ sampleRate: 24000 });
      }
      // 鎖定當下使用的 AudioContext，避免斷線時被設為 null 造成 race
      const localAudioContext = this.audioContext;

      // Resume AudioContext if suspended (browser security requirement)
      if (localAudioContext.state === 'suspended') {
        await localAudioContext.resume();
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

      // 若在等待權限期間連線已中止，直接中止流程
      if (!this.transport || this.transport.socket?.readyState !== 1) {
        throw new Error('Disconnected before audio start');
      }

      // Create audio source from microphone
      if (!localAudioContext || localAudioContext.state === 'closed') {
        throw new Error('AudioContext closed before creating media source');
      }
      const source = localAudioContext.createMediaStreamSource(this.mediaStream);

      // Create ScriptProcessor for audio processing
      // Using 4096 buffer size for good balance between latency and performance
      const processor = localAudioContext.createScriptProcessor(4096, 1, 1);

      let audioChunkCount = 0;
      let maxAmplitude = 0;
      processor.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isCapturing || !this.transport) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const inputData = inputBuffer.getChannelData(0); // Float32Array

        // Calculate max amplitude for monitoring
        let chunkMax = 0;
        for (let i = 0; i < inputData.length; i++) {
          chunkMax = Math.max(chunkMax, Math.abs(inputData[i]));
        }
        maxAmplitude = Math.max(maxAmplitude, chunkMax);

        // Convert Float32 to Int16 (PCM16)
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Clamp values to [-1, 1] and convert to Int16 range
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);

        // Log every 50th chunk to avoid spam (about once every 10 seconds)
        audioChunkCount++;
        if (audioChunkCount % 50 === 0) {
          console.log('[RealtimeVoice] 📤 Audio streaming active (chunk #' + audioChunkCount + ')');
          console.log('[RealtimeVoice] 🎚️ Max audio level in last 50 chunks:', (maxAmplitude * 100).toFixed(1) + '%');
          if (maxAmplitude < 0.01) {
            console.warn('[RealtimeVoice] ⚠️ Audio level very low! Microphone might not be working or volume is too low.');
          }
          maxAmplitude = 0; // Reset for next batch
        }

        // Send to Realtime API
        try {
          this.transport.send({
            type: 'input_audio_buffer.append',
            audio: base64Audio
          });
        } catch (error) {
          console.error('[RealtimeVoice] ❌ Error sending audio:', error);
        }
      };

      // Connect nodes: microphone -> processor -> destination
      source.connect(processor);
      processor.connect(localAudioContext.destination);

      // Store reference for cleanup
      this.audioWorkletNode = processor as any; // Store for later disconnection
      this.isCapturing = true;

      console.log('[RealtimeVoice] ✅ Audio capture started (PCM16 24kHz)');
      console.log('[RealtimeVoice] ℹ️ Audio is continuously streamed to server for VAD detection');
      console.log('[RealtimeVoice] ℹ️ Server will detect when you speak and auto-respond when you pause');

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
  /**
   * Send text message to the conversation
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
   * Handle function call from the AI
   * Executes the MCP tool via backend and returns result to the conversation
   */
  private async handleFunctionCall(callId: string, functionName: string, args: string): Promise<void> {
    try {
      console.log('[RealtimeVoice] 🔧 Executing MCP tool:', functionName);
      console.log('[RealtimeVoice] 🔧 Arguments:', args);

      // Parse arguments
      const parsedArgs = JSON.parse(args);

      // Call backend to execute the MCP tool
      const response = await axiosInstance.post('/ai/realtime/execute-tool/', {
        tool_name: functionName,
        arguments: parsedArgs
      });

      const result = response.data;
      console.log('[RealtimeVoice] ✅ Tool execution result:', result);

      // Send the function result back to the conversation
      if (this.transport) {
        this.transport.send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify(result)
          }
        });

        // Trigger response to continue the conversation with the function result
        this.transport.send({
          type: 'response.create'
        });

        console.log('[RealtimeVoice] ✅ Function result sent back to AI');
      }

    } catch (error) {
      console.error('[RealtimeVoice] ❌ Error executing tool:', error);
      
      // Send error back to the AI
      if (this.transport) {
        this.transport.send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({ 
              error: error instanceof Error ? error.message : 'Unknown error executing tool'
            })
          }
        });

        this.transport.send({
          type: 'response.create'
        });
      }
    }
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
      model: this.sessionConfig?.model,
      tools_count: this.sessionConfig?.tools_count
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
