import type {
  LeaderboardResponse,
  MyProfileResponse,
  PublicProfileResponse
} from '@/lib/types/user';
import type { AuthUser } from '@/lib/types/auth';

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

export const fetchMyProfile = async (token: string): Promise<MyProfileResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/users/me`, {
    method: 'GET',
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as MyProfileResponse;
};

export const fetchUserProfile = async (
  token: string,
  username: string
): Promise<PublicProfileResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/api/users/${encodeURIComponent(username)}`,
    {
      method: 'GET',
      headers: authHeaders(token)
    }
  );

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as PublicProfileResponse;
};

export const fetchLeaderboard = async (
  token: string
): Promise<LeaderboardResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/users/leaderboard`, {
    method: 'GET',
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as LeaderboardResponse;
};

export const changeMyPassword = async (
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/users/me/password`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ currentPassword, newPassword })
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = (await response.json()) as { message?: string };
  return data.message ?? 'Password updated successfully.';
};

export const updateMyAvatar = async (
  token: string,
  avatar: string | null
): Promise<AuthUser> => {
  const response = await fetch(`${API_BASE_URL}/api/users/me/avatar`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ avatar })
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = (await response.json()) as { user: AuthUser };
  return data.user;
};
