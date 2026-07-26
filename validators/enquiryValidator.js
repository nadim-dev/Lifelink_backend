import * as z from "zod";

export const enquirySchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters."),
  email: z.email("Please enter a valid email address."),
  subject: z.string().trim().min(1, "Please select a subject."),
  message: z.string().trim().min(15, "Message must be at least 15 characters."),
});
