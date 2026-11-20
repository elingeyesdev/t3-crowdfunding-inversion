import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'MouseEvent', 'Event']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = { getItem: key => key === 'userId' ? 'receiver' : 'receiver-token' };
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
globalThis.requestAnimationFrame = fn => fn();
const { createRoot } = await import('react-dom/client');
const virtual = name => new URL('./__chat_'+name+'.mjs', import.meta.url).href;
let echo;
class FakeEcho {
  constructor() {
    echo = this;
    this.channels = new Map();
    this.events = new Map();
    this.connector = { pusher: { connection: { bind: (name, callback) => this.events.set(name, callback) } } };
  }
  private(name) {
    if (!this.channels.has(name)) this.channels.set(name, {
      listen(name, callback) { this.message = callback; return this; },
      subscribed(callback) { this.ready = callback; return this; },
      listenForWhisper() { return this; }, whisper() {},
    });
    return this.channels.get(name);
  }
  leave(name) { this.channels.delete(name); }
  disconnect() { this.disposed = true; }
  connect() { this.events.get('connected')?.(); this.private('users.receiver').ready?.(); }
  offline() { this.events.get('disconnected')?.(); }
  emit(message) { this.private('users.receiver').message?.({ message }); }
}
globalThis.__FakeChatEcho = FakeEcho;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'laravel-echo') return { url: virtual('echo'), shortCircuit: true };
    if (specifier === 'pusher-js') return { url: virtual('pusher'), shortCircuit: true };
    if (specifier.endsWith('/Navbar')) return { url: virtual('navbar'), shortCircuit: true };
    if (['/ConversationsSidebar', '/ChatWindow'].some(path => specifier.endsWith(path))) return nextResolve(specifier + '.tsx', context);
    if (['/useChat', '/chat.api', '/image.utils', '/chatMessages'].some(path => specifier.endsWith(path))) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === virtual('echo')) return { format: 'module', shortCircuit: true, source: 'export default globalThis.__FakeChatEcho;' };
    if (url === virtual('pusher')) return { format: 'module', shortCircuit: true, source: 'export default class Pusher {}' };
    if (url === virtual('navbar')) return { format: 'module', shortCircuit: true, source: 'export function Navbar() { return null; }' };
    if (!url.includes('/frontend/src/') || (!url.endsWith('.tsx') && !url.endsWith('/useChat.ts'))) return nextLoad(url, context);
    const source = readFileSync(new URL(url), 'utf8').replaceAll('import.meta.env', '({ VITE_REVERB_APP_KEY: "test-key" })');
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
const sender = { id: 'sender', fullName: 'Persona remitente', firstName: 'Persona', lastName: 'Remitente', email: 'sender@example.test', avatar: null };
let store, reads, listCalls, messageCalls, holdList, heldList, failList, failMessages;
const originalAdapter = axios.defaults.adapter;
function persist(id, content, conversationId = 'new-chat', senderId = 'sender') {
  if (!store.has(conversationId)) store.set(conversationId, { messages: [], unread: 0 });
  const chat = store.get(conversationId);
  const message = { id, content, conversationId, senderId, sender, messageType: 'text', isEdited: false, createdAt: new Date(Date.UTC(2026, 10, 20, 12, 0, Number(id.replace(/\D/g, '')) || 0)).toISOString() };
  if (!chat.messages.some(item => item.id === id)) { chat.messages.push(message); if (senderId !== 'receiver') chat.unread++; }
  return message;
}
function snapshot() {
  return [...store].map(([id, chat]) => {
    const latest = chat.messages.at(-1);
    return { id, subject: null, campaignId: null, campaignTitle: 'Proyecto '+id, campaignCover: null, status: 'active', lastMessageAt: latest?.createdAt, messageCount: chat.messages.length, unreadCount: chat.unread, otherUser: sender, lastMessage: latest ? { content: latest.content, senderId: latest.senderId, createdAt: latest.createdAt } : null };
  });
}
axios.defaults.adapter = async config => {
  assert.equal(config.headers.Authorization, 'Bearer receiver-token');
  let data;
  if (config.url === '/chat/conversations') {
    listCalls++;
    if (failList) throw new axios.AxiosError('Unavailable', 'ERR_NETWORK', config);
    data = structuredClone(snapshot());
    if (holdList) { holdList = false; await new Promise(resolve => { heldList = resolve; }); }
  } else {
    const id = config.url.split('/')[3];
    const chat = store.get(id);
    if (config.url.endsWith('/read')) { chat.unread = 0; reads++; data = null; }
    else if (config.method === 'post') {
      data = persist('m999', JSON.parse(config.data).content, id, 'receiver');
      echo.emit(data);
    }
    else {
      messageCalls++;
      if (failMessages) throw new axios.AxiosError('Unavailable', 'ERR_NETWORK', config);
      const all = chat.messages;
      const end = config.params?.beforeId ? all.findIndex(message => message.id === config.params.beforeId) : all.length;
      data = structuredClone(all.slice(0, end).slice(-(config.params?.limit || 50)));
    }
  }
  return { data: { data }, config, headers: {}, status: 200, statusText: 'OK' };
};
const { ChatPage } = await import('../src/pages/ChatPage.tsx');
let container, root;
beforeEach(() => {
  store = new Map(); reads = 0; listCalls = 0; messageCalls = 0;
  holdList = false; heldList = null; failList = false; failMessages = false;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); assert.equal(echo.disposed, true); });
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); delete globalThis.__FakeChatEcho; });
const click = async node => { assert.ok(node); await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); };
async function mount(t, path = '/chat') {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: [path] }, createElement(Routes, null,
    createElement(Route, { path: '/chat/:conversationId?', element: createElement(ChatPage) })))));
  await act(async () => echo.connect());
}
const rows = () => [...container.querySelectorAll('li')];
const bubbles = () => [...container.querySelectorAll('.whitespace-pre-wrap')].map(node => node.textContent);
const incoming = async message => act(async () => echo.emit(message));

