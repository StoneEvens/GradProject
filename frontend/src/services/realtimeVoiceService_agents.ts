/**
 * Realtime Voice Service using @openai/agents SDK
 * 
 * Provides voice interaction with automatic MCP tool execution
 * Uses WebRTC for automatic audio handling (microphone + speaker)
 */

import { realtime, hostedMcpTool } from '@openai/agents';
import axiosInstance from '../utils/axios';

const { RealtimeAgent, RealtimeSession } = realtime;

// Simple EventEmitter implementation for browser
class EventEmitter {
  private events: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

export interface CreateSessionOptions {
  conversationId?: number;
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  language?: string;
}

export interface RealtimeSessionConfig {
  client_secret: {
    value: string;
    expires_at: number;
  };
  model: string;
  voice: string;
  instructions: string;
  tools_count: number;
  user_id: number;
  conversation_id?: number;
  conversation_title?: string;
  greeting?: string;
  language?: string;
  audio?: any;
}

class RealtimeVoiceService extends EventEmitter {
  private sessionConfig: RealtimeSessionConfig | null = null;
  private session: typeof RealtimeSession.prototype | null = null;
  private agent: typeof RealtimeAgent.prototype | null = null;
  private emittedItemIds: Set<string> = new Set(); // Track emitted items to avoid duplicates

  constructor() {
    super();
  }

