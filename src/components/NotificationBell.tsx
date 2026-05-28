'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Bell, X, CheckCheck, ArrowRight } from 'lucide-react';

interface Notification {
  id: string;
  icon: string;
  title: string;
  body: string;
  href: string;
  type: string;
  urgent: boolean;
  created_at: string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(ms / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen]   = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [read,  setRead]  = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      const data = await res.json();
      setItems(data.notifications ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000); // refresh every minute
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function markAllRead() {
    setRead(new Set(items.map(n => n.id)));
  }

  const unread = items.filter(n => !read.has(n.id)).length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center rounded-xl shrink-0 transition-all"
        style={{
          width: 38, height: 38,
          background: open ? 'var(--accent-soft)' : 'white',
          border: `1.5px solid ${open ? 'var(--accent)' : 'var(--ink-200)'}`,
          boxShadow: 'var(--s-xs)',
        }}
        aria-label="Notifications"
      >
        <Bell size={15} style={{ color: open ? 'var(--accent)' : 'var(--ink-600)' }} />
        {unread > 0 && (
          <span
            className="absolute flex items-center justify-center font-bold text-white"
            style={{
              top: -4, right: -4,
              minWidth: 17, height: 17,
              borderRadius: 999,
              fontSize: '0.6rem',
              padding: '0 4px',
              background: 'linear-gradient(135deg,var(--accent),#818cf8)',
              border: '2px solid white',
              boxShadow: '0 2px 8px rgba(99,102,241,.40)',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 z-50 fade-in"
          style={{
            top: 'calc(100% + 10px)',
            width: 360,
            background: 'white',
            borderRadius: 16,
            boxShadow: '0 20px 60px rgba(15,23,42,.18), 0 4px 16px rgba(15,23,42,.10)',
            border: '1px solid var(--ink-200)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--ink-100)' }}
          >
            <div className="flex items-center gap-2">
              <Bell size={14} style={{ color: 'var(--accent)' }} />
              <p className="font-display font-bold text-sm">Notifications</p>
              {unread > 0 && (
                <span
                  className="pill pill-accent"
                  style={{ fontSize: '.65rem', padding: '.1rem .45rem' }}
                >
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-lg"
                style={{ width: 26, height: 26, background: 'var(--ink-100)', color: 'var(--ink-500)' }}
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: 'var(--ink-100)' }}
                >
                  🔔
                </div>
                <p className="font-semibold text-sm" style={{ color: 'var(--ink-700)' }}>
                  All caught up!
                </p>
                <p className="text-xs" style={{ color: 'var(--ink-400)' }}>
                  No new notifications
                </p>
              </div>
            ) : (
              items.map((n, idx) => {
                const isUnread = !read.has(n.id);
                return (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => {
                      setRead(prev => new Set([...prev, n.id]));
                      setOpen(false);
                    }}
                    className="flex items-start gap-3 px-4 py-3 transition-all"
                    style={{
                      background: isUnread
                        ? n.urgent
                          ? 'linear-gradient(90deg,rgba(239,68,68,.06),rgba(239,68,68,.02))'
                          : 'linear-gradient(90deg,rgba(99,102,241,.06),rgba(99,102,241,.02))'
                        : 'white',
                      borderBottom: idx < items.length - 1 ? '1px solid var(--ink-100)' : 'none',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ink-50)'; }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = isUnread
                        ? n.urgent
                          ? 'linear-gradient(90deg,rgba(239,68,68,.06),rgba(239,68,68,.02))'
                          : 'linear-gradient(90deg,rgba(99,102,241,.06),rgba(99,102,241,.02))'
                        : 'white';
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
                      style={{
                        background: n.urgent ? 'rgba(239,68,68,.12)' : 'var(--accent-soft)',
                        border: `1.5px solid ${n.urgent ? 'rgba(239,68,68,.20)' : 'rgba(99,102,241,.15)'}`,
                      }}
                    >
                      {n.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className="text-sm leading-snug"
                          style={{
                            fontWeight: isUnread ? 600 : 400,
                            color: 'var(--ink-900)',
                          }}
                        >
                          {n.title}
                        </p>
                        {isUnread && (
                          <div
                            className="w-2 h-2 rounded-full shrink-0 mt-1"
                            style={{
                              background: n.urgent ? 'var(--red-500)' : 'var(--accent)',
                              boxShadow: `0 0 6px ${n.urgent ? 'var(--red-500)' : 'var(--accent)'}`,
                            }}
                          />
                        )}
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--ink-500)' }}>
                        {n.body}
                      </p>
                      <p className="text-[11px] mt-1 font-medium" style={{ color: n.urgent ? 'var(--red-500)' : 'var(--ink-400)' }}>
                        {n.urgent && '🔴 '}
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div style={{ borderTop: '1px solid var(--ink-100)', padding: '10px 16px' }}>
              <button
                onClick={fetchNotifications}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: 'var(--ink-50)', color: 'var(--ink-600)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--ink-50)'; (e.currentTarget as HTMLElement).style.color = 'var(--ink-600)'; }}
              >
                <ArrowRight size={12}/> Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
