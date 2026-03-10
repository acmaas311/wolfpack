import { useState, useEffect, useRef } from 'react';
import { Card, Avatar, PriorityDot, StatusPill, Overlay, UnsavedChangesDialog, formStyles } from '../shared/UI';
import MultiAssigneeSelect, { AvatarStack } from '../shared/MultiAssigneeSelect';
import DriveFilePicker from '../shared/DriveFilePicker';
import TaskEditModal from '../tasks/TaskEditModal';
import { useAuth } from '../../hooks/useAuth';
import { ensureFreshSession } from '../../lib/supabase';

// ─── Drive thumbnail helpers ───────────────────────────────────────────────
// Extract the file ID from any common Google Drive / Docs / Slides / Sheets URL.
function extractDriveFileId(url) {
  if (!url) return null;
  // /file/d/FILE_ID/...  OR  /d/FILE_ID/...
  const fileMatch = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch) return fileMatch[1];
  // ?id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch) return idMatch[1];
  return null;
}

// ─── DriveThumbnail ────────────────────────────────────────────────────────
// Fetches the Drive thumbnail using the OAuth access token so it works on iOS
// Safari (which blocks the cross-origin drive.google.com cookie via ITP).
// Falls back to a simple Drive badge if the fetch fails or no token is present.
function DriveThumbnail({ fileId, driveFileUrl, driveFileName, height = 120 }) {
  const { googleAccessToken } = useAuth();
  const [thumbUrl, setThumbUrl] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'

  useEffect(() => {
    if (!fileId) { setStatus('error'); return; }

    let cancelled = false;
    setStatus('loading');
    setThumbUrl(null);

    const fetchThumb = async () => {
      try {
        // Fetch the thumbnailLink from the Drive Files API.  googleapis.com
        // supports CORS with an Authorization header, so this works fine from
        // the browser.
        const meta = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink`,
          googleAccessToken
            ? { headers: { Authorization: `Bearer ${googleAccessToken}` } }
            : {}
        );
        if (!meta.ok) throw new Error('meta failed');
        const { thumbnailLink } = await meta.json();
        if (!thumbnailLink) throw new Error('no thumbnail');

        // Use the thumbnailLink directly as the <img> src.
        // lh3.googleusercontent.com URLs are pre-signed by Google and work
        // as plain image sources without any auth headers — but they do NOT
        // support fetch() from a cross-origin page (no CORS headers), so we
        // must NOT try to proxy them through JS fetch().
        if (cancelled) return;
        setThumbUrl(thumbnailLink.replace(/=s\d+$/, '=s400'));
        setStatus('ok');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    fetchThumb();
    return () => { cancelled = true; };
  }, [fileId, googleAccessToken]);

  if (status === 'ok' && thumbUrl) {
    return (
      <img
        src={thumbUrl}
        alt="Design preview"
        className="w-full object-cover border-b border-slate-100"
        style={{ height }}
      />
    );
  }

  if (status === 'error') {
    // Non-image file or fetch failed — show a compact Drive badge
    return (
      <a
        href={driveFileUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="flex items-center justify-center gap-2 border-b border-slate-100 bg-slate-50 text-slate-400 text-xs font-medium"
        style={{ height: 80 }}
      >
        <svg width="14" height="14" viewBox="0 0 87.3 78" fill="none">
          <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
          <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5A9 9 0 000 53h27.5z" fill="#00ac47"/>
          <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/>
          <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
          <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
          <path d="M73.4 26.5l-12.6-21.8C59.6 3.1 58.45 2 57.1 1.2L43.35 25 59.6 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
        </svg>
        {driveFileName
          ? (driveFileName.length > 22 ? driveFileName.slice(0, 22) + '…' : driveFileName)
          : 'Open in Drive'}
      </a>
    );
  }

  // Loading skeleton
  return (
    <div
      className="w-full border-b border-slate-100 bg-slate-100 animate-pulse"
      style={{ height }}
    />
  );
}

const D_STAGES = [
  { id: 'concept', label: 'Concept', color: '#94A3B8' },
  { id: 'in-review', label: 'In Review', color: '#F59E0B' },
  { id: 'approved', label: 'Approved', color: '#1D428A' },
  { id: 'listed', label: 'Listed', color: '#10B981' },
];

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

// ─── New Design Modal ───
function DesignCreateModal({ team, onCreate, onClose }) {
  const initialForm = {
    name: '',
    status: 'concept',
    assignee_ids: [],
    created_by_id: null,
    notes: '',
    platforms: [],
    drive_file_url: '',
    drive_file_name: '',
  };
  const initialFormRef = useRef(initialForm);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
  const handleClose = () => {
    if (isDirty && !saving) { setConfirmClose(true); } else { onClose(); }
  };

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const { label: lbl, input: inp, btnPrimary: bp, btnSecondary: bs } = formStyles;

  const handleCreate = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    let timeoutId = null;
    try {
      // Refresh the auth token before saving so the timeout only counts DB write time,
      // not token-refresh latency after the app has been idle for a while.
      await ensureFreshSession();
      // Build payload — strip null created_by_id so missing DB column doesn't break insert
      const payload = {
        name: form.name.trim(),
        status: form.status,
        assignee_ids: form.assignee_ids,
        assignee_id: form.assignee_ids[0] || null,
        notes: form.notes,
        platforms: form.platforms,
        drive_file_url: (form.drive_file_url ?? '').trim() || null,
        drive_file_name: (form.drive_file_name ?? '').trim() || null,
      };
      if (form.created_by_id) payload.created_by_id = form.created_by_id;

      // Same iOS Safari timeout guard as in handleSave
      const createPromise = onCreate(payload);
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Request timed out — check your connection and try again.')),
          45000
        );
      });

      const newDesign = await Promise.race([createPromise, timeoutPromise]);

      // If DB insert failed (returned null), show error and stay open
      if (!newDesign?.id) {
        setSaveError('Failed to save design — check your Supabase connection and try again.');
        return;
      }

      onClose();
    } catch (err) {
      console.error('Create design error:', err);
      setSaveError(err.message || 'Something went wrong. Please try again.');
    } finally {
      clearTimeout(timeoutId);
      setSaving(false);
    }
  };

  return (
    <>
    <Overlay onClose={handleClose}>
      <div className="bg-white rounded-2xl w-full max-w-[480px] max-h-[85vh] overflow-auto shadow-2xl border border-slate-200">
        <div className="px-6 pt-5 pb-3.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">New Design</span>
          <button onClick={handleClose} className="text-lg text-slate-400 hover:bg-slate-100 px-2 py-0.5 rounded-md cursor-pointer">×</button>
        </div>
        <div className="p-6">
          <div className="mb-5">
            <label className={lbl}>Design Name</label>
            <input
              value={form.name}
              onChange={e => upd('name', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Summer Floral Tee…"
              className={inp}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
            <div>
              <label className={lbl}>Status</label>
              <select value={form.status} onChange={e => upd('status', e.target.value)} className={inp}>
                {D_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Assignees</label>
              <MultiAssigneeSelect
                team={team}
                selectedIds={form.assignee_ids}
                onChange={ids => upd('assignee_ids', ids)}
                inputCls={inp}
              />
            </div>
          </div>
          <div className="mb-5">
            <label className={lbl}>Created By</label>
            <select value={form.created_by_id || ''} onChange={e => upd('created_by_id', e.target.value || null)} className={inp}>
              <option value="">— Select —</option>
              {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="mb-5">
            <label className={lbl}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => upd('notes', e.target.value)}
              placeholder="Design notes, feedback, IP concerns…"
              rows={3}
              className={`${inp} resize-y min-h-[72px]`}
            />
          </div>

          {/* Google Drive File */}
          <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <img src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png" alt="" style={{ width: 16, height: 16 }} />
              <span className="text-xs font-bold text-slate-600">Google Drive File <span className="text-slate-400 font-normal">(optional)</span></span>
            </div>
            <DriveFilePicker
              urlValue={form.drive_file_url}
              labelValue={form.drive_file_name}
              onUrlChange={v => upd('drive_file_url', v)}
              onLabelChange={v => upd('drive_file_name', v)}
              inputCls={inp}
            />
          </div>

          {saveError && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 font-semibold">
              ⚠ {saveError}
            </div>
          )}
          <div className="flex gap-2.5 justify-end">
            <button onClick={handleClose} className={bs}>Cancel</button>
            <button
              onClick={handleCreate}
              disabled={!form.name.trim() || saving}
              className={bp}
              style={{ opacity: form.name.trim() && !saving ? 1 : 0.5 }}
            >
              {saving ? 'Creating…' : 'Create Design'}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
    {confirmClose && (
      <UnsavedChangesDialog
        saving={saving}
        onSave={async () => { setConfirmClose(false); await handleCreate(); }}
        onDiscard={onClose}
        onKeepEditing={() => setConfirmClose(false)}
      />
    )}
    </>
  );
}

// ─── Design Detail Modal ───
function DesignDetailModal({ design, team, tasks, onSave, onDelete, onClose, onTaskUpdate, onTaskDelete }) {
  const initialForm = {
    name: design.name,
    status: design.status,
    assignee_ids: Array.isArray(design.assignee_ids) && design.assignee_ids.length > 0
      ? design.assignee_ids.map(String)
      : (design.assignee_id ? [String(design.assignee_id)] : []),
    created_by_id: design.created_by_id || null,
    notes: design.notes || '',
    platforms: design.platforms || [],
    drive_file_url: design.drive_file_url || '',
    drive_file_name: design.drive_file_name || '',
  };
  const initialFormRef = useRef(initialForm);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
  const handleClose = () => {
    if (isDirty && !saving) { setConfirmClose(true); } else { onClose(); }
  };

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const relatedTasks = tasks.filter(t => t.design_id === design.id);
  const { label: lbl, input: inp, btnPrimary: bp, btnSecondary: bs } = formStyles;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);

    const updates = {
      ...form,
      assignee_ids: form.assignee_ids,
      assignee_id: form.assignee_ids[0] || null,
      // Use ?? '' so .trim() never throws if a field is null/undefined
      drive_file_url: (form.drive_file_url ?? '').trim() || null,
      drive_file_name: (form.drive_file_name ?? '').trim() || null,
    };

    // Retry up to 2 times with a 20 s timeout each.
    // The first timeout is almost always a cold PostgREST TCP connection;
    // the retry lands on a freshly-warmed connection and succeeds instantly.
    const MAX_ATTEMPTS = 2;
    const TIMEOUT_MS = 20000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let timeoutId = null;
      try {
        await ensureFreshSession();
        const savePromise = onSave(design.id, updates);
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('__timeout__')), TIMEOUT_MS);
        });

        await Promise.race([savePromise, timeoutPromise]);
        onClose();
        return; // success — exit the loop
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.message === '__timeout__' && attempt < MAX_ATTEMPTS) {
          // First timeout: show a brief "retrying" hint and loop again.
          console.warn(`Save attempt ${attempt} timed out — retrying on fresh connection…`);
          setSaveError('Connection was slow — retrying…');
          continue;
        }
        // Final attempt failed, or a non-timeout error — surface it.
        const msg = err.message === '__timeout__'
          ? 'Save timed out — check your connection and try again.'
          : (err.message || 'Failed to save changes. Please try again.');
        console.error('Save design error:', err);
        setSaveError(msg);
        setSaving(false);
        return;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    setSaving(false);
  };

  return (
    <>
    <Overlay onClose={handleClose}>
      <div className="bg-white rounded-2xl w-full max-w-[540px] max-h-[88vh] overflow-auto shadow-2xl border border-slate-200">
        <div className="px-6 pt-5 pb-3.5 border-b border-slate-100 flex justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Design Details</span>
          <button onClick={handleClose} className="text-lg text-slate-400 hover:bg-slate-100 px-2 py-0.5 rounded-md cursor-pointer">×</button>
        </div>
        <div className="p-6">
          <div className="mb-5">
            <label className={lbl}>Name</label>
            <input value={form.name} onChange={e => upd('name', e.target.value)} className={inp} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
            <div>
              <label className={lbl}>Status</label>
              <select value={form.status} onChange={e => upd('status', e.target.value)} className={inp}>
                {D_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Assignees</label>
              <MultiAssigneeSelect
                team={team}
                selectedIds={form.assignee_ids}
                onChange={ids => upd('assignee_ids', ids)}
                inputCls={inp}
              />
            </div>
          </div>
          <div className="mb-5">
            <label className={lbl}>Created By</label>
            <select value={form.created_by_id || ''} onChange={e => upd('created_by_id', e.target.value || null)} className={inp}>
              <option value="">— Select —</option>
              {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="mb-5">
            <label className={lbl}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => upd('notes', e.target.value)}
              placeholder="Design notes, feedback, IP concerns..."
              rows={3}
              className={`${inp} resize-y min-h-[72px]`}
            />
          </div>

          {/* Google Drive File */}
          <div className="mb-5 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <img src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png" alt="" style={{ width: 16, height: 16 }} />
              <span className="text-xs font-bold text-slate-600">Google Drive File</span>
            </div>
            <DriveFilePicker
              urlValue={form.drive_file_url}
              labelValue={form.drive_file_name}
              onUrlChange={v => upd('drive_file_url', v)}
              onLabelChange={v => upd('drive_file_name', v)}
              inputCls={inp}
            />
          </div>

          {/* Related Tasks */}
          <div className="mb-5">
            <label className={lbl}>Related Tasks ({relatedTasks.length})</label>
            {relatedTasks.length === 0 ? (
              <div className="text-xs text-slate-400 py-2">No tasks linked. Link tasks from the task edit modal.</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {relatedTasks.map(t => {
                  const mem = team.find(m => m.id === t.assignee_id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setEditingTask(t)}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 w-full text-left transition-colors hover:bg-orange-50 hover:border-orange-200 cursor-pointer"
                    >
                      <PriorityDot priority={t.priority} />
                      <span className="text-[13px] text-slate-900 flex-1 font-medium truncate">{t.title}</span>
                      {mem && <Avatar member={mem} size={20} />}
                      <StatusPill
                        label={COLUMNS.find(c => c.id === t.status)?.label}
                        color={t.status === 'done' ? '#10B981' : t.status === 'in-progress' ? '#FF6B35' : '#94A3B8'}
                      />
                      <span className="text-[10px] text-slate-300 flex-shrink-0">→</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {saveError && (
            <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-semibold">
              ⚠ {saveError}
            </div>
          )}
          <div className="flex items-center justify-between">
            {onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500 font-semibold">Delete this design?</span>
                  <button
                    onClick={() => { onDelete(design.id); onClose(); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white border-none cursor-pointer hover:bg-red-600 transition-colors"
                  >
                    Yes, delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className={bs + ' !px-3 !py-1.5 !text-xs'}>No</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 border border-red-100 bg-red-50 hover:bg-red-100 cursor-pointer transition-colors"
                >
                  Delete
                </button>
              )
            )}
            <div className="flex gap-2.5 ml-auto">
              <button onClick={handleClose} disabled={saving} className={bs}>Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={bp}
                style={{ opacity: saving ? 0.5 : 1 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
    {confirmClose && (
      <UnsavedChangesDialog
        saving={saving}
        onSave={async () => { setConfirmClose(false); await handleSave(); }}
        onDiscard={onClose}
        onKeepEditing={() => setConfirmClose(false)}
      />
    )}
    {editingTask && onTaskUpdate && (
      <TaskEditModal
        task={editingTask}
        team={team}
        designs={[design]}
        onSave={(id, updates) => { onTaskUpdate(id, updates); setEditingTask(null); }}
        onDelete={onTaskDelete ? (id) => { onTaskDelete(id); setEditingTask(null); } : null}
        onClose={() => setEditingTask(null)}
      />
    )}
    </>
  );
}

// ─── Design Card ───
function DesignCard({ design, team, tasks, onUpdate, onDelete, onTaskUpdate, onTaskDelete }) {
  const [modal, setModal] = useState(false);
  const assigneeIds = Array.isArray(design.assignee_ids) && design.assignee_ids.length > 0
    ? design.assignee_ids.map(String)
    : (design.assignee_id ? [String(design.assignee_id)] : []);
  const relCount = tasks.filter(t => t.design_id === design.id).length;

  // Prefer an uploaded image; fall back to Drive thumbnail via OAuth (works on iOS Safari).
  const driveFileId = !design.image_path && design.drive_file_url
    ? extractDriveFileId(design.drive_file_url)
    : null;

  return (
    <>
      <Card
        draggable
        onDragStart={e => { e.dataTransfer.setData('text/plain', String(design.id)); e.currentTarget.style.opacity = '0.4'; }}
        onDragEnd={e => { e.currentTarget.style.opacity = '1'; }}
        onClick={() => setModal(true)}
        className="mb-2 overflow-hidden"
      >
        {/* ── Preview area ── */}
        {design.image_path ? (
          <img
            src={design.image_path}
            alt={design.name}
            className="w-full object-cover border-b border-slate-100"
            style={{ height: 120 }}
          />
        ) : driveFileId ? (
          /* Use DriveThumbnail which fetches via OAuth token — avoids iOS Safari ITP */
          <DriveThumbnail
            fileId={driveFileId}
            driveFileUrl={design.drive_file_url}
            driveFileName={design.drive_file_name}
          />
        ) : null}

        <div className="p-3">
          <div className="text-sm font-semibold text-slate-900 mb-2">{design.name}</div>
          <div className="flex items-center justify-between">
            <AvatarStack ids={assigneeIds} team={team} size={22} max={3} />
            <div className="flex gap-2 items-center">
              {design.drive_file_url && (
                <a
                  href={design.drive_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  title={design.drive_file_name || 'Open Drive file'}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{ background: 'rgba(66,133,244,0.1)', color: '#4285F4' }}
                >
                  <svg width="9" height="9" viewBox="0 0 87.3 78" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5A9 9 0 000 53h27.5z" fill="#00ac47"/>
                    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/>
                    <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="M73.4 26.5l-12.6-21.8C59.6 3.1 58.45 2 57.1 1.2L43.35 25 59.6 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  {design.drive_file_name
                    ? (design.drive_file_name.length > 14 ? design.drive_file_name.slice(0, 14) + '…' : design.drive_file_name)
                    : 'Drive'}
                </a>
              )}
              {design.sales > 0 && <span className="text-[10px] text-emerald-600 font-bold font-mono">{design.sales} sold</span>}
              {relCount > 0 && <span className="text-[10px] text-slate-400 font-mono">{relCount} task{relCount > 1 ? 's' : ''}</span>}
            </div>
          </div>
        </div>
      </Card>
      {modal && <DesignDetailModal design={design} team={team} tasks={tasks} onSave={onUpdate} onDelete={onDelete} onClose={() => setModal(false)} onTaskUpdate={onTaskUpdate} onTaskDelete={onTaskDelete} />}
    </>
  );
}

// ─── View Dropdown ───
function ViewDropdown({ view, options, onChange }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={view}
        onChange={e => onChange(e.target.value)}
        style={{
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          appearance: 'none',
          paddingLeft: '12px',
          paddingRight: '28px',
          paddingTop: '6px',
          paddingBottom: '6px',
          fontSize: '12px',
          fontWeight: '600',
          color: '#475569',
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          cursor: 'pointer',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '10px', color: '#94A3B8', lineHeight: 1 }}>▾</span>
    </div>
  );
}

// ─── Design Table View ───
function DesignTableView({ designs, team, tasks, onUpdate, onDelete, onTaskUpdate, onTaskDelete }) {
  const [modal, setModal] = useState(null);
  const [sortKey, setSortKey] = useState('status');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const D_STATUS_ORDER = { 'concept': 0, 'in-review': 1, 'approved': 2, 'listed': 3 };

  const sorted = [...designs].sort((a, b) => {
    let av, bv;
    if (sortKey === 'status') { av = D_STATUS_ORDER[a.status] ?? 0; bv = D_STATUS_ORDER[b.status] ?? 0; }
    else if (sortKey === 'assignee') {
      const aIds = Array.isArray(a.assignee_ids) && a.assignee_ids.length > 0 ? a.assignee_ids : (a.assignee_id ? [a.assignee_id] : []);
      const bIds = Array.isArray(b.assignee_ids) && b.assignee_ids.length > 0 ? b.assignee_ids : (b.assignee_id ? [b.assignee_id] : []);
      av = (team.find(m => String(m.id) === String(aIds[0]))?.name || '').toLowerCase();
      bv = (team.find(m => String(m.id) === String(bIds[0]))?.name || '').toLowerCase();
    }
    else if (sortKey === 'created_by') {
      av = (team.find(m => m.id === a.created_by_id)?.name || '').toLowerCase();
      bv = (team.find(m => m.id === b.created_by_id)?.name || '').toLowerCase();
    }
    else if (sortKey === 'tasks') {
      av = tasks.filter(t => t.design_id === a.id).length;
      bv = tasks.filter(t => t.design_id === b.id).length;
    }
    else { av = (a[sortKey] ?? '').toString().toLowerCase(); bv = (b[sortKey] ?? '').toString().toLowerCase(); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ k }) => (
    <span className="ml-1 text-[9px]" style={{ color: sortKey === k ? '#FF6B35' : '#CBD5E1' }}>
      {sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );
  const thCls = "text-left px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono cursor-pointer select-none whitespace-nowrap hover:text-slate-600 transition-colors";

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm bg-slate-50 rounded-xl border border-slate-100">
        No designs yet
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full" style={{ minWidth: 560 }}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className={thCls} style={{ width: '30%' }} onClick={() => handleSort('name')}>Name<SortIcon k="name" /></th>
              <th className={thCls} onClick={() => handleSort('status')}>Status<SortIcon k="status" /></th>
              <th className={thCls} onClick={() => handleSort('assignee')}>Assignee<SortIcon k="assignee" /></th>
              <th className={thCls} onClick={() => handleSort('created_by')}>Created By<SortIcon k="created_by" /></th>
              <th className={thCls} onClick={() => handleSort('tasks')}>Tasks<SortIcon k="tasks" /></th>
              <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Notes</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((design, i) => {
              const dAssigneeIds = Array.isArray(design.assignee_ids) && design.assignee_ids.length > 0
                ? design.assignee_ids.map(String)
                : (design.assignee_id ? [String(design.assignee_id)] : []);
              const createdBy = team.find(m => m.id === design.created_by_id);
              const relCount = tasks.filter(t => t.design_id === design.id).length;
              const stage = D_STAGES.find(s => s.id === design.status);
              return (
                <tr
                  key={design.id}
                  onClick={() => setModal(design)}
                  className="border-b border-slate-100 cursor-pointer transition-colors"
                  style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFBFC'}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {design.image_path ? (
                        <img src={design.image_path} alt={design.name} className="w-8 h-8 rounded object-cover flex-shrink-0 border border-slate-100" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-slate-100 flex-shrink-0 flex items-center justify-center text-slate-300 text-xs">✦</div>
                      )}
                      <span className="text-[13px] font-semibold text-slate-900">{design.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
                      style={{ background: `${stage?.color}20`, color: stage?.color || '#94A3B8' }}
                    >
                      {stage?.label || design.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <AvatarStack ids={dAssigneeIds} team={team} size={20} max={3} />
                  </td>
                  <td className="px-4 py-3">
                    {createdBy ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar member={createdBy} size={20} />
                        <span className="text-[12px] text-slate-600">{createdBy.name.split(' ')[0]}</span>
                      </div>
                    ) : <span className="text-[12px] text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-mono text-slate-500">{relCount > 0 ? relCount : '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-slate-500">
                      {design.notes ? (design.notes.length > 55 ? design.notes.slice(0, 55) + '…' : design.notes) : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <DesignDetailModal
          design={modal}
          team={team}
          tasks={tasks}
          onSave={onUpdate}
          onDelete={onDelete}
          onClose={() => setModal(null)}
          onTaskUpdate={onTaskUpdate}
          onTaskDelete={onTaskDelete}
        />
      )}
    </>
  );
}

// ─── Design Pipeline (Kanban + Table) ───
export default function DesignPipeline({ designs, team, tasks, onUpdate, onCreate, onDelete, onTaskUpdate, onTaskDelete }) {
  const [view, setView] = useState('cards');
  const [dragOverCol, setDragOverCol] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleDrop = (stageId, e) => {
    e.preventDefault();
    setDragOverCol(null);
    const id = parseInt(e.dataTransfer.getData('text/plain'));
    const d = designs.find(x => x.id === id);
    if (d && d.status !== stageId) onUpdate(id, { status: stageId });
  };

  return (
    <div>
      {/* Header: New Design + View Dropdown */}
      <div className="flex items-center justify-between mb-3.5">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold text-white border-none cursor-pointer transition-colors"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #e85a22)' }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Design
        </button>
        <ViewDropdown
          view={view}
          options={[
            { value: 'cards', label: 'View: Cards' },
            { value: 'table', label: 'View: Table' },
          ]}
          onChange={setView}
        />
      </div>

      {/* Cards (Kanban) View */}
      {view === 'cards' && (
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(4, minmax(170px, 1fr))' }}>
          {D_STAGES.map(stage => {
            const stageDesigns = designs.filter(d => d.status === stage.id);
            const isOver = dragOverCol === stage.id;
            return (
              <div key={stage.id} className="min-w-[170px]">
                <div className="flex items-center gap-2 mb-2.5 px-0.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  <span className="text-xs font-bold text-slate-500 font-mono uppercase tracking-wider">{stage.label}</span>
                  <span className="text-[11px] text-slate-400 font-mono bg-slate-100 px-1.5 rounded-lg">{stageDesigns.length}</span>
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOverCol(stage.id); }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={e => handleDrop(stage.id, e)}
                  className="rounded-xl p-1.5 min-h-[280px] transition-all"
                  style={{
                    background: isOver ? 'rgba(255,107,53,0.04)' : '#F8FAFC',
                    border: isOver ? '2px dashed #FF6B35' : '1px solid #F1F5F9',
                  }}
                >
                  {stageDesigns.map(d => (
                    <DesignCard key={d.id} design={d} team={team} tasks={tasks} onUpdate={onUpdate} onDelete={onDelete} onTaskUpdate={onTaskUpdate} onTaskDelete={onTaskDelete} />
                  ))}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Table View */}
      {view === 'table' && (
        <DesignTableView designs={designs} team={team} tasks={tasks} onUpdate={onUpdate} onDelete={onDelete} onTaskUpdate={onTaskUpdate} onTaskDelete={onTaskDelete} />
      )}

      {showCreateModal && (
        <DesignCreateModal team={team} onCreate={onCreate} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
