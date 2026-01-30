/**
 * Genera una ventana de impresión con la cotización para guardar como PDF
 * (Imprimir → Guardar como PDF en el navegador). Sin dependencias externas.
 */

type QuoteForPdf = {
  id: string;
  customer?: { id: string; name: string } | null;
  validUntil: string | null;
  createdAt: string;
  subtotal: string | number;
  taxTotal?: string | number;
  discountTotal?: string | number;
  grandTotal: string | number;
  items?: Array<{
    id: string;
    qty: number;
    unitPrice: string | number;
    lineTotal: string | number;
    product?: { name: string; internalCode?: string };
  }>;
};

function fmtMoney(value: string | number): string {
  const n = Number(value);
  return Number.isNaN(n) ? '0' : n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function downloadQuotePdf(quote: QuoteForPdf): void {
  const items = quote.items ?? [];
  const rows = items
    .map(
      (row) =>
        `<tr>
          <td>${escapeHtml(row.product?.name ?? '—')}</td>
          <td style="text-align:center">${row.qty}</td>
          <td style="text-align:right">${fmtMoney(row.unitPrice)}</td>
          <td style="text-align:right">${fmtMoney(row.lineTotal)}</td>
        </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Cotización</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.5rem; text-align: center; margin-bottom: 1.5rem; }
    .meta { margin-bottom: 1.5rem; font-size: 0.9rem; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
    th { background: #374151; color: #fff; font-weight: 600; }
    .totals { margin-top: 1rem; font-size: 0.9rem; }
    .totals .total { font-weight: 700; font-size: 1rem; margin-top: 4px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>COTIZACIÓN</h1>
  <div class="meta">
    <p><strong>Cliente:</strong> ${escapeHtml(quote.customer?.name ?? '—')}</p>
    <p><strong>Validez hasta:</strong> ${fmtDate(quote.validUntil)}</p>
    <p><strong>Fecha:</strong> ${fmtDate(quote.createdAt)}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th style="text-align:center">Cant.</th>
        <th style="text-align:right">P. unitario</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <p>Subtotal: ${fmtMoney(quote.subtotal)}</p>
    ${Number(quote.taxTotal) > 0 ? `<p>IVA: ${fmtMoney(quote.taxTotal ?? 0)}</p>` : ''}
    ${Number(quote.discountTotal) > 0 ? `<p>Descuento: ${fmtMoney(quote.discountTotal ?? 0)}</p>` : ''}
    <p class="total">Total: ${fmtMoney(quote.grandTotal)}</p>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) {
    return;
  }
  w.document.write(html);
  w.document.close();
}

function escapeHtml(text: string): string {
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}
