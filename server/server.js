const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const XLSX = require("xlsx");
const User = require("./models/User");
const LinkInfo = require("./models/LinkInfo");
const VisitInfo = require("./models/VisitInfo");
const auth = require("./middleware/auth");
const geoip = require("geoip-lite");
const axios = require("axios");

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth");

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);

app.get("/api", (req, res) => {
  res.json({ message: "Welcome to FillInfo API" });
});

app.get("/r/:subdomain", async (req, res) => {
  try {
    const subdomain = req.params.subdomain;
    const link = await LinkInfo.findOne({ subdomain });

    if (!link) {
      return res.status(404).send("Link not found");
    }

    // Get visitor's IP
    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    // Get detailed country information using ipapi.co
    let countryInfo = {};
    try {
      const response = await axios.get(`https://ipapi.co/${ip}/json/`);
      countryInfo = {
        country: response.data.country_name,
        countryCode: response.data.country_code,
        region: response.data.region,
        city: response.data.city,
        timezone: response.data.timezone,
        currency: response.data.currency,
        languages: response.data.languages,
        callingCode: response.data.country_calling_code,
      };
    } catch (geoError) {
      console.error("Error getting country info:", geoError);
      // Fallback to geoip-lite if ipapi.co fails
      const geo = geoip.lookup(ip);
      countryInfo = {
        country: geo ? geo.country : "Unknown",
        countryCode: geo ? geo.country : "Unknown",
      };
    }

    // Create visit record with detailed country info
    const visitInfo = new VisitInfo({
      ip,
      country: countryInfo.country,
      countryCode: countryInfo.countryCode,
      region: countryInfo.region,
      city: countryInfo.city,
      timezone: countryInfo.timezone,
      currency: countryInfo.currency,
      languages: countryInfo.languages,
      callingCode: countryInfo.callingCode,
      link: link._id,
      userAgent: req.headers["user-agent"],
    });

    await visitInfo.save();

    // Redirect to original URL
    res.redirect(link.originalUrl);
  } catch (error) {
    console.error("Error tracking visit:", error);
    res.status(500).send("Error tracking visit");
  }
});

// Get visit stats for a link
app.get("/api/linkInfo/:id/stats", auth, async (req, res) => {
  try {
    const link = await LinkInfo.findOne({
      _id: req.params.id,
      reportedBy: req.user.userId,
    });

    if (!link) {
      return res.status(404).json({ message: "Link not found" });
    }

    const stats = link.getVisitStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting stats:", error);
    res
      .status(500)
      .json({ message: "Error getting stats", error: error.message });
  }
});

// Endpoint để lấy thống kê via
app.get("/api/linkInfo/stats/all", auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Lấy tất cả link của user
    const userLinks = await LinkInfo.find({ userId });
    const linkIds = userLinks.map((link) => link._id);

    // Lấy visits từ VisitInfo collection trong 24h qua
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Sử dụng MongoDB aggregation để lấy unique visits
    const uniqueVisits = await VisitInfo.aggregate([
      {
        $match: {
          linkId: { $in: linkIds },
          timestamp: { $gte: oneDayAgo },
        },
      },
      {
        $sort: { timestamp: -1 }, // Sắp xếp theo thời gian mới nhất
      },
      {
        $group: {
          _id: {
            ipAddress: "$ipAddress",
            linkId: "$linkId",
            // Nhóm theo khoảng thời gian 30 phút
            timeWindow: {
              $subtract: [
                { $toLong: "$timestamp" },
                { $mod: [{ $toLong: "$timestamp" }, 1800000] }, // 30 phút = 1800000 ms
              ],
            },
          },
          timestamp: { $first: "$timestamp" },
          country: { $first: "$country" },
          city: { $first: "$city" },
        },
      },
    ]);

    // Tính tổng số via (unique)
    const totalVisits = uniqueVisits.length;

    // Thống kê theo quốc gia (unique)
    const countryStats = {};
    uniqueVisits.forEach((visit) => {
      countryStats[visit.country] = (countryStats[visit.country] || 0) + 1;
    });

    // Đếm số người online (unique trong 5 phút gần nhất)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineVisits = uniqueVisits.filter(
      (v) => v.timestamp >= fiveMinutesAgo
    );
    const onlineCount = onlineVisits.length;

    // Thống kê online theo quốc gia (unique)
    const onlineByCountry = {};
    onlineVisits.forEach((visit) => {
      onlineByCountry[visit.country] =
        (onlineByCountry[visit.country] || 0) + 1;
    });

    // Log for debugging
    console.log("Stats calculation:", {
      totalLinks: userLinks.length,
      totalUniqueVisits: totalVisits,
      countryStats,
      onlineCount,
      onlineByCountry,
    });

    res.json({
      totalVisits,
      countryStats,
      onlineCount,
      onlineByCountry,
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({ message: "Error fetching statistics" });
  }
});

