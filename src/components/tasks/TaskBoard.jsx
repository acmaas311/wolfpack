import { useState, useRef } from 'react';
import { Card, Avatar, PriorityDot, AssigneePopover, DatePopover, Toggle, Overlay, UnsavedChangesDialog, formStyles } from '../shared/UI';
import MultiAssigneeSelect, { AvatarStack } from '../shared/MultiAssigneeSelect';
import TaskEditModal from './TaskEditModal';
import TimelineView from './TimelineView';
import { openWeeklySummaryEmail } from '../../lib/gmail';
import { notifySlack } from '../../lib/slack';

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];
const PRIORITIES = ['high', 'medium', 'low'];
const CATEGORIES = ['design', 'operations', 'marketing', 'finance'];

const STATUS_COLOR = { 'todo': '#94A3B8', 'in-progress': '#FF6B35', 'review': '#1D428A', 'done': '#10B981' };
const STATUS_LABEL = { 'todo': 'To Do', 'in-progress': 'In Progress', 'review': 'Review', 'done': 'Done' };
const PRIORITY_COLOR = { high: '#EF4444', medium: '#F59E0B', low: '#94A3B8' };

function fmtShort(d) {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

// ─── New Task Modal ───
function TaskCreateModal({ team, designs, projects = [], onCreate, onClose }) {
  const initialForm = {
    title: '',
    description: '',
    assignee_ids: [],
    due_date: '',
    status: 'todo',
    priority: 'medium',
    category: 'design',
    design_id: null,
    project_id: null,
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
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await onCreate({
        ...form,
        assignee_ids: form.assignee_ids,
        assignee_id: form.assignee_ids[0] || null,
        due_date: form.due_date || null,
        design_id: form.design_id || null,
        project_id: form.project_id || null,
      });
      // Notify Slack about the new task (fire-and-forget)
      if (created) {
        const assignee = team.find(m => m.id === (created.assignee_ids?.[0] || created.assignee_id));
        notifySlack('task_created', { task: created, assigneeName: assignee?.name || null });
      }
      onClose();
    } catch (err) {
      setSaveError(err?.message || 'Save failed — unknown error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Overlay onClose={handleClose}>
      <div className="bg-white rounded-2xl w-full max-w-[480px] max-h-[85vh] overflow-auto shadow-2xl border border-slate-200">
        <div className="px-6 pt-5 pb-3.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">New Task</span>
          <button onClick={handleClose} className="text-lg text-slate-400 hover:bg-slate-100 px-2 py-0.5 rounded-md cursor-pointer">×</button>
        </div>
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-mono break-all">
            ⚠️ {saveError}
          </div>
        )}
        <div className="p-6">
          <div className="mb-5">
            <label className={lbl}>Title</label>
            <input
              value={form.title}
              onChange={e => upd('title', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Task title…"
              className={inp}
              autoFocus
            />
          </div>
          <div className="mb-5">
            <label className={lbl}>Description</label>
            <textarea
              value={form.description}
              onChange={e => upd('description', e.target.value)}
              placeholder="Add details, notes, or links…"
              rows={3}
              className={`${inp} resize-y min-h-[72px]`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
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
          {projects.length > 0 && (
            <div className="mb-4">
              <label className={lbl}>Project</label>
              <select value={form.project_id || ''} onChange={e => upd('project_id', e.target.value ? parseInt(e.target.value) : null)} className={inp}>
                <option value="">Not part of a project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2.5 justify-end">
            <button onClick={handleClose} className={bs}>Cancel</button>
            <button
              onClick={handleCreate}
              disabled={!form.title.trim() || saving}
              className={bp}
              style={{ opacity: (form.title.trim() && !saving) ? 1 : 0.5 }}
            >
              {saving ? 'Saving…' : 'Create Task'}
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

// ─── Kanban Card ───
function KanbanCard({ task, team, designs, projects = [], onUpdate, onDelete }) {
  const [datePop, setDatePop] = useState(null);
  const [editModal, setEditModal] = useState(false);

  // Support both legacy assignee_id and new assignee_ids array
  const assigneeIds = Array.isArray(task.assignee_ids) && task.assignee_ids.length > 0
    ? task.assignee_ids.map(String)
    : (task.assignee_id ? [String(task.assignee_id)] : []);

  return (
    <>
      <Card
        draggable
        onDragStart={e => { e.dataTransfer.setData('text/plain', String(task.id)); e.currentTarget.style.opacity = '0.4'; }}
        onDragEnd={e => { e.currentTarget.style.opacity = '1'; }}
        onClick={() => setEditModal(true)}
        className="p-3 mb-1.5"
      >
        <div className="flex items-start gap-2 mb-2.5">
          <PriorityDot priority={task.priority} />
          <span className="text-[13px] text-slate-900 leading-snug font-medium">{task.title}</span>
        </div>
        {task.drive_file_url && (
          <a
            href={task.drive_file_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title={task.drive_file_name || 'Open Drive file'}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold mb-2"
            style={{ background: 'rgba(66,133,244,0.1)', color: '#4285F4', textDecoration: 'none' }}
          >
            <svg width="9" height="9" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L28 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/>
              <path d="M43.65 25L29.35 0c-1.35.8-2.5 1.9-3.3 3.3l-25.8 44.7A9 9 0 000 53h28z" fill="#00AC47"/>
              <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.3l5.9 11.1z" fill="#EA4335"/>
              <path d="M43.65 25L57.95 0H29.35z" fill="#00832D"/>
              <path d="M59.3 53H87.3L73.55 76.8 59.3 53z" fill="#2684FC"/>
              <path d="M43.65 25L29.35 0H13.5c-2.1 0-4.1.55-5.85 1.5L43.65 53V25z" fill="#00AC47"/>
              <path d="M87.3 53H59.3L43.65 25v28L57.95 78h13.2c2.1 0 4.1-.55 5.85-1.5z" fill="#0066DA"/>
              <path d="M43.65 53v25l13.3-23H43.65z" fill="#EA4335"/>
            </svg>
            {task.drive_file_name ? (task.drive_file_name.length > 18 ? task.drive_file_name.slice(0, 18) + '…' : task.drive_file_name) : 'Drive'}
          </a>
        )}
        <div className="flex items-center justify-between">
          <AvatarStack ids={assigneeIds} team={team} size={22} max={3} />
          <span
            onClick={e => { e.stopPropagation(); setDatePop(e.currentTarget.getBoundingClientRect()); }}
            className="text-[10px] font-mono cursor-pointer px-1.5 py-0.5 rounded border border-transparent hover:bg-slate-100 hover:border-slate-200 transition-all"
            style={{ color: task.due_date ? '#94A3B8' : '#CBD5E1' }}
          >
            {task.due_date ? fmtShort(task.due_date) : '+ date'}
          </span>
          <span
            className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md"
            style={{
              color: PRIORITY_COLOR[task.priority] || '#94A3B8',
              background: `${PRIORITY_COLOR[task.priority] || '#94A3B8'}18`,
            }}
          >
            {task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : '—'}
          </span>
        </div>
        {task.status !== 'done' && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <button
              onClick={e => { e.stopPropagation(); onUpdate(task.id, { status: 'done' }); }}
              className="w-full flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-all"
              style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              ✓ Mark as Done
            </button>
          </div>
        )}
      </Card>

      {datePop && <DatePopover anchorRect={datePop} currentDate={task.due_date} onSelect={d => onUpdate(task.id, { due_date: d })} onClose={() => setDatePop(null)} />}
      {editModal && <TaskEditModal task={task} team={team} designs={designs} projects={projects} onSave={onUpdate} onDelete={onDelete} onClose={() => setEditModal(false)} />}
    </>
  );
}

// ─── Task Table View ───
function TaskTableView({ tasks, team, designs, projects = [], onUpdate, onDelete }) {
  const [editModal, setEditModal] = useState(null);
  const [sortKey, setSortKey] = useState('status');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
  const STATUS_ORDER = { 'todo': 0, 'in-progress': 1, 'review': 2, 'done': 3 };

  const sorted = [...tasks].sort((a, b) => {
    let av, bv;
    if (sortKey === 'status') { av = STATUS_ORDER[a.status] ?? 0; bv = STATUS_ORDER[b.status] ?? 0; }
    else if (sortKey === 'priority') { av = PRIORITY_ORDER[a.priority] ?? 1; bv = PRIORITY_ORDER[b.priority] ?? 1; }
    else if (sortKey === 'assignee') {
      const aId = (Array.isArray(a.assignee_ids) && a.assignee_ids.length > 0) ? a.assignee_ids[0] : a.assignee_id;
      const bId = (Array.isArray(b.assignee_ids) && b.assignee_ids.length > 0) ? b.assignee_ids[0] : b.assignee_id;
      av = (team.find(m => m.id === aId)?.name || '').toLowerCase();
      bv = (team.find(m => m.id === bId)?.name || '').toLowerCase();
    }
    else if (sortKey === 'design') {
      av = (designs.find(d => d.id === a.design_id)?.name || '').toLowerCase();
      bv = (designs.find(d => d.id === b.design_id)?.name || '').toLowerCase();
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
        No tasks found
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full" style={{ minWidth: 560 }}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className={thCls} style={{ width: '34%' }} onClick={() => handleSort('title')}>Title<SortIcon k="title" /></th>
              <th className={thCls} onClick={() => handleSort('status')}>Status<SortIcon k="status" /></th>
              <th className={thCls} onClick={() => handleSort('priority')}>Priority<SortIcon k="priority" /></th>
              <th className={thCls} onClick={() => handleSort('assignee')}>Assignee<SortIcon k="assignee" /></th>
              <th className={thCls} onClick={() => handleSort('due_date')}>Due Date<SortIcon k="due_date" /></th>
              <th className={thCls} onClick={() => handleSort('design')}>Design<SortIcon k="design" /></th>
              <th className={thCls}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task, i) => {
              const taskAssigneeIds = Array.isArray(task.assignee_ids) && task.assignee_ids.length > 0
                ? task.assignee_ids.map(String)
                : (task.assignee_id ? [String(task.assignee_id)] : []);
              const design = designs.find(d => d.id === task.design_id);
              return (
                <tr
                  key={task.id}
                  onClick={() => setEditModal(task)}
                  className="border-b border-slate-100 cursor-pointer transition-colors"
                  style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFBFC'}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PRIORITY_COLOR[task.priority] || '#94A3B8' }} />
                      <span className="text-[13px] font-medium text-slate-900">{task.title}</span>
                      {task.drive_file_url && (
                        <a
                          href={task.drive_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          title={task.drive_file_name || 'Open Drive file'}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0"
                          style={{ background: 'rgba(66,133,244,0.1)', color: '#4285F4', textDecoration: 'none' }}
                        >
                          <svg width="9" height="9" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L28 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/>
                            <path d="M43.65 25L29.35 0c-1.35.8-2.5 1.9-3.3 3.3l-25.8 44.7A9 9 0 000 53h28z" fill="#00AC47"/>
                            <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.3l5.9 11.1z" fill="#EA4335"/>
                            <path d="M43.65 25L57.95 0H29.35z" fill="#00832D"/>
                            <path d="M59.3 53H87.3L73.55 76.8 59.3 53z" fill="#2684FC"/>
                            <path d="M43.65 25L29.35 0H13.5c-2.1 0-4.1.55-5.85 1.5L43.65 53V25z" fill="#00AC47"/>
                            <path d="M87.3 53H59.3L43.65 25v28L57.95 78h13.2c2.1 0 4.1-.55 5.85-1.5z" fill="#0066DA"/>
                            <path d="M43.65 53v25l13.3-23H43.65z" fill="#EA4335"/>
                          </svg>
                          Drive
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
                      style={{ background: `${STATUS_COLOR[task.status]}20`, color: STATUS_COLOR[task.status] }}
                    >
                      {STATUS_LABEL[task.status] || task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-semibold" style={{ color: PRIORITY_COLOR[task.priority] || '#94A3B8' }}>
                      {task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <AvatarStack ids={taskAssigneeIds} team={team} size={20} max={3} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-mono text-slate-500">{task.due_date ? fmtShort(task.due_date) : '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-slate-500">{design?.name || '—'}</span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {task.status !== 'done' ? (
                      <button
                        onClick={() => onUpdate(task.id, { status: 'done' })}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-all whitespace-nowrap"
                        style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                      >
                        ✓ Done
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold font-mono" style={{ color: '#10B981' }}>✓ Done</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editModal && (
        <TaskEditModal
          task={editModal}
          team={team}
          designs={designs}
          projects={projects}
          onSave={(id, updates) => { onUpdate(id, updates); setEditModal(null); }}
          onDelete={onDelete}
          onClose={() => setEditModal(null)}
        />
      )}
    </>
  );
}

// ─── TaskBoard — unified Tasks tab ───
export default function TaskBoard({ tasks, team, designs, projects = [], onUpdate, onCreate, onDelete }) {
  const [view, setView] = useState('board');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [showDone, setShowDone] = useState(false);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Apply assignee filter (checks both legacy assignee_id and new assignee_ids array)
  let filtered = filterAssignee === 'all'
    ? tasks
    : tasks.filter(t => {
        const ids = Array.isArray(t.assignee_ids) && t.assignee_ids.length > 0
          ? t.assignee_ids.map(String)
          : (t.assignee_id ? [String(t.assignee_id)] : []);
        return ids.includes(String(filterAssignee));
      });
  const doneCount = filtered.filter(t => t.status === 'done').length;
  const visibleTasks = showDone ? filtered : filtered.filter(t => t.status !== 'done');

  const cols = showDone ? COLUMNS : COLUMNS.filter(c => c.id !== 'done');

  const handleDrop = (colId, e) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = parseInt(e.dataTransfer.getData('text/plain'));
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== colId) onUpdate(taskId, { status: colId });
  };

  return (
    <div>
      {/* ── Title + View Dropdown ── */}
      <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">The GARRET Board</h1>
          <p className="text-[11px] sm:text-[12px] text-slate-400 font-mono mt-0.5 tracking-wide hidden sm:block">Grid for Agile Resources, Review, and Execution Tracking</p>
        </div>
        <ViewDropdown
          view={view}
          options={[
            { value: 'board', label: 'View: Board' },
            { value: 'timeline', label: 'View: Timeline' },
            { value: 'table', label: 'View: Table' },
          ]}
          onChange={setView}
        />
      </div>

      {/* ── Controls: New Task + Filter + Show Done ── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold text-white border-none cursor-pointer transition-colors flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #e85a22)' }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Task
        </button>
        {/* Email button — hidden on mobile to reduce clutter */}
        <button
          onClick={() => openWeeklySummaryEmail({ tasks, team })}
          title="Generate a weekly summary email of all current tasks"
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border cursor-pointer transition-colors"
          style={{ background: '#fff', borderColor: '#E2E8F0', color: '#475569' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#EA4335"/>
          </svg>
          Email Weekly Summary
        </button>

        {/* Assignee filter — <select> on mobile, pill buttons on desktop */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-mono">Filter:</span>
          {/* Mobile: compact dropdown */}
          <select
            className="sm:hidden text-xs font-semibold rounded-lg px-2 py-1.5 border cursor-pointer bg-white"
            style={{
              borderColor: '#E2E8F0',
              color: String(filterAssignee) === 'all' ? '#64748B' : '#FF6B35',
              outline: 'none',
            }}
            value={String(filterAssignee)}
            onChange={e => setFilterAssignee(e.target.value)}
          >
            <option value="all">Everyone</option>
            {team.map(m => (
              <option key={m.id} value={String(m.id)}>{m.name.split(' ')[0]}</option>
            ))}
          </select>
          {/* Desktop: pill buttons */}
          <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
            {[{ id: 'all', label: 'Everyone' }, ...team.map(m => ({ id: m.id, label: m.name.split(' ')[0] }))].map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilterAssignee(opt.id)}
                className="px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                style={{
                  border: '1px solid',
                  borderColor: String(filterAssignee) === String(opt.id) ? '#FF6B35' : '#E8ECF0',
                  background: String(filterAssignee) === String(opt.id) ? 'rgba(255,107,53,0.06)' : '#fff',
                  color: String(filterAssignee) === String(opt.id) ? '#FF6B35' : '#64748B',
                }}
              >
                {opt.id !== 'all' && <Avatar member={team.find(m => m.id === opt.id)} size={18} />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto">
          <Toggle checked={showDone} onChange={setShowDone} label={`Show completed (${doneCount})`} />
        </div>
      </div>

      {/* ── Board View ── */}
      {view === 'board' && (
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(160px, 1fr))` }}>
          {cols.map(col => {
            const colTasks = visibleTasks.filter(t => t.status === col.id);
            const isOver = dragOverCol === col.id;
            return (
              <div key={col.id} className="min-w-[160px]">
                <div className="flex items-center gap-2 mb-2.5 px-0.5">
                  <span className="text-xs font-bold text-slate-500 font-mono uppercase tracking-wider">{col.label}</span>
                  <span className="text-[11px] text-slate-400 font-mono bg-slate-100 px-1.5 rounded-lg">{colTasks.length}</span>
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={e => handleDrop(col.id, e)}
                  className="rounded-xl p-1.5 min-h-[280px] transition-all"
                  style={{
                    background: isOver ? 'rgba(255,107,53,0.04)' : '#F8FAFC',
                    border: isOver ? '2px dashed #FF6B35' : '1px solid #F1F5F9',
                  }}
                >
                  {colTasks.map(task => (
                    <KanbanCard key={task.id} task={task} team={team} designs={designs} projects={projects} onUpdate={onUpdate} onDelete={onDelete} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}

      {/* ── Timeline View ── */}
      {view === 'timeline' && (
        <TimelineView
          tasks={visibleTasks}
          team={team}
          designs={designs}
          onUpdate={onUpdate}
          onCreate={onCreate}
          onDelete={onDelete}
          hideControls
        />
      )}

      {/* ── Table View ── */}
      {view === 'table' && (
        <TaskTableView
          tasks={visibleTasks}
          team={team}
          designs={designs}
          projects={projects}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}

      {showCreateModal && (
        <TaskCreateModal team={team} designs={designs} projects={projects} onCreate={onCreate} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
