const mongoose = require("mongoose");

const userAttemptSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    default: "Unknown",
  },
  countryCode: {
    type: String,
    default: "Unknown",
  },
  region: {
    type: String,
    default: "Unknown",
  },
  city: {
    type: String,
    default: "Unknown",
  },
  timezone: {
    type: String,
    default: "Unknown",
  },
  currency: {
    type: String,
    default: "Unknown",
  },
  languages: {
    type: String,
    default: "Unknown",
  },
  callingCode: {
    type: String,
    default: "Unknown",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  attemptCount: {
    type: Number,
    default: 1,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

module.exports = mongoose.model("UserAttempt", userAttemptSchema);
