import redisClient from "../config/redis.js";
import User from "../models/userModel.js";

export default async function checkAuth(req,res,next){
  console.log("auth function is running");
  const sessionId=req.signedCookies.sid;
   console.log("sessionId",sessionId);

  if(!sessionId){
      res.clearCookie("sid"); // if user manipulate session id then we will clear his cookie
      return res.status(401).json({"message":"not logged in"})
  }

  let session;
  try {
    session = await redisClient.hGetAll(`session:${sessionId}`);
  } catch (err) {
    res.clearCookie("sid");
    return res.status(401).json({"error":"not logged in"});
  }
  console.log("session of authmiddleware", session);
  if (!session || Object.keys(session).length === 0) {
      res.clearCookie("sid");
      return res.status(401).json({"message":"not logged in"})
  }

  req.user={_id:session.userId};
  next();
}

export const allowRoles = (...roles) => {
    return async (req, res, next) => {
        const user=await User.findById(req.user._id).lean();
        console.log("user",user);

        if (!roles.includes(user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        req.user=user;      
        next();
    };
};

