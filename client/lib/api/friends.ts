import type {
  FriendListResponse,
  PendingRequestsResponse,
  RespondFriendRequestAction,
  RespondFriendRequestResponse,
  SearchUsersResponse,
  SendFriendRequestPayload,
  SendFriendRequestResponse
} from '@/lib/types/friend';

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

export const searchUsers = (token: string, query: string) =>
  request<SearchUsersResponse>(
    `/api/friends/search?query=${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers: authHeaders(token)
    }
  );

export const sendFriendRequest = (token: string, payload: SendFriendRequestPayload) =>
  request<SendFriendRequestResponse>('/api/friends/requests', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload)
  });

export const fetchPendingRequests = (token: string) =>
  request<PendingRequestsResponse>('/api/friends/requests/pending', {
    method: 'GET',
    headers: authHeaders(token)
  });

export const respondToFriendRequest = (
  token: string,
  requestId: string,
  action: RespondFriendRequestAction
) =>
  request<RespondFriendRequestResponse>(`/api/friends/requests/${requestId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ action })
  });

export const fetchFriendList = (token: string) =>
  request<FriendListResponse>('/api/friends', {
    method: 'GET',
    headers: authHeaders(token)
  });