test('a first message from another session adds the new chat with its actual unread count', async t => {
  await mount(t);
  assert.match(container.textContent, /No tienes conversaciones/);
  const message = persist('m1', 'Primer mensaje');
  await incoming(message);
  assert.equal(rows().length, 1);
  assert.match(rows()[0].textContent, /Primer mensaje/);
  assert.equal(rows()[0].querySelector('span').textContent, '1');
  await incoming(message);
  assert.equal(rows().length, 1);
  assert.equal(rows()[0].querySelector('span').textContent, '1');
});

test('new activity reorders existing conversations without double-counting or replacing newer data', async t => {
  persist('m1', 'Anterior', 'older'); persist('m2', 'Reciente', 'other');
  await mount(t);
  assert.match(rows()[0].textContent, /Proyecto other/);
  await incoming(persist('m3', 'Ahora primero', 'older'));
  assert.match(rows()[0].textContent, /Ahora primero/);
  assert.equal(rows()[0].querySelector('span').textContent, '2');
  await incoming(store.get('older').messages[0]);
  assert.match(rows()[0].textContent, /Ahora primero/);
});

test('an open chat renders an incoming message once and confirms reading without duplicate increments', async t => {
  persist('m1', 'Inicial');
  await mount(t, '/chat/new-chat');
  const message = persist('m2', 'En vivo');
  await incoming(message); await incoming(message);
  assert.deepEqual(bubbles(), ['Inicial', 'En vivo']);
  assert.equal(store.get('new-chat').unread, 0);
  assert.ok(reads > 0);
  assert.equal(rows().length, 1);
});

test('a burst of socket messages in the same render retains every message exactly once', async t => {
  persist('m1', 'Inicial'); await mount(t, '/chat/new-chat');
  await act(async () => {
    echo.emit(persist('m2', 'Ráfaga uno'));
    echo.emit(persist('m3', 'Ráfaga dos'));
    echo.emit(persist('m4', 'Ráfaga tres'));
  });
  assert.deepEqual(bubbles(), ['Inicial', 'Ráfaga uno', 'Ráfaga dos', 'Ráfaga tres']);
  assert.equal(store.get('new-chat').unread, 0);
});

test('sending with both a socket echo and HTTP acknowledgement renders one message without unread increments', async t => {
  persist('m1', 'Inicial'); await mount(t, '/chat/new-chat');
  const textarea = container.querySelector('textarea');
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'Mi respuesta');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click(container.querySelector('button[aria-label="Enviar mensaje"]'));
  assert.deepEqual(bubbles(), ['Inicial', 'Mi respuesta']);
  assert.equal(store.get('new-chat').messages.length, 2);
  assert.equal(store.get('new-chat').unread, 0);
});

test('reconnection recovers unknown conversations and more than one page of missed active messages', async t => {
  persist('m1', 'Antes de desconectar');
  await mount(t, '/chat/new-chat');
  await act(async () => echo.offline());
  for (let i = 2; i <= 62; i++) persist('m'+i, 'Perdido '+i);
  persist('m63', 'Chat creado sin conexión', 'offline-chat');
  await act(async () => echo.connect());
  assert.equal(rows().length, 2);
  assert.equal(bubbles().length, 62);
  assert.equal(new Set(bubbles()).size, 62);
  assert.ok(messageCalls >= 3);
  assert.match(rows()[0].textContent, /Chat creado sin conexión/);
  assert.equal(store.get('offline-chat').unread, 1);
  assert.equal(store.get('new-chat').unread, 0);
});

test('events during an in-flight list request trigger a fresh snapshot instead of losing the second message', async t => {
  await mount(t);
  holdList = true;
  await incoming(persist('m1', 'Primero'));
  await incoming(persist('m2', 'Segundo'));
  assert.equal(typeof heldList, 'function');
  await act(async () => heldList());
  assert.equal(rows().length, 1);
  assert.match(rows()[0].textContent, /Segundo/);
  assert.equal(rows()[0].querySelector('span').textContent, '2');
});

test('a synchronization failure preserves existing chats and offers a working retry', async t => {
  persist('m1', 'Conservado'); await mount(t);
  failList = true;
  await incoming(persist('m2', 'Pendiente de sincronizar', 'retry-chat'));
  assert.match(container.querySelector('[role="alert"]').textContent, /sincronizar/);
  assert.equal(rows().length, 1);
  failList = false;
  await click([...container.querySelectorAll('button')].find(node => node.textContent === 'Reintentar'));
  assert.equal(rows().length, 2);
  assert.equal(container.querySelector('[role="alert"]'), null);
});

test('failed history recovery keeps the existing messages and retry recovers missed messages', async t => {
  persist('m1', 'Conservado'); await mount(t, '/chat/new-chat');
  await act(async () => echo.offline());
  persist('m2', 'Recuperado'); failMessages = true;
  await act(async () => echo.connect());
  assert.deepEqual(bubbles(), ['Conservado']);
  assert.match(container.textContent, /No se pudieron recuperar los mensajes/);
  failMessages = false;
  await click([...container.querySelectorAll('button')].find(node => node.textContent === 'Reintentar'));
  assert.deepEqual(bubbles(), ['Conservado', 'Recuperado']);
});
