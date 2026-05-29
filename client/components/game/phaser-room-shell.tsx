'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

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

export const PhaserRoomShell = ({ roomId }: PhaserRoomShellProps) => {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [socketReady, setSocketReady] = useState(gameSocketClient.isConnected());
  const [status, setStatus] = useState(
    gameSocketClient.isConnected() ? 'Connected to game server.' : 'Connecting to game server...'
  );
  const [routeMatch, setRouteMatch] = useState<GameMatchFound | null>(() =>
    gameSocketClient.getMatchForRoom(roomId.trim())
  );

  const normalizedRoomId = useMemo(() => roomId.trim(), [roomId]);
  const activeMatch = routeMatch ?? gameSocketClient.getMatchForRoom(normalizedRoomId);
  const matchedPlayerId = gameSocketClient.myPlayerId || activeMatch?.yourPlayerId || user?.id || '';
  const hasActiveMatchForRoute = activeMatch?.roomId === normalizedRoomId;

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
      setStatus('Connected to game server.');
    };

    const handleDisconnect = () => {
      setSocketReady(false);
      setStatus('Disconnected. Reconnecting...');
    };

    const handleGameError = (payload: WrappedPayload<GameSocketError>) => {
      const data = unwrapPayload(payload);
      setStatus(data?.message ?? 'Game server returned an error.');
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
          <p className="game-route-loading-title moba-heading">Preparing match...</p>
          <p className="game-route-loading-subtitle">
            Missing room or player session. Please return to lobby and start a match again.
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
          <span>Room: {normalizedRoomId}</span>
          <span>{status}</span>
          {!hasActiveMatchForRoute ? (
            <span className="game-route-warning">Waiting for active match session...</span>
          ) : null}
        </div>
      </div>

      <div className="phaser-canvas-frame">
        {socketReady ? (
          <PhaserGame roomId={normalizedRoomId} playerId={matchedPlayerId} />
        ) : (
          <div className="game-route-loading">
            <p className="game-route-loading-title moba-heading">Connecting...</p>
            <p className="game-route-loading-subtitle">Opening realtime game session.</p>
          </div>
        )}
      </div>
    </div>
  );
};
