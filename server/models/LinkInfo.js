const mongoose = require("mongoose");

const LinkInfoSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    isSpam: {
      type: Boolean,
      default: false,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    features: {
      type: Object,
      default: {},
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    subdomain: {
      type: String,
      required: true,
      unique: true,
    },
    originalUrl: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    collection: "linkInfo",
  }
);

// Update the updatedAt timestamp before saving
LinkInfoSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("LinkInfo", LinkInfoSchema);
