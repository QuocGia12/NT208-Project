import type { AuthUser, LoginStreakStatus } from '@/lib/types/auth';

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
    // Ignore malformed payloads.
  }

  return 'Request failed. Please try again.';
};

export const fetchLoginStreak = async (token: string): Promise<LoginStreakStatus> => {
  const response = await fetch(`${API_BASE_URL}/api/users/me/login-streak`, {
    method: 'GET',
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = (await response.json()) as { streak: LoginStreakStatus };
  return data.streak;
};

export const claimLoginStreak = async (
  token: string
): Promise<{
  reward: LoginStreakStatus['todayReward'];
  streak: LoginStreakStatus;
  user: AuthUser;
}> => {
  const response = await fetch(`${API_BASE_URL}/api/users/me/login-streak/claim`, {
    method: 'POST',
    headers: authHeaders(token)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as {
    reward: LoginStreakStatus['todayReward'];
    streak: LoginStreakStatus;
    user: AuthUser;
  };
};
