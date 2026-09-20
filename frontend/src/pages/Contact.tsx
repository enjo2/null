import { useState } from "react";

export function Contact() {
  const [type, setType] = useState("support");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-2xl py-12">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Contact</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Got a bug, a feature request, or a question about your privacy? We read everything —
        and we never keep your email beyond answering it.
      </p>

      {sent ? (
        <div className="card mt-8 border-green-200 p-6 dark:border-green-900">
          <h2 className="font-semibold text-green-800 dark:text-green-300">Message sent — and that's it.</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            We won't add you to a list, we won't track the link you opened, and we'll reply from a
            human. No form analytics, no marketing pixels.
          </p>
          <button onClick={() => setSent(false)} className="btn btn-ghost mt-4">
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Message type">
            {["support", "bug", "feature", "privacy"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors " +
                  (type === t
                    ? "bg-brand text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300")
                }
              >
                {t}
              </button>
            ))}
          </div>

          {type === "bug" && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Tip: include the engine, the query, and what you expected. Aggregate counters help us
              reproduce, and we never ask for logs tied to your identity.
            </p>
          )}

          <div>
            <label htmlFor="message" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Message
            </label>
            <textarea
              id="message"
              required
              rows={5}
              className="input"
              placeholder="Describe the issue or idea…"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Email (optional — for a reply)
            </label>
            <input id="email" type="email" className="input" placeholder="you@example.org" />
          </div>

          <button type="submit" className="btn btn-primary">Send message</button>
        </form>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["Issues", "Report bugs on the tracker."],
          ["Security", "Report vulnerabilities privately."],
          ["Self-host", "Docs for running your own instance."],
        ].map(([title, body]) => (
          <div key={title} className="card p-4 text-center">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}