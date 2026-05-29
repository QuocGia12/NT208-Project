'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

import PhaserGame from '@/components/PhaserGame';
import {
  createPreviewPayload,
  type GamePreviewScenario,
} from '@/phaser/mock/gamePreviewData';

type PreviewMode = 'figma' | 'live';

const FIGMA_STAGE = {
  width: 1943,
  height: 1104,
} as const;

const figmaAssets = [
  {
    key: 'background',
    src: '/figma-game-ui/background-main.png',
    alt: 'Figma background',
    x: 0,
    y: 0,
    width: 1943,
    height: 1104,
  },
  {
    key: 'board',
    src: '/figma-game-ui/board-main-table.png',
    alt: 'Figma board',
    x: 678,
    y: 83,
    width: 601,
    height: 751,
  },
  {
    key: 'player-info',
    src: '/figma-game-ui/player-info-panel.png',
    alt: 'Figma player info panel',
    x: 85,
    y: 102,
    width: 413,
    height: 901,
  },
  {
    key: 'card-panel',
    src: '/figma-game-ui/card-panel.png',
    alt: 'Figma card panel',
    x: 554,
    y: 877,
    width: 850,
    height: 220,
  },
  {
    key: 'dice',
    src: '/figma-game-ui/dice-display.png',
    alt: 'Figma dice display',
    x: 1556,
    y: 87,
    width: 247,
    height: 236,
  },
  {
    key: 'button-roll',
    src: '/figma-game-ui/button-roll.png',
    alt: 'Figma roll button',
    x: 1550,
    y: 373,
    width: 266,
    height: 72,
  },
  {
    key: 'button-skip',
    src: '/figma-game-ui/button-skip.png',
    alt: 'Figma skip button',
    x: 1550,
    y: 476,
    width: 266,
    height: 72,
  },
  {
    key: 'movement-pad',
    src: '/figma-game-ui/movement-pad.png',
    alt: 'Figma movement pad',
    x: 1518,
    y: 665,
    width: 325,
    height: 321,
  },
] as const;

const scenarioLabels: Record<GamePreviewScenario, { title: string; note: string }> = {
  move: {
    title: 'Move Phase',
    note: 'Live mock de check board, movement, player state.',
  },
  cards: {
    title: 'Card Phase',
    note: 'Live mock de check card panel va action flow.',
  },
  spawn: {
    title: 'Spawn Phase',
    note: 'Live mock de check state dau turn.',
  },
};

export const GamePreviewShell = () => {
  const [mode, setMode] = useState<PreviewMode>('figma');
  const [scenario, setScenario] = useState<GamePreviewScenario>('move');

  const payload = useMemo(() => createPreviewPayload(scenario), [scenario]);

  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-5 text-slate-100 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <div className="rounded-3xl border border-white/10 bg-[#0d1b2d]/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-wide text-[#f4d57b]">Game UI Preview</h1>
              <p className="mt-1 text-sm text-slate-300">
                Figma asset preview da duoc pull truc tiep tu file design. Live mock duoi day chi de doi chieu logic.
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                {mode === 'figma'
                  ? 'Figma Asset Preview • Asset that da xuat truc tiep tu node trong file Figma'
                  : `${scenarioLabels[scenario].title} • ${scenarioLabels[scenario].note}`}
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap gap-2">
                <button
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    mode === 'figma'
                      ? 'bg-[#f4d57b] text-[#1e293b]'
                      : 'bg-white/8 text-slate-200 hover:bg-white/14'
                  }`}
                  onClick={() => setMode('figma')}
                  type="button"
                >
                  Figma Assets
                </button>
                <button
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    mode === 'live'
                      ? 'bg-[#f4d57b] text-[#1e293b]'
                      : 'bg-white/8 text-slate-200 hover:bg-white/14'
                  }`}
                  onClick={() => setMode('live')}
                  type="button"
                >
                  Live Mock
                </button>
              </div>

              {mode === 'live' ? (
                <div className="flex flex-wrap gap-2">
                  {(['move', 'cards', 'spawn'] as GamePreviewScenario[]).map((item) => {
                    const active = item === scenario;
                    return (
                      <button
                        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                          active
                            ? 'bg-[#d9e6ff] text-[#1e293b]'
                            : 'bg-white/8 text-slate-200 hover:bg-white/14'
                        }`}
                        key={item}
                        onClick={() => setScenario(item)}
                        type="button"
                      >
                        {scenarioLabels[item].title}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#08101c] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          {mode === 'figma' ? (
            <div className="overflow-auto rounded-[20px] bg-[#0b1024] p-3">
              <div
                className="relative mx-auto"
                style={{
                  width: FIGMA_STAGE.width,
                  height: FIGMA_STAGE.height,
                }}
              >
                {figmaAssets.map((asset) => (
                  <Image
                    alt={asset.alt}
                    className="pointer-events-none select-none"
                    height={asset.height}
                    key={asset.key}
                    priority={asset.key === 'background'}
                    src={asset.src}
                    style={{
                      position: 'absolute',
                      left: asset.x,
                      top: asset.y,
                      width: asset.width,
                      height: asset.height,
                    }}
                    unoptimized
                    width={asset.width}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="aspect-[16/9] w-full overflow-hidden rounded-[20px] bg-[#0b1024]">
              <PhaserGame
                key={scenario}
                playerId={payload.privateState.playerId}
                previewPrivateState={payload.privateState}
                previewState={payload.state}
                roomId={payload.state.roomId}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
