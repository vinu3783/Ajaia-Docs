export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#2563eb" />
        <path d="M10 7h8l6 6v12a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" fill="#fff" />
        <path d="M18 7v6h6" fill="#bfdbfe" />
        <path d="M12 17h8M12 20.5h8M12 24h5" stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {!compact && <span className="text-[17px] tracking-tight">Ajaia Docs</span>}
    </span>
  )
}
