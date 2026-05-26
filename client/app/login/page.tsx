'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { AuthShell } from '@/components/auth/auth-shell';
import { loginRequest } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth-store';

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    if (token) {
      router.replace('/lobby');
    }
  }, [token, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await loginRequest({
        username: username.trim(),
        password
      });

      setSession(response.token, response.user);
      router.replace('/lobby');
      setPassword('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to login right now.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Login"
      subtitle="Return to the battlefield and reclaim your Zodiac glory."
      alternateActionLabel="No account yet?"
      alternateActionHref="/register"
      alternateActionText="Create one"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-cyan-200/90">Username</span>
          <input
            autoComplete="username"
            className="moba-input"
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter your commander name"
            required
            value={username}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-cyan-200/90">Password</span>
          <input
            autoComplete="current-password"
            className="moba-input"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your secure password"
            required
            type="password"
            value={password}
          />
        </label>

        {errorMessage ? <p className="text-sm text-rose-300">{errorMessage}</p> : null}

        <button className="moba-button w-full" disabled={isLoading} type="submit">
          {isLoading ? 'Signing in...' : 'Enter Arena'}
        </button>
      </form>
    </AuthShell>
  );
}
