import React from 'react';
import { formatDisplayDate, formatRp } from '../lib/validation';
import {
  INVOICE_LIFECYCLE_LABELS,
  INVOICE_PAYMENT_STATUS_LABELS,
  type InvoiceRecord,
} from '../types/unscripted';

interface InvoicePreviewA4Props {
  invoice: InvoiceRecord;
}

function statusAccent(status: InvoiceRecord['paymentStatus']): string {
  switch (status) {
    case 'PAID':
      return 'text-[#16A34A]';
    case 'PARTIALLY_PAID':
      return 'text-[#D97706]';
    case 'OVERDUE':
      return 'text-[#FF5A55]';
    default:
      return 'text-[#171717]';
  }
}

export function InvoicePreviewA4({ invoice }: InvoicePreviewA4Props) {
  const subtotal =
    invoice.packagePrice +
    invoice.additionalServicesTotal +
    invoice.transportationFee +
    invoice.overtimeFee;

  return (
    <div className="bg-white text-[#171717] border border-[#171717]/15 max-w-[794px] mx-auto shadow-sm print:shadow-none print:border-0">
      {/* Top Editorial Header */}
      <div className="bg-[#F5F1E9] px-7 sm:px-10 py-7 border-b-2 border-[#171717] flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div>
          <p className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
            UNSCRIPTED
          </p>
          <div className="w-14 h-1 bg-[#D8FF3E] mt-1 mb-2.5" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] font-semibold text-[#171717]">
            REAL MOMENTS. NO RETAKES.
          </p>
          <p className="text-xs text-[#171717]/65 mt-1.5">
            Wedding Content Creator · Semarang · Salatiga · Boyolali
          </p>
          <p className="font-mono text-[11px] text-[#171717]/60 mt-0.5">https://unscripted.id</p>
        </div>

        <div className="sm:text-right">
          <p className="font-display text-2xl font-extrabold tracking-tight uppercase">Invoice</p>
          <p className="font-mono text-sm font-bold mt-1 tabular-nums">{invoice.invoiceNumber}</p>
          <p className={`font-mono text-xs uppercase tracking-wider font-semibold mt-2 ${statusAccent(invoice.paymentStatus)}`}>
            {INVOICE_PAYMENT_STATUS_LABELS[invoice.paymentStatus]} ·{' '}
            {INVOICE_LIFECYCLE_LABELS[invoice.lifecycleStatus]}
          </p>
        </div>
      </div>

      {/* Metadata Strip */}
      <div className="px-7 sm:px-10 py-5 border-b border-[#171717]/12 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/55">
            Issue Date
          </p>
          <p className="text-sm font-semibold mt-0.5 tabular-nums">
            {formatDisplayDate(invoice.issueDate)}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/55">
            Due Date
          </p>
          <p className="text-sm font-semibold mt-0.5 tabular-nums">
            {formatDisplayDate(invoice.dueDate)}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/55">
            Booking Ref
          </p>
          <p className="font-mono text-sm font-semibold mt-0.5 tabular-nums">
            {invoice.bookingCode}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/55">
            Down Payment
          </p>
          <p className="text-sm font-semibold mt-0.5 tabular-nums">
            {invoice.dpPercent}% ({formatRp(invoice.downPaymentAmount)})
          </p>
        </div>
      </div>

      {/* Client & Wedding Details */}
      <div className="px-7 sm:px-10 py-6 grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-[#171717]/12">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/55 mb-1.5">
            Billed To
          </p>
          <p className="font-display text-lg font-bold text-[#171717]">{invoice.clientName}</p>
          <p className="text-xs text-[#171717]/70 mt-1 tabular-nums">
            WhatsApp: {invoice.clientWhatsapp}
          </p>
          {invoice.clientEmail && (
            <p className="text-xs text-[#171717]/70 mt-0.5">{invoice.clientEmail}</p>
          )}
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/55 mb-1.5">
            Wedding Details
          </p>
          <p className="text-sm font-bold text-[#171717]">
            {invoice.eventType} · {formatDisplayDate(invoice.weddingDate)}
          </p>
          <p className="text-xs text-[#171717]/70 mt-1 leading-relaxed">
            Venue / Area: {invoice.eventLocation}
          </p>
        </div>
      </div>

      {/* Itemized Services Table */}
      <div className="px-7 sm:px-10 py-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#171717] text-white font-mono text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Item & Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171717]/10 text-sm">
              <tr>
                <td className="py-3.5 px-3">
                  <p className="font-semibold text-[#171717]">{invoice.packageName} Package</p>
                  <p className="text-xs text-[#171717]/60 mt-0.5">
                    Wedding content creation coverage ({invoice.eventType})
                  </p>
                </td>
                <td className="py-3.5 px-3 text-right tabular-nums">1</td>
                <td className="py-3.5 px-3 text-right tabular-nums">
                  {formatRp(invoice.packagePrice)}
                </td>
                <td className="py-3.5 px-3 text-right font-semibold tabular-nums">
                  {formatRp(invoice.packagePrice)}
                </td>
              </tr>

              {(invoice.additionalItems || []).map((item) => (
                <tr key={item.id}>
                  <td className="py-3.5 px-3">
                    <p className="font-semibold text-[#171717]">{item.description}</p>
                    <p className="text-xs text-[#171717]/60 mt-0.5">Additional service</p>
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-3.5 px-3 text-right tabular-nums">
                    {formatRp(item.unitPrice)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-semibold tabular-nums">
                    {formatRp(item.amount)}
                  </td>
                </tr>
              ))}

              {invoice.transportationFee > 0 && (
                <tr>
                  <td className="py-3.5 px-3">
                    <p className="font-semibold text-[#171717]">Transportation Fee</p>
                    <p className="text-xs text-[#171717]/60 mt-0.5">
                      Crew travel & logistics adjustment
                    </p>
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums">1</td>
                  <td className="py-3.5 px-3 text-right tabular-nums">
                    {formatRp(invoice.transportationFee)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-semibold tabular-nums">
                    {formatRp(invoice.transportationFee)}
                  </td>
                </tr>
              )}

              {invoice.overtimeFee > 0 && (
                <tr>
                  <td className="py-3.5 px-3">
                    <p className="font-semibold text-[#171717]">Overtime Fee</p>
                    <p className="text-xs text-[#171717]/60 mt-0.5">Extended coverage hours</p>
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums">1</td>
                  <td className="py-3.5 px-3 text-right tabular-nums">
                    {formatRp(invoice.overtimeFee)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-semibold tabular-nums">
                    {formatRp(invoice.overtimeFee)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Lower Section: Bank Details & Payment Summary */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <div className="bg-[#F5F1E9] border border-[#171717]/12 p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/55">
              Bank Transfer Details
            </p>
            <p className="text-sm font-bold text-[#171717] mt-2">
              {invoice.bankName || 'Bank Account Not Configured'}
            </p>
            <p className="font-mono text-base font-bold text-[#171717] mt-0.5 tabular-nums">
              {invoice.bankAccountNumber || 'Configure in Invoice Settings'}
            </p>
            <p className="text-xs text-[#171717]/70 mt-0.5">
              Account Holder: {invoice.bankAccountHolder || 'UNSCRIPTED STUDIO'}
            </p>
            {invoice.paymentInstructions && (
              <p className="text-xs text-[#171717]/70 mt-3 pt-3 border-t border-[#171717]/10 leading-relaxed whitespace-pre-line">
                {invoice.paymentInstructions}
              </p>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm text-[#171717]/70">
              <span>Subtotal</span>
              <span className="font-semibold text-[#171717] tabular-nums">
                {formatRp(subtotal)}
              </span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex items-center justify-between text-sm text-[#FF5A55]">
                <span>Discount</span>
                <span className="font-semibold tabular-nums">- {formatRp(invoice.discount)}</span>
              </div>
            )}

            <div className="bg-[#171717] text-white px-4 py-3 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">
                Grand Total
              </span>
              <span className="font-display text-lg font-extrabold text-[#D8FF3E] tabular-nums">
                {formatRp(invoice.grandTotal)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm text-[#171717]/70 pt-1">
              <span>Down Payment ({invoice.dpPercent}%)</span>
              <span className="font-semibold text-[#171717] tabular-nums">
                {formatRp(invoice.downPaymentAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm text-[#171717]/70">
              <span>Amount Paid</span>
              <span
                className={`font-semibold tabular-nums ${
                  invoice.amountPaid > 0 ? 'text-[#16A34A]' : 'text-[#171717]/60'
                }`}
              >
                {formatRp(invoice.amountPaid)}
              </span>
            </div>

            <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-[#171717]/15">
              <span>Remaining Balance</span>
              <span
                className={`tabular-nums ${
                  invoice.remainingBalance === 0 ? 'text-[#16A34A]' : 'text-[#171717]'
                }`}
              >
                {formatRp(invoice.remainingBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Recorded Payment Transactions */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="mt-7 pt-5 border-t border-[#171717]/12">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/55 mb-2.5">
              Recorded Payment History
            </p>
            <div className="space-y-1.5">
              {invoice.payments.map((pay) => (
                <div
                  key={pay.id}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-[#171717]/8 last:border-b-0"
                >
                  <span className="text-[#171717]/80">
                    {formatDisplayDate(pay.date)} · <span className="font-medium">{pay.method}</span>
                    {pay.note ? ` (${pay.note})` : ''}
                  </span>
                  <span className="font-semibold text-[#16A34A] tabular-nums">
                    {formatRp(pay.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && invoice.notes.trim().length > 0 && (
          <div className="mt-6 pt-5 border-t border-[#171717]/12">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#171717]/55 mb-1.5">
              Notes
            </p>
            <p className="text-xs text-[#171717]/80 leading-relaxed whitespace-pre-line">
              {invoice.notes}
            </p>
          </div>
        )}
      </div>

      {/* Editorial Footer */}
      <div className="px-7 sm:px-10 py-6 bg-[#FAF8F4] border-t border-[#171717]/12">
        <p className="font-serif-accent italic text-sm text-[#171717]/85">
          {invoice.thankYouMessage ||
            'Thank you for trusting UNSCRIPTED to document your wedding story.'}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#171717]/45 mt-3">
          UNSCRIPTED WEDDING CONTENT CREATOR · REAL MOMENTS. NO RETAKES. · UNSCRIPTED.ID
        </p>
      </div>
    </div>
  );
}
