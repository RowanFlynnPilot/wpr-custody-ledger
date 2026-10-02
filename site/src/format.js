// Numbers and dates the way the newsroom writes them.

export const num = (n) => (n == null ? "—" : n.toLocaleString("en-US"));
export const signed = (n) => (n > 0 ? `+${num(n)}` : n < 0 ? `−${num(-n)}` : "no change");
export const pct = (population, capacity) => (100 * population) / capacity;
export const pct1 = (x) => `${x.toFixed(1)}%`;

const AP_MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

// Report dates are calendar dates, not instants: parse the parts so no time zone can shift them.
const parts = (iso) => iso.split("-").map(Number);

export const apDate = (iso) => {
  const [y, m, d] = parts(iso);
  return `${AP_MONTHS[m - 1]} ${d}, ${y}`;
};
export const apMonthYear = (iso) => {
  const [y, m] = parts(iso);
  return `${AP_MONTHS[m - 1]} ${y}`;
};
// In a sentence, a month with only a year is spelled out (AP). apMonthYear's abbreviations are
// for chart labels and table cells, where the space is tight.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthYear = (iso) => {
  const [y, m] = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
};
export const yearOf = (iso) => parts(iso)[0];
export const time = (iso) => {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
};

const ORDINALS = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"];
// First through ninth as words (AP); from 10th, the figure with its proper ending.
export const ordinal = (n) => {
  if (ORDINALS[n]) return ORDINALS[n];
  const ending = n % 100 >= 11 && n % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return `${n}${ending}`;
};

export const TYPE_LABEL = {
  institution: "Prison",
  center: "Correctional center",
  secure: "Secure detention",
  treatment: "Treatment center",
  county_jail: "County jail",
  out_of_state: "Out of state",
  federal: "Federal prison",
  other: "Other contract beds",
  juvenile: "Juvenile facility",
};
