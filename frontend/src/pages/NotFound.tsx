import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-6xl font-bold text-brand">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-neutral-900 dark:text-white">
        This page isn't indexed.
      </h1>
      <p className="mt-2 max-w-sm text-neutral-600 dark:text-neutral-400">
        Like most pages, we're not tracking it. Head back to search or pick a real destination.
      </p>
      <Link to="/" className="btn btn-primary mt-6">
        Search null
      </Link>
    </div>
  );
}