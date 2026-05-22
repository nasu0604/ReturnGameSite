const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

export function getKoreanDatabaseDate(now = new Date()) {
  return new Date(now.getTime() + KOREA_OFFSET_MS);
}

export function serializeKoreanDatabaseDate(date?: Date | null) {
  if (!date) return undefined;

  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}+09:00`
  ].join("");
}
