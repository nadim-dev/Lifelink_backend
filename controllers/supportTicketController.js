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

    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
        public_id: `${req.user._id}-${Date.now()}`,
      });

      screenshotUrl = uploadResult.secure_url;
    }

    const ticket = await SupportTicket.create({
      ...cleanData,
      ticketId: await createTicketId(),
      userId: req.user._id,
      screenshot: screenshotUrl,
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
