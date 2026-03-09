import { useState } from 'react';
import { Overlay, formStyles } from '../shared/UI';
import { openTaskAssignmentEmail } from '../../lib/gmail';
import DriveFilePicker from '../shared/DriveFilePicker';
import MultiAssigneeSelect from '../shared/MultiAssigneeSelect';

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];
const PRIORITIES = ['high', 'medium', 'low'];
const CATEGORIES = ['design', 'operations', 'marketing', 'finance'];

export default function TaskEditModal({ task, team, designs, projects = [], onSave, onDelete, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    assignee_ids: Array.isArray(task.assignee_ids) && task.assignee_ids.length > 0
      ? task.assignee_ids.map(String)
      : (task.assignee_id ? [String(task.assignee_id)] : []),
    due_date: task.due_date || null,
    status: task.status,
    priority: task.priority,
    category: task.category,
    design_id: task.design_id || null,
    project_id: task.project_id || null,
    drive_file_url: task.drive_file_url || '',
    drive_file_name: task.drive_file_name || '',
  });

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const { label: lbl, input: inp, btnPrimary: bp, btnSecondary: bs } = formStyles;

  const handleSave = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(task.id, {
        ...form,
        due_date: form.due_date || null,
        design_id: form.design_id || null,
        assignee_ids: form.assignee_ids,
        assignee_id: form.assignee_ids[0] || null,   // keep for backward compat
        project_id: form.project_id || null,
        drive_file_url: form.drive_file_url || null,
        drive_file_name: form.drive_file_name || null,
      });
      onClose();
    } catch (err) {
      setSaveError(err?.message || 'Save failed — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[500px] max-h-[88vh] overflow-auto shadow-2xl border border-slate-200">
        <div className="px-6 pt-5 pb-3.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            Edit Task
          </span>
          <button onClick={onClose} className="text-lg text-slate-400 hover:bg-slate-100 px-2 py-0.5 rounded-md cursor-pointer">
            ×
          </button>
        </div>
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-mono break-all">
            ⚠️ {saveError}
          </div>
        )}
        <div className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className={lbl}>Title</label>
            <input value={form.title} onChange={e => upd('title', e.target.value)} className={inp} />
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Description</label>
            <textarea
              value={form.description}
              onChange={e => upd('description', e.target.value)}
              placeholder="Add details, notes, or links…"
              rows={3}
              className={`${inp} resize-y min-h-[72px]`}
            />
          </div>

          {/* Assignees + Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={lbl}>Assignees</label>
              <MultiAssigneeSelect
                team={team}
                selectedIds={form.assignee_ids}
                onChange={ids => upd('assignee_ids', ids)}
                inputCls={inp}
              />
            </div>
            <div>
              <label className={lbl}>Due Date</label>
              <input type="date" value={form.due_date || ''} onChange={e => upd('due_date', e.target.value || null)} className={inp} />
            </div>
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={lbl}>Status</label>
              <select value={form.status} onChange={e => upd('status', e.target.value)} className={inp}>
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Priority</label>
              <select value={form.priority} onChange={e => upd('priority', e.target.value)} className={inp}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Category + Linked Design */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={lbl}>Category</label>
              <select value={form.category} onChange={e => upd('category', e.target.value)} className={inp}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Linked Design</label>
              <select value={form.design_id || ''} onChange={e => upd('design_id', e.target.value ? parseInt(e.target.value) : null)} className={inp}>
                <option value="">None</option>
                {designs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Project link */}
          {projects.length > 0 && (
            <div>
              <label className={lbl}>Project</label>
              <select
                value={form.project_id || ''}
                onChange={e => upd('project_id', e.target.value ? parseInt(e.target.value) : null)}
                className={inp}
              >
                <option value="">Not part of a project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Gmail: Notify Assignee (notifies first selected assignee) */}
          {(() => {
            const assignee = team.find(m => m.id === (form.assignee_ids[0] || null));
            if (!assignee?.email) return null;
            return (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#EA4335"/>
                  </svg>
                  <span className="text-xs text-slate-500 font-mono">Assignee: <strong className="text-slate-700">{assignee.name}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => openTaskAssignmentEmail({ task: { ...task, ...form }, assignee })}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer transition-colors"
                >
                  📧 Send notification
                </button>
              </div>
            );
          })()}

          {/* Google Drive file */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <div className="flex items-center gap-2 mb-3">
              <img
                src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"
                alt="Drive"
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
          <div className="flex items-center justify-between pt-1">
            {onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500 font-semibold">Delete this task?</span>
                  <button
                    onClick={() => { onDelete(task.id); onClose(); }}
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
              <button onClick={onClose} className={bs}>Cancel</button>
              <button
                onClick={handleSave}
                disabled={!form.title.trim() || saving}
                className={bp}
                style={{ opacity: (form.title.trim() && !saving) ? 1 : 0.5 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
