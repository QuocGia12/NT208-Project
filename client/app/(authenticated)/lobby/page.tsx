'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  type GameMatchmakingPlayer,
  type GamePartyMode,
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

const formatElapsed = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
};

const WAITING_AUDIO_STATE_EVENT = 'zodiac:waiting-audio-state';
const START_BUTTON_ASSET = '/images/ui-game/btn_start.png';

const PARTY4_SLOT_LABELS: Record<GameTeamSlotId, string> = {
  'team1-slot0': 'Team 1 Slot 0',
  'team1-slot1': 'Team 1 Slot 1',
  'team2-slot0': 'Team 2 Slot 0',
  'team2-slot1': 'Team 2 Slot 1'
};

type MatchmakingView = 'select' | 'quick' | 'party2' | 'party4';

export default function LobbyPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [isMatchmakingOpen, setIsMatchmakingOpen] = useState(false);
  const [activeView, setActiveView] = useState<MatchmakingView>('select');
  const [isSearching, setIsSearching] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [searchStartedAt, setSearchStartedAt] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState('Ready to start.');
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [currentParty, setCurrentParty] = useState<GamePartyUpdate | null>(null);
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
    if (!isSearching || searchStartedAt === null) {
      return;
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
      void audio.play().catch(() => {
        // Autoplay might be blocked until user interaction.
      });
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }, [currentParty?.status, isSearching]);

  useEffect(() => {
    const socket = gameSocketClient.connect();

    const handleConnect = () => {
      setIsSocketReady(true);
      setStatusMessage('Game server connected.');
    };

    const handleDisconnect = () => {
      setIsSocketReady(false);
      setStatusMessage('Game server disconnected. Reconnecting...');
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
        setStatusMessage(`Searching for players... ${queue.queueSize ?? 1} in queue.`);
      } else {
        setIsSearching(false);
        setSearchStartedAt(null);
        setElapsedSeconds(0);
        setStatusMessage('Queue canceled. Ready to start.');
      }
    });

    const unsubscribeParty = gameSocketClient.onPartyUpdate((party) => {
      if (pendingPartyTimerRef.current !== null) {
        window.clearTimeout(pendingPartyTimerRef.current);
        pendingPartyTimerRef.current = null;
      }

      setCurrentParty(party);
      setActiveView(party.mode === 'party2' ? 'party2' : 'party4');
      setIsMatchmakingOpen(true);
      setStatusMessage(
        party.status === 'queued'
          ? 'Party queued. Waiting for opponents...'
          : `Party ${party.code} ready.`
      );
    });

    const unsubscribeMatch = gameSocketClient.onMatchFound((match) => {
      setIsSearching(false);
      setSearchStartedAt(null);
      setElapsedSeconds(0);
      setStatusMessage(`Match found: ${match.roomId}`);
      router.push(`/game/${match.roomId}`);
    });

    const unsubscribeError = gameSocketClient.onError((error) => {
      if (pendingPartyTimerRef.current !== null) {
        window.clearTimeout(pendingPartyTimerRef.current);
        pendingPartyTimerRef.current = null;
      }

      setStatusMessage(error.message || 'Matchmaking error.');
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
      setStatusMessage('Session missing. Please login again.');
      return null;
    }

    return playerPayload;
  };

  const openMatchmaking = () => {
    setIsMatchmakingOpen(true);
    setActiveView(currentParty?.mode === 'party4' ? 'party4' : currentParty?.mode === 'party2' ? 'party2' : 'select');
  };

  const closeMatchmaking = () => {
    setIsMatchmakingOpen(false);
  };

  const handleQuickJoin = () => {
    const player = ensurePlayer();
    if (!player) return;

    setActiveView('quick');
    setCurrentParty(null);
    setIsSearching(true);
    setSearchStartedAt(Date.now());
    setElapsedSeconds(0);
    setStatusMessage('Searching for players...');
    gameSocketClient.quickJoin(player, token ?? undefined);
  };

  const handleQuickCancel = () => {
    gameSocketClient.quickCancel();
    setIsSearching(false);
    setSearchStartedAt(null);
    setElapsedSeconds(0);
    setStatusMessage('Queue canceled. Ready to start.');
  };

  const handleCreateParty = (mode: GamePartyMode) => {
    const player = ensurePlayer();
    if (!player) return;

    setIsSearching(false);
    setSearchStartedAt(null);
    setElapsedSeconds(0);
    setCurrentParty(null);
    setActiveView(mode);
    setStatusMessage(mode === 'party2' ? 'Creating Party 2...' : 'Creating Party 4...');
    gameSocketClient.createParty(mode, player, token ?? undefined);

    if (pendingPartyTimerRef.current !== null) {
      window.clearTimeout(pendingPartyTimerRef.current);
    }

    pendingPartyTimerRef.current = window.setTimeout(() => {
      pendingPartyTimerRef.current = null;
      if (!gameSocketClient.isConnected()) {
        setStatusMessage('Game server is not connected. Please check server port 3001.');
        return;
      }

      setStatusMessage('Still waiting for party code from game server...');
    }, 2500);
  };

  const handleJoinParty = () => {
    const player = ensurePlayer();
    const code = joinCode.trim().toUpperCase();
    if (!player || !code) {
      setStatusMessage('Enter a party code first.');
      return;
    }

    setCurrentParty(null);
    setStatusMessage(`Joining party ${code}...`);
    gameSocketClient.joinParty(code, player, token ?? undefined);
  };

  const handleLeaveParty = () => {
    gameSocketClient.leaveParty();
    setCurrentParty(null);
    setActiveView('select');
    setStatusMessage('Left party. Ready to start.');
  };

  const handleSwitchSlot = (slotId: GameTeamSlotId) => {
    const targetSlot = currentParty?.slots.find((slot) => slot.slotId === slotId);
    if (!targetSlot || targetSlot.player) return;

    gameSocketClient.switchSlot(slotId);
  };

  const handleReadyToggle = () => {
    gameSocketClient.setReady(!mySlot?.player?.ready);
  };

  return (
    <section className="lobby-scene-stage pointer-events-none">
      <div className="lobby-scene-footer-ui pointer-events-auto">
        <p className="lobby-scene-status">{statusMessage}</p>
        <p className={`lobby-scene-timer ${isSearching || currentParty?.status === 'queued' ? 'lobby-scene-timer-active' : ''}`}>
          {isSearching || currentParty?.status === 'queued'
            ? `Searching... ${formatElapsed(elapsedSeconds)}`
            : 'Queue timer: 00:00'}
        </p>
        <p className="lobby-scene-connection">
          Game Socket: <span>{isSocketReady ? 'Online' : 'Connecting...'}</span>
        </p>
      </div>

      <button
        className={`lobby-play-button pointer-events-auto ${isSearching || currentParty?.status === 'queued' ? 'lobby-play-button-searching' : ''}`}
        onClick={openMatchmaking}
        type="button"
      >
        <img alt="" aria-hidden="true" className="lobby-play-button-image" src={START_BUTTON_ASSET} />
        {isSearching || currentParty?.status === 'queued' ? (
          <span className="lobby-play-button-badge">Đang tìm trận</span>
        ) : null}
      </button>

      {isMatchmakingOpen ? (
        <div
          className="matchmaking-modal-layer pointer-events-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="matchmaking-panel">
            <div className="matchmaking-panel-header">
              <div>
                <p className="matchmaking-kicker">12 Con Giáp Arena</p>
                <h2 className="matchmaking-title moba-heading">Bắt đầu trận</h2>
              </div>
              <button className="matchmaking-close-btn" onClick={closeMatchmaking} type="button">
                Đóng
              </button>
            </div>

            <div className="matchmaking-tabs">
              <button
                className={`matchmaking-tab ${activeView === 'select' || activeView === 'quick' ? 'matchmaking-tab-active' : ''}`}
                onClick={() => setActiveView('select')}
                type="button"
              >
                Bắt đầu ngay
              </button>
              <button
                className={`matchmaking-tab ${activeView === 'party2' ? 'matchmaking-tab-active' : ''}`}
                onClick={() => setActiveView('party2')}
                type="button"
              >
                Phòng 2
              </button>
              <button
                className={`matchmaking-tab ${activeView === 'party4' ? 'matchmaking-tab-active' : ''}`}
                onClick={() => setActiveView('party4')}
                type="button"
              >
                Phòng 4
              </button>
            </div>

            <p className="matchmaking-status-line">{statusMessage}</p>

            <div className="matchmaking-content">
              {(activeView === 'select' || activeView === 'quick') ? (
                <section className="matchmaking-card matchmaking-quick-card">
                  <p className="matchmaking-card-tag">Solo Queue</p>
                  <h3>Bắt đầu ngay</h3>
                  <p>
                    Vào hàng chờ cá nhân. Server sẽ ghép 4 người và random thành 2 đội.
                  </p>
                  {isSearching ? (
                    <button className="matchmaking-action matchmaking-action-danger" onClick={handleQuickCancel} type="button">
                      Hủy tìm trận
                    </button>
                  ) : (
                    <button className="matchmaking-action matchmaking-action-primary" onClick={handleQuickJoin} type="button">
                      Tìm trận ngay
                    </button>
                  )}
                </section>
              ) : null}

              {activeView === 'party2' ? (
                <section className="matchmaking-card">
                  <p className="matchmaking-card-tag">Duo Party</p>
                  <h3>Phòng 2</h3>
                  <p>
                    Hai người trong cùng phòng sẽ vào cùng một team. Khi đủ 2 người và cả 2 cùng Ready, server tự động tìm đối thủ.
                  </p>
                  <div className="matchmaking-action-row">
                    <button className="matchmaking-action matchmaking-action-primary" onClick={() => handleCreateParty('party2')} type="button">
                      Tạo phòng 2
                    </button>
                    <input
                      className="matchmaking-code-input"
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                      placeholder="Nhập code"
                      type="text"
                      value={joinCode}
                    />
                    <button className="matchmaking-action matchmaking-action-muted" onClick={handleJoinParty} type="button">
                      Join
                    </button>
                  </div>

                  {currentParty?.mode === 'party2' ? (
                    <PartySummary
                      allPartyReady={allPartyReady}
                      currentParty={currentParty}
                      isPartyFull={isPartyFull}
                      mySlotReady={Boolean(mySlot?.player?.ready)}
                      onLeave={handleLeaveParty}
                      onReadyToggle={handleReadyToggle}
                    />
                  ) : null}
                </section>
              ) : null}

              {activeView === 'party4' ? (
                <section className="matchmaking-card">
                  <p className="matchmaking-card-tag">Custom Team</p>
                  <h3>Phòng 4</h3>
                  <p>
                    Chọn slot đội hình. Slot trống có thể click để đổi vị trí. Đủ 4 người ready là vào trận.
                  </p>
                  <div className="matchmaking-action-row">
                    <button className="matchmaking-action matchmaking-action-primary" onClick={() => handleCreateParty('party4')} type="button">
                      Tạo phòng 4
                    </button>
                    <input
                      className="matchmaking-code-input"
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                      placeholder="Nhập code"
                      type="text"
                      value={joinCode}
                    />
                    <button className="matchmaking-action matchmaking-action-muted" onClick={handleJoinParty} type="button">
                      Join
                    </button>
                  </div>

                  {currentParty?.mode === 'party4' ? (
                    <div className="party-block">
                      <div className="party-heading-row">
                        <span>Code: {currentParty.code}</span>
                        <span>{partyPlayers}/4 players</span>
                      </div>
                      <div className="party-slot-grid">
                        {currentParty.slots.map((slot) => (
                          <button
                            className={`party-slot-card ${slot.player ? 'party-slot-filled' : 'party-slot-empty'} ${slot.player?.id === user?.id ? 'party-slot-mine' : ''}`}
                            disabled={Boolean(slot.player)}
                            key={slot.slotId}
                            onClick={() => handleSwitchSlot(slot.slotId)}
                            type="button"
                          >
                            <span className="party-slot-label">{PARTY4_SLOT_LABELS[slot.slotId]}</span>
                            {slot.player ? (
                              <>
                                <span className="party-slot-name">{slot.player.username}</span>
                                <span className={`party-ready-pill ${slot.player.ready ? 'party-ready-pill-on' : ''}`}>
                                  {slot.player.ready ? 'Ready' : 'Not ready'}
                                </span>
                              </>
                            ) : (
                              <span className="party-slot-empty-label">Click để đổi slot</span>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="party-footer-actions">
                        <button className="matchmaking-action matchmaking-action-muted" onClick={handleReadyToggle} type="button">
                          {mySlot?.player?.ready ? 'Unready' : 'Ready'}
                        </button>
                        <button className="matchmaking-action matchmaking-action-danger" onClick={handleLeaveParty} type="button">
                          Rời phòng
                        </button>
                      </div>
                      <p className="party-hint">
                        {isPartyFull && allPartyReady
                          ? 'Tất cả đã ready. Server đang tạo trận...'
                          : 'Cần đủ 4 người và tất cả ready.'}
                      </p>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type PartySummaryProps = {
  currentParty: GamePartyUpdate;
  isPartyFull: boolean;
  allPartyReady: boolean;
  mySlotReady: boolean;
  onReadyToggle: () => void;
  onLeave: () => void;
};

function PartySummary({
  currentParty,
  isPartyFull,
  allPartyReady,
  mySlotReady,
  onReadyToggle,
  onLeave
}: PartySummaryProps) {
  return (
    <div className="party-block">
      <div className="party-heading-row">
        <span>Code: {currentParty.code}</span>
        <span>{currentParty.slots.filter((slot) => slot.player).length}/2 players</span>
      </div>
      <div className="party-slot-grid party-slot-grid-duo">
        {currentParty.slots.map((slot) => (
          <div className={`party-slot-card ${slot.player ? 'party-slot-filled' : 'party-slot-empty'}`} key={slot.slotId}>
            <span className="party-slot-label">{slot.teamSlot === 0 ? 'Team Slot 0' : 'Team Slot 1'}</span>
            <span className="party-slot-name">{slot.player?.username ?? 'Đang chờ người chơi'}</span>
            {slot.player ? (
              <span className={`party-ready-pill ${slot.player.ready ? 'party-ready-pill-on' : ''}`}>
                {slot.player.ready ? 'Ready' : 'Not ready'}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="party-footer-actions">
        <button className="matchmaking-action matchmaking-action-muted" onClick={onReadyToggle} type="button">
          {mySlotReady ? 'Unready' : 'Ready'}
        </button>
        <button className="matchmaking-action matchmaking-action-danger" onClick={onLeave} type="button">
          Rời phòng
        </button>
      </div>
      <p className="party-hint">
        {currentParty.status === 'queued'
          ? 'Party đang trong queue. Có thể ghép với party 2 khác hoặc 2 người solo.'
          : isPartyFull
            ? allPartyReady
              ? 'Cả phòng đã ready. Server đang tự động tìm đối thủ...'
              : 'Cần cả 2 người cùng Ready để auto vào queue.'
            : 'Chia sẻ code để mời đồng đội.'}
      </p>
    </div>
  );
}


