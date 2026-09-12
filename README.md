# Sahayak Foundation

Build the frontend foundation and application shell for a hackathon project called Sahayak.

Sahayak is an Agentic AI Workforce for Government Scheme Navigation.

Core positioning:

Sahayak helps a citizen move from NEED → ELIGIBILITY → DOCUMENTS → APPLICATION → TRACKING → NEXT ACTION.

This is NOT just a chatbot. It is an orchestration layer where specialized AI agents collaborate while the citizen maintains control over sensitive actions.

The existing government ecosystem includes platforms such as myScheme, UMANG and DigiLocker. Sahayak should be positioned as an AI orchestration layer that works alongside such services, not as a replacement for them.

TECH STACK

Use:

React

TypeScript

Vite

Tailwind CSS

shadcn/ui

Lucide icons

Recharts where useful

Supabase-ready architecture, but do not require real external APIs

Create clean reusable components and a modular folder structure.

Use mock/demo data initially.

BRAND

Product name:

Sahayak

Primary tagline:

"From eligibility to action."

Supporting tagline:

"Your AI workforce for government benefits."

Visual style:

premium civic-tech

trustworthy

modern

clean

professional

accessible

Indian government-service inspired without looking outdated

Use a primarily light interface with:

deep navy/indigo primary

green success states

amber warning states

red critical states

subtle borders

rounded cards

restrained shadows

clean typography

Do not use excessive gradients, glassmorphism or flashy startup aesthetics.

ROUTES

Create these routes now:

PUBLIC:

/
/demo
/login
/signup

CITIZEN:

/dashboard
/assistant
/schemes
/schemes/:id
/documents
/applications
/applications/:id
/profile
/notifications

ADMIN:

/admin
/admin/agents
/admin/schemes
/admin/analytics

GLOBAL NAVIGATION

Desktop sidebar:

Sahayak logo

Dashboard
AI Assistant
My Schemes
Documents
Applications
Notifications
Profile

Divider

Demo Mode
AI Workforce
Admin

Bottom:

Privacy & Consent
Language selector
User profile

Top bar:

Search
Notifications
Language
Demo Mode indicator
Profile/avatar

On mobile collapse the sidebar into a mobile navigation drawer.

LANDING PAGE

Create a highly polished landing page.

Hero:

SAHAYAK

From eligibility to action.

"An agentic AI workforce that helps citizens discover government benefits, verify eligibility, prepare documents, complete applications, and know what to do next."

Primary button:

"Start with your need"

Secondary:

"Run interactive demo"

Add an animated visual showing:

NEED
↓
UNDERSTAND
↓
MATCH
↓
VERIFY
↓
DOCUMENTS
↓
APPLY
↓
TRACK
↓
NEXT ACTION

IMPORTANT LANDING PAGE SECTION

Create:

"Not another chatbot."

Text:

"Finding a government scheme is only the beginning. Sahayak coordinates the journey that follows."

Create three cards:

Discovery isn't enough

AI workforce, not one chatbot

AI autonomy + citizen control

AI WORKFORCE SECTION

Create six agent cards:

Citizen Agent
Scheme Agent
Eligibility Agent
Document Agent
Application Agent
Tracker Agent

Each card should have:

icon

purpose

status

short description

HUMAN CONTROL SECTION

Create:

"AI autonomy. Citizen control."

AI can:

Research
Compare
Verify
Prepare
Monitor

Citizen controls:

Sensitive documents
Data sharing
Final submission
Authorization

DASHBOARD

Create a realistic citizen dashboard.

Demo citizen:

Rahul Sharma
20
Lucknow, Uttar Pradesh
Undergraduate student
Annual household income: ₹2,10,000

Dashboard cards:

Benefits discovered: 3
Applications in progress: 2
Documents verified: 5/6
Actions required: 2

Create a prominent:

"Your next best action"

Example:

"Upload your enrollment certificate to complete scholarship verification."

Button:

Continue

Create:

Active Applications

Recent AI Activity

Notifications

Application progress timeline

REUSABLE COMPONENTS

Create reusable components:

AgentCard
StatusBadge
MetricCard
ProgressStepper
SchemeCard
DocumentCard
ApplicationTimeline
NotificationCard
ConfidenceBadge
ConsentModal
AuditLog

DESIGN QUALITY

Every main page must look complete.

Do not leave blank screens.

Create realistic empty/loading/success/error states where appropriate.

Every navigation item should route correctly.

Every CTA should have meaningful behavior.

The result should already look like a polished hackathon product even before the AI workflow is implemented.

Do not implement complex backend integrations yet.

Focus this stage on:

architecture

routing

design system

navigation

landing page

dashboard

reusable components

responsive layout

seeded mock data

Do not change the core concept or branding.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
