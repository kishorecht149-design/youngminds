const { jsPDF } = require("jspdf");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "../..");
const certificatesDir = path.join(rootDir, "uploads", "certificates");

// Ensure the certificates directory exists
function ensureCertificatesDir() {
  if (!fs.existsSync(certificatesDir)) {
    fs.mkdirSync(certificatesDir, { recursive: true });
  }
}

/**
 * Generates a verification QR code base64 string
 */
async function generateQrCodeBase64(verifyUrl) {
  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 250,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    });
    return qrDataUrl.split(",")[1];
  } catch (err) {
    console.error("QR Code generation error:", err);
    throw err;
  }
}

/**
 * Generates and saves a Certificate PDF locally
 */
async function generateCertificatePdf(cert, template, verifyUrl) {
  ensureCertificatesDir();

  // Create A4 Landscape PDF
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = 297;
  const pageHeight = 210;

  // 1. Draw Background
  if (template && template.backgroundUrl && template.backgroundUrl.includes("base64,")) {
    try {
      const parts = template.backgroundUrl.split(",");
      const mime = parts[0].match(/:(.*?);/)[1];
      const format = mime.includes("png") ? "PNG" : "JPEG";
      const base64Data = parts[1];
      doc.addImage(base64Data, format, 0, 0, pageWidth, pageHeight);
    } catch (err) {
      console.error("Failed to load template background image:", err.message);
      drawPremiumDefaultBackground(doc, pageWidth, pageHeight);
    }
  } else {
    // If no background uploaded, render the premium default design
    drawPremiumDefaultBackground(doc, pageWidth, pageHeight);
  }

  // Set colors from template
  const textColor = template?.textColor || "#15130c";
  const accentColor = template?.accentColor || "#ffd700";
  
  // 2. Load and embed QR Code
  const qrBase64 = await generateQrCodeBase64(verifyUrl);
  const fields = template?.fieldsConfig || {};

  // Draw QR code
  const qrConfig = fields.qrCode || { x: 232, y: 142, width: 35, height: 35 };
  doc.addImage(qrBase64, "PNG", qrConfig.x, qrConfig.y, qrConfig.width, qrConfig.height);
  
  // Subtext for QR
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#8b8b95");
  doc.text("Scan to Verify", qrConfig.x + (qrConfig.width / 2), qrConfig.y + qrConfig.height + 4, { align: "center" });

  // 3. Draw Dynamic Text Fields
  
  // Student Name
  const nameConf = fields.studentName || { x: 148, y: 95, fontSize: 32, fontStyle: "bold", align: "center" };
  doc.setFont("Helvetica", nameConf.fontStyle || "bold");
  doc.setFontSize(nameConf.fontSize || 32);
  doc.setTextColor(textColor);
  doc.text(cert.studentName, nameConf.x, nameConf.y, { align: nameConf.align || "center" });

  // Event Name
  const eventConf = fields.eventName || { x: 148, y: 120, fontSize: 20, fontStyle: "normal", align: "center" };
  doc.setFont("Helvetica", eventConf.fontStyle || "normal");
  doc.setFontSize(eventConf.fontSize || 20);
  doc.setTextColor(textColor);
  doc.text(cert.eventName, eventConf.x, eventConf.y, { align: eventConf.align || "center" });

  // Date
  const dateConf = fields.date || { x: 80, y: 155, fontSize: 12, fontStyle: "normal", align: "center" };
  doc.setFont("Helvetica", dateConf.fontStyle || "normal");
  doc.setFontSize(dateConf.fontSize || 12);
  doc.setTextColor("#5f5845");
  const dateStr = cert.date ? `Date: ${cert.date}` : "";
  doc.text(dateStr, dateConf.x, dateConf.y, { align: dateConf.align || "center" });

  // Venue
  const venueConf = fields.venue || { x: 148, y: 135, fontSize: 12, fontStyle: "normal", align: "center" };
  doc.setFont("Helvetica", venueConf.fontStyle || "normal");
  doc.setFontSize(venueConf.fontSize || 12);
  doc.setTextColor("#5f5845");
  const venueStr = cert.venue ? `Venue: ${cert.venue}` : "";
  doc.text(venueStr, venueConf.x, venueConf.y, { align: venueConf.align || "center" });

  // Certificate ID
  const idConf = fields.certificateId || { x: 80, y: 170, fontSize: 10, fontStyle: "italic", align: "center" };
  doc.setFont("Helvetica", idConf.fontStyle || "italic");
  doc.setFontSize(idConf.fontSize || 10);
  doc.setTextColor("#8b8b95");
  doc.text(`Certificate ID: ${cert.certificateId}`, idConf.x, idConf.y, { align: idConf.align || "center" });

  // Signature / Organizer
  const sigConf = fields.signature || { x: 165, y: 155, label: "Authorized Signatory", fontSize: 12, fontStyle: "normal", align: "center" };
  doc.setFont("Helvetica", sigConf.fontStyle || "normal");
  doc.setFontSize(sigConf.fontSize || 12);
  doc.setTextColor(textColor);
  // Draw signature label
  doc.text(sigConf.label || "Authorized Signatory", sigConf.x, sigConf.y, { align: sigConf.align || "center" });
  // Draw organizer name above it if defined
  if (cert.organizerName || sigConf.organizerName) {
    doc.setFont("Helvetica", "bold");
    doc.text(cert.organizerName || sigConf.organizerName, sigConf.x, sigConf.y - 8, { align: sigConf.align || "center" });
  }
  // Draw a fine signature line
  doc.setDrawColor("#d0d0d8");
  doc.setLineWidth(0.3);
  doc.line(sigConf.x - 30, sigConf.y - 14, sigConf.x + 30, sigConf.y - 14);

  // 4. Save file
  const filename = `${cert.certificateId}.pdf`;
  const relativePath = `/uploads/certificates/${filename}`;
  const absolutePath = path.join(certificatesDir, filename);

  const pdfBuffer = doc.output("arraybuffer");
  fs.writeFileSync(absolutePath, Buffer.from(pdfBuffer));

  return relativePath;
}

