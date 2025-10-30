# AI Agent Operation Client System

## Overview

This system enables an AI Agent to control the website by queuing and executing operations like page navigation, form filling, and button clicks. The architecture decouples the AI decision-making from UI execution, providing better control and security.

## Architecture

```
┌─────────────┐
│   Backend   │
│  (Django)   │
│  + LLM      │
└──────┬──────┘
       │ Returns operation commands
       ↓
┌─────────────────────┐
│   AI Chat Service   │
│ (aiChatService.js)  │
└──────┬──────────────┘
       │ Adds operations to queue
       ↓
┌─────────────────────┐
│ Operation Client    │
│ (operationClient.js)│
├─────────────────────┤
│ • Queue Manager     │
│ • Executor          │
│ • Event System      │
└──────┬──────────────┘
       │ Executes when user confirms
       ↓
┌─────────────────────┐
│   React UI          │
│ • Navigation        │
│ • Form Filling      │
│ • Button Clicks     │
└─────────────────────┘
```

## Components

### 1. Operation Queue (`operationQueue.js`)
- **Purpose**: FIFO queue for storing operations
- **Features**:
  - Add/remove operations
  - Status tracking (pending/executing/completed/failed)
  - Event notifications
  - Queue size limits
- **Key Methods**:
  - `enqueue(operation)` - Add operation
  - `dequeue()` - Remove and return first operation
  - `peek()` - View first operation without removing
  - `clear()` - Clear all operations

### 2. Operation Executor (`operationExecutor.js`)
- **Purpose**: Execute operations on the DOM and React components
- **Supported Operations**:
  - **navigate**: Route navigation using React Router
  - **fill_form**: Fill form inputs with values
  - **click**: Click buttons or elements
  - **display_data**: Show data to user (custom event)
- **Key Methods**:
  - `execute(operation)` - Execute an operation
  - `setNavigate(navigateFunction)` - Set React Router navigate

### 3. Operation Client (`operationClient.js`)
- **Purpose**: Main service interface coordinating queue and executor
- **Features**:
  - Operation lifecycle management
  - Confirmation handling
  - Auto-execute mode
  - Event system for UI updates
- **Key Methods**:
  - `initialize(config)` - Initialize with navigate function
  - `addOperation(operation)` - Queue an operation
  - `executeNext(skipConfirmation)` - Execute first queued operation
  - `executeAll(skipConfirmations)` - Execute all operations
  - `cancelAll()` - Cancel everything

### 4. Operation Context (`OperationContext.jsx`)
- **Purpose**: React Context for easy access throughout component tree
- **Provides**:
  - Queue state (size, operations, processing status)
  - Confirmation state
  - Execution history
  - Helper functions
- **Hook**: `useOperation()` - Access context in components

## Operation Command Format

Backend should return operations in this format:

```javascript
{
  "operations": [
    {
      "operation_id": "uuid-string",
      "type": "navigate|fill_form|click|display_data",
      "params": {
        // Type-specific parameters
      },
      "requires_confirmation": true|false
    }
  ]
}
```

### Operation Types

#### 1. Navigate
```javascript
{
  "operation_id": "nav-001",
  "type": "navigate",
  "params": {
    "path": "/pets/123",
    "state": { "fromAI": true }  // optional
  },
  "requires_confirmation": true
}
```

#### 2. Fill Form
```javascript
{
  "operation_id": "form-001",
  "type": "fill_form",
  "params": {
    "petName": "Fluffy",
    "petAge": "3",
    "petBreed": "Golden Retriever"
  },
  "requires_confirmation": true
}
```

The params keys should match:
- `name` attribute of input elements
- `id` of input elements
- `placeholder` text
- `data-field` attribute

#### 3. Click
```javascript
{
  "operation_id": "click-001",
  "type": "click",
  "params": {
    "selector": ".submit-button",  // CSS selector
    "text": "Submit"  // or button text
  },
  "requires_confirmation": true
}
```

#### 4. Display Data
```javascript
{
  "operation_id": "display-001",
  "type": "display_data",
  "params": {
    "message": "Here's your pet's information",
    "data": { /* any data */ }
  },
  "requires_confirmation": false
}
```

## Integration Points

### Backend (Django)
Your AI view should return:
```python
return Response({
    'response': 'I will navigate to your pet profile now.',
    'operations': [
        {
            'operation_id': str(uuid.uuid4()),
            'type': 'navigate',
            'params': {
                'path': f'/pets/{pet_id}'
            },
            'requires_confirmation': True
        }
    ],
    # ... other fields
})
```

### Frontend (Already Integrated)
1. **App.jsx**: Initializes operation client with navigate function
2. **aiChatService.js**: Automatically adds operations to queue
3. **ChatWindow.jsx**: Shows pending operations with execute button
4. **OperationContext**: Provides state to all components

## Usage Examples

### From Any Component

