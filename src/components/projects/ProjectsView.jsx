import { useState } from 'react';
import ProjectBoard from './ProjectBoard';
import ProjectTableView from './ProjectTableView';
import ProjectDetail from './ProjectDetail';
import ProjectModal from './ProjectModal';

const VIEW_OPTIONS = [
  { value: 'board', label: '⊞ Board' },
  { value: 'table', label: '≡ Table' },
];

function ViewDropdown({ view, onChange }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={view}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
          padding: '6px 28px 6px 10px', borderRadius: 8,
          border: '1px solid #E8ECF0', background: '#fff',
          fontSize: 12, fontWeight: 600, color: '#64748B',
          cursor: 'pointer', outline: 'none',
        }}
      >
        {VIEW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 10, color: '#94A3B8' }}>▾</span>
    </div>
  );
}

export default function ProjectsView({ projects, team, tasks, onCreate, onUpdate, onDelete }) {
  const [view, setView] = useState('board');
  const [detailProject, setDetailProject] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // If viewing a detail page, render that instead
  if (detailProject) {
    // Keep the project fresh from the projects array
    const fresh = projects.find(p => p.id === detailProject.id) || detailProject;
    return (
      <ProjectDetail
        project={fresh}
        team={team}
        tasks={tasks}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onBack={() => setDetailProject(null)}
      />
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-bold text-slate-700">
            Projects
            <span className="ml-2 text-[12px] font-mono text-slate-400">{projects.length}</span>
          </h2>
          <ViewDropdown view={view} onChange={setView} />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-lg border-none cursor-pointer text-sm font-bold text-white transition-colors"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #e85a22)' }}
        >
          + New Project
        </button>
      </div>

      {/* View content */}
      {view === 'board' && (
        <ProjectBoard
          projects={projects}
          team={team}
          tasks={tasks}
          onOpenDetail={setDetailProject}
          onNewProject={() => setShowCreate(true)}
          onUpdate={onUpdate}
        />
      )}
      {view === 'table' && (
        <ProjectTableView
          projects={projects}
          team={team}
          tasks={tasks}
          onOpenDetail={setDetailProject}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <ProjectModal
          team={team}
          onCreate={onCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
