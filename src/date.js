export function localDateString(date = new Date(), timeZoneId) {
  if (timeZoneId === undefined) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: validateTimeZoneId(timeZoneId),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function resolvedTimeZone() {
  const timeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (typeof timeZoneId !== "string" || timeZoneId.trim() === "") {
    throw new Error("Unable to resolve an IANA time zone from this system.");
  }
  return validateTimeZoneId(timeZoneId);
}

export function validateTimeZoneId(value) {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > 64) {
    throw new Error("timeZoneId must be a trimmed IANA zone of 1-64 characters.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error(`Unsupported IANA time zone: ${value}`);
  }
  return value;
}

export function validateDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error("Date must use YYYY-MM-DD format.");
  }
  return value;
}
