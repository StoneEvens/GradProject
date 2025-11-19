/**
 * Realtime Voice Service using @openai/agents SDK
 * 
 * Provides voice interaction with automatic MCP tool execution
 * Uses WebRTC for automatic audio handling (microphone + speaker)
 */

import { realtime } from '@openai/agents';
import { z } from 'zod';
import axiosInstance from '../utils/axios';

const { RealtimeAgent, RealtimeSession, tool } = realtime;

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
      
      // Define ALL MCP tools that execute via backend
      // The SDK will handle calling these automatically when the agent needs them
      
      // Helper function to execute any tool via backend
      const executeViaMCP = async (toolName: string, args: any) => {
        console.log(`[RealtimeVoice] 🔧 Executing ${toolName} via backend`);
        console.log(`[RealtimeVoice] Arguments:`, args);
        const response = await axiosInstance.post('/ai/realtime/execute-tool/', {
          tool_name: toolName,
          arguments: args,
        });
        console.log('[RealtimeVoice] ✅ Tool result received:', response.data);
        // Backend returns {result: "..."}, we want just the result string
        return response.data.result || JSON.stringify(response.data);
      };

      const tools = [
        tool({
          name: 'get_user_pet_info_detailed',
          description: 'Fetch a user\'s basic profile and their pets (including related entities)',
          parameters: z.object({
            user_id: z.number().describe('The ID of the user to fetch information for'),
          }),
          execute: async ({ user_id }) => executeViaMCP('get_user_pet_info_detailed', { user_id }),
        }),
        
        tool({
          name: 'get_user_pet_list',
          description: 'Fetch a user\'s list of pets',
          parameters: z.object({
            user_id: z.number().describe('The ID of the user'),
          }),
          execute: async ({ user_id }) => executeViaMCP('get_user_pet_list', { user_id }),
        }),
        
        tool({
          name: 'get_post_recommendations',
          description: 'Get recommended social posts based on a natural-language content description. Use keywords for better results.',
          parameters: z.object({
            content_description: z.string().describe('Content description with keywords'),
            hashtags: z.array(z.string()).describe('Array of hashtags'),
            isSocial: z.boolean().describe('Include social posts'),
            isForum: z.boolean().describe('Include forum posts'),
          }),
          execute: async (args) => executeViaMCP('get_post_recommendations', args),
        }),
        
        tool({
          name: 'get_user_information',
          description: 'Fetch basic information of a user by their user ID',
          parameters: z.object({
            user_ids: z.array(z.number()).describe('Array of user IDs to fetch'),
          }),
          execute: async ({ user_ids }) => executeViaMCP('get_user_information', { user_ids }),
        }),
        
        tool({
          name: 'get_user_pet_types',
          description: 'Fetch the types of pets owned by a user',
          parameters: z.object({
            user_ids: z.array(z.number()).describe('Array of user IDs'),
          }),
          execute: async ({ user_ids }) => executeViaMCP('get_user_pet_types', { user_ids }),
        }),
        
        tool({
          name: 'get_pet_foods_details',
          description: 'Fetch detailed information about pet foods',
          parameters: z.object({}),
          execute: async () => executeViaMCP('get_pet_foods_details', {}),
        }),
        
        tool({
          name: 'list_tutorial_topics',
          description: 'List available tutorial topics for users as an id->description mapping',
          parameters: z.object({}),
          execute: async () => executeViaMCP('list_tutorial_topics', {}),
        }),
        
        tool({
          name: 'get_navigation_paths',
          description: 'Get all available page paths and their mappings. Use this to find the correct path for user navigation requests',
          parameters: z.object({}),
          execute: async () => executeViaMCP('get_navigation_paths', {}),
        }),
        
        tool({
          name: 'prepare_navigate',
          description: 'Prepare a page navigation operation that requires user confirmation. Call get_navigation_paths first to find the correct path',
          parameters: z.object({
            path: z.string().describe('The navigation path'),
            reason: z.string().optional().describe('Reason for navigation'),
          }),
          execute: async (args) => executeViaMCP('prepare_navigate', args),
        }),
        
        tool({
          name: 'database_operation_list',
          description: 'List available database operations as well as the parameters required',
          parameters: z.object({}),
          execute: async () => executeViaMCP('database_operation_list', {}),
        }),
        
        tool({
          name: 'perform_database_operation',
          description: 'Perform database operations: add_pet (create new pet), update_pet (modify pet), add_abnormal_post (health record), update_abnormal_post, delete_abnormal_post, create_disease_archive, add_plan (CREATE schedule/calendar event), update_plan (modify schedule), delete_plan (remove schedule), list_plans (view schedules), create_social_post. CRITICAL: For schedules use "add_plan" NOT "create_schedule". Call database_operation_list first to see required parameters.',
          parameters: z.object({
            operation: z.string().describe('Exact operation name: add_pet, update_pet, add_abnormal_post, update_abnormal_post, delete_abnormal_post, create_disease_archive, add_plan, update_plan, delete_plan, list_plans, create_social_post'),
            data: z.any().describe('The data for the operation'),
          }),
          execute: async ({ operation, data }) => executeViaMCP('perform_database_operation', { operation, data }),
        }),
        
        tool({
          name: 'resolve_entity_context',
          description: 'Resolve dynamic path parameters by finding entities based on natural language descriptions. Supports: social_post, feed, pet, user, health_report, disease_archive',
          parameters: z.object({
            entity_type: z.string().describe('Type of entity to resolve'),
            description: z.string().describe('Natural language description'),
            user_id: z.number().optional().describe('User ID for context'),
          }),
          execute: async (args) => executeViaMCP('resolve_entity_context', args),
        }),
      ];
      
      // Create RealtimeAgent with instructions and ALL tools
      // The SDK will automatically handle tool execution
      this.agent = new RealtimeAgent({
        name: 'peter',
        instructions: this.sessionConfig.instructions,
        voice: this.sessionConfig.voice as any,
        tools: tools,
      });

      console.log('[RealtimeVoice] ✅ Created agent with 3 tools');

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
      console.log('[RealtimeVoice] 🛠️  Tools registered and ready for automatic execution');

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

    // Access the transport layer to intercept function call events
    this.session.transport.on('*', async (event: any) => {
      // Log all events for debugging
      if (event.type && event.type.includes('function')) {
        console.log('[RealtimeVoice] Function-related event:', event.type, event);
      }
      
      // Intercept function call requests
      if (event.type === 'response.function_call_arguments.done') {
        const { call_id, name, arguments: args } = event;
        console.log('[RealtimeVoice] Function call detected:', { call_id, name, args });
        
        try {
          // Execute tool via backend
          const result = await this.executeToolViaBackend(name, args);
          console.log('[RealtimeVoice] Tool result:', result);
          
          // Send the result back to the session
          this.session!.transport.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: call_id,
              output: JSON.stringify(result),
            },
          });
          
          // Trigger a new response with the tool output
          this.session!.transport.sendEvent({
            type: 'response.create',
          });
        } catch (error) {
          console.error('[RealtimeVoice] Tool execution failed:', error);
          
          // Send error back to session
          this.session!.transport.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: call_id,
              output: JSON.stringify({ error: String(error) }),
            },
          });
        }
      }
      
      // Forward other important events
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
   * Execute a tool call via the backend
   */
  private async executeToolViaBackend(toolName: string, args: string): Promise<any> {
    console.log('[RealtimeVoice] Executing tool via backend:', toolName);
    console.log('[RealtimeVoice] Raw args type:', typeof args);
    console.log('[RealtimeVoice] Raw args value:', args);
    
    try {
      const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
      console.log('[RealtimeVoice] Parsed args:', parsedArgs);
      
      const payload = {
        tool_name: toolName,
        arguments: parsedArgs,
      };
      console.log('[RealtimeVoice] Sending payload:', payload);
      
      const response = await axiosInstance.post('/ai/realtime/execute-tool/', payload);
      
      console.log('[RealtimeVoice] Backend response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[RealtimeVoice] Backend tool execution error:', error);
      if (error.response) {
        console.error('[RealtimeVoice] Error response data:', error.response.data);
        console.error('[RealtimeVoice] Error response status:', error.response.status);
      }
      throw error;
    }
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
