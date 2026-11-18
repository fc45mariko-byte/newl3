'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from 'd3-force';

type N = { id: string; label: string; kind: 'course' | 'chapter' | 'concept' | 'external'; href: string };
type E = { source: string; target: string; kind: string };
type SN = N & SimulationNodeDatum;
const W = 1100, H = 720;
const COLOR = { course: '#171717', chapter: '#eba5c4', concept: '#f2d878', external: '#afc4e3' };
const R = { course: 14, chapter: 9, concept: 6, external: 6 };

export function KnowledgeGraph({ nodes, edges }: { nodes: N[]; edges: E[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  // Layout computed once per data set (static after 300 ticks), so the graph does not move while reading.
  const layout = useMemo(() => {
    const sn: SN[] = nodes.map((n) => ({ ...n }));
    const links = edges.map((e) => ({ ...e }));
    const sim = forceSimulation(sn)
      .force('link', forceLink<SN, any>(links).id((d) => d.id).distance((l: any) => (l.kind === 'contains' ? 55 : 90)).strength((l: any) => (l.kind === 'contains' ? 0.6 : 0.15)))
      .force('charge', forceManyBody().strength(-120)).force('center', forceCenter(W / 2, H / 2)).force('collide', forceCollide<SN>().radius((d) => R[d.kind] + 4)).stop();
    for (let i = 0; i < 300; i++) sim.tick();
    for (const n of sn) { n.x = Math.max(20, Math.min(W - 20, n.x ?? 0)); n.y = Math.max(20, Math.min(H - 20, n.y ?? 0)); }
    return { sn, links: links as unknown as { source: SN; target: SN; kind: string }[] };
  }, [nodes, edges]);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const match = q.trim().toLowerCase();
  const neighbours = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    for (const l of layout.links) { if (l.source.id === hover) s.add(l.target.id); if (l.target.id === hover) s.add(l.source.id); }
    return s;
  }, [hover, layout]);
  if (!nodes.length) return <div className="card p-8 text-center text-muted">This course has no concept yet.</div>;
  return (
    <div className="card p-3 sm:p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="sr-only" htmlFor="gq">Highlight</label>
        <input id="gq" className="input !py-1.5 max-w-xs text-sm" placeholder="Highlight a concept…" value={q} onChange={(e) => setQ(e.target.value)} />
        {(['course', 'chapter', 'concept', 'external'] as const).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-full inline-block" style={{ background: COLOR[k] }} />{k === 'external' ? 'concept in another course' : k}</span>)}
        <span className="inline-flex items-center gap-1.5"><i className="w-5 border-t-2 border-dashed border-powder-ink inline-block" />prerequisite</span>
      </div>
      <div className="overflow-auto rounded-xl bg-ivory">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[720px] h-auto" role="img" aria-label={`Knowledge graph with ${nodes.length} nodes`}>
          {ready && layout.links.map((l, i) => {
            const dim = neighbours && !(neighbours.has(l.source.id) && neighbours.has(l.target.id));
            return <line key={i} x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} stroke={l.kind === 'prerequisite' ? '#2f4a72' : l.kind === 'related' ? '#b78da5' : '#cbbfae'} strokeWidth={l.kind === 'contains' ? 1 : 1.6} strokeDasharray={l.kind === 'prerequisite' ? '5 4' : undefined} opacity={dim ? 0.15 : 0.9} />;
          })}
          {ready && layout.sn.map((n) => {
            const hit = match && n.label.toLowerCase().includes(match);
            const dim = (neighbours && !neighbours.has(n.id)) || (match && !hit);
            const showLabel = n.kind !== 'concept' || hit || neighbours?.has(n.id) || nodes.length < 60;
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`} opacity={dim ? 0.25 : 1} className="cursor-pointer" tabIndex={0} role="link" aria-label={n.label}
                onClick={() => router.push(n.href)} onKeyDown={(e) => { if (e.key === 'Enter') router.push(n.href); }} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}>
                <circle r={R[n.kind] + (hit ? 3 : 0)} fill={COLOR[n.kind]} stroke={hit ? '#8e3a62' : '#fffdf8'} strokeWidth={hit ? 3 : 1.5} />
                {showLabel && <text x={R[n.kind] + 4} y={4} fontSize={n.kind === 'course' ? 15 : n.kind === 'chapter' ? 12.5 : 11} fontWeight={n.kind === 'concept' ? 400 : 600} fill="#1f1b19" style={{ paintOrder: 'stroke', stroke: '#f8f2e7', strokeWidth: 3 }}>{n.label.length > 48 ? n.label.slice(0, 46) + '…' : n.label}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-muted">Hover or focus a node to isolate its connections. Labels of concepts appear on hover or when they match your search.</p>
    </div>
  );
}
