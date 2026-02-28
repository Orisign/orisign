export type PhoneCountry = {
  code: string;
  name: string;
  dialCode: string;
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "RU", name: "Россия", dialCode: "7" },
  { code: "KZ", name: "Казахстан", dialCode: "7" },
  { code: "US", name: "США", dialCode: "1" },
  { code: "CA", name: "Канада", dialCode: "1" },
  { code: "NL", name: "Нидерланды", dialCode: "31" },
  { code: "DE", name: "Германия", dialCode: "49" },
  { code: "FR", name: "Франция", dialCode: "33" },
  { code: "ES", name: "Испания", dialCode: "34" },
  { code: "IT", name: "Италия", dialCode: "39" },
  { code: "GB", name: "Великобритания", dialCode: "44" },
  { code: "PL", name: "Польша", dialCode: "48" },
  { code: "UA", name: "Украина", dialCode: "380" },
  { code: "TR", name: "Турция", dialCode: "90" },
  { code: "AE", name: "ОАЭ", dialCode: "971" },
  { code: "SA", name: "Саудовская Аравия", dialCode: "966" },
  { code: "IN", name: "Индия", dialCode: "91" },
  { code: "CN", name: "Китай", dialCode: "86" },
  { code: "JP", name: "Япония", dialCode: "81" },
  { code: "KR", name: "Южная Корея", dialCode: "82" },
  { code: "BR", name: "Бразилия", dialCode: "55" },
  { code: "MX", name: "Мексика", dialCode: "52" },
  { code: "AR", name: "Аргентина", dialCode: "54" },
  { code: "AU", name: "Австралия", dialCode: "61" },
  { code: "NZ", name: "Новая Зеландия", dialCode: "64" },
  { code: "ZA", name: "ЮАР", dialCode: "27" },
];

const PHONE_COUNTRY_BY_CODE = new Map(
  PHONE_COUNTRIES.map((country) => [country.code, country]),
);

export function getCountryByCode(code: string): PhoneCountry | undefined {
  return PHONE_COUNTRY_BY_CODE.get(code);
}

export function toDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function detectCountryFromPhone(phone: string): PhoneCountry | undefined {
  const digits = toDigits(phone);

  return [...PHONE_COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => digits.startsWith(country.dialCode));
}

export function applyDialCode(phone: string, dialCode: string): string {
  const digits = toDigits(phone);
  const matchedCountry = detectCountryFromPhone(phone);

  if (!digits) {
    return `+${dialCode}`;
  }

  if (!matchedCountry) {
    return `+${dialCode}${digits}`;
  }

  const rest = digits.slice(matchedCountry.dialCode.length);
  return `+${dialCode}${rest}`;
}
