// Safe Markdown renderer (no raw HTML): headings, paragraphs, emphasis, links, lists, tables,
// blockquotes and ```diagram name``` blocks, which render an interactive diagram.
import React from 'react';
import { Diagram } from './Diagram';

function inline(text: string, key = 0): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|==[^=\n]+==|\[\[[^\]]+\]\]|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('==')) out.push(<mark key={k} className="bg-butter-soft rounded px-0.5">{t.slice(2, -2)}</mark>);
    else if (t.startsWith('[[')) out.push(<a key={k} href={`/knowledge?q=${encodeURIComponent(t.slice(2, -2))}`} className="!no-underline border-b border-dashed border-rose-ink">{t.slice(2, -2)}</a>);
    else if (t.startsWith('`')) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('[')) { const lm = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!; out.push(<a key={k} href={lm[2]} target="_blank" rel="noopener noreferrer">{lm[1]}</a>); }
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className = 'prose-lea' }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: React.ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```diagram/.test(l)) {
      const body: string[] = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      const [name, arg] = body.join(' ').trim().split(/\s+/);
      out.push(<Diagram key={k++} name={name} arg={arg} />);
      continue;
    }
    if (/^```/.test(l)) {
      const body: string[] = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(<pre key={k++} className="bg-ivory rounded-xl p-3 overflow-x-auto text-sm"><code>{body.join('\n')}</code></pre>);
      continue;
    }
    if (/^\s*\|/.test(l)) {
      const rows: string[] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\s*\|\s*:?-{2,}/.test(r));
      out.push(
        <div key={k++} className="overflow-x-auto my-3"><table><thead><tr>{cells(body[0]).map((c, j) => <th key={j}>{inline(c, j)}</th>)}</tr></thead>
          <tbody>{body.slice(1).map((r, ri) => <tr key={ri}>{cells(r).map((c, j) => <td key={j}>{inline(c, j)}</td>)}</tr>)}</tbody></table></div>,
      );
      continue;
    }
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const level = h[1].length; out.push(level <= 3 ? <h3 key={k++}>{inline(h[2])}</h3> : <h4 key={k++}>{inline(h[2])}</h4>); i++; continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l); const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      const Tag = ordered ? 'ol' : 'ul';
      out.push(<Tag key={k++}>{items.map((x, j) => <li key={j}>{inline(x, j)}</li>)}</Tag>);
      continue;
    }
    if (/^>\s?/.test(l)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(<blockquote key={k++}>{inline(q.join(' '))}</blockquote>);
      continue;
    }
    if (!l.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*\||\s*([-*]|\d+\.)\s|>|```)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={k++}>{inline(para.join(' '))}</p>);
  }
  return <div className={className}>{out}</div>;
}
