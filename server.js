require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error("Please upload a JPG, PNG, or WEBP image."));
    }

    callback(null, true);
  },
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/scan", upload.single("nidImage"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Please choose an NID image." });
  }

  // The image currently exists only in server memory for this request.
  // We will replace the empty fields with Google Vision results next.
  res.json({
    message: "Image received. Google Vision OCR will be connected next.",
    file: {
      name: req.file.originalname,
      size: req.file.size,
    },
    extracted: {
      name: "",
      nidNumber: "",
    },
  });
});

app.use((error, req, res, next) => {
  console.error(error.message);

  res.status(400).json({
    error: error.message || "The image could not be processed.",
  });
});

app.listen(PORT, () => {
  console.log(`Ikormi NID is running at http://localhost:${PORT}`);
});