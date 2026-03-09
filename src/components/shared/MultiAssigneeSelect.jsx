import { useState, useRef, useEffect } from 'react';
import { Avatar } from './UI';

/**
 * MultiAssigneeSelect
 *
 * Props:
 *   team          — array of { id, name, avatar_url?, color? }
 *   selectedIds   — string[] (uuid) of currently selected member IDs
 *   onChange      — (newIds: string[]) => void
 *   inputCls      — optional className string for the trigger button
 *   maxDisplay    — how many avatars to show before "+N more" (default 3)
 */
export default function MultiAssigneeSelect({
  team = [],
  selectedIds = [],
  onChange,
  inputCls = '',
  maxDisplay = 3,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const strIds = (selectedIds || []).map(String);

  const toggle = (id) => {
    const sid = String(id);
    if (strIds.includes(sid)) {
      onChange(strIds.filter(x => x !== sid));
    } else {
      onChange([...strIds, sid]);
    }
  };

  const selectedMembers = team.filter(m => strIds.includes(String(m.id)));
  const visible = selectedMembers.slice(0, maxDisplay);
  const overflow = selectedMembers.length - maxDisplay;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={inputCls}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          background: 'white',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '6px 10px',
          minHeight: '36px',
          width: '100%',
          textAlign: 'left',
        }}
      >
        {selectedMembers.length === 0 ? (
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>Select assignees…</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            {visible.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Avatar member={m} size={20} />
                <span style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>{m.name.split(' ')[0]}</span>
              </div>
            ))}
            {overflow > 0 && (
              <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>+{overflow} more</span>
            )}
          </div>
        )}
        <span style={{ marginLeft: 'auto', color: '#CBD5E1', fontSize: '10px' }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 9999,
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: '200px',
            width: '100%',
            maxHeight: '260px',
            overflowY: 'auto',
            padding: '6px 0',
          }}
        >
          {team.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: '12px', color: '#94A3B8' }}>No team members</div>
          )}
          {team.map(member => {
            const checked = strIds.includes(String(member.id));
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggle(member.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '8px 14px',
                  background: checked ? '#FFF7F5' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={e => { e.currentTarget.style.background = checked ? '#FFF7F5' : 'transparent'; }}
              >
                {/* Checkbox */}
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    border: checked ? 'none' : '1.5px solid #CBD5E1',
                    background: checked ? '#FF6B35' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.1s',
                  }}
                >
                  {checked && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <Avatar member={member} size={22} />
                <span style={{ fontSize: '13px', color: '#334155', fontWeight: checked ? 600 : 400 }}>
                  {member.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * AvatarStack — displays a row of avatars for multiple assignees
 * Used in kanban cards and table rows to show assignee_ids
 */
export function AvatarStack({ ids = [], team = [], size = 22, max = 3 }) {
  const strIds = (ids || []).map(String);
  const members = team.filter(m => strIds.includes(String(m.id)));
  const visible = members.slice(0, max);
  const overflow = members.length - max;

  if (members.length === 0) return <span style={{ fontSize: '12px', color: '#CBD5E1' }}>—</span>;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((m, i) => (
        <div
          key={m.id}
          style={{ marginLeft: i > 0 ? -6 : 0, zIndex: visible.length - i, position: 'relative' }}
          title={m.name}
        >
          <Avatar member={m} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            marginLeft: -6,
            width: size,
            height: size,
            borderRadius: '50%',
            background: '#E2E8F0',
            border: '2px solid white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: 700,
            color: '#64748B',
            zIndex: 0,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
