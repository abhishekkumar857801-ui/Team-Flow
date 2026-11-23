import { STATUSES, relativeDue } from '../lib/format.js';
import { Avatar } from './ui.jsx';
import Icon from './Icon.jsx';

// Dates and counts inside a phrase ("Due in 3d", "2d overdue", "Nov 29"):
// only the figure itself is set in Chivo Mono, the words stay in Chivo.
const FIGURE = /(\d+d|\b[A-Z][a-z]{2} \d{1,2}\b|\b\d{1,2} [A-Z][a-z]{2}\b|\btoday\b|\btomorrow\b)/;
export function Figures({ text }) {
  return String(text)
    .split(FIGURE)
    .map((part, i) => (i % 2 === 1 ? <span key={i} className="mono">{part}</span> : part));
}

/** Permanent task serial, e.g. TF-0042. */
export const serialOf = (task) => (task?.number ? `TF-${String(task.number).padStart(4, '0')}` : 'TF-····');

const PUNCH_LABEL = { todo: 'To do', in_progress: 'Doing', review: 'Review', done: 'Done' };

/**
 * The punch row: every stage the task has passed is punched, in fixed
 * positions so any two tickets compare at a glance.
 */
export function PunchRow({ status }) {
  const current = STATUSES.findIndex((s) => s.key === status);
  return (
    <ol className="punch" aria-label={`Stage: ${PUNCH_LABEL[status] || status}`}>
      {STATUSES.map((s, i) => (
        <li key={s.key} className={i <= current ? 'punched' : ''} aria-current={i === current ? 'step' : undefined}>
          {PUNCH_LABEL[s.key]}
        </li>
      ))}
    </ol>
  );
}

/**
 * A task drawn as a bus ticket: serial and fare class (priority) on the stub,
 * the title, who/where/when, and the punch row. The priority colour owns the
 * whole ticket.
 */
export default function Ticket({ task, reason, onClick, dragProps, dragging, showProject = true }) {
  const done = task.status === 'done';
  const due = relativeDue(task.dueDate);
  const late = !done && due.tone === 'danger';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`ticket pr-${task.priority} ${done ? 'is-done' : ''} ${dragging ? 'dragging' : ''}`}
      onClick={onClick}
      {...dragProps}
    >
      <span className="ticket-stub">
        <span className="serial">{serialOf(task)}</span>
        <span className="fare">{task.priority}</span>
      </span>
      <span className="ticket-title">{task.title}</span>
      <span className="ticket-meta">
        {showProject && task.project && (
          <span>{task.project.name}</span>
        )}
        <span className={late ? 'late' : ''}>
          <Icon name={done ? 'checkCircle' : 'calendar'} size={13} />
          {done ? 'Completed' : <Figures text={due.text} />}
        </span>
        {task.attachments?.length > 0 && (
          <span title={`${task.attachments.length} proof file(s)`}><Icon name="paperclip" size={13} />{task.attachments.length}</span>
        )}
        <span className="mono">{task.estimateHours}h</span>
        <span className="ticket-owner"><Avatar user={task.assignee} /></span>
      </span>
      {reason && <span className="ticket-reason"><Icon name="alert" size={13} />{reason}</span>}
      <span className="ticket-foot">
        <PunchRow status={task.status} />
      </span>
    </Tag>
  );
}
