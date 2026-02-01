# Orgio - Product Overview

## One-Liner
**AI-powered Sprint Planning mit personalisierten Views + automatisches Work Tracking durch Desktop Recording.**

---

## Das Problem

Teams heute:
- PM fragt ChatGPT → bekommt PM-Antwort
- Dev fragt ChatGPT → bekommt Dev-Antwort  
- Designer fragt ChatGPT → bekommt Designer-Antwort
- **3x die gleiche Arbeit, keine Sync, kein Tracking**

Dann:
- Manuelles Jira-Update vergessen
- Standup Meetings um zu erfahren was gemacht wurde
- Keiner weiß wirklich wo das Projekt steht

---

## Die Lösung: DRIFT

### 1. Ein Brief, drei Views (Web App)
PM erstellt Brief: "Apple Pay Checkout"

**Generative UI** - AI wählt welche Components gerendert werden:

| PM sieht | Dev sieht | Designer sieht |
|----------|-----------|----------------|
| Kanban Board | Architecture Diagram | User Flow |
| User Stories | API Specs | Component Specs |
| Timeline | Code Snippets | States Preview |

→ Gleicher Brief, komplett andere Visualisierung basierend auf Rolle.

### 2. Background Recording (Desktop App)
- Läuft automatisch im Hintergrund
- Tracked: Browser, Cursor, Figma, Slack, etc.
- Erkennt was du machst (OCR + AI)

### 3. PR-Style Submissions
Session beenden → AI generiert Summary:
```
"Du hast heute:
• Stripe Webhook implementiert
• Error Handling gefixt
• Unit Tests geschrieben"
```

User kann editieren → "Add to Workspace" (wie ein PR)

### 4. Team Review (Web App)
- Team sieht: "Max submitted work"
- AI matched zu Tasks
- Approve → Checklists updaten automatisch
- Sprint Progress updated

---

## Full User Story

```
MORGEN:
Sarah (PM) öffnet Drift, erstellt Brief: "Apple Pay Checkout"
→ Sie sieht: Kanban, User Stories, Timeline
→ Max (Dev) öffnet gleichen Brief
→ Er sieht: Architecture, API Specs, Code
→ Lisa (Designer) öffnet gleichen Brief
→ Sie sieht: User Flow, Component Specs, States

TAGSÜBER:
Max startet Desktop App, wählt Brief
→ Recording läuft im Background
→ Er arbeitet in Cursor, Chrome, Terminal
→ Drift tracked alles automatisch

ABENDS:
Max beendet Session
→ AI: "Du hast Stripe Webhook implementiert, Tests geschrieben"
→ Max editiert/verfeinert Summary
→ Klickt "Add to Workspace"

IM TEAM:
Sarah sieht: "Max submitted work"
→ Öffnet Submission
→ AI hat zu Tasks gematched
→ Klickt "Approve"
→ Checklists updaten automatisch
→ Sprint Progress: 60% → 75%

REPEAT.
```

---

## Warum das funktioniert

| Heute | Mit Drift |
|-------|-----------|
| Jeder fragt AI separat | Eine Quelle, personalisierte Views |
| Manuelles Task-Tracking | Automatisch durch Recording |
| Standup Meetings | PRs zeigen was gemacht wurde |
| Jira Updates vergessen | Auto-Updates durch Submissions |
| Keiner weiß wo Projekt steht | Real-time Progress durch Approvals |

---

## Key Differentiators

| Feature | ChatGPT/Claude | Notion AI | Drift |
|---------|----------------|-----------|-------|
| Role-based Views | ❌ | ❌ | ✅ Generative UI |
| Auto Work Tracking | ❌ | ❌ | ✅ Desktop Recording |
| PR-style Submissions | ❌ | ❌ | ✅ Review & Approve |
| Team Sync | ❌ | Partial | ✅ Real-time |

---

## Roadmap

### Phase 1: Core Platform ✓
- Brief creation with AI task generation
- Generative UI Views (PM, Dev, Designer)
- Desktop work tracking
- Submission Review Flow

### Phase 2: Deep Integrations
- GitHub PRs auto-detected
- Figma exports tracked
- Slack discussions summarized
- Jira sync

### Phase 3: AI Sprint Master
- AI suggests next tasks
- Bottleneck detection
- Automatic re-prioritization
- Team analytics