```javascript
import { useOperation } from '../context/OperationContext';

function MyComponent() {
  const {
    queueState,
    addOperation,
    executeNext,
    confirmAndExecute
  } = useOperation();
  
  // Check queue status
  console.log(`${queueState.size} operations pending`);
  
  // Add a custom operation
  addOperation({
    operation_id: 'custom-001',
    type: 'navigate',
    params: { path: '/social' },
    requires_confirmation: false
  });
  
  // Execute next operation
  await executeNext();
  
  // Or execute without confirmation
  await executeNext(true);
}
```

### Listen to Operation Events

```javascript
import operationClient from '../services/operationClient';

// Listen to execution events
operationClient.on('executionCompleted', ({ operation, result }) => {
  console.log('Operation completed:', operation.operation_id);
});

operationClient.on('executionFailed', ({ operation, error }) => {
  console.error('Operation failed:', error);
});
```

## User Flow

1. **User asks AI**: "Take me to my pet's profile"
2. **Backend processes**: LLM generates response + operation commands
3. **AI Chat Service**: Receives response, adds operations to queue
4. **ChatWindow**: Shows "1 operation pending" indicator
5. **User clicks**: "Execute Next" button
6. **Operation Client**: 
   - If `requires_confirmation: true` → Shows confirmation dialog
   - User confirms → Executes operation
7. **Executor**: Performs navigation using React Router
8. **UI Updates**: User sees new page

## Security Features

1. **Queue Isolation**: Operations stored in memory, not accessible globally
2. **Confirmation Required**: Critical operations require user confirmation
3. **Validation**: Operations validated before queuing
4. **Size Limits**: Queue limited to prevent memory issues
5. **Manual Execution**: Operations don't auto-execute (by default)

## Configuration

### Enable Auto-Execute Mode
```javascript
// In App.jsx OperationInitializer
operationClient.initialize({
  navigate,
  autoExecute: true  // Operations execute automatically
});

// Or dynamically
const { setAutoExecute } = useOperation();
setAutoExecute(true);
```

### Adjust Queue Size
```javascript
// In operationQueue.js
constructor() {
  this.maxSize = 100;  // Adjust as needed
}
```

## Debugging

### Check Queue State
```javascript
const { queueState } = useOperation();
console.log(queueState);
// {
//   size: 2,
//   isEmpty: false,
//   operations: [...],
//   isProcessing: false
// }
```

### View Operation History
```javascript
const { executionHistory } = useOperation();
console.log(executionHistory);
// Last 20 executed operations with results
```

### Check if Client is Ready
```javascript
const { isReady } = useOperation();
if (!isReady()) {
  console.warn('Operation client not ready - navigate function missing');
}
```

## Extending the System

### Add New Operation Type

1. **Add to Executor** (`operationExecutor.js`):
```javascript
case 'custom_action':
  result = await this.executeCustomAction(operation.params);
  break;
```

2. **Implement Method**:
```javascript
async executeCustomAction(params) {
  // Your custom logic
  return { action: 'custom_action', result: 'success' };
}
```

3. **Backend Returns**:
```python
{
    'type': 'custom_action',
    'params': { 'customParam': 'value' }
}
```

## Troubleshooting

### Operations Not Being Added
- Check backend response format matches spec
- Check console for aiChatService logs
- Verify operations array exists in response

### Operations Not Executing
- Ensure operation client is initialized (check App.jsx)
- Check if navigate function is set
- Look for validation errors in console

### Form Filling Not Working
- Verify form element selectors (name, id, placeholder)
- Check if React state is updating (use triggerInputEvent)
- Ensure element is visible and not disabled

### Navigation Not Working
- Confirm React Router is properly set up
- Check path format (should start with `/`)
- Verify route exists in App.jsx

## Best Practices

1. **Always Require Confirmation** for destructive actions (delete, submit)
2. **Use Clear Operation IDs** for debugging (e.g., `nav-pet-profile-001`)
3. **Break Complex Tasks** into atomic operations
4. **Validate Backend Responses** before sending to client
5. **Test Operations** in isolation before integrating with AI
6. **Monitor Queue Size** to prevent memory issues
7. **Log Operation Results** for debugging and analytics

## Future Enhancements

- [ ] Operation rollback/undo functionality
- [ ] Operation scheduling (delayed execution)
- [ ] Batch operation optimization
- [ ] Visual operation preview
- [ ] Operation templates
- [ ] Persistent queue (localStorage)
- [ ] Operation analytics dashboard
- [ ] Multi-step operation workflows
- [ ] Conditional operation execution

## Files Created

```
frontend/src/
├── services/
│   ├── operationQueue.js      # Queue management
│   ├── operationExecutor.js   # Operation execution
│   ├── operationClient.js     # Main service interface
│   └── aiChatService.js       # (Modified) Integrates with operations
├── context/
│   └── OperationContext.jsx   # React context provider
├── components/
│   └── ChatWindow.jsx         # (Modified) Shows queue status
└── App.jsx                    # (Modified) Initializes system
```

## Contact

For questions or issues with the operation client system, check the implementation files or console logs for debugging information.
