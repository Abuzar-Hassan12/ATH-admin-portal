from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from .database import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(40), default="ADMIN")  # SUPER_ADMIN, ADMIN, SALESMAN, PRODUCTION
    approval_status = Column(String(30), default="PENDING")  # APPROVED, PENDING, NOT_APPROVED
    approved_by = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)


class Brand(Base):
    __tablename__ = "brands"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    is_owned_brand = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    products = relationship("Product", back_populates="brand")


class StorageLocation(Base):
    __tablename__ = "storage_locations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(120), unique=True, nullable=False)
    location_type = Column(String(50), default="WAREHOUSE")
    address = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    product_stocks = relationship("ProductLocationStock", back_populates="location", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False)
    viscosity_grade = Column(String(50), default="20W-50 4T")
    pack_size = Column(Float, nullable=False)
    pack_unit = Column(String(20), default="ML")
    base_unit = Column(String(20), default="BOTTLE")
    units_per_carton = Column(Integer, default=12, nullable=False)
    purchase_rate = Column(Float, default=0.0)
    sale_rate = Column(Float, default=0.0)
    carton_purchase_rate = Column(Float, default=0.0)
    carton_sale_rate = Column(Float, default=0.0)
    current_stock = Column(Integer, default=0)
    reorder_level = Column(Integer, default=12)
    is_favorite = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    brand = relationship("Brand", back_populates="products")
    stock_movements = relationship("StockMovement", back_populates="product", cascade="all, delete-orphan")
    location_stocks = relationship("ProductLocationStock", back_populates="product", cascade="all, delete-orphan")


class ProductLocationStock(Base):
    __tablename__ = "product_location_stocks"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=False)
    stock_bottles = Column(Integer, default=0, nullable=False)

    product = relationship("Product", back_populates="location_stocks")
    location = relationship("StorageLocation", back_populates="product_stocks")


