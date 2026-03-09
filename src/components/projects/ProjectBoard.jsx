import { Avatar, PriorityDot } from '../shared/UI';

const PROJECT_STATUSES = [
  { id: 'planning', label: 'Planning', color: '#94A3B8' },
  { id: 'active', label: 'Active', color: '#FF6B35' },
  { id: 'on_hold', label: 'On Hold', color: '#F59E0B' },
  { id: 'complete', label: 'Complete', color: '#10B981' },
];

function fmtDate(d) {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtBudget(b) {
  if (b == null) return null;
  return '$' + Number(b).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ProjectCard({ project, team, tasks, onClick }) {
  const lead = team.find(m => m.id === project.lead_id);
  const projectTasks = tasks.filter(t => Number(t.project_id) === Number(project.id));
  const doneTasks = projectTasks.filter(t => t.status === 'done').length;
  const progress = projectTasks.length > 0 ? Math.round(doneTasks / projectTasks.length * 100) : 0;
  const isOverdue = project.due_date && new Date(project.due_date) < new Date() && project.status !== 'complete';

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-px transition-all cursor-pointer p-4"
    >
      {/* Top row: priority + lead avatar */}
      <div className="flex items-start justify-between mb-2.5">
        <PriorityDot priority={project.priority} />
        {lead && <Avatar member={lead} size={24} />}
      </div>

      {/* Project name */}
      <div className="text-[14px] font-bold text-slate-900 mb-1 leading-snug">{project.name}</div>

      {/* Client */}
      {project.client && (
        <div className="text-[11px] text-slate-400 font-mono mb-3">{project.client}</div>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-slate-400 font-mono">Progress</span>
          <span className="text-[10px] font-bold text-slate-600 font-mono">{progress}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progress}%`,
              background: project.status === 'complete' || progress === 100 ? '#10B981' : '#FF6B35',
            }}
          />
        </div>
      </div>

      {/* Footer: due date + task count + budget */}
      <div className="flex items-center gap-2 flex-wrap">
        {project.due_date && (
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-md"
            style={{ background: isOverdue ? '#FEF2F2' : '#F1F5F9', color: isOverdue ? '#EF4444' : '#64748B' }}
          >
            {isOverdue ? '⚠ ' : ''}{fmtDate(project.due_date)}
          </span>
        )}
        {projectTasks.length > 0 && (
          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 bg-slate-50 rounded-md">
            {doneTasks}/{projectTasks.length} tasks
          </span>
        )}
        {project.budget != null && (
          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 bg-slate-50 rounded-md">
            {fmtBudget(project.budget)}
          </span>
        )}
        {project.drive_file_url && (
          <span className="text-[10px] font-mono text-blue-500 px-2 py-0.5 bg-blue-50 rounded-md">📁</span>
        )}
      </div>
    </div>
  );
}

export default function ProjectBoard({ projects, team, tasks, onOpenDetail, onNewProject }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-5 min-w-[820px] pb-4">
        {PROJECT_STATUSES.map(col => {
          const colProjects = projects.filter(p => p.status === col.id);
          return (
            <div key={col.id} className="flex-1 min-w-[200px]">
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: col.color }}
                  />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    {col.label}
                  </span>
                  <span
                    className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md"
                    style={{ background: `${col.color}18`, color: col.color }}
                  >
                    {colProjects.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="space-y-2.5">
                {colProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    team={team}
                    tasks={tasks}
                    onClick={() => onOpenDetail(project)}
                  />
                ))}
                {/* Add new project in Planning column */}
                {col.id === 'planning' && (
                  <button
                    onClick={onNewProject}
                    className="w-full py-2.5 border border-dashed border-slate-200 rounded-xl text-[12px] text-slate-400 hover:border-orange-300 hover:text-orange-400 hover:bg-orange-50 transition-all cursor-pointer bg-transparent"
                  >
                    + New Project
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
