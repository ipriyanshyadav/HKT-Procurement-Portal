"use client";

export interface RequisitionLineItem {
  id?: string;
  requisition_id?: string;
  line_number: number;
  item_description: string;
  item_code?: string | null;
  category_id: string;
  uom_id: string;
  quantity: number;
  estimated_unit_price: number;
  estimated_total?: number;
  hsn_code?: string | null;
  specifications?: string | null;
  required_by_date?: string | null;
  delivery_location_id?: string | null;
}

export interface PRLineItemTableProps {
  lines: RequisitionLineItem[];
  uoms?: Array<{ id: string; code: string; name: string }>;
  editable?: boolean;
  currency?: string;
  onLinesChange?: (lines: RequisitionLineItem[]) => void;
  onRemoveLine?: (lineNumber: number) => void;
}

export const PRLineItemTable: React.FC<PRLineItemTableProps> = ({
  lines,
  uoms,
  editable = false,
  currency = "INR",
  onLinesChange,
  onRemoveLine,
}) => {
  const handleUpdate = (index: number, field: keyof RequisitionLineItem, value: any) => {
    if (!onLinesChange) return;
    const updated = [...lines];
    const item = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "estimated_unit_price") {
      const q = field === "quantity" ? Number(value) : item.quantity;
      const p = field === "estimated_unit_price" ? Number(value) : item.estimated_unit_price;
      item.estimated_total = Number((q * p).toFixed(2));
    }
    updated[index] = item;
    onLinesChange(updated);
  };

  const totalValue = lines.reduce((acc, curr) => acc + (curr.estimated_total || curr.quantity * curr.estimated_unit_price || 0), 0);

  return (
    <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
            <tr>
              <th scope="col" className="px-4 py-3 w-12 text-center">#</th>
              <th scope="col" className="px-4 py-3">Description</th>
              <th scope="col" className="px-4 py-3">Item Code</th>
              <th scope="col" className="px-4 py-3">UOM</th>
              <th scope="col" className="px-4 py-3 text-right">Qty</th>
              <th scope="col" className="px-4 py-3 text-right">Unit Price ({currency})</th>
              <th scope="col" className="px-4 py-3 text-right">Total ({currency})</th>
              <th scope="col" className="px-4 py-3">Required By</th>
              {editable && <th scope="col" className="px-4 py-3 text-center w-16">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-800">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={editable ? 9 : 8} className="text-center py-8 text-gray-400">
                  No line items added yet.
                </td>
              </tr>
            ) : (
              lines.map((line, idx) => (
                <tr key={line.line_number || idx} className="hover:bg-gray-50/75 transition-colors">
                  <td className="px-4 py-3 text-center font-medium text-gray-500">
                    {line.line_number || idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    {editable ? (
                      <input
                        type="text"
                        value={line.item_description}
                        onChange={(e) => handleUpdate(idx, "item_description", e.target.value)}
                        placeholder="Item description..."
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{line.item_description}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {editable ? (
                      <input
                        type="text"
                        value={line.item_code || ""}
                        onChange={(e) => handleUpdate(idx, "item_code", e.target.value)}
                        placeholder="Optional code"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    ) : (
                      line.item_code || "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editable && uoms && uoms.length > 0 ? (
                      <select
                        value={line.uom_id}
                        onChange={(e) => handleUpdate(idx, "uom_id", e.target.value)}
                        className="w-28 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none bg-white text-xs"
                      >
                        {uoms.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.code} ({u.name})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-700 text-xs">
                        {uoms?.find((u) => u.id === line.uom_id)?.code || line.uom_id || "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editable ? (
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={line.quantity}
                        onChange={(e) => handleUpdate(idx, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-24 text-right px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    ) : (
                      Number(line.quantity).toLocaleString()
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editable ? (
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.estimated_unit_price}
                        onChange={(e) => handleUpdate(idx, "estimated_unit_price", parseFloat(e.target.value) || 0)}
                        className="w-28 text-right px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    ) : (
                      Number(line.estimated_unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {(line.estimated_total ?? (line.quantity * line.estimated_unit_price)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {editable ? (
                      <input
                        type="date"
                        value={line.required_by_date || ""}
                        onChange={(e) => handleUpdate(idx, "required_by_date", e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    ) : (
                      line.required_by_date || "—"
                    )}
                  </td>
                  {editable && (
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => onRemoveLine ? onRemoveLine(line.line_number || idx + 1) : null}
                        className="text-red-500 hover:text-red-700 font-bold p-1 transition-colors"
                        title="Remove line item"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-gray-50/80 font-semibold border-t border-gray-200">
            <tr>
              <td colSpan={editable ? 6 : 5} className="px-4 py-3 text-right text-gray-600">
                Estimated Total:
              </td>
              <td className="px-4 py-3 text-right text-base text-blue-600 font-bold">
                {currency} {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td colSpan={editable ? 2 : 1}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
