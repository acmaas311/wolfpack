import { useState } from 'react';
import { Avatar, PriorityDot, formStyles } from '../shared/UI';
import ProjectModal from './ProjectModal';

const STATUS_LABELS = {
  planning: { label: 'Planning', color: '#94A3B8' },
  active: { label: 'Active', color: '#FF6B35' },
  on_hold: { label: 'On Hold', color: '#F59E0B' },
  complete: { label: 'Complete', color: '#10B981' },
};

const TASK_STATUS_LABEL = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done',
};

const TASK_STATUS_COLOR = {
  'todo': '#94A3B8',
  'in-progress': '#FF6B35',
  'review': '#F59E0B',
  'done': '#10B981',
};

const PRIORITY_COLOR = { high: '#EF4444', medium: '#F59E0B', normal: '#94A3B8', low: '#CBD5E1', urgent: '#EF4444' };

function fmtDate(d) {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtBudget(b) {
  if (b == null) return null;
  return '$' + Number(b).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProjectDetail({ project, team, tasks, onUpdate, onDelete, onBack }) {
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lead = team.find(m => m.id === project.lead_id);
  const projectTasks = tasks.filter(t => Number(t.project_id) === Number(project.id));
  const doneTasks = projectTasks.filter(t => t.status === 'done').length;
  const progress = projectTasks.length > 0 ? Math.round(doneTasks / projectTasks.length * 100) : 0;
  const status = STATUS_LABELS[project.status] || { label: project.status, color: '#94A3B8' };
  const isOverdue = project.due_date && new Date(project.due_date) < new Date() && project.status !== 'complete';

  const { label: lbl, input: inp } = formStyles;

  return (
    <div>
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-orange-500 transition-colors mb-5 bg-transparent border-none cursor-pointer"
      >
        ← Back to Projects
      </button>

      <div className="max-w-[800px]">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <PriorityDot priority={project.priority} />
              <span
                className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md"
                style={{ background: `${status.color}18`, color: status.color }}
              >
                {status.label}
              </span>
              {project.client && (
                <span className="text-[11px] text-slate-400 font-mono">{project.client}</span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">{project.name}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowEdit(true)}
              className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer bg-white transition-colors"
            >
              Edit
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-red-500 font-semibold">Delete?</span>
                <button
                  onClick={() => { onDelete(project.id); onBack(); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white border-none cursor-pointer"
                >Yes</button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 bg-white text-slate-500 cursor-pointer"
                >No</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3.5 py-2 rounded-lg border border-red-100 text-xs font-semibold text-red-400 hover:bg-red-50 cursor-pointer bg-white transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Left: main content */}
          <div className="space-y-5">
            {/* Description */}
            {project.description && (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className={lbl + ' mb-2'}>About</div>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{project.description}</p>
              </div>
            )}

            {/* Auto-calculated Progress */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={lbl}>Progress</div>
                <span className="text-lg font-extrabold font-mono" style={{ color: progress === 100 ? '#10B981' : '#FF6B35' }}>
                  {progress}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress}%`,
                    background: progress === 100 ? '#10B981' : '#FF6B35',
                  }}
                />
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {doneTasks} of {projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''} completed
              </div>
            </div>

            {/* Linked Tasks */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={lbl}>
                  Linked Tasks
                  {projectTasks.length > 0 && (
                    <span className="ml-2 text-orange-500">{doneTasks}/{projectTasks.length}</span>
                  )}
                </div>
              </div>
              {projectTasks.length === 0 ? (
                <p className="text-sm text-slate-400">No tasks linked to this project yet. Edit a task and link it here.</p>
              ) : (
                <div className="space-y-2">
                  {projectTasks.map(task => {
                    const assignee = team.find(m => m.id === task.assignee_id);
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100"
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: TASK_STATUS_COLOR[task.status] || '#94A3B8' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-slate-900 truncate">{task.title}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {TASK_STATUS_LABEL[task.status] || task.status}
                          </div>
                        </div>
                        {assignee && <Avatar member={assignee} size={20} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: meta panel */}
          <div className="space-y-4">
            {/* Key details */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
              <MetaRow label="Team Lead">
                {lead ? (
                  <div className="flex items-center gap-2">
                    <Avatar member={lead} size={20} />
                    <span className="text-sm text-slate-700">{lead.name}</span>
                  </div>
                ) : <span className="text-slate-400 text-sm">Unassigned</span>}
              </MetaRow>

              <MetaRow label="Due Date">
                <span className={`text-sm ${isOverdue ? 'text-red-500 font-semibold' : 'text-slate-700'}`}>
                  {fmtDate(project.due_date) || '—'}
                  {isOverdue && ' ⚠'}
                </span>
              </MetaRow>

              <MetaRow label="Budget">
                <span className="text-sm text-slate-700">{fmtBudget(project.budget) || '—'}</span>
              </MetaRow>

              <MetaRow label="Priority">
                <div className="flex items-center gap-1.5">
                  <PriorityDot priority={project.priority} />
                  <span className="text-sm text-slate-700 capitalize">{project.priority}</span>
                </div>
              </MetaRow>
            </div>

            {/* Google Drive file */}
            {project.drive_file_url && (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className={lbl + ' mb-2.5'}>
                  <span className="mr-1.5">📁</span>Drive File
                </div>
                <a
                  href={project.drive_file_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors no-underline"
                >
                  <span className="text-[13px] text-blue-700 font-medium truncate">
                    {project.drive_file_name || 'Open Drive File'}
                  </span>
                  <span className="text-blue-400 text-xs ml-auto flex-shrink-0">↗</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <ProjectModal
          project={project}
          team={team}
          onUpdate={onUpdate}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}

function MetaRow({ label, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1">{label}</div>
      {children}
    </div>
  );
}
