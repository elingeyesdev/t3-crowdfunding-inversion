import type { FinancialMovementHistoryEntry } from '../../types/admin.types';

const actions: Record<FinancialMovementHistoryEntry['action'], string> = {
  created: 'Registro creado',
  updated: 'Datos corregidos',
  receipt_replaced: 'Comprobante reemplazado',
  reviewed: 'Revisión administrativa',
  deleted: 'Movimiento retirado',
  legacy_snapshot: 'Estado conservado de un registro anterior',
};

const fields: Record<string, string> = {
  concept: 'Concepto', category: 'Categoría', amount: 'Monto', currency: 'Moneda',
  reference_number: 'Referencia', notes: 'Notas', receipt_url: 'Comprobante',
  status: 'Estado', review_notes: 'Observaciones de revisión', deleted_at: 'Fecha de retiro',
};

function valueCell(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Sin registro';
  if (key === 'status' && typeof value === 'string') {
    const statuses: Record<string, string> = { pending: 'Pendiente de revisión', verified: 'Verificado', flagged: 'Observado', rejected: 'Rechazado', audited: 'Auditado' };
    return statuses[value] || value;
  }
  if (key === 'receipt_url' && typeof value === 'string' && value.startsWith('/storage/receipts/')) {
    return <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Abrir comprobante</a>;
  }
  return String(value);
}

export function FinancialMovementHistory({ entries }: { entries: FinancialMovementHistoryEntry[] }) {
  return (
    <section className="space-y-2 border-t border-gray-100 pt-4">
      <h4 className="text-xs font-bold text-gray-700">Historial de cambios y revisiones</h4>
      {entries.length === 0 && <p className="text-xs text-gray-500">No hay antecedentes disponibles.</p>}
      {entries.map((entry) => {
        const changed = Object.keys(fields).filter((key) => entry.before === null
          ? entry.after[key] !== null && entry.after[key] !== undefined
          : entry.before[key] !== entry.after[key]);
        return (
          <details key={entry.id} className="rounded-lg border border-gray-200 p-3 text-xs">
            <summary className="cursor-pointer font-semibold text-gray-800">
              {actions[entry.action]} · {entry.actorName}
              <span className="block mt-1 text-gray-500 font-normal">{new Date(entry.createdAt).toLocaleString('es-BO')} · Registro {entry.version}</span>
            </summary>
            {changed.length > 0 && (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left">
                  <thead><tr><th className="p-1">Campo</th><th className="p-1">Antes</th><th className="p-1">Después</th></tr></thead>
                  <tbody>{changed.map((key) => (
                    <tr key={key} className="border-t border-gray-100 align-top">
                      <td className="p-1">{fields[key]}</td>
                      <td className="p-1 break-words whitespace-pre-wrap">{valueCell(key, entry.before?.[key])}</td>
                      <td className="p-1 break-words whitespace-pre-wrap">{valueCell(key, entry.after[key])}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </details>
        );
      })}
    </section>
  );
}
