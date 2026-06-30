'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  GuideBookButton,
  GuideBookModal,
  guidebookStyle
} from '@/components/app/guidebook-modal';
import PhaserGame from '@/components/PhaserGame';
import {
  type GameMatchFound,
  type GameSocketError,
  gameSocketClient
} from '@/lib/game-socket-client';
import { useAuthStore } from '@/store/auth-store';

type PhaserRoomShellProps = {
  roomId: string;
};

type WrappedPayload<T> = T | { data: T };

const unwrapPayload = <T,>(payload: WrappedPayload<T>): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }

  return payload;
};

// Normalize http:// → https:// cho URL cũ được lưu trong localStorage
// (data được upload trước khi Nginx có X-Forwarded-Proto → URL bị lưu dưới dạng http://)
const toHttps = (url: string | null | undefined): string | null =>
  url ? url.replace(/^http:\/\//, 'https://') : null;

export const PhaserRoomShell = ({ roomId }: PhaserRoomShellProps) => {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [isGuideBookOpen, setIsGuideBookOpen] = useState(false);
  const [socketReady, setSocketReady] = useState(gameSocketClient.isConnected());
  const [status, setStatus] = useState(
    gameSocketClient.isConnected() ? 'Đã kết nối máy chủ game.' : 'Đang kết nối máy chủ game...'
  );
  const [routeMatch, setRouteMatch] = useState<GameMatchFound | null>(() =>
    gameSocketClient.getMatchForRoom(roomId.trim())
  );

  const normalizedRoomId = useMemo(() => roomId.trim(), [roomId]);
  const activeMatch = routeMatch ?? gameSocketClient.getMatchForRoom(normalizedRoomId);
  const matchedPlayerId = gameSocketClient.myPlayerId || activeMatch?.yourPlayerId || user?.id || '';
  const hasActiveMatchForRoute = activeMatch?.roomId === normalizedRoomId;

  // Normalize http:// → https:// trước khi truyền vào Phaser
  // Cần thiết vì data cũ trong localStorage vẫn giữ URL http:// từ trước khi fix Nginx
  const safeDicePanelImageUrl = useMemo(
    () => toHttps(user?.equippedDicePanelImageUrl),
    [user?.equippedDicePanelImageUrl]
  );

  const safeMapSkinAssets = useMemo(() => {
    const assets = user?.equippedMapAssets;
    if (!assets) return null;
    return {
      previewImageUrl: toHttps(assets.previewImageUrl) ?? assets.previewImageUrl,
      addCardImageUrl: toHttps(assets.addCardImageUrl) ?? assets.addCardImageUrl,
      zodiacBoxImageUrls: Object.fromEntries(
        Object.entries(assets.zodiacBoxImageUrls).map(([k, v]) => [k, toHttps(v) ?? v])
      ) as typeof assets.zodiacBoxImageUrls,
    };
  }, [user?.equippedMapAssets]);

  useEffect(() => {
    const hydratedMatch = gameSocketClient.getMatchForRoom(normalizedRoomId);
    if (hydratedMatch) {
      setRouteMatch(hydratedMatch);
    } else if (!gameSocketClient.myPlayerId && user?.id) {
      gameSocketClient.myPlayerId = user.id;
    }

    const socket = gameSocketClient.connect();

    const handleConnect = () => {
      setSocketReady(true);
      setStatus('Đã kết nối máy chủ game.');
    };

    const handleDisconnect = () => {
      setSocketReady(false);
      setStatus('Mất kết nối. Đang kết nối lại...');
    };

    const handleGameError = (payload: WrappedPayload<GameSocketError>) => {
      const data = unwrapPayload(payload);
      setStatus(data?.message ?? 'Máy chủ game trả về lỗi.');
    };

    const handleMatchFound = (payload: WrappedPayload<GameMatchFound>) => {
      const match = unwrapPayload(payload);
      if (match?.roomId === normalizedRoomId) {
        gameSocketClient.rememberMatch(match);
        setRouteMatch(match);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('game:error', handleGameError);
    socket.on('match:found', handleMatchFound);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('game:error', handleGameError);
      socket.off('match:found', handleMatchFound);
    };
  }, [normalizedRoomId, user?.id]);

  const handleBackToLobby = () => {
    router.push('/lobby');
  };

  if (!normalizedRoomId || !matchedPlayerId) {
    return (
      <div className="phaser-room-shell">
        <div className="game-route-loading">
          <p className="game-route-loading-title moba-heading">Đang chuẩn bị trận...</p>
          <p className="game-route-loading-subtitle">
            Thiếu phòng hoặc phiên người chơi. Hãy quay về lobby và bắt đầu trận lại.
          </p>
          <button className="game-route-back-btn" onClick={handleBackToLobby} type="button">
            Trở về lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="phaser-room-shell">
      <div className="game-route-topbar">
        <button className="game-route-back-btn" onClick={handleBackToLobby} type="button">
          Trở về lobby
        </button>
        <div className="game-route-meta">
          <span>Phòng: {normalizedRoomId}</span>
          <span>{status}</span>
          {!hasActiveMatchForRoute ? (
            <span className="game-route-warning">Đang chờ phiên trận đấu...</span>
          ) : null}
        </div>
      </div>

      <div className="phaser-canvas-frame">
        {socketReady ? (
          <div className="relative h-full w-full overflow-hidden bg-[#050816]">
            <div className="absolute inset-0">
              <PhaserGame
                roomId={normalizedRoomId}
                playerId={matchedPlayerId}
                dicePanelImageUrl={safeDicePanelImageUrl}
                mapSkinAssets={safeMapSkinAssets}
              />
            </div>
            <button
              className="game-route-mobile-back-btn"
              onClick={handleBackToLobby}
              type="button"
            >
              Về lobby
            </button>
            <GuideBookButton
              alt="Mở hướng dẫn"
              onClick={() => setIsGuideBookOpen(true)}
              src="/game-ui/btn_GuideBook.svg"
              style={guidebookStyle(17, 14, 100, 66.39)}
            />
            <GuideBookModal
              isOpen={isGuideBookOpen}
              onClose={() => setIsGuideBookOpen(false)}
              useFixedScene
            />
          </div>
        ) : (
          <div className="game-route-loading">
            <p className="game-route-loading-title moba-heading">Đang kết nối...</p>
            <p className="game-route-loading-subtitle">Đang mở phiên game realtime.</p>
          </div>
        )}
      </div>
    </div>
  );
};
