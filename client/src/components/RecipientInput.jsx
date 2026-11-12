import React, { useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../icons.jsx';
import { Avatar } from '../ui.jsx';

export const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

// "Jane <jane@x.com>" -> "jane@x.com"; plain text is returned trimmed
const clean = (s) => (/<([^>]+)>/.exec(s)?.[1] || s).trim().replace(/^["']|["']$/g, '');
export const splitList = (v) => String(v || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);

function highlight(text, q) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

// Lower is better: prefix of the address or of a name word beats a match in the middle
function rank(c, q) {
  const email = c.email.toLowerCase();
  const name = (c.name || '').toLowerCase();
  if (email.startsWith(q)) return 0;
  if (name.split(/\s+/).some((w) => w.startsWith(q)) || name.startsWith(q)) return 1;
  if (email.split('@')[1]?.startsWith(q)) return 3;
  if (email.includes(q) || name.includes(q)) return 2;
  return -1;
}

/**
 * Email field with chips and type-ahead suggestions.
 * `value` is a comma-separated string so it plugs straight into the existing API.
 */
export default function RecipientInput({ value, onChange, contacts = [], placeholder, label, autoFocus, onInvalidChange }) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const tokens = splitList(value);
  const taken = useMemo(() => new Set(tokens.map((t) => t.toLowerCase())), [value]);

  const q = text.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!q) return [];
    return contacts
      .filter((c) => !taken.has(c.email.toLowerCase()))
      .map((c) => ({ c, r: rank(c, q) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => a.r - b.r) // stable: keeps the "most contacted first" order inside each tier
      .slice(0, 8)
      .map((x) => x.c);
  }, [q, contacts, taken]);

  const showList = open && suggestions.length > 0;
  const looksComplete = EMAIL_RE.test(q);

  const commit = (...items) => {
    const next = [...tokens];
    for (const raw of items) {
      const v = clean(raw);
      if (v && !next.some((t) => t.toLowerCase() === v.toLowerCase())) next.push(v);
    }
    onChange(next.join(', '));
    onInvalidChange?.(next.some((t) => !EMAIL_RE.test(t)));
    setText('');
    setOpen(false);
    setActive(0);
  };

  const remove = (i) => {
    const next = tokens.filter((_, j) => j !== i);
    onChange(next.join(', '));
    onInvalidChange?.(next.some((t) => !EMAIL_RE.test(t)));
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!suggestions.length) return;
      e.preventDefault();
      setOpen(true);
      const n = suggestions.length;
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a - 1 + n) % n));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (showList && active >= 0 && !(looksComplete && active === 0 && suggestions[0].email.toLowerCase() !== q)) {
        e.preventDefault();
        commit(suggestions[active].email);
      } else if (q) {
        if (e.key === 'Enter') e.preventDefault();
        commit(text);
      }
    } else if (e.key === ',' || e.key === ';' || (e.key === ' ' && q.includes('@'))) {
      if (q) { e.preventDefault(); commit(text); }
    } else if (e.key === 'Backspace' && !text && tokens.length) {
      remove(tokens.length - 1);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  const onPaste = (e) => {
    const pasted = e.clipboardData.getData('text');
    if (!/[,;\n\s]/.test(pasted.trim())) return;
    e.preventDefault();
    commit(...pasted.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean));
  };

  return (
    <div className="recipients">
      <div className="recipients-box" onClick={() => inputRef.current?.focus()}>
        {tokens.map((t, i) => (
          <span key={t} className={`chip${EMAIL_RE.test(t) ? '' : ' invalid'}`} title={EMAIL_RE.test(t) ? t : `"${t}" isn't a valid email address`}>
            <span>{t}</span>
            <button type="button" aria-label={`Remove ${t}`} onClick={(e) => { e.stopPropagation(); remove(i); }}><Icon name="close" size={12} strokeWidth={2.2} /></button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-label={label}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${id}-opt-${active}` : undefined}
          value={text}
          placeholder={tokens.length ? '' : placeholder}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (text.trim()) commit(text); else setOpen(false); }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
      </div>
      {showList && (
        <ul className="suggest" id={listId} role="listbox" aria-label="Suggested contacts">
          {suggestions.map((c, i) => (
            <li
              key={c.email}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); commit(c.email); }}
              onMouseEnter={() => setActive(i)}
            >
              <Avatar name={c.name || c.email} />
              <span className="s-text">
                <span className="s-name">{highlight(c.name || c.email, q)}</span>
                {c.name && <span className="s-mail">{highlight(c.email, q)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
