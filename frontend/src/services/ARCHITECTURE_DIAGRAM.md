# Operation Client System - Visual Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (Django)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AI Agent (LLM + MCP + Your Logic)                       │   │
│  │  - Processes user message                                │   │
│  │  - Generates response text                               │   │
│  │  - Creates operation commands                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             │ HTTP Response                      │
│                             ▼                                    │
│  {                                                               │
│    "response": "I'll navigate to your pet profile",            │
│    "operations": [                                              │
│      {                                                          │
│        "operation_id": "uuid",                                 │
│        "type": "navigate",                                     │
│        "params": {"path": "/pets/123"},                        │
│        "requires_confirmation": false                          │
│      }                                                          │
│    ]                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Axios HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  aiChatService.js                                        │   │
│  │  - Receives backend response                             │   │
│  │  - Extracts operations array                             │   │
│  │  - Calls operationClient.addOperations()                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  operationClient.js                                      │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  operationQueue.js                                 │  │   │
│  │  │  Queue: [op1] [op2] [op3] ...                      │  │   │
│  │  │  Status: pending → executing → completed/failed    │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             │ User clicks "Execute Next"         │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  operationExecutor.js                                    │   │
│  │  - navigate: React Router navigate()                     │   │
│  │  - fill_form: Find inputs, set values, trigger events    │   │
│  │  - click: Find button, click it                          │   │
│  │  - display_data: Dispatch custom event                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React Router / DOM / Components                         │   │
│  │  - Page changes                                          │   │
│  │  - Forms get filled                                      │   │
│  │  - Buttons get clicked                                   │   │
│  │  - UI updates                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## User Flow

```
1. USER INTERACTION
   User: "Take me to my pet's profile"
         │
         ▼
   ┌─────────────┐
   │ ChatWindow  │
   │ (User types)│
   └─────────────┘
         │
         ▼
   
2. AI PROCESSING
   ┌──────────────────────────┐
   │ Backend AI Agent         │
   │ - LLM understands intent │
   │ - Creates navigation op  │
   └──────────────────────────┘
         │
         ▼
   Returns: {
     response: "Sure!",
     operations: [navigate_op]
   }
         │
         ▼

3. OPERATION QUEUED
   ┌──────────────────────────┐
   │ aiChatService            │
   │ - Adds to queue          │
   └──────────────────────────┘
         │
         ▼
   ┌──────────────────────────┐
   │ Operation Queue          │
   │ [📋 1 operation pending] │
   └──────────────────────────┘
         │
         ▼

4. USER CONFIRMATION (Optional)
   ┌──────────────────────────┐
   │ ChatWindow Shows:        │
   │ ⚙️ 1 operation pending   │
   │ [Execute Next] button    │
   └──────────────────────────┘
         │
         │ User clicks
         ▼

5. OPERATION EXECUTES
   ┌──────────────────────────┐
   │ Operation Executor       │
   │ - Calls navigate()       │
   └──────────────────────────┘
         │
         ▼

6. UI UPDATES
   ┌──────────────────────────┐
   │ React Router             │
   │ - Changes page           │
   │ - User sees pet profile  │
   └──────────────────────────┘
         │
         ▼
   ✅ Operation Complete!
```

## Data Flow Diagram

```
Backend                  Frontend                    UI
───────                  ────────                    ──

[AI Agent]
    │
    │ Generates
    ▼
operations[] ────HTTP───▶ [aiChatService]
                              │
                              │ Adds to
                              ▼
                         [operationQueue]
                              │
                              │ Notifies
                              ▼
                         [OperationContext]
                              │
                              │ Updates
                              ▼
                         [ChatWindow UI]
                              │
                              │ User clicks
                              ▼
                         [operationClient]
                              │
                              │ Executes
                              ▼
                         [operationExecutor]
                              │
                              ├─▶ navigate() ──▶ [React Router] ──▶ Page Change
                              ├─▶ fill_form() ─▶ [DOM Inputs]  ──▶ Forms Filled
                              ├─▶ click() ─────▶ [DOM Button]  ──▶ Button Clicked
                              └─▶ display_data()▶ [Event]      ──▶ Data Shown
```

## Component Relationships

```
App.jsx
  │
  ├─ <UserProvider>
  │    └─ User context
  │
  └─ <BrowserRouter>
       │
       ├─ <OperationProvider>
       │    │
       │    ├─ OperationContext (state)
       │    └─ All child components can access
       │
       ├─ <OperationInitializer />
       │    └─ Calls operationClient.initialize(navigate)
       │
       └─ <Routes>
            └─ Pages
                 └─ <ChatWindow>
                      │
                      ├─ Uses: useOperation()
                      ├─ Shows: queueState.size
                      └─ Calls: executeNext()
```

## File Dependencies

```
operationQueue.js (standalone)
       ▲
       │ imports
operationExecutor.js (standalone)
       ▲
       │ imports both
operationClient.js
       ▲
       │ imports
       │
       ├─ aiChatService.js (calls addOperations)
       │
       └─ OperationContext.jsx (wraps client)
              ▲
              │ uses
          ChatWindow.jsx (UI)
              ▲
              │ rendered in
          App.jsx (initializes)
```

## State Flow

```
Queue State:
┌─────────────────────────────────────┐
│ operationQueue (internal state)     │
│ - queue: Array<Operation>           │
│ - listeners: Array<Function>        │
└─────────────────────────────────────┘
              │ notifies
              ▼
┌─────────────────────────────────────┐
│ OperationContext (React state)      │
│ - queueState                         │
│ - confirmationRequired               │
│ - executionHistory                   │
└─────────────────────────────────────┘
              │ provides
              ▼
┌─────────────────────────────────────┐
│ ChatWindow (component state)        │
│ - Displays pending count             │
│ - Shows execute button               │
└─────────────────────────────────────┘
```

## Execution Lifecycle

```
Operation Created:
{
  operation_id: "uuid",
  type: "navigate",
  params: {...},
  requires_confirmation: false,
  status: "pending"  ← Initial
}
      │
      │ User clicks Execute
      ▼
{
  ...
  status: "executing"  ← During execution
}
      │
      │ Executor completes
      ▼
{
  ...
  status: "completed",  ← Success
  result: {...}
}
      │
      │ Remove from queue
      ▼
{
  Stored in executionHistory
  Available for UI display
}
```

## Key Integration Points

```
1. Backend → Frontend
   └─ AI view returns operations[] in response

2. Frontend → Operation System
   └─ aiChatService.processMessage() adds operations

3. Operation System → React
   └─ OperationContext provides state to components

4. React → Execution
   └─ User clicks → executeNext() → Executor runs

5. Execution → UI
   └─ Navigate/fill/click updates DOM and React state
```

This visual guide shows how all pieces fit together!
