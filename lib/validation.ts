import { z } from "zod";

/**
 * Zod schema for signup form validation.
 */
export const signupSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be 30 characters or less")
    .regex(
      /^[a-zA-Z0-9_ ]+$/,
      "Username can only contain letters, numbers, spaces, and underscores"
    )
    .transform((val) => val.trim()),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .transform((val) => val.trim()),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      "Password must contain at least one special character"
    ),
});

/**
 * Zod schema for login form validation.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .transform((val) => val.trim()),
  password: z.string().min(1, "Password is required"),
});

/**
 * Zod schema for profile editing validation.
 */
export const profileSchema = z.object({
  displayName: z
    .string()
    .max(50, "Display name must be 50 characters or less")
    .transform((val) => val.trim())
    .optional(),
  bio: z
    .string()
    .max(160, "Bio must be 160 characters or less")
    .transform((val) => val.trim())
    .optional(),
});

export type SignupFormData = z.infer<typeof signupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;

/**
 * Helper function to get the first error message from a Zod error.
 */
export function getFirstZodError(error: z.ZodError): string {
  const issues = error.issues;
  return issues[0]?.message || "Validation error";
}
