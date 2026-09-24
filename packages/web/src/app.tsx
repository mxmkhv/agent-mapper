import { supportedTools } from "@agent-mapper/core";

export function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-4xl flex-col px-6 py-10 sm:px-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <span className="text-lg font-semibold tracking-tight">
          agent-mapper
        </span>
        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">
          Local · Read-only
        </span>
      </header>
      <section className="my-auto py-20">
        <p className="mb-4 text-sm font-medium text-[var(--accent)]">
          Your agent configuration, in one place
        </p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
          A clearer view of your setup.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-[var(--muted)]">
          The workspace is ready. Project discovery and configuration inventory
          are the next step. No folders have been scanned.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {supportedTools.map((tool) => (
            <article
              key={tool}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-6"
            >
              <h2 className="font-medium">{tool}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Configuration inventory coming next
              </p>
            </article>
          ))}
        </div>
      </section>
      <footer className="text-xs text-[var(--muted)]">
        Development scaffold · Files stay on your machine
      </footer>
    </main>
  );
}
