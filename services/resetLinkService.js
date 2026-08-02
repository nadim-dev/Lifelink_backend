import { Resend } from "resend";

const resend = new Resend(process.env.resendKey);

export async function sendEmail({
  to,
  subject,
  html,
  from = "MediConnect <otp@focskill.in>",
}) {
  if (!to) throw new Error("Recipient email is required");
  console.log("email function is running");

  await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

}