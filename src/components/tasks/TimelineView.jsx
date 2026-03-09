import { useState } from 'react';
import { Card, Avatar, PriorityDot, StatusPill, Toggle, Overlay, formStyles } from '../shared/UI';
import TaskEditModal from './TaskEditModal';
import { notifySlack } from '../../lib/slack';

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];
const PRIORITIES = ['high', 'medium', 'low'];
const CATEGORIES = ['design', 'operations', 'marketing', 'finance'];

// ─── Date Helpers ───
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtLane(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
}

function fmtShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

// Build the 9 fixed lanes: Overdue, Today, +1..+5, Later, No Date
function buildLanes(today) {
  const lanes = [
    { key: '__overdue__', label: 'Overdue', type: 'overdue', droppable: false },
    { key: today, label: `Today — ${fmtLane(today)}`, type: 'today', droppable: true },
  ];
  for (let i = 1; i <= 5; i++) {
    const d = addDaysStr(today, i);
    lanes.push({ key: d, label: fmtLane(d), type: 'future', droppable: true });
  }
  lanes.push({ key: '__later__', label: 'Later (beyond 5 days)', type: 'later', droppable: false });
  lanes.push({ key: '__nodate__', label: 'No Due Date', type: 'none', droppable: true });
  return lanes;
}

function getLaneKey(task, today, day5) {
  if (!task.due_date) return '__nodate__';
  if (task.due_date < today) return '__overdue__';
  if (task.due_date > day5) return '__later__';
  return task.due_date;
}

