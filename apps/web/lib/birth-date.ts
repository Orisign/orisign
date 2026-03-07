type LongLike = {
  low: number;
  high: number;
  unsigned?: boolean;
};

export type BirthDateInput = number | string | LongLike | undefined;
type YearsWords = {
  one?: string;
  few?: string;
  many?: string;
  other: string;
};

const toMillis = (value: BirthDateInput) => {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (
    value &&
    typeof value === "object" &&
    typeof value.low === "number" &&
    typeof value.high === "number"
  ) {
    const low = BigInt(value.low >>> 0);
    const high = BigInt(value.high >>> 0);
    let result = (high << 32n) | low;

    if (!value.unsigned && (value.high & 0x80000000) !== 0) {
      result -= 1n << 64n;
    }

    const num = Number(result);
    return Number.isFinite(num) ? num : undefined;
  }

  return undefined;
};

const getYearsWord = (
  years: number,
  locale: string,
  words: YearsWords,
) => {
  const category = new Intl.PluralRules(locale).select(years);
  if (category === "one") return words.one ?? words.other;
  if (category === "few") return words.few ?? words.other;
  if (category === "many") return words.many ?? words.other;
  return words.other;
};

const getAge = (birthDate: Date) => {
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    years -= 1;
  }

  return years;
};

export const formatBirthDateWithAge = (
  value: BirthDateInput,
  locale: string,
  words: YearsWords,
) => {
  const birthDateMs = toMillis(value);
  if (!birthDateMs) return "";

  const birthDate = new Date(birthDateMs);
  if (Number.isNaN(birthDate.getTime())) return "";

  const age = getAge(birthDate);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(birthDate);

  return `${dateLabel} (${age} ${getYearsWord(age, locale, words)})`;
};
