/**
 * International phone input — Discovery Call spec §2:
 * "Use one international phone control: editable country selector (country +
 * calling code) plus local-number input... Accept normal human input, local
 * trunk prefixes and pasted international numbers... Normalize/store the
 * authoritative valid value in E.164."
 *
 * Built on libphonenumber-js rather than a hand-rolled regex: trunk-prefix
 * stripping, calling-code parsing and E.164 formatting are exactly what it
 * exists to get right across ~250 countries.
 */
import { useMemo, useState } from "react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** A short, common-first list keeps the dropdown usable; "Other" via search
 * isn't needed since every ISO country is still selectable — this only
 * orders the list so covering the common cases doesn't require scrolling. */
const COMMON_FIRST: CountryCode[] = ["NL", "BE", "DE", "GB", "US", "FR", "ES", "IT"];

function countryList(): CountryCode[] {
  const all = getCountries();
  const common = COMMON_FIRST.filter((c) => all.includes(c));
  const rest = all.filter((c) => !COMMON_FIRST.includes(c)).sort();
  return [...common, ...rest];
}

function guessDefaultCountry(): CountryCode {
  try {
    const locale = navigator.language || "en-NL";
    const region = locale.split("-")[1]?.toUpperCase();
    if (region && getCountries().includes(region as CountryCode)) {
      return region as CountryCode;
    }
  } catch {
    /* navigator unavailable (SSR/tests) — fall through to the default */
  }
  return "NL";
}

export interface PhoneFieldValue {
  /** Raw local-number text as typed, so a validation failure never loses input. */
  national: string;
  country: CountryCode;
}

export function usePhoneField(initial?: Partial<PhoneFieldValue>) {
  const [value, setValue] = useState<PhoneFieldValue>({
    national: initial?.national ?? "",
    country: initial?.country ?? guessDefaultCountry(),
  });

  const parsed = useMemo(() => {
    const raw = value.national.trim();
    if (!raw) return { e164: null, valid: false };
    try {
      // A pasted number that already carries its own "+countrycode" is
      // parsed on its own terms; libphonenumber-js does this automatically
      // when the text starts with "+", regardless of the selected country,
      // which is what stops "+31 6 12345678" from becoming "+31+31612345678".
      const phone = raw.startsWith("+")
        ? parsePhoneNumberFromString(raw)
        : parsePhoneNumberFromString(raw, value.country);
      if (phone?.isValid()) {
        return { e164: phone.number, valid: true };
      }
      return { e164: null, valid: false };
    } catch {
      return { e164: null, valid: false };
    }
  }, [value.national, value.country]);

  return { value, setValue, ...parsed };
}

export function PhoneField({
  value,
  onChange,
  invalid,
  id,
}: {
  value: PhoneFieldValue;
  onChange: (v: PhoneFieldValue) => void;
  invalid?: boolean;
  id?: string;
}) {
  const countries = useMemo(() => countryList(), []);

  return (
    <div className="flex gap-2">
      <Select
        value={value.country}
        onValueChange={(c) => onChange({ ...value, country: c as CountryCode })}
      >
        <SelectTrigger
          className={`io-control-surface w-[92px] shrink-0 ${invalid ? "border-rose-400/60" : ""}`}
          aria-label="Country code"
        >
          <SelectValue>+{getCountryCallingCode(value.country)}</SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {countries.map((c) => (
            <SelectItem key={c} value={c}>
              {c} +{getCountryCallingCode(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={value.national}
        onChange={(e) => {
          const typed = e.target.value;
          // Detect (and honour) a pasted/typed "+countrycode" prefix by
          // switching the selected country to match, rather than doubling it
          // with the already-selected code — see the parsing note above.
          if (typed.startsWith("+")) {
            const asYouType = new AsYouType();
            asYouType.input(typed);
            const country = asYouType.getCountry();
            if (country) {
              onChange({ national: typed, country });
              return;
            }
          }
          onChange({ ...value, national: typed });
        }}
        placeholder="6 12345678"
        className={`io-control-surface flex-1 min-w-0 h-11 px-3.5 rounded-md text-[14px] outline-none placeholder:opacity-40 ${
          invalid ? "border-rose-400/60" : ""
        }`}
      />
    </div>
  );
}
