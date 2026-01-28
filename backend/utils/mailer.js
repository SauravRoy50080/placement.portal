import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "saurav.btmtcs10242907@nfsu.ac.in",
    pass: "flgmxdjrazxzznte"
  }
});

/**
 * Send email utility
 */
const sendMail = async (to, subject, text) => {
  await transporter.sendMail({
    from: "NFSU Dharwad Placement Cell <yourcollegeplacement@gmail.com>",
    to,
    subject,
    text
  });
};

export default sendMail;
