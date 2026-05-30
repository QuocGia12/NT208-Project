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
import { registerRequest } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth-store';

export default function RegisterPage() {
  const router = useRouter();

  const token = useAuthStore((state) => state.token);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      router.replace('/lobby');
    }
  }, [token, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!username.trim() || !password) {
      setErrorMessage('Ten dang nhap va mat khau la bat buoc.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mat khau phai co it nhat 6 ky tu.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mat khau nhap lai chua khop.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await registerRequest({
        username: username.trim(),
        password,
        avatar: avatar.trim() || undefined
      });

      setSuccessMessage(`Đã tạo tài khoản cho ${response.user.username}. Bạn có thể đăng nhập ngay.`);
      setPassword('');
      setConfirmPassword('');
      setAvatar('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tạo tài khoản vào lúc này. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FigmaAuthScene
      frameAlt="Khung dang ky"
      frameHeight={854}
      frameSrc="/game-ui/sign-up-and-login/background_SignUp.svg"
      frameTop={110}
      frameWidth={700}
      logMessage={
        errorMessage ?? successMessage ?? (isLoading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản để bắt đầu hành trình.')
      }
    >
      <AuthPanel>
        <form className="absolute inset-0" onSubmit={handleSubmit}>
          <div className="absolute left-[21%] top-[22%] w-[58.45%]">
            <AuthInput
              assetSrc="/game-ui/sign-up-and-login/input_username.svg"
              inputProps={{
                autoComplete: 'username',
                maxLength: 20,
                minLength: 3,
                onChange: (event) => setUsername(event.target.value),
                placeholder: 'Tên đăng nhập',
                required: true,
                value: username
              }}
            />
          </div>

          <div className="absolute left-[21%] top-[32%] w-[58.45%]">
            <AuthInput
              assetSrc="/game-ui/sign-up-and-login/input_email.svg"
              inputProps={{
                autoComplete: 'url',
                onChange: (event) => setAvatar(event.target.value),
                placeholder: 'Avatar URL (tùy chọn)',
                type: 'url',
                value: avatar
              }}
            />
          </div>

          <div className="absolute left-[21%] top-[42%] w-[58.45%]">
            <AuthInput
              assetSrc="/game-ui/sign-up-and-login/input_password.svg"
              inputProps={{
                autoComplete: 'new-password',
                minLength: 6,
                onChange: (event) => setPassword(event.target.value),
                placeholder: 'Mật khẩu',
                required: true,
                type: 'password',
                value: password
              }}
            />
          </div>

          <div className="absolute left-[21%] top-[52%] w-[58.45%]">
            <AuthInput
              assetSrc="/game-ui/sign-up-and-login/input_password.svg"
              inputProps={{
                autoComplete: 'new-password',
                minLength: 6,
                onChange: (event) => setConfirmPassword(event.target.value),
                placeholder: 'Nhập lại mật khẩu',
                required: true,
                type: 'password',
                value: confirmPassword
              }}
            />
          </div>

          <AuthImageButton
            alt="Tao tai khoan"
            className="absolute left-[7.1%] top-[60%] aspect-[593/189] w-[84.7%]"
            disabled={isLoading}
            src="/game-ui/sign-up-and-login/btn_CreateAccount.svg"
            type="submit"
          />

          <AuthTextButtonLink
            alt="Dang nhap"
            className="absolute left-[32%] top-[58%] aspect-[246/67] w-[35.15%]"
            href="/login"
            src="/game-ui/sign-up-and-login/btn_BackToLogin.svg"
          />
        </form>
      </AuthPanel>
    </FigmaAuthScene>
  );
}
