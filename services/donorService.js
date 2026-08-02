import mongoose from "mongoose";
import Donor from "../models/donorModel.js";
import User from "../models/userModel.js";
import { sanitize } from "../utils/sanitize.js";

const sanitizeText = (value) => sanitize({ value: value || "" }).value;

export const createDonorProfile = async ({ userId, donorInput }) => {
  const session = await mongoose.startSession();

  try {
    let donor = null;

    await session.withTransaction(async () => {
      const existingUser = await User.findById(userId).session(session);

      if (!existingUser) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }

      if (existingUser.isDonor) {
        const error = new Error("You are already registered as a donor");
        error.statusCode = 409;
        throw error;
      }

      const existingDonor = await Donor.findOne({ userId }).session(session);

      if (existingDonor) {
        const error = new Error("Donor profile already exists for this user");
        error.statusCode = 409;
        throw error;
      }

      const userUpdate = {
        phoneNumber: sanitizeText(donorInput.phoneNumber),
        gender: donorInput.gender,
        dateOfBirth: new Date(donorInput.dateOfBirth),
        location: sanitizeText(donorInput.location),
        isDonor: true,
      };

      await User.findByIdAndUpdate(userId, userUpdate, {
        runValidators: true,
        session,
      });

      donor = await Donor.create(
        [
          {
          userId,
          bloodGroup: donorInput.bloodGroup,
          weight: donorInput.weight,
          hasDonatedBefore: donorInput.hasDonatedBefore,
          lastDonationDate: donorInput.lastDonationDate
            ? new Date(donorInput.lastDonationDate)
            : null,
          isHealthy: donorInput.isHealthy,
          healthReason: sanitizeText(donorInput.healthReason),
          eligibilityConfirmed: donorInput.eligibilityConfirmed,
          availability: donorInput.availability,
          preferredDistance: donorInput.preferredDistance,
          notificationPreferences: donorInput.notificationPreferences,
          },
        ],
        { session },
      );

      donor = donor[0];
    });

    return { donor };
  } catch (error) {
    if (error?.code === 11000) {
      error.statusCode = 409;
      error.message = "Donor profile already exists for this user";
    }

    throw error;
  } finally {
    await session.endSession();
  }
};
