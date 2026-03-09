// ─── Shared utilities for Slack API routes ───────────────────────────────────
// Files prefixed with _ are NOT treated as Vercel serverless functions.

import crypto from 'crypto';

/** Collect the raw request body as a string. */
export function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/** Parse URL-encoded form body (used by Slack slash commands & interactive). */
export function parseForm(raw) {
  return Object.fromEntries(new URLSearchParams(raw));
}

/**
 * Verify that a request genuinely came from Slack using HMAC-SHA256.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(rawBody, timestamp, signature, signingSecret) {
  // Reject requests older than 5 minutes to prevent replay attacks
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');
  const computed = `v0=${hmac}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Format a date string (YYYY-MM-DD) to "Mar 15" */
export function fmtDate(d) {
  if (!d) return 'No date';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

/** Capitalize first letter of a string */
export function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Standard "Open App" button for Block Kit messages */
export function viewAppButton(appUrl) {
  return {
    type: 'button',
    text: { type: 'plain_text', text: '🔗 Open App' },
    url: appUrl,
    action_id: 'view_app',
  };
}

/** Block Kit actions block */
export function actionsBlock(...elements) {
  return { type: 'actions', elements };
}
