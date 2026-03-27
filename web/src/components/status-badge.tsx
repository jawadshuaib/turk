const COLORS: Record<string, string> = {
  stopped: "bg-gray-700 text-gray-300",
  starting: "bg-yellow-900 text-yellow-300",
  running: "bg-green-900 text-green-300",
  paused: "bg-blue-900 text-blue-300",
  error: "bg-red-900 text-red-300",
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
