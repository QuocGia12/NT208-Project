import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import BoardScene from '../game/scenes/BoardScene';

export default function GameCanvas({ gameState, myUserId, onCellClick, sceneRef }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const initializedRef = useRef(false); // flag chặn khởi tạo lại

  useEffect(() => {
    // Chỉ khởi tạo 1 lần duy nhất
    if (initializedRef.current) return;
    if (!gameState?.board || !gameState?.players) return;
    if (!containerRef.current) return;

    initializedRef.current = true;
    console.log('GameCanvas: khởi tạo Phaser 1 lần duy nhất');

    const config = {
      type: Phaser.AUTO,
      width: 900,
      height: 600,
      backgroundColor: '#1a1a2e',
      parent: containerRef.current,
      scene: BoardScene,
      audio: { noAudio: true } // tắt audio để hết lỗi AudioContext
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Lắng nghe event từ BoardScene báo đã ready
    game.events.on('sceneReady', (scene) => {
      console.log('sceneReady nhận được, gán sceneRef');
      if (sceneRef) sceneRef.current = scene;
    });

    game.events.on('ready', () => {
      game.scene.start('BoardScene', {
        gameState,
        myUserId,
        socketHandlers: { onCellClick }
      });
    });

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []); // dependency rỗng — chỉ chạy 1 lần khi mount

  if (!gameState?.board) {
    return (
      <div style={{
        width: 900, height: 600,
        background: '#1a1a2e', borderRadius: 12,
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#555', fontSize: 14
      }}>
        ⏳ Đang tải bàn cờ...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ width: 900, height: 600, borderRadius: 12, overflow: 'hidden' }}
    />
  );
}