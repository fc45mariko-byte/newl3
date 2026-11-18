// Text extraction for uploaded course documents. Each extractor keeps the structure it can see
// (slides, headings, tables). When extraction fails the error is reported; nothing is invented.
import JSZip from 'jszip';

export type Extraction = {
  text: string;
  structure: { headings: { level: number; text: string; page?: number }[]; tables: number; pages?: number };
};
export class ExtractionError extends Error {}

export const SUPPORTED: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/markdown': 'md',
};

export function kindFor(filename: string, mime: string): string | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (SUPPORTED[mime]) return SUPPORTED[mime];
  if (['pdf', 'docx', 'pptx', 'txt', 'md'].includes(ext)) return ext;
  return null;
}

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');

async function pptx(buf: Buffer): Promise<Extraction> {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!slides.length) throw new ExtractionError('No slide found in this presentation.');
  const parts: string[] = [];
  const headings: Extraction['structure']['headings'] = [];
  let tables = 0;
  for (const [i, name] of slides.entries()) {
    const xml = await zip.file(name)!.async('string');
    tables += (xml.match(/<a:tbl>/g) ?? []).length;
    const paras = [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)]
      .map((m) => [...m[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decode(t[1])).join(''))
      .filter((t) => t.trim());
    // The title placeholder, when present, is the slide heading; otherwise the first line.
    const titleShape = xml.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?type="(?:title|ctrTitle)"[\s\S]*?<\/p:sp>/);
    const title = titleShape ? [...titleShape[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decode(t[1])).join('').trim() : paras[0];
    if (title) headings.push({ level: 2, text: title, page: i + 1 });
    const notesName = name.replace('slides/slide', 'notesSlides/notesSlide');
    let notes = '';
    if (zip.file(notesName)) {
      const nx = await zip.file(notesName)!.async('string');
      notes = [...nx.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decode(t[1])).join(' ').trim();
    }
    parts.push(`## Slide ${i + 1}${title ? ` — ${title}` : ''}\n${paras.join('\n')}${notes.length > 3 ? `\n[Notes] ${notes}` : ''}`);
  }
  return { text: parts.join('\n\n'), structure: { headings, tables, pages: slides.length } };
}

async function docx(buf: Buffer): Promise<Extraction> {
  const mammoth = await import('mammoth');
  const { value: html } = await mammoth.convertToHtml({ buffer: buf });
  const headings: Extraction['structure']['headings'] = [];
  const tables = (html.match(/<table/g) ?? []).length;
  const text = html
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g, (_, l, t) => {
      const plain = decode(t.replace(/<[^>]+>/g, '')).trim();
      if (plain) headings.push({ level: Number(l), text: plain });
      return `\n${'#'.repeat(Number(l))} ${plain}\n`;
    })
    .replace(/<li[^>]*>/g, '\n- ')
    .replace(/<\/(p|tr|table|ul|ol)>/g, '\n')
    .replace(/<\/t[dh]>/g, ' | ')
    .replace(/<[^>]+>/g, '')
    .split('\n').map((l) => decode(l).trim()).filter(Boolean).join('\n');
  if (!text.trim()) throw new ExtractionError('The document contains no readable text.');
  return { text, structure: { headings, tables } };
}

async function pdf(buf: Buffer): Promise<Extraction> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const { text, totalPages } = await extractText(doc, { mergePages: false });
  const pages = (text as string[]).map((t, i) => `## Page ${i + 1}\n${t.trim()}`);
  const joined = pages.join('\n\n');
  if (!(text as string[]).join('').trim()) {
    throw new ExtractionError('This PDF has no text layer (it is probably a scan or a picture). Its file is kept, but its content cannot be read or searched.');
  }
  const headings = (text as string[]).map((t, i) => ({ level: 2, text: t.trim().split('\n')[0].slice(0, 120), page: i + 1 })).filter((h) => h.text);
  return { text: joined, structure: { headings, tables: 0, pages: totalPages } };
}

function plain(buf: Buffer): Extraction {
  const text = buf.toString('utf8');
  const headings = [...text.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].trim() }));
  return { text, structure: { headings, tables: (text.match(/^\|.*\|$/gm) ?? []).length ? 1 : 0 } };
}

export async function extract(buf: Buffer, kind: string): Promise<Extraction> {
  try {
    if (kind === 'pptx') return await pptx(buf);
    if (kind === 'docx') return await docx(buf);
    if (kind === 'pdf') return await pdf(buf);
    return plain(buf);
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    throw new ExtractionError(`The file could not be read (${(e as Error).message}). It may be damaged or protected.`);
  }
}
