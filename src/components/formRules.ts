import { isTokenLike } from "../sync/setupCode";

/**
 * A form rule that checks a filled-in value, so a "required" rule can explain
 * an empty one.
 */
export const validateWith =
  (isValid: (value: string) => boolean, message: string) =>
  (_: unknown, value?: string) =>
    !value?.trim() || isValid(value.trim())
      ? Promise.resolve()
      : Promise.reject(new Error(message));

/** Rules for a field to paste a GitHub token into. */
export const tokenRules = (requiredMessage: string) => [
  { required: true, whitespace: true, message: requiredMessage },
  {
    validator: validateWith(
      isTokenLike,
      "That doesn't look like a GitHub token",
    ),
  },
];
