'use client';

import { useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Be_Vietnam_Pro } from 'next/font/google';


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

const guidebookContent = {
  intro:
    'ChÃ o má»«ng báº¡n Ä‘áº¿n vá»›i Äáº¡i Há»™i Láº­p PhÃ¡p cá»§a Ngá»c HoÃ ng. ÄÃ¢y lÃ  má»™t tá»±a game cá» chiáº¿n thuáº­t phá»‘i há»£p Ä‘á»“ng Ä‘á»™i (Co-op 2v2) Ä‘áº­m cháº¥t dÃ¢n gian, nÆ¡i báº¡n vÃ  Ä‘á»“ng Ä‘á»™i pháº£i chÆ¡i nhÆ° "tuy hai mÃ  má»™t".',
  sections: [
    {
      title: '1. Má»¥c TiÃªu Tá»‘i ThÆ°á»£ng: Cáº¯m Cá» Äoáº¡t Vá»‹',
      paragraphs: [
        'Game chia lÃ m 2 Ä‘á»™i, má»—i Ä‘á»™i gá»“m 2 ngÆ°á»i chÆ¡i, Ä‘á»‘i Ä‘áº§u trÃªn báº£n Ä‘á»“ kÃ­ch thÆ°á»›c 7 x 9.',
        'Äiá»u kiá»‡n tháº¯ng lÃ  Ä‘á»™i báº¡n pháº£i phá»‘i há»£p chiáº¿m Ä‘á»§ 10 Ã´ Long Máº¡ch (Ã´ active) cá»§a Ä‘á»™i mÃ¬nh trÆ°á»›c Ä‘á»ƒ giÃ nh chiáº¿n tháº¯ng ngay láº­p tá»©c.',
        'Báº¡n chá»‰ cÃ³ thá»ƒ chiáº¿m Ã´ Long Máº¡ch cÃ³ hÃ¬nh con giÃ¡p cá»§a chÃ­nh mÃ¬nh báº±ng cÃ¡ch di chuyá»ƒn Ä‘á»©ng vÃ o Ã´ Ä‘Ã³.'
      ]
    },
    {
      title: '2. Khá»Ÿi Äáº§u Tráº­n Äáº¥u',
      paragraphs: [
        'á»ž lÆ°á»£t Ä‘áº§u tiÃªn, Báº¡n Ä‘Æ°á»£c quyá»n tá»± chá»n 1 Ã´ RÃºt BÃ i mÃ u vÃ ng Ä‘ang trá»‘ng trÃªn báº£n Ä‘á»“ lÃ m Ä‘iá»ƒm xuáº¥t phÃ¡t.',
        'LÆ°u Ã½: lÆ°á»£t xuáº¥t phÃ¡t nÃ y sáº½ khÃ´ng Ä‘Æ°á»£c rÃºt bÃ i bá»• trá»£.'
      ]
    },
    {
      title: '3. VÃ²ng Láº·p 5 BÆ°á»›c Trong Má»™t LÆ°á»£t ChÆ¡i',
      bullets: [
        'Pha 0 - RÃºt bÃ i báº¯t buá»™c: há»‡ thá»‘ng tá»± Ä‘á»™ng rÃºt cho báº¡n 1 lÃ¡ bÃ i bá»• trá»£ vÃ  cÃ´ng khai lÃ¡ bÃ i Ä‘Ã³ trong 3 giÃ¢y trÆ°á»›c khi Ä‘Æ°a vÃ o tay.',
        'Pha 1 - Äá»• xÃºc xáº¯c: há»‡ thá»‘ng tá»± roll ngáº«u nhiÃªn tá»« 1 Ä‘áº¿n 6 bÆ°á»›c.',
        'Pha 2 - DÃ¹ng bÃ i trÆ°á»›c khi di: báº¡n cÃ³ tá»‘i Ä‘a 60 giÃ¢y Ä‘á»ƒ kÃ­ch hoáº¡t cÃ¡c lÃ¡ bÃ i phÃ©p trÃªn tay. Má»—i láº§n dÃ¹ng 1 lÃ¡ Ä‘Æ°á»£c cá»™ng thÃªm 10 giÃ¢y nhÆ°ng tá»•ng thá»i gian khÃ´ng quÃ¡ 60 giÃ¢y.',
        'Pha 3 - Di chuyá»ƒn: dÃ¹ng cÃ¡c nÃºt mÅ©i tÃªn Ä‘á»ƒ di Ä‘Ãºng sá»‘ bÆ°á»›c mÃ  xÃºc xáº¯c vá»«a Ä‘á»• ra.',
        'Pha 4 - DÃ¹ng bÃ i sau khi di: tÆ°Æ¡ng tá»± pha 2, báº¡n cÃ³ thÃªm má»™t cÆ¡ há»™i dÃ¹ng bÃ i trÆ°á»›c khi káº¿t thÃºc lÆ°á»£t.'
      ]
    },
    {
      title: '4. "Sá»£i DÃ¢y TÃ¬nh Báº¡n" vÃ  Luáº­t Di Chuyá»ƒn',
      paragraphs: [
        'Äá»ƒ game khÃ´ng biáº¿n thÃ nh mÃ n "thÃ¢n ai náº¥y lo", Ngá»c HoÃ ng Ä‘áº·t ra quy Ä‘á»‹nh giá»›i háº¡n khoáº£ng cÃ¡ch giá»¯a hai ngÆ°á»i cÃ¹ng Ä‘á»™i.',
        'Ban Ä‘áº§u, sá»£i dÃ¢y liÃªn káº¿t cho phÃ©p hai Ä‘á»“ng Ä‘á»™i cÃ¡ch nhau tá»‘i Ä‘a 7 Ã´. Cá»© má»—i khi Ä‘á»™i báº¡n chiáº¿m thÃªm Ä‘Æ°á»£c 2 Ã´ Long Máº¡ch, giá»›i háº¡n nÃ y láº¡i co ngáº¯n thÃªm 1 Ã´.'
      ],
      bullets: [
        '- KhÃ´ng Ä‘Æ°á»£c Ä‘i ra ngoÃ i rÃ¬a báº£n Ä‘á»“.',
        '- KhÃ´ng Ä‘Æ°á»£c Ä‘i lÃ¹i ngay vá» Ã´ mÃ¬nh vá»«a bÆ°á»›c ra á»Ÿ bÆ°á»›c trÆ°á»›c.',
        '- KhÃ´ng Ä‘Æ°á»£c dáº«m vÃ o Ã´ Ä‘Ã£ bá»‹ ngÆ°á»i khÃ¡c chiáº¿m.',
        '- KhÃ´ng Ä‘Æ°á»£c Ä‘á»©ng trÃ¹ng vÃ o Ã´ Ä‘ang cÃ³ ngÆ°á»i chÆ¡i khÃ¡c Ä‘á»©ng.',
        '- KhÃ´ng Ä‘Æ°á»£c Ä‘i vÃ o vá»‹ trÃ­ khiáº¿n khoáº£ng cÃ¡ch vá»›i Ä‘á»“ng Ä‘á»™i vÆ°á»£t quÃ¡ giá»›i háº¡n sá»£i dÃ¢y.'
      ]
    },
    {
      title: '5. HÃ¬nh Pháº¡t Khi "Bá»‹ Káº¹t" vÃ  ÄÃ³ng BÄƒng',
      bullets: [
        '- Káº¹t giá»¯a Ä‘Æ°á»ng (Lock): náº¿u Ä‘ang Ä‘i ná»­a chá»«ng mÃ  háº¿t Ä‘Æ°á»ng há»£p lá»‡, báº¡n sáº½ máº¥t lÆ°á»£t ngay láº­p tá»©c vÃ  bá»‹ Ä‘Ã³ng bÄƒng á»Ÿ lÆ°á»£t tiáº¿p theo.',
        '- Bá»‹ káº¹t hoÃ n toÃ n (Stuck): há»‡ thá»‘ng sáº½ cá»©u báº¡n vá» má»™t Ã´ trá»‘ng ngáº«u nhiÃªn, nhÆ°ng Ä‘á»™i báº¡n cÃ³ thá»ƒ bá»‹ máº¥t tá»‘i Ä‘a 2 Ã´ Long Máº¡ch Ä‘Ã£ chiáº¿m. Äá»•i láº¡i, sá»£i dÃ¢y liÃªn káº¿t Ä‘Æ°á»£c ná»›i thÃªm 1 Ã´ Ä‘á»ƒ dá»… thá»Ÿ hÆ¡n.'
      ]
    },
    {
      title: '5. HÃ¬nh Pháº¡t Khi "Bá»‹ Káº¹t" vÃ  ÄÃ³ng BÄƒng',
      bullets: [
        '- Káº¹t giá»¯a Ä‘Æ°á»ng (Lock): náº¿u Ä‘ang Ä‘i ná»­a chá»«ng mÃ  háº¿t Ä‘Æ°á»ng há»£p lá»‡, báº¡n sáº½ máº¥t lÆ°á»£t ngay láº­p tá»©c vÃ  bá»‹ Ä‘Ã³ng bÄƒng á»Ÿ lÆ°á»£t tiáº¿p theo.',
        '- Bá»‹ káº¹t hoÃ n toÃ n (Stuck): há»‡ thá»‘ng sáº½ cá»©u báº¡n vá» má»™t Ã´ trá»‘ng ngáº«u nhiÃªn, nhÆ°ng Ä‘á»™i báº¡n cÃ³ thá»ƒ bá»‹ máº¥t tá»‘i Ä‘a 2 Ã´ Long Máº¡ch Ä‘Ã£ chiáº¿m. Äá»•i láº¡i, sá»£i dÃ¢y liÃªn káº¿t Ä‘Æ°á»£c ná»›i thÃªm 1 Ã´ Ä‘á»ƒ dá»… thá»Ÿ hÆ¡n.'
      ]
    },
    {
      title: 'Máº¹o Bá» TÃºi Cho Báº¡n GÃ¡nh Team',
      bullets: [
        '- Ghi nhá»› 3 giÃ¢y cÃ´ng khai bÃ i cá»§a Ä‘á»‘i thá»§ Ä‘á»ƒ Ä‘oÃ¡n Ä‘Æ°á»£c há» Ä‘ang cáº§m bÃ i gÃ¬.',
        '- Táº­n dá»¥ng cÃ¡c lÃ¡ bÃ i team-play nhÆ° Ä‘á»•i chá»— hoáº·c dá»‹ch chuyá»ƒn Ä‘á»“ng Ä‘á»™i Ä‘á»ƒ cá»©u nhau Ä‘Ãºng lÃºc.',
        '- CÃ ng chiáº¿m nhiá»u Ã´ thÃ¬ dÃ¢y cÃ ng ngáº¯n, nÃªn trÆ°á»›c nhá»¯ng bÆ°á»›c quyáº¿t Ä‘á»‹nh hÃ£y luÃ´n nhÃ¬n vá»‹ trÃ­ cá»§a Ä‘á»“ng Ä‘á»™i.'
      ]
    }
  ] satisfies GuideBookSection[]
} as const;

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
};

export const GuideBookModal = ({ isOpen, onClose }: GuideBookModalProps) => {
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
            <ul className="space-y-2 pl-5 text-[clamp(0.9rem,1vw,1.03rem)] leading-[1.5] text-[#6b2f03]">
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

  return (
    <div
      className="absolute inset-0 z-40 bg-black/80 backdrop-blur-[1.5px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-label="Guide book"
        aria-modal="true"
        className="absolute inset-0"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <img
            alt=""
            aria-hidden="true"
            className="absolute object-contain"
            src={GUIDEBOOK_UI.frame}
            style={guidebookStyle(346, 151, 1228.3, 701)}
          />
  
        <div
            className={`absolute overflow-y-auto pr-[1.2%] ${guidebookFont.className}`}
            style={{
              ...guidebookStyle(434, 264, 1052, 510)
            }}
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
            <img alt="ÄÃ³ng hÆ°á»›ng dáº«n" className="h-full w-full object-contain" src={GUIDEBOOK_UI.close} />
        </button>
      </div>
    </div>
  );
};
