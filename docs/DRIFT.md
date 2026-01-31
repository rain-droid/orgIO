# DRIFT

**AI-powered Sprint Planning wo jeder seine personalisierte Sicht bekommt + automatisches Work Tracking.**

---

## Das Produkt

### Web App
- Sprint Planning & Management
- Briefs mit Generative UI - jede Rolle sieht andere Visualisierung
- Team Overview & Progress
- "PRs" von Desktop App reviewen

### Desktop App
- Background Recording (Browser, Cursor, Figma, etc.)
- Session Summary mit AI
- "Add to Workspace" - wie ein PR für Arbeit

---

## Full Flow

```
1. BRIEF ERSTELLEN (Web App)
   PM erstellt: "Apple Pay Checkout"
   
2. PERSONALISIERTE VIEWS (Web App)
   → PM sieht: Kanban, User Stories, Timeline
   → Dev sieht: Architecture Diagram, API Specs, Code
   → Designer sieht: User Flow, Component Specs, States
   
   Gleicher Brief, komplett andere Visualisierung.

3. ARBEITEN (Desktop App - Background)
   Recording läuft automatisch
   → Tracked: Browser, Cursor, Figma, etc.
   → Erkennt was du machst

4. SESSION BEENDEN (Desktop App)
   AI generiert Summary:
   "Du hast Stripe Webhook implementiert,
    Error Handling gefixt, Tests geschrieben"
   
   User kann editieren/refinen
   → "Add to Workspace"

5. PR REVIEW (Web App)
   Team sieht: "Max submitted work"
   → Matches zu Tasks
   → Approve → Checklists updaten
   → Sprint Progress updated

6. REPEAT
   Nächste Session, nächster PR
```

---

## Warum das krass ist

| Heute | Mit Drift |
|-------|-----------|
| Jeder fragt AI separat | Eine Quelle, personalisierte Views |
| Manuelles Task-Tracking | Automatisch durch Recording |
| Standup Meetings | PRs zeigen was gemacht wurde |
| Jira Updates vergessen | Auto-Updates durch Submissions |

---

## Tech Stack

```
Web App:    React + Vite + Clerk + Supabase + Vercel AI SDK
Desktop:    Tauri + Screen Capture + OCR + Gemini
Sync:       WebSocket
```

---

## Hackathon Scope

**Fokus:** Web App mit Generative UI Views
**Demo:** Desktop Recording Flow (kann simuliert werden)
