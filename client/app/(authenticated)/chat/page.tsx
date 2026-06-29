'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { fetchConversations, fetchMessages, sendMessage } from '@/lib/api/chat';
import type { ChatConversation, ChatMessage } from '@/lib/types/chat';
import { useAuthStore } from '@/store/auth-store';

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

const formatRelativeDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  });

const dedupeMessages = (messages: ChatMessage[]) => {
  const seen = new Set<string>();
  const result: ChatMessage[] = [];

  for (const message of messages) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    result.push(message);
  }

  return result;
};

export default function ChatPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const messageBottomRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(false);
  const prependScrollStateRef = useRef<{ previousHeight: number; previousTop: number } | null>(
    null
  );

  const selectedConversation = useMemo(
    () =>
      selectedFriendId
        ? conversations.find((item) => item.friend.id === selectedFriendId) ?? null
        : null,
    [conversations, selectedFriendId]
  );

  const loadConversations = useCallback(async () => {
    if (!token) return;

    setIsLoadingConversations(true);

    try {
      const response = await fetchConversations(token);
      setConversations(response.conversations);
      setErrorMessage(null);

      if (response.conversations.length === 0) {
        setSelectedFriendId(null);
        return;
      }

      setSelectedFriendId((prev) => {
        if (prev && response.conversations.some((item) => item.friend.id === prev)) {
          return prev;
        }

        return response.conversations[0].friend.id;
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Không thể tải cuộc trò chuyện.'
      );
    } finally {
      setIsLoadingConversations(false);
    }
  }, [token]);

  const loadMessages = useCallback(
    async (
      friendId: string,
      options?: {
        cursor?: string;
        appendOlder?: boolean;
        mergeLatest?: boolean;
        silent?: boolean;
      }
    ) => {
      if (!token) return;

      if (options?.appendOlder) {
        setIsLoadingOlder(true);
      } else if (!options?.silent) {
        setIsLoadingMessages(true);
      }

      try {
        const listEl = messageListRef.current;
        const isNearBottom = listEl
          ? listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 120
          : true;

        if (options?.appendOlder && listEl) {
          prependScrollStateRef.current = {
            previousHeight: listEl.scrollHeight,
            previousTop: listEl.scrollTop
          };
        } else {
          prependScrollStateRef.current = null;
        }

        shouldAutoScrollRef.current = options?.appendOlder
          ? false
          : options?.mergeLatest
            ? isNearBottom
            : true;

        const response = await fetchMessages(token, friendId, {
          cursor: options?.cursor,
          limit: 30
        });

        setMessages((prev) => {
          if (options?.appendOlder) {
            return dedupeMessages([...response.messages, ...prev]);
          }

          if (options?.mergeLatest) {
            const existingIds = new Set(prev.map((item) => item.id));
            const incoming = response.messages.filter((item) => !existingIds.has(item.id));

            if (incoming.length === 0) {
              return prev;
            }

            return [...prev, ...incoming];
          }

          return dedupeMessages(response.messages);
        });

        if (options?.mergeLatest) {
          setNextCursor((prev) => prev ?? response.nextCursor);
        } else {
          setNextCursor(response.nextCursor);
        }

        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Không thể tải tin nhắn.');
      } finally {
        if (!options?.silent) {
          setIsLoadingMessages(false);
        }
        setIsLoadingOlder(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    void loadConversations();
  }, [token, loadConversations]);

  useEffect(() => {
    if (!selectedFriendId) {
      setMessages([]);
      setNextCursor(null);
      return;
    }

    void loadMessages(selectedFriendId);
  }, [selectedFriendId, loadMessages]);

  useEffect(() => {
    if (!selectedFriendId || !token) return;

    const intervalId = window.setInterval(() => {
      void loadMessages(selectedFriendId, { mergeLatest: true, silent: true });
      void loadConversations();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedFriendId, token, loadMessages, loadConversations]);

  useEffect(() => {
    const listEl = messageListRef.current;
    if (!listEl) return;

    const prependState = prependScrollStateRef.current;
    if (prependState) {
      const diff = listEl.scrollHeight - prependState.previousHeight;
      listEl.scrollTop = prependState.previousTop + diff;
      prependScrollStateRef.current = null;
      return;
    }

    if (shouldAutoScrollRef.current) {
      messageBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldAutoScrollRef.current = false;
    }
  }, [messages]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token || !selectedFriendId || isSending) {
      return;
    }

    const content = draft.trim();

    if (content.length === 0) {
      setErrorMessage('Tin nhắn không được để trống.');
      return;
    }

    setIsSending(true);

    try {
      const response = await sendMessage(token, selectedFriendId, content);

      setMessages((prev) => dedupeMessages([...prev, response.message]));
      setDraft('');
      setErrorMessage(null);
      setSuccessMessage('Đã gửi tin nhắn.');
      window.setTimeout(() => setSuccessMessage(null), 1800);
      void loadConversations();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể gửi tin nhắn.');
    } finally {
      setIsSending(false);
    }
  };

  const handleLoadOlder = async () => {
    if (!selectedFriendId || !nextCursor || isLoadingOlder) return;

    await loadMessages(selectedFriendId, {
      cursor: nextCursor,
      appendOlder: true
    });
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="panel-container panel-container-chat">
        <img
          src="/images/ui-game/panel-inbox.png"
          className="panel-bg pointer-events-none"
          alt=""
        />

        <div className="panel-content">
          <section className="chat-layout-shell">
            <aside
              className="chat-friends-sidebar friends-panel flex min-h-0 flex-col animate-fade-in-up"
              style={{ animationDelay: '70ms' }}
            >
              <h2 className="moba-heading text-xs uppercase tracking-[0.14em] text-cyan-200">
                BẠN BÈ
              </h2>

              {isLoadingConversations ? (
                <p className="mt-4 text-sm text-slate-300/80">Đang tải cuộc trò chuyện...</p>
              ) : errorMessage ? (
                <div className="mt-4 rounded-2xl border border-cyan-300/35 bg-gradient-to-br from-cyan-900/55 to-blue-900/35 p-6 text-center">
                  <p className="text-sm text-slate-300/90">
                    Chưa thể tải cuộc trò chuyện bạn bè lúc này.
                  </p>
                </div>
              ) : conversations.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-cyan-300/35 bg-gradient-to-br from-cyan-900/55 to-blue-900/35 p-6 text-center">
                  <p className="text-sm text-slate-300/90">
                    Bạn chưa có bạn bè để trò chuyện.
                  </p>
                </div>
              ) : (
                <div className="chat-conversation-list mt-4 max-h-[360px] space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[420px]">
                  {conversations.map((conversation) => {
                    const isActive = conversation.friend.id === selectedFriendId;
                    const preview = conversation.lastMessage
                      ? `${conversation.lastMessage.isOwnMessage ? 'Bạn: ' : ''}${conversation.lastMessage.content}`
                      : 'Chưa có tin nhắn';

                    return (
                      <button
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          isActive
                            ? 'border-cyan-300/70 bg-cyan-700/20 shadow-[0_0_20px_rgba(34,211,238,0.12)]'
                            : 'border-cyan-700/30 bg-slate-900/50 hover:border-cyan-400/50'
                        }`}
                        key={conversation.friend.id}
                        onClick={() => setSelectedFriendId(conversation.friend.id)}
                        type="button"
                      >
                        <p className="truncate text-sm font-bold uppercase tracking-[0.08em] text-amber-100">
                          {conversation.friend.username}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-300/80">{preview}</p>
                        <p className="mt-1 text-[0.68rem] text-slate-500">
                          {conversation.lastMessage
                            ? formatRelativeDate(conversation.lastMessage.createdAt)
                            : '-'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            <div className="chat-right-column space-y-4">
              <header className="friends-header-panel animate-fade-in-up">
                <p className="moba-heading text-xs uppercase tracking-[0.24em] text-cyan-300/90">
                  CHAT BẠN BÈ
                </p>
                <h1 className="moba-heading mt-1 text-2xl uppercase tracking-[0.12em] text-amber-100">
                  Hộp thư đồng đội
                </h1>
                <p className="mt-2 text-sm text-slate-300/85">
                  Chỉ có thể trò chuyện với bạn bè đã chấp nhận.
                </p>
              </header>

              {errorMessage ? (
                <div className="friends-alert friends-alert-error animate-fade-in">{errorMessage}</div>
              ) : null}

              {successMessage ? (
                <div className="friends-alert friends-alert-success animate-fade-in">
                  {successMessage}
                </div>
              ) : null}

              <div
                className="chat-main-panel friends-panel min-h-0 animate-fade-in-up"
                style={{ animationDelay: '120ms' }}
              >
                {!selectedConversation ? (
                  <div className="flex h-full min-h-[260px] items-center justify-center rounded-2xl border border-cyan-300/35 bg-gradient-to-br from-cyan-900/55 to-blue-900/35 p-6 text-center">
                    <p className="text-sm text-slate-300/90">Chọn một người bạn để bắt đầu trò chuyện.</p>
                  </div>
                ) : (
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="mb-3 flex items-center justify-between border-b border-cyan-400/15 pb-3">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-[0.08em] text-amber-100">
                          {selectedConversation.friend.username}
                        </p>
                        <p className="text-[0.68rem] text-slate-400">Trò chuyện riêng với bạn bè</p>
                      </div>
                      {nextCursor ? (
                        <button
                          className="friends-action-button friends-action-button-muted"
                          disabled={isLoadingOlder}
                          onClick={handleLoadOlder}
                          type="button"
                        >
                          {isLoadingOlder ? 'Đang tải...' : 'Tải tin cũ'}
                        </button>
                      ) : null}
                    </div>

                    <div
                      className="chat-message-list min-h-[240px] max-h-[360px] space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-cyan-700/25 bg-slate-950/35 p-3 sm:max-h-[420px] lg:max-h-[440px]"
                      ref={messageListRef}
                    >
                      {isLoadingMessages ? (
                        <p className="text-sm text-slate-300/80">Đang tải tin nhắn...</p>
                      ) : messages.length === 0 ? (
                        <p className="text-sm text-slate-300/80">
                          Chưa có tin nhắn. Hãy chào {selectedConversation.friend.username}.
                        </p>
                      ) : (
                        messages.map((message) => (
                          <div
                            className={`flex ${message.isOwnMessage ? 'justify-end' : 'justify-start'}`}
                            key={message.id}
                          >
                            <div
                              className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow ${
                                message.isOwnMessage
                                  ? 'bg-cyan-600/35 text-cyan-100 border border-cyan-300/35'
                                  : 'bg-slate-800/70 text-slate-100 border border-slate-600/60'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                              <p className="mt-1 text-[0.64rem] text-slate-300/70">
                                {formatTime(message.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={messageBottomRef} />
                    </div>

                    <form className="chat-compose-form mt-3 flex gap-2" onSubmit={handleSend}>
                      <input
                        className="moba-input"
                        maxLength={1000}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Nhập tin nhắn..."
                        value={draft}
                      />
                      <button
                        className="moba-button min-w-[120px]"
                        disabled={isSending}
                        type="submit"
                      >
                        {isSending ? 'Đang gửi...' : 'Gửi'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
      <button
        className="panel-back-button"
        onClick={() => router.push('/lobby')}
        type="button"
      >
        <img src="/images/ui-game/btn-back.png" className="w-full" alt="Trở về" />
      </button>
    </div>
  );
}

