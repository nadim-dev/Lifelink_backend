import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import enquiryRoutes from "./routes/enquiryRoutes.js";
import donorRoutes from "./routes/donorRoutes.js";
import supportTicketRoutes from "./routes/supportTicketRoutes.js";
import { connectDB } from "./config/mongoose.js";
import cookieParser from "cookie-parser";
import notificationRoutes from "./routes/notificationRoutes.js";
import geocodingRoutes from "./routes/geocodingRoutes.js"
import bloodBankRoutes from "./routes/bloodBankRoutes.js";
import deliveryPartnerRoutes from "./routes/deliveryPartnerRoutes.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";
import { Server } from "socket.io";
import http from "http";
import redisClient from "./config/redis.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import bloodRequestRoutes from "./routes/bloodRequestRoutes.js"
try{
await connectDB();
const app=express();
const server = http.createServer(app);
const mySecretKey = process.env.mySecretKey;

const PORT=4000
 
app.use(express.json());
 
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
}));


//?  socket cors

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

app.set("io", io);







app.use(cookieParser(mySecretKey));

app.use("/api/auth", authRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/support-tickets", supportTicketRoutes);
app.use("/api/notifications",notificationRoutes);
app.use("/api/geocoding", geocodingRoutes);
app.use("/api/blood-banks", bloodBankRoutes);
app.use("/api/delivery-partners", deliveryPartnerRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/delivery-requests",deliveryRoutes);
app.use("/api/blood-requests", bloodRequestRoutes);
io.use(async (socket, next) => {
  try {
    cookieParser(mySecretKey)(socket.request, {}, async (err) => {
      if (err) {
        return next(new Error("not logged in"));
      }

      try {
        const sessionId = socket.request.signedCookies.sid;

        if (!sessionId) {
          return next(new Error("not logged in"));
        }

        const session = await redisClient.hGetAll(`session:${sessionId}`);

        if (!session || Object.keys(session).length === 0) {
          return next(new Error("not logged in"));
        }

        socket.user = {_id: session.userId,role: session.role };
        next();
      } catch (err) {
        next(new Error("not logged in"));
      }
    });
  } catch (err) {
    next(new Error("not logged in"));
  }
});

io.on("connection", (socket) => {
  if (!["DeliveryPartner", "BloodBank", "User"].includes(socket.user?.role)) {
    socket.disconnect(true);
    return;
  }

  if (socket.user.role === "DeliveryPartner") {
    socket.join("delivery-partners");
    socket.join(`delivery-partner:${socket.user._id}`);

    console.log(`Delivery partner ${socket.user._id} connected with socket ${socket.id}`);
    console.log(`Delivery partner ${socket.user._id} joined delivery-partners room`);
  }

  if (socket.user.role === "BloodBank") {
    socket.join(`blood-bank:${socket.user._id}`);

    console.log(`Blood bank ${socket.user._id} connected with socket ${socket.id}`);
    console.log(`Blood bank ${socket.user._id} joined blood-bank room`);
  }

  if (socket.user.role === "User") {
    socket.join(`user:${socket.user._id}`);
    console.log(`User ${socket.user._id} connected with socket ${socket.id}`);
  }

  socket.on("disconnect", (reason) => {
    console.log(`${socket.user.role} ${socket.user._id} disconnected from socket ${socket.id}: ${reason}`);
  });
});


server.listen(PORT,()=>{
    console.log("server is running on http://localhost:4000");
});


}catch(err){
    console.log(err.message);
}
