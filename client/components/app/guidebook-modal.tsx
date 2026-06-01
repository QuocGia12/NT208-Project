'use client';

import { useEffect, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Be_Vietnam_Pro } from 'next/font/google';

import { FixedAspectScene } from '@/components/layout/fixed-aspect-scene';

const GUIDEBOOK_SCENE = {
  width: 1920,
  height: 1080
} as const;

const GUIDEBOOK_UI = {
  frame: '/game-ui/guidebook/MainFrame.svg',
  close: '/game-ui/guidebook/RETURN-Back.svg'
} as const;

const guidebookFont = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800']
});

type GuideBookSection = {
  bullets?: string[];
  paragraphs?: string[];
  title: string;
};

const guidebookContent: { intro: string; sections: GuideBookSection[] } = {
  intro:
    'Chào mừng bạn đến với Đại Hội Lập Pháp của Ngọc Hoàng. Đây là một tựa game cờ chiến thuật phối hợp đồng đội (Co-op 2v2) đậm chất dân gian, nơi bạn và đồng đội phải chơi như "tuy hai mà một".',
  sections: [
    {
      title: '1. Mục tiêu tối thượng: Cắm cờ đoạt vị',
      paragraphs: [
        'Game chia làm 2 đội, mỗi đội gồm 2 người chơi, đối đầu trên bản đồ kích thước 7 x 9.',
        'Điều kiện thắng là đội bạn phải phối hợp chiếm đủ 10 ô Long Mạch (ô active) của đội mình trước để giành chiến thắng ngay lập tức.',
        'Bạn chỉ có thể chiếm ô Long Mạch có hình con giáp của chính mình bằng cách di chuyển đúng vào ô đó.'
      ]
    },
    {
      title: '2. Khởi đầu trận đấu',
      paragraphs: [
        'Ở lượt đầu tiên, bạn được quyền tự chọn 1 ô Rút Bài màu vàng đang trống trên bản đồ làm điểm xuất phát.',
        'Lưu ý: lượt xuất phát này sẽ không được rút bài bổ trợ.'
      ]
    },
    {
      title: '3. Vòng lặp 5 bước trong một lượt chơi',
      bullets: [
        'Pha 0 - Rút bài bắt buộc: hệ thống tự động rút cho bạn 1 lá bài bổ trợ và công khai lá bài đó trong 3 giây trước khi đưa vào tay.',
        'Pha 1 - Đổ xúc xắc: hệ thống tự roll ngẫu nhiên từ 1 đến 6 bước.',
        'Pha 2 - Dùng bài trước khi đi: bạn có tối đa 60 giây để kích hoạt các lá bài phép trên tay. Mỗi lần dùng 1 lá được cộng thêm 10 giây nhưng tổng thời gian không quá 60 giây.',
        'Pha 3 - Di chuyển: dùng các nút mũi tên để đi đúng số bước mà xúc xắc vừa đổ ra.',
        'Pha 4 - Dùng bài sau khi đi: tương tự pha 2, bạn có thêm một cơ hội dùng bài trước khi kết thúc lượt.'
      ]
    },
    {
      title: '4. "Sợi dây tình bạn" và luật di chuyển',
      paragraphs: [
        'Để game không biến thành màn "thân ai nấy lo", Ngọc Hoàng đặt ra quy định giới hạn khoảng cách giữa hai người cùng đội.',
        'Ban đầu, sợi dây liên kết cho phép hai đồng đội cách nhau tối đa 7 ô. Cứ mỗi khi đội bạn chiếm thêm được 2 ô Long Mạch, giới hạn này lại co ngắn thêm 1 ô.'
      ],
      bullets: [
        'Không được đi ra ngoài rìa bản đồ.',
        'Không được đi lùi ngay về ô mình vừa bước ra ở bước trước.',
        'Không được dẫm vào ô đã bị người khác chiếm.',
        'Không được đứng trùng vào ô đang có người chơi khác đứng.',
        'Không được đi vào vị trí khiến khoảng cách với đồng đội vượt quá giới hạn sợi dây.'
      ]
    },
    {
      title: '5. Hình phạt khi bị kẹt và đóng băng',
      bullets: [
        'Kẹt giữa đường (Lock): nếu đang đi nửa chừng mà hết đường hợp lệ, bạn sẽ mất lượt ngay lập tức và bị đóng băng ở lượt tiếp theo.',
        'Bị kẹt hoàn toàn (Stuck): hệ thống sẽ cứu bạn về một ô trống ngẫu nhiên, nhưng đội bạn có thể bị mất tối đa 2 ô Long Mạch đã chiếm. Đổi lại, sợi dây liên kết được nới thêm 1 ô để dễ thở hơn.'
      ]
    },
    {
      title: 'Mẹo bỏ túi cho bạn gánh team',
      bullets: [
        'Ghi nhớ 3 giây công khai bài của đối thủ để đoán được họ đang cầm bài gì.',
        'Tận dụng các lá bài team-play như đổi chỗ hoặc dịch chuyển đồng đội để cứu nhau đúng lúc.',
        'Càng chiếm nhiều ô thì dây càng ngắn, nên trước những bước quyết định hãy luôn nhìn vị trí của đồng đội.'
      ]
    }
  ]
};

