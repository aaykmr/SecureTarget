import * as yup from "yup";

export function phoneDigits(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export const contactFormSchema = yup.object({
  name: yup.string().trim().required("Full name is required"),
  email: yup
    .string()
    .trim()
    .email("Enter a valid work email")
    .required("Work email is required"),
  nationalNumber: yup
    .string()
    .required("Phone number is required")
    .test("phone-length", "Enter a valid phone number (4–15 digits)", (value) => {
      const digits = phoneDigits(value);
      return digits.length >= 4 && digits.length <= 15;
    }),
  message: yup.string().trim().required("Please tell us how we can help"),
});

export type ContactFormValues = yup.InferType<typeof contactFormSchema>;

export function formatPhoneE164(dial: string, nationalNumber: string): string {
  return `+${dial}${phoneDigits(nationalNumber)}`;
}
