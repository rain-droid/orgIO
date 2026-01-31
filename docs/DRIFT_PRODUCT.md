# DRIFT - Product & Pitch

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

## Demo Script (3 Min)

**0:00 - Problem**
> "Teams fragen AI separat, tracken manuell, vergessen Updates."

**0:30 - Brief erstellen**
> "Sarah erstellt Brief: Apple Pay Checkout"

**1:00 - Generative UI**
> "Jetzt der Magic Moment - gleicher Brief, andere Rolle..."
> *Wechsel zu Dev View*
> "Komplett andere Visualisierung. AI wählt die Components."

**1:30 - Desktop Recording**
> "Max arbeitet. Desktop App läuft im Background."
> *Zeige Tray Icon, Recording Status*

**2:00 - Session Summary**
> "Session beenden. AI generiert Summary."
> *Zeige Summary, Edit-Möglichkeit*
> "Add to Workspace - wie ein PR für Arbeit."

**2:30 - Team Review**
> "Sarah sieht die Submission, approved..."
> *Zeige Checklists updaten*
> "Progress updated automatisch."

**2:50 - Close**
> "Von Brief bis Done. Ohne Meetings. Ohne manuelles Tracking."

---

## Pitch (30 Sekunden)

> "Teams fragen AI 4x separat, tracken Progress manuell, vergessen Jira Updates.
> 
> Drift: Ein Brief, jeder sieht seine personalisierte View - PM sieht Kanban, Dev sieht Code, Designer sieht Specs.
> 
> Desktop App recorded im Background was ihr macht.
> Session beenden, AI generiert Summary, submit wie ein PR.
> Team approved, Checklists updaten automatisch.
> 
> Von Brief bis Done - ohne Meetings, ohne manuelles Tracking."


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

## Judge Q&A Prep

**"Was ist der Unterschied zu ChatGPT?"**
> "ChatGPT gibt Text. Drift gibt jedem seine personalisierte visuelle Darstellung - PM sieht Kanban, Dev sieht Architecture Diagrams. Plus: automatisches Work Tracking durch Desktop Recording."

**"Wie funktioniert das Recording?"**
> "Desktop App läuft im Background, macht Screenshots, OCR erkennt Text, AI summarized. User kontrolliert was geteilt wird - wie ein PR, nicht automatisch."

**"Privacy Concerns?"**
> "Alles lokal verarbeitet. User sieht Summary, kann editieren, entscheidet was submitted wird. Nichts geht raus ohne Approval."

**"Warum nicht einfach Jira + ChatGPT?"**
> "Weil niemand Jira updated. Drift macht es automatisch durch die Submissions. Und ChatGPT gibt jedem die gleiche Antwort - Drift personalisiert."

**"Wie skaliert das?"**
> "Clerk Organizations für Teams. Supabase für Data. Generative UI skaliert weil AI die Components wählt, nicht wir sie hardcoden."

**"Was ist die Generative UI?"**
> "Vercel AI SDK. AI entscheidet welche React Components gerendert werden basierend auf Rolle. Nicht vorgefertigte Templates - AI generiert die View."

---

## Hackathon Scope

**Must Have (Demo):**
- [ ] Brief erstellen
- [ ] Generative UI Views (PM, Dev, Designer)
- [ ] Submission Review Flow
- [ ] Progress Updates

**Nice to Have:**
- [ ] Desktop Recording (kann simuliert werden)
- [ ] Real-time WebSocket Updates

**Post-Hackathon:**
- [ ] Full Desktop App
- [ ] Integrations (Slack, GitHub)
- [ ] Analytics Dashboard

---

## Future Vision

```
Phase 1: Sprint Planning (Hackathon)
→ Briefs, Generative UI, Submissions

Phase 2: Deep Integrations
→ GitHub PRs auto-detected
→ Figma exports tracked
→ Slack discussions summarized

Phase 3: AI Sprint Master
→ AI schlägt nächste Tasks vor
→ Bottleneck Detection
→ Automatic Re-prioritization
```
