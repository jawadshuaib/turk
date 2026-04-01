import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Page not found
        </h1>
        <p className="text-slate-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="btn-primary">
            Go to Dashboard
          </Link>
          <Link
            href="/projects"
            className="btn-secondary"
          >
            View Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
