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

  // Check if we should render our premium, infinitely sharp custom vector template layout
  const bgUrl = template ? template.backgroundUrl : "";
  if (bgUrl && bgUrl.includes("certificate-template.jpg")) {
    await drawPremiumVectorCertificate(doc, cert, template, verifyUrl);
    
    // Save file
    const filename = `${cert.certificateId}.pdf`;
    const relativePath = `/uploads/certificates/${filename}`;
    const absolutePath = path.join(certificatesDir, filename);

    const pdfBuffer = doc.output("arraybuffer");
    const buffer = Buffer.from(pdfBuffer);
    fs.writeFileSync(absolutePath, buffer);

    return { relativePath, base64Data: buffer.toString("base64") };
  }

  // 1. Draw Background
  let bgLoaded = false;

  if (bgUrl) {
    try {
      if (bgUrl.includes("base64,")) {
        const parts = bgUrl.split(",");
        const mime = parts[0].match(/:(.*?);/)[1];
        const format = mime.includes("png") ? "PNG" : "JPEG";
        const base64Data = parts[1];
        doc.addImage(base64Data, format, 0, 0, pageWidth, pageHeight, undefined, "NONE");
        bgLoaded = true;
      } else {
        // Resolve local relative paths (e.g. /assets/certificate-template.jpg)
        let cleanPath = bgUrl;
        if (cleanPath.startsWith("/")) {
          cleanPath = cleanPath.slice(1);
        }
        const localPath = path.join(rootDir, cleanPath);
        if (fs.existsSync(localPath)) {
          const imgData = fs.readFileSync(localPath);
          const ext = path.extname(localPath).toLowerCase();
          const format = ext.includes("png") ? "PNG" : "JPEG";
          doc.addImage(imgData.toString("base64"), format, 0, 0, pageWidth, pageHeight, undefined, "NONE");
          bgLoaded = true;
        }
      }
    } catch (err) {
      console.error("Failed to load template background image:", err.message);
    }
  }

  if (!bgLoaded) {
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
  if (!template || !template.backgroundUrl) {
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor("#8b8b95");
    doc.text("Scan to Verify", qrConfig.x + (qrConfig.width / 2), qrConfig.y + qrConfig.height + 4, { align: "center" });
  }

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

  // Mask out the pre-printed "WORKSHOP NAME" text from the custom template background image
  if (template && template.backgroundUrl && template.backgroundUrl.includes("certificate-template.jpg")) {
    doc.setFillColor("#f6f3eb");
    doc.rect(122, 135.5, 53, 5, "F");
  }

  doc.text(cert.eventName, eventConf.x, eventConf.y, { align: eventConf.align || "center" });

  // Date
  const dateConf = fields.date || { x: 80, y: 155, fontSize: 12, fontStyle: "normal", align: "center" };
  doc.setFont("Helvetica", dateConf.fontStyle || "normal");
  doc.setFontSize(dateConf.fontSize || 12);
  doc.setTextColor("#5f5845");
  const dateStr = template && template.backgroundUrl ? (cert.date || "") : (cert.date ? `Date: ${cert.date}` : "");
  doc.text(dateStr, dateConf.x, dateConf.y, { align: dateConf.align || "center" });

  // Venue
  const venueConf = fields.venue || { x: 148, y: 135, fontSize: 12, fontStyle: "normal", align: "center" };
  doc.setFont("Helvetica", venueConf.fontStyle || "normal");
  doc.setFontSize(venueConf.fontSize || 12);
  doc.setTextColor("#5f5845");
  const venueStr = template && template.backgroundUrl ? (cert.venue || "") : (cert.venue ? `Venue: ${cert.venue}` : "");
  if (venueStr) {
    doc.text(venueStr, venueConf.x, venueConf.y, { align: venueConf.align || "center" });
  }

  // Certificate ID
  const idConf = fields.certificateId || { x: 80, y: 170, fontSize: 10, fontStyle: "italic", align: "center" };
  doc.setFont("Helvetica", idConf.fontStyle || "italic");
  doc.setFontSize(idConf.fontSize || 10);
  doc.setTextColor("#8b8b95");
  const idStr = template && template.backgroundUrl ? cert.certificateId : `Certificate ID: ${cert.certificateId}`;
  doc.text(idStr, idConf.x, idConf.y, { align: idConf.align || "center" });

  // Signature / Organizer
  const sigConf = fields.signature || { x: 165, y: 155, label: "Authorized Signatory", fontSize: 12, fontStyle: "normal", align: "center" };
  doc.setFont("Helvetica", sigConf.fontStyle || "normal");
  doc.setFontSize(sigConf.fontSize || 12);
  doc.setTextColor(textColor);
  // Draw signature label (only if default fallback background is active)
  if (!template || !template.backgroundUrl) {
    doc.text(sigConf.label || "Authorized Signatory", sigConf.x, sigConf.y, { align: sigConf.align || "center" });
  }
  // Draw organizer name above signature line (only on dynamic fallback template, since custom templates have pre-baked signatures)
  if (!template || !template.backgroundUrl) {
    if (cert.organizerName || sigConf.organizerName) {
      doc.setFont("Helvetica", "bold");
      doc.text(cert.organizerName || sigConf.organizerName, sigConf.x, sigConf.y - 8, { align: sigConf.align || "center" });
    }
  }
  // Draw a fine signature line only if using fallback default background
  if (!template || !template.backgroundUrl) {
    doc.setDrawColor("#d0d0d8");
    doc.setLineWidth(0.3);
    doc.line(sigConf.x - 30, sigConf.y - 14, sigConf.x + 30, sigConf.y - 14);
  }

  // 4. Save file
  const filename = `${cert.certificateId}.pdf`;
  const relativePath = `/uploads/certificates/${filename}`;
  const absolutePath = path.join(certificatesDir, filename);

  const pdfBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(pdfBuffer);
  fs.writeFileSync(absolutePath, buffer);

  return { relativePath, base64Data: buffer.toString("base64") };
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

/**
 * Renders the absolute premium vector certificate layout dynamically from scratch
 */
async function drawPremiumVectorCertificate(doc, cert, template, verifyUrl) {
  const W = 297;
  const H = 210;

  // 1. Premium soft warm Ivory background color
  doc.setFillColor("#fffcf5");
  doc.rect(0, 0, W, H, "F");

  // 2. Overlapping Modern Gold and Charcoal Geometric Corners
  
  // Top-Left Corner
  doc.setFillColor("#a57c1e");
  doc.triangle(0, 0, 65, 0, 0, 65, "F");
  doc.setFillColor("#15130c");
  doc.triangle(0, 0, 52, 0, 0, 52, "F");
  doc.setDrawColor("#a57c1e");
  doc.setLineWidth(1.2);
  doc.line(52, 0, 0, 52);

  // Bottom-Right Corner
  doc.setFillColor("#a57c1e");
  doc.triangle(W, H, W - 65, H, W, H - 65, "F");
  doc.setFillColor("#15130c");
  doc.triangle(W, H, W - 52, H, W, H - 52, "F");
  doc.setDrawColor("#a57c1e");
  doc.setLineWidth(1.2);
  doc.line(W - 52, H, W, H - 52);

  // Bottom-Left Corner
  doc.setFillColor("#a57c1e");
  doc.triangle(0, H, 35, H, 0, H - 35, "F");
  doc.setFillColor("#15130c");
  doc.triangle(0, H, 28, H, 0, H - 28, "F");

  // Top-Right Corner
  doc.setFillColor("#a57c1e");
  doc.triangle(W, 0, W - 35, 0, W, 35, "F");
  doc.setFillColor("#15130c");
  doc.triangle(W, 0, W - 28, 0, W, 28, "F");

  // 3. Crisp Symmetrical Borders
  // Gold thin outer border
  doc.setDrawColor("#a57c1e");
  doc.setLineWidth(0.5);
  doc.rect(8, 8, W - 16, H - 16, "D");

  // Charcoal thicker inner border
  doc.setDrawColor("#15130c");
  doc.setLineWidth(1.2);
  doc.rect(10, 10, W - 20, H - 20, "D");

  // 4. Official Brand Logo
  const logoPath = path.join(rootDir, "assets", "logo.png");
  if (fs.existsSync(logoPath)) {
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      doc.addImage(logoBuffer.toString("base64"), "PNG", 140.5, 16, 16, 16, undefined, "NONE");
    } catch (err) {
      console.error("Failed to load logo image:", err.message);
    }
  }

  // 5. Dynamic High-Resolution Typography Layout
  
  // Brand Header
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor("#a57c1e");
  doc.text("YOUNGMINDS AGENCY", 148.5, 38, { align: "center" });

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#8b8b95");
  doc.text("CREATIVE MINDS. REAL IMPACT.", 148.5, 42, { align: "center" });

  // Main Titles
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor("#15130c");
  doc.text("CERTIFICATE", 148.5, 56, { align: "center" });

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor("#a57c1e");
  doc.text("OF PARTICIPATION", 148.5, 63, { align: "center" });

  // Gold Diamond Divider
  doc.setDrawColor("#a57c1e");
  doc.setLineWidth(0.3);
  doc.line(90, 68, 138, 68);
  doc.line(159, 68, 207, 68);
  
  doc.setFillColor("#a57c1e");
  doc.triangle(148.5, 66.5, 146.5, 68, 150.5, 68, "F");
  doc.triangle(148.5, 69.5, 146.5, 68, 150.5, 68, "F");

  // Recipient Block
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#8b8b95");
  doc.text("THIS IS TO CERTIFY THAT", 148.5, 78, { align: "center" });

  // Recipient Name
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor("#15130c");
  doc.text(cert.studentName || "", 148.5, 92, { align: "center" });

  // Underline
  doc.setDrawColor("#a57c1e");
  doc.setLineWidth(0.25);
  doc.line(100, 97, 197, 97);

  // Body Paragraph
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor("#4b4b55");
  doc.text("has successfully participated in the", 148.5, 105, { align: "center" });

  // Event Name
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor("#a57c1e");
  doc.text(`"${cert.eventName || ""}"`, 148.5, 116, { align: "center" });

  // Details
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor("#4b4b55");
  doc.text("conducted by YoungMinds Agency,", 148.5, 125, { align: "center" });
  doc.text("focused on practical skills and real-world learning.", 148.5, 131, { align: "center" });
  doc.text("We appreciate your enthusiasm and commitment to growth.", 148.5, 137, { align: "center" });

  // Venue
  if (cert.venue) {
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor("#15130c");
    doc.text(`Venue: ${cert.venue}`, 148.5, 147, { align: "center" });
  }

  // 6. Signature Symmetrical Footer Layout (Left Date, Center Sign, Right ID, QR Code & Seal)
  const lineY = 176;

  // Left Block: Certificate ID
  doc.setDrawColor("#a57c1e");
  doc.setLineWidth(0.3);
  doc.line(30, lineY, 75, lineY);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#15130c");
  doc.text(cert.certificateId || "", 52.5, lineY - 3, { align: "center" });

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor("#a57c1e");
  doc.text("CERTIFICATE ID", 52.5, lineY + 5, { align: "center" });

  // Center Block: Authorized Signature
  doc.setDrawColor("#a57c1e");
  doc.setLineWidth(0.3);
  doc.line(126, lineY, 171, lineY);

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor("#15130c");
  doc.text("Kishore", 148.5, lineY - 3, { align: "center" });

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor("#a57c1e");
  doc.text("AUTHORIZED SIGNATURE", 148.5, lineY + 5, { align: "center" });

  // Right Block: Date
  doc.setDrawColor("#a57c1e");
  doc.setLineWidth(0.3);
  doc.line(222, lineY, 267, lineY);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#15130c");
  doc.text(cert.date || "", 244.5, lineY - 3, { align: "center" });

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor("#a57c1e");
  doc.text("DATE", 244.5, lineY + 5, { align: "center" });

  // 7. Dynamic High-Resolution QR Code (placed symmetrically between Center and Right)
  const qrX = 190;
  const qrY = 154;
  const qrSize = 19;
  
  const qrBase64 = await generateQrCodeBase64(verifyUrl);
  doc.addImage(qrBase64, "PNG", qrX, qrY, qrSize, qrSize, undefined, "NONE");

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor("#a57c1e");
  doc.text("SCAN TO VERIFY", qrX + (qrSize / 2), qrY + qrSize + 4, { align: "center" });

  // 8. Premium Triple-Ring Wax Seal (placed symmetrically between Left and Center)
  const sealX = 99;
  const sealY = 171;
  
  // Seal Ribbons
  doc.setFillColor("#a57c1e");
  doc.triangle(sealX - 4, sealY + 8, sealX - 8, sealY + 22, sealX, sealY + 20, "F");
  doc.triangle(sealX + 4, sealY + 8, sealX + 8, sealY + 22, sealX, sealY + 20, "F");

  // Triple Ring
  doc.setFillColor("#a57c1e");
  doc.circle(sealX, sealY, 10, "F");
  doc.setFillColor("#15130c");
  doc.circle(sealX, sealY, 8.8, "F");
  doc.setFillColor("#a57c1e");
  doc.circle(sealX, sealY, 8.2, "F");

  // YA Seal Monogram
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor("#15130c");
  doc.text("YA", sealX, sealY + 2.5, { align: "center" });
}

module.exports = {
  generateQrCodeBase64,
  generateCertificatePdf
};
