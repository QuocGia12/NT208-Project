'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const PhaserRoomShell = dynamic(
  () => import('@/components/game/phaser-room-shell').then((module) => module.PhaserRoomShell),
  {
    ssr: false,
    loading: () => (
      <section className="game-route-shell">
        <div className="game-route-loading">
          <p className="game-route-loading-title moba-heading">Initializing Phaser Arena...</p>
          <p className="game-route-loading-subtitle">Preparing render context.</p>
        </div>
      </section>
    )
  }
);

const normalizeRoomParam = (roomId: string | string[] | undefined) => {
  if (typeof roomId === 'string') {
    return roomId;
  }

  if (Array.isArray(roomId) && roomId.length > 0) {
    return roomId[0];
  }

  return '';
};

export default function GameRoomPage() {
  const params = useParams<{ roomId: string | string[] }>();
  const roomId = normalizeRoomParam(params?.roomId);

  return (
    <section className="game-route-shell">
      <PhaserRoomShell roomId={roomId} />
    </section>
  );
}