/**
 * Draws an extremely premium default background certificate template
 */
function drawPremiumDefaultBackground(doc, width, height) {
  // A4 dimensions: 297mm x 210mm
  
  // Elegant cream/tan background
  doc.setFillColor("#fffdf4");
  doc.rect(0, 0, width, height, "F");

  // Premium double border (Outer thick gold border)
  doc.setDrawColor("#b58e24"); // Rich bronze-gold
  doc.setLineWidth(2);
  doc.rect(8, 8, width - 16, height - 16, "D");

  // Inner thin border
  doc.setDrawColor("#15130c"); // Black/charcoal
  doc.setLineWidth(0.5);
  doc.rect(11, 11, width - 22, height - 22, "D");

  // Ornamental corner accents (Gold lines in corners)
  const drawCorner = (x, y, dx, dy) => {
    doc.setDrawColor("#b58e24");
    doc.setLineWidth(0.8);
    doc.line(x, y, x + dx, y);
    doc.line(x, y, x, y + dy);
  };
  drawCorner(14, 14, 15, 15);
  drawCorner(width - 14, 14, -15, 15);
  drawCorner(14, height - 14, 15, -15);
  drawCorner(width - 14, height - 14, -15, -15);

  // Branding Top Center
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor("#15130c");
  doc.text("YOUNG MINDS ACADEMY", width / 2, 28, { align: "center" });

  // Small golden divider line
  doc.setDrawColor("#b58e24");
  doc.setLineWidth(0.5);
  doc.line((width / 2) - 30, 33, (width / 2) + 30, 33);

  // Subtitle
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#857a5c");
  doc.text("CERTIFICATE OF PARTICIPATION & ACHIEVEMENT", width / 2, 38, { align: "center" });

  // Main Kicker
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor("#5f5845");
  doc.text("This certificate is proudly presented to", width / 2, 72, { align: "center" });

  // Additional detail
  doc.text("for actively participating and successfully completing all workshop tasks in", width / 2, 110, { align: "center" });

  // Golden Stamp / seal graphic placeholder in bottom center/left
  doc.setFillColor("#fff9df");
  doc.setDrawColor("#b58e24");
  doc.setLineWidth(1.2);
  doc.circle(45, 125, 14, "FD");
  
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor("#9f6b00");
  doc.text("OFFICIAL", 45, 123, { align: "center" });
  doc.text("VERIFIED", 45, 127, { align: "center" });
  doc.text("SEAL", 45, 131, { align: "center" });
}

module.exports = {
  generateQrCodeBase64,
  generateCertificatePdf
};
