from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from .database import Base


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
    location_type = Column(String(50), default="WAREHOUSE")  # DISPLAY, WAREHOUSE, GODOWN, OTHER
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
    current_stock = Column(Integer, default=0)
    reorder_level = Column(Integer, default=12)
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


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    city = Column(String(100), nullable=False)
    address = Column(Text, nullable=True)
    opening_payable = Column(Float, default=0.0)
    current_payable = Column(Float, default=0.0)
    is_favorite = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    purchases = relationship("Purchase", back_populates="supplier")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    city = Column(String(100), nullable=False)
    address = Column(Text, nullable=True)
    credit_limit = Column(Float, default=50000.0)
    opening_receivable = Column(Float, default=0.0)
    current_receivable = Column(Float, default=0.0)
    is_favorite = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    sales = relationship("Sale", back_populates="customer")


class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    purchase_number = Column(String(50), unique=True, index=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    invoice_date = Column(DateTime, default=datetime.utcnow)
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    payable_amount = Column(Float, default=0.0)
    payment_status = Column(String(20), default="UNPAID")
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
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    invoice_date = Column(DateTime, default=datetime.utcnow)
    total_amount = Column(Float, nullable=False)
    received_amount = Column(Float, default=0.0)
    receivable_amount = Column(Float, default=0.0)
    payment_status = Column(String(20), default="UNPAID")
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
    line_total = Column(Float, nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")
    location = relationship("StorageLocation")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    movement_date = Column(DateTime, default=datetime.utcnow)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    movement_type = Column(String(30), nullable=False)
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


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    expense_number = Column(String(50), unique=True, index=True, nullable=False)
    expense_date = Column(DateTime, default=datetime.utcnow)
    category = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    payment_method = Column(String(50), default="CASH")
    amount = Column(Float, nullable=False)
    paid_to = Column(String(150), nullable=True)
    reference = Column(String(100), nullable=True)


class RecycleBin(Base):
    __tablename__ = "recycle_bin"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)  # SALE, PURCHASE, EXPENSE, PRODUCT, CUSTOMER, SUPPLIER, ACCOUNT, LOCATION
    entity_id = Column(Integer, nullable=False)
    reference_code = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)
    amount = Column(Float, default=0.0)
    payload_json = Column(Text, nullable=False)
    deleted_at = Column(DateTime, default=datetime.utcnow)