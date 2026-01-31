# DRIFT - Dev Spec

## Stack

```
Web App:    React + Vite + Clerk + Supabase + Vercel AI SDK
Desktop:    Tauri + Tesseract OCR + Gemini
Sync:       WebSocket
```

---

## Generative UI: Role-based Components

```typescript
// Vercel AI SDK - AI wählt welche Components
const tools = {
  // PM Components
  showKanban: {
    description: 'Sprint overview as Kanban board',
    parameters: z.object({ tasks: z.array(TaskSchema) }),
    generate: ({ tasks }) => <KanbanBoard tasks={tasks} />
  },
  showUserStories: {
    description: 'User stories with acceptance criteria',
    parameters: z.object({ stories: z.array(StorySchema) }),
    generate: ({ stories }) => <UserStoryCards stories={stories} />
  },
  showTimeline: {
    description: 'Project timeline visualization',
    parameters: z.object({ milestones: z.array(MilestoneSchema) }),
    generate: ({ milestones }) => <TimelineView milestones={milestones} />
  },
  
  // Dev Components
  showArchitecture: {
    description: 'System architecture diagram',
    parameters: z.object({ components: z.array(ComponentSchema) }),
    generate: ({ components }) => <ArchitectureDiagram components={components} />
  },
  showAPISpec: {
    description: 'API endpoint specifications',
    parameters: z.object({ endpoints: z.array(EndpointSchema) }),
    generate: ({ endpoints }) => <APISpecCards endpoints={endpoints} />
  },
  showCode: {
    description: 'Code snippets with syntax highlighting',
    parameters: z.object({ snippets: z.array(CodeSchema) }),
    generate: ({ snippets }) => <CodeBlocks snippets={snippets} />
  },
  
  // Designer Components
  showUserFlow: {
    description: 'User flow diagram',
    parameters: z.object({ steps: z.array(FlowStepSchema) }),
    generate: ({ steps }) => <UserFlowDiagram steps={steps} />
  },
  showComponentSpec: {
    description: 'Component specifications with preview',
    parameters: z.object({ specs: z.array(SpecSchema) }),
    generate: ({ specs }) => <ComponentSpecCards specs={specs} />
  },
  showStates: {
    description: 'Component states and variants',
    parameters: z.object({ states: z.array(StateSchema) }),
    generate: ({ states }) => <StatesPreview states={states} />
  },
};

// Role-specific system prompts
const ROLE_PROMPTS = {
  pm: `Generate visual components for a Product Manager:
       - Kanban boards for task overview
       - User story cards with acceptance criteria
       - Timeline visualizations
       Focus on planning, priorities, stakeholders.`,
       
  dev: `Generate visual components for a Developer:
        - Architecture diagrams
        - API specifications
        - Code snippets (TypeScript)
        Focus on implementation, technical details.`,
        
  designer: `Generate visual components for a Designer:
             - User flow diagrams
             - Component specs with dimensions
             - State previews
             Focus on UX, visual specs, interactions.`,
};
```

---

## Data Model

```typescript
// Brief
interface Brief {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'completed';
  createdBy: string;
}

// Task (generated per role)
interface Task {
  id: string;
  briefId: string;
  role: 'pm' | 'dev' | 'designer';
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
}

// Work Submission (from Desktop)
interface Submission {
  id: string;
  briefId: string;
  userId: string;
  summary: string;           // AI-generated
  duration: number;          // Session length
  activities: Activity[];    // What was done
  matchedTasks: string[];    // Task IDs
  status: 'pending' | 'approved' | 'rejected';
}

// Activity (from recording)
interface Activity {
  app: string;
  title: string;
  summary: string;
  timestamp: number;
}
```

---

## Desktop App: Recording & Summary

```typescript
// Tauri - Recording Loop
async function recordSession() {
  const activities: Activity[] = [];
  
  while (isRecording) {
    const window = await getActiveWindow();
    const screenshot = await captureWindow();
    const text = await ocr(screenshot);
    
    activities.push({
      app: window.owner.name,
      title: window.title,
      summary: await summarize(text),
      timestamp: Date.now()
    });
    
    await sleep(5000); // Every 5 seconds
  }
  
  return activities;
}

// End Session - Generate Summary
async function endSession(activities: Activity[]) {
  const summary = await gemini.generate({
    prompt: `Summarize this work session:
             ${JSON.stringify(activities)}
             
             Output: Clear bullet points of what was accomplished.`
  });
  
  return {
    summary,
    duration: calculateDuration(activities),
    activities
  };
}

// Submit to Web App
async function submitToWorkspace(briefId: string, session: Session) {
  await api.post('/submissions', {
    briefId,
    ...session
  });
}
```

---

## Web App: View Generation

```typescript
// When user opens a brief
async function generateView(briefId: string, userRole: string) {
  const brief = await getBrief(briefId);
  
  const result = await streamUI({
    model: openai('gpt-4o'),
    system: ROLE_PROMPTS[userRole],
    prompt: `Brief: ${brief.name}
             Description: ${brief.description}
             
             Generate the appropriate visual components for this ${userRole}.`,
    tools
  });
  
  return result;
}
```

---

## WebSocket Events

```typescript
// Desktop → Web
'submission:new'     // New work submitted
'recording:status'   // Recording started/stopped

// Web → Desktop
'brief:active'       // Which brief is active
```

---

## Folder Structure

```
drift-web/
├── src/
│   ├── components/
│   │   ├── views/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── UserStoryCards.tsx
│   │   │   ├── TimelineView.tsx
│   │   │   ├── ArchitectureDiagram.tsx
│   │   │   ├── APISpecCards.tsx
│   │   │   ├── CodeBlocks.tsx
│   │   │   ├── UserFlowDiagram.tsx
│   │   │   ├── ComponentSpecCards.tsx
│   │   │   └── StatesPreview.tsx
│   │   ├── brief/
│   │   │   ├── BriefView.tsx
│   │   │   └── SubmissionReview.tsx
│   │   └── dashboard/
│   │       └── SprintOverview.tsx
│   └── lib/
│       └── ai-tools.ts

drift-desktop/
├── src-tauri/
│   └── src/
│       ├── capture.rs
│       ├── ocr.rs
│       └── session.rs
└── src/
    ├── App.tsx
    └── SessionSummary.tsx
```

---

## Hackathon Scope

**Day 1:**
- [ ] Clerk + Org setup
- [ ] Brief CRUD
- [ ] Basic Generative UI (2-3 components per role)

**Day 2:**
- [ ] Full role-based views
- [ ] Submission review UI
- [ ] Polish + Demo

**Post-Hackathon:**
- [ ] Desktop app
- [ ] Real recording
- [ ] Full component library
