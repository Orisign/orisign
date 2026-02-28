"use client";

import * as React from "react";

import { cn } from "../../lib/utils";

import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Emoji, EmojiProvider } from "react-apple-emojis";
import emojiData from "react-apple-emojis/src/data.json";
type CountryCode = "RU" | "BY" | "KZ" | "KG" | "UZ";

type CountryConfig = {
  code: CountryCode;
  flag: React.ReactNode;
  label: string;
  dialCode: string;
  mask: string;
  nationalLength: number;
};

const COUNTRY_CONFIGS: CountryConfig[] = [
  {
    code: "RU",
    flag: <Emoji name="flag-russia" className="size-5" />,
    label: "Россия",
    dialCode: "+7",
    mask: "### ###-##-##",
    nationalLength: 10,
  },
  {
    code: "BY",
    flag: <Emoji name="flag-belarus" className="size-5" />,
    label: "Беларусь",
    dialCode: "+375",
    mask: "## ###-##-##",
    nationalLength: 9,
  },
  {
    code: "KZ",
    flag: <Emoji name="flag-kazakhstan" className="size-5" />,
    label: "Казахстан",
    dialCode: "+7",
    mask: "### ###-##-##",
    nationalLength: 10,
  },
  {
    code: "KG",
    flag: <Emoji name="flag-kyrgyzstan" className="size-5" />,
    label: "Кыргызстан",
    dialCode: "+996",
    mask: "### ##-##-##",
    nationalLength: 9,
  },
  {
    code: "UZ",
    flag: <Emoji name="flag-uzbekistan" className="size-5" />,
    label: "Узбекистан",
    dialCode: "+998",
    mask: "## ###-##-##",
    nationalLength: 9,
  },
];

const DEFAULT_COUNTRY: CountryCode = "RU";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function getCountryConfig(code: CountryCode) {
  return (
    COUNTRY_CONFIGS.find((item) => item.code === code) ?? COUNTRY_CONFIGS[0]
  );
}

function formatByMask(digits: string, mask: string) {
  let formatted = "";
  let digitIndex = 0;

  for (const char of mask) {
    if (char === "#") {
      if (digitIndex >= digits.length) break;
      formatted += digits[digitIndex];
      digitIndex += 1;
      continue;
    }

    if (digitIndex > 0 && digitIndex < digits.length + 1) {
      formatted += char;
    }
  }

  return formatted.trim();
}

