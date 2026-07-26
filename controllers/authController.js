import { registerSchema,loginSchema } from "../validators/authValidator.js";
import User from "../models/userModel.js";
import { sanitize } from "../utils/sanitize.js";
import bcrypt from "bcrypt";
import redisClient from "../config/redis.js";
import crypto from "crypto";

export const registerUser = async (req, res) => {
  console.log("Register controller function is running");
  try{
  const { success, data, error} = registerSchema.safeParse(req.body);

  if (!success){
    console.log(error);
    return res.status(400).json({"message":"Invalid input"});
  }
  
  const {username,password,email}=sanitize(data);

    
 const user = await User.create({
  username,
  email,
  password
});
  
  return res.status(200).json({"message":"user registered successfully"});
  }catch(err){
    console.log(err);
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(409).json({success: false,message: "Email is already registered"});
    }

    return res.status(500).json({"message":"Internal Server Error"})
  }
};

export const loginUser = async (req, res) => {
  console.log("Login controller function is running");
  try{
  const { success, data, error} = loginSchema.safeParse(req.body);

  if(!success){
    return res.status(400).json({"message":"Invalid input"})
  }

  const {password,email}=sanitize(data);

  const user=await User.findOne({email:email}).lean();

  if (!user)
    return res.status(404).json({"message":"user not found"});
 
  const isPasswordValid = await bcrypt.compare(
      password, // plain password from login
      user.password, // hashed password from DB
    );

  console.log("isPassowrdVlaid",isPasswordValid);   

    if (!isPasswordValid)
      return res.status(400).json({ "message": "Invalid credential" });

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

    return res.status(200).json({ message: "Login successful" });
}catch(err){
    console.log(err.message);
    return res.status(500).json({"message":"Internal Server Error"});
}};


export const fetchCurrentUser=async (req,res)=>{
  console.log("fetch controller user function is running");
  try{
  const userId=req.user._id;
  console.log("userId",userId);
  const currentUser=await User.findById(userId).select("-password").lean();
  return res.status(200).json({currentUser});
  }catch(err){
    console.log(err.message);
    return res.status(500).json({"message":"Internal Server Error"});
  }
}

export const logoutUser=async (req,res)=>{
   console.log("logout function is running");
   const sessionId = req.signedCookies.sid;
   await redisClient.del(`session:${sessionId}`);
   res.clearCookie("sid");
   return res.status(204).end();
}