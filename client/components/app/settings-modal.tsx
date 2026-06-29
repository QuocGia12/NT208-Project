'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  changeMyPassword,
  updateMyAvatar
} from '@/lib/api/users';
import {
  defaultGameSettings,
  loadGameSettings,
  saveGameSettings,
  type GameSettingsState
} from '@/lib/game-audio-settings';
import { useAuthStore } from '@/store/auth-store';

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type SettingsTab = 'audio' | 'account';

const CloseIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
  </svg>
);

function VolumeSlider({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
          {label}
        </span>
        <span className="text-xs font-bold text-cyan-200">{value}%</span>
      </div>
      <input
        className="settings-slider-track"
        max={100}
        min={0}
        onChange={(e) => onChange(Number(e.target.value))}
        step={1}
        type="range"
        value={value}
      />
    </div>
  );
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');
  const [settings, setSettings] = useState<GameSettingsState>(defaultGameSettings);
  const [avatarInput, setAvatarInput] = useState('');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    setSettings(loadGameSettings());
  }, []);

  // Save when settings change
  useEffect(() => {
    saveGameSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!isOpen) return;

    setAvatarInput(user?.avatar ?? '');
    setAvatarMessage(null);
    setAvatarError(null);
    setPasswordMessage(null);
    setPasswordError(null);
  }, [isOpen, user?.avatar]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  const updateSetting = <K extends keyof GameSettingsState>(
    key: K,
    value: GameSettingsState[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogout = () => {
    clearSession();
    onClose();
    router.replace('/login');
  };

  const handleSaveAvatar = async () => {
    if (!token) {
      setAvatarError('Bạn chưa đăng nhập. Hãy đăng nhập lại.');
      return;
    }

    setIsSavingAvatar(true);
    setAvatarError(null);
    setAvatarMessage(null);

    try {
      const nextAvatar = avatarInput.trim().length > 0 ? avatarInput.trim() : null;
      const updated = await updateMyAvatar(token, nextAvatar);
      updateUser(updated);
      setAvatarInput(updated.avatar ?? '');
      setAvatarMessage('Đã cập nhật avatar.');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Không thể cập nhật avatar.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    const normalizedCurrentPassword = currentPassword.trim();
    const normalizedNewPassword = newPassword.trim();
    const normalizedConfirmPassword = confirmPassword.trim();

    if (!token) {
      setPasswordError('Bạn chưa đăng nhập. Hãy đăng nhập lại.');
      return;
    }

    if (
      normalizedCurrentPassword.length === 0 ||
      normalizedNewPassword.length === 0 ||
      normalizedConfirmPassword.length === 0
    ) {
      setPasswordError('Hãy nhập đầy đủ các ô mật khẩu.');
      return;
    }

    if (normalizedNewPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (normalizedNewPassword !== normalizedConfirmPassword) {
      setPasswordError('Mật khẩu mới và xác nhận mật khẩu chưa khớp.');
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);

    try {
      const message = await changeMyPassword(
        token,
        normalizedCurrentPassword,
        normalizedNewPassword
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(message);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Không thể đổi mật khẩu.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal-layer" onClick={handleOverlayClick}>
      <div
        className="panel-container panel-container-settings settings-panel-responsive"
        ref={panelRef}
        role="dialog"
        aria-label="Cài đặt"
        aria-modal="true"
      >
        <img
          src="/images/ui-game/panel-settings.png"
          className="panel-bg pointer-events-none select-none"
          alt=""
        />

        <div className="panel-tabs settings-panel-tabs" role="tablist" aria-label="Các tab cài đặt">
          <button
            onClick={() => setActiveTab('audio')}
            type="button"
            className={`panel-tab settings-panel-tab ${activeTab === 'audio' ? 'panel-tab-active' : ''}`}
            aria-label="Cài đặt âm thanh"
            aria-selected={activeTab === 'audio'}
            role="tab"
          >
            <span className="tab-label tab-label-sm">ÂM THANH</span>
            <span className="panel-tab-arrow tab-arrow-sm">&gt;</span>
          </button>
          <button
            onClick={() => setActiveTab('account')}
            type="button"
            className={`panel-tab settings-panel-tab ${activeTab === 'account' ? 'panel-tab-active' : ''}`}
            aria-label="Cài đặt tài khoản"
            aria-selected={activeTab === 'account'}
            role="tab"
          >
            <span className="tab-label tab-label-sm">TÀI KHOẢN</span>
            <span className="panel-tab-arrow tab-arrow-sm">&gt;</span>
          </button>
        </div>

        <div className="panel-content settings-panel-content">
          {activeTab === 'audio' && (
            <div className="space-y-6 animate-fade-in" role="tabpanel">
              <h2 className="moba-heading mb-4 text-sm uppercase tracking-[0.2em] text-amber-100">
                Cài đặt âm thanh
              </h2>
              <VolumeSlider
                label="Âm lượng tổng"
                onChange={(v) => updateSetting('masterVolume', v)}
                value={settings.masterVolume}
              />
              <VolumeSlider
                label="Âm lượng nhạc"
                onChange={(v) => updateSetting('musicVolume', v)}
                value={settings.musicVolume}
              />
              <VolumeSlider
                label="Âm lượng hiệu ứng"
                onChange={(v) => updateSetting('sfxVolume', v)}
                value={settings.sfxVolume}
              />
              <p className="text-[0.65rem] text-slate-500">
                Âm lượng được áp dụng ngay và tự động lưu.
              </p>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-5 animate-fade-in" role="tabpanel">
              <h2 className="moba-heading mb-4 text-sm uppercase tracking-[0.2em] text-amber-100">
                Cài đặt tài khoản
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Tên đăng nhập
                  </span>
                  <p className="mt-0.5 text-sm font-bold uppercase tracking-[0.1em] text-amber-100">
                    {user?.username ?? 'Không rõ'}
                  </p>
                </div>
                <div>
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    ID người dùng
                  </span>
                  <p className="mt-0.5 truncate text-xs text-cyan-200/80">
                    {user?.id ?? '-'}
                  </p>
                </div>
              </div>

              <div className="h-px bg-cyan-400/10" />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Avatar
                </p>
                <input
                  className="moba-input w-full"
                  onChange={(e) => setAvatarInput(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  type="text"
                  value={avatarInput}
                />

                {avatarError ? (
                  <p className="text-[0.68rem] text-rose-300">{avatarError}</p>
                ) : null}
                {avatarMessage ? (
                  <p className="text-[0.68rem] text-emerald-300">{avatarMessage}</p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    className="moba-button min-w-[10rem] flex-1"
                    disabled={isSavingAvatar}
                    onClick={handleSaveAvatar}
                    type="button"
                  >
                    {isSavingAvatar ? 'Đang lưu...' : 'Lưu avatar'}
                  </button>
                  <button
                    className="moba-secondary-button min-w-[6rem]"
                    disabled={isSavingAvatar}
                    onClick={() => setAvatarInput('')}
                    type="button"
                  >
                    Xóa
                  </button>
                </div>
              </div>

              <div className="h-px bg-cyan-400/10" />

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Đổi mật khẩu
                </p>

                <input
                  className="moba-input w-full"
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Mật khẩu hiện tại"
                  type="password"
                  value={currentPassword}
                />
                <input
                  className="moba-input w-full"
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mật khẩu mới"
                  type="password"
                  value={newPassword}
                />
                <input
                  className="moba-input w-full"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  type="password"
                  value={confirmPassword}
                />

                {passwordError ? (
                  <p className="text-[0.68rem] text-rose-300">{passwordError}</p>
                ) : null}
                {passwordMessage ? (
                  <p className="text-[0.68rem] text-emerald-300">{passwordMessage}</p>
                ) : null}

                <button
                  className="moba-button w-full"
                  disabled={isChangingPassword}
                  onClick={handleChangePassword}
                  type="button"
                >
                  {isChangingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </button>
              </div>

              <div className="h-px bg-cyan-400/10" />

              {user?.role === 'ADMIN' ? (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                      Quản trị
                    </p>
                    <button
                      className="moba-secondary-button w-full"
                      onClick={() => {
                        onClose();
                        router.push('/admin/shop');
                      }}
                      type="button"
                    >
                      Mở quản lý cửa hàng
                    </button>
                  </div>

                  <div className="h-px bg-cyan-400/10" />
                </>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  Đăng xuất sẽ xóa phiên hiện tại. Bạn cần đăng nhập lại để vào đấu trường.
                </p>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/40 bg-gradient-to-r from-rose-950/60 to-rose-900/40 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-rose-200 transition hover:border-rose-400/70 hover:shadow-[0_0_18px_rgba(225,29,72,0.15)]"
                  id="logout-button"
                  onClick={handleLogout}
                  type="button"
                >
                  <LogoutIcon />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        className="settings-modal-close-button"
        onClick={onClose}
        type="button"
        aria-label="Đóng cài đặt"
      >
        <CloseIcon />
      </button>

      <button
        className="settings-modal-back-button"
        onClick={onClose}
        type="button"
        aria-label="Quay lại"
      >
        <img src="/images/ui-game/btn-back.png" className="w-full" alt="Trở về" />
      </button>
    </div>
  );
};
