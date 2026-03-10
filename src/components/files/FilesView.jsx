import { useState, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AvatarStack } from '../shared/MultiAssigneeSelect';

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractDriveFileId(url) {
  if (!url) return null;
  const fileMatch = url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch) return fileMatch[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idMatch) return idMatch[1];
  return null;
}

function fileIcon(url) {
  if (!url) return '📄';
  const lower = url.toLowerCase();
  if (lower.includes('spreadsheet') || lower.includes('sheet')) return '📊';
  if (lower.includes('presentation') || lower.includes('slide')) return '📑';
  if (lower.includes('document') || lower.includes('doc')) return '📝';
  if (lower.includes('form')) return '📋';
  if (lower.includes('pdf')) return '📕';
  if (lower.includes('folder')) return '📁';
  return '📄';
}

// ─── Drive thumbnail (same pattern as DesignPipeline) ───────────────────────

function FileThumbnail({ fileId, url }) {
  const { googleAccessToken } = useAuth();
  const [thumbUrl, setThumbUrl] = useState(null);
  const [tried, setTried] = useState(false);

  useMemo(() => {
    if (!fileId || !googleAccessToken || tried) return;
    setTried(true);
    fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink`,
      { headers: { Authorization: `Bearer ${googleAccessToken}` } }
    )
      .then(r => r.json())
      .then(data => {
        if (data.thumbnailLink) {
          setThumbUrl(data.thumbnailLink.replace(/=s\d+$/, '=s160'));
        }
      })
      .catch(() => {});
  }, [fileId, googleAccessToken, tried]);

  if (thumbUrl) {
    return (
      <img
        src={thumbUrl}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setThumbUrl(null)}
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <img
        src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png"
        alt="Drive"
        style={{ width: 28, height: 28, opacity: 0.5 }}
      />
    </div>
  );
}

// ─── Single file row ─────────────────────────────────────────────────────────

function FileRow({ file, team }) {
  const fileId = extractDriveFileId(file.drive_file_url);
  const assigneeIds = Array.isArray(file.assignee_ids) && file.assignee_ids.length > 0
    ? file.assignee_ids.map(String)
    : (file.assignee_id ? [String(file.assignee_id)] : []);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
      {/* Thumbnail */}
      <td className="py-2.5 pl-4 pr-3 w-[52px]">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
          {fileId ? (
            <FileThumbnail fileId={fileId} url={file.drive_file_url} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl">
              {fileIcon(file.drive_file_url)}
            </div>
          )}
        </div>
      </td>

      {/* File name / link */}
      <td className="py-2.5 pr-4">
        <a
          href={file.drive_file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-slate-800 hover:text-[#FF6B35] transition-colors leading-snug line-clamp-1"
          title={file.drive_file_name || file.drive_file_url}
        >
          {file.drive_file_name || file.drive_file_url}
        </a>
        {/* On mobile, show the "linked to" label inline */}
        <div className="text-[11px] text-slate-400 mt-0.5 sm:hidden truncate">{file.linkedToLabel}</div>
      </td>

      {/* Linked to — hidden on mobile (shown inline above instead) */}
      <td className="py-2.5 pr-4 hidden sm:table-cell">
        <a
          href={file.linkedToHref}
          onClick={file.onLinkedToClick}
          className="text-xs text-slate-500 hover:text-[#FF6B35] transition-colors cursor-pointer truncate max-w-[200px] block"
          title={file.linkedToLabel}
        >
          {file.linkedToLabel}
        </a>
      </td>

      {/* Assignees */}
      <td className="py-2.5 pr-4 hidden sm:table-cell">
        {assigneeIds.length > 0 ? (
          <AvatarStack ids={assigneeIds} team={team} size={24} max={3} />
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>

      {/* Status badge */}
      <td className="py-2.5 pr-4">
        <StatusBadge status={file.status} type={file.type} />
      </td>
    </tr>
  );
}

function StatusBadge({ status, type }) {
  const taskColors = {
    todo: { bg: '#F1F5F9', text: '#64748B', label: 'To Do' },
    'in-progress': { bg: '#FFF7ED', text: '#FF6B35', label: 'In Progress' },
    done: { bg: '#ECFDF5', text: '#10B981', label: 'Done' },
  };
  const designColors = {
    concept: { bg: '#F8FAFC', text: '#94A3B8', label: 'Concept' },
    'in-review': { bg: '#FFF7ED', text: '#FF6B35', label: 'In Review' },
    approved: { bg: '#ECFDF5', text: '#10B981', label: 'Approved' },
    revision: { bg: '#FFF1F2', text: '#F43F5E', label: 'Revision' },
    archived: { bg: '#F1F5F9', text: '#94A3B8', label: 'Archived' },
  };
  const map = type === 'task' ? taskColors : designColors;
  const c = map[status] || { bg: '#F1F5F9', text: '#94A3B8', label: status || '—' };
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

// ─── Section header row ───────────────────────────────────────────────────────

function SectionHeader({ label, count, icon }) {
  return (
    <tr>
      <td colSpan={5} className="pt-6 pb-2 pl-4">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            {label}
          </span>
          <span className="text-[11px] font-semibold text-slate-300 font-mono">({count})</span>
        </div>
      </td>
    </tr>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function FilesView({ tasks, designs, team }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'task' | 'design'

  // Build a flat list of all files with metadata
  const allFiles = useMemo(() => {
    const files = [];

    // Task files
    for (const t of tasks) {
      if (!t.drive_file_url) continue;
      const assigneeIds = Array.isArray(t.assignee_ids) && t.assignee_ids.length > 0
        ? t.assignee_ids.map(String)
        : (t.assignee_id ? [String(t.assignee_id)] : []);
      files.push({
        id: `task-${t.id}`,
        type: 'task',
        drive_file_url: t.drive_file_url,
        drive_file_name: t.drive_file_name,
        status: t.status,
        assignee_ids: assigneeIds,
        assignee_id: null,
        linkedToLabel: t.title,
        linkedToHref: null,
        onLinkedToClick: null,
        sortKey: (t.drive_file_name || t.drive_file_url || '').toLowerCase(),
      });
    }

    // Design files
    for (const d of designs) {
      if (!d.drive_file_url) continue;
      const assigneeIds = Array.isArray(d.assignee_ids) && d.assignee_ids.length > 0
        ? d.assignee_ids.map(String)
        : (d.assignee_id ? [String(d.assignee_id)] : []);
      files.push({
        id: `design-${d.id}`,
        type: 'design',
        drive_file_url: d.drive_file_url,
        drive_file_name: d.drive_file_name,
        status: d.status,
        assignee_ids: assigneeIds,
        assignee_id: null,
        linkedToLabel: d.name,
        linkedToHref: null,
        onLinkedToClick: null,
        sortKey: (d.drive_file_name || d.drive_file_url || '').toLowerCase(),
      });
    }

    return files;
  }, [tasks, designs]);

  // Filter + search
  const filtered = useMemo(() => {
    let list = allFiles;
    if (filter !== 'all') list = list.filter(f => f.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f =>
        (f.drive_file_name || '').toLowerCase().includes(q) ||
        (f.linkedToLabel || '').toLowerCase().includes(q) ||
        (f.drive_file_url || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allFiles, filter, search]);

  const taskFiles = filtered.filter(f => f.type === 'task');
  const designFiles = filtered.filter(f => f.type === 'design');

  const taskTotal = allFiles.filter(f => f.type === 'task').length;
  const designTotal = allFiles.filter(f => f.type === 'design').length;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all', label: `All (${allFiles.length})` },
            { id: 'task', label: `Tasks (${taskTotal})` },
            { id: 'design', label: `Designs (${designTotal})` },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all border"
              style={{
                background: filter === opt.id ? '#FF6B35' : 'white',
                color: filter === opt.id ? 'white' : '#64748B',
                borderColor: filter === opt.id ? '#FF6B35' : '#E2E8F0',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="py-20 text-center">
          <div className="text-4xl mb-3">📂</div>
          <div className="text-slate-400 text-sm">
            {search ? 'No files match your search.' : 'No Drive files linked yet.'}
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="mt-3 text-xs text-[#FF6B35] hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            {/* Column headers */}
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pl-4 pr-3 py-3 w-[52px]" />
                <th className="pr-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  File
                </th>
                <th className="pr-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono hidden sm:table-cell">
                  Linked To
                </th>
                <th className="pr-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono hidden sm:table-cell">
                  Assignees
                </th>
                <th className="pr-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Task files section */}
              {taskFiles.length > 0 && (filter === 'all' || filter === 'task') && (
                <>
                  {filter === 'all' && (
                    <SectionHeader label="Tasks" count={taskFiles.length} icon="✅" />
                  )}
                  {taskFiles.map(f => (
                    <FileRow key={f.id} file={f} team={team} />
                  ))}
                </>
              )}

              {/* Design files section */}
              {designFiles.length > 0 && (filter === 'all' || filter === 'design') && (
                <>
                  {filter === 'all' && (
                    <SectionHeader label="Designs" count={designFiles.length} icon="🎨" />
                  )}
                  {designFiles.map(f => (
                    <FileRow key={f.id} file={f} team={team} />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
