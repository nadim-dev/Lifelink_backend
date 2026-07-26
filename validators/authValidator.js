import * as z from "zod";

export const loginSchema = z.object({
  email: z.email("Please Enter a valid Email"),
  password: z.string().min(4,"password must be at least 4 character"),
});

export const registerSchema= z.object({
   ...loginSchema.shape,
    username:z.string().trim().min(1,"Name Must contain atleast three character").max(100,"name must be less than hundred character"),
})
