/**
 * Branded PDF of a quotation (task B07). Built from the same QuoteDocument as the
 * HTML page, so the two cannot disagree. pdfkit is used as is: no network access,
 * no fonts or images fetched, nothing written to disk.
 */
import PDFDocument from "pdfkit";
import type { QuoteDocument } from "../shared/quoteDocument";

const GROUND = "#0D2D2E";
const ACCENT = "#F58A1F";

export function renderQuotePdf(d: QuoteDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `${d.ref} ${d.title}`.slice(0, 200), Author: "IO SKY", Producer: "IO SKY" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor(GROUND).font("Helvetica-Bold").fontSize(22).text("IO ", { continued: true }).fillColor(ACCENT).text("SKY");
    doc.moveDown(0.6).fillColor(GROUND).font("Helvetica-Bold").fontSize(16).text(d.title);
    doc.font("Helvetica").fontSize(10).fillColor("#555555").text(`Quotation ${d.ref}  |  issued ${d.issuedOn}${d.validUntil ? `  |  valid until ${d.validUntil}` : ""}${d.customer ? `  |  for ${d.customer}` : ""}`);
    doc.moveDown(1);

    const x = { desc: 50, qty: 330, unit: 395, amt: 480 };
    const header = (y: number) => {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(GROUND);
      doc.text("Description", x.desc, y, { width: 270 });
      doc.text("Qty", x.qty, y, { width: 50, align: "right" });
      doc.text("Unit", x.unit, y, { width: 75, align: "right" });
      doc.text("Amount", x.amt, y, { width: 65, align: "right" });
      doc.moveTo(50, y + 15).lineTo(545, y + 15).strokeColor("#d8d4c8").stroke();
      return y + 22;
    };
    let y = header(doc.y);
    doc.font("Helvetica").fontSize(10).fillColor("#222222");
    for (const l of d.lines) {
      const h = doc.heightOfString(l.description, { width: 270 });
      if (y + h > 740) {
        doc.addPage();
        y = header(50);
        doc.font("Helvetica").fontSize(10).fillColor("#222222");
      }
      doc.text(l.description, x.desc, y, { width: 270 });
      doc.text(String(l.quantity), x.qty, y, { width: 50, align: "right" });
      doc.text(l.unit, x.unit, y, { width: 75, align: "right" });
      doc.text(l.total, x.amt, y, { width: 65, align: "right" });
      y += Math.max(h, 12) + 8;
    }
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#d8d4c8").stroke();
    doc.font("Helvetica-Bold").fontSize(12).fillColor(GROUND).text("Total", x.desc, y + 8, { width: 340 });
    doc.text(d.total, x.unit, y + 8, { width: 150, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor("#666666").text(d.footnote, 50, y + 40, { width: 495 });
    doc.end();
  });
}
