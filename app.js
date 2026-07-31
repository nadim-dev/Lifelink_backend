import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import enquiryRoutes from "./routes/enquiryRoutes.js";
import donorRoutes from "./routes/donorRoutes.js";
import supportTicketRoutes from "./routes/supportTicketRoutes.js";
import { connectDB } from "./config/mongoose.js";
import cookieParser from "cookie-parser";

try{
await connectDB();
const app=express();
const mySecretKey = process.env.mySecretKey;

const PORT=4000

app.use(express.json());

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
}));

app.use(cookieParser(mySecretKey));

app.use("/api/auth", authRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/donors", donorRoutes);
app.use("/api/support-tickets", supportTicketRoutes);

app.listen(PORT,()=>{
    console.log("server is running on http://localhost:4000");
})


}catch(err){
    console.log(err.message);
}
