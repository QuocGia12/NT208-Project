'use client';

import { useRouter } from 'next/navigation';

import { FixedAspectScene } from '@/components/layout/fixed-aspect-scene';

const START_BUTTON_ASSET = '/images/ui-game/btn_start.png';

const toSceneStyle = (left: number, top: number, width: number, height: number) => ({
  height: `${(height / 1080) * 100}%`,
  left: `${(left / 1920) * 100}%`,
  top: `${(top / 1080) * 100}%`,
  width: `${(width / 1920) * 100}%`
});

export default function LobbyPage() {
  const router = useRouter();

  return (
    <section className="h-full w-full">
      <FixedAspectScene className="pointer-events-none" sceneClassName="pointer-events-none">
        <div className="relative h-full w-full">
          <button
            className="absolute pointer-events-auto transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => router.push('/matchmaking')}
            style={toSceneStyle(1475, 875, 430, 226)}
            type="button"
          >
            <img alt="" aria-hidden="true" className="h-full w-full object-contain" src={START_BUTTON_ASSET} />
          </button>
        </div>
      </FixedAspectScene>
    </section>
  );
}
