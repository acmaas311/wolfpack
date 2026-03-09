// ─── Gmail integration helpers (mailto: based) ───
// No OAuth needed — opens the user's local Gmail/mail client via mailto: links.

const APP_NAME = 'Wolfpack Command Center';

function fmtDate(d) {
  if (!d) return 'No due date';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusLabel(s) {
  const map = { 'todo': 'To Do', 'in-progress': 'In Progress', 'review': 'Review', 'done': 'Done' };
  return map[s] || capitalize(s);
}

// ── Task Assignment Notification ─────────────────────────────────────────────
// Opens a mailto: link to notify an assignee about a task.
// task: { title, description, status, priority, due_date }
// assignee: { name, email }
// senderName: current user's name (optional)
export function openTaskAssignmentEmail({ task, assignee, senderName }) {
  if (!assignee?.email) return;

  const subject = encodeURIComponent(
    `[${APP_NAME}] You've been assigned: ${task.title}`
  );

  const body = encodeURIComponent(
    `Hi ${assignee.name},\n\n` +
    `You've been assigned a task on the Wolfpack Command Center:\n\n` +
    `Task: ${task.title}\n` +
    `Status: ${statusLabel(task.status)}\n` +
    `Priority: ${capitalize(task.priority)}\n` +
    `Due: ${fmtDate(task.due_date)}\n` +
    (task.description ? `\nDetails:\n${task.description}\n` : '') +
    `\nPlease log in to the Wolfpack Command Center to view and update this task.\n\n` +
    `—${senderName ? ` ${senderName} via` : ''} ${APP_NAME}`
  );

  window.open(`mailto:${assignee.email}?subject=${subject}&body=${body}`, '_blank');
}

// ── Weekly Board Summary ──────────────────────────────────────────────────────
// Builds and opens a mailto: with a summary of all current tasks.
// tasks: array of task objects
// team: array of team member objects { id, name, email }
// recipientEmail: optional — if not set, opens blank To: field
export function openWeeklySummaryEmail({ tasks, team, recipientEmail = '' }) {
  const now = new Date();
  const weekStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const COLUMNS = [
    { id: 'todo', label: 'To Do' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'review', label: 'Review' },
    { id: 'done', label: 'Done' },
  ];

  // Group tasks by status
  const grouped = {};
  COLUMNS.forEach(c => { grouped[c.id] = tasks.filter(t => t.status === c.id); });

  // Counts
  const total = tasks.length;
  const doneCount = grouped['done'].length;
  const inProgressCount = grouped['in-progress'].length;
  const reviewCount = grouped['review'].length;
  const todoCount = grouped['todo'].length;

  // Overdue tasks
  const today = now.toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done');

  let lines = [
    `${APP_NAME} — Weekly Board Summary`,
    `Week of ${weekStr}`,
    ``,
    `────────────────────────`,
    `OVERVIEW`,
    `────────────────────────`,
    `Total tasks:    ${total}`,
    `  ✅ Done:       ${doneCount}`,
    `  🔄 In Progress: ${inProgressCount}`,
    `  👀 Review:     ${reviewCount}`,
    `  📋 To Do:      ${todoCount}`,
  ];

  if (overdue.length > 0) {
    lines.push(``);
    lines.push(`⚠ OVERDUE (${overdue.length})`);
    overdue.forEach(t => {
      const mem = team.find(m => m.id === t.assignee_id);
      lines.push(`  • ${t.title} — Due ${fmtDate(t.due_date)}${mem ? ` (${mem.name})` : ''}`);
    });
  }

  // In Progress section
  if (grouped['in-progress'].length > 0) {
    lines.push(``);
    lines.push(`────────────────────────`);
    lines.push(`IN PROGRESS (${grouped['in-progress'].length})`);
    lines.push(`────────────────────────`);
    grouped['in-progress'].forEach(t => {
      const mem = team.find(m => m.id === t.assignee_id);
      lines.push(`  • [${capitalize(t.priority)}] ${t.title}${mem ? ` — ${mem.name}` : ''}${t.due_date ? ` (due ${fmtDate(t.due_date)})` : ''}`);
    });
  }

  // Review section
  if (grouped['review'].length > 0) {
    lines.push(``);
    lines.push(`────────────────────────`);
    lines.push(`NEEDS REVIEW (${grouped['review'].length})`);
    lines.push(`────────────────────────`);
    grouped['review'].forEach(t => {
      const mem = team.find(m => m.id === t.assignee_id);
      lines.push(`  • ${t.title}${mem ? ` — ${mem.name}` : ''}`);
    });
  }

  // To Do section
  if (grouped['todo'].length > 0) {
    lines.push(``);
    lines.push(`────────────────────────`);
    lines.push(`UPCOMING / TO DO (${grouped['todo'].length})`);
    lines.push(`────────────────────────`);
    grouped['todo'].forEach(t => {
      const mem = team.find(m => m.id === t.assignee_id);
      lines.push(`  • [${capitalize(t.priority)}] ${t.title}${mem ? ` — ${mem.name}` : ''}${t.due_date ? ` (due ${fmtDate(t.due_date)})` : ''}`);
    });
  }

  // Done this week (show all Done tasks for awareness)
  if (grouped['done'].length > 0) {
    lines.push(``);
    lines.push(`────────────────────────`);
    lines.push(`COMPLETED (${grouped['done'].length})`);
    lines.push(`────────────────────────`);
    grouped['done'].forEach(t => {
      const mem = team.find(m => m.id === t.assignee_id);
      lines.push(`  ✓ ${t.title}${mem ? ` — ${mem.name}` : ''}`);
    });
  }

  lines.push(``);
  lines.push(`— ${APP_NAME}`);

  const subject = encodeURIComponent(`[${APP_NAME}] Weekly Board Summary — ${weekStr}`);
  const body = encodeURIComponent(lines.join('\n'));
  const to = recipientEmail ? encodeURIComponent(recipientEmail) : '';

  window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank');
}
