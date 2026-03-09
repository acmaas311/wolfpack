import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useTabGuard } from './hooks/useTabGuard';
import { useTeam, useTasks, useDesigns, useDecisions } from './hooks/useData';
import { useProjects } from './hooks/useProjects';
import LoginPage from './components/auth/LoginPage';
import TaskBoard from './components/tasks/TaskBoard';
import DesignPipeline from './components/designs/DesignPipeline';
import SalesDashboard from './components/sales/SalesDashboard';
import DecisionsView from './components/decisions/DecisionsView';
import ProjectsView from './components/projects/ProjectsView';
import { Avatar } from './components/shared/UI';

const TABS = [
  { id: 'board', label: 'Tasks' },
  { id: 'projects', label: 'Projects' },
  { id: 'sales', label: 'Sales' },
  { id: 'designs', label: 'Designs' },
  { id: 'decisions', label: 'Decisions' },
];

// ─── Full-screen loading spinner ───
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div
          className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center text-xl font-extrabold text-white animate-pulse"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #1D428A)' }}
        >
          W
        </div>
        <div className="text-sm text-slate-400">Loading...</div>
      </div>
    </div>
  );
}

// ─── Shown when multiple browser tabs have the app open ───
function MultipleInstancesScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center text-2xl font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #1D428A)' }}>
          W
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-2">Multiple Instances Open</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          Wolfpack Command Center is already open in another tab or window. Running multiple
          instances at the same time can cause data conflicts.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 font-mono mb-6">
          Close all other Wolfpack tabs — this tab will resume automatically.
        </div>
        <p className="text-[11px] text-slate-400">
          This page will unlock as soon as the other instance is closed.
        </p>
      </div>
    </div>
  );
}

// ─── Shown when a Google account is signed in but not registered as a team member ───
function NotATeamMemberScreen({ email, signOut }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-slate-200">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center text-2xl font-extrabold text-white"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #1D428A)' }}>
          W
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-2">Session Expired</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-3">
          Your session needs to be refreshed. Sign out and sign back in with:
        </p>
        <div className="bg-slate-100 rounded-lg px-4 py-2 text-sm font-mono text-slate-700 mb-5 break-all">
          {email}
        </div>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          This usually happens when the app hasn't been used in a while. Signing back in will restore full access.
          If this keeps happening, confirm your email is in the <span className="font-mono text-slate-700">team_members</span> table in Supabase.
        </p>
        <button
          onClick={signOut}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer border-none"
          style={{ background: 'linear-gradient(135deg, #FF6B35, #1D428A)' }}
        >
          Sign out &amp; sign back in
        </button>
      </div>
    </div>
  );
}

// ─── Authenticated app: data hooks only run after auth is confirmed ───
function AuthenticatedApp({ user, teamMember, signOut }) {
  // Must be called unconditionally (rules of hooks)
  const multipleOpen = useTabGuard();

  const { team, loading: teamLoading } = useTeam();
  const { tasks, loading: tasksLoading, updateTask, createTask, deleteTask } = useTasks();
  const { designs, loading: designsLoading, updateDesign, createDesign, deleteDesign } = useDesigns();
  const { decisions, loading: decisionsLoading, updateDecision, createDecision, deleteDecision } = useDecisions();
  const { projects, loading: projectsLoading, createProject, updateProject, deleteProject } = useProjects();

  const [activeTab, setActiveTab] = useState('board');

  // Block the UI if another tab has the app open
  if (multipleOpen) return <MultipleInstancesScreen />;

  const loading = teamLoading || tasksLoading || designsLoading || decisionsLoading || projectsLoading;

  const handleTaskUpdate = (id, updates) => updateTask(id, updates, teamMember?.id);
  const handleDesignUpdate = (id, updates) => updateDesign(id, updates, teamMember?.id);
  const handleDecisionUpdate = (id, updates) => updateDecision(id, updates);
  const handleDecisionCreate = (form) => createDecision(form, teamMember?.id);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="px-4 sm:px-7 py-3 sm:py-4 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div
            className="w-[30px] h-[30px] sm:w-[34px] sm:h-[34px] rounded-lg flex items-center justify-center text-sm sm:text-base font-extrabold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #1D428A)' }}
          >
            W
          </div>
          <div>
            <span className="text-[15px] sm:text-[17px] font-extrabold text-slate-900">Wolfpack</span>
            {/* Hide subtitle on small screens to save space */}
            <span className="hidden sm:inline text-[11px] text-slate-400 ml-2 font-mono">Command Center</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Team avatars — hidden on mobile to save header space */}
          <div className="hidden sm:flex items-center gap-1.5">
            {team.map(m => <Avatar key={m.id} member={m} size={28} />)}
          </div>
          {teamMember && (
            <div className="flex items-center gap-2 sm:ml-2 sm:pl-3 sm:border-l sm:border-slate-200">
              {/* Show first name only on mobile */}
              <span className="text-xs text-slate-500 hidden xs:inline sm:inline">{teamMember.name.split(' ')[0]}</span>
              <button
                onClick={signOut}
                className="text-[10px] sm:text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none font-mono px-2 py-1 rounded hover:bg-slate-100 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Tabs — horizontally scrollable on mobile */}
      <nav className="px-2 sm:px-7 bg-white border-b border-slate-200 flex sticky top-[53px] sm:top-[65px] z-10 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-3 sm:px-4 py-3 bg-transparent border-none cursor-pointer text-[12px] sm:text-[13px] font-semibold transition-all whitespace-nowrap flex-shrink-0"
            style={{
              color: activeTab === tab.id ? '#FF6B35' : '#94A3B8',
              borderBottom: activeTab === tab.id ? '2px solid #FF6B35' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="px-4 sm:px-7 py-4 sm:py-6 max-w-[1100px] mx-auto">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">Loading data...</div>
        ) : (
          <>
            {activeTab === 'board' && (
              <TaskBoard
                tasks={tasks}
                team={team}
                designs={designs}
                projects={projects}
                onUpdate={handleTaskUpdate}
                onCreate={createTask}
                onDelete={deleteTask}
              />
            )}
            {activeTab === 'projects' && (
              <ProjectsView
                projects={projects}
                team={team}
                tasks={tasks}
                onCreate={createProject}
                onUpdate={updateProject}
                onDelete={deleteProject}
              />
            )}
            {activeTab === 'sales' && <SalesDashboard />}
            {activeTab === 'designs' && (
              <DesignPipeline
                designs={designs}
                team={team}
                tasks={tasks}
                onUpdate={handleDesignUpdate}
                onCreate={createDesign}
                onDelete={deleteDesign}
              />
            )}
            {activeTab === 'decisions' && (
              <DecisionsView
                decisions={decisions}
                team={team}
                teamMember={teamMember}
                onUpdate={handleDecisionUpdate}
                onCreate={handleDecisionCreate}
                onDelete={deleteDecision}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Auth gate: renders the right screen based on auth state ───
export default function App() {
  const { user, teamMember, loading: authLoading, signOut } = useAuth();

  if (authLoading) return <LoadingScreen />;
  if (!user) return <LoginPage />;

  // Signed in with Google but email not in team_members — block access
  if (!teamMember) {
    return <NotATeamMemberScreen email={user.email} signOut={signOut} />;
  }

  return <AuthenticatedApp user={user} teamMember={teamMember} signOut={signOut} />;
}
