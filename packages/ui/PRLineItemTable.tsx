export interface RequisitionLineItem {
  id?: string;
  line_number: number;
  item_description: string;
  item_code?: string;
  category_id?: string;
  uom_id: string;
  quantity: number;
  estimated_unit_price: number;
  estimated_total?: number;
  hsn_code?: string;
  specifications?: string;
  required_by_date?: string;
  delivery_location_id?: string;
}

export interface PRLineItemTableProps {
  lines: RequisitionLineItem[];
  editable?: boolean;
  currency?: string;
  onLinesChange?: (lines: RequisitionLineItem[]) => void;
  onRemoveLine?: (lineNumber: number) => void;
}

export * from "../../procurement-portal-frontend/packages/ui/src/PRLineItemTable";
export { PRLineItemTable as default } from "../../procurement-portal-frontend/packages/ui/src/PRLineItemTable";
