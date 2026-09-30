export default function Card({ title, subtitle, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-card p-4 sm:p-5 ${className}`}>
      {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className={title || subtitle ? "mt-4" : ""}>{children}</div>
    </section>
  );
}
