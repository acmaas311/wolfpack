// ─── Inbound: Slack → App (Interactive Components) ───────────────────────────
// Handles button clicks from Slack notification messages.
// When a user clicks "✅ Mark Done" on a Slack notification, this endpoint
// updates the task in Supabase, and the app's realtime subscription reflects
// the change instantly without a page refresh.
//
// Env vars required (Vercel dashboard):
//   SLACK_SIGNING_SECRET      — from Slack App → Basic Information
//   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS for server-side writes
//   SUPABASE_URL              — same value as VITE_SUPABASE_URL

import { createClient } from '@supabase/supabase-js';
import { getRawBody, verifySlackSignature } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);

  // ── Signature verification ───────────────────────────────────────────────
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (signingSecret) {
    const timestamp = req.headers['x-slack-request-timestamp'];
    const signature = req.headers['x-slack-signature'];
    if (!verifySlackSignature(rawBody, timestamp, signature, signingSecret)) {
      return res.status(401).json({ error: 'Invalid Slack signature' });
    }
  }

  // Slack sends interactive payloads as JSON inside a form-encoded "payload" field
  const params = new URLSearchParams(rawBody);
  let payload;
  try {
    payload = JSON.parse(params.get('payload') || '{}');
  } catch {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const action = payload.actions?.[0];
  // No action to handle (e.g. link button clicks don't send payloads)
  if (!action) return res.status(200).send('');

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // ── mark_task_done button ─────────────────────────────────────────────────
  if (action.action_id === 'mark_task_done') {
    const taskId = parseInt(action.value, 10);
    if (isNaN(taskId)) return res.status(200).send('');

    const { data: task, error } = await supabase
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', taskId)
      .select('title')
      .single();

    if (error) {
      console.error('[slack-interactive] mark_task_done error:', error);
      // Replace the message with a neutral error state rather than crashing
      return res.status(200).json({
        replace_original: true,
        text: '⚠️ Could not update task — please mark it done in the app.',
      });
    }

    // Replace the original Slack message to prevent double-clicking
    return res.status(200).json({
      replace_original: true,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *Task complete!* _(marked done via Slack)_\n*${task?.title || 'Task'}*`,
          },
        },
      ],
    });
  }

  // view_app link buttons are handled client-side by Slack — nothing to do here
  return res.status(200).send('');
}
