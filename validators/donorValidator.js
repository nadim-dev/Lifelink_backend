import * as z from "zod";

export const coordinatesSchema = z.object({
  coordinates: z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  }),
});

export const donorSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required."),
    email: z.email("Please enter a valid email address."),
    bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
    dateOfBirth: z.string().trim().min(1, "Date of birth is required."),
    gender: z.enum(["Male", "Female", "Other"]),
    weight: z.coerce.number().min(1, "Weight is required."),
    phoneNumber: z.string().trim().min(7, "Phone number is required."),
    donatedBefore: z.enum(["never", "yes"]),
    lastDonationDate: z.string().trim().optional().or(z.literal("")),
    isHealthy: z.enum(["yes", "no"]),
    healthReason: z.string().trim().max(150).optional().or(z.literal("")),
    eligibilityConfirmed: z.literal(true, {
      error: "Eligibility confirmation is required.",
    }),
    availability: z.enum(["anytime", "emergency", "unavailable"]),
    maxTravelDistance: z.coerce.number().refine(
      (value) => [5, 10, 20, 50].includes(value),
      "Please select a valid travel distance.",
    ),
    notifyNearbyRequests: z.boolean(),
    notifyEmergencyRequests: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.donatedBefore === "yes" && !data.lastDonationDate) {
      ctx.addIssue({
        code: "custom",
        path: ["lastDonationDate"],
        message: "Last donation date is required.",
      });
    }

    if (data.isHealthy === "no" && !data.healthReason) {
      ctx.addIssue({
        code: "custom",
        path: ["healthReason"],
        message: "Reason is required.",
      });
    }

    if (!data.notifyNearbyRequests && !data.notifyEmergencyRequests) {
      ctx.addIssue({
        code: "custom",
        path: ["notifyNearbyRequests"],
        message: "Please select at least one notification preference.",
      });
    }
  });
