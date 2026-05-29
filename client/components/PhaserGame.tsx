import React, { useEffect, useRef } from 'react';
import type * as PhaserNamespace from 'phaser';
import { SocketClient } from '../lib/SocketClient';

interface Props {
  roomId: string;
  playerId: string;
}

const socketClient = SocketClient.getInstance();

const PhaserGame: React.FC<Props> = ({ roomId, playerId }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: PhaserNamespace.Game | null = null;
    let cancelled = false;

    const ensureSocketConnected = async (): Promise<void> => {
      if (socketClient.isConnected()) return;

      socketClient.connect();
      if (socketClient.isConnected()) return;

      await new Promise<void>(resolve => {
        const timeoutId = window.setTimeout(() => {
          cleanup();
          resolve();
        }, 1800);

        const onConnect = () => {
          cleanup();
          resolve();
        };

        const cleanup = () => {
          window.clearTimeout(timeoutId);
          socketClient.off('connect', onConnect);
        };

        socketClient.on('connect', onConnect);
      });
    };

    const initGame = async (): Promise<void> => {
      await ensureSocketConnected();
      if (cancelled) return;

      const Phaser = await import('phaser');

      const [{ PreloadScene }, { BoardScene }, { UIScene }] = await Promise.all([
        import('../phaser/scenes/PreloadScene'),
        import('../phaser/scenes/BoardScene'),
        import('../phaser/scenes/UIScene'),
      ]);

      if (cancelled || !containerRef.current) return;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: 1280,
        height: 720,
        backgroundColor: '#1a1a2e',
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      });

      game.scene.add('PreloadScene', PreloadScene, false);
      game.scene.add('BoardScene', BoardScene, false);
      game.scene.add('UIScene', UIScene, false);
      game.registry.set('roomId', roomId);
      game.registry.set('playerId', playerId);
      game.scene.start('PreloadScene');
    };

    void initGame();

    return () => {
      cancelled = true;
      if (game) {
        game.destroy(true);
      }
    };
  }, [roomId, playerId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        backgroundColor: '#0b1024',
        overflow: 'hidden',
      }}
    />
  );
};

export default PhaserGame;
