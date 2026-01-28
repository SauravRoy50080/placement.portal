const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "saurav.btmtcs10242907@nfsu.ac.in",
    pass: "flgmxdjrazxzznte"
  }
});

const sendMail = async (to, subject, text) => {
  await transporter.sendMail({
    from: "NFSU Dharwad Placement Cell <yourcollegeplacement@gmail.com>",
    to,
    subject,
    text
  });
};

module.exports = sendMail;
