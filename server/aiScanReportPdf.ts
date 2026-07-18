/**
 * IO SKY — AI Scan executive report → PDF.
 *
 * Renders an `AiScanReportPayload` into a branded, multi-page PDF using
 * pdfkit (pure-JS, no headless browser required — safe for the deployed
 * server runtime). The output is returned as a Buffer so the caller can
 * upload it to storage and hand back a signed URL.
 *
 * Design language mirrors the site: deep navy background, ivory text,
 * orange accent (#FF6A00). We keep claims neutral and attach the same
 * disclaimers the UI shows so the document never overpromises.
 */

import PDFDocument from "pdfkit";
import {
  AI_SCAN_DIMENSION_LABELS,
  AI_SCAN_DIMENSION_DESCRIPTIONS,
  type AiScanReportPayload,
  type AiScanGrade,
} from "../shared/aiScanModel";

// Brand palette
const NAVY = "#0B1020";
const PANEL = "#1A2333";
const IVORY = "#E6EAF0";
const MUTED = "#8B93A7";
const ORANGE = "#FF6A00";
const ORANGE_SOFT = "#FFB347";

const GRADE_LABEL: Record<AiScanGrade, string> = {
  critical: "Critical",
  developing: "Developing",
  established: "Established",
  mature: "Mature",
  leading: "Leading",
};

const IMPACT_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  transformational: "Transformational",
};

const HORIZON_LABEL: Record<string, string> = {
  "0-30d": "0–30 days",
  "30-90d": "30–90 days",
  "90-180d": "90–180 days",
  "180d+": "180 days+",
};

export interface AiScanPdfMeta {
  company: string;
  tier: "free" | "growth" | "elite";
  publicRef: string;
  createdAt: number;
}

const PAGE_MARGIN = 54;

