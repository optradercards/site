const DATE_FMT = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Australia/Sydney",
});

const TIME_FMT = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
});

const DAY_KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Australia/Sydney",
});

export function formatEventDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = DAY_KEY_FMT.format(start) === DAY_KEY_FMT.format(end);
  if (sameDay) {
    return `${DATE_FMT.format(start)} · ${TIME_FMT.format(start)} – ${TIME_FMT.format(end)}`;
  }
  return `${DATE_FMT.format(start)} – ${DATE_FMT.format(end)}`;
}
