const COLORS: Record<string, string> = {
  stopped: "bg-slate-100 text-slate-500",
  starting: "bg-amber-50 text-amber-600",
  running: "bg-emerald-50 text-emerald-600",
  paused: "bg-blue-50 text-blue-600",
  error: "bg-red-50 text-red-600",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${COLORS[status] || COLORS.stopped}`}
    >
      {status}
    </span>
  );
}
