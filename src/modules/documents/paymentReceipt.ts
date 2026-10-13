import PDFDocument from "pdfkit";

export type PaymentReceiptInput = {
  orderId: string;
  transactionReference?: string;
  customerName: string;
  customerEmail: string;
  registration: string;
  vehicle: string;
  startAt: Date;
  endAt: Date;
  amount: number;
  currency: string;
  paidAt: Date;
};

/**
 * This is deliberately a payment receipt, not an insurance certificate. Legal
 * policy/certificate generation must remain disabled until written issuer and
 * underwriter authority is confirmed for the Tempify self-service channel.
 */
export async function generatePaymentReceipt(input: PaymentReceiptInput) {
  const document = new PDFDocument({
    size: "A4",
    margin: 52,
    info: {
      Title: `Tempify payment receipt ${input.orderId}`,
      Author: "Tempify",
      Subject: "Payment receipt — not proof of insurance",
    },
  });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  document
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#f35a09")
    .text("TEMPIFY", { characterSpacing: 2 });
  document.moveDown(0.7);
  document.fontSize(25).fillColor("#152033").text("Payment receipt");
  document.moveDown(0.6);
  document
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#b42318")
    .text("NOT PROOF OF INSURANCE — NO POLICY CERTIFICATE IS ISSUED BY THIS RECEIPT", {
      align: "left",
    });
  document.moveDown(1.4);

  const money = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: input.currency,
  }).format(input.amount);
  const dateTime = (value: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    }).format(value);

  const rows: Array<[string, string]> = [
    ["Receipt / order", input.orderId],
    ["Transaction reference", input.transactionReference || "Not provided"],
    ["Paid at", dateTime(input.paidAt)],
    ["Customer", input.customerName],
    ["Customer email", input.customerEmail],
    ["Vehicle", `${input.registration} · ${input.vehicle}`],
    ["Requested start", dateTime(input.startAt)],
    ["Requested end", dateTime(input.endAt)],
    ["Amount received", money],
  ];

  for (const [label, value] of rows) {
    const y = document.y;
    document.font("Helvetica-Bold").fontSize(10).fillColor("#667085").text(label, 52, y, { width: 155 });
    document.font("Helvetica").fontSize(10).fillColor("#152033").text(value, 215, y, { width: 325 });
    document.moveDown(0.85);
    document.moveTo(52, document.y).lineTo(543, document.y).strokeColor("#eaecf0").stroke();
    document.moveDown(0.55);
  }

  document.moveDown(1);
  document
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor("#667085")
    .text(
      "This document confirms receipt of payment only. It does not confirm that insurance cover exists and must not be presented as a certificate of motor insurance. Any authorised policy documentation must be issued separately by the approved insurer or underwriter.",
      { lineGap: 3 },
    );

  document.end();
  return completed;
}
