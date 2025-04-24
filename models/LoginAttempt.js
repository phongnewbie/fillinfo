const mongoose = require("mongoose");

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
);

module.exports = mongoose.model("LoginAttempt", loginAttemptSchema);
