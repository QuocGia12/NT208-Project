import type {
  FetchConversationsResponse,
  FetchMessagesResponse,
  SendMessageResponse
} from '@/lib/types/chat';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const authHeaders = (token: string): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
});

const parseErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === 'string' && data.error.length > 0) {
      return data.error;
    }
  } catch {
    // Ignore malformed error payloads.
  }

  return 'Request failed. Please try again.';
};

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as T;
};

export const fetchConversations = (token: string) =>
  request<FetchConversationsResponse>('/api/chat/conversations', {
    method: 'GET',
    headers: authHeaders(token)
  });

export const fetchMessages = (
  token: string,
  friendId: string,
  options?: { cursor?: string; limit?: number }
) => {
  const params = new URLSearchParams();

  if (options?.cursor) {
    params.set('cursor', options.cursor);
  }

  if (options?.limit && options.limit > 0) {
    params.set('limit', String(options.limit));
  }

  const query = params.toString();

  return request<FetchMessagesResponse>(
    `/api/chat/messages/${encodeURIComponent(friendId)}${query ? `?${query}` : ''}`,
    {
      method: 'GET',
      headers: authHeaders(token)
    }
  );
};

export const sendMessage = (token: string, friendId: string, content: string) =>
  request<SendMessageResponse>(`/api/chat/messages/${encodeURIComponent(friendId)}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ content })
  });
