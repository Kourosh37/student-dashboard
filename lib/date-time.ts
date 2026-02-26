const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(dateKey: string) {
  if (!DATE_KEY_REGEX.test(dateKey)) return null;

  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function combineDateAndTimeToIso(dateKey: string, timeKey: string | null | undefined) {
  const date = parseDateKey(dateKey);
  if (!date) return null;

  let hours = 0;
  let minutes = 0;

  if (timeKey && TIME_KEY_REGEX.test(timeKey)) {
    const [hoursRaw, minutesRaw] = timeKey.split(":");
    hours = Number(hoursRaw);
    minutes = Number(minutesRaw);
  }

  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0));
  return utcDate.toISOString();
}

export function splitIsoToDateAndTime(value: string | null | undefined) {
  if (!value) {
    return { date: "", time: "" };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "", time: "" };
  }

  return {
    date: toDateKey(parsed),
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}
