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
import { sendEmail } from "../services/resetLinkService.js";
import { generateResetPasswordTemplate } from "../template/resetPassword.template.js";
import Notification from "../models/notificationModel.js";


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
      return res.status(404).json({ message: "user dosen't exist" });
    }

    if (!user.password) {
      return res.status(400).json({ message: "Please set a password from your profile before using email login" });
    }

 if (["BloodBank", "DeliveryPartner","Hospital"].includes(user.role) &&
  user.accountStatus !== "active"
) {
  return res.status(403).json({
    message: "Your registration is awaiting admin approval.",
  });
}


 if (user.role == "User" && user.accountStatus == "suspended")
  return res.status(403).json({message: "Your account is suspended by admin."});


    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credential" });
    }

    const sessionId = crypto.randomUUID();
    const sessionExpiryTime = 7 * 24 * 60 * 60;
    const rediskey = `session:${sessionId}`;

    await redisClient.hSet(rediskey, {
      userId: user._id.toString(),
      role:user.role,
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

      const {name, email, picture} = profileData;

      let user = await User.findOne({ email }).lean();

      if (!user) {
        user=await User.create({
          username:name,
          email,
          picture,
          authProvider:"google"
        })

        await Notification.create({
            userId: user._id,
            title: "Welcome! 👋",
            message:
              "Thanks for joining MediVerse. Explore blood donation, medicine comparison, hospitals, and emergency services.",
            type: "System",
            actionUrl: "/dashboard",
        });

      }

      const sessionId = crypto.randomUUID();
      const sessionExpiryTime = 7 * 24 * 60 * 60;
      const rediskey = `session:${sessionId}`;

      await redisClient.hSet(rediskey, {
        userId: user._id.toString(),
        createdAt: Date.now(),
        role:user.role,
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

export const resetUserPassword=async (req,res)=>{
  console.log("reset user passwrod controller is running");
  const {email}=req.body;
  console.log("email",email);
  const user=await User.findOne({email});
  console.log("user",user);
  if (!user){
    return res.status(200).json({ message: "If an account with this email exists, a password reset link will be sent."})
  }

  //* we are generating reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await user.save();

  const resetLink =`http://localhost:5173/reset-password/${resetToken}`;

  const emailBody=generateResetPasswordTemplate(resetLink);

  await sendEmail({
    to: user.email,
    subject: "Reset Your MediVerse Password",
    html: emailBody,
});

  return res.status(200).json({
    message: "If an account with this email exists, a password reset link will be sent.",
  });
}


export const createNewUserPassword = async (req, res) => {
  try {
    console.log("Create new user password controller is running");

    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    //* Validate input
    if (!password || !confirmPassword) {
      return res.status(400).json({
        message: "Password and Confirm Password are required.",
      });
    }

    //* Check password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match.",
      });
    }

    //* Hash the token received from URL
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    //* Find user with valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: {
        $gt: new Date(),
      },
    });

    if (!user) {
      return res.status(400).json({
        message: "Reset link is invalid or has expired.",
      });
    }

    //* Update password
    user.password = password;

    //* Remove reset token
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    //* Save user (password will be hashed by pre-save middleware)
    await user.save();

    return res.status(200).json({
      message: "Password has been reset successfully.",
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
    });
  }
};
