from pydantic import BaseModel, Field
from typing import List, Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class PasswordVerifyRequest(BaseModel):
    admin_password: str
    reason: Optional[str] = None


class PartialPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
    payment_method: str = "CASH"
    remarks: Optional[str] = None


class LocationCreate(BaseModel):
    name: str
    location_type: str = "WAREHOUSE"
    address: Optional[str] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    location_type: Optional[str] = None
    address: Optional[str] = None


class StockTransferRequest(BaseModel):
    product_id: int
    from_location_id: int
    to_location_id: int
    unit_type: str = Field(..., pattern="^(CARTON|BOTTLE)$")
    quantity: float = Field(..., gt=0)
    remarks: Optional[str] = None


class DirectLocationStockSet(BaseModel):
    product_id: int
    location_id: int
    stock_bottles: int = Field(..., ge=0)
    pack_size: Optional[float] = None
    units_per_carton: Optional[int] = None


class ProductCreate(BaseModel):
    sku: str
    name: str
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


class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    brand_id: Optional[int] = None
    viscosity_grade: Optional[str] = None
    pack_size: Optional[float] = None
    pack_unit: Optional[str] = None
    units_per_carton: Optional[int] = None
    purchase_rate: Optional[float] = None
    sale_rate: Optional[float] = None
    reorder_level: Optional[int] = None


class CustomerCreate(BaseModel):
    code: Optional[str] = None
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    city: str = "Local"
    address: Optional[str] = None
    credit_limit: float = 50000.0
    current_receivable: float = 0.0
    is_favorite: bool = False


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    credit_limit: Optional[float] = None
    current_receivable: Optional[float] = None
    is_favorite: Optional[bool] = None


class SupplierCreate(BaseModel):
    code: Optional[str] = None
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    city: str = "Local"
    address: Optional[str] = None
    current_payable: float = 0.0
    is_favorite: bool = False


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    current_payable: Optional[float] = None
    is_favorite: Optional[bool] = None


class FinancialAccountCreate(BaseModel):
    name: str
    type: str = "CASH"
    account_number: Optional[str] = None
    current_balance: float = 0.0


class FinancialAccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    account_number: Optional[str] = None
    current_balance: Optional[float] = None


class PurchaseItemCreate(BaseModel):
    product_id: int
    location_id: int
    unit_type: str = Field(..., pattern="^(CARTON|BOTTLE)$")
    quantity: float = Field(..., gt=0)
    unit_rate: float = Field(..., ge=0)
    units_per_carton: Optional[int] = None
    pack_size: Optional[float] = None
    new_sale_rate_per_bottle: Optional[float] = None


class PurchaseCreate(BaseModel):
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    supplier_city: Optional[str] = "Local"
    mark_favorite: Optional[bool] = False
    items: List[PurchaseItemCreate]
    paid_amount: float = 0.0
    payment_method: str = "CASH"
    remarks: Optional[str] = None


class SaleItemCreate(BaseModel):
    product_id: int
    location_id: int
    unit_type: str = Field(..., pattern="^(CARTON|BOTTLE)$")
    quantity: float = Field(..., gt=0)
    unit_rate: float = Field(..., ge=0)
    units_per_carton: Optional[int] = None
    pack_size: Optional[float] = None


class SaleCreate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_city: Optional[str] = "Local"
    mark_favorite: Optional[bool] = False
    items: List[SaleItemCreate]
    received_amount: float = 0.0
    payment_method: str = "CASH"
    remarks: Optional[str] = None


class ExpenseCreate(BaseModel):
    category: str
    description: Optional[str] = None
    payment_method: str = "CASH"
    amount: float = Field(..., gt=0)
    paid_to: Optional[str] = None
    reference: Optional[str] = None