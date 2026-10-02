import React from "react";

// Five places a reader is likely to want, not a full table of contents. Each id is on a <section>.
const JUMPS = [
  ["home", "Near Wausau"],
  ["counties", "Your county"],
  ["facilities", "Find a facility"],
  ["women", "The long view"],
  ["method", "Get the data"],
];

// Bring an element to the top of the view. Inside an article the page sits in a frame sized to
// its full height, so the frame itself never scrolls: ask the embedding page to do it
// (public/embed.txt has the listener). Standing alone, scroll here.
export function scrollToElement(target) {
  if (!target) return;
  if (window.parent !== window) {
    window.parent.postMessage(
      { source: "wpr-custody-ledger", scrollTo: Math.round(target.getBoundingClientRect().top + window.scrollY) },
      "*"
    );
  }
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
}

export function goTo(id) {
  const target = document.getElementById(id);
  scrollToElement(target);
  target?.focus({ preventScroll: true });
}

export const jump = (id) => (e) => {
  e.preventDefault();
  goTo(id);
  // Keep the address in step, so copying it after a jump gives a link that lands here.
  window.history.replaceState(null, "", id === "top" ? window.location.pathname + window.location.search : `#${id}`);
};

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
