import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import BoardScene from '../game/scenes/BoardScene';

export default function GameCanvas({ gameState, myUserId, onCellClick, sceneRef }) {
    const containerRef = useRef(null);
    const gameRef = useRef(null);

    useEffect(() => {
        if (!gameState || gameRef.current) return;

        const config = {
        type: Phaser.AUTO,
        width: 720,
        height: 520,
        backgroundColor: '#1a1a2e',
        parent: containerRef.current,
        scene: BoardScene,
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;

        game.events.once('ready', () => {
        game.scene.start('BoardScene', {
            gameState,
            myUserId,
            socketHandlers: { onCellClick }
        });
        if (sceneRef) {
            sceneRef.current = game.scene.getScene('BoardScene');
        }
        });

        return () => {
        game.destroy(true);
        gameRef.current = null;
        };
    }, [gameState]);

    return (
        <div
        ref={containerRef}
        style={{ width: 720, height: 520, borderRadius: 12, overflow: 'hidden' }}
        />
    );
}
