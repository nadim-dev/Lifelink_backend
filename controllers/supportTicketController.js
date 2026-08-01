import Counter from "../models/counterModel.js";
import SupportTicket from "../models/ticketModel.js";
import { sanitize } from "../utils/sanitize.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";
import { supportTicketSchema } from "../validators/supportTicketValidator.js";


const createTicketId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: "support-ticket" },
    { $inc: { value: 1 } },
    {
  returnDocument: "after",
  upsert: true,
  setDefaultsOnInsert: true,
}
  );

  return `SUP-${counter.value}`;
};

export const createSupportTicket = async (req, res) => {
  try {
    console.log("Create support ticket function is running");
    const { success, data, error } = supportTicketSchema.safeParse(req.body);

    if (!success) {
      return res.status(400).json({
        message: "Invalid support ticket input",
        errors: error.flatten().fieldErrors,
      });
    }

    const cleanData = sanitize(data);
    let screenshotUrl = null;
    let screenshotName = null;

    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
        public_id: `${req.user._id}-${Date.now()}`,
      });

      screenshotUrl = uploadResult.secure_url;
      console.log("file ka original name",req.file.originalname);
      screenshotName = sanitize({ name: req.file.originalname }).name;
    }

    const ticket = await SupportTicket.create({
      ...cleanData,
      ticketId: await createTicketId(),
      userId: req.user._id,
      screenshot: screenshotUrl,
      screenshotName,
      statusHistory: [
    {
      status: "Open",
      changedAt: new Date(),
    },
  ],

  "messages": [
    {
      "sender": "Admin",
      "senderId":"6a65c31ae0fdf07c2d4a4093",
      "message": "Thank you for contacting BIT Support. Your ticket has been received successfully. Our support team will review your request and get back to you soon."
    }
  ],

  lastMessageBy: "Admin",
  lastRepliedAt: new Date(),
    });

    return res.status(201).json({
      message: "Support ticket created successfully",
      ticket,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMySupportTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ tickets });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getTicketById = async (req, res) => {
  console.log("Get Ticket by id controller is running");
  try{
  const { ticketId } = req.params;
  console.log("ticketId",ticketId);
  const userId=req.user._id; 
  console.log("userId",userId);
  const ticketDetail=await SupportTicket.findOne({ticketId:ticketId,userId:userId}).lean();
  return res.status(200).json({ticketDetail});
  }catch(err){
    console.log(err.message);
    return res.status(500).json({"message":"Internal Server Error"});
  }
};

export const addTicketMessage = async (req, res) => {
  console.log("message controller is running");
  
  try {
    const { ticketId } = req.params;
    const cleanData = sanitize({
      message: req.body?.message || "",
    });
    const messageText = cleanData.message.trim();

    if (!messageText && !req.file) {
      return res.status(400).json({ message: "Message or image is required" });
    }

    const ticket = await SupportTicket.findOne({
      ticketId,
      userId: req.user._id,
    });

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    let attachmentUrl = null;
    let attachmentName = null;

    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
        public_id: `${req.user._id}-${ticketId}-${Date.now()}`,
      });

      attachmentUrl = uploadResult.secure_url;
      attachmentName = sanitize({ name: req.file.originalname }).name;
    }

    const reply = {
      sender: "user",
      senderId: req.user._id,
      message: messageText,
      attachment: attachmentUrl,
      attachmentName,
    };

    ticket.messages.push(reply);
    ticket.lastMessageBy = "user";
    ticket.lastRepliedAt = new Date();

    await ticket.save();

    return res.status(201).json({
      message: "Reply sent successfully",
      ticketMessage: ticket.messages.at(-1),
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
