export function ContentPage({ title, intro, sections }: { title: string; intro: string; sections: { title: string; body: string }[] }) {
  return (
    <div className="min-h-[calc(100vh-145px)] bg-[#f5f6f8] py-12 text-[#111827]">
      <article className="mx-auto w-[min(760px,calc(100%-24px))] rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.18em] text-orange-600">Tempify</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">{title}</h1>
        <p className="mt-4 leading-7 text-slate-600">{intro}</p>
        <div className="mt-9 space-y-8">{sections.map((section) => <section key={section.title}><h2 className="text-xl font-extrabold">{section.title}</h2><p className="mt-3 whitespace-pre-line leading-7 text-slate-600">{section.body}</p></section>)}</div>
        <p className="mt-10 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">This starter copy must be reviewed and approved by the business’s qualified legal and compliance advisers before production launch.</p>
      </article>
    </div>
  );
}
