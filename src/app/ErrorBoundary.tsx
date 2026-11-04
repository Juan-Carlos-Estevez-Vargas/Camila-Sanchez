import { Component, type ErrorInfo, type ReactNode } from "react";
import { EmptyState } from "@/ui/Feedback";
import { msg } from "@/i18n";

/** Evita que un error en una sección deje toda la página en blanco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ui] error no controlado", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert">
          <EmptyState icon="🥀" title={msg().common.errorBoundary}>
            <button className="btn btn--soft" onClick={() => window.location.reload()}>{msg().common.reload}</button>
          </EmptyState>
        </div>
      );
    }
    return this.props.children;
  }
}
