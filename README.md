# Wolfpack Command Center

Project management app for the Wolfpack merch business. Built with React + Supabase.

---

## Features

- **Task Board** — Kanban with drag-and-drop, inline editing, assignee/due-date popovers, table view, and timeline view
- **Projects** — Full project tracking with status board, table view, click-through detail pages, task linkage, progress slider, and budget/client/lead fields
- **Designs** — Kanban pipeline (Concept → Review → Approved → Listed) with image uploads
- **Sales** — Revenue dashboard (connects to Etsy/eBay APIs)
- **Decisions** — Editable decision log with vote types
- **Google Sign-In** — Restricted to registered team members only; unrecognized Google accounts are blocked at the auth gate
- **Real-time Sync** — Changes appear instantly for all team members via Supabase Realtime
- **Multiple-Instance Protection** — Opening the app in more than one browser tab shows a blocking warning and prevents conflicting writes
- **Gmail Integration** — mailto: shortcuts to notify task assignees and send weekly board summaries (no OAuth required)
- **Google Drive Integration** — Paste any Drive URL on tasks or projects to link documents directly in context
- **Canva Integration** — Paste a Canva design URL on any design card to open it directly from the pipeline
- **Slack Integration** — Rich outbound notifications (task created, task done, design listed, decision logged) plus inbound slash commands (`/wolfpack task`, `/wolfpack done`, `/wolfpack status`, `/wolfpack decide`) and interactive "Mark Done" buttons directly in Slack messages

---

## Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**, name it `wolfpack`, choose a region close to you
3. Save your **Project URL** and **anon public key** (Settings → API)

---

### 2. Set Up the Database

You need to run **two migration files** in order. Go to your Supabase dashboard → **SQL Editor** for each one.

**Migration 1 — Core schema:**
1. Open `supabase/migrations/001_initial_schema.sql`
2. Paste the full contents into the SQL Editor and click **Run**
3. This creates all core tables (tasks, designs, decisions, team_members, etc.), indexes, RLS policies, and seeds initial team data

**Migration 2 — Projects, Drive, and Canva:**
1. Open `supabase/migrations/002_projects_integrations.sql`
2. Paste the full contents into the SQL Editor and click **Run**
3. This adds the `projects` table, links tasks to projects via `project_id`, and adds Drive/Canva URL columns to tasks and designs

> **Important:** Run migration 1 before migration 2. If you skip migration 2, the Projects tab and Drive/Canva link fields will silently fail to save.

---

### 3. Set Up Storage (for design images)

1. In Supabase dashboard, go to **Storage**
2. Click **New Bucket**, name it `design-images`
3. Check **Public bucket**
4. Under bucket settings, set file size limit to **5 MB**
5. Set allowed MIME types to `image/*`

---

### 4. Enable Google OAuth

