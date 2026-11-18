import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { extract, ExtractionError, kindFor } from '@/lib/extract';
import { occurrences, parisOffsetMin } from '@/lib/dates';

async function pptx() {
  const z = new JSZip();
  z.file('ppt/slides/slide1.xml', '<p:sld><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><a:p><a:r><a:t>Les Incoterms</a:t></a:r></a:p></p:sp><a:p><a:r><a:t>FCA &amp; FOB</a:t></a:r></a:p></p:sld>');
  z.file('ppt/slides/slide2.xml', '<p:sld><a:p><a:r><a:t>Deuxième</a:t></a:r></a:p><a:tbl></a:tbl></p:sld>');
  return z.generateAsync({ type: 'nodebuffer' });
}
async function docx() {
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Plan du cours</w:t></w:r></w:p><w:p><w:r><w:t>Le crédit documentaire.</w:t></w:r></w:p></w:body></w:document>');
  return z.generateAsync({ type: 'nodebuffer' });
}

describe('document extraction', () => {
  it('detects supported kinds', () => {
    expect(kindFor('a.PPTX', '')).toBe('pptx');
    expect(kindFor('a.png', 'image/png')).toBeNull();
  });
  it('extracts slides with titles, entities and tables', async () => {
    const r = await extract(await pptx(), 'pptx');
    expect(r.structure.pages).toBe(2);
    expect(r.structure.headings[0]).toMatchObject({ text: 'Les Incoterms', page: 1 });
    expect(r.text).toContain('FCA & FOB');
    expect(r.structure.tables).toBe(1);
  });
  it('extracts Word text and headings', async () => {
    const r = await extract(await docx(), 'docx');
    expect(r.text).toContain('Le crédit documentaire.');
    expect(r.structure.headings.map((h) => h.text)).toContain('Plan du cours');
  });
  it('reports a damaged file instead of inventing content', async () => {
    await expect(extract(Buffer.from('not a zip'), 'pptx')).rejects.toBeInstanceOf(ExtractionError);
  });
  it('keeps Markdown headings', async () => {
    const r = await extract(Buffer.from('# Titre\ntexte\n## Partie'), 'md');
    expect(r.structure.headings).toHaveLength(2);
  });
});

describe('weekly events across daylight saving', () => {
  it('knows Paris offsets', () => {
    expect(parisOffsetMin(new Date('2026-07-01T12:00:00Z'))).toBe(120);
    expect(parisOffsetMin(new Date('2026-12-01T12:00:00Z'))).toBe(60);
  });
  it('keeps 09:00 local time after the October change', () => {
    const e = { startsAt: new Date('2026-09-07T07:00:00Z'), endsAt: new Date('2026-09-07T09:00:00Z'), weekly: true, repeatUntil: '2027-01-15' };
    const o = occurrences([e], new Date('2026-11-16T00:00:00Z'), new Date('2026-11-17T00:00:00Z'));
    expect(o).toHaveLength(1);
    expect(o[0].at.toISOString()).toBe('2026-11-16T08:00:00.000Z');
  });
});
