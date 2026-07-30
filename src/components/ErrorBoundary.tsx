"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { failed: false };

  public static getDerivedStateFromError(): State {
    return { failed: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV === "development") {
      console.error("Unexpected interface failure", error, info);
    }
  }

  public render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="fatal-error" role="alert">
          <div>
            <p className="eyebrow">JSON2Model</p>
            <h1>The converter could not continue.</h1>
            <p>
              Your JSON was not uploaded or saved. Refresh the page to start a
              new local session.
            </p>
            <button type="button" onClick={() => window.location.reload()}>
              Refresh JSON2Model
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