/** Render the report to a PDF Buffer. */
export function renderAiScanReportPdf(
  report: AiScanReportPayload,
  meta: AiScanPdfMeta,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: PAGE_MARGIN,
        info: {
          Title: `IO SKY AI Scan Report — ${meta.company}`,
          Author: "IO SKY",
          Subject: "Operational Intelligence AI Scan",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - PAGE_MARGIN * 2;

      const paintBackground = () => {
        doc.save();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(NAVY);
        doc.restore();
      };

      // Background applies to the first page and every subsequent one.
      paintBackground();
      doc.on("pageAdded", paintBackground);

      // ─── Cover band ──────────────────────────────────────────────────────
      doc.fillColor(MUTED).font("Helvetica").fontSize(10);
      doc.text("IO SKY · OPERATIONAL INTELLIGENCE", { characterSpacing: 2 });
      doc.moveDown(0.4);

      doc.fillColor(IVORY).font("Helvetica-Bold").fontSize(26);
      doc.text("AI Operational Scan", { lineGap: 2 });
      doc.fillColor(ORANGE).fontSize(26).text("Executive Report");

      doc.moveDown(0.8);
      doc.font("Helvetica").fontSize(11).fillColor(MUTED);
      const created = new Date(meta.createdAt);
      doc.text(`Prepared for: `, { continued: true })
        .fillColor(IVORY)
        .text(meta.company);
      doc.fillColor(MUTED).text(`Tier: `, { continued: true })
        .fillColor(IVORY)
        .text(meta.tier.toUpperCase());
      doc.fillColor(MUTED).text(`Reference: `, { continued: true })
        .fillColor(ORANGE_SOFT)
        .text(meta.publicRef);
      doc.fillColor(MUTED).text(
        `Generated: ${created.toLocaleDateString("en-GB", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`,
      );

      // ─── Overall score panel ─────────────────────────────────────────────
      doc.moveDown(1.2);
      const panelTop = doc.y;
      const panelH = 96;
      doc.save();
      doc.roundedRect(PAGE_MARGIN, panelTop, contentWidth, panelH, 10)
        .fill(PANEL);
      doc.restore();

      doc.fillColor(MUTED).font("Helvetica").fontSize(9);
      doc.text("OVERALL OPERATIONAL SCORE", PAGE_MARGIN + 22, panelTop + 18, {
        characterSpacing: 1.5,
      });
      doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(46);
      doc.text(`${Math.round(report.overallScore)}`, PAGE_MARGIN + 20, panelTop + 32);
      doc.fontSize(14).fillColor(IVORY);
      doc.text(
        `/ 100 · ${GRADE_LABEL[report.overallGrade]}`,
        PAGE_MARGIN + 110,
        panelTop + 56,
      );
      doc.y = panelTop + panelH + 18;

      // ─── Executive summary ───────────────────────────────────────────────
      sectionHeading(doc, "Executive summary");
      doc.font("Helvetica").fontSize(11).fillColor(IVORY).text(
        report.executiveSummary,
        PAGE_MARGIN,
        doc.y,
        { width: contentWidth, lineGap: 3, align: "left" },
      );
      doc.moveDown(0.8);

      // ─── Dimension scores ────────────────────────────────────────────────
      sectionHeading(doc, "Dimension breakdown");
      for (const dim of report.dimensions) {
        ensureSpace(doc, 64);
        const label = AI_SCAN_DIMENSION_LABELS[dim.dimension] ?? dim.dimension;
        const desc = AI_SCAN_DIMENSION_DESCRIPTIONS[dim.dimension] ?? "";
        const rowTop = doc.y;

        doc.font("Helvetica-Bold").fontSize(11).fillColor(IVORY);
        doc.text(label, PAGE_MARGIN, rowTop, { width: contentWidth - 90 });
        doc.font("Helvetica-Bold").fontSize(11).fillColor(ORANGE);
        doc.text(
          `${Math.round(dim.score)} · ${GRADE_LABEL[dim.grade]}`,
          PAGE_MARGIN,
          rowTop,
          { width: contentWidth, align: "right" },
        );

        // progress bar
        const barY = doc.y + 2;
        const barW = contentWidth;
        doc.save();
        doc.roundedRect(PAGE_MARGIN, barY, barW, 6, 3).fill("#283349");
        const fillW = Math.max(4, (Math.min(100, dim.score) / 100) * barW);
        doc.roundedRect(PAGE_MARGIN, barY, fillW, 6, 3).fill(ORANGE);
        doc.restore();
        doc.y = barY + 12;

        if (desc) {
          doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
          doc.text(desc, PAGE_MARGIN, doc.y, { width: contentWidth, lineGap: 1 });
        }
        if (dim.rationale) {
          doc.font("Helvetica-Oblique").fontSize(9).fillColor(IVORY);
          doc.text(dim.rationale, PAGE_MARGIN, doc.y + 2, {
            width: contentWidth,
            lineGap: 1,
          });
        }
        doc.moveDown(0.6);
      }

      // ─── Opportunities ───────────────────────────────────────────────────
      if (report.opportunities.length) {
        ensureSpace(doc, 80);
        sectionHeading(doc, "Detected opportunities");
        report.opportunities.forEach((op, i) => {
          ensureSpace(doc, 58);
          doc.font("Helvetica-Bold").fontSize(10.5).fillColor(IVORY);
          doc.text(`${i + 1}. ${op.title}`, PAGE_MARGIN, doc.y, {
            width: contentWidth,
          });
          doc.font("Helvetica").fontSize(8.5).fillColor(ORANGE_SOFT);
          doc.text(
            `Impact: ${IMPACT_LABEL[op.impact] ?? op.impact}  ·  Effort: ${IMPACT_LABEL[op.effort] ?? op.effort}  ·  Horizon: ${HORIZON_LABEL[op.horizon] ?? op.horizon}  ·  ${AI_SCAN_DIMENSION_LABELS[op.category] ?? op.category}`,
            PAGE_MARGIN,
            doc.y + 1,
            { width: contentWidth },
          );
          doc.font("Helvetica").fontSize(9.5).fillColor(MUTED);
          doc.text(op.summary, PAGE_MARGIN, doc.y + 2, {
            width: contentWidth,
            lineGap: 2,
          });
          doc.moveDown(0.6);
        });
      }

      // ─── Roadmap ─────────────────────────────────────────────────────────
      if (report.roadmap.length) {
        ensureSpace(doc, 80);
        sectionHeading(doc, "Operational roadmap");
        for (const phase of report.roadmap) {
          if (!phase.items.length) continue;
          ensureSpace(doc, 40);
          doc.font("Helvetica-Bold").fontSize(10).fillColor(ORANGE);
          doc.text(HORIZON_LABEL[phase.horizon] ?? phase.horizon, PAGE_MARGIN, doc.y);
          doc.font("Helvetica").fontSize(9.5).fillColor(IVORY);
          for (const item of phase.items) {
            ensureSpace(doc, 16);
            doc.text(`•  ${item}`, PAGE_MARGIN + 10, doc.y, {
              width: contentWidth - 10,
              lineGap: 2,
            });
          }
          doc.moveDown(0.5);
        }
      }

      // ─── Disclaimers ─────────────────────────────────────────────────────
      if (report.disclaimers.length) {
        ensureSpace(doc, 70);
        sectionHeading(doc, "Important notes");
        doc.font("Helvetica").fontSize(8).fillColor(MUTED);
        for (const d of report.disclaimers) {
          ensureSpace(doc, 24);
          doc.text(`•  ${d}`, PAGE_MARGIN, doc.y, {
            width: contentWidth,
            lineGap: 1.5,
          });
          doc.moveDown(0.2);
        }
      }

      // Footer line on the last page
      doc.moveDown(1);
      doc.font("Helvetica").fontSize(8).fillColor(MUTED);
      doc.text(
        "IO SKY · Rotterdam, Netherlands · iosky.com — This report is generated from self-reported inputs and AI analysis for guidance only.",
        PAGE_MARGIN,
        doc.y,
        { width: contentWidth, align: "center" },
      );

      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
}

function sectionHeading(doc: PDFKit.PDFDocument, label: string) {
  doc.moveDown(0.4);
  ensureSpace(doc, 36);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(IVORY);
  doc.text(label, PAGE_MARGIN, doc.y);
  const lineY = doc.y + 3;
  doc.save();
  doc.rect(PAGE_MARGIN, lineY, 44, 2).fill(ORANGE);
  doc.restore();
  doc.y = lineY + 10;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - PAGE_MARGIN;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}
