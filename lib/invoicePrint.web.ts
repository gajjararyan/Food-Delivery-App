import type { InvoiceData } from './invoice';
import { invoiceHtmlDocument } from './invoice';

export function printInvoice(data: InvoiceData): void {
  const html = invoiceHtmlDocument(data);
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export function downloadInvoice(data: InvoiceData): void {
  const html = invoiceHtmlDocument(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `invoice-${data.invoiceNumber}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
