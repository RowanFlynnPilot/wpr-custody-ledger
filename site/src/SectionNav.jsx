import React from "react";

// Five places a reader is likely to want, not a full table of contents. Each id is on a <section>.
const JUMPS = [
  ["home", "Near Wausau"],
  ["counties", "Your county"],
  ["facilities", "Find a facility"],
  ["women", "The long view"],
  ["method", "Get the data"],
];

// Scroll to a section. Inside an article the page sits in a frame sized to its full height, so
// the frame itself never scrolls: ask the embedding page to do it (public/embed.txt has the
// listener). Standing alone, scroll here.
export function goTo(id) {
  const target = document.getElementById(id);
  if (!target) return;
  if (window.parent !== window) {
    window.parent.postMessage(
      { source: "wpr-custody-ledger", scrollTo: Math.round(target.getBoundingClientRect().top + window.scrollY) },
      "*"
    );
  }
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  target.focus({ preventScroll: true });
}

const jump = (id) => (e) => { e.preventDefault(); goTo(id); };

// First thing in the page for keyboard and screen-reader users; shown only when it has focus.
export function SkipLink() {
  return <a className="skip-link" href="#facilities" onClick={jump("facilities")}>Skip to the facility list</a>;
}

export default function SectionNav() {
  return (
    <nav className="section-nav" aria-label="On this page">
      <ul>
        {JUMPS.map(([id, label]) => (
          <li key={id}><a href={`#${id}`} onClick={jump(id)}>{label}</a></li>
        ))}
      </ul>
    </nav>
  );
}
