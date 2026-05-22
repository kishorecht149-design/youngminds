const mongoose = require("mongoose");

// Atomic counter schema for certificate IDs
const counterSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model("Counter", counterSchema);

// Template schema
const templateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  backgroundUrl: { type: String, default: "" }, // Base64 or local URL of A4 template image
  textColor: { type: String, default: "#15130c" },
  accentColor: { type: String, default: "#ffd700" },
  isDefault: { type: Boolean, default: false },
  fieldsConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      studentName: { x: 148, y: 95, fontSize: 32, fontStyle: "bold", align: "center" },
      eventName: { x: 148, y: 120, fontSize: 20, fontStyle: "normal", align: "center" },
      date: { x: 80, y: 155, fontSize: 12, fontStyle: "normal", align: "center" },
      venue: { x: 148, y: 135, fontSize: 12, fontStyle: "normal", align: "center" },
      certificateId: { x: 80, y: 170, fontSize: 10, fontStyle: "italic", align: "center" },
      qrCode: { x: 220, y: 140, width: 35, height: 35 },
      signature: { x: 165, y: 155, label: "Authorized Signatory", fontSize: 12, fontStyle: "normal", align: "center" }
    }
  },
  labelsConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      titleText: "CERTIFICATE",
      subtitleText: "OF PARTICIPATION",
      kickerText: "THIS IS TO CERTIFY THAT",
      participationText: "has successfully participated in the",
      footerParagraph1: "conducted by YoungMinds Agency,",
      footerParagraph2: "focused on practical skills and real-world learning.",
      footerParagraph3: "We appreciate your enthusiasm and commitment to growth.",
      authorizedSignLabel: "AUTHORIZED SIGNATURE",
      certificateIdLabel: "CERTIFICATE ID",
      dateLabel: "DATE",
      scanToVerifyLabel: "SCAN TO VERIFY"
    }
  }
}, { timestamps: true });

const Template = mongoose.model("Template", templateSchema);

// Event schema
const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: String, default: "" },
  venue: { type: String, default: "" },
  organizerName: { type: String, default: "" },
  certificateType: { type: String, default: "Participation" }, // e.g. Participation, Appreciation, Excellence
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template" }
}, { timestamps: true });

const Event = mongoose.model("Event", eventSchema);

// Certificate schema
const certificateSchema = new mongoose.Schema({
  certificateId: { type: String, required: true, unique: true },
  studentName: { type: String, required: true },
  email: { type: String, default: "" },
  collegeOrSchool: { type: String, default: "" },
  eventName: { type: String, required: true },
  date: { type: String, default: "" },
  venue: { type: String, default: "" },
  qrUrl: { type: String, default: "" },
  pdfUrl: { type: String, default: "" },
  verified: { type: Boolean, default: true },
  pdfData: { type: String, default: "" },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template" }
}, { timestamps: true });

certificateSchema.index({ createdAt: -1 });

const Certificate = mongoose.model("Certificate", certificateSchema);

// Atomic sequence generator helper
async function getNextCertificateId(year = "2026") {
  const counter = await Counter.findOneAndUpdate(
    { id: `certificateId-${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const padSeq = String(counter.seq).padStart(4, "0");
  return `YM-${year}-WS-${padSeq}`;
}

module.exports = {
  Counter,
  Template,
  Event,
  Certificate,
  getNextCertificateId
};
