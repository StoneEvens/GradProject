/**
 * Realtime Voice Service using @openai/agents SDK
 * 
 * Provides voice interaction with automatic MCP tool execution
 * Uses WebRTC for automatic audio handling (microphone + speaker)
 * 
 * Supports structured operations (navigate, OCR, etc.) that are emitted
 * as events for the frontend to handle.
 */

import { realtime } from '@openai/agents';
import { z } from 'zod';
import axiosInstance from '../utils/axios';

const { RealtimeAgent, RealtimeSession, tool } = realtime;

// Operation schema for UI actions that require physical changes
export interface RealtimeOperation {
  operation_type: string;
  operation_data: string | Record<string, any>;
}

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
          execute: async ({ operation, data }) => {
            const result = await executeViaMCP('perform_database_operation', { operation, data });
            
            // Auto-emit operations for post/record creation to trigger image upload
            try {
              const resultObj = typeof result === 'string' ? JSON.parse(result) : result;
              
              if (resultObj.success) {
                // Social post created - emit post_created operation
                if (operation === 'create_social_post' && resultObj.post_id) {
                  console.log('[RealtimeVoice] 📤 Auto-emitting post_created operation for post:', resultObj.post_id);
                  this.emit('agent_operations', {
                    operations: [{
                      operation_type: 'post_created',
                      operation_data: JSON.stringify({ post_id: resultObj.post_id, status: 'pending_images' })
                    }]
                  });
                }
                // Abnormal post created - emit abnormal_post_created operation
                else if (operation === 'add_abnormal_post' && resultObj.abnormal_post_id) {
                  console.log('[RealtimeVoice] 📤 Auto-emitting abnormal_post_created operation for:', resultObj.abnormal_post_id);
                  this.emit('agent_operations', {
                    operations: [{
                      operation_type: 'abnormal_post_created',
                      operation_data: JSON.stringify({ 
                        abnormal_post_id: resultObj.abnormal_post_id, 
                        pet_id: data.pet_id,
                        status: 'pending_images' 
                      })
                    }]
                  });
                }
                // Feed created - emit feed_created operation
                else if (operation === 'add_feed' && resultObj.feed_id && !resultObj.is_existing) {
                  console.log('[RealtimeVoice] 📤 Auto-emitting feed_created operation for feed:', resultObj.feed_id);
                  this.emit('agent_operations', {
                    operations: [{
                      operation_type: 'feed_created',
                      operation_data: JSON.stringify({ feed_id: resultObj.feed_id, status: 'pending_images' })
                    }]
                  });
                }
              }
            } catch (e) {
              console.warn('[RealtimeVoice] Could not parse result for auto-emit:', e);
            }
            
            return result;
          },
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
        
        // ====================================================================
        // EMIT OPERATIONS TOOL - Triggers frontend UI actions
        // Only for actions that CANNOT be conveyed through voice alone
        // ====================================================================
        tool({
          name: 'emit_operations',
          description: `Call this tool ONLY to trigger frontend UI actions that require physical UI changes.
Do NOT use this for information that can be spoken (recommendations, tutorials info, etc.)

Available operation_type values:
- "navigate": Navigate to a page. operation_data: {"path": "/route", "destination": "頁面名稱"}
- "ocr_feed_analysis": Open camera for feed nutrition OCR. operation_data: {}
- "ocr_health_report": Open camera for health report OCR. operation_data: {}
- "analyze_selected_images": Analyze images user has already selected for feed nutrition. operation_data: {}
- "start_tutorial": Start an interactive tutorial. operation_data: {"tutorial_id": "tutorial_name"}
  Available tutorial_id values: "addPet", "createPost", "addAbnormalPost", "calculate", "tagPet"
- "request_images": Open image picker for user to select images BEFORE creating a post. operation_data: {"purpose": "social_post" | "abnormal_post" | "feed"}
  IMPORTANT: Always request images FIRST before creating posts. Wait for user to select images, then create the post.
- "post_created": Trigger image upload after creating post. operation_data: {"post_id": 123}
- "abnormal_post_created": Trigger image upload. operation_data: {"abnormal_post_id": 123, "pet_id": 456}
- "feed_created": Trigger image upload. operation_data: {"feed_id": 123}
- "remove_image": Remove selected image by index. operation_data: {"index": 1}
- "replace_image": Replace selected image by index. operation_data: {"index": 1}

CRITICAL WORKFLOW FOR CREATING POSTS:
1. User wants to create a post → FIRST emit "request_images" to let user select images
2. Wait for user to confirm they've selected images (they will say "done" or "selected")
3. ONLY THEN call perform_database_operation to create the post
4. The post_created event will automatically upload the selected images

When to use:
1. User wants to navigate → emit navigate operation directly (no need to ask for confirmation)
2. User wants OCR but no images selected → emit ocr operation to open camera
3. User has already selected images and wants analysis → emit analyze_selected_images
4. User wants to learn how to do something step-by-step → emit start_tutorial
5. User wants to create a post/record → FIRST emit request_images, THEN create after selection
6. User asks to remove/replace a selected image`,
          parameters: z.object({
            operations: z.array(z.object({
              operation_type: z.string().describe('Type of operation'),
              operation_data: z.union([z.string(), z.record(z.any())]).describe('Operation parameters'),
            })).describe('Array of UI operations to trigger'),
          }),
          execute: async ({ operations }) => {
            console.log('[RealtimeVoice] 📤 Emitting operations:', operations);
            
            // Normalize operation_data to be consistent
            const normalizedOps = operations.map(op => ({
              operation_type: op.operation_type,
              operation_data: typeof op.operation_data === 'string' 
                ? op.operation_data 
                : JSON.stringify(op.operation_data),
            }));
            
            // Emit the operations event for frontend to handle
            this.emit('agent_operations', { operations: normalizedOps });
            
            // Return confirmation to the agent
            const opSummary = normalizedOps.map(op => op.operation_type).join(', ');
            return JSON.stringify({
              success: true,
              message: `已執行: ${opSummary}`,
              operations_count: normalizedOps.length,
            });
          },
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

      console.log(`[RealtimeVoice] ✅ Created agent with ${tools.length} tools (including emit_operations)`);

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
      // Log function-related events for debugging
      if (event.type && event.type.includes('function')) {
        console.log('[RealtimeVoice] Function-related event:', event.type);
        console.log('[RealtimeVoice] Event details:', JSON.stringify(event, null, 2));
      }
      
      // NOTE: Tool execution is handled automatically by the SDK via the `execute` functions
      // defined in the tool definitions. We only need to intercept events that the SDK
      // doesn't handle, or for logging/debugging purposes.
      
      // The SDK automatically:
      // 1. Receives function_call_arguments.done events
      // 2. Calls the execute() function we defined
      // 3. Sends the result back to OpenAI
      // So we DON'T need to manually intercept and execute tools here.
      
      // Forward other important events
      if (event.type === 'response.audio.delta') {
        this.emit('response.audio.delta', event);
      } else if (event.type === 'conversation.updated') {
        this.emit('conversation.updated', event);
      } else if (event.type === 'error') {
        // Log the error but check if it's fatal
        console.warn('[RealtimeVoice] Transport error event:', event);
        
        // Check if this is a fatal error that should end the session
        const errorCode = event.error?.code;
        const errorType = event.error?.type;
        const errorMessage = event.error?.message || '';
        
        // Fatal errors that should disconnect
        const fatalErrors = [
          'session_expired',
          'invalid_session',
          'authentication_error',
          'rate_limit_exceeded',
          'server_error',
          'connection_error'
        ];
        
        const isFatal = fatalErrors.some(fe => 
          errorCode === fe || 
          errorType === fe || 
          errorMessage.toLowerCase().includes(fe.replace('_', ' '))
        );
        
        if (isFatal) {
          console.error('[RealtimeVoice] Fatal error, emitting to end session:', errorCode || errorType);
          this.emit('error', event);
        } else {
          // Non-fatal error - log but don't end session
          // These could be tool execution errors, temporary issues, etc.
          console.warn('[RealtimeVoice] Non-fatal error (session continues):', errorMessage || event);
        }
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
   * Send image context update to the agent
   * This notifies the agent about currently selected images
   */
  async sendImageContext(imageCount: number, imageDescriptions?: string[]): Promise<void> {
    if (!this.session) {
      console.log('[RealtimeVoice] Not connected, skipping image context update');
      return;
    }

    let contextMessage = '';
    if (imageCount === 0) {
      contextMessage = '[系統訊息] 用戶已清除所有已選擇的圖片。';
    } else if (imageCount === 1) {
      contextMessage = `[系統訊息] 用戶已選擇 1 張圖片。你可以詢問用戶關於這張圖片的用途，例如：是否要進行飼料營養分析、新增貼文、或其他用途。`;
    } else {
      contextMessage = `[系統訊息] 用戶已選擇 ${imageCount} 張圖片。你可以詢問用戶關於這些圖片的用途，例如：是否要進行飼料營養分析、新增貼文、或其他用途。`;
    }

    console.log('[RealtimeVoice] Sending image context:', contextMessage);
    await this.session.sendMessage(contextMessage);
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

  /**
   * Check if the voice service is currently connected
   */
  isConnected(): boolean {
    return this.session !== null;
  }
}

// Export singleton instance
export const realtimeVoiceService = new RealtimeVoiceService();
export default realtimeVoiceService;