  /**
   * Create a new realtime session through the backend
   * Backend configures session and returns ephemeral token
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
        greeting: this.sessionConfig.greeting,
        language: this.sessionConfig.language,
        expires_at: new Date(this.sessionConfig.client_secret.expires_at * 1000).toISOString()
      });

      return this.sessionConfig;
    } catch (error) {
      console.error('[RealtimeVoice] ❌ Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Connect to the realtime session using agents SDK
   * WebRTC transport handles audio input/output automatically
   */
  async connect(): Promise<void> {
    if (!this.sessionConfig) {
      throw new Error('No session config. Call createSession() first.');
    }

    try {
      console.log('[RealtimeVoice] Creating RealtimeAgent...');
      
      // Create MCP tool connection for automatic tool execution
      const mcpTool = hostedMcpTool({
        serverLabel: 'peter-mcp',
        serverUrl: 'https://peter.geniusbee.net/mcp/sse',
        requireApproval: 'never', // Auto-approve all tool calls
      });
      
      // Create RealtimeAgent with instructions and MCP tools
      this.agent = new RealtimeAgent({
        name: 'peter',
        instructions: this.sessionConfig.instructions,
        voice: this.sessionConfig.voice as any,
        tools: [mcpTool], // SDK automatically handles tool execution
      });

      console.log('[RealtimeVoice] Creating RealtimeSession...');
      
      // Create session with the agent (defaults to WebRTC = automatic audio)
      this.session = new RealtimeSession(this.agent, {
        model: this.sessionConfig.model,
      });

      console.log('[RealtimeVoice] Setting up event listeners...');
      this.setupEventListeners();

      console.log('[RealtimeVoice] Connecting with ephemeral token...');
      
      // Connect using the ephemeral token from backend
      await this.session.connect({
        apiKey: this.sessionConfig.client_secret.value,
      });
      
      console.log('[RealtimeVoice] ✅ Connected successfully (WebRTC auto-handling audio)');

      // Send greeting if available
      if (this.sessionConfig.greeting) {
        setTimeout(() => {
          this.sendGreeting();
        }, 1000);
      }

    } catch (error) {
      console.error('[RealtimeVoice] ❌ Connection failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for the realtime session
   */
  private setupEventListeners(): void {
    if (!this.session) return;

    // Listen for when items are added to history (better than history_updated)
    // This fires once per item when it's completed
    this.session.on('history_added', (item: any) => {
      console.log('[RealtimeVoice] History item added:', {
        id: item.id,
        type: item.type,
        role: item.role,
        status: item.status,
      });
      
      // Only emit message items that are completed
      if (item.type === 'message' && item.role && item.status === 'completed') {
        const itemId = item.id;
        
        // Double-check we haven't emitted this already
        if (!this.emittedItemIds.has(itemId)) {
          console.log('[RealtimeVoice] Emitting conversation.item.completed for:', {
            id: itemId,
            role: item.role,
          });
          
          this.emittedItemIds.add(itemId);
          this.emit('conversation.item.completed', { item });
        }
      }
    });

    // Listen for audio interruptions
    this.session.on('audio_interrupted', () => {
      console.log('[RealtimeVoice] Audio interrupted');
    });

    // Listen for tool approval requests (shouldn't happen with requireApproval: 'never')
    this.session.on('tool_approval_requested', (context, agent, request) => {
      console.log('[RealtimeVoice] Tool approval requested:', request);
    });

    // Listen for guardrail trips
    this.session.on('guardrail_tripped', (details) => {
      console.log('[RealtimeVoice] Guardrail tripped:', details);
    });

    // Access the transport layer to listen to all raw events
    this.session.transport.on('*', (event: any) => {
      // Log important events
      if (event.type === 'response.audio.delta') {
        this.emit('response.audio.delta', event);
      } else if (event.type === 'conversation.updated') {
        this.emit('conversation.updated', event);
      } else if (event.type === 'error') {
        console.error('[RealtimeVoice] Transport error:', event);
        this.emit('error', event);
      }
    });

    console.log('[RealtimeVoice] ✅ Event listeners configured');
  }

  /**
   * Start recording audio from the microphone
   * WebRTC handles this automatically, so this method just ensures connection
   */
  async startRecording(): Promise<void> {
    if (!this.session) {
      throw new Error('Not connected. Call connect() first.');
    }
    
    console.log('[RealtimeVoice] ✅ WebRTC is auto-recording (no manual start needed)');
  }

  /**
   * Stop recording audio from the microphone
   * WebRTC handles this automatically, so this is a no-op
   */
  stopRecording(): void {
    console.log('[RealtimeVoice] ✅ WebRTC auto-recording will stop on disconnect');
  }

  /**
   * Send the initial greeting
   */
  private async sendGreeting(): Promise<void> {
    if (this.session && this.sessionConfig?.greeting) {
      try {
        console.log('[RealtimeVoice] 👋 Sending greeting:', this.sessionConfig.greeting);
        await this.session.sendMessage(this.sessionConfig.greeting);
      } catch (error) {
        console.error('[RealtimeVoice] ❌ Failed to send greeting:', error);
      }
    }
  }

  /**
   * Send a text message
   */
  async sendMessage(text: string): Promise<void> {
    if (!this.session) {
      throw new Error('Not connected. Call connect() first.');
    }

    console.log('[RealtimeVoice] Sending message:', text);
    await this.session.sendMessage(text);
  }

  /**
   * Send audio data (for manual audio control)
   */
  async sendAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.session) {
      throw new Error('Not connected. Call connect() first.');
    }

    await this.session.sendAudio(audioData);
  }

  /**
   * Mute/unmute microphone
   */
  mute(muted: boolean): void {
    if (this.session) {
      this.session.mute(muted);
    }
  }

  /**
   * Manually interrupt the agent's response
   */
  interrupt(): void {
    if (this.session) {
      console.log('[RealtimeVoice] Interrupting agent response...');
      this.session.interrupt();
    }
  }

  /**
   * Disconnect from the session
   */
  async disconnect(): Promise<void> {
    console.log('[RealtimeVoice] Disconnecting...');
    
    // Close session (WebRTC cleanup is automatic)
    if (this.session) {
      await this.session.close();
      this.session = null;
      this.agent = null;
    }
    
    // Clear emitted items tracking
    this.emittedItemIds.clear();
    
    // Remove all event listeners
    this.removeAllListeners();
    
    console.log('[RealtimeVoice] ✅ Disconnected');
  }

  /**
   * Get the current session
   */
  getSession(): typeof RealtimeSession.prototype | null {
    return this.session;
  }
}

// Export singleton instance
export const realtimeVoiceService = new RealtimeVoiceService();
export default realtimeVoiceService;
