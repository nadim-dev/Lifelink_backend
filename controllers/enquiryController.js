import Enquiry from "../models/enquiryModel.js";
import { sanitize } from "../utils/sanitize.js";
import { enquirySchema } from "../validators/enquiryValidator.js";

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

    return res.status(201).json({
      message: "Enquiry submitted successfully",
      enquiry,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
