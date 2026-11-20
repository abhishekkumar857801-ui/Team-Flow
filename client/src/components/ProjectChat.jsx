import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useSocketEvents } from '../lib/socket.js';
import { Avatar } from './ui.jsx';
import Icon from './Icon.jsx';

const timeOf = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayOf = (d) => {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

// Slide-in chat panel for one project. Every team member can read and post;
// new messages arrive live from web and mobile via Socket.io.
export default function ProjectChat({ project, teamId, isManager, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const stickToBottom = useRef(true);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${project._id}/messages`);
      setMessages(data.messages);
      setHasMore(data.hasMore);
      stickToBottom.current = true;
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [project._id]);

  useEffect(() => { setMessages(null); load(); }, [load]);
  useEffect(() => { if (stickToBottom.current) scrollToBottom(); }, [messages]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useSocketEvents(
    {
      'chat:message': ({ projectId, message }) => {
        if (projectId !== project._id) return;
        const el = listRef.current;
        stickToBottom.current = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        setMessages((list) => (list && !list.some((m) => m._id === message._id) ? [...list, message] : list));
      },
      'chat:deleted': ({ projectId, messageId }) => {
        if (projectId !== project._id) return;
        stickToBottom.current = false;
        setMessages((list) => list?.filter((m) => m._id !== messageId));
      },
    },
    teamId
  );

  const loadOlder = async () => {
    if (!messages?.length) return;
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const { data } = await api.get(`/projects/${project._id}/messages`, { params: { before: messages[0].createdAt } });
      stickToBottom.current = false;
      setMessages((list) => [...data.messages, ...list]);
      setHasMore(data.hasMore);
      // Keep the view where it was after older messages are added on top.
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const { data } = await api.post(`/projects/${project._id}/messages`, { text: body });
      stickToBottom.current = true;
      setMessages((list) => (list && !list.some((m) => m._id === data.message._id) ? [...list, data.message] : list));
      setText('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const remove = async (m) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.delete(`/projects/${project._id}/messages/${m._id}`);
      setMessages((list) => list.filter((x) => x._id !== m._id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  let lastDay = '';
  return (
    <div className="chat-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="chat-panel" role="dialog" aria-label={`${project.name} chat`}>
        <header className="chat-head">
          <span className="color-dot" style={{ background: project.color, width: 12, height: 12 }} />
          <div className="grow">
            <h2 className="truncate">{project.name}</h2>
            <div className="muted small">Project chat · visible to everyone in the team</div>
          </div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close chat"><Icon name="x" size={18} /></button>
        </header>

        <div className="chat-list" ref={listRef}>
          {!messages && <div className="muted small" style={{ textAlign: 'center', padding: 24 }}>Loading messages…</div>}
          {hasMore && <button className="btn sm" style={{ alignSelf: 'center' }} onClick={loadOlder}>Load older messages</button>}
          {messages?.length === 0 && (
            <div className="empty">
              <Icon name="chat" size={32} />
              <b>No messages yet</b>
              <span className="small">Start the conversation about {project.name}.</span>
            </div>
          )}
          {messages?.map((m, i) => {
            const mine = m.sender?._id === user._id;
            const day = dayOf(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            // Group consecutive messages from the same person.
            const prev = messages[i - 1];
            const grouped = !showDay && prev && prev.sender?._id === m.sender?._id
              && new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60 * 1000;
            return (
              <div key={m._id}>
                {showDay && <div className="chat-day"><span>{day}</span></div>}
                <div className={`chat-msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}`}>
                  {!mine && (grouped ? <span className="chat-avatar-gap" /> : <Avatar user={m.sender} />)}
                  <div className="chat-bubble-wrap">
                    {!mine && !grouped && <div className="chat-name">{m.sender?.name || 'Former member'}</div>}
                    <div className="chat-bubble">
                      {m.text}
                      <span className="chat-time">{timeOf(m.createdAt)}</span>
                    </div>
                  </div>
                  {(mine || isManager) && (
                    <button className="chat-delete" onClick={() => remove(m)} title="Delete message" aria-label="Delete message">
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className="error-box" style={{ margin: '0 14px 8px' }}>{error}</div>}
        <form className="chat-input" onSubmit={send}>
          <textarea
            rows={1}
            placeholder={`Message ${project.name}…`}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) send(e);
            }}
          />
          <button className="btn primary" disabled={!text.trim() || sending} aria-label="Send">
            <Icon name="send" size={16} />
          </button>
        </form>
      </aside>
    </div>
  );
}
