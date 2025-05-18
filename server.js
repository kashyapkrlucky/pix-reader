const express = require("express");
const path = require("path");
const app = express();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const { createWorker } = require("tesseract.js");
const fs = require("fs");
const sharp = require("sharp"); // for text-to-image rendering
const port = process.env.PORT || 3000;

// Setup Pug
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// Body parser for forms
app.use(express.urlencoded({ extended: true }));

// Static files for downloads (if any)
app.use("/public", express.static(path.join(__dirname, "public")));

// Static files for downloads (if any)
app.use("/results", express.static(path.join(__dirname, "results")));

// Routes here...
app.get("/", (req, res) => {
  res.render("index");
});

// OCR Route GET (show form)
app.get("/ocr", (req, res) => {
  res.render("ocr");
});

// OCR Route POST (process image)
app.post("/ocr", upload.single("image"), async (req, res) => {
  const worker = createWorker({ logger: (m) => console.log(m) });
  try {
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    const { path: imagePath } = req.file;
    const {
      data: { text },
    } = await worker.recognize(imagePath);
    await worker.terminate();

    // Clean up uploaded image
    fs.unlinkSync(imagePath);

    res.render("ocr", { text });
  } catch (err) {
    res.status(500).send("OCR failed: " + err.message);
  }
});

// Text-to-image GET (show form)
app.get("/text-to-image", (req, res) => {
  res.render("text-to-image");
});

// Text-to-image POST (generate image)
app.post("/text-to-image", async (req, res) => {
  const { username, text } = req.body;

  const filename = `results/${username.replace(/\s+/g, "_")}-${Date.now()}.png`;

  // Create image with sharp
  const svgImage = `
    <svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="50%" y="40%" dominant-baseline="middle" text-anchor="middle" font-size="40" fill="#4f46e5" font-family="Arial, sans-serif">${text.replace(
        /\n/g,
        " "
      )}</text>
      <text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" font-size="24" fill="#6b7280" font-family="Arial, sans-serif">- ${username}</text>
    </svg>`;

  try {
    await sharp(Buffer.from(svgImage)).png().toFile(filename);

    // Send back URL to show image
    const imageUrl = `/${filename}`;

    res.render("text-to-image", { imageUrl });
  } catch (err) {
    res.status(500).send("Image generation failed: " + err.message);
  }
});

// ----- Start Server -----
app.listen(port, () => {
  console.log(`PixReader running on http://localhost:${port}`);
});