// ─── New Task Modal ───
function TaskCreateModal({ team, designs, onCreate, onClose }) {
  const [form, setForm] = useState({
    title: '', description: '', assignee_id: null, due_date: '',
    status: 'todo', priority: 'medium', category: 'design', design_id: null,
  });
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const { label: lbl, input: inp, btnPrimary: bp, btnSecondary: bs } = formStyles;

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    const created = await onCreate({
      ...form,
      assignee_id: form.assignee_id || null,
      due_date: form.due_date || null,
      design_id: form.design_id ? parseInt(form.design_id) : null,
    });
    // Notify Slack about the new task (fire-and-forget)
    if (created) {
      const assignee = team.find(m => m.id === created.assignee_id);
      notifySlack('task_created', { task: created, assigneeName: assignee?.name || null });
    }
    onClose();
  };

  return (
    <Overlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[480px] max-h-[85vh] overflow-auto shadow-2xl border border-slate-200">
        <div className="px-6 pt-5 pb-3.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">New Task</span>
          <button onClick={onClose} className="text-lg text-slate-400 hover:bg-slate-100 px-2 py-0.5 rounded-md cursor-pointer">×</button>
        </div>
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
              <label className={lbl}>Assignee</label>
              <select value={form.assignee_id || ''} onChange={e => upd('assignee_id', e.target.value || null)} className={inp}>
                <option value="">Unassigned</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
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
          <div className="flex gap-2.5 justify-end">
            <button onClick={onClose} className={bs}>Cancel</button>
            <button onClick={handleCreate} disabled={!form.title.trim()} className={bp} style={{ opacity: form.title.trim() ? 1 : 0.5 }}>
              Create Task
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Timeline View ───
export default function TimelineView({ tasks, team, designs, onUpdate, onCreate, onDelete, hideControls = false }) {
  const [showDone, setShowDone] = useState(false);
  const [dragOverLane, setDragOverLane] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const today = getTodayStr();
  const day5 = addDaysStr(today, 5);
  const lanes = buildLanes(today);

  const doneCount = tasks.filter(t => t.status === 'done').length;
  // When hideControls=true, parent has already applied the showDone filter — use tasks directly
  const visible = hideControls ? tasks : (showDone ? tasks : tasks.filter(t => t.status !== 'done'));

  // Bucket tasks into lanes
  const laneMap = {};
  lanes.forEach(l => { laneMap[l.key] = []; });
  visible.forEach(t => {
    const k = getLaneKey(t, today, day5);
    if (laneMap[k] !== undefined) laneMap[k].push(t);
  });

  const handleDrop = (lane, e) => {
    e.preventDefault();
    setDragOverLane(null);
    if (!lane.droppable) return;
    const id = parseInt(e.dataTransfer.getData('text/plain'));
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newDue = lane.key === '__nodate__' ? null : lane.key;
    if (task.due_date !== newDue) onUpdate(task.id, { due_date: newDue });
  };

  const dotColor = type => ({ overdue: '#EF4444', today: '#FF6B35', future: '#1D428A', later: '#94A3B8', none: '#CBD5E1' }[type]);
  const labelColor = type => ({ overdue: '#EF4444', today: '#FF6B35', future: '#1E293B', later: '#94A3B8', none: '#94A3B8' }[type]);

  return (
    <div className="max-w-[720px]">
      {/* Top bar — hidden when embedded inside unified TaskBoard (hideControls=true) */}
      {!hideControls && (
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold text-white border-none cursor-pointer transition-colors"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #e85a22)' }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Task
          </button>
          <Toggle checked={showDone} onChange={setShowDone} label={`Show completed (${doneCount})`} />
        </div>
      )}

      {/* Lanes */}
      {lanes.map(lane => {
        const laneTasks = laneMap[lane.key] || [];
        const isOver = dragOverLane === lane.key && lane.droppable;

        return (
          <div key={lane.key} className="mb-6">
            {/* Lane header */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{
                  background: dotColor(lane.type),
                  boxShadow: lane.type === 'today' ? '0 0 0 3px rgba(255,107,53,0.18)'
                    : lane.type === 'overdue' ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none',
                }}
              />
              <span className="text-sm font-bold" style={{ color: labelColor(lane.type) }}>
                {lane.label}
              </span>
              {lane.type === 'today' && <StatusPill label="Today" color="#FF6B35" />}
              {lane.type === 'overdue' && laneTasks.length > 0 && (
                <StatusPill label={`${laneTasks.length} overdue`} color="#EF4444" />
              )}
              {laneTasks.length > 0 && (
                <span className="text-[11px] text-slate-300 font-mono ml-auto">{laneTasks.length}</span>
              )}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); if (lane.droppable) setDragOverLane(lane.key); }}
              onDragLeave={() => setDragOverLane(null)}
              onDrop={e => handleDrop(lane, e)}
              className="ml-5 pl-5 min-h-[44px] pb-1 transition-all"
              style={{
                borderLeft: isOver ? '3px dashed #FF6B35' : '2px solid #F1F5F9',
                background: isOver ? 'rgba(255,107,53,0.02)' : 'transparent',
                borderRadius: isOver ? '0 8px 8px 0' : 0,
              }}
            >
              {laneTasks.map(task => {
                const member = team.find(m => m.id === task.assignee_id);
                const isDone = task.status === 'done';
                return (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/plain', String(task.id)); e.currentTarget.style.opacity = '0.4'; }}
                    onDragEnd={e => { e.currentTarget.style.opacity = '1'; }}
                    onClick={() => setEditModal(task)}
                    className="mb-2"
                    style={{
                      padding: '12px 16px',
                      opacity: isDone ? 0.5 : 1,
                      borderLeft: `3px solid ${member?.color || '#E8ECF0'}`,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <PriorityDot priority={task.priority} />
                      <span
                        className="text-[13px] font-medium flex-1"
                        style={{ textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#94A3B8' : '#1E293B' }}
                      >
                        {task.title}
                      </span>
                      {/* Show specific date for overdue/later lanes */}
                      {task.due_date && (lane.type === 'overdue' || lane.type === 'later') && (
                        <span className="text-[10px] font-mono text-slate-400">{fmtShort(task.due_date)}</span>
                      )}
                      {member && (
                        <div className="flex items-center gap-1">
                          <Avatar member={member} size={22} />
                          <span className="text-[11px] text-slate-500 font-medium">{member.name.split(' ')[0]}</span>
                        </div>
                      )}
                      <StatusPill
                        label={COLUMNS.find(c => c.id === task.status)?.label || task.status}
                        color={task.status === 'done' ? '#10B981' : task.status === 'in-progress' ? '#FF6B35' : task.status === 'review' ? '#1D428A' : '#94A3B8'}
                      />
                    </div>
                  </Card>
                );
              })}
              {laneTasks.length === 0 && (
                <div className="text-[11px] text-slate-300 italic py-2 pl-1">
                  {lane.droppable ? 'Drop tasks here' : 'No tasks'}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {editModal && (
        <TaskEditModal
          task={editModal}
          team={team}
          designs={designs}
          onSave={(id, updates) => { onUpdate(id, updates); setEditModal(null); }}
          onDelete={onDelete}
          onClose={() => setEditModal(null)}
        />
      )}
      {showCreateModal && (
        <TaskCreateModal team={team} designs={designs} onCreate={onCreate} onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
