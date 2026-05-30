'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import {
  type GameMatchmakingPlayer,
  type GamePartyMode,
  type GamePartySlot,
  type GamePartyUpdate,
  type GameTeamSlotId,
  gameSocketClient
} from '@/lib/game-socket-client';
import {
  SETTINGS_STORAGE_KEY,
  SETTINGS_UPDATED_EVENT,
  getEffectiveMusicVolume,
  loadGameSettings
} from '@/lib/game-audio-settings';
import { useAuthStore } from '@/store/auth-store';

type MatchmakingScreen = 'menu' | 'party2' | 'party4';

type MatchmakingFlowProps = {
  screen: MatchmakingScreen;
};

const WAITING_AUDIO_STATE_EVENT = 'zodiac:waiting-audio-state';

const FRAME_SIZE = {
  width: 1920,
  height: 1080
} as const;

const UI = {
  background: '/game-ui/create-match/Backgroud_CreateMatch.svg',
  log: '/game-ui/create-match/Log.svg',
  returnMain: '/game-ui/create-match/RETURN-MainScreen.svg',
  menuFrame: '/game-ui/create-match/main-menu/MainFrame.svg',
  btnQuickMatch: '/game-ui/create-match/main-menu/btn_QuickMatch.svg',
  btnCreateTeam2: '/game-ui/create-match/main-menu/btn_CreateTeam2.svg',
  btnCreateTeam4: '/game-ui/create-match/main-menu/btn_CreateTeam4.svg',
  btnJoinRoomBg: '/game-ui/create-match/main-menu/btn_JoinRoom_background.svg',
  btnJoinRoom: '/game-ui/create-match/main-menu/btn_JoinRoom.svg',
  room2Frame: '/game-ui/create-match/create-room2/MainFrame.svg',
  room2User1: '/game-ui/create-match/create-room2/gr_User1.svg',
  room2User2: '/game-ui/create-match/create-room2/gr_User2.svg',
  room2Ready: '/game-ui/create-match/create-room2/Status_Ready.svg',
  room2Unready: '/game-ui/create-match/create-room2/Status_UnReady.svg',
  room2Blank: '/game-ui/create-match/create-room2/icon_blankPosition.svg',
  room4Frame: '/game-ui/create-match/create-room4/MainFrame.svg',
  room4Ready: '/game-ui/create-match/create-room4/Status_Ready.svg',
  room4Unready: '/game-ui/create-match/create-room4/Status_UnReady.svg',
  room4Blank: '/game-ui/create-match/create-room4/icon_blankPosition.svg',
  room4FrameUser: '/game-ui/create-match/create-room4/gr_FrameUser.svg',
  room4AvatarFrame: '/game-ui/create-match/create-room4/Frame_Avt.svg',
  room4Vs: '/game-ui/create-match/create-room4/gr_VS.svg',
  room4Swap: '/game-ui/create-match/create-room4/btn_Swap.svg',
  roomCode2: '/game-ui/create-match/create-room2/gr_CodeRoom.svg',
  roomCode4: '/game-ui/create-match/create-room4/gr_CodeRoom.svg',
  btnReady2: '/game-ui/create-match/create-room2/btn_Ready.svg',
  btnExit2: '/game-ui/create-match/create-room2/btn_ExitRoom.svg',
  btnReady4: '/game-ui/create-match/create-room4/btn_Ready.svg',
  btnExit4: '/game-ui/create-match/create-room4/btn_ExitRoom.svg'
} as const;

const toFrameStyle = (left: number, top: number, width: number, height: number) => ({
  left: `${(left / FRAME_SIZE.width) * 100}%`,
  top: `${(top / FRAME_SIZE.height) * 100}%`,
  width: `${(width / FRAME_SIZE.width) * 100}%`,
  height: `${(height / FRAME_SIZE.height) * 100}%`
});

const formatElapsed = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
};

