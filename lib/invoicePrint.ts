import { Platform, Alert } from 'react-native';
import type { InvoiceData } from './invoice';

/** Native stub — use web implementation on web builds. */
export function printInvoice(data: InvoiceData): void {
  if (Platform.OS === 'web') return;
  Alert.alert('Print', `Invoice ${data.invoiceNumber} — open this order on web to print.`);
}

export function downloadInvoice(data: InvoiceData): void {
  if (Platform.OS === 'web') return;
  Alert.alert('Download', `Invoice ${data.invoiceNumber} — open this order on web to download.`);
}
