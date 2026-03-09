import { useState, useRef } from 'react';
import { Overlay, formStyles } from '../shared/UI';
import DriveFilePicker from '../shared/DriveFilePicker';

const STATUSES = [
  { id: 'planning', label: 'Planning' },
  { id: 'active', label: 'Active' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'complete', label: 'Complete' },
];
const PRIORITIES = [
  { id: 'urgent', label: 'Urgent' },
  { id: 'high', label: 'High' },
  { id: 'normal', label: 'Normal' },
  { id: 'low', label: 'Low' },
];

export default function ProjectModal({ project, team, onCreate, onUpdate, onClose }) {
  const isEdit = !!project;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const saveTimeoutRef = useRef(null);
  const [form, setForm] = useState({
    name: project?.name || '',
    description: project?.description || '',
    status: project?.status || 'planning',
    priority: project?.priority || 'normal',
    client: project?.client || '',
    due_date: project?.due_date || null,
    budget: project?.budget ?? '',
    lead_id: project?.lead_id || null,
    drive_file_url: project?.drive_file_url || '',
    drive_file_name: project?.drive_file_name || '',
  });

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const { label: lbl, input: inp, btnPrimary: bp, btnSecondary: bs } = formStyles;

  const handleSave = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setSaveError(null);

    // Safety timeout: if DB never responds in 12s, unlock the button
    saveTimeoutRef.current = setTimeout(() => {
      setSaving(false);
      setSaveError('Request timed out. Check that your database migration has been applied in Supabase, then try again.');
    }, 12000);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        status: form.status,
        priority: form.priority,
        client: form.client,
        due_date: form.due_date || null,
        budget: form.budget !== '' ? parseFloat(form.budget) : null,
        lead_id: form.lead_id || null,
        drive_file_url: form.drive_file_url || null,
        drive_file_name: form.drive_file_name || null,
      };
      if (isEdit) {
        await onUpdate(project.id, payload);
      } else {
        await onCreate(payload);
      }
      clearTimeout(saveTimeoutRef.current);
      onClose();
    } catch (err) {
      clearTimeout(saveTimeoutRef.current);
      // Surface as much detail as possible for debugging
      const msg = [err?.message, err?.details, err?.hint]
        .filter(Boolean)
        .join(' — ') || 'Save failed — please try again.';
      console.error('Project save error full object:', err);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[520px] max-h-[88vh] overflow-auto shadow-2xl border border-slate-200">
        <div className="px-6 pt-5 pb-3.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            {isEdit ? 'Edit Project' : 'New Project'}
          </span>
          <button onClick={onClose} className="text-lg text-slate-400 hover:bg-slate-100 px-2 py-0.5 rounded-md cursor-pointer">
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className={lbl}>Project Name *</label>
            <input
              value={form.name}
              onChange={e => upd('name', e.target.value)}
              placeholder="e.g. Summer Collection Drop"
              className={inp}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Description</label>
            <textarea
              value={form.description}
              onChange={e => upd('description', e.target.value)}
              placeholder="Goals, scope, context…"
              rows={3}
              className={`${inp} resize-y min-h-[72px]`}
            />
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={lbl}>Status</label>
              <select value={form.status} onChange={e => upd('status', e.target.value)} className={inp}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Priority</label>
              <select value={form.priority} onChange={e => upd('priority', e.target.value)} className={inp}>
                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Client + Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={lbl}>Client / Account</label>
              <input
                value={form.client}
                onChange={e => upd('client', e.target.value)}
                placeholder="e.g. Etsy Store"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Due Date</label>
              <input
                type="date"
                value={form.due_date || ''}
                onChange={e => upd('due_date', e.target.value || null)}
                className={inp}
              />
            </div>
          </div>

          {/* Budget + Lead */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={lbl}>Budget ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.budget}
                onChange={e => upd('budget', e.target.value)}
                placeholder="0.00"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Team Lead</label>
              <select value={form.lead_id || ''} onChange={e => upd('lead_id', e.target.value || null)} className={inp}>
                <option value="">Unassigned</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          {/* Google Drive File */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <img
                src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"
                alt="Google Drive"
                className="w-4 h-4"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Google Drive File
              </span>
            </div>
            <DriveFilePicker
              urlValue={form.drive_file_url}
              labelValue={form.drive_file_name}
              onUrlChange={v => upd('drive_file_url', v)}
              onLabelChange={v => upd('drive_file_name', v)}
              inputCls={inp}
            />
          </div>

          {/* Actions */}
          <div className="pt-1">
            {saveError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-mono break-all">
                ⚠️ {saveError}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <button onClick={onClose} className={bs}>Cancel</button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className={bp}
                style={{ opacity: form.name.trim() && !saving ? 1 : 0.5 }}
              >
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
