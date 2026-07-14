import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  COUNTRY_DIAL_OPTIONS,
  type CountryDialOption,
  countryOptionKey,
  flagEmoji,
} from "@/lib/country-dial-options";
import styles from "./phone-country-field.module.scss";

type PhoneCountryFieldProps = {
  country: CountryDialOption;
  nationalNumber: string;
  onCountryChange: (country: CountryDialOption) => void;
  onNationalNumberChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  label?: string;
};

export function PhoneCountryField({
  country,
  nationalNumber,
  onCountryChange,
  onNationalNumberChange,
  disabled = false,
  error,
  label = "Phone (optional)",
}: PhoneCountryFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const listId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_DIAL_OPTIONS;
    return COUNTRY_DIAL_OPTIONS.filter((option) => option.search.includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectOption(option: CountryDialOption) {
    onCountryChange(option);
    setOpen(false);
    setQuery("");
  }

  function onNationalInput(value: string) {
    onNationalNumberChange(value.replace(/[^\d\s-]/g, ""));
  }

  return (
    <div className={styles.field} ref={rootRef}>
      <span className={styles.label}>{label}</span>
      <div className={`${styles.row} ${error ? styles.rowError : ""}`}>
        <div className={styles.picker}>
          <button
            type="button"
            className={styles.trigger}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={listId}
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={styles.flag} aria-hidden>
              {flagEmoji(country.iso)}
            </span>
            <span className={styles.dial}>+{country.dial}</span>
            <span className={styles.chevron} aria-hidden />
          </button>

          {open ? (
            <div className={styles.popover}>
              <label className={styles.searchLabel} htmlFor={searchId}>
                Search country
              </label>
              <input
                id={searchId}
                type="search"
                className={styles.search}
                placeholder="Country or code"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <ul id={listId} className={styles.list} role="listbox">
                {filtered.length === 0 ? (
                  <li className={styles.empty}>No matches</li>
                ) : (
                  filtered.map((option) => (
                    <li key={countryOptionKey(option)} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={countryOptionKey(option) === countryOptionKey(country)}
                        className={styles.option}
                        onClick={() => selectOption(option)}
                      >
                        <span className={styles.flag} aria-hidden>
                          {flagEmoji(option.iso)}
                        </span>
                        <span className={styles.optionName}>{option.name}</span>
                        <span className={styles.optionDial}>+{option.dial}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
        </div>

        <input
          type="tel"
          className={styles.number}
          value={nationalNumber}
          onChange={(e) => onNationalInput(e.target.value)}
          placeholder="Phone number"
          autoComplete="tel-national"
          disabled={disabled}
          aria-invalid={Boolean(error)}
        />
      </div>
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}