// Endpoint để tải về via theo quốc gia
app.get("/api/linkInfo/stats/download/:country", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { country } = req.params;

    const userLinks = await LinkInfo.find({ userId });
    const linkIds = userLinks.map((link) => link._id);

    const visits = await VisitInfo.find({
      linkId: { $in: linkIds },
      country: country,
    }).select("_id ipAddress userAgent timestamp country");

    // Chuẩn bị dữ liệu cho Excel
    const excelData = visits.map((v) => ({
      ID: v._id.toString(),
      "IP Address": v.ipAddress
        ? v.ipAddress.replace(/\./g, ":") + "." + v.country.toUpperCase()
        : "N/A",
      "User Agent": v.userAgent || "N/A",
      Time: new Date(v.timestamp).toLocaleString(),
    }));

    // Tạo workbook và worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Điều chỉnh độ rộng cột
    const colWidths = [
      { wch: 15 }, // ID
      { wch: 20 }, // IP Address
      { wch: 100 }, // User Agent
      { wch: 20 }, // Time
    ];
    ws["!cols"] = colWidths;

    // Thêm worksheet vào workbook
    XLSX.utils.book_append_sheet(wb, ws, `Via ${country}`);

    // Tạo buffer
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    // Gửi file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=via_${country}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );
    res.send(excelBuffer);
  } catch (error) {
    console.error("Error downloading stats:", error);
    res.status(500).json({ message: "Error downloading statistics" });
  }
});

// Endpoint để tải về toàn bộ via
app.get("/api/linkInfo/stats/download", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userLinks = await LinkInfo.find({ userId });
    const linkIds = userLinks.map((link) => link._id);

    const visits = await VisitInfo.find({
      linkId: { $in: linkIds },
    }).select("_id ipAddress userAgent timestamp country");

    // Nhóm dữ liệu theo quốc gia
    const visitsByCountry = {};
    visits.forEach((visit) => {
      if (!visitsByCountry[visit.country]) {
        visitsByCountry[visit.country] = [];
      }
      visitsByCountry[visit.country].push({
        ID: visit._id.toString(),
        "IP Address": visit.ipAddress
          ? visit.ipAddress.replace(/\./g, ":") +
            "." +
            visit.country.toUpperCase()
          : "N/A",
        "User Agent": visit.userAgent || "N/A",
        Time: new Date(visit.timestamp).toLocaleString(),
      });
    });

    // Tạo workbook
    const wb = XLSX.utils.book_new();

    // Tạo worksheet cho mỗi quốc gia
    Object.entries(visitsByCountry).forEach(([country, countryVisits]) => {
      const ws = XLSX.utils.json_to_sheet(countryVisits);

      // Điều chỉnh độ rộng cột
      const colWidths = [
        { wch: 15 }, // ID
        { wch: 20 }, // IP Address
        { wch: 100 }, // User Agent
        { wch: 20 }, // Time
      ];
      ws["!cols"] = colWidths;

      // Thêm worksheet vào workbook
      XLSX.utils.book_append_sheet(wb, ws, country);
    });

    // Tạo buffer
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    // Gửi file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=all_via_${
        new Date().toISOString().split("T")[0]
      }.xlsx`
    );
    res.send(excelBuffer);
  } catch (error) {
    console.error("Error downloading all stats:", error);
    res.status(500).json({ message: "Error downloading statistics" });
  }
});

// Endpoint để xóa toàn bộ via
app.delete("/api/linkInfo/stats/clear", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userLinks = await LinkInfo.find({ userId });
    const linkIds = userLinks.map((link) => link._id);

    await VisitInfo.deleteMany({ linkId: { $in: linkIds } });
    res.json({ message: "All visit data cleared" });
  } catch (error) {
    console.error("Error clearing stats:", error);
    res.status(500).json({ message: "Error clearing statistics" });
  }
});

// Get visit statistics for a link
app.get("/api/links/:linkId/stats", auth, async (req, res) => {
  try {
    const { linkId } = req.params;

    // Verify link ownership
    const link = await LinkInfo.findOne({
      _id: linkId,
      userId: req.user.userId,
    });

    if (!link) {
      return res.status(404).json({ message: "Link not found" });
    }

    // Get visit statistics grouped by country
    const stats = await VisitInfo.aggregate([
      { $match: { linkId: mongoose.Types.ObjectId(linkId) } },
      {
        $group: {
          _id: "$country",
          visits: { $sum: 1 },
          lastVisit: { $max: "$timestamp" },
        },
      },
      { $sort: { visits: -1 } },
    ]);

    res.json({
      totalVisits: stats.reduce((sum, stat) => sum + stat.visits, 0),
      countryStats: stats.map((stat) => ({
        country: stat._id,
        visits: stat.visits,
        lastVisit: stat.lastVisit,
      })),
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({ message: "Error fetching statistics" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
