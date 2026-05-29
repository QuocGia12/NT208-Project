import dynamic from 'next/dynamic';

const GamePreviewShell = dynamic(
  () => import('@/components/game/game-preview-shell').then((module) => module.GamePreviewShell),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-[#07111f] px-6 text-slate-200">
        Loading game preview...
      </main>
    ),
  },
);

export default function GamePreviewPage() {
  return <GamePreviewShell />;
}
