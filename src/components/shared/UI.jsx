import { useState } from 'react';

// ─── Avatar ───
export function Avatar({ member, size = 28, onClick }) {
  if (!member) return null;
  return (
    <div
      onClick={onClick}
      title={`${member.name} — ${member.role}`}
      className={onClick ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: member.color, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, fontFamily: 'monospace',
      }}
    >
      {member.initials}
    </div>
  );
}

// ─── Card ───
export function Card({ children, className = '', onClick, draggable, onDragStart, onDragEnd, style = {} }) {
  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-white border border-slate-200 rounded-xl shadow-sm transition-all
        hover:shadow-md ${onClick ? 'cursor-pointer' : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// ─── Section Label ───
export function SectionLabel({ children }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 font-mono">
      {children}
    </div>
  );
}

// ─── Priority Dot ───
export function PriorityDot({ priority }) {
  const colors = { high: '#EF4444', medium: '#F59E0B', low: '#CBD5E1' };
  return (
    <span
      title={priority}
      className="inline-block flex-shrink-0"
      style={{ width: 7, height: 7, borderRadius: '50%', background: colors[priority] || '#CBD5E1' }}
    />
  );
}

// ─── Status Pill ───
export function StatusPill({ label, color }) {
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wide font-mono px-2 py-0.5 rounded-md"
      style={{ color, background: `${color}12` }}
    >
      {label}
    </span>
  );
}

// ─── Toggle Switch ───
export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500 font-medium select-none">
      <div
        onClick={e => { e.preventDefault(); onChange(!checked); }}
        className="transition-colors cursor-pointer"
        style={{
          width: 36, height: 20, borderRadius: 10, padding: 2,
          background: checked ? '#FF6B35' : '#E2E8F0',
        }}
      >
        <div
          className="transition-transform"
          style={{
            width: 16, height: 16, borderRadius: '50%', background: '#fff',
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }}
        />
      </div>
      {label}
    </label>
  );
}

// ─── Overlay (modal backdrop) ───
export function Overlay({ onClose, children }) {
  return (
    <div
      onClick={onClose}
      // cursor-pointer is required for iOS Safari to fire onClick on non-button divs
      className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4 sm:p-6 cursor-pointer"
    >
      {/* stopPropagation prevents backdrop tap from closing the modal when clicking inside */}
      <div
        onClick={e => e.stopPropagation()}
        className="w-full flex justify-center cursor-default"
      >
        {children}
      </div>
    </div>
  );
}

// ─── Popover (small context menu) ───
export function Popover({ anchorRect, onClose, children }) {
  if (!anchorRect) return null;
  return (
    <div onClick={onClose} className="fixed inset-0 z-[110]">
      <div
        onClick={e => e.stopPropagation()}
        className="fixed bg-white border border-slate-200 rounded-lg p-1.5 shadow-xl z-[111] min-w-[160px]"
        style={{ top: anchorRect.bottom + 6, left: anchorRect.left }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Assignee Popover ───
export function AssigneePopover({ anchorRect, team, currentId, onSelect, onClose }) {
  if (!anchorRect) return null;
  return (
    <Popover anchorRect={anchorRect} onClose={onClose}>
      <div className="py-1">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 pb-2 font-mono">
          Assign to
        </div>
        {team.map(m => (
          <div
            key={m.id}
            onClick={() => { onSelect(m.id); onClose(); }}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer hover:bg-slate-50 transition-colors"
            style={{ background: m.id === currentId ? 'rgba(255,107,53,0.06)' : undefined }}
          >
            <Avatar member={m} size={24} />
            <div>
              <div className="text-sm font-semibold text-slate-900">{m.name}</div>
              <div className="text-[10px] text-slate-400">{m.role}</div>
            </div>
            {m.id === currentId && <span className="ml-auto text-wolfpack-orange">✓</span>}
          </div>
        ))}
      </div>
    </Popover>
  );
}

// ─── Date Popover ───
export function DatePopover({ anchorRect, currentDate, onSelect, onClose }) {
  if (!anchorRect) return null;
  return (
    <Popover anchorRect={anchorRect} onClose={onClose}>
      <div className="py-1">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 pb-2 font-mono">
          Due date
        </div>
        <div className="px-2.5 pb-2">
          <input
            type="date"
            value={currentDate || ''}
            onChange={e => { onSelect(e.target.value); onClose(); }}
            className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900"
            autoFocus
          />
        </div>
        {currentDate && (
          <div
            onClick={() => { onSelect(null); onClose(); }}
            className="px-2.5 py-1.5 text-xs text-red-500 cursor-pointer rounded-md hover:bg-red-50 mx-0.5"
          >
            Remove date
          </div>
        )}
      </div>
    </Popover>
  );
}

// ─── Unsaved Changes Dialog ───
// Shows when a user tries to close a modal that has unsaved changes.
// Render it as a sibling AFTER the <Overlay> in a React fragment — it sits on
// top via z-[150] (above the Overlay's z-[100]).
export function UnsavedChangesDialog({ onDiscard, onSave, onKeepEditing, saving = false }) {
  return (
    <div
      // stopPropagation prevents this overlay from bubbling to the modal backdrop
      onClick={e => e.stopPropagation()}
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-[320px]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base leading-none">⚠️</span>
          <h3 className="text-sm font-bold text-slate-900">Unsaved changes</h3>
        </div>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          You have unsaved changes. What would you like to do?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white border-none cursor-pointer transition-colors"
            style={{
              background: 'linear-gradient(135deg, #FF6B35, #e85a22)',
              opacity: saving ? 0.55 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save & close'}
          </button>
          <button
            onClick={onDiscard}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 cursor-pointer transition-colors"
          >
            Discard changes
          </button>
          <button
            onClick={onKeepEditing}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared form field styles ───
export const formStyles = {
  label: 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono',
  input: 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:border-wolfpack-orange focus:outline-none transition-colors',
  btnPrimary: 'px-5 py-2 rounded-lg border-none cursor-pointer bg-wolfpack-orange text-white text-sm font-bold hover:bg-wolfpack-orange-dark transition-colors',
  btnSecondary: 'px-5 py-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50 text-slate-500 text-sm font-semibold hover:bg-slate-100 transition-colors',
};
