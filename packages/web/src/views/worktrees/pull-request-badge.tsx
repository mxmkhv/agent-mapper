import type { PullRequestSummary } from "@agent-mapper/core";
import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft
} from "lucide-react";

const looks = {
  open: { icon: GitPullRequest, label: "Open", tone: "text-ink" },
  draft: { icon: GitPullRequestDraft, label: "Draft", tone: "text-ink-muted" },
  merged: { icon: GitMerge, label: "Merged", tone: "text-ink-muted" },
  closed: {
    icon: GitPullRequestClosed,
    label: "Closed",
    tone: "text-ink-faint"
  }
} satisfies Record<PullRequestSummary["state"], object>;

/** The branch's pull request; opens it on GitHub. Monochrome: open reads strongest, closed faintest. */
export function PullRequestBadge({ pr }: { pr: PullRequestSummary }) {
  const look = looks[pr.state];
  const Icon = look.icon;
  return (
    <a
      className={`inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-caption font-medium whitespace-nowrap hover:bg-wash hover:text-ink ${look.tone}`}
      href={pr.url}
      rel="noreferrer"
      target="_blank"
      title={`#${pr.number} ${pr.title} · ${look.label}. Opens on GitHub.`}
    >
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
      <span className="tabular-nums">#{pr.number}</span>
      {look.label}
    </a>
  );
}
