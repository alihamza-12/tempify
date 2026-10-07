import type { LucideIcon } from "lucide-react";

export function SectionCard({
  icon: Icon,
  title,
  accent = "orange",
  children,
}: {
  icon: LucideIcon;
  title: string;
  accent?: "orange" | "purple" | "emerald";
  children: React.ReactNode;
}) {
  const colors = {
    orange: "bg-orange-500/15 text-orange-400",
    purple: "bg-purple-500/15 text-purple-400",
    emerald: "bg-emerald-500/15 text-emerald-400",
  };
  return (
    <section className="panel rounded-[22px] p-5 sm:p-7">
      <div className="mb-6 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[accent]}`}><Icon size={19} /></div>
        <h2 className="text-lg font-extrabold sm:text-xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}
