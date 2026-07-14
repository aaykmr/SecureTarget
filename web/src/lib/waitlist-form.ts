export function phoneDigits(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function formatPhoneE164(dial: string, nationalNumber: string): string {
  return `+${dial}${phoneDigits(nationalNumber)}`;
}

export type WaitlistFormValues = {
  name: string;
  email: string;
  nationalNumber: string;
  organization: string;
  message: string;
};

export type WaitlistFieldErrors = Partial<Record<keyof WaitlistFormValues, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateWaitlistForm(values: WaitlistFormValues): WaitlistFieldErrors {
  const errors: WaitlistFieldErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const organization = values.organization.trim();
  const digits = phoneDigits(values.nationalNumber);

  if (!name || name.length < 2) {
    errors.name = "Enter your full name";
  }
  if (!email) {
    errors.email = "Work email is required";
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Enter a valid work email";
  }
  if (digits.length > 0 && (digits.length < 7 || digits.length > 15)) {
    errors.nationalNumber = "Enter a valid phone number (7–15 digits)";
  }
  if (!organization) {
    errors.organization = "Organization is required";
  }
  return errors;
}
