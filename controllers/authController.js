import bcrypt from "bcrypt";
import crypto from "crypto";
import redisClient from "../config/redis.js";
import Donor from "../models/donorModel.js";
import Enquiry from "../models/enquiryModel.js";
import SupportTicket from "../models/ticketModel.js";
import User from "../models/userModel.js";
import { sanitize } from "../utils/sanitize.js";
import { googleLoginSchema, loginSchema, registerSchema, updatePasswordSchema, updateProfileSchema } from "../validators/authValidator.js";
import { verifyIdToken } from "../services/googleAuthService.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";

const toCurrentUser = (user) => {
  const plainUser = typeof user.toObject === "function" ? user.toObject() : user;
  const { password, ...currentUser } = plainUser;
  return {
    ...currentUser,
    hasPassword: Boolean(password),
  };
};

export const registerUser = async (req, res) => {
  console.log("Register controller function is running");

  try {
    const { success, data, error } = registerSchema.safeParse(req.body);

    if (!success) {
      console.log(error);
      return res.status(400).json({ message: "Invalid input" });
    }

    const { username, password, email } = sanitize(data);

    await User.create({
      username,
      email,
      password,
    });

    return res.status(200).json({ message: "user registered successfully" });
  } catch (err) {
    console.log(err);

    if (err.code === 11000 && err.keyPattern?.email) {
      return res
        .status(409)
        .json({ success: false, message: "Email is already registered" });
    }

    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const loginUser = async (req, res) => {
  console.log("Login controller function is running");

  try {
    const { success, data } = loginSchema.safeParse(req.body);

    if (!success) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const { password, email } = sanitize(data);
    const user = await User.findOne({ email }).lean();

    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    if (!user.password) {
      return res.status(400).json({ message: "Please set a password from your profile before using email login" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credential" });
    }

    const sessionId = crypto.randomUUID();
    const sessionExpiryTime = 7 * 24 * 60 * 60;
    const rediskey = `session:${sessionId}`;

    await redisClient.hSet(rediskey, {
      userId: user._id.toString(),
      createdAt: Date.now(),
    });
    await redisClient.expire(rediskey, sessionExpiryTime);

    res.cookie("sid", sessionId, {
      httpOnly: true,
      signed: true,
      sameSite: "lax",
      maxAge: sessionExpiryTime * 1000,
    });

    const currentUser = toCurrentUser(user);

    return res.status(200).json({ message: "Login successful", currentUser });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const fetchCurrentUser = async (req, res) => {
  console.log("fetch controller user function is running");

  try {
    const userId = req.user._id;
    const user = await User.findById(userId).lean();
    const currentUser = toCurrentUser(user);
    return res.status(200).json({ currentUser });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfilePicture = async (req, res) => {
  console.log("update profile picture controller function is running");

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Profile picture is required" });
    }

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "mediverse/profile-pictures",
      resource_type: "image",
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { picture: uploadResult.secure_url },
      { new: true, runValidators: true },
    )
      .lean();
    const currentUser = toCurrentUser(user);

    return res.status(200).json({
      message: "Profile picture updated successfully",
      currentUser,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Unable to update profile picture" });
  }
};

export const updateCurrentUserProfile = async (req, res) => {
  console.log("update current user profile controller function is running");

  try {
    const { success, data } = updateProfileSchema.safeParse(req.body);

    if (!success) {
      return res.status(400).json({ message: "Invalid profile input" });
    }

    const { username, phoneNumber, gender } = sanitize({
      username: data.username,
      phoneNumber: data.phoneNumber,
      gender: data.gender,
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        username,
        phoneNumber,
        dateOfBirth: data.dateOfBirth,
        gender,
      },
      { new: true, runValidators: true },
    )
      .lean();
    const currentUser = toCurrentUser(user);

    return res.status(200).json({
      message: "Profile updated successfully",
      currentUser,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Unable to update profile" });
  }
};

export const updateCurrentUserPassword = async (req, res) => {
  console.log("update password controller function is running");

  try {
    const { success, data, error } = updatePasswordSchema.safeParse(req.body);

    if (!success) {
      return res.status(400).json({ message: error.issues?.[0]?.message || "Invalid password input" });
    }

    const { currentPassword, newPassword } = sanitize(data);
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
    }

    const hadPassword = Boolean(user.password);
    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      message: hadPassword ? "Password updated successfully" : "Password set successfully",
      currentUser: toCurrentUser(user),
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Unable to update password" });
  }
};

export const logoutUser = async (req, res) => {
  console.log("logout function is running");

  const sessionId = req.signedCookies.sid;
  await redisClient.del(`session:${sessionId}`);
  res.clearCookie("sid");
  return res.status(204).end();
};

export const deleteCurrentUserAccount = async (req, res) => {
  console.log("delete current user account controller function is running");

  try {
    const userId = req.user._id;
    const sessionId = req.signedCookies.sid;
    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    await Promise.all([
      Donor.deleteMany({ userId }),
      SupportTicket.deleteMany({ userId }),
      Enquiry.deleteMany({ email: user.email }),
      User.findByIdAndDelete(userId),
      sessionId ? redisClient.del(`session:${sessionId}`) : Promise.resolve(),
    ]);

    res.clearCookie("sid");
    return res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Unable to delete account" });
  }
};

export const loginWithGoogle = async (req, res) => {
  console.log("google login controller function is running");

  const { success, data } = googleLoginSchema.safeParse(req.body);

  if (!success) {
    return res.status(400).json({ message: "Invalid Otp" });
  }

  const { id_token } = data;

  try {
    const profileData = await verifyIdToken(id_token);
    console.log(profileData);
    const {name, email, picture} = profileData;

    let user = await User.findOne({ email }).lean();

    if (!user) {
      user=await User.create({
        username:name,
        email,
        picture,
        authProvider:"google"
      })
    }

    const sessionId = crypto.randomUUID();
    const sessionExpiryTime = 7 * 24 * 60 * 60;
    const rediskey = `session:${sessionId}`;

    await redisClient.hSet(rediskey, {
      userId: user._id.toString(),
      createdAt: Date.now(),
    });
    await redisClient.expire(rediskey, sessionExpiryTime);

    res.cookie("sid", sessionId, {
      httpOnly: true,
      signed: true,
      sameSite: "lax",
      maxAge: sessionExpiryTime * 1000,
    });

    const currentUser = toCurrentUser(user);

    return res.status(200).json({
      message: "Google login successful",
      currentUser,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Google login failed" });
  }
};
