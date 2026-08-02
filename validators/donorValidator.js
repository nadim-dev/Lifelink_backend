import * as z from "zod";

export const coordinatesSchema = z.object({
  coordinates: z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  }),
});

export const donorSchema = z
  .object({
    phoneNumber: z.string().trim().min(7, "Phone number is required."),
    gender: z.enum(["Male", "Female", "Other"]),
    dateOfBirth: z.string().trim().min(1, "Date of birth is required."),
    location: z.string().trim().min(1, "Location is required."),
    bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
    weight: z.coerce.number().min(1, "Weight is required."),
    hasDonatedBefore: z.enum(["never", "yes"]),
    lastDonationDate: z.string().trim().optional().or(z.literal("")),
    isHealthy: z.enum(["yes", "no"]),
    healthReason: z.string().trim().max(150).optional().or(z.literal("")),
    eligibilityConfirmed: z.literal(true, {
      error: "Eligibility confirmation is required.",
    }),
    availability: z.enum(["anytime", "emergency", "unavailable"]),
    preferredDistance: z.coerce.number().refine(
      (value) => [5, 10, 20, 50].includes(value),
      "Please select a valid travel distance.",
    ),
    notificationPreferences: z.object({
      nearbyRequests: z.boolean(),
      emergencyRequests: z.boolean(),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.hasDonatedBefore === "yes" && !data.lastDonationDate) {
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

    if (
      !data.notificationPreferences.nearbyRequests &&
      !data.notificationPreferences.emergencyRequests
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["notificationPreferences"],
        message: "Please select at least one notification preference.",
      });
    }
  });

export const updateDonorSchema = z
  .object({
    weight: z.coerce.number().min(1, "Weight is required."),
    isHealthy: z.enum(["yes", "no"]),
    healthReason: z.string().trim().max(150).optional().or(z.literal("")),
    availability: z.enum(["anytime", "emergency", "unavailable"]),
    preferredDistance: z.coerce.number().refine(
      (value) => [5, 10, 20, 50].includes(value),
      "Please select a valid travel distance.",
    ),
  })
  .superRefine((data, ctx) => {
    if (data.isHealthy === "no" && !data.healthReason) {
      ctx.addIssue({
        code: "custom",
        path: ["healthReason"],
        message: "Reason is required.",
      });
    }
  });
