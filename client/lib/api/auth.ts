import {
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse
} from '@/lib/types/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const parseErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === 'string' && data.error.length > 0) {
      return data.error;
    }
  } catch {
    // Ignore malformed error payloads and fallback to generic text.
  }

  return 'Request failed. Please try again.';
};

const request = async <T>(path: string, init: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as T;
};

export const registerRequest = (payload: RegisterPayload) =>
  request<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

export const loginRequest = (payload: LoginPayload) =>
  request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
