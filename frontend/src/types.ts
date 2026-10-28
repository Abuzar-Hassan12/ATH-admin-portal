export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'all';

export type EntityType =
  | 'SALE'
  | 'PURCHASE'
  | 'EXPENSE'
  | 'PRODUCT'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'LOCATION'
  | 'ACCOUNT'
  | 'ACCOUNT_TX'
  | 'CUSTOMER_PAYMENT';

export type SaleDocType = 'SALE' | 'SALE_RETURN' | 'ESTIMATE';
export type PurchaseDocType = 'PURCHASE' | 'PURCHASE_RETURN';
export type PaymentArrangementType = 'WALLET' | 'OWNER_CAPITAL' | 'MARKET_LOAN' | 'SUPPLIER_CREDIT';

export interface DashboardStats {
  period: TimePeriod;
  total_stock_bottles: number;
  total_stock_value: number;
  total_receivable: number;
  total_payable: number;
  total_loan_payable?: number;
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
  company_name?: string;
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
  is_favorite?: boolean;
  locations?: ProductLocationBreakdown[];
}

export interface PartyGroupItem {
  id: number;
  code: string;
  name: string;
  party_type: 'CUSTOMER' | 'SUPPLIER';
  city?: string;
  description?: string;
  members_count?: number;
  total_balance?: number;
}

