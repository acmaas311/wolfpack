// ─── Google Drive Picker + Upload ────────────────────────────────────────────
// Loads the Google Picker API and opens the file chooser UI.
// Also provides uploadToDrive() for uploading a local file to Google Drive.
//
// The user's Google OAuth access token (from useAuth) is passed in — no
// additional sign-in step is needed since we already request the Drive scope
// at login.
//
// Optional: set VITE_GOOGLE_API_KEY in your .env.local for quota tracking.
// The picker works without it, but Google recommends supplying one.

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

let gapiLoaded = false;
let gapiLoadPromise = null;

function loadGapi() {
  if (gapiLoaded) return Promise.resolve();
  if (gapiLoadPromise) return gapiLoadPromise;

  gapiLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gapiLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google API script'));
    document.head.appendChild(script);
  });

  return gapiLoadPromise;
}

/**
 * Open the Google Drive file picker.
 *
 * @param {object} opts
 * @param {string} opts.accessToken  - Google OAuth access token from useAuth()
 * @param {function} opts.onPicked   - Called with { url, name, id, mimeType }
 * @param {function} [opts.onCancel] - Called when user closes the picker
 */
export function openDrivePicker({ accessToken, onPicked, onCancel }) {
  if (!accessToken) {
    console.warn('Drive picker: no access token available');
    return;
  }

  loadGapi()
    .then(() => {
      window.gapi.load('picker', () => {
        const builder = new window.google.picker.PickerBuilder()
          .setOAuthToken(accessToken)
          .addView(window.google.picker.ViewId.DOCS)
          .addView(window.google.picker.ViewId.RECENTLY_PICKED)
          .setCallback((data) => {
            if (data.action === window.google.picker.Action.PICKED) {
              const doc = data.docs[0];
              onPicked({
                url: doc.url,
                name: doc.name,
                id: doc.id,
                mimeType: doc.mimeType,
              });
            } else if (data.action === window.google.picker.Action.CANCEL) {
              onCancel?.();
            }
          });

        if (API_KEY) builder.setDeveloperKey(API_KEY);

        builder.build().setVisible(true);
      });
    })
    .catch((err) => {
      console.error('Drive picker failed to load:', err);
    });
}

/**
 * Upload a local file to Google Drive using the multipart upload API.
 * The file is uploaded to the user's Drive root ("My Drive").
 *
 * @param {object} opts
 * @param {string}   opts.accessToken  - Google OAuth access token from useAuth()
 * @param {File}     opts.file         - File object from an <input type="file">
 * @param {function} [opts.onProgress] - Called with (percentComplete: number)
 * @returns {Promise<{ url, name, id, mimeType }>}
 */
export async function uploadToDrive({ accessToken, file, onProgress }) {
  if (!accessToken) throw new Error('No access token — sign in with Google first');
  if (!file) throw new Error('No file provided');

  // Build multipart/related body: metadata part + file part
  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
  };

  const boundary = 'wolfpack_drive_upload_boundary';
  const metaPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n`;
  const closingBoundary = `\r\n--${boundary}--`;

  // Read file as ArrayBuffer so we can combine into one blob
  const fileBuffer = await file.arrayBuffer();

  const bodyBlob = new Blob([
    metaPart,
    `--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`,
    fileBuffer,
    closingBoundary,
  ], { type: `multipart/related; boundary=${boundary}` });

  // Use XMLHttpRequest so we can report upload progress
  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType',
    );
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        let msg = `Drive upload failed (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText).error?.message || msg; } catch (_) {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(bodyBlob);
  });

  return {
    id: result.id,
    name: result.name,
    url: result.webViewLink,
    mimeType: result.mimeType,
  };
}
