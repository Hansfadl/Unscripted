import { jsPDF } from 'jspdf';
import { formatDisplayDate, formatRp } from './validation';
import {
  INVOICE_LIFECYCLE_LABELS,
  INVOICE_PAYMENT_STATUS_LABELS,
  type InvoiceRecord,
} from '../types/unscripted';

const INK: [number, number, number] = [23, 23, 23];
const MUTED: [number, number, number] = [105, 102, 96];
const HAIRLINE: [number, number, number] = [214, 210, 202];
const CREAM: [number, number, number] = [245, 241, 233];
const LIME: [number, number, number] = [216, 255, 62];
const CORAL: [number, number, number] = [255, 90, 85];
const EMERALD: [number, number, number] = [22, 163, 74];
const AMBER: [number, number, number] = [180, 83, 9];

function statusColor(status: InvoiceRecord['paymentStatus']): [number, number, number] {
  switch (status) {
    case 'PAID':
      return EMERALD;
    case 'PARTIALLY_PAID':
      return AMBER;
    case 'OVERDUE':
      return CORAL;
    default:
      return INK;
  }
}

export function downloadInvoicePdf(invoice: InvoiceRecord): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 22) {
      doc.addPage();
      y = 20;
    }
  };

  // --- Editorial Top Header ---
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, pageWidth, 42, 'F');

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('UNSCRIPTED', margin, 18);

  // Subtle Electric Lime underline bar under wordmark
  doc.setFillColor(...LIME);
  doc.rect(margin, 20.5, 26, 1.4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...INK);
  doc.text('REAL MOMENTS. NO RETAKES.', margin, 26.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('Wedding Content Creator  ·  Semarang · Salatiga · Boyolali', margin, 31.5);
  doc.text('https://unscripted.id', margin, 35.8);

  // Right-aligned INVOICE Header Block
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('INVOICE', pageWidth - margin, 18, { align: 'right' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text(invoice.invoiceNumber, pageWidth - margin, 25, { align: 'right' });

  const statusText = `${INVOICE_PAYMENT_STATUS_LABELS[invoice.paymentStatus].toUpperCase()}  ·  ${INVOICE_LIFECYCLE_LABELS[invoice.lifecycleStatus].toUpperCase()}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...statusColor(invoice.paymentStatus));
  doc.text(statusText, pageWidth - margin, 31.5, { align: 'right' });

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(0, 42, pageWidth, 42);

  y = 52;

  // --- Dates & Reference Strip ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('ISSUE DATE', margin, y);
  doc.text('DUE DATE', margin + 45, y);
  doc.text('BOOKING REF', margin + 90, y);
  doc.text('DOWN PAYMENT', pageWidth - margin, y, { align: 'right' });

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(formatDisplayDate(invoice.issueDate), margin, y);
  doc.text(formatDisplayDate(invoice.dueDate), margin + 45, y);
  doc.setFont('courier', 'bold');
  doc.text(invoice.bookingCode, margin + 90, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${invoice.dpPercent}% (${formatRp(invoice.downPaymentAmount)})`, pageWidth - margin, y, {
    align: 'right',
  });

  y += 6;
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 9;

  // --- Client & Wedding Info (2 columns) ---
  const colMid = margin + contentWidth * 0.52;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('BILLED TO', margin, y);
  doc.text('WEDDING DETAILS', colMid, y);

  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...INK);
  const clientLines = doc.splitTextToSize(invoice.clientName, contentWidth * 0.46) as string[];
  doc.text(clientLines, margin, y);

  const eventLines = doc.splitTextToSize(
    `${invoice.eventType}  ·  ${formatDisplayDate(invoice.weddingDate)}`,
    contentWidth * 0.46
  ) as string[];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(eventLines, colMid, y);

  const leftAfterNameY = y + clientLines.length * 5;
  const rightAfterEventY = y + eventLines.length * 4.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`WhatsApp: ${invoice.clientWhatsapp}`, margin, leftAfterNameY + 1);
  if (invoice.clientEmail) {
    doc.text(`Email: ${invoice.clientEmail}`, margin, leftAfterNameY + 5.8);
  }

  const locationLines = doc.splitTextToSize(
    `Venue / Area: ${invoice.eventLocation}`,
    contentWidth * 0.46
  ) as string[];
  doc.text(locationLines, colMid, rightAfterEventY + 1);

  const clientBlockBottom = leftAfterNameY + (invoice.clientEmail ? 10 : 5);
  const weddingBlockBottom = rightAfterEventY + locationLines.length * 4.5 + 2;
  y = Math.max(clientBlockBottom, weddingBlockBottom) + 8;

  // --- Itemized Breakdown Table ---
  const colDescX = margin + 3;
  const colQtyX = margin + contentWidth * 0.62;
  const colRateX = margin + contentWidth * 0.78;
  const colAmtX = pageWidth - margin - 3;

  doc.setFillColor(...INK);
  doc.rect(margin, y, contentWidth, 8.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.text('ITEM & DESCRIPTION', colDescX, y + 5.6);
  doc.text('QTY', colQtyX, y + 5.6, { align: 'right' });
  doc.text('RATE', colRateX, y + 5.6, { align: 'right' });
  doc.text('AMOUNT', colAmtX, y + 5.6, { align: 'right' });
  y += 10.5;

  interface TableRow {
    title: string;
    subtitle?: string;
    qty: string;
    rate: string;
    amount: string;
  }

  const rows: TableRow[] = [
    {
      title: `${invoice.packageName} Package`,
      subtitle: `Wedding content creation coverage (${invoice.eventType})`,
      qty: '1',
      rate: formatRp(invoice.packagePrice),
      amount: formatRp(invoice.packagePrice),
    },
    ...(invoice.additionalItems || []).map((item) => ({
      title: item.description,
      subtitle: 'Additional service',
      qty: String(item.quantity),
      rate: formatRp(item.unitPrice),
      amount: formatRp(item.amount),
    })),
  ];

  if (invoice.transportationFee > 0) {
    rows.push({
      title: 'Transportation Fee',
      subtitle: 'Crew travel & logistics adjustment',
      qty: '1',
      rate: formatRp(invoice.transportationFee),
      amount: formatRp(invoice.transportationFee),
    });
  }

  if (invoice.overtimeFee > 0) {
    rows.push({
      title: 'Overtime Fee',
      subtitle: 'Extended event coverage hours',
      qty: '1',
      rate: formatRp(invoice.overtimeFee),
      amount: formatRp(invoice.overtimeFee),
    });
  }

  rows.forEach((row) => {
    const titleLines = doc.splitTextToSize(row.title, contentWidth * 0.5) as string[];
    const rowHeight = Math.max(11, titleLines.length * 4.5 + (row.subtitle ? 5.5 : 2.5));
    ensureSpace(rowHeight + 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(titleLines, colDescX, y + 3.8);

    if (row.subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(...MUTED);
      doc.text(row.subtitle, colDescX, y + 3.8 + titleLines.length * 4.3);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.2);
    doc.setTextColor(...INK);
    doc.text(row.qty, colQtyX, y + 4.2, { align: 'right' });
    doc.text(row.rate, colRateX, y + 4.2, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text(row.amount, colAmtX, y + 4.2, { align: 'right' });

    y += rowHeight;
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.25);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;
  });

  y += 6;
  ensureSpace(68);

  // --- Lower Two-Column Layout: Left (Bank & Instructions) | Right (Totals Summary) ---
  const summaryStartY = y;
  const leftBoxWidth = contentWidth * 0.48;
  const rightBoxX = margin + contentWidth * 0.53;
  const rightBoxWidth = contentWidth * 0.47;

  // Left: Payment Instructions & Bank Account Details
  doc.setFillColor(...CREAM);
  doc.rect(margin, summaryStartY, leftBoxWidth, 46, 'F');
  doc.setDrawColor(...HAIRLINE);
  doc.rect(margin, summaryStartY, leftBoxWidth, 46, 'S');

  let ly = summaryStartY + 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('BANK TRANSFER DETAILS', margin + 4.5, ly);

  ly += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(invoice.bankName || 'Bank Account Not Set', margin + 4.5, ly);

  ly += 4.8;
  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.text(invoice.bankAccountNumber || 'Contact admin for account number', margin + 4.5, ly);

  ly += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Account Holder: ${invoice.bankAccountHolder || 'UNSCRIPTED'}`, margin + 4.5, ly);

  ly += 6;
  const instructionLines = doc
    .splitTextToSize(invoice.paymentInstructions || '', leftBoxWidth - 9)
    .slice(0, 4) as string[];
  doc.setFontSize(7.8);
  doc.text(instructionLines, margin + 4.5, ly);

  // Right: Totals Summary
  let ry = summaryStartY + 4;
  const subtotal =
    invoice.packagePrice +
    invoice.additionalServicesTotal +
    invoice.transportationFee +
    invoice.overtimeFee;

  const drawSummaryLine = (
    label: string,
    value: string,
    options?: { bold?: boolean; color?: [number, number, number] }
  ) => {
    doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    doc.setFontSize(options?.bold ? 9.5 : 8.8);
    doc.setTextColor(...(options?.color || MUTED));
    doc.text(label, rightBoxX, ry);
    doc.setTextColor(...(options?.color || INK));
    doc.setFont('helvetica', 'bold');
    doc.text(value, pageWidth - margin, ry, { align: 'right' });
    ry += 5.8;
  };

  drawSummaryLine('Subtotal', formatRp(subtotal));
  if (invoice.discount > 0) {
    drawSummaryLine('Discount', `- ${formatRp(invoice.discount)}`, { color: CORAL });
  }

  // Grand Total Highlight Box
  doc.setFillColor(...INK);
  doc.rect(rightBoxX - 2, ry - 3.5, rightBoxWidth + 2, 9.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('GRAND TOTAL', rightBoxX + 1.5, ry + 2.7);
  doc.setTextColor(...LIME);
  doc.setFontSize(10.5);
  doc.text(formatRp(invoice.grandTotal), pageWidth - margin - 2, ry + 2.7, { align: 'right' });
  ry += 11.5;

  drawSummaryLine(`Down Payment (${invoice.dpPercent}%)`, formatRp(invoice.downPaymentAmount));
  drawSummaryLine('Amount Paid', formatRp(invoice.amountPaid), {
    color: invoice.amountPaid > 0 ? EMERALD : MUTED,
  });

  doc.setDrawColor(...HAIRLINE);
  doc.line(rightBoxX, ry - 2.5, pageWidth - margin, ry - 2.5);
  ry += 2;
  drawSummaryLine('REMAINING BALANCE', formatRp(invoice.remainingBalance), {
    bold: true,
    color: invoice.remainingBalance > 0 ? INK : EMERALD,
  });

  y = Math.max(summaryStartY + 52, ry + 6);

  // --- Payment Transaction History (if any) ---
  if (invoice.payments && invoice.payments.length > 0) {
    ensureSpace(18 + invoice.payments.length * 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...MUTED);
    doc.text('RECORDED PAYMENTS', margin, y);
    y += 4.5;

    invoice.payments.forEach((pay) => {
      ensureSpace(7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      const label = `${formatDisplayDate(pay.date)}  ·  ${pay.method}${pay.note ? ` (${pay.note})` : ''}`;
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...EMERALD);
      doc.text(formatRp(pay.amount), pageWidth - margin, y, { align: 'right' });
      y += 5.2;
    });
    y += 4;
  }

  // --- Invoice Notes (if any) ---
  if (invoice.notes && invoice.notes.trim().length > 0) {
    const noteLines = doc.splitTextToSize(invoice.notes.trim(), contentWidth) as string[];
    ensureSpace(12 + noteLines.length * 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(...MUTED);
    doc.text('NOTES', margin, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.4 + 6;
  }

  // --- Editorial Thank-You Footer ---
  ensureSpace(22);
  const footerY = Math.max(y + 4, pageHeight - 30);
  doc.setDrawColor(...HAIRLINE);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const tyLines = doc
    .splitTextToSize(
      invoice.thankYouMessage ||
        'Thank you for trusting UNSCRIPTED to document your wedding story.',
      contentWidth
    )
    .slice(0, 3) as string[];
  doc.text(tyLines, margin, footerY + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...MUTED);
  doc.text(
    'UNSCRIPTED WEDDING CONTENT CREATOR  ·  REAL MOMENTS. NO RETAKES.  ·  UNSCRIPTED.ID',
    margin,
    pageHeight - 10
  );

  const safeFilename = `${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`;
  doc.save(safeFilename);
}
