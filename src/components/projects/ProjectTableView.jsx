import { useState } from 'react';
import { Avatar, PriorityDot } from '../shared/UI';

const STATUS_LABELS = {
  planning: { label: 'Planning', color: '#94A3B8' },
  active: { label: 'Active', color: '#FF6B35' },
  on_hold: { label: 'On Hold', color: '#F59E0B' },
  complete: { label: 'Complete', color: '#10B981' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtBudget(b) {
  if (b == null) return '—';
  return '$' + Number(b).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function ProjectTableView({ projects, team, tasks, onOpenDetail }) {
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const computeProgress = (project) => {
    const pt = tasks.filter(t => Number(t.project_id) === Number(project.id));
    const done = pt.filter(t => t.status === 'done').length;
    return pt.length > 0 ? Math.round(done / pt.length * 100) : 0;
  };

  const sorted = [...projects].sort((a, b) => {
    let av = sortKey === 'progress' ? computeProgress(a) : (a[sortKey] ?? '');
    let bv = sortKey === 'progress' ? computeProgress(b) : (b[sortKey] ?? '');
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    return sortDir === 'asc' ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
  });

  const SortIcon = ({ k }) => (
    <span className="ml-1 text-[9px]" style={{ color: sortKey === k ? '#FF6B35' : '#CBD5E1' }}>
      {sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

  const thClass = "text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono pb-2 px-3 cursor-pointer hover:text-slate-600 select-none whitespace-nowrap";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            <th className={thClass} onClick={() => handleSort('name')}>Project<SortIcon k="name" /></th>
            <th className={thClass} onClick={() => handleSort('client')}>Client<SortIcon k="client" /></th>
            <th className={thClass} onClick={() => handleSort('status')}>Status<SortIcon k="status" /></th>
            <th className={thClass} onClick={() => handleSort('priority')}>Pri<SortIcon k="priority" /></th>
            <th className={thClass} onClick={() => handleSort('due_date')}>Due<SortIcon k="due_date" /></th>
            <th className={thClass} onClick={() => handleSort('progress')}>Progress<SortIcon k="progress" /></th>
            <th className={thClass}>Lead</th>
            <th className={thClass}>Tasks</th>
            <th className={thClass} onClick={() => handleSort('budget')}>Budget<SortIcon k="budget" /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center py-12 text-slate-400 text-sm">No projects yet</td>
            </tr>
          )}
          {sorted.map((project, i) => {
            const lead = team.find(m => m.id === project.lead_id);
            const projectTasks = tasks.filter(t => Number(t.project_id) === Number(project.id));
            const doneTasks = projectTasks.filter(t => t.status === 'done').length;
            const progress = projectTasks.length > 0 ? Math.round(doneTasks / projectTasks.length * 100) : 0;
            const status = STATUS_LABELS[project.status] || { label: project.status, color: '#94A3B8' };
            const isOverdue = project.due_date && new Date(project.due_date) < new Date() && project.status !== 'complete';

            return (
              <tr
                key={project.id}
                onClick={() => onOpenDetail(project)}
                className="border-b border-slate-100 hover:bg-orange-50 cursor-pointer transition-colors"
                style={{ background: i % 2 === 0 ? undefined : '#FAFAFA' }}
              >
                <td className="px-3 py-3">
                  <div className="text-[13px] font-semibold text-slate-900">{project.name}</div>
                  {project.drive_file_url && (
                    <span className="text-[10px] text-blue-500 font-mono">📁 Drive</span>
                  )}
                </td>
                <td className="px-3 py-3 text-[12px] text-slate-500">{project.client || '—'}</td>
                <td className="px-3 py-3">
                  <span
                    className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md"
                    style={{ background: `${status.color}18`, color: status.color }}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <PriorityDot priority={project.priority} />
                </td>
                <td className="px-3 py-3 text-[12px] font-mono" style={{ color: isOverdue ? '#EF4444' : '#64748B' }}>
                  {fmtDate(project.due_date)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2 min-w-[80px]">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${progress}%`,
                          background: project.status === 'complete' || progress === 100 ? '#10B981' : '#FF6B35',
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 font-mono w-7 text-right">
                      {progress}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {lead ? <Avatar member={lead} size={22} /> : <span className="text-slate-300 text-sm">—</span>}
                </td>
                <td className="px-3 py-3 text-[12px] font-mono text-slate-500">
                  {projectTasks.length > 0 ? `${doneTasks}/${projectTasks.length}` : '—'}
                </td>
                <td className="px-3 py-3 text-[12px] font-mono text-slate-500">{fmtBudget(project.budget)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
