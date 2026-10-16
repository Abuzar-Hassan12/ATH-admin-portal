from sqlalchemy import text
from .database import engine, SessionLocal, Base
from .models import (
    Brand, StorageLocation, Product, ProductLocationStock,
    Supplier, Customer, FinancialAccount, Expense
)


def upgrade_sqlite_schema():
    """Ensure existing SQLite database has location_id columns without losing user data."""
    with engine.connect() as conn:
        for table in ["purchase_items", "sale_items"]:
            try:
                cols = [row[1] for row in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()]
                if "location_id" not in cols:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN location_id INTEGER"))
                    conn.commit()
            except Exception:
                pass


def seed_database():
    Base.metadata.create_all(bind=engine)
    upgrade_sqlite_schema()
    db = SessionLocal()

    # 1. Remove old hardcoded seed expenses (EXP-001..EXP-004 that caused -37,200 net profit)
    for exp_code in ["EXP-001", "EXP-002", "EXP-003", "EXP-004"]:
        old_exp = db.query(Expense).filter(Expense.expense_number == exp_code).first()
        if old_exp:
            db.delete(old_exp)
    db.commit()

    # 2. Ensure Default Storage Locations exist (Shop Display & Main Warehouse)
    if not db.query(StorageLocation).first():
        locations = [
            StorageLocation(code="LOC-DISPLAY", name="Shop Display Counter", location_type="DISPLAY", address="Main Retail Front"),
            StorageLocation(code="LOC-WH1", name="Main Warehouse", location_type="WAREHOUSE", address="Primary Storage Room"),
        ]
        db.add_all(locations)
        db.commit()

    default_display = db.query(StorageLocation).filter(StorageLocation.location_type == "DISPLAY").first()
    default_warehouse = db.query(StorageLocation).filter(StorageLocation.location_type == "WAREHOUSE").first()
    primary_loc = default_warehouse or default_display

    # 3. Ensure Brands exist
    if not db.query(Brand).first():
        brands = [
            Brand(code="BR-ATH", name="ATH Oils (Proprietary)", is_owned_brand=True),
            Brand(code="BR-HONDA", name="Honda Atlas", is_owned_brand=False),
            Brand(code="BR-HAVOLINE", name="Havoline", is_owned_brand=False),
            Brand(code="BR-SHELL", name="Shell", is_owned_brand=False),
            Brand(code="BR-DYL", name="DYL Lube", is_owned_brand=False),
        ]
        db.add_all(brands)
        db.commit()

    # 4. Ensure Products exist without hardcoded static assumptions
    if not db.query(Product).first():
        products = [
            Product(sku="ATH-101", name="ATH MOTORCYCLE 4T 20W-50", brand_id=1, viscosity_grade="20W-50 4T", pack_size=700, pack_unit="ML", units_per_carton=12, purchase_rate=0.0, sale_rate=0.0, current_stock=0, reorder_level=24),
            Product(sku="ATH-001", name="HONDA ATLAS 1L", brand_id=2, viscosity_grade="HD 50 DD", pack_size=1000, pack_unit="ML", units_per_carton=12, purchase_rate=0.0, sale_rate=0.0, current_stock=0, reorder_level=20),
            Product(sku="ATH-002", name="HAVOLINE 1L", brand_id=3, viscosity_grade="HD 50 DD", pack_size=1000, pack_unit="ML", units_per_carton=12, purchase_rate=0.0, sale_rate=0.0, current_stock=0, reorder_level=20),
            Product(sku="ATH-003", name="HONDA ATLAS 700ML", brand_id=2, viscosity_grade="HD 50 DD", pack_size=700, pack_unit="ML", units_per_carton=12, purchase_rate=0.0, sale_rate=0.0, current_stock=0, reorder_level=24),
            Product(sku="ATH-004", name="HAVOLINE 700ML", brand_id=3, viscosity_grade="HD 50 DD", pack_size=700, pack_unit="ML", units_per_carton=12, purchase_rate=0.0, sale_rate=0.0, current_stock=0, reorder_level=24),
            Product(sku="ATH-005", name="SHELL 700ML", brand_id=4, viscosity_grade="HD 50 DD", pack_size=700, pack_unit="ML", units_per_carton=12, purchase_rate=0.0, sale_rate=0.0, current_stock=0, reorder_level=12),
            Product(sku="ATH-006", name="DYL LUBE 800ML", brand_id=5, viscosity_grade="HD 50 DD", pack_size=800, pack_unit="ML", units_per_carton=12, purchase_rate=0.0, sale_rate=0.0, current_stock=0, reorder_level=12),
        ]
        db.add_all(products)
        db.commit()

    # Sync any existing product stock into ProductLocationStock if not yet mapped
    if primary_loc:
        for prod in db.query(Product).all():
            loc_stocks = db.query(ProductLocationStock).filter(ProductLocationStock.product_id == prod.id).all()
            if not loc_stocks and prod.current_stock > 0:
                db.add(ProductLocationStock(
                    product_id=prod.id,
                    location_id=primary_loc.id,
                    stock_bottles=prod.current_stock
                ))
        db.commit()

    # 5. Suppliers — Reset old hardcoded 227,600 / 31,000 opening balances if no purchases exist
    if not db.query(Supplier).first():
        suppliers = [
            Supplier(code="SUP-001", name="Malik Ayan Sajid", phone="0312-5130252", city="Lahore", address="Badami Bagh, Lahore", opening_payable=0.0, current_payable=0.0),
            Supplier(code="SUP-002", name="Aftab Bhatti", phone="0300-1234567", city="Gujjar Khan", address="Pindi Road, Gujjar Khan", opening_payable=0.0, current_payable=0.0),
        ]
        db.add_all(suppliers)
        db.commit()
    else:
        for sup in db.query(Supplier).all():
            if not sup.purchases and sup.current_payable in (227600.0, 219600.0, 31000.0):
                sup.opening_payable = 0.0
                sup.current_payable = 0.0
        db.commit()

    # 6. Customers — Reset old hardcoded 64,000 / 15,000 / 12,000 opening balances if no sales exist
    if not db.query(Customer).first():
        customers = [
            Customer(code="CUS-001", name="Saeed (Saeed Autos)", phone="0304-5464807", city="Khour", address="Company Chowk, Khour", credit_limit=50000.0, opening_receivable=0.0, current_receivable=0.0),
            Customer(code="CUS-002", name="Mehtab (Sheikh Autos)", phone="0333-5551234", city="Jand", address="Main Bazaar, Jand", credit_limit=35000.0, opening_receivable=0.0, current_receivable=0.0),
            Customer(code="CUS-003", name="Fayyaz (Fayyaz Autos)", phone="0315-9988776", city="Khour", address="Bus Stand Road, Khour", credit_limit=40000.0, opening_receivable=0.0, current_receivable=0.0),
            Customer(code="CUS-004", name="Qazi (Qazi Autos)", phone="0345-4433221", city="Pindigheb", address="Rawalpindi Road, Pindigheb", credit_limit=50000.0, opening_receivable=0.0, current_receivable=0.0),
        ]
        db.add_all(customers)
        db.commit()
    else:
        for cus in db.query(Customer).all():
            if not cus.sales and cus.current_receivable in (64000.0, 70000.0, 15000.0, 12000.0):
                cus.opening_receivable = 0.0
                cus.current_receivable = 0.0
        db.commit()

    # 7. Ensure Financial Accounts exist
    if not db.query(FinancialAccount).first():
        accounts = [
            FinancialAccount(name="Main Shop Cash Drawer", type="CASH", account_number="CASH-01", current_balance=0.0),
            FinancialAccount(name="Habib Bank Limited (HBL)", type="BANK", account_number="PK45HABB00123456789", current_balance=0.0),
            FinancialAccount(name="Easypaisa Business Wallet", type="EASYPAISA", account_number="0312-5130252", current_balance=0.0),
            FinancialAccount(name="JazzCash Merchant Wallet", type="JAZZCASH", account_number="0304-5464807", current_balance=0.0),
        ]
        db.add_all(accounts)
        db.commit()

    db.close()


if __name__ == "__main__":
    seed_database()