from sqlalchemy import text, inspect
from .database import engine, Base, is_sqlite


def upgrade_database_schema():
    """Checks all table columns in a single query on PostgreSQL so cold starts finish in <50ms."""
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
        if not is_sqlite:
            rows = conn.execute(text(
                "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'"
            )).fetchall()
            cols_by_table = {}
            for t_name, c_name in rows:
                cols_by_table.setdefault(t_name, set()).add(c_name)

            for table_name, cols_to_add in migrations.items():
                if table_name not in cols_by_table:
                    continue
                existing_cols = cols_by_table[table_name]
                for col_name, col_def in cols_to_add:
                    if col_name not in existing_cols:
                        try:
                            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"))
                            conn.commit()
                        except Exception:
                            conn.rollback()
        else:
            inspector = inspect(engine)
            existing_tables = inspector.get_table_names()
            for table_name, cols_to_add in migrations.items():
                if table_name not in existing_tables:
                    continue
                existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
                for col_name, col_def in cols_to_add:
                    if col_name not in existing_cols:
                        try:
                            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"))
                            conn.commit()
                        except Exception:
                            conn.rollback()


def seed_database():
    Base.metadata.create_all(bind=engine)
    upgrade_database_schema()


if __name__ == "__main__":
    seed_database()