export interface PartyGroupSearchResponse {
  items: PartyGroupItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface CustomerLastItemRate {
  product_id: number;
  product_name: string;
  unit_type: 'CARTON' | 'BOTTLE';
  unit_rate: number;
  units_per_carton?: number;
  invoice_number?: string;
  invoice_date: string;
}

export interface PreviousSaleRateResponse {
  found: boolean;
  customer_id: number;
  customer_name?: string;
  product_id: number;
  product_name?: string;
  requested_unit_type?: 'CARTON' | 'BOTTLE';
  historical_unit_type?: 'CARTON' | 'BOTTLE';
  historical_unit_rate?: number;
  applicable_rate?: number;
  quantity?: number;
  invoice_id?: number;
  invoice_number?: string;
  invoice_date?: string;
  message?: string;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  contact_person?: string;
  phone: string;
  cnic?: string;
  group_id?: number | null;
  group_name?: string;
  city: string;
  address?: string;
  credit_limit: number;
  opening_receivable?: number;
  current_receivable: number;
  advance_credit?: number;
  is_favorite?: boolean;
  total_sales_amount?: number;
  total_received_amount?: number;
  invoices_count?: number;
  confirmed_sales_count?: number;
  last_sale_date?: string | null;
  last_item_rates?: CustomerLastItemRate[];
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  contact_person?: string;
  phone: string;
  cnic?: string;
  group_id?: number | null;
  group_name?: string;
  city: string;
  address?: string;
  opening_payable?: number;
  current_payable: number;
  is_favorite?: boolean;
  total_purchases_amount?: number;
  total_paid_amount?: number;
  bills_count?: number;
}

export interface SaleItemDetail {
  product_id: number;
  product_name: string;
  company_name: string;
  pack_size: string;
  location_id?: number;
  location_name: string;
  unit_type: 'CARTON' | 'BOTTLE';
  quantity: number;
  units_per_carton: number;
  base_quantity: number;
  cartons: number;
  loose_bottles: number;
  unit_rate: number;
  line_cost?: number;
  line_total: number;
  line_profit?: number;
}

export interface SaleRecord {
  id: number;
  invoice_number: string;
  doc_type?: SaleDocType;
  customer_id: number;
  customer_name: string;
  customer_phone?: string;
  customer_city?: string;
  customer_cnic?: string;
  customer_group?: string;
  invoice_date: string;
  subtotal_amount?: number;
  discount_amount?: number;
  freight_amount?: number;
  total_amount: number;
  previous_dues?: number;
  include_previous_dues?: boolean;
  grand_payable?: number;
  received_amount: number;
  applied_to_previous?: number;
  receivable_amount: number;
  closing_receivable?: number;
  payment_status: string;
  payment_method: string;
  account_id?: number | null;
  admin_id?: number | null;
  admin_name?: string;
  remarks: string;
  location_summary: string;
  items_summary: string;
  bill_cost?: number;
  bill_profit?: number;
  items?: SaleItemDetail[];
}

export interface PurchaseItemDetail {
  product_id: number;
  product_name: string;
  company_name: string;
  pack_size: string;
  location_id?: number;
  location_name: string;
  unit_type: 'CARTON' | 'BOTTLE';
  quantity: number;
  units_per_carton: number;
  base_quantity: number;
  cartons: number;
  loose_bottles: number;
  unit_rate: number;
  line_total: number;
}

export interface PurchaseRecord {
  id: number;
  purchase_number: string;
  doc_type?: PurchaseDocType;
  supplier_id: number;
  supplier_name: string;
  supplier_phone?: string;
  supplier_city?: string;
  supplier_cnic?: string;
  supplier_group?: string;
  invoice_date: string;
  subtotal_amount?: number;
  discount_amount?: number;
  freight_amount?: number;
  total_amount: number;
  paid_amount: number;
  payable_amount: number;
  payment_status: string;
  payment_method: string;
  payment_arrangement?: PaymentArrangementType;
  account_id?: number | null;
  admin_id?: number | null;
  admin_name?: string;
  remarks: string;
  location_summary: string;
  items_summary: string;
  items?: PurchaseItemDetail[];
}

export interface Expense {
  id: number;
  expense_number: string;
  expense_date?: string;
  category: string;
  description: string;
  payment_method: string;
  account_id?: number | null;
  payment_arrangement?: string;
  amount: number;
  paid_to: string;
  reference?: string;
  admin_id?: number | null;
  admin_name?: string;
}

export interface FinancialAccount {
  id: number;
  name: string;
  type: string;
  account_number?: string;
  current_balance: number;
}

export interface LoanRecord {
  id: number;
  lender_name: string;
  loan_type: 'OWNER_CAPITAL' | 'MARKET_LOAN';
  phone?: string;
  total_borrowed: number;
  total_repaid: number;
  current_balance: number;
  notes?: string;
  updated_at?: string;
}

export interface AccountHistoryEntry {
  id: string;
  entity_type: EntityType;
  entity_id: number;
  date: string;
  timestamp: string;
  type: string;
  reference: string;
  party: string;
  channel: string;
  description: string;
  total_bill: number;
  cash_in: number;
  cash_out: number;
  admin_id?: number | null;
  admin_name?: string;
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

export interface BillWiseProfitRow {
  id: number;
  invoice_number: string;
  doc_type: string;
  date: string;
  customer_name: string;
  customer_city: string;
  customer_group: string;
  items_summary: string;
  sale_amount: number;
  cost_amount: number;
  discount_amount: number;
  freight_amount: number;
  net_profit: number;
  received_amount: number;
  pending_amount: number;
}

export interface ItemWiseSummaryRow {
  product_id: number;
  sku: string;
  name: string;
  brand_name: string;
  pack_size: string;
  units_per_carton: number;
  purchased_bottles: number;
  purchased_formatted: string;
  purchase_value: number;
  sold_bottles: number;
  sold_formatted: string;
  sale_revenue: number;
  cogs: number;
  profit: number;
  closing_bottles: number;
  closing_formatted: string;
  closing_valuation: number;
}

export interface CustomerGroupSummary {
  group_name: string;
  customers_count: number;
  total_receivable: number;
  total_sales: number;
}

export interface VyaparReportsData {
  period: TimePeriod;
  bill_wise_profit: BillWiseProfitRow[];
  item_wise_summary: ItemWiseSummaryRow[];
  customer_groups: CustomerGroupSummary[];
  daybook: AccountHistoryEntry[];
}

export interface BillAllocationAuditEntry {
  allocation_id?: number;
  payment_id?: number;
  payment_number?: string;
  payment_date?: string;
  payment_status?: string;
  sale_id?: number;
  invoice_number?: string;
  bill_original_amount?: number;
  outstanding_before: number;
  allocated_amount: number;
  remaining_after: number;
}

export interface OutstandingLedgerBill {
  sale_id: number;
  invoice_number: string;
  doc_type: string;
  invoice_date: string;
  items_summary: string;
  original_amount: number;
  previously_paid: number;
  remaining_balance: number;
  payment_status: 'UNPAID' | 'PARTIAL' | 'PAID' | string;
  allocations: BillAllocationAuditEntry[];
}

export interface CustomerPaymentVoucher {
  id: number;
  payment_number: string;
  payment_date: string;
  payment_amount: number;
  allocated_amount: number;
  unallocated_credit: number;
  outstanding_before: number;
  outstanding_after: number;
  payment_method: string;
  account_id?: number | null;
  remarks: string;
  status: 'CONFIRMED' | 'REVERSED' | string;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  allocations: BillAllocationAuditEntry[];
}

export interface CustomerOutstandingLedger {
  customer_id: number;
  customer_name: string;
  customer_code: string;
  city: string;
  phone: string;
  cnic: string;
  group_id?: number | null;
  group_name: string;
  opening_receivable: number;
  advance_credit: number;
  total_bills_outstanding: number;
  total_outstanding: number;
  outstanding_bills: OutstandingLedgerBill[];
  all_bills: OutstandingLedgerBill[];
  payment_history: CustomerPaymentVoucher[];
}

export interface PaymentProposalBillRow {
  sale_id: number;
  invoice_number: string;
  invoice_date: string;
  original_amount: number;
  previously_paid: number;
  outstanding_before: number;
  proposed_allocation: number;
  remaining_after: number;
  projected_status: 'UNPAID' | 'PARTIAL' | 'PAID';
}

export interface PaymentProposalResponse {
  customer_id: number;
  customer_name: string;
  allocation_policy: 'OLDEST_FIRST' | 'NEWEST_FIRST';
  payment_amount: number;
  total_outstanding_before: number;
  total_proposed_allocation: number;
  projected_outstanding_after: number;
  excess_payment_amount: number;
  requires_excess_decision: boolean;
  bills: PaymentProposalBillRow[];
}

export interface Customer360Profile {
  customer: Customer;
  invoices: SaleRecord[];
  item_history: {
    invoice_number: string;
    date: string;
    doc_type: string;
    product_id: number;
    product_name: string;
    pack_size: string;
    unit_type: string;
    quantity: number;
    base_quantity: number;
    unit_rate: number;
    line_total: number;
  }[];
  outstanding_ledger?: CustomerOutstandingLedger;
  payments: {
    id: number;
    tx_number: string;
    date: string;
    tx_type: string;
    channel: string;
    description: string;
    cash_in: number;
    cash_out: number;
  }[];
}

export interface Supplier360Profile {
  supplier: Supplier;
  bills: PurchaseRecord[];
}

export interface AdminUserRecord {
  id: number;
  full_name: string;
  email: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'SALESMAN' | 'PRODUCTION' | string;
  approval_status: 'APPROVED' | 'PENDING' | 'NOT_APPROVED' | string;
  approved_by?: string | null;
  is_super_admin?: boolean;
  created_at?: string;
  last_login_at?: string;
}

export interface PartnerActivityItem {
  date: string;
  timestamp: string;
  type: string;
  reference: string;
  party: string;
  amount: number;
}

export interface PartnerTransparencyRow {
  admin_id: number;
  full_name: string;
  username: string;
  email: string;
  role: string;
  sales_total: number;
  sales_collected: number;
  sales_count: number;
  purchases_total: number;
  purchases_paid: number;
  purchases_count: number;
  deposits_total: number;
  withdrawals_total: number;
  deposits_count: number;
  expenses_total: number;
  expenses_count: number;
  recent_activities: PartnerActivityItem[];
}