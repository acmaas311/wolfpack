// ─── Slack notification helper ───────────────────────────────────────────────
// Sends app events to the /api/slack-notify serverless endpoint, which holds
// the real webhook URL server-side (never exposed in the client bundle).
//
// Fire-and-forget — a Slack failure never blocks or throws in the UI.

export async function notifySlack(event, data) {
  try {
    await fetch('/api/slack-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data }),
    });
  } catch {
    // Non-critical — swallow all errors silently
  }
}
