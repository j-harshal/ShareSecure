const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const File = require("../models/file");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require('nodemailer');
// const punycode=require('punycode');

// Configure Nodemailer
let transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // e.g., smtp.gmail.com
  port: 587, // or 465 for SSL
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.MAIL_USER, // your email
    pass: process.env.MAIL_PASSWORD, // your password
  },
});

let storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

let upload = multer({ storage, limits: { fileSize: 1000000 * 100 } }).single(
  "myfile"
); //100mb

router.post("/", (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(500).send({ error: err.message });
    }
    const file = new File({
      filename: req.file.filename,
      uuid: uuidv4(),
      path: req.file.path,
      size: req.file.size,
    });
    const response = await file.save();
    res.json({ file: `${process.env.APP_BASE_URL}/files/${response.uuid}` });
  });
});

router.post("/send", async (req, res) => {
  const { uuid, emailTo, emailFrom, expiresIn } = req.body;
  if (!uuid || !emailTo || !emailFrom) {
    return res.status(422).send({ error: "All fields are required except expiry." });
  }

  try {
    // Get data from db
    const file = await File.findOne({ uuid: uuid });
    if (file.sender) {
      return res.status(422).send({ error: "Email already sent once." });
    }

    file.sender = emailFrom;
    file.receiver = emailTo;
    const response = await file.save();

    // Send mail
    let mailOptions = {
      from: emailFrom,
      to: emailTo,
      subject: "inShare file sharing",
      text: `${emailFrom} shared a file with you.`,
      html: require("../services/emailTemplate")({
        emailFrom,
        downloadLink: `${process.env.APP_BASE_URL}/files/${file.uuid}?source=email`,
        size: parseInt(file.size / 1000) + " KB",
        expires: "24 hours",
      }),
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: "Error in email sending." });
      }
      console.log("Email sent: %s", info.messageId);
      return res.json({ success: true });
    });

  } catch (err) {
    console.error("Error details:", err);
    return res.status(500).send({ error: "Something went wrong." });
  }
});


// router.post("/send", async (req, res) => {
//   const { uuid, emailTo, emailFrom, expiresIn } = req.body;
//   if (!uuid || !emailTo || !emailFrom) {
//     return res
//       .status(422)
//       .send({ error: "All fields are required except expiry." });
//   }
//   // Get data from db
//   try {
//     const file = await File.findOne({ uuid: uuid });
//     if (file.sender) {
//       return res.status(422).send({ error: "Email already sent once." });
//     }
//     file.sender = emailFrom;
//     file.receiver = emailTo;
//     const response = await file.save();
//     // send mail
//     const sendMail = require("../services/mailService");
//     sendMail({
//       from: emailFrom,
//       to: emailTo,
//       subject: "inShare file sharing",
//       text: `${emailFrom} shared a file with you.`,
//       html: require("../services/emailTemplate")({
//         emailFrom,
//         downloadLink: `${process.env.APP_BASE_URL}/files/${file.uuid}?source=email`,
//         size: parseInt(file.size / 1000) + " KB",
//         expires: "24 hours",
//       }),
//     })
//       .then(() => {
//         return res.json({ success: true });
//       })
//       .catch((err) => {
//         return res.status(500).json({ error: "Error in email sending." });
//       });
//   } catch (err) {
//     return res.status(500).send({ error: "Something went wrong." });
//   }
// });

module.exports = router;
