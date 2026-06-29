'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import {
  AuthImageButton,
  AuthInput,
  AuthPanel,
  AuthTextButtonLink,
  FigmaAuthScene
} from '@/components/auth/figma-auth-scene';
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
      setErrorMessage('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await loginRequest({
        username: username.trim(),
        password
      });

      setSession(response.token, response.user, response.streak);
      setPassword('');
      router.replace('/lobby-streak');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể đăng nhập vào lúc này. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FigmaAuthScene
      frameAlt="Khung dang nhap"
      frameHeight={728}
      frameSrc="/game-ui/sign-up-and-login/Background_Login.svg"
      frameTop={176}
      frameWidth={664}
      logMessage={errorMessage ?? (isLoading ? 'Đang đăng nhập...' : 'Xin mời đăng nhập')}
    >
      <AuthPanel>
        <form className="absolute inset-0" onSubmit={handleSubmit}>
          <div className="absolute left-[18.95%] top-[28.7%] w-[61.6%]">
            <AuthInput
              assetSrc="/game-ui/sign-up-and-login/input_username.svg"
              inputProps={{
                autoComplete: 'username',
                maxLength: 20,
                onChange: (event) => setUsername(event.target.value),
                placeholder: 'Tên đăng nhập',
                required: true,
                value: username
              }}
            />
          </div>

          <div className="absolute left-[18.95%] top-[43.1%] w-[61.6%]">
            <AuthInput
              assetSrc="/game-ui/sign-up-and-login/input_password.svg"
              inputProps={{
                autoComplete: 'current-password',
                minLength: 6,
                onChange: (event) => setPassword(event.target.value),
                placeholder: 'Mật khẩu',
                required: true,
                type: 'password',
                value: password
              }}
            />
          </div>

          <AuthImageButton
            alt="Vao choi"
            className="absolute left-[5.4%] top-[55%] aspect-[593/189] w-[89.3%]"
            disabled={isLoading}
            src="/game-ui/sign-up-and-login/btn_Login.svg"
            type="submit"
          />

          <AuthTextButtonLink
            alt="Dang ky"
            className="absolute left-[31.4%] top-[53%] aspect-[246/67] w-[37.05%]"
            href="/register"
            src="/game-ui/sign-up-and-login/btn_SignUp.svg"
          />
        </form>
      </AuthPanel>
    </FigmaAuthScene>
  );
}
