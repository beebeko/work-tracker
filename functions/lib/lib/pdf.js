"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPdf = buildPdf;
const pdf_lib_1 = require("pdf-lib");
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 56;
const COL_DESC = MARGIN;
const COL_HOURS = 360;
const COL_RATE = 420;
const COL_AMOUNT = 490;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;
function fmt(n) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function drawText(page, text, x, y, font, size, color = (0, pdf_lib_1.rgb)(0, 0, 0)) {
    page.drawText(text, { x, y, font, size, color });
}
function drawHRule(page, y, color = (0, pdf_lib_1.rgb)(0.8, 0.8, 0.8)) {
    page.drawLine({
        start: { x: MARGIN, y },
        end: { x: RIGHT_EDGE, y },
        thickness: 0.5,
        color,
    });
}
async function buildPdf(data) {
    const pdfDoc = await pdf_lib_1.PDFDocument.create();
    const regular = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;
    // ── Header ────────────────────────────────────────────────────────────────
    drawText(page, data.senderName, MARGIN, y, bold, 16);
    y -= 18;
    if (data.senderEmail) {
        drawText(page, data.senderEmail, MARGIN, y, regular, 9);
        y -= 13;
    }
    if (data.senderAddress) {
        drawText(page, data.senderAddress, MARGIN, y, regular, 9);
        y -= 13;
    }
    if (data.senderPhone) {
        drawText(page, data.senderPhone, MARGIN, y, regular, 9);
        y -= 13;
    }
    // INVOICE title (right-aligned)
    const titleText = 'INVOICE';
    const titleWidth = bold.widthOfTextAtSize(titleText, 28);
    drawText(page, titleText, RIGHT_EDGE - titleWidth, PAGE_HEIGHT - MARGIN - 2, bold, 28, (0, pdf_lib_1.rgb)(0.2, 0.2, 0.2));
    y -= 10;
    drawHRule(page, y);
    y -= 20;
    // ── Invoice meta + Bill To ────────────────────────────────────────────────
    const metaX = 380;
    // Bill To (left column)
    drawText(page, 'BILL TO', MARGIN, y, bold, 8, (0, pdf_lib_1.rgb)(0.5, 0.5, 0.5));
    drawText(page, 'DETAILS', metaX, y, bold, 8, (0, pdf_lib_1.rgb)(0.5, 0.5, 0.5));
    y -= 14;
    drawText(page, data.clientName, MARGIN, y, bold, 10);
    drawText(page, `Invoice #:`, metaX, y, regular, 9);
    drawText(page, data.invoiceNumber, metaX + 65, y, bold, 9);
    y -= 13;
    if (data.clientEmail) {
        drawText(page, data.clientEmail, MARGIN, y, regular, 9);
    }
    drawText(page, 'Issue date:', metaX, y, regular, 9);
    drawText(page, data.issueDate, metaX + 65, y, regular, 9);
    y -= 13;
    if (data.clientAddress) {
        drawText(page, data.clientAddress, MARGIN, y, regular, 9);
    }
    if (data.dueDate) {
        drawText(page, 'Due date:', metaX, y, regular, 9);
        drawText(page, data.dueDate, metaX + 65, y, regular, 9);
    }
    y -= 13;
    drawText(page, `Project: ${data.gigName}`, MARGIN, y, regular, 9);
    y -= 20;
    // ── Line items table ───────────────────────────────────────────────────────
    drawHRule(page, y);
    y -= 14;
    // Column headers
    drawText(page, 'DESCRIPTION', COL_DESC, y, bold, 8, (0, pdf_lib_1.rgb)(0.5, 0.5, 0.5));
    drawText(page, 'HRS', COL_HOURS, y, bold, 8, (0, pdf_lib_1.rgb)(0.5, 0.5, 0.5));
    drawText(page, 'RATE', COL_RATE, y, bold, 8, (0, pdf_lib_1.rgb)(0.5, 0.5, 0.5));
    drawText(page, 'AMOUNT', COL_AMOUNT, y, bold, 8, (0, pdf_lib_1.rgb)(0.5, 0.5, 0.5));
    y -= 6;
    drawHRule(page, y);
    y -= 14;
    for (const item of data.lineItems) {
        drawText(page, item.description, COL_DESC, y, regular, 9);
        if (item.hours != null)
            drawText(page, fmt(item.hours), COL_HOURS, y, regular, 9);
        if (item.rate != null)
            drawText(page, `$${fmt(item.rate)}`, COL_RATE, y, regular, 9);
        drawText(page, `$${fmt(item.amount)}`, COL_AMOUNT, y, regular, 9);
        y -= 14;
        // Page overflow guard (simple — doesn't handle multi-page invoices)
        if (y < 100)
            break;
    }
    drawHRule(page, y);
    y -= 16;
    // ── Totals ────────────────────────────────────────────────────────────────
    drawText(page, 'Subtotal', COL_RATE, y, regular, 9);
    drawText(page, `$${fmt(data.subtotal)}`, COL_AMOUNT, y, regular, 9);
    y -= 14;
    drawText(page, 'TOTAL', COL_RATE, y, bold, 10);
    drawText(page, `$${fmt(data.totalAmount)}`, COL_AMOUNT, y, bold, 10);
    y -= 20;
    // ── Notes ─────────────────────────────────────────────────────────────────
    if (data.notes) {
        y -= 10;
        drawHRule(page, y);
        y -= 16;
        drawText(page, 'Notes', MARGIN, y, bold, 9);
        y -= 13;
        drawText(page, data.notes, MARGIN, y, regular, 9);
    }
    return pdfDoc.save();
}