function maskToPlaceholder(mask: string) {
  return mask.replace(/#/g, "•");
}

function resolveCountryFromDigits(value: string) {
  const sorted = [...COUNTRY_CONFIGS].sort(
    (a, b) => b.dialCode.length - a.dialCode.length,
  );

  for (const country of sorted) {
    const codeDigits = onlyDigits(country.dialCode);
    if (value.startsWith(codeDigits)) {
      return country;
    }
  }

  return null;
}

type NumberInputChangePayload = {
  country: CountryCode;
  national: string;
  international: string;
  formatted: string;
};

type NumberInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "value" | "defaultValue" | "onChange" | "type" | "placeholder"
> & {
  value?: string;
  defaultValue?: string;
  country?: CountryCode;
  defaultCountry?: CountryCode;
  onCountryChange?: (country: CountryCode) => void;
  onValueChange?: (value: string, payload: NumberInputChangePayload) => void;
  placeholder?: string;
  groupClassName?: string;
};

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      groupClassName,
      value,
      defaultValue,
      country,
      defaultCountry = DEFAULT_COUNTRY,
      onCountryChange,
      onValueChange,
      disabled,
      placeholder,
      ...props
    },
    ref,
  ) => {
    const isCountryControlled =
      country !== undefined && typeof onCountryChange === "function";
    const [internalCountry, setInternalCountry] =
      React.useState<CountryCode>(defaultCountry);
    const currentCountry = isCountryControlled ? country : internalCountry;

    const isValueControlled =
      value !== undefined && typeof onValueChange === "function";
    const [internalValue, setInternalValue] = React.useState(() =>
      onlyDigits(defaultValue ?? ""),
    );
    const countryConfig = getCountryConfig(currentCountry);
    const nationalDigits = isValueControlled
      ? (() => {
          const digits = onlyDigits(value);
          const dialDigits = onlyDigits(countryConfig.dialCode);
          return digits.startsWith(dialDigits)
            ? digits.slice(dialDigits.length)
            : digits;
        })()
      : internalValue;

    const maskedValue = formatByMask(nationalDigits, countryConfig.mask);
    const displayValue = `${countryConfig.dialCode} ${maskedValue}`.trimEnd();

    React.useEffect(() => {
      if (!isCountryControlled && country) {
        setInternalCountry(country);
      }
    }, [country, isCountryControlled]);

    React.useEffect(() => {
      if (!isValueControlled && value !== undefined) {
        setInternalValue(onlyDigits(value));
      }
    }, [value, isValueControlled]);

    const updateCountry = React.useCallback(
      (nextCountry: CountryCode) => {
        if (!isCountryControlled) {
          setInternalCountry(nextCountry);
        }
        onCountryChange?.(nextCountry);
      },
      [isCountryControlled, onCountryChange],
    );

    const emitChange = React.useCallback(
      (nextCountry: CountryCode, nextNationalDigits: string) => {
        const nextConfig = getCountryConfig(nextCountry);
        const clampedNational = nextNationalDigits.slice(
          0,
          nextConfig.nationalLength,
        );
        const formatted = formatByMask(clampedNational, nextConfig.mask);
        const international = `${nextConfig.dialCode}${clampedNational}`;

        if (!isValueControlled) {
          setInternalValue(clampedNational);
        }

        onValueChange?.(clampedNational, {
          country: nextCountry,
          national: clampedNational,
          international,
          formatted: formatted
            ? `${nextConfig.dialCode} ${formatted}`
            : nextConfig.dialCode,
        });
      },
      [isValueControlled, onValueChange],
    );

    const handleCountryChange = (nextCountry: CountryCode) => {
      const nextConfig = getCountryConfig(nextCountry);
      const clamped = nationalDigits.slice(0, nextConfig.nationalLength);

      updateCountry(nextCountry);
      emitChange(nextCountry, clamped);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      const typedDigits = onlyDigits(rawValue);
      const allowCountryAutoDetect =
        rawValue.trim().startsWith("+") || rawValue.trim().startsWith("00");
      const detectedCountry = allowCountryAutoDetect
        ? resolveCountryFromDigits(typedDigits)
        : null;

      let nextCountry = currentCountry;
      let nextDigits = typedDigits;

      if (detectedCountry) {
        const dialDigits = onlyDigits(detectedCountry.dialCode);
        const afterCode = typedDigits.slice(dialDigits.length);

        if (
          afterCode.length > 0 &&
          afterCode.length <= detectedCountry.nationalLength + 1
        ) {
          nextCountry = detectedCountry.code;
          nextDigits = afterCode;
        }
      }

      const nextConfig = getCountryConfig(nextCountry);
      const nextDialDigits = onlyDigits(nextConfig.dialCode);
      if (nextDigits.startsWith(nextDialDigits)) {
        nextDigits = nextDigits.slice(nextDialDigits.length);
      }
      nextDigits = nextDigits.slice(0, nextConfig.nationalLength);

      if (nextCountry !== currentCountry) {
        updateCountry(nextCountry);
      }

      emitChange(nextCountry, nextDigits);
    };

    return (
      <EmojiProvider data={emojiData}>
        <InputGroup
          className={cn(
            "h-11 rounded-xl border-2 border-border bg-secondary/80 px-3 text-foreground shadow-none transition-all duration-200 focus-within:border-primary/40 focus-within:bg-background",
            groupClassName,
          )}
        >
          <InputGroupAddon
            align="inline-start"
            className="mr-2 shrink-0 border-r border-border pr-2"
          >
            <Select
              value={currentCountry}
              onValueChange={(nextValue) =>
                handleCountryChange(nextValue as CountryCode)
              }
              disabled={disabled}
            >
              <SelectTrigger className="h-8 min-w-[128px] rounded-lg bg-transparent px-1 text-sm whitespace-nowrap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="center">
                {COUNTRY_CONFIGS.map((item) => (
                  <SelectItem
                    key={item.code}
                    value={item.code}
                    className="whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <span className="inline-flex size-5 items-center justify-center leading-none">
                        {item.flag}
                      </span>
                      <span className="text-muted-foreground">
                        {item.dialCode}
                      </span>
                      <span>{item.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InputGroupAddon>

          <InputGroupInput
            ref={ref}
            inputMode="tel"
            autoComplete="tel-national"
            disabled={disabled}
            value={displayValue}
            onChange={handleInputChange}
            placeholder={
              placeholder ??
              `${countryConfig.dialCode} ${maskToPlaceholder(countryConfig.mask)}`
            }
            className={cn("text-[15px]", className)}
            {...props}
          />
        </InputGroup>
      </EmojiProvider>
    );
  },
);

NumberInput.displayName = "NumberInput";

export { NumberInput, COUNTRY_CONFIGS };
export type { CountryCode, NumberInputProps, NumberInputChangePayload };
