// ─── Outbound: App → Slack ────────────────────────────────────────────────────
// Receives event + data from the frontend, formats a Block Kit message, and
// POSTs it to the Slack Incoming Webhook URL stored server-side.
//
// Env vars required (set in Vercel dashboard, NOT VITE_ prefixed):
//   SLACK_WEBHOOK_URL   — Slack Incoming Webhook URL
//   APP_URL             — Your deployed app URL (for "Open App" buttons)

import { getRawBody, fmtDate, capitalize, viewAppButton, actionsBlock } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  // If webhook isn't configured yet, silently succeed so the app never errors
  if (!webhookUrl) return res.status(200).json({ ok: true, skipped: 'no webhook configured' });

  // Parse body (Vercel may or may not auto-parse JSON, so handle both)
  let body = req.body;
  if (!body) {
    const raw = await getRawBody(req);
    try { body = JSON.parse(raw); } catch { body = {}; }
  }

  const { event, data } = body;
  const appUrl = process.env.APP_URL || 'https://your-app.vercel.app';

  const message = buildMessage(event, data, appUrl);
  if (!message) return res.status(200).json({ ok: true, skipped: 'unknown event' });

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return res.status(200).json({ ok: resp.ok });
  } catch (err) {
    // Log but return 200 — a Slack failure should never 5xx the frontend
    console.error('[slack-notify] fetch error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}

// ─── Block Kit message builders ───────────────────────────────────────────────

function buildMessage(event, data, appUrl) {
  const openBtn = viewAppButton(appUrl);

  switch (event) {

    case 'task_created': {
      const { task, assigneeName } = data;
      const due = task.due_date ? `Due ${fmtDate(task.due_date)}` : 'No due date';
      const assigneeText = assigneeName ? ` → *${assigneeName}*` : ' _(unassigned)_';
      return {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📋 *New task created*\n*${task.title}*${assigneeText}\n${capitalize(task.priority)} priority · ${due}`,
            },
          },
          actionsBlock(
            openBtn,
            task.id ? markDoneButton(task.id) : null,
          ),
        ].map(filterNullElements),
      };
    }

    case 'task_done': {
      const { task, actorName } = data;
      const byText = actorName ? ` · marked done by *${actorName}*` : '';
      return {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Task complete!*\n*${task.title}*${byText}`,
            },
          },
          actionsBlock(openBtn),
        ],
      };
    }

    case 'task_overdue': {
      const { tasks } = data;
      if (!tasks?.length) return null;
      const lines = tasks.slice(0, 5).map(t => {
        const assignee = t.assigneeName ? ` _(${t.assigneeName})_` : '';
        return `• *${t.title}* — was due ${fmtDate(t.due_date)}${assignee}`;
      }).join('\n');
      const extra = tasks.length > 5 ? `\n_…and ${tasks.length - 5} more_` : '';
      return {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `⚠️ *${tasks.length} overdue task${tasks.length !== 1 ? 's' : ''}*\n${lines}${extra}`,
            },
          },
          actionsBlock(openBtn),
        ],
      };
    }

    case 'design_listed': {
      const { design } = data;
      const platforms = Array.isArray(design.platforms) && design.platforms.length
        ? design.platforms.join(', ')
        : 'a platform';
      return {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🎨 *Design now live!*\n*${design.name}* is listed on ${platforms}`,
            },
          },
          actionsBlock(openBtn),
        ],
      };
    }

    case 'decision_created': {
      const { decision } = data;
      const result = decision.result && decision.result !== 'pending'
        ? ` — Result: *${capitalize(decision.result)}*`
        : '';
      const votes = (decision.votes_for != null && decision.votes_against != null)
        ? ` _(${decision.votes_for}–${decision.votes_against})_`
        : '';
      return {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🗳 *Decision recorded*\n*${decision.title}*${result}${votes}`,
            },
          },
          actionsBlock(openBtn),
        ],
      };
    }

    case 'project_status_changed': {
      const { project, newStatus, actorName } = data;
      const emoji = { planning: '📐', active: '🚀', 'on-hold': '⏸', complete: '🏁' }[newStatus] || '📁';
      const byText = actorName ? ` · by *${actorName}*` : '';
      return {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${emoji} *Project status updated*\n*${project.name}* → ${capitalize(newStatus)}${byText}`,
            },
          },
          actionsBlock(openBtn),
        ],
      };
    }

    default:
      return null;
  }
}

function markDoneButton(taskId) {
  return {
    type: 'button',
    text: { type: 'plain_text', text: '✅ Mark Done' },
    style: 'primary',
    action_id: 'mark_task_done',
    value: String(taskId),
  };
}

// Strip null elements from an actions block's elements array
function filterNullElements(block) {
  if (block?.type === 'actions') {
    return { ...block, elements: block.elements.filter(Boolean) };
  }
  return block;
}
