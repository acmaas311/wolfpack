import { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { openDrivePicker, uploadToDrive } from '../../lib/drivePicker';

// ─── DriveFilePicker ──────────────────────────────────────────────────────────
// Two-tab Drive integration:
//   • Browse — opens Google Picker to select an existing Drive file
//   • Upload — lets user pick a local file and upload it to Drive
//
// Props:
//   urlValue      string   - current drive_file_url
//   labelValue    string   - current drive_file_name
//   onUrlChange   fn       - called with new URL string
//   onLabelChange fn       - called with new label string
//   inputCls      string   - Tailwind classes for input styling (matches parent modal)

const DriveIcon = () => (
  <img
    src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"
    alt=""
    style={{ width: 14, height: 14, flexShrink: 0 }}
    onError={e => { e.target.style.display = 'none'; }}
  />
);

export default function DriveFilePicker({ urlValue, labelValue, onUrlChange, onLabelChange, inputCls }) {
  const { googleAccessToken } = useAuth();
  const [tab, setTab] = useState('browse');       // 'browse' | 'upload'
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [pendingFile, setPendingFile] = useState(null); // File | null
  const fileInputRef = useRef(null);

  // ── Browse tab ──────────────────────────────────────────────────────────────
  const handleBrowse = () => {
    if (!googleAccessToken || picking) return;
    setPicking(true);
    openDrivePicker({
      accessToken: googleAccessToken,
      onPicked: ({ url, name }) => {
        onUrlChange(url);
        if (!labelValue) onLabelChange(name);
        setPicking(false);
      },
      onCancel: () => setPicking(false),
    });
  };

  // ── Upload tab ──────────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setUploadError(null);
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (!pendingFile || uploading || !googleAccessToken) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      const result = await uploadToDrive({
        accessToken: googleAccessToken,
        file: pendingFile,
        onProgress: setUploadProgress,
      });
      onUrlChange(result.url);
      if (!labelValue) onLabelChange(result.name);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadProgress(100);
    } catch (err) {
      console.error('Drive upload error:', err);
      setUploadError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const tabBase = {
    flex: 1,
    padding: '5px 10px',
    fontSize: '11px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'all 0.15s',
  };
  const tabActive = { ...tabBase, background: '#fff', color: '#334155', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
  const tabInactive = { ...tabBase, background: 'transparent', color: '#94A3B8' };

  const signedOut = !googleAccessToken;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Tab switcher */}
      <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
        <button type="button" onClick={() => setTab('browse')} style={tab === 'browse' ? tabActive : tabInactive}>
          Browse Drive
        </button>
        <button type="button" onClick={() => setTab('upload')} style={tab === 'upload' ? tabActive : tabInactive}>
          ↑ Upload file
        </button>
      </div>

      {/* ── Browse tab content ── */}
      {tab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={urlValue}
              onChange={e => onUrlChange(e.target.value)}
              placeholder="Paste Google Drive link…"
              className={`${inputCls} flex-1 min-w-0`}
            />
            {signedOut ? (
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace', whiteSpace: 'nowrap', padding: '0 4px' }}>
                Sign in to browse
              </span>
            ) : (
              <button
                type="button"
                onClick={handleBrowse}
                disabled={picking}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  cursor: picking ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  opacity: picking ? 0.5 : 1,
                  transition: 'background 0.15s',
                }}
              >
                <DriveIcon />
                {picking ? 'Opening…' : 'Browse Drive'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Upload tab content ── */}
      {tab === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {signedOut ? (
            <div style={{ padding: '14px', background: '#FFF7ED', borderRadius: '8px', border: '1px solid #FED7AA', fontSize: '12px', color: '#92400E', textAlign: 'center' }}>
              Sign in with Google to upload files to your Drive
            </div>
          ) : (
            <>
              {/* Drop zone / file select */}
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{
                  border: '2px dashed',
                  borderColor: pendingFile ? '#FF6B35' : '#CBD5E1',
                  borderRadius: '10px',
                  padding: '20px 16px',
                  textAlign: 'center',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  background: pendingFile ? '#FFF7F5' : '#FAFBFC',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!pendingFile && !uploading) e.currentTarget.style.borderColor = '#FF6B35'; }}
                onMouseLeave={e => { if (!pendingFile) e.currentTarget.style.borderColor = '#CBD5E1'; }}
              >
                {pendingFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ fontSize: '20px' }}>📄</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{pendingFile.name}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                      {pendingFile.size > 1_000_000
                        ? `${(pendingFile.size / 1_000_000).toFixed(1)} MB`
                        : `${Math.round(pendingFile.size / 1024)} KB`}
                    </div>
                    {!uploading && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        style={{ fontSize: '10px', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer', marginTop: '2px' }}
                      >
                        ✕ Choose different file
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <DriveIcon />
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Click to choose a file</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>It will be saved to your Google Drive</div>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {/* Progress bar */}
              {uploading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${uploadProgress}%`,
                        background: '#FF6B35',
                        borderRadius: '99px',
                        transition: 'width 0.2s',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
                    Uploading to Drive… {uploadProgress}%
                  </div>
                </div>
              )}

              {/* Error */}
              {uploadError && (
                <div style={{ padding: '10px 12px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: '8px', fontSize: '11px', color: '#BE123C', fontWeight: 500 }}>
                  ⚠ {uploadError}
                </div>
              )}

              {/* Upload button */}
              {pendingFile && !uploading && (
                <button
                  type="button"
                  onClick={handleUpload}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#FF6B35',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  <DriveIcon />
                  Upload to Drive
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Shared: label input + open link — shown below both tabs */}
      <input
        value={labelValue}
        onChange={e => onLabelChange(e.target.value)}
        placeholder="File label (e.g. Design Brief)"
        className={inputCls}
      />

      {urlValue && (
        <a
          href={urlValue}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#4285F4', textDecoration: 'none', fontWeight: 500 }}
          onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
          onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
        >
          <DriveIcon /> Open file in Drive
        </a>
      )}
    </div>
  );
}
