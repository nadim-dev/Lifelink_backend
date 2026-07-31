import * as z from "zod";

export const supportTicketSchema = z.object({
  category: z.enum([
    "Blood Services",
    "Medicine Services",
    "Ambulance Booking",
    "Hospital Services",
    "Account & Profile",
    "Login & Security",
    "AI Prediction",
    "Technical Issue",
    "Feature Request",
    "Other",
  ]),
  subject: z.string().trim().min(1, "Subject is required").max(120),
  description: z.string().trim().min(1, "Description is required").max(3000),
  priority: z.enum(["Low", "Medium", "High"]).default("Medium"),
});
