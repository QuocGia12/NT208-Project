'use client';

import { FormEvent, useState } from 'react';

import { AuthShell } from '@/components/auth/auth-shell';
import { registerRequest } from '@/lib/api/auth';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Username and password are required.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Password confirmation does not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await registerRequest({
        username: username.trim(),
        password,
        avatar: avatar.trim() || undefined
      });

      setSuccessMessage(`Account created for ${response.user.username}. You can now login.`);
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to register right now.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Register"
      subtitle="Forge your legend before the 12 Zodiac war begins."
      alternateActionLabel="Already have an account?"
      alternateActionHref="/login"
      alternateActionText="Go to login"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-cyan-200/90">Username</span>
          <input
            autoComplete="username"
            className="moba-input"
            maxLength={20}
            minLength={3}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Pick your warrior name"
            required
            value={username}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-cyan-200/90">Password</span>
          <input
            autoComplete="new-password"
            className="moba-input"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Set a secure password"
            required
            type="password"
            value={password}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-cyan-200/90">Confirm Password</span>
          <input
            autoComplete="new-password"
            className="moba-input"
            minLength={6}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat your password"
            required
            type="password"
            value={confirmPassword}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-cyan-200/90">
            Avatar URL (optional)
          </span>
          <input
            className="moba-input"
            onChange={(event) => setAvatar(event.target.value)}
            placeholder="https://example.com/avatar.png"
            type="url"
            value={avatar}
          />
        </label>

        {errorMessage ? <p className="text-sm text-rose-300">{errorMessage}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-300">{successMessage}</p> : null}

        <button className="moba-button w-full" disabled={isLoading} type="submit">
          {isLoading ? 'Creating account...' : 'Join the War'}
        </button>
      </form>
    </AuthShell>
  );
}
