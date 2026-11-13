import React, { useEffect } from 'react';
import { Icon } from '../icons.jsx';
import { ListSkeleton, fmtFull } from '../ui.jsx';

// Reading pane shared by the Inbox and Priority pages
export default function MessageView({ msg, onClose, onAction, onReply, extraActions }) {
  // On phones the message replaces the list, so start at the top of it
  useEffect(() => { if (window.matchMedia('(max-width: 860px)').matches) window.scrollTo({ top: 0 }); }, [msg.id]);
  const trashed = msg.labelIds?.includes('TRASH');
  const frameStyle = '<base target="_blank"><style>body{font-family:system-ui,sans-serif;font-size:14px;margin:12px;word-wrap:break-word}img{max-width:100%;height:auto}</style>';
  return (
    <div className="card detail">
      <button className="btn btn-sm btn-ghost back-btn" onClick={onClose}><Icon name="back" size={15} />Back to list</button>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <h2>{msg.subject}</h2>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close message"><Icon name="close" size={16} /></button>
      </div>
      <div className="meta">
        <div><b>From</b> {msg.from}</div>
        <div><b>To</b> {msg.to}</div>
        <div>{fmtFull(msg.date)}</div>
      </div>
      <div className="row wrap">
        <button className="btn btn-primary btn-sm" onClick={() => onReply(msg)}><Icon name="reply" size={15} />Reply</button>
        <button className="btn btn-sm" onClick={() => onAction(msg, 'archive')}><Icon name="archive" size={15} />Archive</button>
        <button className="btn btn-sm" onClick={() => onAction(msg, trashed ? 'untrash' : 'trash')}><Icon name="trash" size={15} />{trashed ? 'Restore' : 'Delete'}</button>
        <button className="btn btn-sm" onClick={() => onAction(msg, 'spam')}><Icon name="spam" size={15} />Report spam</button>
        <button className="btn btn-sm" onClick={() => onAction(msg, msg.unread ? 'read' : 'unread')}><Icon name={msg.unread ? 'eye' : 'eyeOff'} size={15} />{msg.unread ? 'Mark as read' : 'Mark as unread'}</button>
        <button className="btn btn-sm" onClick={() => onAction(msg, msg.starred ? 'unstar' : 'star')}><Icon name="star" size={15} />{msg.starred ? 'Remove star' : 'Add star'}</button>
        {extraActions}
      </div>
      {msg.loading ? <ListSkeleton rows={3} /> : msg.html ? (
        <iframe title="Message content" className="mail-frame" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={`${frameStyle}${msg.html}`} />
      ) : <pre className="mail-text">{msg.text || msg.snippet}</pre>}
      {msg.attachments?.length > 0 && (
        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          <Icon name="paperclip" size={14} style={{ verticalAlign: -2 }} /> {msg.attachments.map((a) => a.filename).join(', ')}. Open the message in Gmail to download attachments.
        </p>
      )}
    </div>
  );
}
