type LongLike = {
  low: number;
  high: number;
  unsigned?: boolean;
};

export type BirthDateInput = number | string | LongLike | undefined;

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

const getYearsWordRu = (years: number) => {
  const mod10 = years % 10;
  const mod100 = years % 100;

  if (mod10 === 1 && mod100 !== 11) return "год";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "года";

  return "лет";
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

export const formatBirthDateRuWithAge = (value: BirthDateInput) => {
  const birthDateMs = toMillis(value);
  if (!birthDateMs) return "";

  const birthDate = new Date(birthDateMs);
  if (Number.isNaN(birthDate.getTime())) return "";

  const age = getAge(birthDate);
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(birthDate);

  return `${dateLabel} (${age} ${getYearsWordRu(age)})`;
};