1. In Supabase, go to **Authentication → Providers → Google** and toggle it **ON**
2. In [Google Cloud Console](https://console.cloud.google.com):
   - Create or select a project
   - Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret**
3. Paste them into Supabase's Google provider settings and save

---

### 5. Register Team Email Addresses

Each team member must have their Google email address in the `team_members` table. Run this in the Supabase SQL Editor, replacing the placeholder addresses with real ones:

```sql
UPDATE public.team_members SET email = 'will@gmail.com'   WHERE initials = 'WE';
UPDATE public.team_members SET email = 'andrew@gmail.com' WHERE initials = 'AM';
UPDATE public.team_members SET email = 'sam@gmail.com'    WHERE initials = 'SM';
UPDATE public.team_members SET email = 'garret@gmail.com' WHERE initials = 'GS';
```

On first sign-in, the app matches the Google account's email to a team member row and links them automatically. If someone signs in with an unregistered email, they see a "not a team member" screen instead of reaching the app.

---

### 6. Install and Run Locally

```bash
cd wolfpack-app

# Install dependencies
npm install

# Copy the environment template
cp .env.example .env

# Edit .env and fill in your Supabase credentials:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# Start the dev server
npm run dev
```

Open http://localhost:5173 and sign in with Google.

---

## Deploy to Vercel (Free)

1. Push this code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click **Import Project** and select the repo
4. Add environment variables in Vercel (Settings → Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SLACK_WEBHOOK_URL` *(optional — see Slack Integration below)*
   - `SLACK_SIGNING_SECRET` *(optional)*
   - `SUPABASE_SERVICE_ROLE_KEY` *(optional — required for Slack slash commands)*
   - `SUPABASE_URL` *(optional — same value as VITE_SUPABASE_URL)*
   - `APP_URL` *(optional — your Vercel URL, used in Slack message links)*
5. Click **Deploy**

After deployment, update your OAuth config in both places:
- **Google Cloud Console**: add `https://your-app.vercel.app` as an authorized JavaScript origin
- **Supabase → Authentication → URL Configuration → Site URL**: set to your Vercel URL

---

## Integrations

### Gmail (Built-in — no setup required)

The app generates pre-filled mailto: links using your device's default mail app. No OAuth or API keys needed.

**Task assignment notification**
When editing a task, if the assigned team member has an email address on file, a **📧 Send notification** button appears. Clicking it opens a pre-filled email to that person with the task title, status, due date, and priority.

**Weekly board summary**
On the Tasks tab, clicking **Weekly Summary** opens a pre-filled email to you with all current tasks grouped by status, overdue items highlighted, and unassigned items called out.

---

### Google Drive (Built-in — no setup required)

No API keys or OAuth scopes needed. Drive integration works by pasting a shared link.

**On tasks:** Open a task → scroll to the Google Drive section → paste a Drive URL and an optional label. The link appears in the task detail as a clickable badge.

**On projects:** Same experience in the Project modal → Google Drive File section.

Any Drive link works: Docs, Sheets, Slides, folders, PDFs, etc. Make sure the Drive file's sharing is set to at least "Anyone with the link can view."

---

### Canva (Built-in — no setup required)

No API keys needed. Works by pasting a Canva share link.

**On designs:** Open a design card → scroll to the Canva section in the create or edit modal → paste a Canva URL and optional label. A purple **Canva ↗** badge then appears on the design card for direct access.

To get the link from Canva: open your design → **Share → Copy link** (set to "Anyone with the link can view").

---

### Slack Integration

Full two-way Slack integration via Vercel serverless API routes. Secrets are kept server-side and are never exposed in the browser bundle.

**Outbound notifications (App → Slack)**

| Event | Trigger |
|---|---|
| 📋 New task created | A task is added in TaskBoard or Timeline view |
| ✅ Task marked done | A task's status is changed to Done |
| 🎨 Design listed | A design's status is changed to Listed |
| 🗳️ Decision recorded | A new decision is logged |

Task creation messages include a **✅ Mark Done** button — click it in Slack and the task is marked done in the app instantly (no need to open the browser).

**Inbound slash commands (Slack → App)**

| Command | What it does |
|---|---|
| `/wolfpack status` | Shows a live board summary (tasks by status + overdue count) |
| `/wolfpack task [title] @[name] [priority]` | Creates a task and assigns it to a team member |
| `/wolfpack done [keyword]` | Fuzzy-searches active tasks and marks the match done |
| `/wolfpack decide "[title]"` | Logs a pending decision |
| `/wolfpack help` | Shows all available commands |

**Setup:** See [SLACK_SETUP.md](./SLACK_SETUP.md) for the full step-by-step guide to creating the Slack App, configuring webhooks, slash commands, interactive components, and adding the required Vercel environment variables.

---

### Etsy API (Sales Data)

The sales dashboard has a placeholder ready for live Etsy data:

1. Go to [etsy.com/developers](https://www.etsy.com/developers/) and create an app to get an API key
2. Add `VITE_ETSY_API_KEY` to your `.env`

Note: Etsy's API requires OAuth for shop-level data and doesn't support browser-only calls. A small backend proxy (Supabase Edge Function works well) is needed for the full integration.

---

## Multiple Instances

The app detects when it is open in more than one browser tab at the same time. All instances show a blocking "Multiple Instances Open" screen until you close the extras. This prevents conflicting optimistic state updates from causing data to appear stale or duplicated.

---

## Project Structure

```
wolfpack-app/
├── api/                            # Vercel serverless API routes (server-side only)
│   ├── _lib.js                     # Shared utilities (HMAC verification, body parsing)
│   ├── slack-notify.js             # Outbound: receives app events, POSTs to Slack
│   ├── slack-commands.js           # Inbound: handles /wolfpack slash commands
│   └── slack-interactive.js        # Inbound: handles Slack button click payloads
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── auth/                   # Login page
│   │   ├── decisions/              # DecisionsView, DecisionModal
│   │   ├── designs/                # DesignPipeline, DesignDetailModal (Canva integration)
│   │   ├── projects/               # ProjectsView, ProjectBoard, ProjectTableView,
│   │   │                           # ProjectDetail, ProjectModal (Drive integration)
│   │   ├── sales/                  # SalesDashboard
│   │   ├── shared/                 # Avatar, Card, Toggle, Popover, Overlay, formStyles
│   │   └── tasks/                  # TaskBoard, TaskEditModal (Drive + Gmail), TimelineView
│   ├── hooks/
│   │   ├── useAuth.jsx             # Google OAuth via Supabase, team member linking
│   │   ├── useData.js              # Real-time data hooks + Slack notification triggers
│   │   ├── useProjects.js          # Real-time projects hook
│   │   └── useTabGuard.js          # Multiple-instance detection via localStorage heartbeat
│   ├── lib/
│   │   ├── gmail.js                # mailto: helpers (task notification, weekly summary)
│   │   ├── slack.js                # Fire-and-forget frontend helper → /api/slack-notify
│   │   └── supabase.js             # Supabase client, storage helpers, activity logger
│   ├── styles/
│   │   └── globals.css             # Tailwind + custom styles
│   ├── App.jsx                     # Auth gate, multiple-instance guard, tab routing
│   └── main.jsx                    # Entry point
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql          # Core tables, RLS, seed data
│       └── 002_projects_integrations.sql   # Projects table, Drive/Canva columns
├── .env.example
├── SLACK_SETUP.md                  # Step-by-step Slack App configuration guide
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Frontend | React + Vite | Fast, modern, component-based |
| Styling | Tailwind CSS | Utility-first, matches prototype |
| Database | Supabase (Postgres) | Free tier, real-time, RLS auth built-in |
| Auth | Supabase + Google OAuth | Each partner uses their Google account |
| Storage | Supabase Storage | Design image uploads |
| Hosting | Vercel | Free, auto-deploy from GitHub, serverless API routes |
| Slack (outbound) | Incoming Webhooks + Block Kit | Rich notifications with interactive buttons |
| Slack (inbound) | Slash Commands + Interactive Components | Create/update tasks directly from Slack |
| Email | mailto: links | Zero-config task/summary emails via Gmail |
| Files | Paste-URL | Drive and Canva links — no API keys needed |

---

## What's Next

- [ ] Etsy API integration for live sales data
- [ ] Content calendar for social media posts
- [ ] Customer list / simple CRM
- [ ] Weekly auto-generated meeting agendas
- [ ] Mobile-optimized views
- [ ] SKU inventory tracker