class PartyGroup(Base):
    __tablename__ = "party_groups"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(120), index=True, nullable=False)
    party_type = Column(String(30), default="CUSTOMER", index=True)  # CUSTOMER or SUPPLIER
    city = Column(String(100), nullable=True)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    cnic = Column(String(30), nullable=True)
    group_id = Column(Integer, ForeignKey("party_groups.id"), nullable=True, index=True)
    group_name = Column(String(100), default="General Suppliers")
    city = Column(String(100), nullable=False)
    address = Column(Text, nullable=True)
    opening_payable = Column(Float, default=0.0)
    current_payable = Column(Float, default=0.0)
    is_favorite = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    group = relationship("PartyGroup", foreign_keys=[group_id])
    purchases = relationship("Purchase", back_populates="supplier")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    cnic = Column(String(30), nullable=True)
    group_id = Column(Integer, ForeignKey("party_groups.id"), nullable=True, index=True)
    group_name = Column(String(100), default="General Market")
    city = Column(String(100), nullable=False)
    address = Column(Text, nullable=True)
    credit_limit = Column(Float, default=50000.0)
    opening_receivable = Column(Float, default=0.0)
    current_receivable = Column(Float, default=0.0)
    advance_credit = Column(Float, default=0.0)
    is_favorite = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    group = relationship("PartyGroup", foreign_keys=[group_id])
    sales = relationship("Sale", back_populates="customer")
    payments = relationship("CustomerPayment", back_populates="customer", cascade="all, delete-orphan")


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    purchase_number = Column(String(50), unique=True, index=True, nullable=False)
    doc_type = Column(String(30), default="PURCHASE")  # PURCHASE or PURCHASE_RETURN
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    invoice_date = Column(DateTime, default=datetime.utcnow)
    subtotal_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    freight_amount = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    payable_amount = Column(Float, default=0.0)
    payment_status = Column(String(20), default="UNPAID")
    payment_arrangement = Column(String(40), default="WALLET")
    account_id = Column(Integer, ForeignKey("financial_accounts.id"), nullable=True)
    admin_id = Column(Integer, nullable=True)
    admin_name = Column(String(150), default="Admin")
    remarks = Column(Text, nullable=True)

    supplier = relationship("Supplier", back_populates="purchases")
    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=True)
    unit_type = Column(String(20), nullable=False)
    quantity = Column(Float, nullable=False)
    units_per_carton = Column(Integer, default=12)
    base_quantity = Column(Integer, nullable=False)
    unit_rate = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)

    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product")
    location = relationship("StorageLocation")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, index=True, nullable=False)
    doc_type = Column(String(30), default="SALE")  # SALE, SALE_RETURN, ESTIMATE
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    invoice_date = Column(DateTime, default=datetime.utcnow)
    subtotal_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    freight_amount = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    previous_dues = Column(Float, default=0.0)
    include_previous_dues = Column(Boolean, default=False)
    grand_payable = Column(Float, default=0.0)
    received_amount = Column(Float, default=0.0)
    applied_to_previous = Column(Float, default=0.0)
    receivable_amount = Column(Float, default=0.0)
    closing_receivable = Column(Float, default=0.0)
    payment_status = Column(String(20), default="UNPAID")
    account_id = Column(Integer, ForeignKey("financial_accounts.id"), nullable=True)
    admin_id = Column(Integer, nullable=True)
    admin_name = Column(String(150), default="Admin")
    remarks = Column(Text, nullable=True)

    customer = relationship("Customer", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=True)
    unit_type = Column(String(20), nullable=False)
    quantity = Column(Float, nullable=False)
    units_per_carton = Column(Integer, default=12)
    base_quantity = Column(Integer, nullable=False)
    unit_rate = Column(Float, nullable=False)
    cost_per_bottle = Column(Float, default=0.0)
    line_cost = Column(Float, default=0.0)
    line_total = Column(Float, nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")
    location = relationship("StorageLocation")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    movement_date = Column(DateTime, default=datetime.utcnow)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    movement_type = Column(String(40), nullable=False)
    reference_number = Column(String(50), nullable=True)
    qty_in = Column(Integer, default=0)
    qty_out = Column(Integer, default=0)
    running_balance = Column(Integer, default=0)

    product = relationship("Product", back_populates="stock_movements")


class FinancialAccount(Base):
    __tablename__ = "financial_accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(30), nullable=False)
    account_number = Column(String(100), nullable=True)
    current_balance = Column(Float, default=0.0)


class AccountTransaction(Base):
    __tablename__ = "account_transactions"

    id = Column(Integer, primary_key=True, index=True)
    tx_number = Column(String(50), unique=True, index=True, nullable=False)
    tx_date = Column(DateTime, default=datetime.utcnow)
    tx_type = Column(String(50), nullable=False)
    account_id = Column(Integer, ForeignKey("financial_accounts.id"), nullable=True)
    to_account_id = Column(Integer, ForeignKey("financial_accounts.id"), nullable=True)
    channel = Column(String(40), default="CASH")
    party = Column(String(150), nullable=True)
    reference_id = Column(Integer, nullable=True)
    description = Column(String(255), nullable=True)
    cash_in = Column(Float, default=0.0)
    cash_out = Column(Float, default=0.0)
    admin_id = Column(Integer, nullable=True)
    admin_name = Column(String(150), default="Admin")


class LoanAccount(Base):
    __tablename__ = "loan_accounts"

    id = Column(Integer, primary_key=True, index=True)
    lender_name = Column(String(150), nullable=False)
    loan_type = Column(String(40), default="MARKET_LOAN")  # OWNER_CAPITAL or MARKET_LOAN
    phone = Column(String(50), nullable=True)
    total_borrowed = Column(Float, default=0.0)
    total_repaid = Column(Float, default=0.0)
    current_balance = Column(Float, default=0.0)
    notes = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    expense_number = Column(String(50), unique=True, index=True, nullable=False)
    expense_date = Column(DateTime, default=datetime.utcnow)
    category = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    payment_method = Column(String(50), default="CASH")
    account_id = Column(Integer, ForeignKey("financial_accounts.id"), nullable=True)
    payment_arrangement = Column(String(40), default="WALLET")
    amount = Column(Float, nullable=False)
    paid_to = Column(String(150), nullable=True)
    reference = Column(String(100), nullable=True)
    admin_id = Column(Integer, nullable=True)
    admin_name = Column(String(150), default="Admin")


class CustomerPayment(Base):
    __tablename__ = "customer_payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_number = Column(String(50), unique=True, index=True, nullable=False)
    idempotency_key = Column(String(100), unique=True, index=True, nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    payment_date = Column(DateTime, default=datetime.utcnow)
    payment_amount = Column(Float, nullable=False)
    allocated_amount = Column(Float, default=0.0)
    unallocated_credit = Column(Float, default=0.0)
    outstanding_before = Column(Float, default=0.0)
    outstanding_after = Column(Float, default=0.0)
    payment_method = Column(String(40), default="CASH")
    account_id = Column(Integer, ForeignKey("financial_accounts.id"), nullable=True)
    remarks = Column(Text, nullable=True)
    admin_id = Column(Integer, nullable=True)
    admin_name = Column(String(150), default="Admin")
    status = Column(String(30), default="CONFIRMED")  # CONFIRMED or REVERSED
    reversed_at = Column(DateTime, nullable=True)
    reversal_reason = Column(String(255), nullable=True)

    customer = relationship("Customer", back_populates="payments")
    allocations = relationship("CustomerPaymentAllocation", back_populates="payment", cascade="all, delete-orphan")


class CustomerPaymentAllocation(Base):
    __tablename__ = "customer_payment_allocations"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("customer_payments.id"), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    invoice_number = Column(String(50), nullable=False)
    bill_original_amount = Column(Float, nullable=False)
    outstanding_before = Column(Float, nullable=False)
    allocated_amount = Column(Float, nullable=False)
    remaining_after = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    payment = relationship("CustomerPayment", back_populates="allocations")
    sale = relationship("Sale")


class RecycleBin(Base):
    __tablename__ = "recycle_bin"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    reference_code = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)
    amount = Column(Float, default=0.0)
    payload_json = Column(Text, nullable=False)
    deleted_at = Column(DateTime, default=datetime.utcnow)