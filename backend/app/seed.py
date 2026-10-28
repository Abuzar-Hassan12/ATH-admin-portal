from sqlalchemy import text, inspect
from .database import engine, SessionLocal, Base
import uuid
from .models import (
    AdminUser, Brand, StorageLocation, Product, ProductLocationStock,
    PartyGroup, Supplier, Customer, FinancialAccount, Expense
)


def upgrade_database_schema():
    """Safely adds any missing columns to existing SQLite or PostgreSQL tables without dropping data."""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    migrations = {
        "products": [
            ("carton_purchase_rate", "FLOAT DEFAULT 0.0"),
            ("carton_sale_rate", "FLOAT DEFAULT 0.0"),
            ("is_favorite", "BOOLEAN DEFAULT 0"),
        ],
        "customers": [
            ("cnic", "VARCHAR(30)"),
            ("group_id", "INTEGER"),
            ("group_name", "VARCHAR(100) DEFAULT 'General Market'"),
            ("advance_credit", "FLOAT DEFAULT 0.0"),
            ("is_favorite", "BOOLEAN DEFAULT 0"),
        ],
        "suppliers": [
            ("cnic", "VARCHAR(30)"),
            ("group_id", "INTEGER"),
            ("group_name", "VARCHAR(100) DEFAULT 'General Suppliers'"),
            ("is_favorite", "BOOLEAN DEFAULT 0"),
        ],
        "purchases": [
            ("doc_type", "VARCHAR(30) DEFAULT 'PURCHASE'"),
            ("subtotal_amount", "FLOAT DEFAULT 0.0"),
            ("discount_amount", "FLOAT DEFAULT 0.0"),
            ("freight_amount", "FLOAT DEFAULT 0.0"),
            ("payment_arrangement", "VARCHAR(40) DEFAULT 'WALLET'"),
            ("account_id", "INTEGER"),
            ("admin_id", "INTEGER"),
            ("admin_name", "VARCHAR(150) DEFAULT 'Admin'"),
        ],
        "purchase_items": [
            ("location_id", "INTEGER"),
        ],
        "sales": [
            ("doc_type", "VARCHAR(30) DEFAULT 'SALE'"),
            ("subtotal_amount", "FLOAT DEFAULT 0.0"),
            ("discount_amount", "FLOAT DEFAULT 0.0"),
            ("freight_amount", "FLOAT DEFAULT 0.0"),
            ("previous_dues", "FLOAT DEFAULT 0.0"),
            ("include_previous_dues", "BOOLEAN DEFAULT 0"),
            ("grand_payable", "FLOAT DEFAULT 0.0"),
            ("applied_to_previous", "FLOAT DEFAULT 0.0"),
            ("closing_receivable", "FLOAT DEFAULT 0.0"),
            ("account_id", "INTEGER"),
            ("admin_id", "INTEGER"),
            ("admin_name", "VARCHAR(150) DEFAULT 'Admin'"),
        ],
        "sale_items": [
            ("location_id", "INTEGER"),
            ("cost_per_bottle", "FLOAT DEFAULT 0.0"),
            ("line_cost", "FLOAT DEFAULT 0.0"),
        ],
        "account_transactions": [
            ("reference_id", "INTEGER"),
            ("admin_id", "INTEGER"),
            ("admin_name", "VARCHAR(150) DEFAULT 'Admin'"),
        ],
        "customer_payments": [
            ("admin_id", "INTEGER"),
            ("admin_name", "VARCHAR(150) DEFAULT 'Admin'"),
        ],
        "expenses": [
            ("account_id", "INTEGER"),
            ("payment_arrangement", "VARCHAR(40) DEFAULT 'WALLET'"),
            ("admin_id", "INTEGER"),
            ("admin_name", "VARCHAR(150) DEFAULT 'Admin'"),
        ],
    }

    with engine.connect() as conn:
        for table_name, cols_to_add in migrations.items():
            if table_name not in existing_tables:
                continue
            try:
                existing_cols = [c["name"] for c in inspector.get_columns(table_name)]
                for col_name, col_def in cols_to_add:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"))
                        conn.commit()
            except Exception:
                pass


