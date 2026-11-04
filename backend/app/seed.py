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
            ("is_favorite", "BOOLEAN DEFAULT FALSE"),
        ],
        "customers": [
            ("cnic", "VARCHAR(30)"),
            ("group_id", "INTEGER"),
            ("group_name", "VARCHAR(100) DEFAULT 'General Market'"),
            ("advance_credit", "FLOAT DEFAULT 0.0"),
            ("is_favorite", "BOOLEAN DEFAULT FALSE"),
        ],
        "suppliers": [
            ("cnic", "VARCHAR(30)"),
            ("group_id", "INTEGER"),
            ("group_name", "VARCHAR(100) DEFAULT 'General Suppliers'"),
            ("is_favorite", "BOOLEAN DEFAULT FALSE"),
        ],
        "purchases": [
            ("idempotency_key", "VARCHAR(100)"),
            ("doc_type", "VARCHAR(30) DEFAULT 'PURCHASE'"),
            ("subtotal_amount", "FLOAT DEFAULT 0.0"),
            ("discount_amount", "FLOAT DEFAULT 0.0"),
            ("freight_amount", "FLOAT DEFAULT 0.0"),
            ("previous_dues", "FLOAT DEFAULT 0.0"),
            ("applied_to_previous", "FLOAT DEFAULT 0.0"),
            ("closing_payable", "FLOAT DEFAULT 0.0"),
            ("payment_arrangement", "VARCHAR(40) DEFAULT 'WALLET'"),
            ("account_id", "INTEGER"),
            ("admin_id", "INTEGER"),
            ("admin_name", "VARCHAR(150) DEFAULT 'Malik Waseem'"),
        ],
        "purchase_items": [
            ("location_id", "INTEGER"),
        ],
        "sales": [
            ("idempotency_key", "VARCHAR(100)"),
            ("doc_type", "VARCHAR(30) DEFAULT 'SALE'"),
            ("subtotal_amount", "FLOAT DEFAULT 0.0"),
            ("discount_amount", "FLOAT DEFAULT 0.0"),
            ("freight_amount", "FLOAT DEFAULT 0.0"),
            ("previous_dues", "FLOAT DEFAULT 0.0"),
            ("include_previous_dues", "BOOLEAN DEFAULT FALSE"),
            ("grand_payable", "FLOAT DEFAULT 0.0"),
            ("applied_to_previous", "FLOAT DEFAULT 0.0"),
            ("closing_receivable", "FLOAT DEFAULT 0.0"),
            ("account_id", "INTEGER"),
            ("admin_id", "INTEGER"),
            ("admin_name", "VARCHAR(150) DEFAULT 'Malik Waseem'"),
        ],
        "sale_items": [
            ("location_id", "INTEGER"),
            ("cost_per_bottle", "FLOAT DEFAULT 0.0"),
            ("line_cost", "FLOAT DEFAULT 0.0"),
        ],
        "account_transactions": [
            ("reference_id", "INTEGER"),
            ("admin_id", "INTEGER"),
            ("admin_name", "VARCHAR(150) DEFAULT 'Malik Waseem'"),
        ],
        "customer_payments": [
            ("admin_id", "INTEGER"),
            ("admin_name", "VARCHAR(150) DEFAULT 'Malik Waseem'"),
        ],
        "expenses": [
            ("account_id", "INTEGER"),
            ("payment_arrangement", "VARCHAR(40) DEFAULT 'WALLET'"),
            ("admin_id", "INTEGER"),
            ("admin_name", "VARCHAR(150) DEFAULT 'Malik Waseem'"),
        ],
    }

    with engine.connect() as conn:
        for table_name, cols_to_add in migrations.items():
            if table_name not in existing_tables:
                continue
            try:
                existing_cols = [c["name"] for c in inspector.get_columns(table_name)]
            except Exception:
                conn.rollback()
                continue
            for col_name, col_def in cols_to_add:
                if col_name not in existing_cols:
                    try:
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"))
                        conn.commit()
                    except Exception:
                        conn.rollback()


def seed_database():
    db = SessionLocal()
    try:
        pur_cols = [c["name"] for c in inspect(engine).get_columns("purchases")]
        if "idempotency_key" not in pur_cols:
            upgrade_database_schema()

        existing_admin = db.query(AdminUser).filter(
            AdminUser.email.ilike("malikwaseemhassan448@gmail.com"),
            AdminUser.approved_by == "PROD_CLEAN_SLATE_V1"
        ).first()
        existing_loc = db.query(StorageLocation).first()
        if existing_admin and existing_loc:
            db.close()
            return
    except Exception:
        db.rollback()

    Base.metadata.create_all(bind=engine)
    upgrade_database_schema()

    if not db.query(StorageLocation).first():
        db.add(StorageLocation(
            code="LOC-MAIN",
            name="Main Warehouse",
            location_type="WAREHOUSE",
            address="Primary Storage Room"
        ))
        db.commit()

    if not db.query(Brand).first():
        db.add(Brand(code="BR-ATH", name="ATH Oils", is_owned_brand=True))
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

    default_groups = [
        ("General Market", "CUSTOMER", "All Cities"),
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

    super_admin = db.query(AdminUser).filter(
        AdminUser.email.ilike("malikwaseemhassan448@gmail.com")
    ).first()
    if not super_admin:
        db.add(AdminUser(
            full_name="Malik Waseem",
            email="malikwaseemhassan448@gmail.com",
            username="Malik Waseem",
            password_hash="abuzuraiz",
            role="SUPER_ADMIN",
            approval_status="APPROVED",
            approved_by="PROD_CLEAN_SLATE_V1"
        ))
        db.commit()

    db.close()


if __name__ == "__main__":
    seed_database()