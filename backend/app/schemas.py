from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any



class BootstrapRequest(BaseModel):
    period: str = "monthly"
    custom_date: Optional[str] = None
    channel: str = "ALL"
    admin_filter_id: Optional[int] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class LoginRequest(BaseModel):
    username: str  # Accepts Gmail address or username
    password: str


class AdminSignupRequest(BaseModel):
    full_name: str
    email: str  # Must be a valid Google / Gmail address
    username: Optional[str] = None
    password: str
    role: str = "ADMIN"  # Future-ready for SALESMAN, PRODUCTION, etc.


class AdminApprovalDecisionRequest(BaseModel):
    approver_email: str
    decision: str = Field(..., pattern="^(APPROVED|NOT_APPROVED)$")


class PasswordVerifyRequest(BaseModel):
    admin_password: str
    reason: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class PartialPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
    payment_method: str = "CASH"
    account_id: Optional[int] = None
    payment_arrangement: str = "WALLET"  # WALLET, OWNER_CAPITAL, MARKET_LOAN
    lender_name: Optional[str] = None
    remarks: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class LocationCreate(BaseModel):
    name: str
    location_type: str = "WAREHOUSE"
    address: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    location_type: Optional[str] = None
    address: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class StockTransferRequest(BaseModel):
    product_id: int
    from_location_id: int
    to_location_id: int
    unit_type: str = Field(..., pattern="^(CARTON|BOTTLE)$")
    quantity: float = Field(..., gt=0)
    remarks: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class DirectLocationStockSet(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    company_name: Optional[str] = None
    location_id: int
    stock_bottles: int = Field(..., ge=0)
    pack_size: Optional[float] = None
    units_per_carton: Optional[int] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class PartyGroupCreate(BaseModel):
    name: str
    party_type: str = "CUSTOMER"
    city: Optional[str] = None
    description: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class ProductCreate(BaseModel):
    sku: Optional[str] = None
    name: str
    company_name: Optional[str] = None
    brand_id: int = 1
    viscosity_grade: str = "20W-50 4T"
    pack_size: float = 700.0
    pack_unit: str = "ML"
    units_per_carton: int = 12
    purchase_rate: float = 0.0
    sale_rate: float = 0.0
    initial_stock: int = 0
    location_id: Optional[int] = None
    reorder_level: int = 12
    is_favorite: bool = False
    client_snapshot: Optional[Dict[str, Any]] = None


class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    company_name: Optional[str] = None
    brand_id: Optional[int] = None
    viscosity_grade: Optional[str] = None
    pack_size: Optional[float] = None
    pack_unit: Optional[str] = None
    units_per_carton: Optional[int] = None
    purchase_rate: Optional[float] = None
    sale_rate: Optional[float] = None
    reorder_level: Optional[int] = None
    is_favorite: Optional[bool] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class CustomerCreate(BaseModel):
    code: Optional[str] = None
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    cnic: Optional[str] = None
    group_id: Optional[int] = None
    group_name: Optional[str] = "General Market"
    city: str = "Local"
    address: Optional[str] = None
    credit_limit: float = 50000.0
    current_receivable: float = 0.0
    is_favorite: bool = False
    client_snapshot: Optional[Dict[str, Any]] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    cnic: Optional[str] = None
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    credit_limit: Optional[float] = None
    current_receivable: Optional[float] = None
    is_favorite: Optional[bool] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class SupplierCreate(BaseModel):
    code: Optional[str] = None
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    cnic: Optional[str] = None
    group_id: Optional[int] = None
    group_name: Optional[str] = "General Suppliers"
    city: str = "Local"
    address: Optional[str] = None
    current_payable: float = 0.0
    is_favorite: bool = False
    client_snapshot: Optional[Dict[str, Any]] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    cnic: Optional[str] = None
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    current_payable: Optional[float] = None
    is_favorite: Optional[bool] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class FinancialAccountCreate(BaseModel):
    name: str
    type: str = "CASH"
    account_number: Optional[str] = None
    current_balance: float = 0.0
    client_snapshot: Optional[Dict[str, Any]] = None


class FinancialAccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    account_number: Optional[str] = None
    current_balance: Optional[float] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class AccountAdjustRequest(BaseModel):
    account_id: int
    operation: str = Field(..., pattern="^(DEPOSIT|WITHDRAW)$")
    amount: float = Field(..., gt=0)
    remarks: Optional[str] = None
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class AccountTransferRequest(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: float = Field(..., gt=0)
    remarks: Optional[str] = None
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class LoanRepayRequest(BaseModel):
    loan_id: int
    amount: float = Field(..., gt=0)
    account_id: int
    remarks: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class PurchaseItemCreate(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    company_name: Optional[str] = None
    mark_product_favorite: Optional[bool] = None
    location_id: int
    unit_type: str = Field(..., pattern="^(CARTON|BOTTLE)$")
    quantity: float = Field(..., gt=0)
    unit_rate: float = Field(..., ge=0)
    units_per_carton: Optional[int] = None
    pack_size: Optional[float] = None
    new_sale_rate_per_bottle: Optional[float] = None


class PurchaseCreate(BaseModel):
    doc_type: str = "PURCHASE"  # PURCHASE or PURCHASE_RETURN
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    supplier_city: Optional[str] = "Local"
    supplier_phone: Optional[str] = None
    supplier_cnic: Optional[str] = None
    supplier_group_id: Optional[int] = None
    supplier_group: Optional[str] = "General Suppliers"
    mark_favorite: Optional[bool] = None
    items: List[PurchaseItemCreate]
    discount_amount: float = 0.0
    freight_amount: float = 0.0
    paid_amount: float = 0.0
    payment_method: str = "CASH"
    account_id: Optional[int] = None
    payment_arrangement: str = "WALLET"  # WALLET, OWNER_CAPITAL, MARKET_LOAN, SUPPLIER_CREDIT
    lender_name: Optional[str] = None
    remarks: Optional[str] = None
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class SaleItemCreate(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    company_name: Optional[str] = None
    mark_product_favorite: Optional[bool] = None
    location_id: int
    unit_type: str = Field(..., pattern="^(CARTON|BOTTLE)$")
    quantity: float = Field(..., gt=0)
    unit_rate: float = Field(..., ge=0)
    units_per_carton: Optional[int] = None
    pack_size: Optional[float] = None


class SaleCreate(BaseModel):
    doc_type: str = "SALE"  # SALE, SALE_RETURN, ESTIMATE
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_city: Optional[str] = "Local"
    customer_phone: Optional[str] = None
    customer_cnic: Optional[str] = None
    customer_group_id: Optional[int] = None
    customer_group: Optional[str] = "General Market"
    mark_favorite: Optional[bool] = None
    items: List[SaleItemCreate]
    discount_amount: float = 0.0
    freight_amount: float = 0.0
    include_previous_dues: bool = False
    received_amount: float = 0.0
    payment_method: str = "CASH"
    account_id: Optional[int] = None
    remarks: Optional[str] = None
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class PaymentProposalRequest(BaseModel):
    payment_amount: float = Field(..., gt=0)
    allocation_policy: str = "OLDEST_FIRST"  # OLDEST_FIRST or NEWEST_FIRST


class BillAllocationItemInput(BaseModel):
    sale_id: int
    allocated_amount: float = Field(..., ge=0)


class ConfirmPaymentAllocationRequest(BaseModel):
    payment_amount: float = Field(..., gt=0)
    payment_method: str = "CASH"
    account_id: Optional[int] = None
    allocations: List[BillAllocationItemInput]
    excess_action: str = "NONE"  # NONE, ADVANCE_CREDIT
    remarks: Optional[str] = None
    idempotency_key: Optional[str] = None
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None


class ExpenseCreate(BaseModel):
    category: str
    description: Optional[str] = None
    payment_method: str = "CASH"
    account_id: Optional[int] = None
    payment_arrangement: str = "WALLET"  # WALLET, OWNER_CAPITAL, MARKET_LOAN
    lender_name: Optional[str] = None
    amount: float = Field(..., gt=0)
    paid_to: Optional[str] = None
    reference: Optional[str] = None
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    client_snapshot: Optional[Dict[str, Any]] = None