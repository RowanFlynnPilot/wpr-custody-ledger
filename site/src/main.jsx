import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/900.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "./styles.css";
import App from "./App.jsx";

// A render error must never leave a blank frame inside a news article.
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error("Custody Ledger render error", error); }
  render() {
    return this.state.failed
      ? <div className="load-error">The Custody Ledger hit an error and could not display. Refresh the page to try again.</div>
      : this.props.children;
  }
}

createRoot(document.getElementById("root")).render(<ErrorBoundary><App /></ErrorBoundary>);

// iframe auto-height: report the content height to the embedding page whenever it changes
// (data load, opening a facility, switching a table). The matching listener for the
// WordPress side is in public/embed.txt. Only the height is sent, so "*" as target origin
// is fine; the parent verifies the origin instead.
if (window.parent !== window) {
  // Measure the rendered root, not the document: a document's scrollHeight can never be
  // smaller than the frame it sits in, so measuring it lets the frame grow but never shrink.
  const root = document.getElementById("root");
  const report = () =>
    window.parent.postMessage(
      { source: "wpr-custody-ledger", height: Math.ceil(root.getBoundingClientRect().height) },
      "*"
    );
  new ResizeObserver(report).observe(root);
  window.addEventListener("load", report);
  // For hosts that throttle rendering while the frame is off-screen: report again when
  // web fonts land and on a short schedule after load.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(report);
  for (const ms of [500, 1500, 3000, 6000]) setTimeout(report, ms);
}