const routeForPartyMode = (mode: GamePartyMode) =>
  mode === 'party2' ? '/matchmaking/party-2' : '/matchmaking/party-4';

const getInitialStatus = (party: GamePartyUpdate | null) => {
  if (!party) {
    return 'Sẵn sàng bắt đầu trận mới.';
  }

  return party.status === 'queued'
    ? 'Phòng đang tìm đối thủ...'
    : `Phòng ${party.code} đã được tạo.`;
};

export const MatchmakingFlow = ({ screen }: MatchmakingFlowProps) => {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [isSearching, setIsSearching] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [searchStartedAt, setSearchStartedAt] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState(() => getInitialStatus(gameSocketClient.currentParty));
  const [isSocketReady, setIsSocketReady] = useState(gameSocketClient.isConnected());
  const [currentParty, setCurrentParty] = useState<GamePartyUpdate | null>(gameSocketClient.currentParty);
  const [joinCode, setJoinCode] = useState('');
  const waitingMusicRef = useRef<HTMLAudioElement | null>(null);
  const pendingPartyTimerRef = useRef<number | null>(null);

  const playerPayload = useMemo<GameMatchmakingPlayer | null>(() => {
    if (!user) return null;

    return {
      id: user.id,
      username: user.username || 'Player',
      avatar: user.avatar ?? null,
      elo: typeof user.elo === 'number' ? user.elo : 1000
    };
  }, [user]);

  const mySlot = useMemo(
    () => currentParty?.slots.find((slot) => slot.player?.id === user?.id) ?? null,
    [currentParty, user?.id]
  );
  const partyPlayers = currentParty?.slots.filter((slot) => slot.player).length ?? 0;
  const isPartyFull = currentParty ? partyPlayers === currentParty.slots.length : false;
  const allPartyReady = currentParty
    ? currentParty.slots.every((slot) => (slot.player ? slot.player.ready : false))
    : false;

  useEffect(() => {
    if (screen === 'menu' && currentParty) {
      router.replace(routeForPartyMode(currentParty.mode));
      return;
    }

    if (screen === 'party2' && currentParty?.mode === 'party4') {
      router.replace('/matchmaking/party-4');
      return;
    }

    if (screen === 'party4' && currentParty?.mode === 'party2') {
      router.replace('/matchmaking/party-2');
    }
  }, [currentParty, router, screen]);

  useEffect(() => {
    if (!isSearching || searchStartedAt === null) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - searchStartedAt) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isSearching, searchStartedAt]);

  useEffect(() => {
    const audio = new Audio('/music/music-loop-waiting.mp3');
    audio.loop = true;
    audio.preload = 'auto';
    waitingMusicRef.current = audio;

    const applyVolume = () => {
      const settings = loadGameSettings();
      const volume = getEffectiveMusicVolume(settings);
      audio.volume = volume;
      audio.muted = volume === 0;
    };

    const handleSettingsUpdated = () => {
      applyVolume();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SETTINGS_STORAGE_KEY) return;
      applyVolume();
    };

    applyVolume();
    window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener);
      window.removeEventListener('storage', handleStorage);
      audio.pause();
      audio.src = '';
      waitingMusicRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = waitingMusicRef.current;
    if (!audio) return;

    window.dispatchEvent(
      new CustomEvent(WAITING_AUDIO_STATE_EVENT, {
        detail: { isActive: isSearching || currentParty?.status === 'queued' }
      })
    );

    if (isSearching || currentParty?.status === 'queued') {
      void audio.play().catch(() => undefined);
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }, [currentParty?.status, isSearching]);

  useEffect(() => {
    const socket = gameSocketClient.connect();

    const handleConnect = () => {
      setIsSocketReady(true);
      setStatusMessage((prev) =>
        prev.includes('Game server') || prev.includes('Connecting')
          ? 'Game server đã kết nối.'
          : prev
      );
    };

    const handleDisconnect = () => {
      setIsSocketReady(false);
      setStatusMessage('Game server mất kết nối. Đang thử kết nối lại...');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    const unsubscribeQueue = gameSocketClient.onQueueUpdate((queue) => {
      if (queue.status === 'queued') {
        setIsSearching(true);
        setSearchStartedAt((startedAt) => startedAt ?? Date.now());
        setStatusMessage(`Đang tìm trận... ${queue.queueSize ?? 1} người trong hàng chờ.`);
      } else {
        setIsSearching(false);
        setSearchStartedAt(null);
        setElapsedSeconds(0);
        setStatusMessage('Đã hủy tìm trận. Sẵn sàng bắt đầu lại.');
      }
    });

    const unsubscribeParty = gameSocketClient.onPartyUpdate((party) => {
      if (pendingPartyTimerRef.current !== null) {
        window.clearTimeout(pendingPartyTimerRef.current);
        pendingPartyTimerRef.current = null;
      }

      setCurrentParty(party);
      setIsSearching(false);
      setSearchStartedAt(null);
      setElapsedSeconds(0);
      setStatusMessage(
        party.status === 'queued'
          ? 'Phòng đang tìm đối thủ...'
          : `Phòng ${party.code} đã sẵn sàng.`
      );
      router.replace(routeForPartyMode(party.mode));
    });

    const unsubscribeMatch = gameSocketClient.onMatchFound((match) => {
      setIsSearching(false);
      setSearchStartedAt(null);
      setElapsedSeconds(0);
      setStatusMessage(`Đã tìm thấy trận ${match.roomId}.`);
      router.push(`/game/${match.roomId}`);
    });

    const unsubscribeError = gameSocketClient.onError((error) => {
      if (pendingPartyTimerRef.current !== null) {
        window.clearTimeout(pendingPartyTimerRef.current);
        pendingPartyTimerRef.current = null;
      }

      setStatusMessage(error.message || 'Đã có lỗi trong matchmaking.');
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      unsubscribeQueue();
      unsubscribeParty();
      unsubscribeMatch();
      unsubscribeError();

      if (pendingPartyTimerRef.current !== null) {
        window.clearTimeout(pendingPartyTimerRef.current);
        pendingPartyTimerRef.current = null;
      }
    };
  }, [router]);

  const ensurePlayer = () => {
    if (!token || !playerPayload) {
      setStatusMessage('Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.');
      return null;
    }

    return playerPayload;
  };

  const handleQuickJoin = () => {
    const player = ensurePlayer();
    if (!player) return;

    setCurrentParty(null);
    setIsSearching(true);
    setSearchStartedAt(Date.now());
    setElapsedSeconds(0);
    setStatusMessage('Đang tìm trận nhanh...');
    gameSocketClient.quickJoin(player, token ?? undefined);
  };

  const handleQuickCancel = () => {
    gameSocketClient.quickCancel();
    setIsSearching(false);
    setSearchStartedAt(null);
    setElapsedSeconds(0);
    setStatusMessage('Đã hủy tìm trận.');
  };

  const handleCreateParty = (mode: GamePartyMode) => {
    const player = ensurePlayer();
    if (!player) return;

    setIsSearching(false);
    setSearchStartedAt(null);
    setElapsedSeconds(0);
    setCurrentParty(null);
    setStatusMessage(mode === 'party2' ? 'Đang tạo phòng 2...' : 'Đang tạo phòng 4...');
    gameSocketClient.createParty(mode, player, token ?? undefined);
    router.push(routeForPartyMode(mode));

    if (pendingPartyTimerRef.current !== null) {
      window.clearTimeout(pendingPartyTimerRef.current);
    }

    pendingPartyTimerRef.current = window.setTimeout(() => {
      pendingPartyTimerRef.current = null;
      if (!gameSocketClient.isConnected()) {
        setStatusMessage('Game server chưa kết nối. Hãy kiểm tra cổng 3001.');
        return;
      }

      setStatusMessage('Đang chờ server trả mã phòng...');
    }, 2500);
  };

  const handleJoinParty = () => {
    const player = ensurePlayer();
    const code = joinCode.trim().toUpperCase();
    if (!player || !code) {
      setStatusMessage('Hãy nhập mã phòng trước.');
      return;
    }

    setCurrentParty(null);
    setStatusMessage(`Đang vào phòng ${code}...`);
    gameSocketClient.joinParty(code, player, token ?? undefined);
  };

  const handleLeaveParty = () => {
    gameSocketClient.leaveParty();
    setCurrentParty(null);
    setStatusMessage('Bạn đã rời phòng.');
    router.push('/matchmaking');
  };

  const handleSwitchSlot = (slotId: GameTeamSlotId) => {
    const targetSlot = currentParty?.slots.find((slot) => slot.slotId === slotId);
    if (!targetSlot || targetSlot.player) return;

    gameSocketClient.switchSlot(slotId);
  };

  const handleReadyToggle = () => {
    gameSocketClient.setReady(!mySlot?.player?.ready);
  };

  const handleReturnToLobby = () => {
    if (currentParty) {
      gameSocketClient.leaveParty();
      setCurrentParty(null);
    }
    if (isSearching) {
      gameSocketClient.quickCancel();
      setIsSearching(false);
      setSearchStartedAt(null);
      setElapsedSeconds(0);
    }
    router.push('/lobby');
  };

  const statusLine = isSearching || currentParty?.status === 'queued'
    ? `Đang chờ... ${formatElapsed(elapsedSeconds)}`
    : isSocketReady
      ? 'Game server online'
      : 'Đang kết nối game server';

  return (
    <main className="min-h-screen bg-[#091321] px-3 py-3 text-[#fff5d6] sm:px-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1800px] items-center justify-center">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[28px] border border-[#f1d08a]/20 bg-[#0f1c2d] shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            src={UI.background}
          />

          <button
            className="absolute z-20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleReturnToLobby}
            style={toFrameStyle(28, 17, 279, 134)}
            type="button"
          >
            <img alt="Trở về sảnh chính" className="h-full w-full object-contain" src={UI.returnMain} />
          </button>

          {screen === 'menu' ? (
            <MenuScreen
              joinCode={joinCode}
              onCreateParty={handleCreateParty}
              onJoinParty={handleJoinParty}
              onJoinCodeChange={setJoinCode}
              onQuickToggle={isSearching ? handleQuickCancel : handleQuickJoin}
              searching={isSearching}
            />
          ) : null}

          {screen === 'party2' ? (
            <PartyTwoScreen
              currentParty={currentParty}
              isPartyFull={isPartyFull}
              mySlotReady={Boolean(mySlot?.player?.ready)}
              onExitRoom={handleLeaveParty}
              onReadyToggle={handleReadyToggle}
            />
          ) : null}

          {screen === 'party4' ? (
            <PartyFourScreen
              allPartyReady={allPartyReady}
              currentParty={currentParty}
              isPartyFull={isPartyFull}
              mySlotReady={Boolean(mySlot?.player?.ready)}
              onExitRoom={handleLeaveParty}
              onReadyToggle={handleReadyToggle}
              onSwitchSlot={handleSwitchSlot}
              userId={user?.id ?? ''}
            />
          ) : null}

          <StatusLog message={statusMessage} secondary={statusLine} screen={screen} />
        </div>
      </div>
    </main>
  );
};

type MenuScreenProps = {
  joinCode: string;
  onCreateParty: (mode: GamePartyMode) => void;
  onJoinParty: () => void;
  onJoinCodeChange: (value: string) => void;
  onQuickToggle: () => void;
  searching: boolean;
};

const MenuScreen = ({
  joinCode,
  onCreateParty,
  onJoinParty,
  onJoinCodeChange,
  onQuickToggle,
  searching
}: MenuScreenProps) => (
  <>
    <img
      alt=""
      aria-hidden="true"
      className="absolute object-contain"
      src={UI.menuFrame}
      style={toFrameStyle(346, 151, 1228.3, 701)}
    />

    <ActionButton
      alt={searching ? 'Hủy tìm trận nhanh' : 'Tìm trận nhanh'}
      onClick={onQuickToggle}
      src={UI.btnQuickMatch}
      style={toFrameStyle(464, 269, 478, 224)}
    />
    <ActionButton
      alt="Tạo phòng 2"
      onClick={() => onCreateParty('party2')}
      src={UI.btnCreateTeam2}
      style={toFrameStyle(981, 264, 478, 224)}
    />
    <ActionButton
      alt="Tạo phòng 4"
      onClick={() => onCreateParty('party4')}
      src={UI.btnCreateTeam4}
      style={toFrameStyle(464, 532, 478, 224)}
    />

    <div className="absolute" style={toFrameStyle(981, 527, 478, 224)}>
      <img alt="" aria-hidden="true" className="h-full w-full object-contain" src={UI.btnJoinRoomBg} />
      <input
        className="absolute left-[29.3%] top-[39%] h-[27%] w-[65.9%] rounded-[0.9vw] border border-[#f6d48f]/60 bg-[#f6e7b8]/85 px-[4.5%] text-center font-semibold uppercase tracking-[0.2em] text-[#5e3013] outline-none placeholder:text-[#8d5a2a]/70"
        maxLength={8}
        onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
        placeholder="MÃ PHÒNG"
        type="text"
        value={joinCode}
      />
      <button
        className="absolute left-[40.4%] top-[72.8%] h-[20.6%] w-[43.1%] transition-transform hover:scale-[1.02] active:scale-[0.98]"
        onClick={onJoinParty}
        type="button"
      >
        <img alt="Vào phòng" className="h-full w-full object-contain" src={UI.btnJoinRoom} />
      </button>
    </div>
  </>
);

type PartyTwoScreenProps = {
  currentParty: GamePartyUpdate | null;
  isPartyFull: boolean;
  mySlotReady: boolean;
  onExitRoom: () => void;
  onReadyToggle: () => void;
};

const PartyTwoScreen = ({
  currentParty,
  isPartyFull,
  mySlotReady,
  onExitRoom,
  onReadyToggle
}: PartyTwoScreenProps) => {
  const slots = currentParty?.slots ?? [];
  const slot0 = slots[0] ?? null;
  const slot1 = slots[1] ?? null;

  return (
    <>
      <img
        alt=""
        aria-hidden="true"
        className="absolute object-contain"
        src={UI.room2Frame}
        style={toFrameStyle(340, 189, 1228.3, 701)}
      />
      <img
        alt=""
        aria-hidden="true"
        className="absolute object-contain"
        src={UI.roomCode2}
        style={toFrameStyle(716, 298, 525, 76)}
      />
      <RoomCodeText code={currentParty?.code ?? '----'} style={toFrameStyle(980, 306, 218, 64)} />

      <div className="absolute" style={toFrameStyle(483, 441, 478, 224)}>
        <img alt="" aria-hidden="true" className="h-full w-full object-contain" src={UI.room2User1} />
        <PartyMemberOverlay slot={slot0} withInfo />
      </div>

      <div className="absolute" style={toFrameStyle(997, 441, 478, 224)}>
        <img alt="" aria-hidden="true" className="h-full w-full object-contain" src={UI.room2User2} />
        {slot1?.player ? (
          <PartyMemberOverlay slot={slot1} withInfo/>
        ) : (
          <img
            alt=""
            aria-hidden="true"
            className="absolute left-[39.5%] top-[36.6%] h-[48.6%] w-[22.8%] object-contain opacity-95"
            src={UI.room2Blank}
          />
        )}
      </div>

      <StatusBadge
        ready={Boolean(slot0?.player?.ready)}
        style={toFrameStyle(546, 695, 355, 83.16)}
        variant="party2"
      />
      <StatusBadge
        ready={Boolean(slot1?.player?.ready)}
        style={toFrameStyle(1059, 694, 355, 83.16)}
        variant="party2"
      />

      <AssetButton
        alt={mySlotReady ? 'Hủy sẵn sàng' : 'Sẵn sàng'}
        onClick={onReadyToggle}
        src={UI.btnReady2}
        style={toFrameStyle(519, 901, 413, 125)}
      />
      <AssetButton
        alt="Rời phòng"
        onClick={onExitRoom}
        src={UI.btnExit2}
        style={toFrameStyle(1012, 901, 416, 125)}
      />

      <p
        className="absolute text-center text-[clamp(0.75rem,1.25vw,1rem)] tracking-[0.08em] text-[#D86A39]"
        style={toFrameStyle(611, 790, 700, 32)}
      >
        {isPartyFull
          ? 'Đủ người. Cả hai cùng READY là server sẽ tự tìm đối thủ.'
          : 'Chia sẻ mã phòng để mời đồng đội vào team của bạn.'}
      </p>
    </>
  );
};

type PartyFourScreenProps = {
  allPartyReady: boolean;
  currentParty: GamePartyUpdate | null;
  isPartyFull: boolean;
  mySlotReady: boolean;
  onExitRoom: () => void;
  onReadyToggle: () => void;
  onSwitchSlot: (slotId: GameTeamSlotId) => void;
  userId: string;
};

const PartyFourScreen = ({
  allPartyReady,
  currentParty,
  isPartyFull,
  mySlotReady,
  onExitRoom,
  onReadyToggle,
  onSwitchSlot,
  userId
}: PartyFourScreenProps) => {
  const slotsById = new Map(currentParty?.slots.map((slot) => [slot.slotId, slot]) ?? []);
  const layoutSlots: Array<{
    slotId: GameTeamSlotId;
    blankLeft: number;
    blankTop: number;
    occupiedLeft: number;
    occupiedTop: number;
    statusLeft: number;
  }> = [
    { slotId: 'team1-slot0', blankLeft: 479, blankTop: 436, occupiedLeft: 465, occupiedTop: 415, statusLeft: 438 },
    { slotId: 'team1-slot1', blankLeft: 705, blankTop: 441, occupiedLeft: 684, occupiedTop: 415, statusLeft: 657 },
    { slotId: 'team2-slot0', blankLeft: 1082, blankTop: 436, occupiedLeft: 1067, occupiedTop: 415, statusLeft: 1040 },
    { slotId: 'team2-slot1', blankLeft: 1301, blankTop: 441, occupiedLeft: 1286, occupiedTop: 415, statusLeft: 1259 }
  ];

  return (
    <>
      <img
        alt=""
        aria-hidden="true"
        className="absolute object-contain"
        src={UI.room4Frame}
        style={toFrameStyle(346, 162, 1228.3, 756)}
      />
      <img
        alt=""
        aria-hidden="true"
        className="absolute object-contain"
        src={UI.roomCode4}
        style={toFrameStyle(716, 276, 525, 76)}
      />
      <RoomCodeText code={currentParty?.code ?? '----'} style={toFrameStyle(1000, 292, 156, 46)} />

      <img
        alt=""
        aria-hidden="true"
        className="absolute object-contain"
        src={UI.room4Vs}
        style={toFrameStyle(906, 449, 124.06, 182)}
      />

      {layoutSlots.map(({ slotId, blankLeft, blankTop, occupiedLeft, occupiedTop, statusLeft }) => {
        const slot = slotsById.get(slotId) ?? null;
        const isBlank = !slot?.player;
        const isMine = slot?.player?.id === userId;
        return (
          <Fragment key={slotId}>
            {isBlank ? (
              <button
                className="absolute transition-transform hover:scale-[1.015] active:scale-[0.98]"
                onClick={() => onSwitchSlot(slotId)}
                style={toFrameStyle(blankLeft, blankTop, 139, 167)}
                type="button"
              >
                <img alt="" aria-hidden="true" className="h-full w-full object-contain" src={UI.room4Blank} />
              </button>
            ) : (
              <PartySlotCard slot={slot} style={toFrameStyle(occupiedLeft, occupiedTop, 188, 230)} />
            )}

            <StatusBadge
              interactive={isMine}
              onClick={isMine ? onReadyToggle : undefined}
              ready={Boolean(slot?.player?.ready)}
              style={toFrameStyle(statusLeft, 666, 236, 55.29)}
              variant="party4"
            />
          </Fragment>
        );
      })}
      <AssetButton
        alt={mySlotReady ? 'Hủy sẵn sàng' : 'Sẵn sàng'}
        onClick={onReadyToggle}
        src={UI.btnReady4}
        style={toFrameStyle(513, 918, 413, 125)}
      />
      <AssetButton
        alt="Rời phòng"
        onClick={onExitRoom}
        src={UI.btnExit4}
        style={toFrameStyle(1006, 918, 416, 125)}
      />

      <p
        className="absolute text-center text-[clamp(0.75rem,1.25vw,1rem)] tracking-[0.08em] text-[#682D03]"
        style={toFrameStyle(520, 802, 880, 32)}
      >
        {isPartyFull && allPartyReady
          ? 'Cả bốn người đã READY. Server đang khởi tạo trận đấu.'
          : 'Slot trống có thể bấm để chuyển vị trí. Cần đủ 4 người và tất cả READY.'}
      </p>
    </>
  );
};

type PartySlotCardProps = {
  style: CSSProperties;
  slot: GamePartySlot;
};

const PartySlotCard = ({ slot, style }: PartySlotCardProps) => {
  const username = slot.player?.username ?? 'Unknown';
  const avatarLetter = username.charAt(0).toUpperCase();
  const avatarStyle = slot.player?.avatar
    ? {
        backgroundImage: `url(${slot.player.avatar})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover'
      }
    : undefined;

  return (
    <div className="absolute" style={style}>
      <img alt="" aria-hidden="true" className="h-full w-full object-contain" src={UI.room4FrameUser} />
      <div className="absolute left-[11%] top-[4%] h-[64.8%] w-[79.3%]">
        <img
          alt="" 
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-contain"
          src={UI.room4AvatarFrame}
        />
        <div
          className="absolute left-[13%] top-[12%] flex aspect-square h-[74%] items-center justify-center overflow-hidden rounded-full bg-[#f2efe8] text-[clamp(0.85rem,1.45vw,1.3rem)] font-black text-[#6d3b16]"
          style={avatarStyle}
        >
          {!slot.player?.avatar ? avatarLetter : null}
        </div>
      </div>
      <p className="absolute inset-x-[12%] bottom-[8%] truncate text-center text-[clamp(0.8rem,1.12vw,1rem)] font-bold text-[#6d3210]">
        {username}
      </p>
    </div>
  );
};

type StatusBadgeProps = {
  interactive?: boolean;
  onClick?: () => void;
  ready: boolean;
  style: CSSProperties;
  variant: 'party2' | 'party4';
};

const StatusBadge = ({ interactive = false, onClick, ready, style, variant }: StatusBadgeProps) => (
  <button
    className={`absolute ${interactive ? 'transition-transform hover:scale-[1.015] active:scale-[0.98]' : 'cursor-default'}`}
    disabled={!interactive}
    onClick={onClick}
    style={style}
    type="button"
  >
    <img
      alt={ready ? 'Ready' : 'Not ready'}
      className="h-full w-full object-contain"
      src={
        ready
          ? variant === 'party2'
            ? UI.room2Ready
            : UI.room4Ready
          : variant === 'party2'
            ? UI.room2Unready
            : UI.room4Unready
      }
    />
  </button>
);

type PartyMemberOverlayProps = {
  slot: GamePartySlot | null;
  withInfo?: boolean;
};

const PartyMemberOverlay = ({ slot, withInfo = false }: PartyMemberOverlayProps) => {
  if (!slot?.player) {
    return null;
  }

  const username = slot.player.username;
  const avatarLetter = username.charAt(0).toUpperCase();
  const avatarStyle = slot.player.avatar
    ? {
        backgroundImage: `url(${slot.player.avatar})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover'
      }
    : undefined;

  return (
    <>
      <div
        className="absolute left-[15%] top-[33%] flex aspect-square h-[50%] items-center justify-center rounded-full border border-[#D86A39]/75 bg-[#f4ead1] text-[clamp(1rem,1.8vw,1.6rem)] font-black text-[#6f3e17]"
        style={avatarStyle}
      >
        {!slot.player.avatar ? avatarLetter : null}
      </div>
      <div className="absolute left-[45%] top-[40%] right-[8%] text-left">
        <p className="truncate text-[clamp(0.9rem,1.35vw,1.5rem)] font-extrabold uppercase tracking-[0.12em] text-[#682D03]">
          {username}
        </p>
        {withInfo ? (
          <p className="mt-[4%] text-[clamp(0.7rem,1vw,1rem)] uppercase tracking-[0.14em] text-[#D86A39]">
            ELO {slot.player.elo}
          </p>
        ) : null}
      </div>
    </>
  );
};

type StatusLogProps = {
  message: string;
  screen: MatchmakingScreen;
  secondary: string;
};

const StatusLog = ({ message, screen, secondary }: StatusLogProps) => {
  const style = screen === 'menu'
    ? toFrameStyle(409, 896, 1072, 85)
    : screen === 'party2'
      ? toFrameStyle(418, 73, 1072, 83)
      : toFrameStyle(424, 40, 1072, 83);

  return (
    <div className="absolute" style={style}>
      <img alt="" aria-hidden="true" className="h-full w-full object-contain" src={UI.log} />
      <div className="absolute inset-[8%] flex items-center justify-between gap-6 px-[4%]">
        <p className="truncate text-[clamp(0.82rem,1.2vw,1rem)] font-semibold uppercase tracking-[0.12em] text-[#D86A39]">
          {message}
        </p>
        <p className="shrink-0 text-[clamp(0.72rem,0.98vw,0.88rem)] uppercase tracking-[0.16em] text-[#D86A39]">
          {secondary}
        </p>
      </div>
    </div>
  );
};

type RoomCodeTextProps = {
  code: string;
  style: CSSProperties;
};

const RoomCodeText = ({ code, style }: RoomCodeTextProps) => (
  <div className="absolute flex items-center justify-center" style={style}>
    <span className="text-[clamp(1rem,1.8vw,2.55rem)] font-black uppercase tracking-[0.26em] text-[#6b3214]">
      {code}
    </span>
  </div>
);

type AssetButtonProps = {
  alt: string;
  onClick: () => void;
  src: string;
  style: CSSProperties;
};

const AssetButton = ({ alt, onClick, src, style }: AssetButtonProps) => (
  <button
    className="absolute transition-transform hover:scale-[1.02] active:scale-[0.98]"
    onClick={onClick}
    style={style}
    type="button"
  >
    <img alt={alt} className="h-full w-full object-contain" src={src} />
  </button>
);

type ActionButtonProps = {
  alt: string;
  onClick: () => void;
  src: string;
  style: CSSProperties;
};

const ActionButton = ({ alt, onClick, src, style }: ActionButtonProps) => (
  <button
    className="absolute transition-transform hover:scale-[1.02] active:scale-[0.98]"
    onClick={onClick}
    style={style}
    type="button"
  >
    <img alt={alt} className="h-full w-full object-contain" src={src} />
  </button>
);
