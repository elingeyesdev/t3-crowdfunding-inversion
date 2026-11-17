import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Compile this standalone TSX view in memory; no browser or generated files.
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('/PublicEvidenceDocuments.tsx')) return nextLoad(url, context);
    const source = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText;
    return { format: 'module', source, shortCircuit: true };
  },
});
const { PublicEvidenceDocuments } = await import('../src/components/campaign-detail/transparency/PublicEvidenceDocuments.tsx');
const render = props => renderToStaticMarkup(createElement(PublicEvidenceDocuments, props));

test('a load error shows a retry action instead of an empty-document message', () => {
  const html = render({ documents: [], error: 'No se pudieron cargar las evidencias.', onRetry() {} });
  assert.match(html, /role="alert"/);
  assert.match(html, /Reintentar/);
  assert.doesNotMatch(html, /No hay evidencias públicas disponibles/);
});

test('only a successful empty query shows the empty-document message', () => {
  const html = render({ documents: [] });
  assert.match(html, /No hay evidencias públicas disponibles/);
  assert.doesNotMatch(html, /role="alert"/);
  assert.doesNotMatch(html, /Reintentar/);
});

test('loading hides both stale documents and the empty message', () => {
  const html = render({ documents: [], loading: true });
  assert.match(html, /Cargando evidencias públicas/);
  assert.doesNotMatch(html, /No hay evidencias públicas disponibles/);
});

test('authorized evidence shows its actual download link without internal review or cryptographic claims', () => {
  const html = render({ documents: [{ id: 'document', campaignId: 'campaign', originalName: 'Evidencia.pdf', mimeType: 'application/pdf', fileSizeBytes: 1024, justification: 'Compra de materiales', status: 'approved', createdAt: '2026-11-17T18:00:00Z', fileUrl: '/api/v1/campaigns/public/campaign/documents/document/file' }] });
  assert.match(html, /Evidencia.pdf/);
  assert.match(html, /href="\/api\/v1\/campaigns\/public\/campaign\/documents\/document\/file"/);
  assert.doesNotMatch(html, /Firma Criptográfica|En Revisión|sellos temporales inmutables/);
});
