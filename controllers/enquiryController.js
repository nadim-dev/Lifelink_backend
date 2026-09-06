import Enquiry from "../models/enquiryModel.js";
import { sendEmail } from "../services/resetLinkService.js";
import { sanitize } from "../utils/sanitize.js";
import { enquirySchema } from "../validators/enquiryValidator.js";
import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";

export const getEnquiryStats = async (req, res) => {
  const [newEnquiries, thisWeek, thisMonth] = await Promise.all([
    Enquiry.countDocuments({ isReplied: false }),
    Enquiry.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    Enquiry.countDocuments({ createdAt: { $gte: new Date(new Date().setDate(1)) } }),
  ]);
  return res.json({ stats: { newEnquiries, thisWeek, thisMonth } });
};


export const createEnquiry = async (req, res) => {
  try {
    const { success, data, error } = enquirySchema.safeParse(req.body);

    if (!success) {
      return res.status(400).json({
        message: "Invalid enquiry input",
        errors: error.flatten().fieldErrors,
      });
    }

    const enquiry = await Enquiry.create(sanitize(data));

    const admin = await User.findOne({ role: "Admin" }).select("_id").lean();
     
    if (admin){
        await Notification.create({
          userId: admin._id,
          title: "New Enquiry",
          message: `New enquiry received from ${enquiry.name}.`,
          type: "Enquiry",
          actionUrl: `/admin/enquiries`,
  });
 }
   

    return res.status(201).json({
      message: "Enquiry submitted successfully",
      enquiry,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getAllEnquiries = async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      message: "Enquiries fetched successfully",
      enquiries,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const replyToEnquiry = async (req, res) => {
  try {
    const { reply } = req.body;
    const cleanReply = sanitize({ reply })?.reply?.trim();

    if (!cleanReply) {
      return res.status(400).json({ message: "Reply message is required" });
    }

    const enquiry = await Enquiry.findById(req.params.id);

    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    await sendEmail({
      to: enquiry.email,
      subject: `Re: ${enquiry.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <p>Hello ${enquiry.name},</p>
          <p>${cleanReply.replaceAll("\n", "<br />")}</p>
          <p style="margin-top: 24px;">Regards,<br />BIT Support Team</p>
        </div>
      `,
    });

    enquiry.isReplied = true;
    enquiry.repliedAt = new Date();
    await enquiry.save();

    return res.status(200).json({
      message: "Reply sent successfully",
      enquiry,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
