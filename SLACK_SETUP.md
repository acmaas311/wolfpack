# Slack Integration Setup Guide

This guide walks you through connecting Wolfpack Command Center to Slack.
The integration has two directions:

- **Outbound** — the app sends notifications to Slack when key things happen
- **Inbound** — your team can take actions and query the board from inside Slack

---

## What you'll get

| Slack Event | Trigger |
|---|---|
| 📋 New task created | A task is added to the board |
| ✅ Task marked done | A task's status changes to Done |
| 🎨 Design listed | A design's status changes to Listed |
| 🗳️ Decision recorded | A new decision is logged |
| `/wolfpack status` | See a live board summary |
| `/wolfpack task [title] @[name] [priority]` | Create a task from Slack |
| `/wolfpack done [keyword]` | Mark a task done by searching its title |
| `/wolfpack decide "[title]"` | Log a pending decision |
| `/wolfpack help` | Show all commands |

"Mark Done" buttons appear directly on task notifications so anyone can close a task without opening the app.

---

## Step 1 — Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**
3. Name it **Wolfpack Command Center** and pick your workspace
4. Click **Create App**

---

## Step 2 — Enable Incoming Webhooks (outbound notifications)

1. In the left sidebar, click **Incoming Webhooks**
2. Toggle **Activate Incoming Webhooks** to **On**
3. Scroll down and click **Add New Webhook to Workspace**
4. Pick the channel where notifications should appear (e.g. `#wolfpack-alerts`)
5. Click **Allow**
6. Copy the **Webhook URL** — it looks like:
   ```
   https://hooks.slack.com/services/T.../B.../xxxxx
   ```
7. Save this as `SLACK_WEBHOOK_URL` in Vercel (see Step 5)

---

## Step 3 — Add a Slash Command (inbound `/wolfpack`)

1. In the left sidebar, click **Slash Commands**
2. Click **Create New Command**
3. Fill in:
   - **Command:** `/wolfpack`
   - **Request URL:** `https://your-app.vercel.app/api/slack-commands`
     *(replace with your actual Vercel URL)*
   - **Short Description:** `Manage Wolfpack tasks from Slack`
   - **Usage Hint:** `status | task [title] | done [keyword] | decide "[title]" | help`
4. Click **Save**

---

## Step 4 — Enable Interactive Components (for "Mark Done" buttons)

1. In the left sidebar, click **Interactivity & Shortcuts**
2. Toggle **Interactivity** to **On**
3. Set the **Request URL** to:
   ```
   https://your-app.vercel.app/api/slack-interactive
   ```
4. Click **Save Changes**

---

## Step 5 — Add Environment Variables to Vercel

Go to your Vercel project → **Settings** → **Environment Variables** and add:

| Variable | Where to find it |
|---|---|
| `SLACK_WEBHOOK_URL` | Slack App → Incoming Webhooks (Step 2) |
| `SLACK_SIGNING_SECRET` | Slack App → Basic Information → App Credentials |
| `SUPABASE_URL` | Same value as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
| `APP_URL` | Your Vercel deployment URL (e.g. `https://wolfpack.vercel.app`) |

> ⚠️ **Important:** These variables do NOT get the `VITE_` prefix. They are server-side only and are never exposed to the browser.

After adding variables, trigger a **Redeploy** in Vercel so the new env vars take effect.

---

## Step 6 — Install the App to your Workspace

1. In the left sidebar, click **Install App**
2. Click **Install to Workspace** and click **Allow**

---

## Step 7 — Test it

**Test outbound notifications:**
- Create a task in the app → a message should appear in your Slack channel
- Move a task to "Done" → you should see a completion notification
- Click the **✅ Mark Done** button on a task notification → the message updates and the task is marked done in the app

**Test slash commands:**
In any Slack channel, try:
```
/wolfpack help
/wolfpack status
/wolfpack task Design new product page @Alex high
/wolfpack done product page
```

---

## Troubleshooting

**Notifications not appearing in Slack**
- Check that `SLACK_WEBHOOK_URL` is set in Vercel and the deployment was redeployed after adding it
- Confirm the webhook is still active: Slack App → Incoming Webhooks

**Slash commands return "dispatch_failed"**
- Make sure the Request URL in your Slash Command points to your live Vercel URL (not localhost)
- Check Vercel function logs: Vercel dashboard → your project → Functions tab

**"Invalid Slack signature" errors**
- Verify `SLACK_SIGNING_SECRET` matches the value in Slack App → Basic Information → App Credentials
- Ensure your server clock is accurate (Slack rejects requests older than 5 minutes)

**Slash command can't find a team member by @mention**
- The `/wolfpack task` command matches the `@name` against the `name` column in your `team_members` table (case-insensitive)
- Make sure the name in Slack matches what's in the app (e.g. `@Alex` matches `Alex`)

---

## Architecture overview

```
App (browser)
  └─ notifySlack('event', data)
       └─ POST /api/slack-notify        ← server holds SLACK_WEBHOOK_URL
            └─ POST Slack Webhook URL   ← rich Block Kit message with buttons

Slack user clicks "✅ Mark Done"
  └─ POST /api/slack-interactive        ← verifies HMAC signature
       └─ UPDATE tasks SET status='done' WHERE id=...  ← Supabase
            └─ Supabase realtime fires  ← app updates instantly

Slack user runs /wolfpack [command]
  └─ POST /api/slack-commands           ← verifies HMAC signature
       └─ reads/writes Supabase         ← returns ephemeral or in_channel response
            └─ Supabase realtime fires  ← app updates instantly
```
