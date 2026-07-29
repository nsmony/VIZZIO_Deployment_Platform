import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const documentationRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(documentationRoot, '..');
const outputDirectory = join(documentationRoot, 'public', 'downloads');
const htmlPath = join(outputDirectory, 'vizzio-full-guide.html');
const pdfPath = join(outputDirectory, 'vizzio-full-guide.pdf');

const documents = [
  'deployment-prerequisites.md',
  'hosted-pc-prerequisites.md',
  'architecture.md',
  'diagrams.md',
  'admin-user-guide.md',
  'code-documentation-audit-2026-07-27.md',
  'full-requirements-audit-2026-07-23.md',
  'implementation-verification.md',
  'launcher-installation.md',
  'launcher-self-update.md',
  'launcher-error-reporting.md',
  'operations-publishing-guide.md',
  'configuration-and-production-handover.md',
  'handover-document.md',
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderChildren(node) {
  return (node.children ?? []).map(renderNode).join('');
}

function renderNode(node) {
  switch (node.type) {
    case 'root':
      return renderChildren(node);
    case 'text':
      return escapeHtml(node.value);
    case 'paragraph':
      return `<p>${renderChildren(node)}</p>`;
    case 'heading':
      return `<h${node.depth}>${renderChildren(node)}</h${node.depth}>`;
    case 'strong':
      return `<strong>${renderChildren(node)}</strong>`;
    case 'emphasis':
      return `<em>${renderChildren(node)}</em>`;
    case 'delete':
      return `<del>${renderChildren(node)}</del>`;
    case 'inlineCode':
      return `<code>${escapeHtml(node.value)}</code>`;
    case 'code':
      return `<pre><code>${escapeHtml(node.value)}</code></pre>`;
    case 'blockquote':
      return `<blockquote>${renderChildren(node)}</blockquote>`;
    case 'break':
      return '<br>';
    case 'thematicBreak':
      return '<hr>';
    case 'link':
      return `<a href="${escapeHtml(node.url)}">${renderChildren(node)}</a>`;
    case 'image':
      return `<span>[Image: ${escapeHtml(node.alt ?? '')}]</span>`;
    case 'list': {
      const tag = node.ordered ? 'ol' : 'ul';
      const start = node.ordered && node.start && node.start !== 1 ? ` start="${node.start}"` : '';
      return `<${tag}${start}>${renderChildren(node)}</${tag}>`;
    }
    case 'listItem':
      return `<li>${renderChildren(node)}</li>`;
    case 'table':
      return `<table>${renderChildren(node)}</table>`;
    case 'tableRow':
      return `<tr>${renderChildren(node)}</tr>`;
    case 'tableCell':
      return `<td>${renderChildren(node)}</td>`;
    case 'html':
      return `<pre>${escapeHtml(node.value)}</pre>`;
    default:
      return renderChildren(node);
  }
}

const processor = unified().use(remarkParse).use(remarkGfm);
const sections = documents.map((filename, index) => {
  const markdown = readFileSync(join(repositoryRoot, 'docs', filename), 'utf8');
  const tree = processor.parse(markdown);
  return `<section class="document${index > 0 ? ' page-break' : ''}">${renderNode(tree)}</section>`;
});

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>VIZZIO Deployment Platform — Full Documentation Guide</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 20mm; }
    * { box-sizing: border-box; }
    body { color: #172033; font: 10.5pt/1.55 Arial, sans-serif; margin: 0; }
    .cover { align-items: center; display: flex; flex-direction: column; height: 245mm; justify-content: center; text-align: center; }
    .cover h1 { color: #0f3fbf; font-size: 30pt; margin: 0 0 12mm; }
    .cover p { color: #526079; font-size: 15pt; }
    h1 { color: #123aa5; font-size: 22pt; margin: 0 0 8mm; }
    h2 { border-bottom: 1px solid #d8deea; color: #183a8f; font-size: 16pt; margin: 9mm 0 4mm; padding-bottom: 2mm; }
    h3 { color: #273b6a; font-size: 13pt; margin: 6mm 0 2mm; }
    h4 { font-size: 11pt; margin: 5mm 0 2mm; }
    p, ul, ol, pre, table, blockquote { margin: 0 0 4mm; }
    li { margin-bottom: 1mm; }
    code { background: #f0f3f8; border-radius: 2px; font: 9pt Consolas, monospace; padding: 1px 3px; }
    pre { background: #f3f5f9; border: 1px solid #d8deea; border-radius: 4px; overflow-wrap: anywhere; padding: 4mm; white-space: pre-wrap; }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; font-size: 8.5pt; width: 100%; }
    td { border: 1px solid #cbd3e1; padding: 2mm; vertical-align: top; }
    tr:first-child td { background: #e8eefc; font-weight: bold; }
    blockquote { border-left: 3px solid #5277d7; color: #46536d; padding-left: 4mm; }
    a { color: #164fc4; overflow-wrap: anywhere; }
    .page-break { break-before: page; }
    h1, h2, h3, h4 { break-after: avoid; }
    pre, table, blockquote { break-inside: avoid; }
  </style>
</head>
<body>
  <section class="cover">
    <h1>VIZZIO Deployment Platform</h1>
    <p>Full Documentation Guide</p>
    <p>Technical · Deployment · Administration · Launcher · Operations · Handover</p>
  </section>
  ${sections.join('\n')}
</body>
</html>`;

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(htmlPath, html, 'utf8');

const browserCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const browser = browserCandidates.find(existsSync);

if (!browser) {
  throw new Error('Microsoft Edge or Google Chrome is required to generate the PDF.');
}

rmSync(pdfPath, { force: true });
execFileSync(browser, [
  '--headless',
  '--disable-gpu',
  '--no-pdf-header-footer',
  `--print-to-pdf=${pdfPath}`,
  new URL(`file:///${htmlPath.replaceAll('\\', '/')}`).href,
], { stdio: 'inherit' });
rmSync(htmlPath, { force: true });

if (!existsSync(pdfPath)) {
  throw new Error(`PDF generation did not create ${pdfPath}.`);
}

console.log(`Generated ${pdfPath}`);
