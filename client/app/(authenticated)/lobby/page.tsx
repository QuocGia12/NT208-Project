'use client';

import { useRouter } from 'next/navigation';

const START_BUTTON_ASSET = '/images/ui-game/btn_start.png';

export default function LobbyPage() {
  const router = useRouter();

  return (
    <section className="lobby-scene-stage pointer-events-none">
      <div className="lobby-scene-footer-ui pointer-events-auto">
        <p className="lobby-scene-status">Bấm BẮT ĐẦU CHƠI để mở khu tạo đội và tìm trận mới.</p>
        <p className="lobby-scene-timer">Luồng matchmaking hiện đã tách sang trang riêng theo Figma.</p>
        <p className="lobby-scene-connection">
          Điều hướng mới: <span>/matchmaking</span>
        </p>
      </div>

      <button
        className="lobby-play-button pointer-events-auto"
        onClick={() => router.push('/matchmaking')}
        type="button"
      >
        <img alt="" aria-hidden="true" className="lobby-play-button-image" src={START_BUTTON_ASSET} />
      </button>
    </section>
  );
}
