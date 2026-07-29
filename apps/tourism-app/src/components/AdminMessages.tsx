'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui';
import { Card, CardContent } from '@/components/ui/Card';

interface Conversation {
  bookingId: string;
  guest: { firstName: string; lastName: string };
  hotel: { name: string };
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  text: string;
  senderRole: string;
  createdAt: string;
}

const POLL_INTERVAL_MS = 8000;

export function AdminMessages() {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchConversations = useCallback(() => {
    return apiClient('/messages/conversations')
      .then((data) => setConversations(data || []))
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')));
  }, [t]);

  useEffect(() => {
    fetchConversations().finally(() => setLoading(false));
    const interval = setInterval(fetchConversations, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const fetchThread = useCallback(() => {
    if (!selected) return;
    apiClient(`/messages?bookingId=${selected}`)
      .then((data) => setMessages(data || []))
      .catch(() => {});
  }, [selected]);

  useEffect(() => {
    fetchThread();
    const interval = setInterval(fetchThread, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchThread]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !selected) return;

    setSending(true);
    try {
      await apiClient('/messages', {
        method: 'POST',
        body: JSON.stringify({ bookingId: selected, text: text.trim() }),
      });
      setText('');
      await fetchThread();
      await fetchConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-gray-500">{t('common.loading')}</div>;
  }

  const activeConversation = conversations.find((c) => c.bookingId === selected);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('services.chatTitle')}</h1>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="max-h-[32rem] overflow-y-auto p-0">
            {conversations.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500">{t('services.noMessages')}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {conversations.map((conv) => (
                  <li key={conv.bookingId}>
                    <button
                      type="button"
                      onClick={() => setSelected(conv.bookingId)}
                      className={`w-full px-4 py-3 text-left transition ${
                        selected === conv.bookingId ? 'bg-primary-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-800">
                          {conv.guest.firstName} {conv.guest.lastName}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{conv.hotel.name}</p>
                      <p className="truncate text-sm text-gray-500">{conv.lastMessage}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="flex h-[32rem] flex-col p-4">
            {!activeConversation ? (
              <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
                {t('services.selectConversation')}
              </div>
            ) : (
              <>
                <div className="mb-3 border-b border-gray-100 pb-2">
                  <p className="font-medium text-gray-800">
                    {activeConversation.guest.firstName} {activeConversation.guest.lastName}
                  </p>
                  <p className="text-xs text-gray-400">{activeConversation.hotel.name}</p>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.senderRole === 'STAFF' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          msg.senderRole === 'STAFF'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSend} className="mt-3 flex gap-2">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t('services.messagePlaceholder')}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <Button type="submit" size="sm" loading={sending}>
                    {t('services.send')}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
