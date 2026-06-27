import { NextResponse } from 'next/server';

type ChapterData = { title: string; text: string };

// Dynamic import map — each request loads only the needed chapter.
// These run server-side only; the large strings never enter the client bundle.
const loaders: Record<number, () => Promise<Record<string, ChapterData>>> = {
  1: () => import('@/lib/stories/chapter-1'),
  2: () => import('@/lib/stories/chapter-2'),
  3: () => import('@/lib/stories/chapter-3'),
  4: () => import('@/lib/stories/chapter-4'),
  5: () => import('@/lib/stories/chapter-5'),
  6: () => import('@/lib/stories/chapter-6'),
  7: () => import('@/lib/stories/chapter-7'),
  8: () => import('@/lib/stories/chapter-8'),
  9: () => import('@/lib/stories/chapter-9'),
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10);

  if (isNaN(id) || !(id in loaders)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const mod = await loaders[id]();
  const data: ChapterData | undefined = mod[`chapter${id}`];

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
