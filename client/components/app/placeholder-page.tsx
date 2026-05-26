type PlaceholderPageProps = {
  title: string;
  description: string;
};

export const PlaceholderPage = ({ title, description }: PlaceholderPageProps) => {
  return (
    <section className="lobby-placeholder flex min-h-[calc(100vh-14rem)] items-center justify-center rounded-2xl px-4 py-12 text-center sm:px-8">
      <div className="max-w-2xl">
        <p className="moba-heading text-xs uppercase tracking-[0.28em] text-cyan-300/90">Cuoc Dua 12 Con Giap</p>
        <h1 className="moba-heading mt-3 text-3xl uppercase tracking-[0.12em] text-amber-100 sm:text-4xl">{title}</h1>
        <p className="mt-5 text-sm text-slate-300 sm:text-base">{description}</p>
      </div>
    </section>
  );
};
