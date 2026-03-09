// ─── Inbound: Slack → App (Slash Commands) ───────────────────────────────────
// Receives /wolfpack slash commands from Slack, validates the request signature,
// and writes directly to Supabase. The app's existing realtime subscriptions
// pick up the DB change and update the UI automatically — no polling needed.
//
// Supported commands:
//   /wolfpack task [title] @[name] [priority]  — create a task
//   /wolfpack done [search term]               — mark a task done
//   /wolfpack decide "[proposal title]"        — create a decision proposal
//   /wolfpack status                           — board summary
//   /wolfpack help                             — show all commands
//
// Env vars required (Vercel dashboard):
//   SLACK_SIGNING_SECRET      — from Slack App → Basic Information
//   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS for server-side writes
//   SUPABASE_URL              — same value as VITE_SUPABASE_URL
//   APP_URL                   — your deployed app URL

import { createClient } from '@supabase/supabase-js';
import { getRawBody, parseForm, verifySlackSignature, fmtDate, capitalize } from './_lib.js';

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

  const { command, text = '', user_name = 'someone' } = parseForm(rawBody);
  if (command !== '/wolfpack') {
    return res.status(200).json({ response_type: 'ephemeral', text: 'Unknown command.' });
  }

  // ── Supabase client (service role — bypasses RLS) ────────────────────────
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const args = text.trim().split(/\s+/);
  const sub = (args[0] || '').toLowerCase();

  try {

    // ── /wolfpack status ───────────────────────────────────────────────────
    if (!sub || sub === 'status') {
      const { data: tasks } = await supabase.from('tasks').select('status, due_date');
      const today = new Date().toISOString().split('T')[0];
      const count = (s) => tasks.filter(t => t.status === s).length;
      const overdue = tasks.filter(t =>
        t.due_date && t.due_date < today && t.status !== 'done'
      ).length;

      const lines = [
        '*📊 Wolfpack Board Status*',
        `🔄 In Progress: *${count('in-progress')}*`,
        `👀 In Review:   *${count('review')}*`,
        `📋 To Do:       *${count('todo')}*`,
        `✅ Done:        *${count('done')}*`,
        overdue ? `⚠️ Overdue:     *${overdue}*` : null,
      ].filter(Boolean).join('\n');

      return res.status(200).json({
        response_type: 'ephemeral',
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: lines } }],
      });
    }

    // ── /wolfpack task [title] @[name] [priority] ──────────────────────────
    if (sub === 'task') {
      const rest = args.slice(1).join(' ');

      // Parse optional @mention and priority keyword
      const mentionMatch = rest.match(/@(\w+)/);
      const priorityMatch = rest.match(/\b(urgent|high|normal|medium|low)\b/i);
      const title = rest
        .replace(/@\w+/, '')
        .replace(/\b(urgent|high|normal|medium|low)\b/i, '')
        .trim();

      if (!title) {
        return res.status(200).json({
          response_type: 'ephemeral',
          text: [
            'Usage: `/wolfpack task [title] @[person] [priority]`',
            'Example: `/wolfpack task Fix the banner @jamie high`',
          ].join('\n'),
        });
      }

      // Resolve @mention to a team member
      let assigneeId = null;
      let assigneeName = null;
      if (mentionMatch) {
        const search = mentionMatch[1].toLowerCase();
        const { data: members } = await supabase.from('team_members').select('id, name');
        const match = members?.find(m => m.name.toLowerCase().includes(search));
        if (match) {
          assigneeId = match.id;
          assigneeName = match.name;
        }
      }

      const priority = priorityMatch
        ? priorityMatch[1].toLowerCase().replace('medium', 'normal')
        : 'normal';

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title,
          description: '',
          status: 'todo',
          priority,
          category: 'operations',
          assignee_id: assigneeId,
          due_date: null,
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;

      const assigneeText = assigneeName ? ` → *${assigneeName}*` : ' _(unassigned)_';
      return res.status(200).json({
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: [
                `📋 *Task created by ${user_name}*`,
                `*${task.title}*${assigneeText}`,
                `Priority: ${capitalize(priority)}`,
              ].join('\n'),
            },
          },
        ],
      });
    }

    // ── /wolfpack done [search] ────────────────────────────────────────────
    if (sub === 'done') {
      const search = args.slice(1).join(' ').trim();
      if (!search) {
        return res.status(200).json({
          response_type: 'ephemeral',
          text: 'Usage: `/wolfpack done [task title or keyword]`',
        });
      }

      const { data: matches } = await supabase
        .from('tasks')
        .select('*')
        .neq('status', 'done')
        .ilike('title', `%${search}%`);

      if (!matches?.length) {
        return res.status(200).json({
          response_type: 'ephemeral',
          text: `No active tasks found matching *"${search}"*.`,
        });
      }

      if (matches.length > 1) {
        const list = matches.slice(0, 5)
          .map((t, i) => `${i + 1}. ${t.title}`)
          .join('\n');
        const extra = matches.length > 5 ? `\n_…and ${matches.length - 5} more_` : '';
        return res.status(200).json({
          response_type: 'ephemeral',
          text: `Found ${matches.length} matching tasks — be more specific:\n${list}${extra}`,
        });
      }

      const task = matches[0];
      await supabase.from('tasks').update({ status: 'done' }).eq('id', task.id);

      return res.status(200).json({
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Task complete!* _(via ${user_name})_\n*${task.title}*`,
            },
          },
        ],
      });
    }

    // ── /wolfpack decide "[proposal title]" ───────────────────────────────
    if (sub === 'decide') {
      const title = args.slice(1).join(' ').trim().replace(/^["']|["']$/g, '');
      if (!title) {
        return res.status(200).json({
          response_type: 'ephemeral',
          text: 'Usage: `/wolfpack decide "Proposal title"`\nExample: `/wolfpack decide "Switch to Printify for fulfillment"`',
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('decisions').insert({
        title,
        vote_type: 'majority',
        result: 'pending',
        decision_date: today,
        notes: `Created via Slack by ${user_name}`,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      return res.status(200).json({
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: [
                `🗳 *New proposal created by ${user_name}*`,
                `*${title}*`,
                `_Open the app to record votes and finalize the decision._`,
              ].join('\n'),
            },
          },
        ],
      });
    }

    // ── /wolfpack help (or unrecognized subcommand) ───────────────────────
    return res.status(200).json({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              '*🐺 Wolfpack Commands*',
              '',
              '`/wolfpack task [title]` — create a task',
              '`/wolfpack task [title] @[name] [priority]` — create and assign',
              '  _priority options: urgent · high · normal · low_',
              '',
              '`/wolfpack done [keyword]` — mark a task as done',
              '',
              '`/wolfpack decide "Proposal title"` — create a decision proposal',
              '',
              '`/wolfpack status` — view board summary',
            ].join('\n'),
          },
        },
      ],
    });

  } catch (err) {
    console.error('[slack-commands] error:', err);
    return res.status(200).json({
      response_type: 'ephemeral',
      text: `⚠️ Something went wrong: ${err.message}`,
    });
  }
}
