export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'all';

export type EntityType =
  | 'SALE'
  | 'PURCHASE'
  | 'EXPENSE'
  | 'PRODUCT'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'LOCATION'
  | 'ACCOUNT';

export interface DashboardStats {
  period: TimePeriod;
  total_stock_bottles: number;
  total_stock_value: number;
  total_receivable: number;
  total_payable: number;
  total_cash_bank: number;
  total_sales_revenue: number;
  sales_collected: number;
  sales_pending: number;
  sales_count: number;
  total_purchases_cost: number;
  purchases_paid: number;
  purchases_pending: number;
  purchases_count: number;
  total_expenses: number;
  expenses_count: number;
  estimated_gross_profit: number;
  net_profit: number;
  net_cash_flow: number;
  trash_count: number;
}

export interface LocationStockItem {
  product_id: number;
  product_name: string;
  sku: string;
  pack_size: string;
  units_per_carton: number;
  stock_bottles: number;
  cartons: number;
  loose_bottles: number;
  formatted: string;
}

export interface StorageLocation {
  id: number;
  code: string;
  name: string;
  location_type: string;
  address: string;
  total_bottles: number;
  items?: LocationStockItem[];
}

export interface ProductLocationBreakdown {
  location_id: number;
  location_name: string;
  location_type: string;
  stock_bottles: number;
  cartons: number;
  loose_bottles: number;
  formatted: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  brand_id: number;
  brand_name: string;
  is_owned: boolean;
  viscosity: string;
  pack_size_num: number;
  pack_unit: string;
  pack_size: string;
  units_per_carton: number;
  purchase_rate: number;
  sale_rate: number;
  carton_purchase_rate: number;
  carton_sale_rate: number;
  current_stock_bottles: number;
  cartons: number;
  loose_bottles: number;
  current_stock_formatted: string;
  stock_valuation: number;
  reorder_level: number;
  is_low_stock: boolean;
  locations?: ProductLocationBreakdown[];
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  contact_person?: string;
  phone: string;
  city: string;
  address?: string;
  credit_limit: number;
  current_receivable: number;
  is_favorite?: boolean;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  contact_person?: string;
  phone: string;
  city: string;
  address?: string;
  current_payable: number;
  is_favorite?: boolean;
}

export interface SaleRecord {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  invoice_date: string;
  total_amount: number;
  received_amount: number;
  receivable_amount: number;
  payment_status: string;
  payment_method: string;
  remarks: string;
  location_summary: string;
  items_summary: string;
}

export interface PurchaseRecord {
  id: number;
  purchase_number: string;
  supplier_id: number;
  supplier_name: string;
  invoice_date: string;
  total_amount: number;
  paid_amount: number;
  payable_amount: number;
  payment_status: string;
  payment_method: string;
  remarks: string;
  location_summary: string;
  items_summary: string;
}

export interface Expense {
  id: number;
  expense_number: string;
  expense_date?: string;
  category: string;
  description: string;
  payment_method: string;
  amount: number;
  paid_to: string;
  reference?: string;
}

export interface FinancialAccount {
  id: number;
  name: string;
  type: string;
  account_number?: string;
  current_balance: number;
}

export interface AccountHistoryEntry {
  id: string;
  entity_type: EntityType;
  entity_id: number;
  date: string;
  timestamp: string;
  type: 'SALE INFLOW' | 'PURCHASE OUTFLOW' | 'EXPENSE OUTFLOW';
  reference: string;
  party: string;
  channel: string;
  description: string;
  total_bill: number;
  cash_in: number;
  cash_out: number;
}

export interface RecycleBinItem {
  id: number;
  entity_type: EntityType;
  reference_code: string;
  title: string;
  summary: string;
  amount: number;
  deleted_at: string;
}