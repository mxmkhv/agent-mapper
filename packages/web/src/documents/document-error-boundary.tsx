import { Component, type ErrorInfo, type ReactNode } from "react";

interface BoundaryState {
  message?: string;
}

interface BoundaryProps {
  children: ReactNode;
  fallback(message: string): ReactNode;
}

/** Keeps an editor or renderer failure inside the document area; drafts in the store are unaffected. */
export class DocumentErrorBoundary extends Component<
  BoundaryProps,
  BoundaryState
> {
  override state: BoundaryState = {};

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    // Surface the full stack for debugging; the fallback shows the user what failed.
    console.error("Document view failed", error, info.componentStack);
  }

  override render() {
    return this.state.message === undefined
      ? this.props.children
      : this.props.fallback(this.state.message);
  }
}