def seed_database():
    Base.metadata.create_all(bind=engine)
    upgrade_database_schema()
    db = SessionLocal()

    for exp_code in ["EXP-001", "EXP-002", "EXP-003", "EXP-004"]:
        old_exp = db.query(Expense).filter(Expense.expense_number == exp_code).first()
        if old_exp:
            db.delete(old_exp)
    db.commit()

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

    if not db.query(Supplier).first():
        suppliers = [
            Supplier(code="SUP-001", name="Malik Ayan Sajid", phone="0312-5130252", cnic="35202-1234567-1", group_name="Lahore Distributors", city="Lahore", address="Badami Bagh, Lahore", opening_payable=0.0, current_payable=0.0),
            Supplier(code="SUP-002", name="Aftab Bhatti", phone="0300-1234567", cnic="37405-9876543-1", group_name="Potohar Suppliers", city="Gujjar Khan", address="Pindi Road, Gujjar Khan", opening_payable=0.0, current_payable=0.0),
        ]
        db.add_all(suppliers)
        db.commit()

    if not db.query(Customer).first():
        customers = [
            Customer(code="CUS-001", name="Saeed (Saeed Autos)", phone="0304-5464807", cnic="37104-1122334-1", group_name="Khour Route", city="Khour", address="Company Chowk, Khour", credit_limit=50000.0, opening_receivable=0.0, current_receivable=0.0),
            Customer(code="CUS-002", name="Mehtab (Sheikh Autos)", phone="0333-5551234", cnic="37102-2233445-3", group_name="Jand Route", city="Jand", address="Main Bazaar, Jand", credit_limit=35000.0, opening_receivable=0.0, current_receivable=0.0),
            Customer(code="CUS-003", name="Fayyaz (Fayyaz Autos)", phone="0315-9988776", cnic="37104-5566778-5", group_name="Khour Route", city="Khour", address="Bus Stand Road, Khour", credit_limit=40000.0, opening_receivable=0.0, current_receivable=0.0),
            Customer(code="CUS-004", name="Qazi (Qazi Autos)", phone="0345-4433221", cnic="37105-9988112-7", group_name="Pindigheb Route", city="Pindigheb", address="Rawalpindi Road, Pindigheb", credit_limit=50000.0, opening_receivable=0.0, current_receivable=0.0),
        ]
        db.add_all(customers)
        db.commit()

    if not db.query(FinancialAccount).first():
        accounts = [
            FinancialAccount(name="Main Shop Cash Drawer", type="CASH", account_number="CASH-01", current_balance=0.0),
            FinancialAccount(name="Habib Bank Limited (HBL)", type="BANK", account_number="PK45HABB00123456789", current_balance=0.0),
            FinancialAccount(name="Easypaisa Business Wallet", type="EASYPAISA", account_number="0312-5130252", current_balance=0.0),
            FinancialAccount(name="JazzCash Merchant Wallet", type="JAZZCASH", account_number="0304-5464807", current_balance=0.0),
        ]
        db.add_all(accounts)
        db.commit()

    # Ensure every existing customer/supplier group_name has a corresponding PartyGroup row & ID
    default_groups = [
        ("General Market", "CUSTOMER", "All Cities"),
        ("Khour Route", "CUSTOMER", "Khour"),
        ("Jand Route", "CUSTOMER", "Jand"),
        ("Pindigheb Route", "CUSTOMER", "Pindigheb"),
        ("General Suppliers", "SUPPLIER", "All Cities"),
    ]
    for g_name, p_type, g_city in default_groups:
        exists = db.query(PartyGroup).filter(
            PartyGroup.name.ilike(g_name),
            PartyGroup.party_type == p_type
        ).first()
        if not exists:
            db.add(PartyGroup(
                code=f"GRP-{uuid.uuid4().hex[:4].upper()}",
                name=g_name,
                party_type=p_type,
                city=g_city
            ))
    db.commit()

    for cus in db.query(Customer).all():
        g_label = (cus.group_name or "General Market").strip()
        grp = db.query(PartyGroup).filter(
            PartyGroup.name.ilike(g_label),
            PartyGroup.party_type == "CUSTOMER"
        ).first()
        if not grp:
            grp = PartyGroup(
                code=f"GRP-{uuid.uuid4().hex[:4].upper()}",
                name=g_label,
                party_type="CUSTOMER",
                city=cus.city
            )
            db.add(grp)
            db.flush()
        if cus.group_id != grp.id:
            cus.group_id = grp.id

    for sup in db.query(Supplier).all():
        g_label = (sup.group_name or "General Suppliers").strip()
        grp = db.query(PartyGroup).filter(
            PartyGroup.name.ilike(g_label),
            PartyGroup.party_type == "SUPPLIER"
        ).first()
        if not grp:
            grp = PartyGroup(
                code=f"GRP-{uuid.uuid4().hex[:4].upper()}",
                name=g_label,
                party_type="SUPPLIER",
                city=sup.city
            )
            db.add(grp)
            db.flush()
        if sup.group_id != grp.id:
            sup.group_id = grp.id
    db.commit()

    # Seed Master Super Admin (malikabuzar411@gmail.com)
    super_admin = db.query(AdminUser).filter(
        AdminUser.email.ilike("malikabuzar411@gmail.com")
    ).first()
    if not super_admin:
        db.add(AdminUser(
            full_name="Malik Abuzar (Super Admin)",
            email="malikabuzar411@gmail.com",
            username="Admin",
            password_hash="Admin@786",
            role="SUPER_ADMIN",
            approval_status="APPROVED",
            approved_by="SYSTEM_OWNER"
        ))
        db.commit()

    db.close()

if __name__ == "__main__":
    seed_database()