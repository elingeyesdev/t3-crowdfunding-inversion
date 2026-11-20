import type { Message } from '../api/chat.api';

export function mergeChatMessages(current: Message[], incoming: Message[]): Message[] {
  return [...new Map([...current, ...incoming].map(message => [message.id, message])).values()]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id));
}
