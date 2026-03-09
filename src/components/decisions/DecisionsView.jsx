import { useState } from 'react';
import { Card, Avatar, SectionLabel, StatusPill, Overlay, formStyles } from '../shared/UI';

// ─── View Dropdown ───
function ViewDropdown({ view, options, onChange }) {
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
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 10, color: '#94A3B8' }}>▾</span>
    </div>
  );
}

const VOTE_TYPES = [
  { id: 'unanimous', label: 'Unanimous (all must agree)' },
  { id: 'majority', label: 'Majority (50%+)' },
  { id: 'role-owner', label: 'Role Owner decides' },
];

const VOTE_OPTIONS = ['yes', 'no', 'abstain'];

function resultColor(r) {
  return r === 'Approved' ? '#10B981' : r === 'Rejected' ? '#EF4444' : r === 'Tabled' ? '#94A3B8' : '#F59E0B';
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Auto-compute result from votes
function computeResult(votes, voteType, totalMembers) {
  const vals = Object.values(votes || {});
  const yes = vals.filter(v => v === 'yes').length;
  const no = vals.filter(v => v === 'no').length;

  if (voteType === 'unanimous') {
    if (no > 0) return 'Rejected';
    if (yes === totalMembers) return 'Approved';
    return 'Pending';
  }
  if (voteType === 'majority') {
    const needed = Math.ceil(totalMembers / 2);
    if (yes >= needed) return 'Approved';
    if (no >= needed) return 'Rejected';
    return 'Pending';
  }
  // role-owner: result must be set manually
  return null;
}

// ─── Proposal Modal (New / Edit) ───
function ProposalModal({ decision, isNew, onSave, onClose }) {
  const [form, setForm] = useState(
    decision
      ? {
          title: decision.title,
          description: decision.description || '',
          decision_date: decision.decision_date,
          vote_type: decision.vote_type,
          result: decision.result,
        }
      : {
          title: '',
          description: '',
          decision_date: new Date().toISOString().slice(0, 10),
          vote_type: 'majority',
          result: 'Pending',
        }
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const { label: lbl, input: inp, btnPrimary: bp, btnSecondary: bs } = formStyles;

  const handleSave = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(decision?.id, { ...form, votes: decision?.votes || {} });
      onClose();
    } catch (err) {
      setSaveError(err?.message || 'Save failed — unknown error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[480px] max-h-[85vh] overflow-auto shadow-2xl border border-slate-200">
        <div className="px-6 pt-5 pb-3.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            {isNew ? 'New Proposal' : 'Edit Proposal'}
          </span>
          <button onClick={onClose} className="text-lg text-slate-400 hover:bg-slate-100 px-2 py-0.5 rounded-md cursor-pointer">×</button>
        </div>
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-mono break-all">
            ⚠️ {saveError}
          </div>
        )}
        <div className="p-6">
          <div className="mb-5">
            <label className={lbl}>Proposal / Decision</label>
            <input
              value={form.title}
              onChange={e => upd('title', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="What needs to be decided?"
              className={inp}
              autoFocus
            />
          </div>
          <div className="mb-5">
            <label className={lbl}>Description / Context</label>
            <textarea
              value={form.description}
              onChange={e => upd('description', e.target.value)}
              placeholder="Background info, options considered, trade-offs…"
              rows={3}
              className={`${inp} resize-y min-h-[72px]`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
            <div>
              <label className={lbl}>Date</label>
              <input type="date" value={form.decision_date} onChange={e => upd('decision_date', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Vote Type</label>
              <select value={form.vote_type} onChange={e => upd('vote_type', e.target.value)} className={inp}>
                {VOTE_TYPES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {form.vote_type === 'role-owner' && (
            <div className="mb-5">
              <label className={lbl}>Result (role-owner decides manually)</label>
              <select value={form.result} onChange={e => upd('result', e.target.value)} className={inp}>
                {['Pending', 'Approved', 'Rejected', 'Tabled'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2.5 justify-end">
            <button onClick={onClose} className={bs}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={!form.title.trim() || saving}
              className={bp}
              style={{ opacity: (form.title.trim() && !saving) ? 1 : 0.5 }}
            >
              {saving ? 'Saving…' : isNew ? 'Create Proposal' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Single Decision Card ───
function DecisionCard({ decision, team, teamMember, onVote, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const votes = decision.votes || {};
  const computedResult = decision.vote_type !== 'role-owner'
    ? computeResult(votes, decision.vote_type, team.length)
    : decision.result;

  const myVote = teamMember ? votes[teamMember.id] : null;

  const handleVote = (voteVal) => {
    if (!teamMember) return;
    const newVotes = { ...votes, [teamMember.id]: voteVal };
    const newResult = decision.vote_type !== 'role-owner'
      ? computeResult(newVotes, decision.vote_type, team.length)
      : decision.result;
    onVote(decision.id, { votes: newVotes, result: newResult || decision.result });
  };

  const voteButtonStyle = (v) => {
    const isActive = myVote === v;
    const colors = {
      yes: { active: '#10B981', bg: 'rgba(16,185,129,0.1)', border: '#10B981', text: '#10B981' },
      no: { active: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: '#EF4444', text: '#EF4444' },
      abstain: { active: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: '#94A3B8', text: '#94A3B8' },
    };
    const c = colors[v];
    return {
      padding: '4px 10px',
      borderRadius: 6,
      border: `1px solid ${isActive ? c.border : '#E2E8F0'}`,
      background: isActive ? c.bg : '#F8FAFC',
      color: isActive ? c.text : '#94A3B8',
      fontSize: 11,
      fontWeight: isActive ? 700 : 500,
      cursor: 'pointer',
      transition: 'all 0.15s',
      fontFamily: 'monospace',
    };
  };

  return (
    <Card className="px-5 py-4 mb-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-900 leading-snug">{decision.title}</div>
          {decision.description && (
            <div className="text-xs text-slate-500 mt-1 leading-relaxed">{decision.description}</div>
          )}
          <div className="text-[10px] text-slate-400 font-mono mt-1.5">
            {fmtDate(decision.decision_date)} · {VOTE_TYPES.find(v => v.id === decision.vote_type)?.label || decision.vote_type}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusPill label={computedResult || 'Pending'} color={resultColor(computedResult || 'Pending')} />
          <button
            onClick={() => onEdit(decision)}
            className="text-[10px] text-slate-400 hover:text-slate-600 px-2 py-1 rounded border border-slate-200 bg-white cursor-pointer font-mono"
          >
            Edit
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onDelete(decision.id)}
                className="px-2.5 py-1 rounded text-[10px] font-bold bg-red-500 text-white border-none cursor-pointer hover:bg-red-600"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] text-slate-400 hover:text-slate-600 px-2 py-1 rounded border border-slate-200 bg-white cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-sm text-slate-300 hover:text-red-500 px-1.5 py-0.5 rounded cursor-pointer bg-transparent border-none transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Vote Tally */}
      <div className="flex items-center gap-3 mb-3">
        {team.map(member => {
          const v = votes[member.id];
          const dotColor = v === 'yes' ? '#10B981' : v === 'no' ? '#EF4444' : v === 'abstain' ? '#94A3B8' : '#E2E8F0';
          return (
            <div key={member.id} className="flex flex-col items-center gap-1">
              <div className="relative">
                <Avatar member={member} size={26} />
                {v && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white flex items-center justify-center"
                    style={{ background: dotColor, fontSize: 6, color: '#fff', fontWeight: 900 }}
                  >
                    {v === 'yes' ? '✓' : v === 'no' ? '✗' : '–'}
                  </div>
                )}
              </div>
              <span className="text-[9px] text-slate-400 font-mono">{member.name.split(' ')[0]}</span>
            </div>
          );
        })}
        <div className="flex-1" />
        {/* Vote counts */}
        <div className="flex gap-3 text-[10px] font-mono">
          <span style={{ color: '#10B981' }}>{Object.values(votes).filter(v => v === 'yes').length} yes</span>
          <span style={{ color: '#EF4444' }}>{Object.values(votes).filter(v => v === 'no').length} no</span>
          <span style={{ color: '#94A3B8' }}>{Object.values(votes).filter(v => v === 'abstain').length} abstain</span>
        </div>
      </div>

      {/* My Vote Buttons */}
      {teamMember && (
        <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
          <span className="text-[10px] text-slate-400 font-mono mr-1">Your vote:</span>
          {VOTE_OPTIONS.map(v => (
            <button key={v} onClick={() => handleVote(v)} style={voteButtonStyle(v)}>
              {v === 'yes' ? '👍 Yes' : v === 'no' ? '👎 No' : '— Abstain'}
            </button>
          ))}
          {myVote && (
            <button
              onClick={() => {
                const newVotes = { ...votes };
                delete newVotes[teamMember.id];
                const newResult = decision.vote_type !== 'role-owner'
                  ? computeResult(newVotes, decision.vote_type, team.length)
                  : decision.result;
                onVote(decision.id, { votes: newVotes, result: newResult || decision.result });
              }}
              className="text-[9px] text-slate-300 hover:text-red-400 cursor-pointer bg-transparent border-none font-mono ml-1"
            >
              clear
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Decision Table View ───
function DecisionTableView({ decisions, team, teamMember, onEdit }) {
  const [sortKey, setSortKey] = useState('decision_date');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(dir => dir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const RESULT_ORDER = { 'Approved': 0, 'Pending': 1, 'Tabled': 2, 'Rejected': 3 };

  const sorted = [...decisions].sort((a, b) => {
    let av, bv;
    if (sortKey === 'result') {
      const ra = computeResult(a.votes || {}, a.vote_type, team.length) || 'Pending';
      const rb = computeResult(b.votes || {}, b.vote_type, team.length) || 'Pending';
      av = RESULT_ORDER[ra] ?? 99; bv = RESULT_ORDER[rb] ?? 99;
    } else if (sortKey === 'votes') {
      av = Object.values(a.votes || {}).filter(v => v === 'yes').length;
      bv = Object.values(b.votes || {}).filter(v => v === 'yes').length;
    } else {
      av = (a[sortKey] ?? '').toString().toLowerCase();
      bv = (b[sortKey] ?? '').toString().toLowerCase();
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const thStyle = {
    padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
    color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '2px solid #F1F5F9', whiteSpace: 'nowrap',
    cursor: 'pointer', userSelect: 'none',
  };
  const thActive = { ...thStyle, color: '#64748B' };
  const SortIcon = ({ k }) => (
    <span style={{ marginLeft: 4, fontSize: 9, color: sortKey === k ? '#FF6B35' : '#CBD5E1' }}>
      {sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );
  const tdStyle = {
    padding: '10px 12px', fontSize: 12, color: '#1E293B',
    borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle',
  };

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #F1F5F9', background: '#fff' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
        <thead>
          <tr style={{ background: '#FAFBFC' }}>
            <th style={sortKey === 'title' ? thActive : thStyle} onClick={() => handleSort('title')}>Proposal<SortIcon k="title" /></th>
            <th style={sortKey === 'decision_date' ? thActive : thStyle} onClick={() => handleSort('decision_date')}>Date<SortIcon k="decision_date" /></th>
            <th style={sortKey === 'vote_type' ? thActive : thStyle} onClick={() => handleSort('vote_type')}>Vote Type<SortIcon k="vote_type" /></th>
            <th style={sortKey === 'result' ? thActive : thStyle} onClick={() => handleSort('result')}>Result<SortIcon k="result" /></th>
            <th style={{ ...(sortKey === 'votes' ? thActive : thStyle), textAlign: 'center' }} onClick={() => handleSort('votes')}>Votes<SortIcon k="votes" /></th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#94A3B8', padding: '40px 12px', fontStyle: 'italic' }}>
                No proposals yet.
              </td>
            </tr>
          ) : (
            sorted.map((d, i) => {
              const votes = d.votes || {};
              const yesCount = Object.values(votes).filter(v => v === 'yes').length;
              const noCount = Object.values(votes).filter(v => v === 'no').length;
              const abstainCount = Object.values(votes).filter(v => v === 'abstain').length;
              const computedResult = d.vote_type !== 'role-owner'
                ? computeResult(votes, d.vote_type, team.length)
                : d.result;
              const result = computedResult || 'Pending';
              const shortDesc = d.description
                ? (d.description.length > 60 ? d.description.slice(0, 60) + '…' : d.description)
                : null;

              return (
                <tr
                  key={d.id}
                  onClick={() => onEdit(d)}
                  style={{
                    background: i % 2 === 0 ? '#fff' : '#FAFBFC',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFF5F0'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFBFC'}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: shortDesc ? 2 : 0 }}>{d.title}</div>
                    {shortDesc && <div style={{ fontSize: 11, color: '#94A3B8' }}>{shortDesc}</div>}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                    {fmtDate(d.decision_date)}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11, color: '#64748B' }}>
                    {VOTE_TYPES.find(v => v.id === d.vote_type)?.label?.split(' ')[0] || d.vote_type}
                  </td>
                  <td style={tdStyle}>
                    <StatusPill label={result} color={resultColor(result)} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', fontFamily: 'monospace', fontSize: 11 }}>
                      <span style={{ color: '#10B981' }}>{yesCount}✓</span>
                      <span style={{ color: '#EF4444' }}>{noCount}✗</span>
                      <span style={{ color: '#94A3B8' }}>{abstainCount}–</span>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Decisions View ───
export default function DecisionsView({ decisions, team = [], teamMember, onUpdate, onCreate, onDelete }) {
  const [proposalModal, setProposalModal] = useState(null); // null | 'new' | decision object
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [view, setView] = useState('voting');

  const handleSave = async (id, form) => {
    if (id) {
      return onUpdate(id, form);
    } else {
      return onCreate(form);
    }
  };

  const handleVote = (id, updates) => {
    onUpdate(id, updates);
  };

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'Pending', label: 'Pending' },
    { id: 'Approved', label: 'Approved' },
    { id: 'Rejected', label: 'Rejected' },
    { id: 'Tabled', label: 'Tabled' },
  ];

  const visible = filter === 'all' ? decisions : decisions.filter(d => {
    const r = d.vote_type !== 'role-owner'
      ? computeResult(d.votes || {}, d.vote_type, team.length)
      : d.result;
    return (r || 'Pending') === filter;
  });

  const pendingCount = decisions.filter(d => {
    const r = d.vote_type !== 'role-owner'
      ? computeResult(d.votes || {}, d.vote_type, team.length)
      : d.result;
    return (r || 'Pending') === 'Pending';
  }).length;

  return (
    <div className="max-w-[720px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Voting Dashboard</h2>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            {pendingCount > 0 ? `${pendingCount} open vote${pendingCount > 1 ? 's' : ''} awaiting decision` : 'All decisions resolved'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <ViewDropdown
            view={view}
            options={[{ value: 'voting', label: 'View: Voting' }, { value: 'table', label: 'View: Table' }]}
            onChange={setView}
          />
          <button
            onClick={() => setProposalModal('new')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-bold text-white border-none cursor-pointer transition-colors"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #e85a22)' }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Proposal
          </button>
        </div>
      </div>

      {/* Table view */}
      {view === 'table' && (
        <DecisionTableView
          decisions={visible}
          team={team}
          teamMember={teamMember}
          onEdit={(dec) => setProposalModal(dec)}
        />
      )}

      {/* Voting view */}
      {view === 'voting' && (
        <>
          {/* Filter pills */}
          <div className="flex items-center gap-1.5 mb-5 flex-wrap">
            {filterOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilter(opt.id)}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                style={{
                  border: '1px solid',
                  borderColor: filter === opt.id ? '#FF6B35' : '#E8ECF0',
                  background: filter === opt.id ? 'rgba(255,107,53,0.06)' : '#fff',
                  color: filter === opt.id ? '#FF6B35' : '#64748B',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Decision Cards */}
          {visible.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
              {filter === 'all' ? 'No proposals yet — click "+ New Proposal" to start.' : `No ${filter.toLowerCase()} decisions.`}
            </div>
          ) : (
            visible.map(d => (
              <DecisionCard
                key={d.id}
                decision={d}
                team={team}
                teamMember={teamMember}
                onVote={handleVote}
                onEdit={(dec) => setProposalModal(dec)}
                onDelete={onDelete}
              />
            ))
          )}
        </>
      )}

      {/* Spending Authority */}
      <div className="mt-8">
        <SectionLabel>Spending Authority</SectionLabel>
        <div className="flex flex-col gap-2 mt-3 mb-8">
          {[
            { range: 'Under $500', rule: 'Role owner decides', color: '#10B981' },
            { range: '$500 – $2,000', rule: 'Majority vote (3 of 4)', color: '#F59E0B' },
            { range: 'Over $2,000', rule: 'Unanimous (all 4)', color: '#EF4444' },
          ].map((s, i) => (
            <Card key={i} className="px-4 py-3.5" style={{ borderLeft: `3px solid ${s.color}` }}>
              <div className="text-sm font-semibold text-slate-900">{s.range}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.rule}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Key Numbers */}
      <SectionLabel>Key Numbers</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        {[
          { label: 'Startup Fund', value: '$2,000' },
          { label: 'Monthly Tools', value: '$140–180' },
          { label: 'Gross Margin', value: '44%' },
          { label: 'Year 1 Target', value: '$300K' },
        ].map((f, i) => (
          <Card key={i} className="px-4 py-3.5">
            <div className="text-[11px] text-slate-400 font-mono uppercase tracking-wider mb-1">{f.label}</div>
            <div className="text-xl font-extrabold text-slate-900">{f.value}</div>
          </Card>
        ))}
      </div>

      {/* Modals */}
      {proposalModal === 'new' && (
        <ProposalModal isNew onSave={handleSave} onClose={() => setProposalModal(null)} />
      )}
      {proposalModal && proposalModal !== 'new' && (
        <ProposalModal decision={proposalModal} onSave={handleSave} onClose={() => setProposalModal(null)} />
      )}
    </div>
  );
}