export const guidebookStyle = (
  left: number,
  top: number,
  width: number,
  height: number
): CSSProperties => ({
  left: `${(left / GUIDEBOOK_SCENE.width) * 100}%`,
  top: `${(top / GUIDEBOOK_SCENE.height) * 100}%`,
  width: `${(width / GUIDEBOOK_SCENE.width) * 100}%`,
  height: `${(height / GUIDEBOOK_SCENE.height) * 100}%`
});

type GuideBookButtonProps = {
  alt: string;
  onClick: () => void;
  src: string;
  style: CSSProperties;
};

export const GuideBookButton = ({ alt, onClick, src, style }: GuideBookButtonProps) => (
  <button
    className="absolute z-20 transition-transform hover:scale-[1.03] active:scale-[0.98]"
    onClick={onClick}
    style={style}
    type="button"
  >
    <img alt={alt} className="h-full w-full object-contain" src={src} />
  </button>
);

type GuideBookModalProps = {
  isOpen: boolean;
  onClose: () => void;
  useFixedScene?: boolean;
};

export const GuideBookModal = ({ isOpen, onClose, useFixedScene = false }: GuideBookModalProps) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const contentBlocks = useMemo(
    () =>
      guidebookContent.sections.map((section) => (
        <section className="space-y-3" key={section.title}>
          <h3 className="text-[clamp(1rem,1.2vw,1.25rem)] font-extrabold uppercase tracking-[0.05em] text-[#6b2f03]">
            {section.title}
          </h3>
          {section.paragraphs?.map((paragraph) => (
            <p className="text-[clamp(0.9rem,1vw,1.03rem)] leading-[1.55] text-[#6b2f03]" key={paragraph}>
              {paragraph}
            </p>
          ))}
          {section.bullets ? (
            <ul className="list-disc space-y-2 pl-5 text-[clamp(0.9rem,1vw,1.03rem)] leading-[1.5] text-[#6b2f03]">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </section>
      )),
    []
  );

  if (!isOpen) return null;

  const modalContent: ReactNode = (
    <>
      <img
        alt=""
        aria-hidden="true"
        className="absolute object-contain"
        src={GUIDEBOOK_UI.frame}
        style={guidebookStyle(346, 151, 1228.3, 701)}
      />

      <div
        className={`absolute overflow-y-auto pr-[1.2%] ${guidebookFont.className}`}
        style={guidebookStyle(434, 264, 1052, 510)}
      >
        <div className="space-y-5">
          <p className="text-[clamp(0.92rem,1.02vw,1.08rem)] leading-[1.6] text-[#6b2f03]">
            {guidebookContent.intro}
          </p>
          {contentBlocks}
        </div>
      </div>

      <button
        className="absolute z-10 transition-transform hover:scale-[1.03] active:scale-[0.98]"
        onClick={onClose}
        style={guidebookStyle(1299, 871, 279, 133.79)}
        type="button"
      >
        <img alt="Đóng hướng dẫn" className="h-full w-full object-contain" src={GUIDEBOOK_UI.close} />
      </button>
    </>
  );

  return (
    <div
      className="absolute inset-0 z-40 bg-black/80 backdrop-blur-[1.5px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-label="Hướng dẫn chơi game"
        aria-modal="true"
        className="absolute inset-0"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        {useFixedScene ? (
          <FixedAspectScene className="absolute inset-0">{modalContent}</FixedAspectScene>
        ) : (
          modalContent
        )}
      </div>
    </div>
  );
};
