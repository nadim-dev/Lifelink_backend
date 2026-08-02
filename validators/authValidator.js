import * as z from "zod";

export const loginSchema = z.object({
  email: z.email("Please Enter a valid Email"),
  password: z.string().min(4,"password must be at least 4 character"),
});

export const registerSchema= z.object({
   ...loginSchema.shape,
    username:z.string().trim().min(1,"Name Must contain atleast three character").max(100,"name must be less than hundred character"),
})

export const googleLoginSchema=z.object({
  id_token: z
    .string()
    .min(10, "Invalid Google token")
});

export const updateProfileSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(100, "Username must be less than 100 characters"),
  phoneNumber: z.string().trim().min(1, "Phone number is required").max(20, "Phone number is too long"),
  dateOfBirth: z.coerce.date(),
  gender: z.enum(["Male", "Female", "Other"]),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(4, "New password must be at least 4 characters"),
  confirmPassword: z.string().min(4, "Confirm password must be at least 4 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New password and confirm password do not match",
  path: ["confirmPassword"],
});

