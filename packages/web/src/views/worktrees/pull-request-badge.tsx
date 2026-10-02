import type { PullRequestSummary } from "@agent-mapper/core";

const looks = {
  open: { label: "Open", tone: "border-ink text-ink" },
  draft: {
    label: "Draft",
    tone: "border-dotted border-ink-muted text-ink-muted"
  },
  merged: {
    label: "Merged",
    tone: "border-dotted border-ink-muted text-ink-muted"
  },
  closed: {
    label: "Closed",
    tone: "border-dotted border-ink-muted text-ink-faint"
  }
} satisfies Record<PullRequestSummary["state"], object>;

/** The branch's pull request; opens it on GitHub. The state is the text: open has a solid outline, the rest are dotted. */
export function PullRequestBadge({ pr }: { pr: PullRequestSummary }) {
  const look = looks[pr.state];
  return (
    <a
      className={`inline-flex h-[18px] items-center gap-1.5 border px-1.5 font-mono text-mono whitespace-nowrap hover:bg-ink hover:text-canvas ${look.tone}`}
      href={pr.url}
      rel="noreferrer"
      target="_blank"
      title={`#${pr.number} ${pr.title} · ${look.label}. Opens on GitHub.`}
    >
      #{pr.number} {look.label}
    </a>
  );
}
