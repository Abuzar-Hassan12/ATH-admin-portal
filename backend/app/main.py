from fastapi import FastAPI, Depends, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import text
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import json
import uuid

from .database import engine, Base, get_db, is_sqlite, IS_PERSISTENT_POSTGRES
from .models import (
    AdminUser, Brand, StorageLocation, Product, ProductLocationStock,
    PartyGroup, Supplier, Customer, Purchase, PurchaseItem,
    Sale, SaleItem, StockMovement, FinancialAccount,
    AccountTransaction, LoanAccount, Expense,
    CustomerPayment, CustomerPaymentAllocation, RecycleBin
)
from .schemas import (
    BootstrapRequest, LoginRequest, AdminSignupRequest, AdminApprovalDecisionRequest,
    PasswordVerifyRequest, PartialPaymentRequest,
    LocationCreate, LocationUpdate, StockTransferRequest, DirectLocationStockSet,
    PartyGroupCreate, ProductCreate, ProductUpdate,
    CustomerCreate, CustomerUpdate,
    FinancialAccountCreate, FinancialAccountUpdate,
    SupplierCreate, SupplierUpdate,
    AccountAdjustRequest, AccountTransferRequest, LoanRepayRequest,
    PurchaseCreate, SaleCreate,
    PaymentProposalRequest, BillAllocationItemInput, ConfirmPaymentAllocationRequest,
    SupplierBillAllocationItemInput, ConfirmSupplierPaymentAllocationRequest,
    ExpenseCreate
)
import re
from .seed import seed_database, upgrade_database_schema

try:
    Base.metadata.create_all(bind=engine)
except Exception as _init_exc:
    print("Database initial connection warning (will retry on request):", _init_exc)

app = FastAPI(title="ATH Lubricants - Enterprise ERP & Vyapar Suite API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVER_STATE_VERSION = 0


def pkr(val: Optional[float]) -> float:
    """Enforces 100% clean whole-PKR currency arithmetic (eliminates .92 paisa bugs)."""
    if val is None:
        return 0.0
    return float(int(round(float(val))))


BOOTSTRAP_CACHE: Dict[str, Any] = {}


def sync_postgres_sequences(db: Session):
    """Ensures all PostgreSQL SERIAL primary-key sequences are at least MAX(id) so INSERTs never throw 500 UniqueViolation."""
    if is_sqlite:
        return
    for seq_tbl in [
        "admin_users", "brands", "storage_locations", "party_groups", "products",
        "product_location_stocks", "suppliers", "customers", "financial_accounts",
        "loan_accounts", "account_transactions", "purchases", "purchase_items",
        "sales", "sale_items", "customer_payments", "customer_payment_allocations",
        "expenses", "recycle_bin", "stock_movements"
    ]:
        try:
            db.execute(text(
                f"SELECT setval(pg_get_serial_sequence('{seq_tbl}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {seq_tbl}), 1), "
                f"(SELECT COUNT(*) > 0 FROM {seq_tbl}));"
            ))
        except Exception:
            db.rollback()
    try:
        db.commit()
    except Exception:
        db.rollback()


def consolidate_default_locations(db: Session):
    """
    Ensures only ONE default location ('Main Warehouse') exists out of the box by merging
    the legacy auto-seeded 'Shop Display Counter' (LOC-DISP / LOC-DISPLAY) into 'Main Warehouse'.
    Any custom locations added by the user are 100% preserved.
    """
    try:
        locs = db.query(StorageLocation).order_by(StorageLocation.id.asc()).all()
        if not locs:
            default_loc = StorageLocation(
                code="LOC-MAIN",
                name="Main Warehouse",
                location_type="WAREHOUSE",
                address="Main Facility"
            )
            db.add(default_loc)
            db.commit()
            return

        changed = False
        for loc_row in locs:
            if (loc_row.location_type or "").upper() == "GODOWN":
                loc_row.location_type = "WAREHOUSE"
                changed = True

        disp_loc = next(
            (
                l for l in locs
                if (l.code or "").upper() in ("LOC-DISP", "LOC-DISPLAY")
                or l.name.strip().lower() in ("shop display counter", "shop display")
            ),
            None
        )
        main_loc = next(
            (
                l for l in locs
                if l.id != (disp_loc.id if disp_loc else -1)
                and ((l.code or "").upper() in ("LOC-WH", "LOC-WH1", "LOC-MAIN") or "warehouse" in l.name.lower())
            ),
            None
        )
        if not main_loc and len(locs) > 1 and disp_loc:
            main_loc = next((l for l in locs if l.id != disp_loc.id), None)

        if disp_loc and main_loc and disp_loc.id != main_loc.id:
            disp_id = disp_loc.id
            main_id = main_loc.id

            disp_stocks = db.query(ProductLocationStock).filter(ProductLocationStock.location_id == disp_id).all()
            affected_product_ids = set()
            for ds in disp_stocks:
                affected_product_ids.add(ds.product_id)
                qty = int(ds.stock_bottles or 0)
                if qty > 0:
                    target_ls = db.query(ProductLocationStock).filter(
                        ProductLocationStock.product_id == ds.product_id,
                        ProductLocationStock.location_id == main_id
                    ).first()
                    if target_ls:
                        target_ls.stock_bottles = int(target_ls.stock_bottles or 0) + qty
                    else:
                        db.add(ProductLocationStock(
                            product_id=ds.product_id,
                            location_id=main_id,
                            stock_bottles=qty
                        ))
            db.flush()

            # Use bulk SQL deletes/updates with synchronize_session=False to avoid cascade conflicts
            db.query(ProductLocationStock).filter(ProductLocationStock.location_id == disp_id).delete(synchronize_session=False)
            db.query(SaleItem).filter(SaleItem.location_id == disp_id).update(
                {SaleItem.location_id: main_id}, synchronize_session=False
            )
            db.query(PurchaseItem).filter(PurchaseItem.location_id == disp_id).update(
                {PurchaseItem.location_id: main_id}, synchronize_session=False
            )
            main_loc.name = "Main Warehouse"
            main_loc.location_type = "WAREHOUSE"
            db.expunge(disp_loc)
            db.query(StorageLocation).filter(StorageLocation.id == disp_id).delete(synchronize_session=False)
            db.flush()

            for pid in affected_product_ids:
                prod_obj = db.query(Product).filter(Product.id == pid).first()
                if prod_obj:
                    all_ls = db.query(ProductLocationStock).filter(ProductLocationStock.product_id == pid).all()
                    prod_obj.current_stock = sum(max(0, int(x.stock_bottles or 0)) for x in all_ls)

            changed = True
        elif disp_loc and not main_loc and len(locs) == 1:
            disp_loc.name = "Main Warehouse"
            disp_loc.location_type = "WAREHOUSE"
            disp_loc.code = "LOC-MAIN"
            changed = True

        if changed:
            bump_version()
            db.commit()
    except Exception as exc:
        db.rollback()
        print("Location consolidation note:", exc)


@app.on_event("startup")
def on_startup():
    try:
        seed_database()
        with Session(engine) as db:
            ensure_super_admin_exists(db)
            consolidate_default_locations(db)
            sync_postgres_sequences(db)
    except Exception as exc:
        print("Startup schema check warning:", exc)


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """Diagnostic endpoint to verify permanent PostgreSQL connection without exposing secrets."""
    try:
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception:
        db_connected = False
    return {
        "status": "ok" if db_connected else "error",
        "database_engine": "postgresql" if IS_PERSISTENT_POSTGRES else "sqlite_ephemeral",
        "persistent_storage": IS_PERSISTENT_POSTGRES,
        "sales_count": db.query(Sale).count() if db_connected else 0,
        "purchases_count": db.query(Purchase).count() if db_connected else 0,
        "admins_count": db.query(AdminUser).count() if db_connected else 0,
    }


def bump_version() -> int:
    global SERVER_STATE_VERSION
    now_ms = int(datetime.utcnow().timestamp() * 1000)
    SERVER_STATE_VERSION = max(SERVER_STATE_VERSION + 1, now_ms)
    BOOTSTRAP_CACHE.clear()
    return SERVER_STATE_VERSION


def verify_admin_password(
    pw: str,
    db: Optional[Session] = None,
    admin_id: Optional[int] = None,
    admin_name: Optional[str] = None
):
    clean_pw = (pw or "").strip()
    if not clean_pw:
        raise HTTPException(status_code=403, detail="Administrator password is required.")

    # Check against registered & approved AdminUser accounts in database
    if db is not None:
        try:
            if admin_id:
                adm = db.query(AdminUser).filter(
                    AdminUser.id == admin_id,
                    AdminUser.approval_status == "APPROVED"
                ).first()
                if adm and adm.password_hash == clean_pw:
                    return
            if admin_name:
                clean_ident = admin_name.strip()
                adm_by_name = db.query(AdminUser).filter(
                    (AdminUser.username.ilike(clean_ident)) | (AdminUser.full_name.ilike(clean_ident)) | (AdminUser.email.ilike(clean_ident)),
                    AdminUser.approval_status == "APPROVED"
                ).first()
                if adm_by_name and adm_by_name.password_hash == clean_pw:
                    return
            any_approved = db.query(AdminUser).filter(
                AdminUser.approval_status == "APPROVED",
                AdminUser.password_hash == clean_pw
            ).first()
            if any_approved:
                return
        except Exception:
            pass

    if clean_pw in ("Admin@786", "abuzuraiz"):
        return

    raise HTTPException(status_code=403, detail="Incorrect Administrator Password. Authorization denied.")


PKT_OFFSET = timedelta(hours=5)


def now_pkt() -> datetime:
    """Returns current Pakistan Standard Time (UTC+5) as a naive datetime."""
    return datetime.utcnow() + PKT_OFFSET


def get_period_start(period: str) -> Optional[datetime]:
    now = now_pkt()
    today_midnight_pkt = datetime(now.year, now.month, now.day)
    if period == "daily":
        return today_midnight_pkt
    elif period == "weekly":
        return today_midnight_pkt - timedelta(days=6)
    elif period == "monthly":
        return datetime(now.year, now.month, 1)
    return None


def get_period_bounds(period: str, custom_date: Optional[str] = None):
    """Returns (start_dt, end_dt) in Pakistan Standard Time (12:00:00 AM to 11:59:59 PM PKT)."""
    if custom_date and isinstance(custom_date, str) and custom_date.strip():
        try:
            dt = datetime.strptime(custom_date.strip()[:10], "%Y-%m-%d")
            return dt, dt + timedelta(days=1)
        except Exception:
            pass
    if period and isinstance(period, str) and len(period) == 10 and period[4] == "-" and period[7] == "-":
        try:
            dt = datetime.strptime(period, "%Y-%m-%d")
            return dt, dt + timedelta(days=1)
        except Exception:
            pass
    start_dt = get_period_start(period)
    if period == "daily" and start_dt:
        return start_dt, start_dt + timedelta(days=1)
    return start_dt, None


def get_sale_later_settled_amount(db: Session, sale_id: int, invoice_number: str) -> float:
    """
    Returns the portion of a Sale's received_amount that was settled via separate/later
    payment vouchers (CPAY- or RCV-), so the original bill's creation date only reports
    its initial payment and subsequent settlements are reported on their actual payment dates.
    """
    allocs = (
        db.query(CustomerPaymentAllocation, CustomerPayment)
        .join(CustomerPayment, CustomerPaymentAllocation.payment_id == CustomerPayment.id)
        .filter(
            CustomerPaymentAllocation.sale_id == sale_id,
            CustomerPayment.status == "CONFIRMED"
        )
        .all()
    )
    later_sum = 0.0
    for al, pm in allocs:
        p_num = (pm.payment_number or "").upper()
        if not p_num.startswith("SPAY-"):
            later_sum = pkr(later_sum + pkr(al.allocated_amount))
    return later_sum


def get_purchase_later_settled_amount(db: Session, purchase_id: int) -> float:
    """
    Returns the portion of a Purchase's paid_amount that was paid via later installment
    vouchers (PPAY-), so the purchase bill's creation date only reports its initial payment.
    """
    txs = (
        db.query(AccountTransaction)
        .filter(
            AccountTransaction.reference_id == purchase_id,
            AccountTransaction.tx_type == "SUPPLIER KHATA PAYMENT"
        )
        .all()
    )
    return sum(pkr(t.cash_out) for t in txs)


def extract_channel_and_remarks(raw_remarks: Optional[str], default_channel: str = "CASH"):
    if not raw_remarks:
        return default_channel, ""
    if "|" in raw_remarks:
        parts = raw_remarks.split("|", 1)
        return parts[0].strip().upper(), parts[1].strip()
    return default_channel, raw_remarks


def resolve_financial_account(
    db: Session,
    account_id: Optional[int] = None,
    payment_method: Optional[str] = "CASH"
) -> Optional[FinancialAccount]:
    if account_id:
        acc = db.query(FinancialAccount).filter(FinancialAccount.id == account_id).first()
        if acc:
            return acc
    if payment_method:
        clean_method = payment_method.strip().upper()
        acc = db.query(FinancialAccount).filter(FinancialAccount.type == clean_method).first()
        if acc:
            return acc
        acc_by_name = db.query(FinancialAccount).filter(FinancialAccount.name.ilike(f"%{clean_method}%")).first()
        if acc_by_name:
            return acc_by_name
    return db.query(FinancialAccount).order_by(FinancialAccount.id.asc()).first()


def handle_outflow_with_arrangement(
    db: Session,
    amount: float,
    account_id: Optional[int],
    payment_method: str,
    arrangement: str,
    lender_name: Optional[str],
    reference_no: str,
    party_name: str,
    description: str,
    reference_id: Optional[int] = None
) -> Optional[FinancialAccount]:
    """
    Prevents silent negative wallet balances!
    - WALLET: Requires sufficient funds in the selected FinancialAccount.
    - OWNER_CAPITAL / MARKET_LOAN: Records capital/loan inflow into LoanAccount first,
      logs the inflow + outflow in AccountTransaction so wallet balance never drops negative.
    """
    amt = pkr(amount)
    if amt <= 0:
        return resolve_financial_account(db, account_id, payment_method)

    acc = resolve_financial_account(db, account_id, payment_method)
    arr = (arrangement or "WALLET").strip().upper()

    if arr in ("OWNER_CAPITAL", "MARKET_LOAN"):
        clean_lender = (lender_name or ("Owner Pocket Capital" if arr == "OWNER_CAPITAL" else "Market Loan / Udhaar")).strip()
        loan_rec = db.query(LoanAccount).filter(
            LoanAccount.lender_name.ilike(clean_lender),
            LoanAccount.loan_type == arr
        ).first()
        if not loan_rec:
            loan_rec = LoanAccount(
                lender_name=clean_lender,
                loan_type=arr,
                total_borrowed=0.0,
                total_repaid=0.0,
                current_balance=0.0,
                notes=f"Created via {reference_no}"
            )
            db.add(loan_rec)
            db.flush()

        loan_rec.total_borrowed = pkr(loan_rec.total_borrowed + amt)
        loan_rec.current_balance = pkr(loan_rec.current_balance + amt)
        loan_rec.updated_at = datetime.utcnow()

        tx_in_no = f"ARR-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        db.add(AccountTransaction(
            tx_number=tx_in_no,
            tx_type="OWNER CAPITAL INJECTION" if arr == "OWNER_CAPITAL" else "MARKET LOAN INFLOW",
            account_id=acc.id if acc else None,
            channel=acc.type if acc else payment_method.upper(),
            party=clean_lender,
            reference_id=loan_rec.id,
            description=f"Arranged PKR {amt:,.0f} from {clean_lender} for {reference_no} ({party_name})",
            cash_in=amt,
            cash_out=0.0
        ))

        tx_out_no = f"OUT-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        db.add(AccountTransaction(
            tx_number=tx_out_no,
            tx_type="ARRANGED PAYMENT OUTFLOW",
            account_id=acc.id if acc else None,
            channel=acc.type if acc else payment_method.upper(),
            party=party_name,
            reference_id=reference_id,
            description=f"{description} [Paid via {clean_lender}]",
            cash_in=0.0,
            cash_out=amt
        ))
        return acc

    # Standard WALLET outflow: strictly check balance so it never goes negative
    if not acc:
        raise HTTPException(status_code=400, detail="No active Financial Account found. Please create an account first.")

    avail = pkr(acc.current_balance)
    if avail < amt:
        shortfall = pkr(amt - avail)
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient balance in '{acc.name}' (Available: PKR {avail:,.0f}, Required: PKR {amt:,.0f}, "
                f"Shortfall: PKR {shortfall:,.0f}). Please switch Payment Account, select 'Owner Pocket / Capital' "
                f"or 'Market Loan / Udhaar' in Payment Arrangement, or record as Credit/Khata."
            )
        )

    acc.current_balance = pkr(avail - amt)
    return acc


def resolve_or_create_brand(db: Session, company_name: Optional[str], default_brand_id: int = 1) -> Brand:
    if company_name and company_name.strip():
        clean_co = company_name.strip()
        brand = db.query(Brand).filter(Brand.name.ilike(clean_co)).first()
        if not brand:
            brand = Brand(
                code=f"BR-{uuid.uuid4().hex[:4].upper()}",
                name=clean_co,
                is_owned_brand=("ATH" in clean_co.upper())
            )
            db.add(brand)
            db.flush()
        return brand
    brand = db.query(Brand).filter(Brand.id == default_brand_id).first()
    if not brand:
        brand = db.query(Brand).first()
        if not brand:
            brand = Brand(code="BR-ATH", name="ATH Oils", is_owned_brand=True)
            db.add(brand)
            db.flush()
    return brand


def resolve_or_create_party_group(
    db: Session,
    group_id: Optional[int],
    group_name: Optional[str],
    party_type: str = "CUSTOMER",
    city: Optional[str] = None
) -> PartyGroup:
    ptype = (party_type or "CUSTOMER").strip().upper()
    default_name = "General Market" if ptype == "CUSTOMER" else "General Suppliers"

    if group_id:
        grp = db.query(PartyGroup).filter(PartyGroup.id == group_id).first()
        if grp:
            return grp

    clean_name = (group_name or default_name).strip() or default_name
    grp = db.query(PartyGroup).filter(
        PartyGroup.name.ilike(clean_name),
        PartyGroup.party_type == ptype
    ).first()
    if not grp:
        grp = PartyGroup(
            code=f"GRP-{uuid.uuid4().hex[:4].upper()}",
            name=clean_name,
            party_type=ptype,
            city=(city or "").strip() or None
        )
        db.add(grp)
        db.flush()
    return grp


def normalize_cnic_str(raw: Optional[str]) -> str:
    """Strips all non-digits from a CNIC string (e.g. '37104-1234567-1' -> '3710412345671')."""
    if not raw:
        return ""
    return re.sub(r"\D+", "", str(raw))


def normalize_phone_str(raw: Optional[str]) -> str:
    """Normalizes Pakistani & international phone formats ('+92 300 1234567', '00923001234567', '0300-1234567' -> '03001234567')."""
    if not raw:
        return ""
    digits = re.sub(r"\D+", "", str(raw))
    if digits.startswith("0092") and len(digits) >= 12:
        digits = "0" + digits[4:]
    elif digits.startswith("92") and len(digits) == 12:
        digits = "0" + digits[2:]
    elif len(digits) == 10 and digits.startswith("3"):
        digits = "0" + digits
    return digits


def normalize_party_text(raw: Optional[str]) -> str:
    """Normalizes names, cities/villages, and groups for case and whitespace."""
    if not raw:
        return ""
    return " ".join(str(raw).strip().lower().split())


def resolve_customer_multifactor(
    db: Session,
    customer_id: Optional[int],
    customer_name: Optional[str],
    customer_phone: Optional[str],
    customer_cnic: Optional[str],
    customer_city: Optional[str],
    grp: PartyGroup,
    mark_favorite: Optional[bool] = None,
    force_create_new: bool = False
) -> Customer:
    """
    Multi-factor Customer Identity Matcher:
    1. If customer_id (> 0) is explicitly selected and not force_create_new -> returns that exact customer.
    2. CNIC is the strongest identifier: exact normalized CNIC match links to that customer; conflicting CNIC blocks auto-merging.
    3. Normalized Phone + Name + City/Group disambiguates same-name customers (Scenario A vs Scenario B).
    4. Never auto-merges two customers with conflicting CNIC, Phone, or Village/City.
    """
    if customer_id and customer_id > 0 and not force_create_new:
        existing = db.query(Customer).filter(Customer.id == customer_id).first()
        if existing:
            if mark_favorite is True:
                existing.is_favorite = True
            if customer_cnic and not (existing.cnic or "").strip():
                existing.cnic = customer_cnic.strip()
            if customer_phone and not (existing.phone or "").strip():
                existing.phone = customer_phone.strip()
            return existing

    clean_name = (customer_name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Please enter a Customer / Dealership name or select from the Customer list.")

    norm_name = normalize_party_text(clean_name)
    norm_cnic = normalize_cnic_str(customer_cnic)
    norm_phone = normalize_phone_str(customer_phone)
    clean_city = (customer_city or "Local").strip() or "Local"
    norm_city = normalize_party_text(clean_city)

    all_customers = db.query(Customer).order_by(Customer.id.asc()).all()

    # 1. Strongest check: CNIC match
    if len(norm_cnic) >= 5:
        cnic_matches = [c for c in all_customers if normalize_cnic_str(c.cnic) == norm_cnic]
        if cnic_matches:
            matched_c = cnic_matches[0]
            if force_create_new:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"CNIC {customer_cnic} already belongs to existing customer '{matched_c.name}' "
                        f"({matched_c.city}, ID #{matched_c.id}). Two separate customers cannot share the same CNIC."
                    )
                )
            if mark_favorite is True:
                matched_c.is_favorite = True
            return matched_c

    # 2. If user explicitly confirmed creating a separate person (Scenario B: two people with the same name)
    if force_create_new:
        new_cus = Customer(
            code=f"CUS-{uuid.uuid4().hex[:4].upper()}",
            name=clean_name,
            phone=(customer_phone or "").strip() or None,
            cnic=(customer_cnic or "").strip() or None,
            group_id=grp.id,
            group_name=grp.name,
            city=clean_city,
            credit_limit=50000.0,
            opening_receivable=0.0,
            current_receivable=0.0,
            is_favorite=bool(mark_favorite) if mark_favorite is not None else False
        )
        db.add(new_cus)
        db.flush()
        return new_cus

    # 3. Evaluate same-name candidates using CNIC, Phone, Village/City, and Group
    same_name_cands = [c for c in all_customers if normalize_party_text(c.name) == norm_name]
    if not same_name_cands:
        new_cus = Customer(
            code=f"CUS-{uuid.uuid4().hex[:4].upper()}",
            name=clean_name,
            phone=(customer_phone or "").strip() or None,
            cnic=(customer_cnic or "").strip() or None,
            group_id=grp.id,
            group_name=grp.name,
            city=clean_city,
            credit_limit=50000.0,
            opening_receivable=0.0,
            current_receivable=0.0,
            is_favorite=bool(mark_favorite) if mark_favorite is not None else False
        )
        db.add(new_cus)
        db.flush()
        return new_cus

    compatible_cands = []
    for cand in same_name_cands:
        cand_cnic = normalize_cnic_str(cand.cnic)
        cand_phone = normalize_phone_str(cand.phone)
        cand_city = normalize_party_text(cand.city)

        # If both have CNIC and they differ -> definitely different people
        if norm_cnic and cand_cnic and norm_cnic != cand_cnic:
            continue
        # If both have Phone and they differ -> different or conflicting
        if norm_phone and cand_phone and norm_phone != cand_phone:
            continue
        # If user specified a real city/village and candidate has a different real city/village (and neither CNIC nor Phone matched)
        if norm_city not in ("", "local") and cand_city not in ("", "local") and norm_city != cand_city:
            if not (norm_phone and cand_phone == norm_phone):
                continue

        compatible_cands.append(cand)

    if len(compatible_cands) == 1:
        chosen = compatible_cands[0]
        cand_cnic = normalize_cnic_str(chosen.cnic)
        cand_phone = normalize_phone_str(chosen.phone)
        # If existing customer has a CNIC or Phone, and user typed a NEW CNIC or Phone or left them blank when multiple same-name people might exist:
        # We only auto-link if Phone matches, or CNIC matches, or City+Group match with no conflicting identifiers.
        if mark_favorite is True:
            chosen.is_favorite = True
        if customer_cnic and not cand_cnic:
            chosen.cnic = customer_cnic.strip()
        if customer_phone and not cand_phone:
            chosen.phone = customer_phone.strip()
        return chosen

    # Ambiguous or conflicting same-name customer(s) exist! Do NOT auto-merge silently.
    cand_descriptions = [
        f"{c.name} (ID #{c.id}, City: {c.city}, Group: {c.group_name}, Phone: {c.phone or 'N/A'}, CNIC: {c.cnic or 'N/A'})"
        for c in same_name_cands
    ]
    raise HTTPException(
        status_code=409,
        detail=(
            f"Identity Confirmation Required: Customer name '{clean_name}' matches existing record(s) with different or ambiguous identifiers: "
            f"{'; '.join(cand_descriptions)}. Please either select the existing customer from the suggestion banner, "
            f"or click '+ Create as Separate New Customer' if this is a different person."
        )
    )


def resolve_supplier_multifactor(
    db: Session,
    supplier_id: Optional[int],
    supplier_name: Optional[str],
    supplier_phone: Optional[str],
    supplier_cnic: Optional[str],
    supplier_city: Optional[str],
    grp: PartyGroup,
    mark_favorite: Optional[bool] = None,
    force_create_new: bool = False
) -> Supplier:
    """Multi-factor Supplier Identity Matcher (CNIC, Normalized Phone, Name, City, Group)."""
    if supplier_id and supplier_id > 0 and not force_create_new:
        existing = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if existing:
            if mark_favorite is True:
                existing.is_favorite = True
            if supplier_cnic and not (existing.cnic or "").strip():
                existing.cnic = supplier_cnic.strip()
            if supplier_phone and not (existing.phone or "").strip():
                existing.phone = supplier_phone.strip()
            return existing

    clean_name = (supplier_name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Please enter a Supplier name or select from the Supplier list.")

    norm_name = normalize_party_text(clean_name)
    norm_cnic = normalize_cnic_str(supplier_cnic)
    norm_phone = normalize_phone_str(supplier_phone)
    clean_city = (supplier_city or "Local").strip() or "Local"
    norm_city = normalize_party_text(clean_city)

    all_suppliers = db.query(Supplier).order_by(Supplier.id.asc()).all()

    if len(norm_cnic) >= 5:
        cnic_matches = [s for s in all_suppliers if normalize_cnic_str(s.cnic) == norm_cnic]
        if cnic_matches:
            matched_s = cnic_matches[0]
            if force_create_new:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"CNIC {supplier_cnic} already belongs to existing supplier '{matched_s.name}' "
                        f"({matched_s.city}, ID #{matched_s.id})."
                    )
                )
            if mark_favorite is True:
                matched_s.is_favorite = True
            return matched_s

    if force_create_new:
        new_sup = Supplier(
            code=f"SUP-{uuid.uuid4().hex[:4].upper()}",
            name=clean_name,
            phone=(supplier_phone or "").strip() or None,
            cnic=(supplier_cnic or "").strip() or None,
            group_id=grp.id,
            group_name=grp.name,
            city=clean_city,
            opening_payable=0.0,
            current_payable=0.0,
            is_favorite=bool(mark_favorite) if mark_favorite is not None else False
        )
        db.add(new_sup)
        db.flush()
        return new_sup

    same_name_cands = [s for s in all_suppliers if normalize_party_text(s.name) == norm_name]
    if not same_name_cands:
        new_sup = Supplier(
            code=f"SUP-{uuid.uuid4().hex[:4].upper()}",
            name=clean_name,
            phone=(supplier_phone or "").strip() or None,
            cnic=(supplier_cnic or "").strip() or None,
            group_id=grp.id,
            group_name=grp.name,
            city=clean_city,
            opening_payable=0.0,
            current_payable=0.0,
            is_favorite=bool(mark_favorite) if mark_favorite is not None else False
        )
        db.add(new_sup)
        db.flush()
        return new_sup

    compatible_cands = []
    for cand in same_name_cands:
        cand_cnic = normalize_cnic_str(cand.cnic)
        cand_phone = normalize_phone_str(cand.phone)
        cand_city = normalize_party_text(cand.city)

        if norm_cnic and cand_cnic and norm_cnic != cand_cnic:
            continue
        if norm_phone and cand_phone and norm_phone != cand_phone:
            continue
        if norm_city not in ("", "local") and cand_city not in ("", "local") and norm_city != cand_city:
            if not (norm_phone and cand_phone == norm_phone):
                continue

        compatible_cands.append(cand)

    if len(compatible_cands) == 1:
        chosen = compatible_cands[0]
        if mark_favorite is True:
            chosen.is_favorite = True
        if supplier_cnic and not normalize_cnic_str(chosen.cnic):
            chosen.cnic = supplier_cnic.strip()
        if supplier_phone and not normalize_phone_str(chosen.phone):
            chosen.phone = supplier_phone.strip()
        return chosen

    cand_descriptions = [
        f"{s.name} (ID #{s.id}, City: {s.city}, Group: {s.group_name}, Phone: {s.phone or 'N/A'}, CNIC: {s.cnic or 'N/A'})"
        for s in same_name_cands
    ]
    raise HTTPException(
        status_code=409,
        detail=(
            f"Identity Confirmation Required: Supplier name '{clean_name}' matches existing record(s) with different or ambiguous identifiers: "
            f"{'; '.join(cand_descriptions)}. Please select the existing supplier or click '+ Create as Separate New Supplier'."
        )
    )


def recompute_customer_authoritative_receivable(db: Session, customer: Customer) -> float:
    """Calculates customer's exact outstanding balance from persisted unpaid/partial SALE bills + opening balance."""
    unpaid_bills_sum = sum(
        pkr(s.receivable_amount)
        for s in db.query(Sale).filter(
            Sale.customer_id == customer.id,
            Sale.doc_type == "SALE"
        ).all()
    )
    opening_bal = pkr(customer.opening_receivable)
    customer.current_receivable = pkr(max(0.0, opening_bal + unpaid_bills_sum))
    return customer.current_receivable


def recompute_supplier_authoritative_payable(db: Session, supplier: Supplier) -> float:
    """Calculates supplier's exact payable balance from persisted unpaid/partial PURCHASE bills + opening balance."""
    unpaid_bills_sum = sum(
        pkr(p.payable_amount)
        for p in db.query(Purchase).filter(
            Purchase.supplier_id == supplier.id,
            Purchase.doc_type == "PURCHASE"
        ).all()
    )
    opening_bal = pkr(supplier.opening_payable)
    supplier.current_payable = pkr(max(0.0, opening_bal + unpaid_bills_sum))
    return supplier.current_payable


def reconcile_overpaid_bills_and_party_balances(db: Session) -> bool:
    """
    Self-healing accounting reconciliation:
    1. Fixes any Purchase bill where paid_amount > total_amount by cascading the excess payment
       onto older unpaid purchase bills for the same supplier and updating closing_payable.
    2. Fixes any Sale bill where received_amount > total_amount so received_amount reflects the
       bill's own settled amount while applied_to_previous holds the old-khata settlement.
    3. Recomputes authoritative Customer receivable and Supplier payable balances.
    """
    changed = False

    # 1. Reconcile Suppliers & Purchases
    for sup in db.query(Supplier).all():
        purs = (
            db.query(Purchase)
            .filter(Purchase.supplier_id == sup.id, Purchase.doc_type == "PURCHASE")
            .order_by(Purchase.invoice_date.asc(), Purchase.id.asc())
            .all()
        )
        for idx, p in enumerate(purs):
            tot = pkr(p.total_amount)
            paid = pkr(p.paid_amount)
            if paid > tot:
                excess = pkr(paid - tot)
                p.paid_amount = tot
                p.payable_amount = 0.0
                p.payment_status = "PAID"
                already_applied = pkr(getattr(p, "applied_to_previous", 0.0))
                rem_excess = pkr(max(0.0, excess - already_applied))
                applied_now = already_applied
                if rem_excess > 0:
                    for old_p in purs[:idx]:
                        if rem_excess <= 0:
                            break
                        old_rem = pkr(old_p.payable_amount)
                        if old_rem > 0:
                            deduct = pkr(min(old_rem, rem_excess))
                            old_p.paid_amount = pkr(old_p.paid_amount + deduct)
                            old_p.payable_amount = pkr(old_rem - deduct)
                            old_p.payment_status = "PAID" if old_p.payable_amount <= 0 else "PARTIAL"
                            applied_now = pkr(applied_now + deduct)
                            rem_excess = pkr(rem_excess - deduct)
                p.applied_to_previous = applied_now
                changed = True

        prev_sup_pay = pkr(sup.current_payable)
        new_sup_pay = recompute_supplier_authoritative_payable(db, sup)
        if prev_sup_pay != new_sup_pay:
            changed = True

    # 2. Reconcile Customers & Sales
    for cus in db.query(Customer).all():
        sales_list = (
            db.query(Sale)
            .filter(Sale.customer_id == cus.id, Sale.doc_type == "SALE")
            .order_by(Sale.invoice_date.asc(), Sale.id.asc())
            .all()
        )
        for s in sales_list:
            tot = pkr(s.total_amount)
            rec = pkr(s.received_amount)
            app_prev = pkr(getattr(s, "applied_to_previous", 0.0))
            prev_d = pkr(getattr(s, "previous_dues", 0.0))
            if rec > tot:
                # Cap bill's own received_amount at total_amount so it doesn't double-count with applied_to_previous
                if app_prev <= 0:
                    s.applied_to_previous = pkr(rec - tot)
                s.received_amount = tot
                s.receivable_amount = 0.0
                s.payment_status = "PAID"
                changed = True
            expected_grand = pkr(tot + prev_d) if (prev_d > 0 or getattr(s, "include_previous_dues", False)) else tot
            if pkr(getattr(s, "grand_payable", 0.0)) != expected_grand:
                s.grand_payable = expected_grand
                changed = True

        prev_cus_rec = pkr(cus.current_receivable)
        new_cus_rec = recompute_customer_authoritative_receivable(db, cus)
        if prev_cus_rec != new_cus_rec:
            changed = True

    if changed:
        bump_version()
        db.commit()
    return changed


def resolve_or_create_product(
    db: Session,
    product_id: Optional[int],
    product_name: Optional[str],
    company_name: Optional[str],
    pack_size: Optional[float],
    units_per_carton: Optional[int],
    mark_fav: Optional[bool] = None
) -> Product:
    """
    Matches Product by ID or by (Name + Bottle Size) so 700ML and 1000ML of the same brand
    never overwrite each other. Never marks a product as favorite unless mark_fav is explicitly True.
    """
    target_size = float(pack_size) if (pack_size and pack_size > 0) else None
    prod = None

    if product_id:
        prod = db.query(Product).filter(Product.id == product_id).first()
        if prod and target_size and abs((prod.pack_size or 0) - target_size) > 0.01 and product_name:
            alt = db.query(Product).filter(
                Product.name.ilike(product_name.strip()),
                Product.pack_size == target_size
            ).first()
            if alt:
                prod = alt

    if not prod and product_name and product_name.strip():
        clean_name = product_name.strip()
        q = db.query(Product).filter(Product.name.ilike(clean_name))
        if target_size:
            prod = q.filter(Product.pack_size == target_size).first()
        if not prod:
            same_name_prods = q.all()
            if len(same_name_prods) == 1 and (not target_size or abs(same_name_prods[0].pack_size - target_size) < 0.01):
                prod = same_name_prods[0]

        if not prod:
            brand = resolve_or_create_brand(db, company_name, 1)
            upc_val = int(units_per_carton) if (units_per_carton and units_per_carton > 0) else 12
            size_val = target_size if target_size else 700.0
            prod = Product(
                sku=f"SKU-{uuid.uuid4().hex[:4].upper()}",
                name=clean_name,
                brand_id=brand.id if brand else 1,
                viscosity_grade="20W-50 4T",
                pack_size=size_val,
                pack_unit="ML",
                units_per_carton=upc_val,
                purchase_rate=0.0,
                sale_rate=0.0,
                carton_purchase_rate=0.0,
                carton_sale_rate=0.0,
                current_stock=0,
                reorder_level=12,
                is_favorite=bool(mark_fav) if mark_fav is not None else False
            )
            db.add(prod)
            db.flush()

    if not prod:
        raise HTTPException(status_code=400, detail="Please select or type a valid Product name.")

    if company_name and company_name.strip():
        brand = resolve_or_create_brand(db, company_name, prod.brand_id)
        if brand:
            prod.brand_id = brand.id

    if units_per_carton and units_per_carton > 0:
        prod.units_per_carton = int(units_per_carton)
    if mark_fav is True:
        prod.is_favorite = True

    return prod


def adjust_location_stock(db: Session, product: Product, location_id: int, delta_bottles: int):
    loc_stock = db.query(ProductLocationStock).filter(
        ProductLocationStock.product_id == product.id,
        ProductLocationStock.location_id == location_id
    ).first()

    if not loc_stock:
        loc_stock = ProductLocationStock(
            product_id=product.id,
            location_id=location_id,
            stock_bottles=0
        )
        db.add(loc_stock)
        db.flush()

    if loc_stock.stock_bottles + delta_bottles < 0:
        loc = db.query(StorageLocation).filter(StorageLocation.id == location_id).first()
        loc_name = loc.name if loc else f"Location #{location_id}"
        upc = max(1, product.units_per_carton or 12)

        other_stocks = db.query(ProductLocationStock).filter(
            ProductLocationStock.product_id == product.id,
            ProductLocationStock.location_id != location_id,
            ProductLocationStock.stock_bottles > 0
        ).all()

        if other_stocks:
            alt_list = []
            for os_row in other_stocks:
                os_loc = db.query(StorageLocation).filter(StorageLocation.id == os_row.location_id).first()
                os_name = os_loc.name if os_loc else f"Location #{os_row.location_id}"
                c_cnt = os_row.stock_bottles // upc
                l_cnt = os_row.stock_bottles % upc
                alt_list.append(f"{os_name} has {os_row.stock_bottles} Bottles ({c_cnt} Cartons + {l_cnt} Bottles)")
            raise HTTPException(
                status_code=400,
                detail=f"'{product.name}' is not available in '{loc_name}' (Available: {loc_stock.stock_bottles} Btls, Required: {abs(delta_bottles)} Btls). However, stock IS available in: {', '.join(alt_list)}. Please switch Dispatch Location!"
            )

        raise HTTPException(
            status_code=400,
            detail=f"Action Blocked! '{product.name}' is out of stock in '{loc_name}' (Available: {loc_stock.stock_bottles} Btls, Required: {abs(delta_bottles)} Btls) and has 0 stock in other locations."
        )

    loc_stock.stock_bottles += int(delta_bottles)
    db.flush()

    all_loc_stocks = db.query(ProductLocationStock).filter(ProductLocationStock.product_id == product.id).all()
    product.current_stock = sum(ls.stock_bottles for ls in all_loc_stocks)


# ==================== SNAPSHOT & BACKUP ENGINE ====================

def database_has_user_activity(db: Session) -> bool:
    return (
        db.query(Sale).count() > 0 or
        db.query(Purchase).count() > 0 or
        db.query(Expense).count() > 0 or
        db.query(AccountTransaction).count() > 0 or
        any((ls.stock_bottles or 0) > 0 for ls in db.query(ProductLocationStock).all()) or
        any(abs(a.current_balance or 0) > 0 for a in db.query(FinancialAccount).all()) or
        db.query(Customer).count() > 4 or
        db.query(Supplier).count() > 2
    )


def export_full_snapshot(db: Session, force_full: bool = False) -> Dict[str, Any]:
    global SERVER_STATE_VERSION
    # When connected to permanent PostgreSQL, skip dumping all 20 tables on normal API calls
    # (only dump all 20 tables when the user clicks 'Backup DB' where force_full=True).
    if IS_PERSISTENT_POSTGRES and not force_full:
        if SERVER_STATE_VERSION == 0:
            SERVER_STATE_VERSION = int(datetime.utcnow().timestamp() * 1000)
        return {"version": SERVER_STATE_VERSION, "persistent": True}

    if SERVER_STATE_VERSION == 0:
        # Cold-start seed DB gets version 1 so it NEVER overrides a client's real snapshot
        SERVER_STATE_VERSION = int(datetime.utcnow().timestamp() * 1000) if database_has_user_activity(db) else 1

    return {
        "version": SERVER_STATE_VERSION,
        "exported_at": datetime.utcnow().isoformat(),
        "admin_users": [
            {
                "id": u.id, "full_name": u.full_name, "email": u.email,
                "username": u.username, "password_hash": u.password_hash,
                "role": u.role, "approval_status": u.approval_status,
                "approved_by": u.approved_by,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None
            }
            for u in db.query(AdminUser).all()
        ],
        "brands": [
            {"id": b.id, "code": b.code, "name": b.name, "is_owned_brand": b.is_owned_brand}
            for b in db.query(Brand).all()
        ],
        "locations": [
            {"id": l.id, "code": l.code, "name": l.name, "location_type": l.location_type, "address": l.address}
            for l in db.query(StorageLocation).all()
        ],
        "party_groups": [
            {
                "id": g.id, "code": g.code, "name": g.name,
                "party_type": g.party_type, "city": g.city,
                "description": g.description, "is_active": g.is_active
            }
            for g in db.query(PartyGroup).all()
        ],
        "products": [
            {
                "id": p.id, "sku": p.sku, "name": p.name, "brand_id": p.brand_id,
                "viscosity_grade": p.viscosity_grade, "pack_size": p.pack_size,
                "pack_unit": p.pack_unit, "units_per_carton": p.units_per_carton,
                "purchase_rate": p.purchase_rate, "sale_rate": p.sale_rate,
                "carton_purchase_rate": getattr(p, "carton_purchase_rate", 0.0) or pkr(p.purchase_rate * max(1, p.units_per_carton)),
                "carton_sale_rate": getattr(p, "carton_sale_rate", 0.0) or pkr(p.sale_rate * max(1, p.units_per_carton)),
                "current_stock": p.current_stock, "reorder_level": p.reorder_level,
                "is_favorite": bool(getattr(p, "is_favorite", False))
            }
            for p in db.query(Product).all()
        ],
        "location_stocks": [
            {"id": ls.id, "product_id": ls.product_id, "location_id": ls.location_id, "stock_bottles": ls.stock_bottles}
            for ls in db.query(ProductLocationStock).all()
        ],
        "suppliers": [
            {
                "id": s.id, "code": s.code, "name": s.name, "contact_person": s.contact_person,
                "phone": s.phone, "cnic": getattr(s, "cnic", None),
                "group_id": getattr(s, "group_id", None),
                "group_name": getattr(s, "group_name", "General Suppliers") or "General Suppliers",
                "city": s.city, "address": s.address,
                "opening_payable": pkr(s.opening_payable),
                "current_payable": pkr(s.current_payable),
                "is_favorite": bool(getattr(s, "is_favorite", False))
            }
            for s in db.query(Supplier).all()
        ],
        "customers": [
            {
                "id": c.id, "code": c.code, "name": c.name, "contact_person": c.contact_person,
                "phone": c.phone, "cnic": getattr(c, "cnic", None),
                "group_id": getattr(c, "group_id", None),
                "group_name": getattr(c, "group_name", "General Market") or "General Market",
                "city": c.city, "address": c.address,
                "credit_limit": pkr(c.credit_limit),
                "opening_receivable": pkr(c.opening_receivable),
                "current_receivable": pkr(c.current_receivable),
                "advance_credit": pkr(getattr(c, "advance_credit", 0.0)),
                "is_favorite": bool(getattr(c, "is_favorite", False))
            }
            for c in db.query(Customer).all()
        ],
        "accounts": [
            {
                "id": a.id, "name": a.name, "type": a.type,
                "account_number": a.account_number, "current_balance": pkr(a.current_balance)
            }
            for a in db.query(FinancialAccount).all()
        ],
        "account_transactions": [
            {
                "id": t.id, "tx_number": t.tx_number, "tx_date": t.tx_date.isoformat(),
                "tx_type": t.tx_type, "account_id": t.account_id, "to_account_id": t.to_account_id,
                "channel": t.channel, "party": t.party,
                "reference_id": getattr(t, "reference_id", None),
                "admin_id": getattr(t, "admin_id", None),
                "admin_name": getattr(t, "admin_name", "Admin") or "Admin",
                "description": t.description,
                "cash_in": pkr(t.cash_in), "cash_out": pkr(t.cash_out)
            }
            for t in db.query(AccountTransaction).all()
        ],
        "loans": [
            {
                "id": ln.id, "lender_name": ln.lender_name, "loan_type": ln.loan_type,
                "phone": ln.phone, "total_borrowed": pkr(ln.total_borrowed),
                "total_repaid": pkr(ln.total_repaid), "current_balance": pkr(ln.current_balance),
                "notes": ln.notes, "updated_at": ln.updated_at.isoformat() if ln.updated_at else None
            }
            for ln in db.query(LoanAccount).all()
        ],
        "purchases": [
            {
                "id": p.id, "purchase_number": p.purchase_number,
                "doc_type": getattr(p, "doc_type", "PURCHASE") or "PURCHASE",
                "supplier_id": p.supplier_id,
                "invoice_date": p.invoice_date.isoformat(),
                "subtotal_amount": pkr(getattr(p, "subtotal_amount", p.total_amount)),
                "discount_amount": pkr(getattr(p, "discount_amount", 0.0)),
                "freight_amount": pkr(getattr(p, "freight_amount", 0.0)),
                "total_amount": pkr(p.total_amount),
                "previous_dues": pkr(getattr(p, "previous_dues", 0.0)),
                "paid_amount": pkr(p.paid_amount),
                "applied_to_previous": pkr(getattr(p, "applied_to_previous", 0.0)),
                "payable_amount": pkr(p.payable_amount),
                "closing_payable": pkr(getattr(p, "closing_payable", p.payable_amount)),
                "payment_status": p.payment_status,
                "payment_arrangement": getattr(p, "payment_arrangement", "WALLET") or "WALLET",
                "account_id": getattr(p, "account_id", None),
                "admin_id": getattr(p, "admin_id", None),
                "admin_name": getattr(p, "admin_name", "Admin") or "Admin",
                "remarks": p.remarks,
                "items": [
                    {
                        "product_id": i.product_id, "location_id": i.location_id,
                        "unit_type": i.unit_type, "quantity": i.quantity,
                        "units_per_carton": i.units_per_carton, "base_quantity": i.base_quantity,
                        "unit_rate": pkr(i.unit_rate), "line_total": pkr(i.line_total)
                    }
                    for i in p.items
                ]
            }
            for p in db.query(Purchase).all()
        ],
        "sales": [
            {
                "id": s.id, "invoice_number": s.invoice_number,
                "doc_type": getattr(s, "doc_type", "SALE") or "SALE",
                "customer_id": s.customer_id,
                "invoice_date": s.invoice_date.isoformat(),
                "subtotal_amount": pkr(getattr(s, "subtotal_amount", s.total_amount)),
                "discount_amount": pkr(getattr(s, "discount_amount", 0.0)),
                "freight_amount": pkr(getattr(s, "freight_amount", 0.0)),
                "total_amount": pkr(s.total_amount),
                "previous_dues": pkr(getattr(s, "previous_dues", 0.0)),
                "include_previous_dues": bool(getattr(s, "include_previous_dues", False)),
                "grand_payable": pkr(getattr(s, "grand_payable", s.total_amount)),
                "received_amount": pkr(s.received_amount),
                "applied_to_previous": pkr(getattr(s, "applied_to_previous", 0.0)),
                "receivable_amount": pkr(s.receivable_amount),
                "closing_receivable": pkr(getattr(s, "closing_receivable", s.receivable_amount)),
                "payment_status": s.payment_status,
                "account_id": getattr(s, "account_id", None),
                "admin_id": getattr(s, "admin_id", None),
                "admin_name": getattr(s, "admin_name", "Admin") or "Admin",
                "remarks": s.remarks,
                "items": [
                    {
                        "product_id": i.product_id, "location_id": i.location_id,
                        "unit_type": i.unit_type, "quantity": i.quantity,
                        "units_per_carton": i.units_per_carton, "base_quantity": i.base_quantity,
                        "unit_rate": pkr(i.unit_rate),
                        "cost_per_bottle": getattr(i, "cost_per_bottle", 0.0) or 0.0,
                        "line_cost": pkr(getattr(i, "line_cost", 0.0)),
                        "line_total": pkr(i.line_total)
                    }
                    for i in s.items
                ]
            }
            for s in db.query(Sale).all()
        ],
        "customer_payments": [
            {
                "id": pm.id, "payment_number": pm.payment_number,
                "idempotency_key": pm.idempotency_key,
                "customer_id": pm.customer_id,
                "payment_date": pm.payment_date.isoformat() if pm.payment_date else None,
                "payment_amount": pkr(pm.payment_amount),
                "allocated_amount": pkr(pm.allocated_amount),
                "unallocated_credit": pkr(pm.unallocated_credit),
                "outstanding_before": pkr(pm.outstanding_before),
                "outstanding_after": pkr(pm.outstanding_after),
                "payment_method": pm.payment_method,
                "account_id": pm.account_id,
                "admin_id": getattr(pm, "admin_id", None),
                "admin_name": getattr(pm, "admin_name", "Admin") or "Admin",
                "remarks": pm.remarks,
                "status": pm.status,
                "reversed_at": pm.reversed_at.isoformat() if pm.reversed_at else None,
                "reversal_reason": pm.reversal_reason,
                "allocations": [
                    {
                        "id": al.id, "sale_id": al.sale_id,
                        "invoice_number": al.invoice_number,
                        "bill_original_amount": pkr(al.bill_original_amount),
                        "outstanding_before": pkr(al.outstanding_before),
                        "allocated_amount": pkr(al.allocated_amount),
                        "remaining_after": pkr(al.remaining_after)
                    }
                    for al in pm.allocations
                ]
            }
            for pm in db.query(CustomerPayment).all()
        ],
        "expenses": [
            {
                "id": e.id, "expense_number": e.expense_number, "expense_date": e.expense_date.isoformat(),
                "category": e.category, "description": e.description, "payment_method": e.payment_method,
                "account_id": getattr(e, "account_id", None),
                "payment_arrangement": getattr(e, "payment_arrangement", "WALLET") or "WALLET",
                "amount": pkr(e.amount), "paid_to": e.paid_to, "reference": e.reference,
                "admin_id": getattr(e, "admin_id", None),
                "admin_name": getattr(e, "admin_name", "Admin") or "Admin"
            }
            for e in db.query(Expense).all()
        ],
        "recycle_bin": [
            {
                "id": r.id, "entity_type": r.entity_type, "entity_id": r.entity_id,
                "reference_code": r.reference_code, "title": r.title, "summary": r.summary,
                "amount": pkr(r.amount), "payload_json": r.payload_json,
                "deleted_at": r.deleted_at.isoformat()
            }
            for r in db.query(RecycleBin).all()
        ]
    }


def merge_admin_users_non_destructively(db: Session, snap_admins: List[Dict[str, Any]]):
    """Ensures registered/approved Admin accounts from any client snapshot are never lost."""
    if not snap_admins:
        return
    try:
        existing_admins = db.query(AdminUser).all()
        by_email = {a.email.strip().lower(): a for a in existing_admins if a.email}
        by_user = {a.username.strip().lower(): a for a in existing_admins if a.username}

        for u in snap_admins:
            u_email = (u.get("email") or "").strip().lower()
            u_user = (u.get("username") or "").strip().lower()
            if not u_email:
                continue
            match = by_email.get(u_email) or by_user.get(u_user)
            if match:
                # If either record is APPROVED, preserve APPROVED status
                if u.get("approval_status") == "APPROVED" and match.approval_status != "APPROVED":
                    match.approval_status = "APPROVED"
                    match.approved_by = u.get("approved_by") or SUPER_ADMIN_EMAIL
            else:
                new_adm = AdminUser(
                    full_name=u.get("full_name") or u_user or "Admin",
                    email=u_email,
                    username=u.get("username") or u_email.split("@")[0],
                    password_hash=u.get("password_hash") or "Admin@786",
                    role=u.get("role", "ADMIN"),
                    approval_status=u.get("approval_status", "PENDING"),
                    approved_by=u.get("approved_by"),
                    created_at=datetime.fromisoformat(u["created_at"]) if u.get("created_at") else datetime.utcnow(),
                    last_login_at=datetime.fromisoformat(u["last_login_at"]) if u.get("last_login_at") else None
                )
                db.add(new_adm)
                by_email[u_email] = new_adm
        db.commit()
    except Exception:
        db.rollback()


def restore_snapshot_data(db: Session, snap: Dict[str, Any], force: bool = False):
    """
    Restores a full snapshot into the database.
    - Rejects any legacy pre-wipe snapshot (containing malikabuzar411@gmail.com) so old browser caches can never re-inject test data.
    - Guarantees that cold-started containers ALWAYS hydrate from valid production snapshots.
    """
    global SERVER_STATE_VERSION
    if not snap or not isinstance(snap, dict):
        return

    snap_admins = snap.get("admin_users") or []
    if not force:
        has_legacy_admin = any(
            (u.get("email") or "").strip().lower() == "malikabuzar411@gmail.com"
            for u in snap_admins
        )
        if has_legacy_admin:
            return

    # Always merge valid production AdminUser accounts non-destructively
    if snap_admins:
        merge_admin_users_non_destructively(db, snap_admins)

    # On permanent PostgreSQL, only allow snapshot restoration when:
    # 1. The user explicitly imports a backup JSON file (force=True), OR
    # 2. The PostgreSQL database is brand new (0 transactions) and is hydrating once from existing client data.
    if not is_sqlite and not force:
        if database_has_user_activity(db):
            return

    client_ver = int(snap.get("version") or 0)
    server_has_activity = database_has_user_activity(db)

    server_tx_count = (
        db.query(Sale).count() +
        db.query(Purchase).count() +
        db.query(Expense).count() +
        db.query(CustomerPayment).count()
    )
    client_tx_count = (
        len(snap.get("sales") or []) +
        len(snap.get("purchases") or []) +
        len(snap.get("expenses") or []) +
        len(snap.get("customer_payments") or [])
    )

    client_has_activity = (
        client_tx_count > 0 or
        len(snap.get("account_transactions") or []) > 0 or
        any((ls.get("stock_bottles") or 0) > 0 for ls in (snap.get("location_stocks") or [])) or
        any(abs(a.get("current_balance") or 0) > 0 for a in (snap.get("accounts") or [])) or
        len(snap.get("customers") or []) > 4 or
        len(snap.get("suppliers") or []) > 2
    )

    # Never overwrite an active server DB with an empty client snapshot unless forced
    if not force and server_has_activity and not client_has_activity:
        return

    # CRITICAL PROTECTION: Never allow a snapshot with FEWER sales/purchases/expenses
    # to overwrite a server DB that has MORE recorded transactions!
    if not force and server_tx_count > client_tx_count:
        return

    # If the server already has at least as many transactions AND is at or ahead of client_ver, no restore needed
    if not force and server_has_activity and server_tx_count >= client_tx_count and SERVER_STATE_VERSION >= client_ver and client_ver > 0:
        return

    # Preserve existing server admins in memory before table refresh so no admin is ever dropped
    preserved_server_admins = [
        {
            "id": a.id, "full_name": a.full_name, "email": a.email,
            "username": a.username, "password_hash": a.password_hash,
            "role": a.role, "approval_status": a.approval_status,
            "approved_by": a.approved_by,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "last_login_at": a.last_login_at.isoformat() if a.last_login_at else None
        }
        for a in db.query(AdminUser).all()
    ]

    try:
        if is_sqlite:
            db.execute(text("PRAGMA foreign_keys=OFF"))

        for tbl in [
            "customer_payment_allocations", "customer_payments",
            "sale_items", "sales", "purchase_items", "purchases",
            "product_location_stocks", "stock_movements", "products",
            "brands", "storage_locations", "suppliers", "customers", "party_groups",
            "account_transactions", "loan_accounts", "financial_accounts", "expenses", "recycle_bin"
        ]:
            try:
                db.execute(text(f"DELETE FROM {tbl}"))
            except Exception:
                pass
        db.flush()

        if snap.get("admin_users") or preserved_server_admins:
            try:
                db.execute(text("DELETE FROM admin_users"))
                db.flush()
                merged_admins_map: Dict[str, Dict[str, Any]] = {}
                for u in (preserved_server_admins + (snap.get("admin_users") or [])):
                    em = (u.get("email") or "").strip().lower()
                    if not em:
                        continue
                    if em in merged_admins_map:
                        if u.get("approval_status") == "APPROVED":
                            merged_admins_map[em]["approval_status"] = "APPROVED"
                            merged_admins_map[em]["approved_by"] = u.get("approved_by") or SUPER_ADMIN_EMAIL
                    else:
                        merged_admins_map[em] = dict(u)
                for idx_u, u in enumerate(merged_admins_map.values(), start=1):
                    db.add(AdminUser(
                        id=u.get("id") or idx_u,
                        full_name=u["full_name"],
                        email=u["email"],
                        username=u["username"],
                        password_hash=u["password_hash"],
                        role=u.get("role", "ADMIN"),
                        approval_status=u.get("approval_status", "PENDING"),
                        approved_by=u.get("approved_by"),
                        created_at=datetime.fromisoformat(u["created_at"]) if u.get("created_at") else datetime.utcnow(),
                        last_login_at=datetime.fromisoformat(u["last_login_at"]) if u.get("last_login_at") else None
                    ))
            except Exception:
                pass

        # 1. Insert Parent / Lookup Tables First
        for b in snap.get("brands", []):
            db.add(Brand(id=b["id"], code=b["code"], name=b["name"], is_owned_brand=b.get("is_owned_brand", False)))
        for l in snap.get("locations", []):
            db.add(StorageLocation(id=l["id"], code=l["code"], name=l["name"], location_type=l.get("location_type", "WAREHOUSE"), address=l.get("address")))
        for g in snap.get("party_groups", []):
            db.add(PartyGroup(
                id=g["id"], code=g["code"], name=g["name"],
                party_type=g.get("party_type", "CUSTOMER"),
                city=g.get("city"), description=g.get("description"),
                is_active=bool(g.get("is_active", True))
            ))
        for a in snap.get("accounts", []):
            db.add(FinancialAccount(
                id=a["id"], name=a["name"], type=a["type"],
                account_number=a.get("account_number"), current_balance=pkr(a.get("current_balance", 0.0))
            ))
        db.flush()

        # 2. Insert Suppliers & Customers
        for s in snap.get("suppliers", []):
            db.add(Supplier(
                id=s["id"], code=s["code"], name=s["name"], contact_person=s.get("contact_person"),
                phone=s.get("phone"), cnic=s.get("cnic"),
                group_id=s.get("group_id"),
                group_name=s.get("group_name", "General Suppliers"),
                city=s.get("city", "Local"), address=s.get("address"),
                opening_payable=pkr(s.get("opening_payable", 0.0)),
                current_payable=pkr(s.get("current_payable", 0.0)),
                is_favorite=bool(s.get("is_favorite", False))
            ))
        for c in snap.get("customers", []):
            db.add(Customer(
                id=c["id"], code=c["code"], name=c["name"], contact_person=c.get("contact_person"),
                phone=c.get("phone"), cnic=c.get("cnic"),
                group_id=c.get("group_id"),
                group_name=c.get("group_name", "General Market"),
                city=c.get("city", "Local"), address=c.get("address"),
                credit_limit=pkr(c.get("credit_limit", 50000.0)),
                opening_receivable=pkr(c.get("opening_receivable", 0.0)),
                current_receivable=pkr(c.get("current_receivable", 0.0)),
                advance_credit=pkr(c.get("advance_credit", 0.0)),
                is_favorite=bool(c.get("is_favorite", False))
            ))
        db.flush()

        # 3. Insert Products & Location Stocks
        for p in snap.get("products", []):
            upc_v = max(1, int(p.get("units_per_carton", 12)))
            p_rate = float(p.get("purchase_rate", 0.0))
            s_rate = float(p.get("sale_rate", 0.0))
            db.add(Product(
                id=p["id"], sku=p["sku"], name=p["name"], brand_id=p.get("brand_id", 1),
                viscosity_grade=p.get("viscosity_grade", "20W-50 4T"), pack_size=p.get("pack_size", 700),
                pack_unit=p.get("pack_unit", "ML"), units_per_carton=upc_v,
                purchase_rate=p_rate, sale_rate=s_rate,
                carton_purchase_rate=pkr(p.get("carton_purchase_rate") or (p_rate * upc_v)),
                carton_sale_rate=pkr(p.get("carton_sale_rate") or (s_rate * upc_v)),
                current_stock=p.get("current_stock", 0), reorder_level=p.get("reorder_level", 12),
                is_favorite=bool(p.get("is_favorite", False))
            ))
        db.flush()
        for ls in snap.get("location_stocks", []):
            db.add(ProductLocationStock(id=ls["id"], product_id=ls["product_id"], location_id=ls["location_id"], stock_bottles=ls["stock_bottles"]))

        # 4. Insert Loans, Transactions, Purchases, Sales, Expenses & Recycle Bin Last
        for ln in snap.get("loans", []):
            db.add(LoanAccount(
                id=ln["id"], lender_name=ln["lender_name"], loan_type=ln.get("loan_type", "MARKET_LOAN"),
                phone=ln.get("phone"), total_borrowed=pkr(ln.get("total_borrowed", 0.0)),
                total_repaid=pkr(ln.get("total_repaid", 0.0)), current_balance=pkr(ln.get("current_balance", 0.0)),
                notes=ln.get("notes"),
                updated_at=datetime.fromisoformat(ln["updated_at"]) if ln.get("updated_at") else datetime.utcnow()
            ))
        for t in snap.get("account_transactions", []):
            db.add(AccountTransaction(
                id=t["id"], tx_number=t["tx_number"],
                tx_date=datetime.fromisoformat(t["tx_date"]) if t.get("tx_date") else datetime.utcnow(),
                tx_type=t["tx_type"], account_id=t.get("account_id"), to_account_id=t.get("to_account_id"),
                channel=t.get("channel", "CASH"), party=t.get("party"),
                reference_id=t.get("reference_id"), description=t.get("description"),
                cash_in=pkr(t.get("cash_in", 0.0)), cash_out=pkr(t.get("cash_out", 0.0)),
                admin_id=t.get("admin_id"),
                admin_name=t.get("admin_name", "Admin") or "Admin"
            ))
        for p in snap.get("purchases", []):
            pur = Purchase(
                id=p["id"], purchase_number=p["purchase_number"],
                doc_type=p.get("doc_type", "PURCHASE"),
                supplier_id=p["supplier_id"],
                invoice_date=datetime.fromisoformat(p["invoice_date"]) if p.get("invoice_date") else datetime.utcnow(),
                subtotal_amount=pkr(p.get("subtotal_amount", p["total_amount"])),
                discount_amount=pkr(p.get("discount_amount", 0.0)),
                freight_amount=pkr(p.get("freight_amount", 0.0)),
                total_amount=pkr(p["total_amount"]),
                previous_dues=pkr(p.get("previous_dues", 0.0)),
                paid_amount=pkr(p["paid_amount"]),
                applied_to_previous=pkr(p.get("applied_to_previous", 0.0)),
                payable_amount=pkr(p["payable_amount"]),
                closing_payable=pkr(p.get("closing_payable", p["payable_amount"])),
                payment_status=p["payment_status"],
                payment_arrangement=p.get("payment_arrangement", "WALLET"),
                account_id=p.get("account_id"),
                admin_id=p.get("admin_id"),
                admin_name=p.get("admin_name", "Admin") or "Admin",
                remarks=p.get("remarks")
            )
            db.add(pur)
            db.flush()
            for i in p.get("items", []):
                db.add(PurchaseItem(
                    purchase_id=pur.id, product_id=i["product_id"], location_id=i.get("location_id"),
                    unit_type=i["unit_type"], quantity=i["quantity"], units_per_carton=i["units_per_carton"],
                    base_quantity=i["base_quantity"], unit_rate=pkr(i["unit_rate"]), line_total=pkr(i["line_total"])
                ))
        for s in snap.get("sales", []):
            sal = Sale(
                id=s["id"], invoice_number=s["invoice_number"],
                doc_type=s.get("doc_type", "SALE"),
                customer_id=s["customer_id"],
                invoice_date=datetime.fromisoformat(s["invoice_date"]) if s.get("invoice_date") else datetime.utcnow(),
                subtotal_amount=pkr(s.get("subtotal_amount", s["total_amount"])),
                discount_amount=pkr(s.get("discount_amount", 0.0)),
                freight_amount=pkr(s.get("freight_amount", 0.0)),
                total_amount=pkr(s["total_amount"]),
                previous_dues=pkr(s.get("previous_dues", 0.0)),
                include_previous_dues=bool(s.get("include_previous_dues", False)),
                grand_payable=pkr(s.get("grand_payable", s["total_amount"])),
                received_amount=pkr(s["received_amount"]),
                applied_to_previous=pkr(s.get("applied_to_previous", 0.0)),
                receivable_amount=pkr(s["receivable_amount"]),
                closing_receivable=pkr(s.get("closing_receivable", s["receivable_amount"])),
                payment_status=s["payment_status"],
                account_id=s.get("account_id"),
                admin_id=s.get("admin_id"),
                admin_name=s.get("admin_name", "Admin") or "Admin",
                remarks=s.get("remarks")
            )
            db.add(sal)
            db.flush()
            for i in s.get("items", []):
                db.add(SaleItem(
                    sale_id=sal.id, product_id=i["product_id"], location_id=i.get("location_id"),
                    unit_type=i["unit_type"], quantity=i["quantity"], units_per_carton=i["units_per_carton"],
                    base_quantity=i["base_quantity"], unit_rate=pkr(i["unit_rate"]),
                    cost_per_bottle=float(i.get("cost_per_bottle", 0.0)),
                    line_cost=pkr(i.get("line_cost", 0.0)),
                    line_total=pkr(i["line_total"])
                ))
        for pm in snap.get("customer_payments", []):
            pay_row = CustomerPayment(
                id=pm["id"], payment_number=pm["payment_number"],
                idempotency_key=pm.get("idempotency_key"),
                customer_id=pm["customer_id"],
                payment_date=datetime.fromisoformat(pm["payment_date"]) if pm.get("payment_date") else datetime.utcnow(),
                payment_amount=pkr(pm["payment_amount"]),
                allocated_amount=pkr(pm.get("allocated_amount", 0.0)),
                unallocated_credit=pkr(pm.get("unallocated_credit", 0.0)),
                outstanding_before=pkr(pm.get("outstanding_before", 0.0)),
                outstanding_after=pkr(pm.get("outstanding_after", 0.0)),
                payment_method=pm.get("payment_method", "CASH"),
                account_id=pm.get("account_id"),
                admin_id=pm.get("admin_id"),
                admin_name=pm.get("admin_name", "Admin") or "Admin",
                remarks=pm.get("remarks"),
                status=pm.get("status", "CONFIRMED"),
                reversed_at=datetime.fromisoformat(pm["reversed_at"]) if pm.get("reversed_at") else None,
                reversal_reason=pm.get("reversal_reason")
            )
            db.add(pay_row)
            db.flush()
            for al in pm.get("allocations", []):
                db.add(CustomerPaymentAllocation(
                    payment_id=pay_row.id,
                    sale_id=al["sale_id"],
                    invoice_number=al["invoice_number"],
                    bill_original_amount=pkr(al["bill_original_amount"]),
                    outstanding_before=pkr(al["outstanding_before"]),
                    allocated_amount=pkr(al["allocated_amount"]),
                    remaining_after=pkr(al["remaining_after"])
                ))
        for e in snap.get("expenses", []):
            db.add(Expense(
                id=e["id"], expense_number=e["expense_number"],
                expense_date=datetime.fromisoformat(e["expense_date"]) if e.get("expense_date") else datetime.utcnow(),
                category=e["category"], description=e.get("description"),
                payment_method=e.get("payment_method", "CASH"),
                account_id=e.get("account_id"),
                payment_arrangement=e.get("payment_arrangement", "WALLET"),
                amount=pkr(e["amount"]), paid_to=e.get("paid_to"), reference=e.get("reference"),
                admin_id=e.get("admin_id"),
                admin_name=e.get("admin_name", "Admin") or "Admin"
            ))
        for r in snap.get("recycle_bin", []):
            db.add(RecycleBin(
                id=r["id"], entity_type=r["entity_type"], entity_id=r["entity_id"],
                reference_code=r["reference_code"], title=r["title"], summary=r.get("summary"),
                amount=pkr(r.amount) if hasattr(r, "amount") else 0.0, payload_json=r["payload_json"],
                deleted_at=datetime.fromisoformat(r["deleted_at"]) if r.get("deleted_at") else datetime.utcnow()
            ))

        db.commit()

        # On PostgreSQL, synchronize SERIAL primary-key sequences after explicit ID inserts
        # so subsequent INSERTs never fail with duplicate primary key errors.
        if not is_sqlite:
            for seq_tbl in [
                "admin_users", "brands", "storage_locations", "party_groups", "products",
                "product_location_stocks", "suppliers", "customers", "financial_accounts",
                "loan_accounts", "account_transactions", "purchases", "purchase_items",
                "sales", "sale_items", "customer_payments", "customer_payment_allocations",
                "expenses", "recycle_bin", "stock_movements"
            ]:
                try:
                    db.execute(text(
                        f"SELECT setval(pg_get_serial_sequence('{seq_tbl}', 'id'), "
                        f"COALESCE((SELECT MAX(id) FROM {seq_tbl}), 1), "
                        f"(SELECT COUNT(*) > 0 FROM {seq_tbl}));"
                    ))
                except Exception:
                    pass
            db.commit()

        # Preserve the exact client_ver (unless forced backup import) so an older browser tab
        # never gets stamped with a new timestamp that blocks a newer browser tab's snapshot!
        if force or client_ver <= 1:
            SERVER_STATE_VERSION = int(datetime.utcnow().timestamp() * 1000)
        else:
            SERVER_STATE_VERSION = max(SERVER_STATE_VERSION, client_ver)
    except Exception as exc:
        db.rollback()
        print("Snapshot restore warning:", exc)
    finally:
        if is_sqlite:
            db.execute(text("PRAGMA foreign_keys=ON"))


def sync_from_client_snapshot_if_newer(db: Session, snap: Optional[Dict[str, Any]]):
    # CRITICAL PERFORMANCE & DURABILITY FIX:
    # When connected to permanent PostgreSQL (Neon), the server database is the single source of truth.
    # We completely ignore client localStorage snapshots during normal requests to eliminate network lag.
    if IS_PERSISTENT_POSTGRES:
        return
    if snap:
        restore_snapshot_data(db, snap, force=False)


# ==================== UNIFIED SINGLE-REQUEST BOOTSTRAP & BACKUP ====================

SUPER_ADMIN_EMAIL = "malikwaseemhassan448@gmail.com"
SUPER_ADMIN_USERNAME = "Malik Waseem"
SUPER_ADMIN_DEFAULT_PASS = "abuzuraiz"
PROD_RESET_MARKER = "PROD_CLEAN_SLATE_V2"


def validate_strong_password_backend(pw: str):
    clean = (pw or "").strip()
    if len(clean) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    if not re.search(r"[A-Z]", clean):
        raise HTTPException(status_code=400, detail="Password must contain at least one capital letter (A-Z).")
    if not re.search(r"[a-z]", clean):
        raise HTTPException(status_code=400, detail="Password must contain at least one small letter (a-z).")
    if not re.search(r"[0-9]", clean):
        raise HTTPException(status_code=400, detail="Password must contain at least one number (0-9).")
    if not re.search(r"[^A-Za-z0-9]", clean):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character (e.g. @, #, $, %, !, _, *).")


def ensure_super_admin_exists(db: Session) -> AdminUser:
    """
    Guarantees a 100% clean-slate production database stamped with PROD_CLEAN_SLATE_V2.
    - If 'Malik Waseem' with PROD_CLEAN_SLATE_V2 already exists AND legacy 'Malik Abuzar' / 'Admin' is gone,
      returns immediately without touching any data (safe across all future logins and restarts).
    - Otherwise, wipes all legacy test data and seeds Malik Waseem + 0 balances.
    """
    su = db.query(AdminUser).filter(
        AdminUser.email.ilike(SUPER_ADMIN_EMAIL),
        AdminUser.approved_by == PROD_RESET_MARKER
    ).first()
    has_legacy_abuzar = db.query(AdminUser).filter(
        (AdminUser.email.ilike("malikabuzar411@gmail.com")) |
        (AdminUser.username.ilike("Admin")) |
        (AdminUser.full_name.ilike("%Malik Abuzar%"))
    ).first()
    if su and not has_legacy_abuzar:
        return su

    try:
        if is_sqlite:
            db.execute(text("PRAGMA foreign_keys=OFF"))

        for tbl in [
            "customer_payment_allocations", "customer_payments",
            "sale_items", "sales", "purchase_items", "purchases",
            "product_location_stocks", "stock_movements", "products",
            "brands", "storage_locations", "suppliers", "customers", "party_groups",
            "account_transactions", "loan_accounts", "financial_accounts", "expenses",
            "recycle_bin", "admin_users"
        ]:
            try:
                db.execute(text(f"DELETE FROM {tbl}"))
            except Exception:
                db.rollback()
        db.flush()

        # 1. Seed Primary Super Admin (Malik Waseem)
        su = AdminUser(
            full_name="Malik Waseem",
            email=SUPER_ADMIN_EMAIL,
            username=SUPER_ADMIN_USERNAME,
            password_hash=SUPER_ADMIN_DEFAULT_PASS,
            role="SUPER_ADMIN",
            approval_status="APPROVED",
            approved_by=PROD_RESET_MARKER,
            created_at=now_pkt()
        )
        db.add(su)

        # 2. Seed Single Default Storage Location (Main Warehouse)
        db.add(StorageLocation(
            code="LOC-MAIN",
            name="Main Warehouse",
            location_type="WAREHOUSE",
            address="Main Facility"
        ))

        # 3. Seed Default Brand
        db.add(Brand(code="BR-ATH", name="ATH Oils", is_owned_brand=True))

        # 4. Seed Default Financial Accounts at PKR 0
        db.add_all([
            FinancialAccount(name="Main Shop Cash Drawer", type="CASH", account_number="CASH-01", current_balance=0.0),
            FinancialAccount(name="Habib Bank Limited (HBL)", type="BANK", account_number="PK45HABB00123456789", current_balance=0.0),
            FinancialAccount(name="Easypaisa Business Wallet", type="EASYPAISA", account_number="0312-5130252", current_balance=0.0),
            FinancialAccount(name="JazzCash Merchant Wallet", type="JAZZCASH", account_number="0304-5464807", current_balance=0.0),
        ])

        # 5. Seed Default Party Groups
        db.add_all([
            PartyGroup(code="GRP-CUST", name="General Market", party_type="CUSTOMER", city="All Cities"),
            PartyGroup(code="GRP-SUPP", name="General Suppliers", party_type="SUPPLIER", city="All Cities"),
        ])

        db.commit()
        sync_postgres_sequences(db)
        db.refresh(su)
        return su
    except Exception as exc:
        db.rollback()
        print("Clean-slate initialization warning:", exc)
        fallback = db.query(AdminUser).filter(AdminUser.email.ilike(SUPER_ADMIN_EMAIL)).first()
        if fallback:
            return fallback
        su = AdminUser(
            full_name="Malik Waseem",
            email=SUPER_ADMIN_EMAIL,
            username=SUPER_ADMIN_USERNAME,
            password_hash=SUPER_ADMIN_DEFAULT_PASS,
            role="SUPER_ADMIN",
            approval_status="APPROVED",
            approved_by=PROD_RESET_MARKER
        )
        db.add(su)
        db.commit()
        db.refresh(su)
        return su
    finally:
        if is_sqlite:
            try:
                db.execute(text("PRAGMA foreign_keys=ON"))
            except Exception:
                pass


@app.post("/api/bootstrap")
def bootstrap_erp(payload: BootstrapRequest, db: Session = Depends(get_db)):
    global SERVER_STATE_VERSION
    ensure_super_admin_exists(db)
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    consolidate_default_locations(db)
    if SERVER_STATE_VERSION == 0:
        sync_postgres_sequences(db)
        SERVER_STATE_VERSION = int(datetime.utcnow().timestamp() * 1000) if database_has_user_activity(db) else 1
    reconcile_overpaid_bills_and_party_balances(db)

    period = payload.period if payload.period in ("daily", "weekly", "monthly", "all") else "monthly"
    custom_date = (getattr(payload, "custom_date", None) or "").strip() or None
    effective_period = custom_date if custom_date else period
    channel = payload.channel or "ALL"

    all_sales_serialized = list_sales(
        period="all",
        doc_type="ALL",
        customer_id=None,
        location_id=None,
        payment_status="ALL",
        search="",
        db=db
    )
    all_purchases_serialized = list_purchases(period="all", db=db)

    start_dt, end_dt = get_period_bounds(effective_period)
    if start_dt or end_dt:
        period_sales = list_sales(
            period=effective_period,
            doc_type="ALL",
            customer_id=None,
            location_id=None,
            payment_status="ALL",
            search="",
            db=db
        )
        period_purchases = list_purchases(period=effective_period, db=db)
    else:
        period_sales = all_sales_serialized
        period_purchases = all_purchases_serialized

    pending_sales_all = [
        s for s in all_sales_serialized
        if pkr(s.get("receivable_amount", 0)) > 0 and s.get("doc_type") != "ESTIMATE"
    ]
    pending_purchases_all = [
        p for p in all_purchases_serialized
        if pkr(p.get("payable_amount", 0)) > 0
    ]

    result = {
        "active_period": effective_period,
        "stats": get_dashboard_stats(period=effective_period, db=db),
        "locations": list_locations(db=db),
        "products": list_products(db=db),
        "party_groups": search_party_groups(q="", party_type="ALL", limit=50, offset=0, db=db)["items"],
        "customers": list_customers(q="", group_id=None, db=db),
        "suppliers": list_suppliers(db=db),
        "sales": period_sales,
        "purchases": period_purchases,
        "pending_sales": pending_sales_all,
        "pending_purchases": pending_purchases_all,
        "expenses": list_expenses(period=effective_period, db=db),
        "accounts": list_financial_accounts(db=db),
        "loans": list_loans(db=db),
        "account_history": get_accounts_history(period=effective_period, channel=channel, db=db),
        "recycle_bin": list_recycle_bin(db=db),
        "vyapar_reports": get_vyapar_reports(period=effective_period, db=db),
        "admins": list_admin_users(db=db),
        "partner_transparency": get_partner_transparency_stats(period=effective_period, db=db),
        "snapshot": export_full_snapshot(db)
    }
    return result


@app.get("/api/backup/export")
def export_backup_file(db: Session = Depends(get_db)):
    return export_full_snapshot(db, force_full=True)


@app.post("/api/backup/import")
def import_backup_file(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    snap = payload.get("snapshot") or payload
    if not isinstance(snap, dict) or "products" not in snap:
        raise HTTPException(status_code=400, detail="Invalid backup JSON structure.")
    restore_snapshot_data(db, snap, force=True)
    bump_version()
    return {
        "status": "restored",
        "message": "Full database backup restored successfully!",
        "snapshot": export_full_snapshot(db)
    }


# ==================== MULTI-ADMIN AUTHENTICATION, GMAIL SIGNUP, LOGIN & PASSWORD RESET ====================

@app.post("/api/auth/signup")
def admin_signup(payload: AdminSignupRequest, db: Session = Depends(get_db)):
    ensure_super_admin_exists(db)
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    clean_email = (payload.email or "").strip().lower()
    clean_name = (payload.full_name or "").strip()
    clean_user = (payload.username or clean_email.split("@")[0]).strip()
    clean_pw = (payload.password or "").strip()

    if not clean_name:
        raise HTTPException(status_code=400, detail="Please enter your full name.")
    if not clean_email or "@" not in clean_email:
        raise HTTPException(
            status_code=400,
            detail="Please register using a valid email address."
        )

    validate_strong_password_backend(clean_pw)

    existing_by_email = db.query(AdminUser).filter(AdminUser.email.ilike(clean_email)).first()
    if existing_by_email:
        if existing_by_email.approval_status == "APPROVED":
            raise HTTPException(
                status_code=400,
                detail=f"The account '{clean_email}' is already registered and approved. Please switch to Sign In."
            )
        elif existing_by_email.approval_status == "PENDING":
            raise HTTPException(
                status_code=400,
                detail=f"The account '{clean_email}' is already registered and awaiting approval."
            )
        else:
            raise HTTPException(
                status_code=403,
                detail=f"The registration request for '{clean_email}' was declined."
            )

    existing_by_user = db.query(AdminUser).filter(AdminUser.username.ilike(clean_user)).first()
    if existing_by_user:
        raise HTTPException(
            status_code=400,
            detail=f"Username '{clean_user}' is already taken. Please choose a different username."
        )

    is_owner = (clean_email == SUPER_ADMIN_EMAIL)
    new_admin = AdminUser(
        full_name=clean_name,
        email=clean_email,
        username=clean_user,
        password_hash=clean_pw,
        role="SUPER_ADMIN" if is_owner else (payload.role or "ADMIN").upper(),
        approval_status="APPROVED" if is_owner else "PENDING",
        approved_by=PROD_RESET_MARKER if is_owner else None,
        created_at=now_pkt()
    )
    db.add(new_admin)
    bump_version()
    db.commit()
    db.refresh(new_admin)

    return {
        "status": "approved" if is_owner else "pending_approval",
        "message": (
            f"Registration submitted for {clean_name}! "
            f"Your partner account request has been sent for authorization. "
            f"Once approved, sign in using your email or username '{clean_user}'."
        ),
        "admin": {
            "id": new_admin.id,
            "full_name": new_admin.full_name,
            "email": new_admin.email,
            "username": new_admin.username,
            "role": new_admin.role,
            "approval_status": new_admin.approval_status
        },
        "snapshot": export_full_snapshot(db)
    }


@app.post("/api/auth/login")
def admin_login(payload: LoginRequest, db: Session = Depends(get_db)):
    ident = (payload.username or "").strip()
    pw = (payload.password or "").strip()
    if not ident or not pw:
        raise HTTPException(status_code=400, detail="Please enter both your email/username and password.")

    ensure_super_admin_exists(db)
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)

    try:
        user = db.query(AdminUser).filter(
            (AdminUser.email.ilike(ident)) | (AdminUser.username.ilike(ident))
        ).first()
    except Exception:
        db.rollback()
        user = db.query(AdminUser).filter(
            (AdminUser.email.ilike(ident)) | (AdminUser.username.ilike(ident))
        ).first()

    if not user or user.password_hash != pw:
        raise HTTPException(status_code=401, detail="Invalid email/username or password.")

    if user.approval_status == "PENDING":
        raise HTTPException(
            status_code=403,
            detail="Approval Pending: Your partner account is awaiting authorization."
        )

    if user.approval_status == "NOT_APPROVED":
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Your registration request was not approved."
        )

    try:
        user.last_login_at = now_pkt()
        db.commit()
    except Exception:
        db.rollback()

    is_super = (user.email.lower() == SUPER_ADMIN_EMAIL or user.role == "SUPER_ADMIN")
    # Return full bootstrap payload inside login response so the Dashboard renders in 0ms without a second round-trip!
    boot_data = bootstrap_erp(BootstrapRequest(period="all", channel="ALL", client_snapshot=None), db=db)
    return {
        "status": "authenticated",
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "approval_status": user.approval_status,
        "is_super_admin": is_super,
        "bootstrap": boot_data,
        "snapshot": boot_data.get("snapshot")
    }


@app.post("/api/auth/reset-password")
def reset_partner_password(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    ensure_super_admin_exists(db)
    sync_from_client_snapshot_if_newer(db, payload.get("client_snapshot"))
    ident = str(payload.get("username") or payload.get("email") or "").strip()
    ver_code = str(payload.get("verification_code") or "").strip()
    new_pw = str(payload.get("new_password") or "").strip()

    if not ident:
        raise HTTPException(status_code=400, detail="Please enter your registered email address or username.")
    if ver_code != "Admin@786":
        raise HTTPException(status_code=403, detail="Invalid verification code. Authorization denied.")

    validate_strong_password_backend(new_pw)

    user = db.query(AdminUser).filter(
        (AdminUser.email.ilike(ident)) | (AdminUser.username.ilike(ident))
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"No partner account found matching '{ident}'.")

    user.password_hash = new_pw
    bump_version()
    db.commit()

    return {
        "status": "password_reset",
        "username": user.username,
        "email": user.email,
        "message": f"Password updated successfully for '{user.username}'! You can now sign in with your new password.",
        "snapshot": export_full_snapshot(db)
    }


@app.get("/api/auth/admins")
def list_admin_users(db: Session = Depends(get_db)):
    ensure_super_admin_exists(db)
    users = db.query(AdminUser).order_by(AdminUser.id.asc()).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "username": u.username,
            "role": u.role,
            "approval_status": u.approval_status,
            "approved_by": u.approved_by,
            "is_super_admin": (u.email.lower() == SUPER_ADMIN_EMAIL or u.role == "SUPER_ADMIN"),
            "created_at": u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "",
            "last_login_at": u.last_login_at.strftime("%Y-%m-%d %H:%M") if u.last_login_at else "Never"
        }
        for u in users
    ]


@app.post("/api/auth/admins/{admin_id}/decision")
def decide_admin_approval(
    admin_id: int,
    payload: AdminApprovalDecisionRequest,
    db: Session = Depends(get_db)
):
    approver_ident = (payload.approver_email or "").strip().lower()
    approver = db.query(AdminUser).filter(
        (AdminUser.email.ilike(approver_ident)) | (AdminUser.username.ilike(approver_ident))
    ).first()
    if approver_ident != SUPER_ADMIN_EMAIL and (not approver or approver.role != "SUPER_ADMIN"):
        raise HTTPException(
            status_code=403,
            detail="Only the primary portal manager is authorized to approve or reject registrations."
        )

    target = db.query(AdminUser).filter(AdminUser.id == admin_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Partner registration record not found.")

    if target.email.lower() == SUPER_ADMIN_EMAIL or target.role == "SUPER_ADMIN":
        raise HTTPException(status_code=400, detail="Primary account is permanently approved.")

    target.approval_status = payload.decision.upper()
    target.approved_by = approver.full_name if approver else "Malik Waseem"
    bump_version()
    db.commit()

    return {
        "status": "updated",
        "message": f"Partner '{target.full_name}' marked as {target.approval_status}!",
        "admins": list_admin_users(db=db),
        "snapshot": export_full_snapshot(db)
    }


@app.get("/api/admins/transparency")
def get_partner_transparency_stats(
    period: str = Query("monthly"),
    db: Session = Depends(get_db)
):
    """
    Computes 100% transparent business partner metrics for every Partner:
    Individual Sales, Purchases, Cash Deposits, Expenses, Customer Collections, and Recent Activity.
    """
    ensure_super_admin_exists(db)
    start_dt, end_dt = get_period_bounds(period)

    sales_q = db.query(Sale).options(joinedload(Sale.customer)).filter(Sale.doc_type != "ESTIMATE")
    purchases_q = db.query(Purchase).options(joinedload(Purchase.supplier))
    expenses_q = db.query(Expense)
    tx_q = db.query(AccountTransaction)

    if start_dt:
        sales_q = sales_q.filter(Sale.invoice_date >= start_dt)
        purchases_q = purchases_q.filter(Purchase.invoice_date >= start_dt)
        expenses_q = expenses_q.filter(Expense.expense_date >= start_dt)
        tx_q = tx_q.filter(AccountTransaction.tx_date >= start_dt)
    if end_dt:
        sales_q = sales_q.filter(Sale.invoice_date < end_dt)
        purchases_q = purchases_q.filter(Purchase.invoice_date < end_dt)
        expenses_q = expenses_q.filter(Expense.expense_date < end_dt)
        tx_q = tx_q.filter(AccountTransaction.tx_date < end_dt)

    sales_rows = sales_q.all()
    pur_rows = purchases_q.all()
    exp_rows = expenses_q.all()
    tx_rows = tx_q.all()

    approved_admins = db.query(AdminUser).filter(AdminUser.approval_status == "APPROVED").order_by(AdminUser.id.asc()).all()
    admin_map: Dict[str, Dict[str, Any]] = {}

    for u in approved_admins:
        key = f"ID:{u.id}"
        admin_map[key] = {
            "admin_id": u.id,
            "full_name": u.full_name,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "sales_total": 0.0,
            "sales_collected": 0.0,
            "sales_count": 0,
            "purchases_total": 0.0,
            "purchases_paid": 0.0,
            "purchases_count": 0,
            "deposits_total": 0.0,
            "withdrawals_total": 0.0,
            "deposits_count": 0,
            "expenses_total": 0.0,
            "expenses_count": 0,
            "recent_activities": []
        }

    def resolve_bucket(adm_id: Optional[int], adm_name: Optional[str]) -> Dict[str, Any]:
        if adm_id and f"ID:{adm_id}" in admin_map:
            return admin_map[f"ID:{adm_id}"]
        clean_n = (adm_name or "Malik Waseem").strip().lower()
        for b in admin_map.values():
            if b["username"].lower() == clean_n or b["full_name"].lower() == clean_n or b["email"].lower() == clean_n:
                return b
        first_key = next(iter(admin_map.keys()), None)
        if first_key:
            return admin_map[first_key]
        admin_map["DEFAULT"] = {
            "admin_id": 1, "full_name": "Malik Waseem", "username": "Malik Waseem",
            "email": SUPER_ADMIN_EMAIL, "role": "SUPER_ADMIN",
            "sales_total": 0.0, "sales_collected": 0.0, "sales_count": 0,
            "purchases_total": 0.0, "purchases_paid": 0.0, "purchases_count": 0,
            "deposits_total": 0.0, "withdrawals_total": 0.0, "deposits_count": 0,
            "expenses_total": 0.0, "expenses_count": 0, "recent_activities": []
        }
        return admin_map["DEFAULT"]

    for s in sales_rows:
        b = resolve_bucket(getattr(s, "admin_id", None), getattr(s, "admin_name", None))
        sign = -1.0 if getattr(s, "doc_type", "SALE") == "SALE_RETURN" else 1.0
        later_settled = get_sale_later_settled_amount(db, s.id, s.invoice_number)
        initial_direct = pkr(max(0.0, pkr(s.received_amount) - later_settled))
        app_prev = pkr(getattr(s, "applied_to_previous", 0.0))
        has_cpay_atx = any(
            t.party == (s.customer.name if s.customer else "") and s.invoice_number in (t.description or "")
            for t in tx_rows
        )
        legacy_prev_inflow = 0.0 if has_cpay_atx else app_prev

        b["sales_total"] = pkr(b["sales_total"] + sign * pkr(s.total_amount))
        b["sales_collected"] = pkr(b["sales_collected"] + sign * (initial_direct + legacy_prev_inflow))
        b["sales_count"] += 1
        if initial_direct + legacy_prev_inflow > 0:
            b["deposits_total"] = pkr(b["deposits_total"] + sign * (initial_direct + legacy_prev_inflow))
            b["deposits_count"] += 1
        b["recent_activities"].append({
            "date": s.invoice_date.strftime("%Y-%m-%d %H:%M"),
            "timestamp": s.invoice_date.isoformat(),
            "type": "SALE",
            "reference": s.invoice_number,
            "party": s.customer.name if s.customer else "Customer",
            "amount": pkr(s.total_amount)
        })

    for p in pur_rows:
        b = resolve_bucket(getattr(p, "admin_id", None), getattr(p, "admin_name", None))
        sign = -1.0 if getattr(p, "doc_type", "PURCHASE") == "PURCHASE_RETURN" else 1.0
        later_pur_paid = get_purchase_later_settled_amount(db, p.id)
        initial_pur_paid = pkr(max(0.0, pkr(p.paid_amount) - later_pur_paid))
        app_prev_pur = pkr(getattr(p, "applied_to_previous", 0.0))
        has_ppay_atx = any(
            p.purchase_number in (t.description or "") and t.tx_type == "SUPPLIER KHATA PAYMENT"
            for t in tx_rows
        )
        legacy_pur_prev = 0.0 if has_ppay_atx else app_prev_pur

        b["purchases_total"] = pkr(b["purchases_total"] + sign * pkr(p.total_amount))
        b["purchases_paid"] = pkr(b["purchases_paid"] + sign * (initial_pur_paid + legacy_pur_prev))
        b["purchases_count"] += 1
        b["recent_activities"].append({
            "date": p.invoice_date.strftime("%Y-%m-%d %H:%M"),
            "timestamp": p.invoice_date.isoformat(),
            "type": "PURCHASE",
            "reference": p.purchase_number,
            "party": p.supplier.name if p.supplier else "Supplier",
            "amount": pkr(p.total_amount)
        })

    for e in exp_rows:
        b = resolve_bucket(getattr(e, "admin_id", None), getattr(e, "admin_name", None))
        b["expenses_total"] = pkr(b["expenses_total"] + pkr(e.amount))
        b["expenses_count"] += 1
        b["recent_activities"].append({
            "date": e.expense_date.strftime("%Y-%m-%d %H:%M"),
            "timestamp": e.expense_date.isoformat(),
            "type": "EXPENSE",
            "reference": e.expense_number,
            "party": e.paid_to or e.category,
            "amount": pkr(e.amount)
        })

    for t in tx_rows:
        if t.tx_type in ("CUSTOMER PAYMENT ALLOCATION", "CUSTOMER KHATA COLLECTION", "PREVIOUS KHATA COLLECTION"):
            b_col = resolve_bucket(getattr(t, "admin_id", None), getattr(t, "admin_name", None))
            b_col["sales_collected"] = pkr(b_col["sales_collected"] + pkr(t.cash_in))
        if t.tx_type in (
            "CASH DEPOSIT", "CASH WITHDRAWAL", "ACCOUNT TRANSFER",
            "CUSTOMER PAYMENT ALLOCATION", "CUSTOMER KHATA COLLECTION", "PREVIOUS KHATA COLLECTION"
        ):
            b = resolve_bucket(getattr(t, "admin_id", None), getattr(t, "admin_name", None))
            if t.cash_in > 0:
                b["deposits_total"] = pkr(b["deposits_total"] + pkr(t.cash_in))
                b["deposits_count"] += 1
            if t.cash_out > 0 and t.tx_type == "CASH WITHDRAWAL":
                b["withdrawals_total"] = pkr(b["withdrawals_total"] + pkr(t.cash_out))
            b["recent_activities"].append({
                "date": t.tx_date.strftime("%Y-%m-%d %H:%M"),
                "timestamp": t.tx_date.isoformat(),
                "type": t.tx_type,
                "reference": t.tx_number,
                "party": t.party or "Account",
                "amount": pkr(max(t.cash_in, t.cash_out))
            })

    for b in admin_map.values():
        b["recent_activities"].sort(key=lambda x: x["timestamp"], reverse=True)
        b["recent_activities"] = b["recent_activities"][:25]

    return list(admin_map.values())


# ==================== DASHBOARD KPI STATS (100% WHOLE PKR MATH) ====================

def compute_sale_item_exact_cost(item: SaleItem) -> float:
    """Calculates exact whole-PKR cost for a SaleItem without decimal division drift."""
    saved_line_cost = getattr(item, "line_cost", 0.0) or 0.0
    if saved_line_cost > 0:
        return pkr(saved_line_cost)

    upc = max(1, item.units_per_carton or (item.product.units_per_carton if item.product else 12))
    prod = item.product
    if prod:
        ctn_buy = getattr(prod, "carton_purchase_rate", 0.0) or 0.0
        btl_buy = prod.purchase_rate or 0.0
        if item.unit_type == "CARTON" and ctn_buy > 0:
            return pkr(item.quantity * ctn_buy)
        if ctn_buy > 0:
            return pkr((item.base_quantity / upc) * ctn_buy)
        if btl_buy > 0:
            return pkr(item.base_quantity * btl_buy)

    cost_btl = getattr(item, "cost_per_bottle", 0.0) or 0.0
    if cost_btl > 0:
        return pkr(item.base_quantity * cost_btl)
    return 0.0


@app.get("/api/dashboard/stats")
def get_dashboard_stats(
    period: str = Query("monthly"),
    db: Session = Depends(get_db)
):
    start_dt, end_dt = get_period_bounds(period)

    products = db.query(Product).all()
    total_stock_bottles = sum(p.current_stock for p in products)
    total_stock_value = 0.0
    for p in products:
        upc = max(1, p.units_per_carton or 12)
        ctn_rate = getattr(p, "carton_purchase_rate", 0.0) or pkr(p.purchase_rate * upc)
        if ctn_rate > 0:
            total_stock_value += pkr((p.current_stock / upc) * ctn_rate)
        else:
            total_stock_value += pkr(p.current_stock * p.purchase_rate)

    customers = db.query(Customer).all()
    total_receivable = sum(pkr(c.current_receivable) for c in customers)

    suppliers = db.query(Supplier).all()
    total_payable = sum(pkr(s.current_payable) for s in suppliers)

    accounts = db.query(FinancialAccount).all()
    total_cash_bank = sum(pkr(a.current_balance) for a in accounts)

    loans = db.query(LoanAccount).all()
    total_loan_payable = sum(pkr(ln.current_balance) for ln in loans)

    sales_q = db.query(Sale).options(selectinload(Sale.items).joinedload(SaleItem.product))
    purchases_q = db.query(Purchase)
    expenses_q = db.query(Expense)

    if start_dt:
        sales_q = sales_q.filter(Sale.invoice_date >= start_dt)
        purchases_q = purchases_q.filter(Purchase.invoice_date >= start_dt)
        expenses_q = expenses_q.filter(Expense.expense_date >= start_dt)
    if end_dt:
        sales_q = sales_q.filter(Sale.invoice_date < end_dt)
        purchases_q = purchases_q.filter(Purchase.invoice_date < end_dt)
        expenses_q = expenses_q.filter(Expense.expense_date < end_dt)

    all_sales_list = sales_q.all()
    # Exclude non-finalized Estimates from revenue & COGS
    active_sales = [s for s in all_sales_list if getattr(s, "doc_type", "SALE") != "ESTIMATE"]
    purchases_list = purchases_q.all()
    expenses_list = expenses_q.all()

    period_sales_revenue = 0.0
    period_sales_collected = 0.0
    period_sales_pending = 0.0
    cogs = 0.0

    tx_q = db.query(AccountTransaction)
    if start_dt:
        tx_q = tx_q.filter(AccountTransaction.tx_date >= start_dt)
    if end_dt:
        tx_q = tx_q.filter(AccountTransaction.tx_date < end_dt)
    period_txs = tx_q.all()

    for s in active_sales:
        dtype = getattr(s, "doc_type", "SALE") or "SALE"
        sign = -1.0 if dtype == "SALE_RETURN" else 1.0
        later_settled = get_sale_later_settled_amount(db, s.id, s.invoice_number)
        initial_direct = pkr(max(0.0, pkr(s.received_amount) - later_settled))
        app_prev = pkr(getattr(s, "applied_to_previous", 0.0))
        has_cpay_atx = any(
            s.invoice_number in (t.description or "") and t.tx_type == "PREVIOUS KHATA COLLECTION"
            for t in period_txs
        )
        legacy_prev = 0.0 if has_cpay_atx else app_prev

        period_sales_revenue += sign * pkr(s.total_amount)
        period_sales_collected += sign * (initial_direct + legacy_prev)
        if dtype == "SALE":
            period_sales_pending += pkr(s.receivable_amount)
        for item in s.items:
            cogs += sign * compute_sale_item_exact_cost(item)

    # Add dated customer collections (CPAY, RCV, PREVIOUS KHATA COLLECTION) received during this period
    for t in period_txs:
        if t.tx_type in ("CUSTOMER PAYMENT ALLOCATION", "CUSTOMER KHATA COLLECTION", "PREVIOUS KHATA COLLECTION"):
            period_sales_collected = pkr(period_sales_collected + pkr(t.cash_in))

    period_purchases_cost = 0.0
    period_purchases_paid = 0.0
    period_purchases_pending = 0.0
    for p in purchases_list:
        dtype = getattr(p, "doc_type", "PURCHASE") or "PURCHASE"
        sign = -1.0 if dtype == "PURCHASE_RETURN" else 1.0
        later_pur_paid = get_purchase_later_settled_amount(db, p.id)
        initial_pur_paid = pkr(max(0.0, pkr(p.paid_amount) - later_pur_paid))
        app_prev_pur = pkr(getattr(p, "applied_to_previous", 0.0))
        has_ppay_atx = any(
            p.purchase_number in (t.description or "") and t.tx_type == "SUPPLIER KHATA PAYMENT"
            for t in period_txs
        )
        legacy_pur_prev = 0.0 if has_ppay_atx else app_prev_pur

        period_purchases_cost += sign * pkr(p.total_amount)
        period_purchases_paid += sign * (initial_pur_paid + legacy_pur_prev)
        if dtype == "PURCHASE":
            period_purchases_pending += pkr(p.payable_amount)

    # Add dated supplier khata payments (PPAY) made during this period
    for t in period_txs:
        if t.tx_type == "SUPPLIER KHATA PAYMENT":
            period_purchases_paid = pkr(period_purchases_paid + pkr(t.cash_out))

    period_expenses = sum(pkr(e.amount) for e in expenses_list)

    gross_profit = pkr(period_sales_revenue - cogs)
    net_profit = pkr(gross_profit - period_expenses)
    trash_count = db.query(RecycleBin).count()

    return {
        "period": period,
        "total_stock_bottles": total_stock_bottles,
        "total_stock_value": pkr(total_stock_value),
        "total_receivable": pkr(total_receivable),
        "total_payable": pkr(total_payable),
        "total_loan_payable": pkr(total_loan_payable),
        "total_cash_bank": pkr(total_cash_bank),
        "total_sales_revenue": pkr(period_sales_revenue),
        "sales_collected": pkr(period_sales_collected),
        "sales_pending": pkr(period_sales_pending),
        "sales_count": len(active_sales),
        "total_purchases_cost": pkr(period_purchases_cost),
        "purchases_paid": pkr(period_purchases_paid),
        "purchases_pending": pkr(period_purchases_pending),
        "purchases_count": len(purchases_list),
        "total_expenses": pkr(period_expenses),
        "expenses_count": len(expenses_list),
        "estimated_gross_profit": gross_profit,
        "net_profit": net_profit,
        "net_cash_flow": pkr(period_sales_collected - period_purchases_paid - period_expenses),
        "trash_count": trash_count
    }


# ==================== STORAGE LOCATIONS ====================

@app.get("/api/locations")
def list_locations(db: Session = Depends(get_db)):
    locs = (
    db.query(StorageLocation)
    .options(selectinload(StorageLocation.product_stocks).joinedload(ProductLocationStock.product).joinedload(Product.brand))
    .order_by(StorageLocation.id.asc())
    .all()
)
    result = []
    for loc in locs:
        total_btls = sum(ps.stock_bottles for ps in loc.product_stocks)
        items_detail = []
        for ps in loc.product_stocks:
            if ps.product and ps.stock_bottles > 0:
                upc = ps.product.units_per_carton if ps.product.units_per_carton > 0 else 12
                ctns = ps.stock_bottles // upc
                loose = ps.stock_bottles % upc
                items_detail.append({
                    "product_id": ps.product.id,
                    "product_name": ps.product.name,
                    "company_name": ps.product.brand.name if ps.product.brand else "ATH Oils",
                    "sku": ps.product.sku,
                    "pack_size": f"{int(ps.product.pack_size)} {ps.product.pack_unit}",
                    "units_per_carton": upc,
                    "stock_bottles": ps.stock_bottles,
                    "cartons": ctns,
                    "loose_bottles": loose,
                    "formatted": f"{ctns} Cartons & {loose} Loose Bottles (Max {upc} Btls/Carton)"
                })
        result.append({
            "id": loc.id,
            "code": loc.code,
            "name": loc.name,
            "location_type": loc.location_type,
            "address": loc.address or "",
            "total_bottles": total_btls,
            "items": items_detail
        })
    return result


@app.post("/api/locations")
def create_location(payload: LocationCreate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    clean_name = (payload.name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Please enter a valid Location Name.")
    existing = db.query(StorageLocation).filter(StorageLocation.name.ilike(clean_name)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Location '{clean_name}' already exists.")
    sync_postgres_sequences(db)
    code = f"LOC-{uuid.uuid4().hex[:4].upper()}"
    loc = StorageLocation(
        code=code,
        name=clean_name,
        location_type=(payload.location_type or "WAREHOUSE").upper(),
        address=payload.address
    )
    db.add(loc)
    bump_version()
    db.commit()
    db.refresh(loc)
    return {
        "status": "success",
        "location": {"id": loc.id, "code": loc.code, "name": loc.name, "location_type": loc.location_type, "address": loc.address or ""},
        "locations": list_locations(db=db),
        "snapshot": export_full_snapshot(db)
    }


@app.put("/api/locations/{location_id}")
def update_location(location_id: int, payload: LocationUpdate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    loc = db.query(StorageLocation).filter(StorageLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    for k, v in payload.dict(exclude_unset=True, exclude={"client_snapshot"}).items():
        setattr(loc, k, v)
    bump_version()
    db.commit()
    return {"status": "success", "locations": list_locations(db=db), "snapshot": export_full_snapshot(db)}


# ==================== DIRECT LOCATION STOCK SET & STOCK TRANSFER ====================

@app.post("/api/inventory/set-location-stock")
def set_location_stock_direct(payload: DirectLocationStockSet, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    sync_postgres_sequences(db)
    product = resolve_or_create_product(
        db=db,
        product_id=payload.product_id,
        product_name=payload.product_name,
        company_name=payload.company_name,
        pack_size=payload.pack_size,
        units_per_carton=payload.units_per_carton,
        mark_fav=None
    )
    loc = db.query(StorageLocation).filter(StorageLocation.id == payload.location_id).first()
    if not loc:
        loc = db.query(StorageLocation).order_by(StorageLocation.id.asc()).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Storage location not found.")

    if payload.pack_size and payload.pack_size > 0:
        product.pack_size = payload.pack_size
    if payload.units_per_carton and payload.units_per_carton > 0:
        product.units_per_carton = payload.units_per_carton

    target_bottles = max(0, int(payload.stock_bottles))
    loc_stock = db.query(ProductLocationStock).filter(
        ProductLocationStock.product_id == product.id,
        ProductLocationStock.location_id == loc.id
    ).first()
    if not loc_stock:
        loc_stock = ProductLocationStock(
            product_id=product.id,
            location_id=loc.id,
            stock_bottles=target_bottles
        )
        db.add(loc_stock)
    else:
        loc_stock.stock_bottles = target_bottles

    db.flush()
    all_loc_stocks = db.query(ProductLocationStock).filter(ProductLocationStock.product_id == product.id).all()
    product.current_stock = sum(max(0, int(ls.stock_bottles or 0)) for ls in all_loc_stocks)

    bump_version()
    db.commit()

    upc = product.units_per_carton if product.units_per_carton > 0 else 12
    ctns = target_bottles // upc
    loose = target_bottles % upc
    return {
        "status": "success",
        "message": f"Updated {product.name} ({int(product.pack_size)} {product.pack_unit}) at {loc.name} to {target_bottles} Bottles ({ctns} Cartons + {loose} Bottles).",
        "locations": list_locations(db=db),
        "products": list_products(db=db),
        "snapshot": export_full_snapshot(db)
    }


@app.post("/api/inventory/transfer")
def transfer_stock(payload: StockTransferRequest, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    if payload.from_location_id == payload.to_location_id:
        raise HTTPException(status_code=400, detail="Source and Destination locations must be different.")
    if not payload.quantity or payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="Transfer quantity must be greater than zero.")

    sync_postgres_sequences(db)

    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Selected product not found.")

    from_loc = db.query(StorageLocation).filter(StorageLocation.id == payload.from_location_id).first()
    to_loc = db.query(StorageLocation).filter(StorageLocation.id == payload.to_location_id).first()
    if not from_loc or not to_loc:
        raise HTTPException(status_code=404, detail="Source or Destination location not found.")

    product_id_val = product.id
    product_name = product.name
    from_loc_id = from_loc.id
    from_loc_name = from_loc.name
    to_loc_id = to_loc.id
    to_loc_name = to_loc.name

    upc = max(1, int(product.units_per_carton or 12))
    base_bottles = int(round(payload.quantity * upc)) if (payload.unit_type or "").upper() == "CARTON" else int(round(payload.quantity))
    if base_bottles <= 0:
        raise HTTPException(status_code=400, detail="Transfer quantity in bottles must be greater than 0.")

    # Verify source location has sufficient stock before modifying anything
    source_stock_row = db.query(ProductLocationStock).filter(
        ProductLocationStock.product_id == product_id_val,
        ProductLocationStock.location_id == from_loc_id
    ).first()
    avail_bottles = int(source_stock_row.stock_bottles or 0) if source_stock_row else 0
    if avail_bottles < base_bottles:
        avail_ctns = avail_bottles // upc
        avail_loose = avail_bottles % upc
        req_ctns = base_bottles // upc
        req_loose = base_bottles % upc
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient stock in '{from_loc_name}' for '{product_name}'. "
                f"Available: {avail_bottles} Bottles ({avail_ctns} Ctn + {avail_loose} Btl), "
                f"Requested Transfer: {base_bottles} Bottles ({req_ctns} Ctn + {req_loose} Btl)."
            )
        )

    # 8-second duplicate transfer guard to prevent accidental double-clicks or retry duplicates
    tx_now = now_pkt()
    recent_cutoff = tx_now - timedelta(seconds=8)
    recent_dup = (
        db.query(StockMovement)
        .filter(
            StockMovement.product_id == product_id_val,
            StockMovement.movement_type == "TRANSFER",
            StockMovement.qty_in == base_bottles,
            StockMovement.qty_out == base_bottles,
            StockMovement.movement_date >= recent_cutoff
        )
        .order_by(StockMovement.id.desc())
        .first()
    )
    if recent_dup:
        ctns = base_bottles // upc
        loose = base_bottles % upc
        return {
            "status": "success",
            "duplicate_prevented": True,
            "reference": recent_dup.reference_number,
            "message": (
                f"Transferred {base_bottles} Bottles ({ctns} Cartons + {loose} Loose Bottles) of "
                f"{product_name} from {from_loc_name} to {to_loc_name}."
            ),
            "locations": list_locations(db=db),
            "products": list_products(db=db),
            "snapshot": export_full_snapshot(db)
        }

    try:
        adjust_location_stock(db, product, from_loc_id, -base_bottles)
        adjust_location_stock(db, product, to_loc_id, base_bottles)

        ref_no = f"TRF-{tx_now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        db.add(StockMovement(
            movement_date=tx_now,
            product_id=product_id_val,
            movement_type="TRANSFER",
            reference_number=ref_no,
            qty_in=base_bottles,
            qty_out=base_bottles,
            running_balance=product.current_stock
        ))
        bump_version()
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Stock transfer could not be completed: {str(exc)}")

    ctns = base_bottles // upc
    loose = base_bottles % upc
    return {
        "status": "success",
        "reference": ref_no,
        "message": (
            f"Transferred {base_bottles} Bottles ({ctns} Cartons + {loose} Loose Bottles) of "
            f"{product_name} from {from_loc_name} to {to_loc_name}."
        ),
        "locations": list_locations(db=db),
        "products": list_products(db=db),
        "snapshot": export_full_snapshot(db)
    }


# ==================== PRODUCTS & LOCATION BREAKDOWN ====================

@app.get("/api/products")
def list_products(db: Session = Depends(get_db)):
    products = (
    db.query(Product)
    .options(joinedload(Product.brand), selectinload(Product.location_stocks).joinedload(ProductLocationStock.location))
    .order_by(Product.id.asc())
    .all()
)
    result = []
    for p in products:
        upc = p.units_per_carton if p.units_per_carton > 0 else 12
        cartons = p.current_stock // upc
        loose_bottles = p.current_stock % upc

        ctn_buy = getattr(p, "carton_purchase_rate", 0.0) or pkr(p.purchase_rate * upc)
        ctn_sale = getattr(p, "carton_sale_rate", 0.0) or pkr(p.sale_rate * upc)

        loc_breakdown = []
        for ls in p.location_stocks:
            if ls.location:
                loc_ctns = ls.stock_bottles // upc
                loc_loose = ls.stock_bottles % upc
                loc_breakdown.append({
                    "location_id": ls.location_id,
                    "location_name": ls.location.name,
                    "location_type": ls.location.location_type,
                    "stock_bottles": ls.stock_bottles,
                    "cartons": loc_ctns,
                    "loose_bottles": loc_loose,
                    "formatted": f"{loc_ctns} Cartons + {loc_loose} Bottles"
                })

        stock_val = pkr((p.current_stock / upc) * ctn_buy) if ctn_buy > 0 else pkr(p.current_stock * p.purchase_rate)

        result.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "brand_id": p.brand_id,
            "brand_name": p.brand.name if p.brand else "ATH Oils",
            "is_owned": p.brand.is_owned_brand if p.brand else False,
            "viscosity": p.viscosity_grade,
            "pack_size_num": p.pack_size,
            "pack_unit": p.pack_unit,
            "pack_size": f"{int(p.pack_size)} {p.pack_unit}",
            "units_per_carton": upc,
            "purchase_rate": round(p.purchase_rate, 2),
            "sale_rate": round(p.sale_rate, 2),
            "carton_purchase_rate": pkr(ctn_buy),
            "carton_sale_rate": pkr(ctn_sale),
            "current_stock_bottles": p.current_stock,
            "cartons": cartons,
            "loose_bottles": loose_bottles,
            "current_stock_formatted": f"{cartons} Cartons + {loose_bottles} Bottles",
            "stock_valuation": stock_val,
            "reorder_level": p.reorder_level,
            "is_low_stock": p.current_stock <= p.reorder_level,
            "is_favorite": bool(getattr(p, "is_favorite", False)),
            "locations": loc_breakdown
        })
    return result


@app.post("/api/products")
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    sku_code = (payload.sku or f"SKU-{uuid.uuid4().hex[:4].upper()}").strip().upper()
    existing = db.query(Product).filter(Product.sku == sku_code).first()
    if existing:
        sku_code = f"{sku_code}-{uuid.uuid4().hex[:2].upper()}"

    brand = resolve_or_create_brand(db, payload.company_name, payload.brand_id)
    upc = max(1, int(payload.units_per_carton or 12))

    new_prod = Product(
        sku=sku_code,
        name=payload.name.strip(),
        brand_id=brand.id if brand else 1,
        viscosity_grade=payload.viscosity_grade,
        pack_size=payload.pack_size,
        pack_unit=payload.pack_unit,
        units_per_carton=upc,
        purchase_rate=payload.purchase_rate,
        sale_rate=payload.sale_rate,
        carton_purchase_rate=pkr(payload.purchase_rate * upc),
        carton_sale_rate=pkr(payload.sale_rate * upc),
        current_stock=0,
        reorder_level=payload.reorder_level,
        is_favorite=bool(payload.is_favorite)
    )
    db.add(new_prod)
    db.flush()

    if payload.initial_stock > 0:
        target_loc_id = payload.location_id
        if not target_loc_id:
            first_loc = db.query(StorageLocation).first()
            target_loc_id = first_loc.id if first_loc else None
        if target_loc_id:
            adjust_location_stock(db, new_prod, target_loc_id, payload.initial_stock)

    bump_version()
    db.commit()
    db.refresh(new_prod)
    return {"status": "success", "id": new_prod.id, "snapshot": export_full_snapshot(db)}


@app.put("/api/products/{product_id}")
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    if payload.company_name and payload.company_name.strip():
        brand = resolve_or_create_brand(db, payload.company_name, prod.brand_id)
        if brand:
            prod.brand_id = brand.id
    for field, value in payload.dict(exclude_unset=True, exclude={"client_snapshot", "company_name"}).items():
        setattr(prod, field, value)

    upc = max(1, int(prod.units_per_carton or 12))
    if payload.purchase_rate is not None:
        prod.carton_purchase_rate = pkr(prod.purchase_rate * upc)
    if payload.sale_rate is not None:
        prod.carton_sale_rate = pkr(prod.sale_rate * upc)

    bump_version()
    db.commit()
    return {"status": "success", "id": prod.id, "snapshot": export_full_snapshot(db)}


# ==================== SCALABLE PARTY GROUPS (SEARCH & PAGINATION BY DB ID) ====================

@app.get("/api/party-groups")
def search_party_groups(
    q: str = Query(""),
    party_type: str = Query("CUSTOMER"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(PartyGroup).filter(PartyGroup.is_active == True)
    ptype = (party_type or "CUSTOMER").strip().upper()
    if ptype in ("CUSTOMER", "SUPPLIER"):
        query = query.filter(PartyGroup.party_type == ptype)

    clean_q = (q or "").strip()
    if clean_q:
        like_pat = f"%{clean_q}%"
        query = query.filter(
            (PartyGroup.name.ilike(like_pat)) |
            (PartyGroup.code.ilike(like_pat)) |
            (PartyGroup.city.ilike(like_pat))
        )

    rows = query.order_by(PartyGroup.name.asc(), PartyGroup.id.asc()).all()
    total = len(rows)
    paged_rows = rows[offset : offset + limit]

    all_customers = db.query(Customer).all() if ptype in ("CUSTOMER", "ALL") else []
    all_suppliers = db.query(Supplier).all() if ptype in ("SUPPLIER", "ALL") else []

    items = []
    for g in paged_rows:
        g_name_lower = (g.name or "").strip().lower()
        if g.party_type == "SUPPLIER":
            members = [
                s for s in all_suppliers
                if s.group_id == g.id or (s.group_name or "").strip().lower() == g_name_lower
            ]
            bal = sum(pkr(m.current_payable) for m in members)
        else:
            members = [
                c for c in all_customers
                if c.group_id == g.id or (c.group_name or "").strip().lower() == g_name_lower
            ]
            bal = sum(pkr(m.current_receivable) for m in members)

        items.append({
            "id": g.id,
            "code": g.code,
            "name": g.name,
            "party_type": g.party_type,
            "city": g.city or "",
            "description": g.description or "",
            "members_count": len(members),
            "total_balance": pkr(bal)
        })

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@app.post("/api/party-groups")
def create_party_group(payload: PartyGroupCreate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    grp = resolve_or_create_party_group(
        db=db,
        group_id=None,
        group_name=payload.name,
        party_type=payload.party_type,
        city=payload.city
    )
    if payload.description:
        grp.description = payload.description
    bump_version()
    db.commit()
    db.refresh(grp)
    return {
        "status": "success",
        "group": {
            "id": grp.id,
            "code": grp.code,
            "name": grp.name,
            "party_type": grp.party_type,
            "city": grp.city or ""
        },
        "snapshot": export_full_snapshot(db)
    }


# ==================== CUSTOMERS, SUPPLIERS, PREVIOUS SALE RATES & 360° PROFILES ====================

@app.get("/api/customers")
def list_customers(
    q: str = Query(""),
    group_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    if not isinstance(q, str):
        q = ""
    if not isinstance(group_id, int):
        group_id = None

    query = db.query(Customer)
    if group_id is not None:
        grp = db.query(PartyGroup).filter(PartyGroup.id == group_id).first()
        if grp:
            query = query.filter((Customer.group_id == grp.id) | (Customer.group_name.ilike(grp.name)))
        else:
            query = query.filter(Customer.group_id == group_id)

    clean_q = (q or "").strip()
    if clean_q:
        pat = f"%{clean_q}%"
        query = query.filter(
            (Customer.name.ilike(pat)) |
            (Customer.city.ilike(pat)) |
            (Customer.phone.ilike(pat)) |
            (Customer.cnic.ilike(pat)) |
            (Customer.code.ilike(pat)) |
            (Customer.group_name.ilike(pat))
        )

    customers = (
    query.options(selectinload(Customer.sales).selectinload(Sale.items).joinedload(SaleItem.product))
    .order_by(Customer.id.asc())
    .all()
)
    result = []
    for c in customers:
        confirmed_sales = [s for s in c.sales if getattr(s, "doc_type", "SALE") == "SALE"]
        all_non_return = [s for s in c.sales if getattr(s, "doc_type", "SALE") != "SALE_RETURN"]
        total_bought = sum(pkr(s.total_amount) for s in confirmed_sales)
        total_paid = sum(pkr(s.received_amount) for s in confirmed_sales)
        last_sale = max((s.invoice_date for s in confirmed_sales), default=None)

        # Deterministic most-recent sale rate per (product_id, unit_type) from persisted SALE records
        last_rates: Dict[str, Dict[str, Any]] = {}
        ordered_sales = sorted(
            confirmed_sales,
            key=lambda x: (x.invoice_date or datetime.min, x.id),
            reverse=True
        )
        for s in ordered_sales:
            for it in sorted(s.items, key=lambda item_row: item_row.id, reverse=True):
                key = f"{it.product_id}:{it.unit_type}"
                if key not in last_rates:
                    last_rates[key] = {
                        "product_id": it.product_id,
                        "product_name": it.product.name if it.product else "Product",
                        "unit_type": it.unit_type,
                        "unit_rate": pkr(it.unit_rate),
                        "units_per_carton": max(1, it.units_per_carton or 12),
                        "invoice_number": s.invoice_number,
                        "invoice_date": s.invoice_date.strftime("%Y-%m-%d %H:%M")
                    }

        result.append({
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "contact_person": c.contact_person or "",
            "phone": c.phone or "",
            "cnic": getattr(c, "cnic", "") or "",
            "group_id": getattr(c, "group_id", None),
            "group_name": getattr(c, "group_name", "General Market") or "General Market",
            "city": c.city or "Local",
            "address": c.address or "",
            "credit_limit": pkr(c.credit_limit),
            "opening_receivable": pkr(c.opening_receivable),
            "current_receivable": pkr(c.current_receivable),
            "advance_credit": pkr(getattr(c, "advance_credit", 0.0)),
            "is_favorite": bool(getattr(c, "is_favorite", False)),
            "total_sales_amount": pkr(total_bought),
            "total_received_amount": pkr(total_paid),
            "invoices_count": len(all_non_return),
            "confirmed_sales_count": len(confirmed_sales),
            "last_sale_date": last_sale.strftime("%Y-%m-%d %H:%M") if last_sale else None,
            "last_item_rates": list(last_rates.values())
        })
    return result


@app.get("/api/customers/{customer_id}/previous-rate")
def get_customer_previous_product_rate(
    customer_id: int,
    product_id: int = Query(..., gt=0),
    unit_type: str = Query("CARTON"),
    db: Session = Depends(get_db)
):
    """
    Retrieves the most recent persisted historical sale rate for an exact (customer_id, product_id) pair.
    Uses reliable (Sale.invoice_date DESC, Sale.id DESC, SaleItem.id DESC) deterministic ordering.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    rows = (
        db.query(SaleItem, Sale)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .filter(
            Sale.customer_id == customer_id,
            Sale.doc_type == "SALE",
            SaleItem.product_id == product_id
        )
        .order_by(Sale.invoice_date.desc(), Sale.id.desc(), SaleItem.id.desc())
        .all()
    )

    if not rows:
        return {
            "found": False,
            "customer_id": customer_id,
            "product_id": product_id,
            "message": f"No previous sale history for {customer.name} on {product.name}."
        }

    req_unit = (unit_type or "CARTON").strip().upper()
    exact_unit_match = next(((si, s) for si, s in rows if (si.unit_type or "").upper() == req_unit), None)
    chosen_item, chosen_sale = exact_unit_match if exact_unit_match else rows[0]

    upc = max(1, chosen_item.units_per_carton or product.units_per_carton or 12)
    raw_rate = pkr(chosen_item.unit_rate)
    if (chosen_item.unit_type or "").upper() == req_unit:
        converted_rate = raw_rate
    elif req_unit == "CARTON":
        converted_rate = pkr(raw_rate * upc)
    else:
        converted_rate = pkr(raw_rate / upc)

    return {
        "found": True,
        "customer_id": customer.id,
        "customer_name": customer.name,
        "product_id": product.id,
        "product_name": product.name,
        "requested_unit_type": req_unit,
        "historical_unit_type": chosen_item.unit_type,
        "historical_unit_rate": raw_rate,
        "applicable_rate": converted_rate,
        "quantity": chosen_item.quantity,
        "invoice_id": chosen_sale.id,
        "invoice_number": chosen_sale.invoice_number,
        "invoice_date": chosen_sale.invoice_date.strftime("%Y-%m-%d %H:%M")
    }


def build_customer_outstanding_ledger_data(db: Session, c: Customer) -> Dict[str, Any]:
    all_sales = (
        db.query(Sale)
        .filter(Sale.customer_id == c.id)
        .order_by(Sale.invoice_date.asc(), Sale.id.asc())
        .all()
    )

    outstanding_bills = []
    all_bills_ledger = []
    total_outstanding_bills = 0.0

    for s in all_sales:
        dtype = getattr(s, "doc_type", "SALE") or "SALE"
        orig_amt = pkr(s.total_amount)
        paid_amt = pkr(s.received_amount)
        rem_amt = pkr(s.receivable_amount) if dtype == "SALE" else 0.0
        if dtype == "SALE":
            if rem_amt <= 0:
                status_label = "PAID"
            elif paid_amt > 0:
                status_label = "PARTIAL"
            else:
                status_label = "UNPAID"
        else:
            status_label = s.payment_status

        alloc_rows = (
            db.query(CustomerPaymentAllocation)
            .join(CustomerPayment, CustomerPaymentAllocation.payment_id == CustomerPayment.id)
            .filter(CustomerPaymentAllocation.sale_id == s.id)
            .order_by(CustomerPaymentAllocation.id.asc())
            .all()
        )

        bill_entry = {
            "sale_id": s.id,
            "invoice_number": s.invoice_number,
            "doc_type": dtype,
            "invoice_date": s.invoice_date.strftime("%Y-%m-%d %H:%M"),
            "items_summary": serialize_sale(s)["items_summary"],
            "original_amount": orig_amt,
            "previously_paid": paid_amt,
            "remaining_balance": rem_amt,
            "payment_status": status_label,
            "allocations": [
                {
                    "allocation_id": ar.id,
                    "payment_id": ar.payment_id,
                    "payment_number": ar.payment.payment_number if ar.payment else "",
                    "payment_date": ar.payment.payment_date.strftime("%Y-%m-%d %H:%M") if (ar.payment and ar.payment.payment_date) else "",
                    "payment_status": ar.payment.status if ar.payment else "CONFIRMED",
                    "outstanding_before": pkr(ar.outstanding_before),
                    "allocated_amount": pkr(ar.allocated_amount),
                    "remaining_after": pkr(ar.remaining_after)
                }
                for ar in alloc_rows
            ]
        }
        all_bills_ledger.append(bill_entry)
        if dtype == "SALE" and rem_amt > 0:
            outstanding_bills.append(bill_entry)
            total_outstanding_bills = pkr(total_outstanding_bills + rem_amt)

    payment_records = (
        db.query(CustomerPayment)
        .filter(CustomerPayment.customer_id == c.id)
        .order_by(CustomerPayment.id.desc())
        .all()
    )

    payment_history = [
        {
            "id": pm.id,
            "payment_number": pm.payment_number,
            "payment_date": pm.payment_date.strftime("%Y-%m-%d %H:%M"),
            "payment_amount": pkr(pm.payment_amount),
            "allocated_amount": pkr(pm.allocated_amount),
            "unallocated_credit": pkr(pm.unallocated_credit),
            "outstanding_before": pkr(pm.outstanding_before),
            "outstanding_after": pkr(pm.outstanding_after),
            "payment_method": pm.payment_method,
            "account_id": pm.account_id,
            "remarks": pm.remarks or "",
            "status": pm.status,
            "reversed_at": pm.reversed_at.strftime("%Y-%m-%d %H:%M") if pm.reversed_at else None,
            "reversal_reason": pm.reversal_reason,
            "allocations": [
                {
                    "sale_id": al.sale_id,
                    "invoice_number": al.invoice_number,
                    "bill_original_amount": pkr(al.bill_original_amount),
                    "outstanding_before": pkr(al.outstanding_before),
                    "allocated_amount": pkr(al.allocated_amount),
                    "remaining_after": pkr(al.remaining_after)
                }
                for al in pm.allocations
            ]
        }
        for pm in payment_records
    ]

    total_outstanding = pkr(total_outstanding_bills + pkr(c.opening_receivable))
    return {
        "customer_id": c.id,
        "customer_name": c.name,
        "customer_code": c.code,
        "city": c.city,
        "phone": c.phone or "",
        "cnic": getattr(c, "cnic", "") or "",
        "group_id": getattr(c, "group_id", None),
        "group_name": getattr(c, "group_name", "General Market") or "General Market",
        "opening_receivable": pkr(c.opening_receivable),
        "advance_credit": pkr(getattr(c, "advance_credit", 0.0)),
        "total_bills_outstanding": pkr(total_outstanding_bills),
        "total_outstanding": total_outstanding,
        "outstanding_bills": outstanding_bills,
        "all_bills": list(reversed(all_bills_ledger)),
        "payment_history": payment_history
    }


@app.get("/api/customers/{customer_id}/outstanding-ledger")
def get_customer_outstanding_ledger(customer_id: int, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return build_customer_outstanding_ledger_data(db, c)


@app.post("/api/customers/{customer_id}/payment-proposal")
def calculate_customer_payment_proposal(
    customer_id: int,
    payload: PaymentProposalRequest,
    db: Session = Depends(get_db)
):
    """
    Calculates an automatic payment allocation proposal (default OLDEST_FIRST)
    without committing any changes to the database.
    """
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    pay_amt = pkr(payload.payment_amount)
    if pay_amt <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than PKR 0.")

    q = db.query(Sale).filter(
        Sale.customer_id == c.id,
        Sale.doc_type == "SALE",
        Sale.receivable_amount > 0
    )
    policy = (payload.allocation_policy or "OLDEST_FIRST").strip().upper()
    if policy == "NEWEST_FIRST":
        unpaid_sales = q.order_by(Sale.invoice_date.desc(), Sale.id.desc()).all()
    else:
        unpaid_sales = q.order_by(Sale.invoice_date.asc(), Sale.id.asc()).all()

    total_outstanding_before = sum(pkr(s.receivable_amount) for s in unpaid_sales)
    remaining_to_allocate = pay_amt
    proposed_rows = []

    for s in unpaid_sales:
        bill_out = pkr(s.receivable_amount)
        alloc = pkr(min(bill_out, remaining_to_allocate)) if remaining_to_allocate > 0 else 0.0
        rem_after = pkr(bill_out - alloc)
        remaining_to_allocate = pkr(remaining_to_allocate - alloc)
        proposed_rows.append({
            "sale_id": s.id,
            "invoice_number": s.invoice_number,
            "invoice_date": s.invoice_date.strftime("%Y-%m-%d %H:%M"),
            "original_amount": pkr(s.total_amount),
            "previously_paid": pkr(s.received_amount),
            "outstanding_before": bill_out,
            "proposed_allocation": alloc,
            "remaining_after": rem_after,
            "projected_status": "PAID" if rem_after <= 0 else ("PARTIAL" if (pkr(s.received_amount) + alloc) > 0 else "UNPAID")
        })

    total_allocated = sum(pkr(r["proposed_allocation"]) for r in proposed_rows)
    projected_outstanding_after = pkr(max(0.0, total_outstanding_before - total_allocated))
    excess_amount = pkr(max(0.0, pay_amt - total_allocated))

    return {
        "customer_id": c.id,
        "customer_name": c.name,
        "allocation_policy": policy,
        "payment_amount": pay_amt,
        "total_outstanding_before": pkr(total_outstanding_before),
        "total_proposed_allocation": pkr(total_allocated),
        "projected_outstanding_after": projected_outstanding_after,
        "excess_payment_amount": excess_amount,
        "requires_excess_decision": excess_amount > 0,
        "bills": proposed_rows
    }


@app.post("/api/customers/{customer_id}/confirm-payment-allocation")
def confirm_customer_payment_allocation(
    customer_id: int,
    payload: ConfirmPaymentAllocationRequest,
    db: Session = Depends(get_db)
):
    """
    Atomically validates and persists a user-confirmed customer payment and its bill-by-bill allocations.
    Preserves original bill amounts and records auditable CustomerPayment & CustomerPaymentAllocation rows.
    """
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)

    if payload.idempotency_key:
        existing_pm = db.query(CustomerPayment).filter(
            CustomerPayment.idempotency_key == payload.idempotency_key.strip()
        ).first()
        if existing_pm:
            raise HTTPException(
                status_code=409,
                detail=f"Duplicate payment submission detected (Voucher {existing_pm.payment_number} already processed)."
            )

    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    pay_amt = pkr(payload.payment_amount)
    if pay_amt <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than PKR 0.")

    unpaid_bills = (
        db.query(Sale)
        .filter(Sale.customer_id == c.id, Sale.doc_type == "SALE", Sale.receivable_amount > 0)
        .order_by(Sale.invoice_date.asc(), Sale.id.asc())
        .all()
    )
    unpaid_map = {s.id: s for s in unpaid_bills}
    total_outstanding_before = sum(pkr(s.receivable_amount) for s in unpaid_bills)

    validated_allocations = []
    seen_sale_ids = set()
    total_allocated = 0.0

    for item in payload.allocations:
        alloc_val = pkr(item.allocated_amount)
        if alloc_val <= 0:
            continue
        if item.sale_id in seen_sale_ids:
            raise HTTPException(status_code=400, detail=f"Duplicate allocation entry for Sale ID #{item.sale_id}.")
        seen_sale_ids.add(item.sale_id)

        sale_row = unpaid_map.get(item.sale_id)
        if not sale_row:
            other_sale = db.query(Sale).filter(Sale.id == item.sale_id, Sale.customer_id == c.id).first()
            if not other_sale:
                raise HTTPException(status_code=400, detail=f"Bill ID #{item.sale_id} does not belong to {c.name}.")
            raise HTTPException(
                status_code=400,
                detail=f"Bill {other_sale.invoice_number} has no remaining balance (Outstanding: PKR {pkr(other_sale.receivable_amount):,.0f})."
            )

        bill_rem = pkr(sale_row.receivable_amount)
        if alloc_val > bill_rem:
            raise HTTPException(
                status_code=400,
                detail=f"Allocation of PKR {alloc_val:,.0f} for {sale_row.invoice_number} exceeds its remaining balance of PKR {bill_rem:,.0f}."
            )

        total_allocated = pkr(total_allocated + alloc_val)
        validated_allocations.append((sale_row, bill_rem, alloc_val))

    if total_allocated > pay_amt:
        raise HTTPException(
            status_code=400,
            detail=f"Total allocated across bills (PKR {total_allocated:,.0f}) cannot exceed payment received (PKR {pay_amt:,.0f})."
        )

    excess_amt = pkr(pay_amt - total_allocated)
    excess_policy = (payload.excess_action or "NONE").strip().upper()

    if len(unpaid_bills) > 0 and total_allocated == 0 and excess_policy != "ADVANCE_CREDIT":
        raise HTTPException(
            status_code=400,
            detail="Please allocate the payment to at least one outstanding bill before confirming."
        )

    if excess_amt > 0 and excess_policy != "ADVANCE_CREDIT":
        if total_allocated < min(pay_amt, total_outstanding_before):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unallocated amount of PKR {excess_amt:,.0f} remains while bills are still unpaid. "
                    f"Please allocate the full PKR {min(pay_amt, total_outstanding_before):,.0f} across the customer's bills, "
                    f"or explicitly choose 'Save Excess as Advance Credit'."
                )
            )
        raise HTTPException(
            status_code=400,
            detail=(
                f"Payment of PKR {pay_amt:,.0f} exceeds selected bills by PKR {excess_amt:,.0f}. "
                f"Please reduce the payment amount to PKR {total_allocated:,.0f} or explicitly select 'Save Excess as Advance Credit'."
            )
        )

    acc = resolve_financial_account(db, payload.account_id, payload.payment_method)
    pay_no = f"CPAY-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    outstanding_after = pkr(max(0.0, total_outstanding_before - total_allocated))

    try:
        payment_rec = CustomerPayment(
            payment_number=pay_no,
            idempotency_key=payload.idempotency_key.strip() if payload.idempotency_key else None,
            customer_id=c.id,
            payment_amount=pay_amt,
            allocated_amount=total_allocated,
            unallocated_credit=excess_amt,
            outstanding_before=total_outstanding_before,
            outstanding_after=outstanding_after,
            payment_method=acc.type if acc else payload.payment_method.upper(),
            account_id=acc.id if acc else None,
            admin_id=payload.admin_id,
            admin_name=(payload.admin_name or "Admin").strip(),
            remarks=payload.remarks,
            status="CONFIRMED"
        )
        db.add(payment_rec)
        db.flush()
        alloc_summaries = []
        for sale_row, bill_before, alloc_val in validated_allocations:
            rem_after = pkr(max(0.0, bill_before - alloc_val))
            sale_row.received_amount = pkr(sale_row.received_amount + alloc_val)
            sale_row.receivable_amount = rem_after
            sale_row.payment_status = "PAID" if rem_after <= 0 else "PARTIAL"
            sale_row.closing_receivable = outstanding_after
            db.add(CustomerPaymentAllocation(
                payment_id=payment_rec.id,
                sale_id=sale_row.id,
                invoice_number=sale_row.invoice_number,
                bill_original_amount=pkr(sale_row.total_amount),
                outstanding_before=bill_before,
                allocated_amount=alloc_val,
                remaining_after=rem_after
            ))
            alloc_summaries.append(f"{sale_row.invoice_number}: PKR {alloc_val:,.0f} (Rem: PKR {rem_after:,.0f})")
        if excess_amt > 0 and excess_policy == "ADVANCE_CREDIT":
            c.advance_credit = pkr(getattr(c, "advance_credit", 0.0) + excess_amt)
        db.flush()
        recompute_customer_authoritative_receivable(db, c)
        if acc:
            acc.current_balance = pkr(acc.current_balance + pay_amt)
        db.add(AccountTransaction(
            tx_number=pay_no,
            tx_type="CUSTOMER PAYMENT ALLOCATION",
            account_id=acc.id if acc else None,
            channel=acc.type if acc else payload.payment_method.upper(),
            party=c.name,
            reference_id=payment_rec.id,
            admin_id=payload.admin_id,
            admin_name=(payload.admin_name or "Admin").strip(),
            description=(
                f"Payment PKR {pay_amt:,.0f} allocated [{'; '.join(alloc_summaries)}]"
                + (f" | Excess Credit: PKR {excess_amt:,.0f}" if excess_amt > 0 else "")
                + (f" | {payload.remarks}" if payload.remarks else "")
            ),
            cash_in=pay_amt,
            cash_out=0.0
        ))

        bump_version()
        db.commit()
        db.refresh(payment_rec)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to commit payment allocation: {str(exc)}")

    return {
        "status": "confirmed",
        "payment_number": pay_no,
        "message": (
            f"Payment {pay_no} of PKR {pay_amt:,.0f} confirmed for {c.name}. "
            f"Allocated: PKR {total_allocated:,.0f} | Remaining Outstanding: PKR {c.current_receivable:,.0f}."
        ),
        "ledger": build_customer_outstanding_ledger_data(db, c),
        "snapshot": export_full_snapshot(db)
    }


@app.get("/api/customers/{customer_id}/profile")
def get_customer_360_profile(customer_id: int, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    all_sales = sorted(c.sales, key=lambda x: (x.invoice_date or datetime.min, x.id), reverse=True)
    invoices = [serialize_sale(s) for s in all_sales]
    ledger_data = build_customer_outstanding_ledger_data(db, c)

    payments = db.query(AccountTransaction).filter(
        AccountTransaction.party.ilike(c.name)
    ).order_by(AccountTransaction.id.desc()).all()

    item_history = []
    for s in all_sales:
        for i in sorted(s.items, key=lambda row: row.id, reverse=True):
            item_history.append({
                "invoice_number": s.invoice_number,
                "date": s.invoice_date.strftime("%Y-%m-%d %H:%M"),
                "doc_type": getattr(s, "doc_type", "SALE"),
                "product_id": i.product_id,
                "product_name": i.product.name if i.product else "Unknown",
                "pack_size": f"{int(i.product.pack_size)} {i.product.pack_unit}" if i.product else "",
                "unit_type": i.unit_type,
                "quantity": i.quantity,
                "base_quantity": i.base_quantity,
                "unit_rate": pkr(i.unit_rate),
                "line_total": pkr(i.line_total)
            })

    return {
        "customer": {
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "phone": c.phone or "",
            "cnic": getattr(c, "cnic", "") or "",
            "group_id": getattr(c, "group_id", None),
            "group_name": getattr(c, "group_name", "General Market") or "General Market",
            "city": c.city,
            "address": c.address or "",
            "credit_limit": pkr(c.credit_limit),
            "opening_receivable": pkr(c.opening_receivable),
            "current_receivable": pkr(c.current_receivable),
            "advance_credit": pkr(getattr(c, "advance_credit", 0.0)),
        },
        "invoices": invoices,
        "item_history": item_history,
        "outstanding_ledger": ledger_data,
        "payments": [
            {
                "id": t.id,
                "tx_number": t.tx_number,
                "date": t.tx_date.strftime("%Y-%m-%d %H:%M"),
                "tx_type": t.tx_type,
                "channel": t.channel,
                "description": t.description,
                "cash_in": pkr(t.cash_in),
                "cash_out": pkr(t.cash_out)
            }
            for t in payments
        ]
    }


@app.post("/api/customers")
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    code = payload.code or f"CUS-{uuid.uuid4().hex[:4].upper()}"
    open_rec = pkr(payload.current_receivable)
    grp = resolve_or_create_party_group(
        db=db,
        group_id=payload.group_id,
        group_name=payload.group_name,
        party_type="CUSTOMER",
        city=payload.city
    )
    c = Customer(
        code=code,
        name=payload.name.strip(),
        contact_person=payload.contact_person,
        phone=payload.phone,
        cnic=payload.cnic,
        group_id=grp.id,
        group_name=grp.name,
        city=(payload.city or "Local").strip(),
        address=payload.address,
        credit_limit=pkr(payload.credit_limit),
        opening_receivable=open_rec,
        current_receivable=open_rec,
        is_favorite=bool(payload.is_favorite)
    )
    db.add(c)
    bump_version()
    db.commit()
    db.refresh(c)
    return {
        "id": c.id,
        "name": c.name,
        "city": c.city,
        "group_id": c.group_id,
        "group_name": c.group_name,
        "cnic": c.cnic,
        "is_favorite": c.is_favorite,
        "snapshot": export_full_snapshot(db)
    }


@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    prev_rec = pkr(c.current_receivable)
    if payload.group_id is not None or payload.group_name is not None:
        grp = resolve_or_create_party_group(
            db=db,
            group_id=payload.group_id,
            group_name=payload.group_name or c.group_name,
            party_type="CUSTOMER",
            city=payload.city or c.city
        )
        c.group_id = grp.id
        c.group_name = grp.name

    for k, v in payload.dict(exclude_unset=True, exclude={"client_snapshot", "group_id", "group_name"}).items():
        if k in ("credit_limit", "current_receivable") and v is not None:
            setattr(c, k, pkr(v))
        else:
            setattr(c, k, v)

    if payload.current_receivable is not None and pkr(payload.current_receivable) != prev_rec:
        diff = pkr(payload.current_receivable) - prev_rec
        db.add(AccountTransaction(
            tx_number=f"ADJ-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}",
            tx_type="KHATA BALANCE ADJUSTMENT",
            channel="KHATA",
            party=c.name,
            reference_id=c.id,
            description=f"Customer receivable adjusted from PKR {prev_rec:,.0f} to PKR {pkr(payload.current_receivable):,.0f} ({diff:+,.0f})",
            cash_in=0.0,
            cash_out=0.0
        ))

    bump_version()
    db.commit()
    return {"status": "success", "snapshot": export_full_snapshot(db)}


@app.get("/api/suppliers")
def list_suppliers(db: Session = Depends(get_db)):
    suppliers = db.query(Supplier).options(selectinload(Supplier.purchases)).order_by(Supplier.id.asc()).all()
    result = []
    for s in suppliers:
        pur_rows = s.purchases
        total_bought = sum(pkr(p.total_amount) for p in pur_rows if getattr(p, "doc_type", "PURCHASE") == "PURCHASE")
        total_paid = sum(pkr(p.paid_amount) for p in pur_rows if getattr(p, "doc_type", "PURCHASE") == "PURCHASE")
        result.append({
            "id": s.id,
            "code": s.code,
            "name": s.name,
            "contact_person": s.contact_person or "",
            "phone": s.phone or "",
            "cnic": getattr(s, "cnic", "") or "",
            "group_id": getattr(s, "group_id", None),
            "group_name": getattr(s, "group_name", "General Suppliers") or "General Suppliers",
            "city": s.city or "Local",
            "address": s.address or "",
            "opening_payable": pkr(s.opening_payable),
            "current_payable": pkr(s.current_payable),
            "is_favorite": bool(getattr(s, "is_favorite", False)),
            "total_purchases_amount": pkr(total_bought),
            "total_paid_amount": pkr(total_paid),
            "bills_count": len(pur_rows)
        })
    return result


@app.get("/api/suppliers/{supplier_id}/profile")
def get_supplier_360_profile(supplier_id: int, db: Session = Depends(get_db)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")

    all_purs = sorted(s.purchases, key=lambda x: x.id, reverse=True)
    bills = [serialize_purchase(p) for p in all_purs]
    return {
        "supplier": {
            "id": s.id,
            "code": s.code,
            "name": s.name,
            "phone": s.phone or "",
            "cnic": getattr(s, "cnic", "") or "",
            "group_id": getattr(s, "group_id", None),
            "group_name": getattr(s, "group_name", "General Suppliers") or "General Suppliers",
            "city": s.city,
            "address": s.address or "",
            "opening_payable": pkr(s.opening_payable),
            "current_payable": pkr(s.current_payable),
            "account_id": getattr(s, "account_id", None),
            "admin_id": getattr(s, "admin_id", None),
            "admin_name": getattr(s, "admin_name", "Admin") or "Admin",
        },
        "bills": bills
    }


@app.post("/api/suppliers")
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    code = payload.code or f"SUP-{uuid.uuid4().hex[:4].upper()}"
    open_pay = pkr(payload.current_payable)
    grp = resolve_or_create_party_group(
        db=db,
        group_id=payload.group_id,
        group_name=payload.group_name,
        party_type="SUPPLIER",
        city=payload.city
    )
    s = Supplier(
        code=code,
        name=payload.name.strip(),
        contact_person=payload.contact_person,
        phone=payload.phone,
        cnic=payload.cnic,
        group_id=grp.id,
        group_name=grp.name,
        city=(payload.city or "Local").strip(),
        address=payload.address,
        opening_payable=open_pay,
        current_payable=open_pay,
        is_favorite=bool(payload.is_favorite)
    )
    db.add(s)
    bump_version()
    db.commit()
    db.refresh(s)
    return {
        "id": s.id,
        "name": s.name,
        "city": s.city,
        "group_id": s.group_id,
        "group_name": s.group_name,
        "cnic": s.cnic,
        "is_favorite": s.is_favorite,
        "snapshot": export_full_snapshot(db)
    }


@app.put("/api/suppliers/{supplier_id}")
def update_supplier(supplier_id: int, payload: SupplierUpdate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if payload.group_id is not None or payload.group_name is not None:
        grp = resolve_or_create_party_group(
            db=db,
            group_id=payload.group_id,
            group_name=payload.group_name or s.group_name,
            party_type="SUPPLIER",
            city=payload.city or s.city
        )
        s.group_id = grp.id
        s.group_name = grp.name
    for k, v in payload.dict(exclude_unset=True, exclude={"client_snapshot", "group_id", "group_name"}).items():
        if k == "current_payable" and v is not None:
            setattr(s, k, pkr(v))
        else:
            setattr(s, k, v)
    bump_version()
    db.commit()
    return {"status": "success", "snapshot": export_full_snapshot(db)}


# ==================== FINANCIAL ACCOUNTS, DEPOSITS, TRANSFERS & LOANS ====================

@app.get("/api/accounts")
def list_financial_accounts(db: Session = Depends(get_db)):
    rows = db.query(FinancialAccount).order_by(FinancialAccount.id.asc()).all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "type": a.type,
            "account_number": a.account_number or "",
            "current_balance": pkr(a.current_balance)
        }
        for a in rows
    ]


@app.post("/api/accounts")
def create_financial_account(payload: FinancialAccountCreate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    acc = FinancialAccount(
        name=payload.name.strip(),
        type=payload.type.upper(),
        account_number=payload.account_number,
        current_balance=pkr(payload.current_balance)
    )
    db.add(acc)
    bump_version()
    db.commit()
    db.refresh(acc)
    return {"status": "success", "account": acc, "snapshot": export_full_snapshot(db)}


@app.put("/api/accounts/{account_id}")
def update_financial_account(account_id: int, payload: FinancialAccountUpdate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    acc = db.query(FinancialAccount).filter(FinancialAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    for k, v in payload.dict(exclude_unset=True, exclude={"client_snapshot"}).items():
        if k == "current_balance" and v is not None:
            setattr(acc, k, pkr(v))
        else:
            setattr(acc, k, v)
    bump_version()
    db.commit()
    return {"status": "success", "snapshot": export_full_snapshot(db)}


@app.post("/api/accounts/adjust")
def adjust_account_balance(payload: AccountAdjustRequest, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    sync_postgres_sequences(db)
    acc = db.query(FinancialAccount).filter(FinancialAccount.id == payload.account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Financial account not found.")

    amt = pkr(payload.amount)
    if amt <= 0:
        raise HTTPException(status_code=400, detail="Transaction amount must be greater than PKR 0.")
    prev_bal = pkr(acc.current_balance)
    op = (payload.operation or "DEPOSIT").strip().upper()
    tx_now = now_pkt()

    # 8-second duplicate guard against accidental double-clicks or network retries
    expected_tx_type = "CASH DEPOSIT" if op == "DEPOSIT" else "CASH WITHDRAWAL"
    recent_cutoff = tx_now - timedelta(seconds=8)
    recent_dup = (
        db.query(AccountTransaction)
        .filter(
            AccountTransaction.account_id == acc.id,
            AccountTransaction.tx_type == expected_tx_type,
            AccountTransaction.cash_in == (amt if op == "DEPOSIT" else 0.0),
            AccountTransaction.cash_out == (0.0 if op == "DEPOSIT" else amt),
            AccountTransaction.tx_date >= recent_cutoff
        )
        .order_by(AccountTransaction.id.desc())
        .first()
    )
    if recent_dup:
        return {
            "status": "COMPLETED",
            "duplicate_prevented": True,
            "tx_number": recent_dup.tx_number,
            "message": f"[COMPLETED] Transaction {recent_dup.tx_number} already processed. Current Balance in {acc.name}: PKR {prev_bal:,.0f}.",
            "account_id": acc.id,
            "new_balance": prev_bal,
            "accounts": list_financial_accounts(db=db),
            "account_history": get_accounts_history(period="all", channel="ALL", db=db),
            "snapshot": export_full_snapshot(db)
        }

    if op == "WITHDRAW" and prev_bal < amt:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient funds in {acc.name}. Available Balance: PKR {prev_bal:,.0f}, Requested Withdrawal: PKR {amt:,.0f}."
        )

    if op == "DEPOSIT":
        tx_no = f"DEP-{tx_now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        new_bal = pkr(prev_bal + amt)
        acc.current_balance = new_bal
        db.add(AccountTransaction(
            tx_number=tx_no,
            tx_date=tx_now,
            tx_type="CASH DEPOSIT",
            account_id=acc.id,
            channel=acc.type,
            party=acc.name,
            description=payload.remarks or f"Deposit +PKR {amt:,.0f} (Prev: PKR {prev_bal:,.0f} -> New: PKR {new_bal:,.0f})",
            cash_in=amt,
            cash_out=0.0,
            admin_id=payload.admin_id,
            admin_name=(payload.admin_name or "Admin").strip()
        ))
        msg = f"[COMPLETED] Deposited PKR {amt:,.0f} into {acc.name} (Previous: PKR {prev_bal:,.0f} -> New Balance: PKR {new_bal:,.0f})."
    else:
        tx_no = f"WDR-{tx_now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        new_bal = pkr(prev_bal - amt)
        acc.current_balance = new_bal
        db.add(AccountTransaction(
            tx_number=tx_no,
            tx_date=tx_now,
            tx_type="CASH WITHDRAWAL",
            account_id=acc.id,
            channel=acc.type,
            party=acc.name,
            description=payload.remarks or f"Withdrawal -PKR {amt:,.0f} (Prev: PKR {prev_bal:,.0f} -> New: PKR {new_bal:,.0f})",
            cash_in=0.0,
            cash_out=amt,
            admin_id=payload.admin_id,
            admin_name=(payload.admin_name or "Admin").strip()
        ))
        msg = f"[COMPLETED] Withdrew PKR {amt:,.0f} from {acc.name} (Previous: PKR {prev_bal:,.0f} -> New Balance: PKR {new_bal:,.0f})."

    bump_version()
    db.commit()
    db.refresh(acc)
    return {
        "status": "COMPLETED",
        "tx_number": tx_no,
        "message": msg,
        "account_id": acc.id,
        "new_balance": pkr(acc.current_balance),
        "accounts": list_financial_accounts(db=db),
        "account_history": get_accounts_history(period="all", channel="ALL", db=db),
        "snapshot": export_full_snapshot(db)
    }


@app.post("/api/accounts/transfer")
def transfer_between_accounts(payload: AccountTransferRequest, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    sync_postgres_sequences(db)
    if payload.from_account_id == payload.to_account_id:
        raise HTTPException(status_code=400, detail="Source and Destination accounts must be different.")

    from_acc = db.query(FinancialAccount).filter(FinancialAccount.id == payload.from_account_id).first()
    to_acc = db.query(FinancialAccount).filter(FinancialAccount.id == payload.to_account_id).first()
    if not from_acc or not to_acc:
        raise HTTPException(status_code=404, detail="Source or Destination account not found.")

    amt = pkr(payload.amount)
    if amt <= 0:
        raise HTTPException(status_code=400, detail="Transfer amount must be greater than PKR 0.")
    from_prev = pkr(from_acc.current_balance)
    to_prev = pkr(to_acc.current_balance)
    tx_now = now_pkt()

    # 8-second duplicate guard against accidental double-clicks or network retries
    recent_cutoff = tx_now - timedelta(seconds=8)
    recent_dup = (
        db.query(AccountTransaction)
        .filter(
            AccountTransaction.account_id == from_acc.id,
            AccountTransaction.to_account_id == to_acc.id,
            AccountTransaction.tx_type == "ACCOUNT TRANSFER",
            AccountTransaction.cash_in == amt,
            AccountTransaction.cash_out == amt,
            AccountTransaction.tx_date >= recent_cutoff
        )
        .order_by(AccountTransaction.id.desc())
        .first()
    )
    if recent_dup:
        return {
            "status": "COMPLETED",
            "duplicate_prevented": True,
            "tx_number": recent_dup.tx_number,
            "message": f"[COMPLETED] Transfer {recent_dup.tx_number} already processed.",
            "accounts": list_financial_accounts(db=db),
            "account_history": get_accounts_history(period="all", channel="ALL", db=db),
            "snapshot": export_full_snapshot(db)
        }

    if from_prev < amt:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance in {from_acc.name} (Available: PKR {from_prev:,.0f}, Requested Transfer: PKR {amt:,.0f})."
        )

    from_acc.current_balance = pkr(from_prev - amt)
    to_acc.current_balance = pkr(to_prev + amt)
    tx_no = f"ATRF-{tx_now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    db.add(AccountTransaction(
        tx_number=tx_no,
        tx_date=tx_now,
        tx_type="ACCOUNT TRANSFER",
        account_id=from_acc.id,
        to_account_id=to_acc.id,
        channel=f"{from_acc.type} -> {to_acc.type}",
        party=f"{from_acc.name} -> {to_acc.name}",
        description=payload.remarks or f"Transferred PKR {amt:,.0f} from {from_acc.name} (PKR {from_acc.current_balance:,.0f}) to {to_acc.name} (PKR {to_acc.current_balance:,.0f})",
        cash_in=amt,
        cash_out=amt,
        admin_id=payload.admin_id,
        admin_name=(payload.admin_name or "Admin").strip()
    ))
    bump_version()
    db.commit()
    return {
        "status": "COMPLETED",
        "tx_number": tx_no,
        "message": f"[COMPLETED] Transferred PKR {amt:,.0f} from {from_acc.name} to {to_acc.name}!",
        "accounts": list_financial_accounts(db=db),
        "account_history": get_accounts_history(period="all", channel="ALL", db=db),
        "snapshot": export_full_snapshot(db)
    }


@app.get("/api/loans")
def list_loans(db: Session = Depends(get_db)):
    loans = db.query(LoanAccount).order_by(LoanAccount.id.desc()).all()
    return [
        {
            "id": ln.id,
            "lender_name": ln.lender_name,
            "loan_type": ln.loan_type,
            "phone": ln.phone or "",
            "total_borrowed": pkr(ln.total_borrowed),
            "total_repaid": pkr(ln.total_repaid),
            "current_balance": pkr(ln.current_balance),
            "notes": ln.notes or "",
            "updated_at": ln.updated_at.strftime("%Y-%m-%d %H:%M") if ln.updated_at else ""
        }
        for ln in loans
    ]


@app.post("/api/loans/repay")
def repay_loan_or_capital(payload: LoanRepayRequest, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    ln = db.query(LoanAccount).filter(LoanAccount.id == payload.loan_id).first()
    if not ln:
        raise HTTPException(status_code=404, detail="Loan / Capital record not found.")

    amt = pkr(payload.amount)
    if amt > pkr(ln.current_balance):
        raise HTTPException(status_code=400, detail=f"Repayment amount exceeds remaining balance of PKR {ln.current_balance:,.0f}")

    acc = db.query(FinancialAccount).filter(FinancialAccount.id == payload.account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Selected financial account not found.")

    if pkr(acc.current_balance) < amt:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance in '{acc.name}' (Available: PKR {acc.current_balance:,.0f}, Repayment: PKR {amt:,.0f})."
        )

    acc.current_balance = pkr(acc.current_balance - amt)
    ln.total_repaid = pkr(ln.total_repaid + amt)
    ln.current_balance = pkr(max(0.0, ln.total_borrowed - ln.total_repaid))
    ln.updated_at = datetime.utcnow()

    tx_no = f"LREP-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    db.add(AccountTransaction(
        tx_number=tx_no,
        tx_type="LOAN / CAPITAL REPAYMENT",
        account_id=acc.id,
        channel=acc.type,
        party=ln.lender_name,
        reference_id=ln.id,
        description=payload.remarks or f"Repaid PKR {amt:,.0f} to {ln.lender_name} via {acc.name}",
        cash_in=0.0,
        cash_out=amt
    ))

    bump_version()
    db.commit()
    return {
        "status": "success",
        "message": f"Repaid PKR {amt:,.0f} to {ln.lender_name} from {acc.name}.",
        "snapshot": export_full_snapshot(db)
    }


# ==================== LOCATION-AWARE PURCHASES ENGINE ====================

def serialize_purchase(p: Purchase) -> Dict[str, Any]:
    channel, clean_rem = extract_channel_and_remarks(p.remarks, "CASH")
    item_descriptions = []
    loc_names = []
    detailed_items = []

    for i in p.items:
        p_name = i.product.name if i.product else "Unknown"
        co_name = i.product.brand.name if (i.product and i.product.brand) else "ATH Oils"
        p_size = f"{int(i.product.pack_size)} {i.product.pack_unit}" if i.product else "700 ML"
        l_name = i.location.name if i.location else "Main Warehouse"
        upc = max(1, i.units_per_carton)
        ctns = i.base_quantity // upc
        loose = i.base_quantity % upc
        item_descriptions.append(
            f"{int(i.quantity)} {i.unit_type} {p_name} [{co_name}] ({p_size}) -> {i.base_quantity} Btls [{ctns} Ctn + {loose} Btl @ {upc}/Ctn]"
        )
        if l_name not in loc_names:
            loc_names.append(l_name)

        detailed_items.append({
            "product_id": i.product_id,
            "product_name": p_name,
            "company_name": co_name,
            "pack_size": p_size,
            "location_id": i.location_id,
            "location_name": l_name,
            "unit_type": i.unit_type,
            "quantity": i.quantity,
            "units_per_carton": upc,
            "base_quantity": i.base_quantity,
            "cartons": ctns,
            "loose_bottles": loose,
            "unit_rate": pkr(i.unit_rate),
            "line_total": pkr(i.line_total)
        })

    return {
        "id": p.id,
        "purchase_number": p.purchase_number,
        "doc_type": getattr(p, "doc_type", "PURCHASE") or "PURCHASE",
        "supplier_id": p.supplier_id,
        "supplier_name": p.supplier.name if p.supplier else "Unknown",
        "supplier_phone": p.supplier.phone if (p.supplier and p.supplier.phone) else "",
        "supplier_city": p.supplier.city if (p.supplier and p.supplier.city) else "Local",
        "supplier_cnic": getattr(p.supplier, "cnic", "") if p.supplier else "",
        "supplier_group": getattr(p.supplier, "group_name", "General Suppliers") if p.supplier else "General Suppliers",
        "invoice_date": p.invoice_date.strftime("%Y-%m-%d %H:%M"),
        "subtotal_amount": pkr(getattr(p, "subtotal_amount", p.total_amount)),
        "discount_amount": pkr(getattr(p, "discount_amount", 0.0)),
        "freight_amount": pkr(getattr(p, "freight_amount", 0.0)),
        "total_amount": pkr(p.total_amount),
        "previous_dues": pkr(getattr(p, "previous_dues", 0.0)),
        "paid_amount": pkr(p.paid_amount),
        "applied_to_previous": pkr(getattr(p, "applied_to_previous", 0.0)),
        "payable_amount": pkr(p.payable_amount),
        "closing_payable": pkr(getattr(p, "closing_payable", p.solver_payable if hasattr(p, "solver_payable") else (p.supplier.current_payable if p.supplier else p.payable_amount))),
        "payment_status": p.payment_status,
        "payment_method": channel,
        "payment_arrangement": getattr(p, "payment_arrangement", "WALLET") or "WALLET",
        "account_id": getattr(p, "account_id", None),
        "admin_id": getattr(p, "admin_id", None),
        "admin_name": getattr(p, "admin_name", "Admin") or "Admin",
        "remarks": clean_rem,
        "location_summary": ", ".join(loc_names) if loc_names else "Main Warehouse",
        "items_summary": ", ".join(item_descriptions),
        "items": detailed_items
    }


@app.get("/api/purchases")
def list_purchases(
    period: str = Query("all"),
    db: Session = Depends(get_db)
):
    start_dt, end_dt = get_period_bounds(period)
    q = (
    db.query(Purchase)
    .options(
        joinedload(Purchase.supplier),
        selectinload(Purchase.items).joinedload(PurchaseItem.product).joinedload(Product.brand),
        selectinload(Purchase.items).joinedload(PurchaseItem.location)
    )
    .order_by(Purchase.id.desc())
)
    if start_dt:
        q = q.filter(Purchase.invoice_date >= start_dt)
    if end_dt:
        q = q.filter(Purchase.invoice_date < end_dt)
    return [serialize_purchase(p) for p in q.all()]


@app.post("/api/purchases")
def create_purchase(payload: PurchaseCreate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    clean_idem_key = (payload.idempotency_key or "").strip() or None

    # 1. Strict Idempotency Key Guard: Prevent duplicate purchase bills on retry or double-click
    if clean_idem_key:
        existing_by_key = db.query(Purchase).filter(Purchase.idempotency_key == clean_idem_key).first()
        if existing_by_key:
            return {
                "status": "success",
                "duplicate_prevented": True,
                "purchase_number": existing_by_key.purchase_number,
                "purchase": serialize_purchase(existing_by_key),
                "total": pkr(existing_by_key.total_amount),
                "payable": pkr(existing_by_key.payable_amount),
                "snapshot": export_full_snapshot(db)
            }

    if not payload.items or len(payload.items) == 0:
        raise HTTPException(status_code=400, detail="Purchase bill must contain at least one product item.")

    doc_type = (payload.doc_type or "PURCHASE").strip().upper()
    is_return = (doc_type == "PURCHASE_RETURN")

    grp = resolve_or_create_party_group(
        db=db,
        group_id=payload.supplier_group_id,
        group_name=payload.supplier_group,
        party_type="SUPPLIER",
        city=payload.supplier_city
    )

    supplier = resolve_supplier_multifactor(
        db=db,
        supplier_id=payload.supplier_id,
        supplier_name=payload.supplier_name,
        supplier_phone=payload.supplier_phone,
        supplier_cnic=payload.supplier_cnic,
        supplier_city=payload.supplier_city,
        grp=grp,
        mark_favorite=payload.mark_favorite,
        force_create_new=bool(payload.force_create_new_party)
    )

    # 2. Secondary 15-Second Fingerprint Guard (blocks rapid identical double-posts even without key)
    expected_sub = sum(pkr(it.quantity * pkr(it.unit_rate)) for it in payload.items)
    expected_tot = pkr(max(0.0, expected_sub - pkr(payload.discount_amount) + pkr(payload.freight_amount)))
    recent_cutoff = now_pkt() - timedelta(seconds=15)
    recent_dup = (
        db.query(Purchase)
        .filter(
            Purchase.supplier_id == supplier.id,
            Purchase.doc_type == doc_type,
            Purchase.total_amount == expected_tot,
            Purchase.invoice_date >= recent_cutoff
        )
        .order_by(Purchase.id.desc())
        .first()
    )
    if recent_dup and len(recent_dup.items) == len(payload.items):
        return {
            "status": "success",
            "duplicate_prevented": True,
            "purchase_number": recent_dup.purchase_number,
            "purchase": serialize_purchase(recent_dup),
            "total": pkr(recent_dup.total_amount),
            "payable": pkr(recent_dup.payable_amount),
            "snapshot": export_full_snapshot(db)
        }

    subtotal_amount = 0.0
    purchase_items = []
    stock_updates = []

    for item in payload.items:
        product = resolve_or_create_product(
            db=db,
            product_id=item.product_id,
            product_name=item.product_name,
            company_name=item.company_name,
            pack_size=item.pack_size,
            units_per_carton=item.units_per_carton,
            mark_fav=item.mark_product_favorite
        )
        loc = db.query(StorageLocation).filter(StorageLocation.id == item.location_id).first()
        if not loc:
            loc = db.query(StorageLocation).first()

        if item.pack_size and item.pack_size > 0:
            product.pack_size = item.pack_size
        if item.units_per_carton and item.units_per_carton > 0:
            product.units_per_carton = item.units_per_carton

        upc = product.units_per_carton if product.units_per_carton > 0 else 12
        base_qty = int(round(item.quantity * upc)) if item.unit_type == "CARTON" else int(round(item.quantity))

        unit_rate_pkr = pkr(item.unit_rate)
        line_total = pkr(item.quantity * unit_rate_pkr)
        subtotal_amount = pkr(subtotal_amount + line_total)

        if not is_return:
            if item.unit_type == "CARTON":
                product.carton_purchase_rate = unit_rate_pkr
                product.purchase_rate = round(unit_rate_pkr / upc, 4)
            else:
                product.purchase_rate = unit_rate_pkr
                product.carton_purchase_rate = pkr(unit_rate_pkr * upc)

            if item.new_sale_rate_per_bottle and item.new_sale_rate_per_bottle > 0:
                product.sale_rate = pkr(item.new_sale_rate_per_bottle)
                product.carton_sale_rate = pkr(product.sale_rate * upc)

        purchase_items.append(PurchaseItem(
            product_id=product.id,
            location_id=loc.id if loc else None,
            unit_type=item.unit_type,
            quantity=item.quantity,
            units_per_carton=upc,
            base_quantity=base_qty,
            unit_rate=unit_rate_pkr,
            line_total=line_total
        ))
        stock_updates.append((product, loc.id if loc else 1, -base_qty if is_return else base_qty))

    discount = pkr(payload.discount_amount)
    freight = pkr(payload.freight_amount)
    total_amount = pkr(max(0.0, subtotal_amount - discount + freight))

    prev_dues = pkr(supplier.current_payable)
    paid_amt = pkr(payload.paid_amount)
    applied_to_prev = 0.0

    tx_now = now_pkt()
    prefix = "PRN" if is_return else "PUR"
    pur_no = f"{prefix}-{tx_now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    stored_remarks = f"{payload.payment_method.upper()}|{payload.remarks or ''}"

    # Verify or arrange the FULL paid_amt BEFORE committing purchase
    target_acc = resolve_financial_account(db, payload.account_id, payload.payment_method)
    if paid_amt > 0:
        if is_return:
            if target_acc:
                target_acc.current_balance = pkr(target_acc.current_balance + paid_amt)
        else:
            target_acc = handle_outflow_with_arrangement(
                db=db,
                amount=paid_amt,
                account_id=payload.account_id,
                payment_method=payload.payment_method,
                arrangement=payload.payment_arrangement,
                lender_name=payload.lender_name,
                reference_no=pur_no,
                party_name=supplier.name,
                description=f"Stock Purchase Bill {pur_no}"
            )

    if is_return:
        direct_paid = min(total_amount, paid_amt)
        payable = pkr(max(0.0, total_amount - direct_paid))
        payment_status = "RETURNED"
        closing_pay = pkr(max(0.0, prev_dues - payable))
    elif paid_amt <= total_amount:
        direct_paid = paid_amt
        payable = pkr(total_amount - direct_paid)
        payment_status = "PAID" if payable <= 0 else ("PARTIAL" if direct_paid > 0 else "UNPAID")
        closing_pay = pkr(prev_dues + payable)
    else:
        # Supplier Overpayment / Previous-Bill Settlement Cascade
        direct_paid = total_amount
        payable = 0.0
        payment_status = "PAID"
        excess_for_prev = pkr(paid_amt - total_amount)
        unpaid_past_purs = (
            db.query(Purchase)
            .filter(
                Purchase.supplier_id == supplier.id,
                Purchase.doc_type == "PURCHASE",
                Purchase.payable_amount > 0
            )
            .order_by(Purchase.invoice_date.asc(), Purchase.id.asc())
            .all()
        )
        settled_pur_notes = []
        for past_p in unpaid_past_purs:
            if excess_for_prev <= 0:
                break
            cur_rem = pkr(past_p.payable_amount)
            deduct = pkr(min(cur_rem, excess_for_prev))
            new_rem = pkr(cur_rem - deduct)
            past_p.paid_amount = pkr(past_p.paid_amount + deduct)
            past_p.payable_amount = new_rem
            past_p.payment_status = "PAID" if new_rem <= 0 else "PARTIAL"
            orig_ch, prev_rem = extract_channel_and_remarks(past_p.remarks, "CASH")
            stamp = tx_now.strftime("%Y-%m-%d %I:%M %p")
            past_p.remarks = f"{orig_ch}|{prev_rem} [Settled PKR {int(deduct):,} on {stamp} via {pur_no}]".strip()
            settled_pur_notes.append(f"{past_p.purchase_number}: PKR {deduct:,.0f}")
            applied_to_prev = pkr(applied_to_prev + deduct)
            excess_for_prev = pkr(excess_for_prev - deduct)

        if excess_for_prev > 0 and supplier.opening_payable > 0:
            op_deduct = pkr(min(supplier.opening_payable, excess_for_prev))
            supplier.opening_payable = pkr(supplier.opening_payable - op_deduct)
            applied_to_prev = pkr(applied_to_prev + op_deduct)
            settled_pur_notes.append(f"Opening Payable: PKR {op_deduct:,.0f}")

        if applied_to_prev > 0 and (payload.payment_arrangement or "WALLET").upper() == "WALLET":
            db.add(AccountTransaction(
                tx_number=f"PPAY-{tx_now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}",
                tx_date=tx_now,
                tx_type="SUPPLIER KHATA PAYMENT",
                account_id=target_acc.id if target_acc else None,
                channel=target_acc.type if target_acc else payload.payment_method.upper(),
                party=supplier.name,
                reference_id=supplier.id,
                admin_id=payload.admin_id,
                admin_name=(payload.admin_name or "Admin").strip(),
                description=f"Auto-settled previous supplier bills from {pur_no} [{'; '.join(settled_pur_notes)}]",
                cash_in=0.0,
                cash_out=applied_to_prev
            ))

        closing_pay = pkr(max(0.0, prev_dues - applied_to_prev))

    try:
        new_purchase = Purchase(
            purchase_number=pur_no,
            idempotency_key=clean_idem_key,
            doc_type=doc_type,
            supplier_id=supplier.id,
            invoice_date=tx_now,
            subtotal_amount=subtotal_amount,
            discount_amount=discount,
            freight_amount=freight,
            total_amount=total_amount,
            previous_dues=prev_dues,
            paid_amount=direct_paid,
            applied_to_previous=applied_to_prev,
            payable_amount=payable,
            closing_payable=closing_pay,
            payment_status=payment_status,
            payment_arrangement=(payload.payment_arrangement or "WALLET").upper(),
            account_id=target_acc.id if target_acc else None,
            admin_id=payload.admin_id,
            admin_name=(payload.admin_name or "Admin").strip(),
            remarks=stored_remarks,
            items=purchase_items
        )
        db.add(new_purchase)
        db.flush()

        for prod, loc_id, delta_qty in stock_updates:
            adjust_location_stock(db, prod, loc_id, delta_qty)
            db.add(StockMovement(
                movement_date=tx_now,
                product_id=prod.id,
                movement_type=doc_type,
                reference_number=pur_no,
                qty_in=max(0, delta_qty),
                qty_out=abs(min(0, delta_qty)),
                running_balance=prod.current_stock
            ))

        if is_return:
            supplier.current_payable = pkr(max(0.0, supplier.current_payable - payable))
        else:
            recompute_supplier_authoritative_payable(db, supplier)
            new_purchase.closing_payable = pkr(supplier.current_payable)

        bump_version()
        db.commit()
        db.refresh(new_purchase)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Purchase transaction rolled back safely: {str(exc)}")

    return {
        "status": "success",
        "purchase_number": pur_no,
        "purchase": serialize_purchase(new_purchase),
        "total": total_amount,
        "payable": payable,
        "snapshot": export_full_snapshot(db)
    }


@app.post("/api/purchases/{purchase_id}/payment")
def record_purchase_partial_payment(purchase_id: int, payload: PartialPaymentRequest, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    pur = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not pur:
        raise HTTPException(status_code=404, detail="Purchase bill not found")
    if pur.payable_amount <= 0:
        raise HTTPException(status_code=400, detail="This purchase bill is already settled.")
    if pkr(payload.amount) > pkr(pur.payable_amount):
        raise HTTPException(status_code=400, detail=f"Amount exceeds remaining payable of PKR {pur.payable_amount:,.0f}")

    amt = pkr(payload.amount)
    sup_name = pur.supplier.name if pur.supplier else "Supplier"

    acc = handle_outflow_with_arrangement(
        db=db,
        amount=amt,
        account_id=payload.account_id,
        payment_method=payload.payment_method,
        arrangement=payload.payment_arrangement,
        lender_name=payload.lender_name,
        reference_no=pur.purchase_number,
        party_name=sup_name,
        description=f"Installment paid against Purchase {pur.purchase_number}",
        reference_id=pur.id
    )

    pur.paid_amount = pkr(pur.paid_amount + amt)
    pur.payable_amount = pkr(max(0.0, pur.total_amount - pur.paid_amount))
    pur.payment_status = "PAID" if pur.payable_amount <= 0 else "PARTIAL"

    orig_channel, prev_remarks = extract_channel_and_remarks(pur.remarks, "CASH")
    note = f"[Inst: -PKR {int(amt)} via {acc.name if acc else payload.payment_method}]"
    pur.remarks = f"{orig_channel}|{prev_remarks} {note}".strip()

    if pur.supplier:
        pur.supplier.current_payable = pkr(max(0.0, pur.supplier.current_payable - amt))

    if (payload.payment_arrangement or "WALLET").upper() == "WALLET":
        tx_no = f"PPAY-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        db.add(AccountTransaction(
            tx_number=tx_no,
            tx_type="SUPPLIER KHATA PAYMENT",
            account_id=acc.id if acc else None,
            channel=acc.type if acc else payload.payment_method.upper(),
            party=sup_name,
            reference_id=pur.id,
            admin_id=payload.admin_id,
            admin_name=(payload.admin_name or "Admin").strip(),
            description=payload.remarks or f"Paid installment against {pur.purchase_number}",
            cash_in=0.0,
            cash_out=amt
        ))

    bump_version()
    db.commit()
    return {"status": "success", "purchase_number": pur.purchase_number, "snapshot": export_full_snapshot(db)}


@app.post("/api/suppliers/{supplier_id}/confirm-payment-allocation")
def confirm_supplier_payment_allocation(
    supplier_id: int,
    payload: ConfirmSupplierPaymentAllocationRequest,
    db: Session = Depends(get_db)
):
    """
    Atomically validates and settles one or multiple outstanding purchase bills for a Supplier.
    Supports WALLET, OWNER_CAPITAL, and MARKET_LOAN payment arrangements and records full audit history.
    """
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    sup = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail="Supplier not found.")

    pay_amt = pkr(payload.payment_amount)
    if pay_amt <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than PKR 0.")

    unpaid_purs = (
        db.query(Purchase)
        .filter(Purchase.supplier_id == sup.id, Purchase.doc_type == "PURCHASE", Purchase.payable_amount > 0)
        .order_by(Purchase.invoice_date.asc(), Purchase.id.asc())
        .all()
    )
    unpaid_map = {p.id: p for p in unpaid_purs}
    total_outstanding_before = pkr(sup.current_payable)

    validated_allocations = []
    seen_pur_ids = set()
    total_allocated = 0.0

    for item in payload.allocations:
        alloc_val = pkr(item.allocated_amount)
        if alloc_val <= 0:
            continue
        if item.purchase_id in seen_pur_ids:
            raise HTTPException(status_code=400, detail=f"Duplicate allocation entry for Purchase ID #{item.purchase_id}.")
        seen_pur_ids.add(item.purchase_id)

        pur_row = unpaid_map.get(item.purchase_id)
        if not pur_row:
            raise HTTPException(status_code=400, detail=f"Purchase bill ID #{item.purchase_id} is already settled or invalid.")
        bill_rem = pkr(pur_row.payable_amount)
        if alloc_val > bill_rem:
            raise HTTPException(
                status_code=400,
                detail=f"Allocation of PKR {alloc_val:,.0f} for {pur_row.purchase_number} exceeds its remaining balance of PKR {bill_rem:,.0f}."
            )
        total_allocated = pkr(total_allocated + alloc_val)
        validated_allocations.append((pur_row, bill_rem, alloc_val))

    if total_allocated <= 0:
        raise HTTPException(status_code=400, detail="Please allocate the payment to at least one outstanding supplier bill.")
    if total_allocated != pay_amt:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount (PKR {pay_amt:,.0f}) must match total allocated across selected bills (PKR {total_allocated:,.0f})."
        )

    tx_now = now_pkt()
    pay_no = f"PPAY-{tx_now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    try:
        acc = handle_outflow_with_arrangement(
            db=db,
            amount=pay_amt,
            account_id=payload.account_id,
            payment_method=payload.payment_method,
            arrangement=payload.payment_arrangement,
            lender_name=payload.lender_name,
            reference_no=pay_no,
            party_name=sup.name,
            description=f"Consolidated Supplier Payment {pay_no}",
            reference_id=sup.id
        )

        alloc_summaries = []
        for pur_row, bill_before, alloc_val in validated_allocations:
            rem_after = pkr(max(0.0, bill_before - alloc_val))
            pur_row.paid_amount = pkr(pur_row.paid_amount + alloc_val)
            pur_row.payable_amount = rem_after
            pur_row.payment_status = "PAID" if rem_after <= 0 else "PARTIAL"
            orig_ch, prev_rem = extract_channel_and_remarks(pur_row.remarks, "CASH")
            stamp = tx_now.strftime("%Y-%m-%d %I:%M %p")
            pur_row.remarks = f"{orig_ch}|{prev_rem} [Settled -PKR {int(alloc_val):,} on {stamp} via {pay_no}]".strip()
            alloc_summaries.append(f"{pur_row.purchase_number}: PKR {alloc_val:,.0f} (Rem: PKR {rem_after:,.0f})")

        db.flush()
        recompute_supplier_authoritative_payable(db, sup)
        for pur_row, _, _ in validated_allocations:
            pur_row.closing_payable = pkr(sup.current_payable)

        if (payload.payment_arrangement or "WALLET").upper() == "WALLET":
            db.add(AccountTransaction(
                tx_number=pay_no,
                tx_date=tx_now,
                tx_type="SUPPLIER KHATA PAYMENT",
                account_id=acc.id if acc else None,
                channel=acc.type if acc else payload.payment_method.upper(),
                party=sup.name,
                reference_id=sup.id,
                admin_id=payload.admin_id,
                admin_name=(payload.admin_name or "Admin").strip(),
                description=(
                    f"Supplier Payment PKR {pay_amt:,.0f} allocated [{'; '.join(alloc_summaries)}]"
                    + (f" | {payload.remarks}" if payload.remarks else "")
                ),
                cash_in=0.0,
                cash_out=pay_amt
            ))

        bump_version()
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to commit supplier payment allocation: {str(exc)}")

    return {
        "status": "confirmed",
        "payment_number": pay_no,
        "message": (
            f"Supplier Payment {pay_no} of PKR {pay_amt:,.0f} settled across {len(validated_allocations)} bill(s) for {sup.name}. "
            f"Remaining Supplier Payable: PKR {pkr(sup.current_payable):,.0f}."
        ),
        "snapshot": export_full_snapshot(db)
    }


# ==================== LOCATION-AWARE SALES & SMART PREVIOUS KHATA ENGINE ====================

def serialize_sale(s: Sale) -> Dict[str, Any]:
    channel, clean_rem = extract_channel_and_remarks(s.remarks, "CASH")
    item_descriptions = []
    loc_names = []
    detailed_items = []
    bill_cogs = 0.0

    for i in s.items:
        p_name = i.product.name if i.product else "Unknown"
        co_name = i.product.brand.name if (i.product and i.product.brand) else "ATH Oils"
        p_size = f"{int(i.product.pack_size)} {i.product.pack_unit}" if i.product else "700 ML"
        l_name = i.location.name if i.location else "Shop Display"
        upc = max(1, i.units_per_carton)
        ctns = i.base_quantity // upc
        loose = i.base_quantity % upc
        item_descriptions.append(
            f"{int(i.quantity)} {i.unit_type} {p_name} [{co_name}] ({p_size}) -> {i.base_quantity} Btls [{ctns} Ctn + {loose} Btl @ {upc}/Ctn]"
        )
        if l_name not in loc_names:
            loc_names.append(l_name)

        exact_item_cost = compute_sale_item_exact_cost(i)
        bill_cogs += exact_item_cost

        detailed_items.append({
            "product_id": i.product_id,
            "product_name": p_name,
            "company_name": co_name,
            "pack_size": p_size,
            "location_id": i.location_id,
            "location_name": l_name,
            "unit_type": i.unit_type,
            "quantity": i.quantity,
            "units_per_carton": upc,
            "base_quantity": i.base_quantity,
            "cartons": ctns,
            "loose_bottles": loose,
            "unit_rate": pkr(i.unit_rate),
            "line_cost": exact_item_cost,
            "line_total": pkr(i.line_total),
            "line_profit": pkr(i.line_total - exact_item_cost)
        })

    dtype = getattr(s, "doc_type", "SALE") or "SALE"
    bill_profit = 0.0 if dtype == "ESTIMATE" else pkr((s.total_amount - bill_cogs) * (-1 if dtype == "SALE_RETURN" else 1))

    return {
        "id": s.id,
        "invoice_number": s.invoice_number,
        "doc_type": dtype,
        "customer_id": s.customer_id,
        "customer_name": s.customer.name if s.customer else "Unknown",
        "customer_phone": s.customer.phone if (s.customer and s.customer.phone) else "",
        "customer_city": s.customer.city if (s.customer and s.customer.city) else "Local",
        "customer_cnic": getattr(s.customer, "cnic", "") if s.customer else "",
        "customer_group": getattr(s.customer, "group_name", "General Market") if s.customer else "General Market",
        "invoice_date": s.invoice_date.strftime("%Y-%m-%d %H:%M"),
        "subtotal_amount": pkr(getattr(s, "subtotal_amount", s.total_amount)),
        "discount_amount": pkr(getattr(s, "discount_amount", 0.0)),
        "freight_amount": pkr(getattr(s, "freight_amount", 0.0)),
        "total_amount": pkr(s.total_amount),
        "previous_dues": pkr(getattr(s, "previous_dues", 0.0)),
        "include_previous_dues": bool(getattr(s, "include_previous_dues", False)),
        "grand_payable": pkr(getattr(s, "grand_payable", s.total_amount)),
        "received_amount": pkr(s.received_amount),
        "applied_to_previous": pkr(getattr(s, "applied_to_previous", 0.0)),
        "receivable_amount": pkr(s.receivable_amount),
        "closing_receivable": pkr(getattr(s, "closing_receivable", s.receivable_amount)),
        "payment_status": s.payment_status,
        "payment_method": channel,
        "account_id": getattr(s, "account_id", None),
        "admin_id": getattr(s, "admin_id", None),
        "admin_name": getattr(s, "admin_name", "Admin") or "Admin",
        "remarks": clean_rem,
        "location_summary": ", ".join(loc_names) if loc_names else "Shop Display",
        "items_summary": ", ".join(item_descriptions),
        "bill_cost": pkr(bill_cogs),
        "bill_profit": bill_profit,
        "items": detailed_items
    }


@app.get("/api/sales")
def list_sales(
    period: str = Query("all"),
    doc_type: str = Query("ALL"),
    customer_id: Optional[int] = Query(None),
    location_id: Optional[int] = Query(None),
    payment_status: str = Query("ALL"),
    search: str = Query(""),
    db: Session = Depends(get_db)
):
    start_dt, end_dt = get_period_bounds(period)
    q = (
        db.query(Sale)
        .options(
            joinedload(Sale.customer),
            selectinload(Sale.items).joinedload(SaleItem.product).joinedload(Product.brand),
            selectinload(Sale.items).joinedload(SaleItem.location)
        )
        .order_by(Sale.invoice_date.desc(), Sale.id.desc())
    )
    if start_dt:
        q = q.filter(Sale.invoice_date >= start_dt)
    if end_dt:
        q = q.filter(Sale.invoice_date < end_dt)
    if doc_type and doc_type.upper() != "ALL":
        q = q.filter(Sale.doc_type == doc_type.upper())
    if customer_id:
        q = q.filter(Sale.customer_id == customer_id)
    if payment_status and payment_status.upper() != "ALL":
        q = q.filter(Sale.payment_status == payment_status.upper())

    sales_rows = q.all()
    if location_id:
        sales_rows = [
            s for s in sales_rows
            if any(it.location_id == location_id for it in s.items)
        ]

    clean_s = (search or "").strip().lower()
    serialized = [serialize_sale(s) for s in sales_rows]
    if clean_s:
        serialized = [
            row for row in serialized
            if clean_s in row["invoice_number"].lower()
            or clean_s in (row["customer_name"] or "").lower()
            or clean_s in (row["customer_city"] or "").lower()
            or clean_s in (row["customer_group"] or "").lower()
            or clean_s in (row["items_summary"] or "").lower()
        ]
    return serialized


@app.post("/api/sales")
def create_sale(payload: SaleCreate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    clean_idem_key = (payload.idempotency_key or "").strip() or None
    if clean_idem_key:
        existing_sale_by_key = db.query(Sale).filter(Sale.idempotency_key == clean_idem_key).first()
        if existing_sale_by_key:
            return {
                "status": "success",
                "duplicate_prevented": True,
                "invoice_number": existing_sale_by_key.invoice_number,
                "sale": serialize_sale(existing_sale_by_key),
                "total": pkr(existing_sale_by_key.total_amount),
                "receivable": pkr(existing_sale_by_key.receivable_amount),
                "closing_receivable": pkr(existing_sale_by_key.customer.current_receivable if existing_sale_by_key.customer else existing_sale_by_key.closing_receivable),
                "snapshot": export_full_snapshot(db)
            }
    doc_type = (payload.doc_type or "SALE").strip().upper()
    is_estimate = (doc_type == "ESTIMATE")
    is_return = (doc_type == "SALE_RETURN")

    grp = resolve_or_create_party_group(
        db=db,
        group_id=payload.customer_group_id,
        group_name=payload.customer_group,
        party_type="CUSTOMER",
        city=payload.customer_city
    )

    customer = resolve_customer_multifactor(
        db=db,
        customer_id=payload.customer_id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_cnic=payload.customer_cnic,
        customer_city=payload.customer_city,
        grp=grp,
        mark_favorite=payload.mark_favorite,
        force_create_new=bool(payload.force_create_new_party)
    )

    subtotal_amount = 0.0
    sale_items = []
    stock_deltas = []

    for item in payload.items:
        product = resolve_or_create_product(
            db=db,
            product_id=item.product_id,
            product_name=item.product_name,
            company_name=item.company_name,
            pack_size=item.pack_size,
            units_per_carton=item.units_per_carton,
            mark_fav=item.mark_product_favorite
        )
        loc = db.query(StorageLocation).filter(StorageLocation.id == item.location_id).first()
        if not loc:
            loc = db.query(StorageLocation).first()

        if item.pack_size and item.pack_size > 0:
            product.pack_size = item.pack_size
        if item.units_per_carton and item.units_per_carton > 0:
            product.units_per_carton = item.units_per_carton

        upc = product.units_per_carton if product.units_per_carton > 0 else 12
        base_qty = int(round(item.quantity * upc)) if item.unit_type == "CARTON" else int(round(item.quantity))

        unit_rate_pkr = pkr(item.unit_rate)
        line_total = pkr(item.quantity * unit_rate_pkr)
        subtotal_amount = pkr(subtotal_amount + line_total)

        if not is_estimate and not is_return:
            if item.unit_type == "CARTON":
                product.carton_sale_rate = unit_rate_pkr
                product.sale_rate = round(unit_rate_pkr / upc, 4)
            else:
                product.sale_rate = unit_rate_pkr
                product.carton_sale_rate = pkr(unit_rate_pkr * upc)

        # Exact whole-PKR historical cost snapshot locked onto SaleItem
        ctn_buy = getattr(product, "carton_purchase_rate", 0.0) or pkr(product.purchase_rate * upc)
        if item.unit_type == "CARTON" and ctn_buy > 0:
            exact_line_cost = pkr(item.quantity * ctn_buy)
        elif ctn_buy > 0:
            exact_line_cost = pkr((base_qty / upc) * ctn_buy)
        else:
            exact_line_cost = pkr(base_qty * (product.purchase_rate or 0.0))

        cost_per_btl = (exact_line_cost / base_qty) if base_qty > 0 else (product.purchase_rate or 0.0)

        sale_items.append(SaleItem(
            product_id=product.id,
            location_id=loc.id if loc else None,
            unit_type=item.unit_type,
            quantity=item.quantity,
            units_per_carton=upc,
            base_quantity=base_qty,
            unit_rate=unit_rate_pkr,
            cost_per_bottle=cost_per_btl,
            line_cost=exact_line_cost,
            line_total=line_total
        ))
        if not is_estimate:
            stock_deltas.append((product, loc.id if loc else 1, base_qty if is_return else -base_qty))

    for prod, loc_id, delta_qty in stock_deltas:
        adjust_location_stock(db, prod, loc_id, delta_qty)

    discount = pkr(payload.discount_amount)
    freight = pkr(payload.freight_amount)
    total_amount = pkr(max(0.0, subtotal_amount - discount + freight))

    prev_dues = pkr(customer.current_receivable)
    include_prev = bool(payload.include_previous_dues or prev_dues > 0) and not is_estimate and not is_return
    grand_payable = pkr(total_amount + (prev_dues if include_prev else 0.0))

    tx_now = now_pkt()
    rec_amt = 0.0 if is_estimate else pkr(payload.received_amount)
    direct_bill_received = 0.0
    applied_to_prev = 0.0

    prefix = "EST" if is_estimate else ("SRN" if is_return else "INV")
    invoice_no = f"{prefix}-{tx_now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    stored_remarks = f"{payload.payment_method.upper()}|{payload.remarks or ''}"

    target_acc = resolve_financial_account(db, payload.account_id, payload.payment_method)

    if is_estimate:
        receivable = 0.0
        closing_rec = prev_dues
        payment_status = "ESTIMATE"
    elif is_return:
        direct_bill_received = pkr(min(total_amount, rec_amt))
        receivable = pkr(max(0.0, total_amount - direct_bill_received))
        closing_rec = pkr(max(0.0, prev_dues - receivable))
        payment_status = "RETURNED"
    else:
        # Fetch older unpaid SALE bills ordered Oldest First (FIFO)
        unpaid_past_bills = (
            db.query(Sale)
            .filter(
                Sale.customer_id == customer.id,
                Sale.doc_type == "SALE",
                Sale.receivable_amount > 0
            )
            .order_by(Sale.invoice_date.asc(), Sale.id.asc())
            .all()
        )

        # Determine allocation order:
        # 1. If payload.include_previous_dues is True (or customer is settling running Khata FIFO):
        #    Settle Oldest Previous Bill(s) FIRST, then allocate remaining payment to the New Bill!
        #    (Example: Old Bill = 60,000, New Bill = 80,000, Payment = 100,000 ->
        #     60,000 settles Old Bill to 0; remaining 40,000 settles New Bill leaving 40,000).
        # 2. If payload.include_previous_dues is False but rec_amt > total_amount:
        #    Settle New Bill (total_amount), and allocate the excess (rec_amt - total_amount) to Oldest Previous Bills.
        settle_prev_first = bool(payload.include_previous_dues and prev_dues > 0 and rec_amt > 0)

        if settle_prev_first:
            budget_for_prev = rec_amt
        elif rec_amt > total_amount:
            budget_for_prev = pkr(rec_amt - total_amount)
        else:
            budget_for_prev = 0.0

        settled_invoice_notes = []
        if budget_for_prev > 0 and len(unpaid_past_bills) > 0:
            past_pay_no = f"CPAY-{tx_now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
            past_pm = CustomerPayment(
                payment_number=past_pay_no,
                customer_id=customer.id,
                payment_date=tx_now,
                payment_amount=0.0,
                allocated_amount=0.0,
                unallocated_credit=0.0,
                outstanding_before=prev_dues,
                outstanding_after=prev_dues,
                payment_method=target_acc.type if target_acc else payload.payment_method.upper(),
                account_id=target_acc.id if target_acc else None,
                admin_id=payload.admin_id,
                admin_name=(payload.admin_name or "Admin").strip(),
                remarks=f"Settled on {tx_now.strftime('%Y-%m-%d %I:%M %p')} via Invoice #{invoice_no}",
                status="CONFIRMED"
            )
            db.add(past_pm)
            db.flush()

            rem_prev_budget = budget_for_prev
            for past_b in unpaid_past_bills:
                if rem_prev_budget <= 0:
                    break
                cur_rem = pkr(past_b.receivable_amount)
                alloc_amt = pkr(min(cur_rem, rem_prev_budget))
                new_rem = pkr(cur_rem - alloc_amt)
                # Update bill balance WITHOUT overwriting past_b.invoice_date
                past_b.received_amount = pkr(past_b.received_amount + alloc_amt)
                past_b.receivable_amount = new_rem
                past_b.payment_status = "PAID" if new_rem <= 0 else "PARTIAL"
                orig_ch, prev_rem_txt = extract_channel_and_remarks(past_b.remarks, "CASH")
                past_b.remarks = (
                    f"{orig_ch}|{prev_rem_txt} "
                    f"[Settled +PKR {int(alloc_amt):,} on {tx_now.strftime('%Y-%m-%d %I:%M %p')} via {invoice_no}]"
                ).strip()

                db.add(CustomerPaymentAllocation(
                    payment_id=past_pm.id,
                    sale_id=past_b.id,
                    invoice_number=past_b.invoice_number,
                    bill_original_amount=pkr(past_b.total_amount),
                    outstanding_before=cur_rem,
                    allocated_amount=alloc_amt,
                    remaining_after=new_rem,
                    created_at=tx_now
                ))
                settled_invoice_notes.append(f"{past_b.invoice_number}: PKR {alloc_amt:,.0f} (Rem: PKR {new_rem:,.0f})")
                applied_to_prev = pkr(applied_to_prev + alloc_amt)
                rem_prev_budget = pkr(rem_prev_budget - alloc_amt)

            # Also check if customer had opening_receivable not tied to a bill
            if rem_prev_budget > 0 and pkr(customer.opening_receivable) > 0:
                op_deduct = pkr(min(pkr(customer.opening_receivable), rem_prev_budget))
                customer.opening_receivable = pkr(customer.opening_receivable - op_deduct)
                applied_to_prev = pkr(applied_to_prev + op_deduct)
                rem_prev_budget = pkr(rem_prev_budget - op_deduct)
                settled_invoice_notes.append(f"Opening Khata: PKR {op_deduct:,.0f}")

            past_pm.payment_amount = applied_to_prev
            past_pm.allocated_amount = applied_to_prev
            past_pm.outstanding_after = pkr(max(0.0, prev_dues - applied_to_prev))

            # Record explicit AccountTransaction for the previous-bill settlement on today's date
            if applied_to_prev > 0:
                db.add(AccountTransaction(
                    tx_number=past_pay_no,
                    tx_date=tx_now,
                    tx_type="PREVIOUS KHATA COLLECTION",
                    account_id=target_acc.id if target_acc else None,
                    channel=target_acc.type if target_acc else payload.payment_method.upper(),
                    party=customer.name,
                    reference_id=past_pm.id,
                    admin_id=payload.admin_id,
                    admin_name=(payload.admin_name or "Admin").strip(),
                    description=f"Auto-settled previous bills from {invoice_no} [{'; '.join(settled_invoice_notes)}]",
                    cash_in=applied_to_prev,
                    cash_out=0.0
                ))
        elif budget_for_prev > 0 and pkr(customer.opening_receivable) > 0:
            op_deduct = pkr(min(pkr(customer.opening_receivable), budget_for_prev))
            customer.opening_receivable = pkr(customer.opening_receivable - op_deduct)
            applied_to_prev = pkr(applied_to_prev + op_deduct)
            past_pay_no = f"CPAY-{tx_now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
            db.add(AccountTransaction(
                tx_number=past_pay_no,
                tx_date=tx_now,
                tx_type="PREVIOUS KHATA COLLECTION",
                account_id=target_acc.id if target_acc else None,
                channel=target_acc.type if target_acc else payload.payment_method.upper(),
                party=customer.name,
                reference_id=customer.id,
                admin_id=payload.admin_id,
                admin_name=(payload.admin_name or "Admin").strip(),
                description=f"Auto-settled Opening Khata from {invoice_no} (PKR {op_deduct:,.0f})",
                cash_in=op_deduct,
                cash_out=0.0
            ))

        # Remaining payment after previous-bill settlement goes to this new bill
        remaining_cash_for_new_bill = pkr(max(0.0, rec_amt - applied_to_prev))
        direct_bill_received = pkr(min(total_amount, remaining_cash_for_new_bill))
        receivable = pkr(max(0.0, total_amount - direct_bill_received))
        payment_status = "PAID" if receivable <= 0 else ("PARTIAL" if direct_bill_received > 0 else "UNPAID")

        # Any unallocated overpayment beyond (prev_dues + total_amount) is credited to advance_credit
        unallocated_excess = pkr(max(0.0, remaining_cash_for_new_bill - direct_bill_received))
        if unallocated_excess > 0:
            customer.advance_credit = pkr(getattr(customer, "advance_credit", 0.0) + unallocated_excess)

        closing_rec = pkr(max(0.0, (prev_dues - applied_to_prev) + receivable))

    if rec_amt > 0 and not is_estimate:
        if is_return:
            if not target_acc or pkr(target_acc.current_balance) < rec_amt:
                raise HTTPException(status_code=400, detail="Insufficient balance in selected account to refund Sale Return.")
            target_acc.current_balance = pkr(target_acc.current_balance - rec_amt)
        else:
            if target_acc:
                target_acc.current_balance = pkr(target_acc.current_balance + rec_amt)

    new_sale = Sale(
        invoice_number=invoice_no,
        idempotency_key=clean_idem_key,
        doc_type=doc_type,
        customer_id=customer.id,
        invoice_date=tx_now,
        subtotal_amount=subtotal_amount,
        discount_amount=discount,
        freight_amount=freight,
        total_amount=total_amount,
        previous_dues=prev_dues,
        include_previous_dues=include_prev,
        grand_payable=grand_payable,
        received_amount=direct_bill_received,
        applied_to_previous=applied_to_prev,
        receivable_amount=receivable,
        closing_receivable=closing_rec,
        payment_status=payment_status,
        account_id=target_acc.id if target_acc else None,
        admin_id=payload.admin_id,
        admin_name=(payload.admin_name or "Admin").strip(),
        remarks=stored_remarks,
        items=sale_items
    )
    db.add(new_sale)
    db.flush()

    # Record traceable CustomerPaymentAllocation for the portion allocated to this new bill
    if direct_bill_received > 0 and doc_type == "SALE":
        pay_no = f"SPAY-{tx_now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        pm_rec = CustomerPayment(
            payment_number=pay_no,
            customer_id=customer.id,
            payment_date=tx_now,
            payment_amount=direct_bill_received,
            allocated_amount=direct_bill_received,
            unallocated_credit=0.0,
            outstanding_before=total_amount,
            outstanding_after=receivable,
            payment_method=target_acc.type if target_acc else payload.payment_method.upper(),
            account_id=target_acc.id if target_acc else None,
            admin_id=payload.admin_id,
            admin_name=(payload.admin_name or "Admin").strip(),
            remarks=(
                f"Initial payment on {invoice_no}"
                + (f" (+PKR {applied_to_prev:,.0f} settled on previous bills)" if applied_to_prev > 0 else "")
            ),
            status="CONFIRMED"
        )
        db.add(pm_rec)
        db.flush()
        db.add(CustomerPaymentAllocation(
            payment_id=pm_rec.id,
            sale_id=new_sale.id,
            invoice_number=invoice_no,
            bill_original_amount=total_amount,
            outstanding_before=total_amount,
            allocated_amount=direct_bill_received,
            remaining_after=receivable,
            created_at=tx_now
        ))

    for prod, _, delta_qty in stock_deltas:
        db.add(StockMovement(
            movement_date=tx_now,
            product_id=prod.id,
            movement_type=doc_type,
            reference_number=invoice_no,
            qty_in=max(0, delta_qty),
            qty_out=abs(min(0, delta_qty)),
            running_balance=prod.current_stock
        ))

    if not is_estimate:
        recompute_customer_authoritative_receivable(db, customer)
        new_sale.closing_receivable = pkr(customer.current_receivable)

    bump_version()
    db.commit()
    db.refresh(new_sale)
    return {
        "status": "success",
        "invoice_number": invoice_no,
        "sale": serialize_sale(new_sale),
        "total": total_amount,
        "receivable": receivable,
        "closing_receivable": customer.current_receivable,
        "snapshot": export_full_snapshot(db)
    }


@app.post("/api/sales/{sale_id}/convert-estimate")
def convert_estimate_to_sale(sale_id: int, db: Session = Depends(get_db)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale or getattr(sale, "doc_type", "SALE") != "ESTIMATE":
        raise HTTPException(status_code=400, detail="Estimate record not found.")

    default_loc = db.query(StorageLocation).first()
    default_loc_id = default_loc.id if default_loc else 1

    for item in sale.items:
        if item.product:
            adjust_location_stock(db, item.product, item.location_id or default_loc_id, -item.base_quantity)
            db.add(StockMovement(
                product_id=item.product_id,
                movement_type="SALE",
                reference_number=sale.invoice_number,
                qty_out=item.base_quantity,
                running_balance=item.product.current_stock
            ))

    sale.doc_type = "SALE"
    sale.invoice_number = sale.invoice_number.replace("EST-", "INV-", 1)
    sale.receivable_amount = pkr(sale.total_amount)
    sale.payment_status = "UNPAID"
    if sale.customer:
        sale.previous_dues = pkr(sale.customer.current_receivable)
        db.flush()
        recompute_customer_authoritative_receivable(db, sale.customer)
        sale.closing_receivable = sale.customer.current_receivable

    bump_version()
    db.commit()
    return {
        "status": "success",
        "message": f"Estimate converted to confirmed Sale Invoice {sale.invoice_number}!",
        "sale": serialize_sale(sale),
        "snapshot": export_full_snapshot(db)
    }


@app.post("/api/sales/{sale_id}/payment")
def record_sale_partial_payment(sale_id: int, payload: PartialPaymentRequest, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale invoice not found")
    if sale.receivable_amount <= 0:
        raise HTTPException(status_code=400, detail="This sale invoice is already settled.")
    if pkr(payload.amount) > pkr(sale.receivable_amount):
        raise HTTPException(status_code=400, detail=f"Amount exceeds remaining balance of PKR {sale.receivable_amount:,.0f}")

    amt = pkr(payload.amount)
    acc = resolve_financial_account(db, payload.account_id, payload.payment_method)

    bill_before = pkr(sale.receivable_amount)
    sale.received_amount = pkr(sale.received_amount + amt)
    sale.receivable_amount = pkr(max(0.0, sale.total_amount - sale.received_amount))
    sale.payment_status = "PAID" if sale.receivable_amount <= 0 else "PARTIAL"

    orig_channel, prev_remarks = extract_channel_and_remarks(sale.remarks, "CASH")
    note = f"[Inst: +PKR {int(amt)} via {acc.name if acc else payload.payment_method}]"
    sale.remarks = f"{orig_channel}|{prev_remarks} {note}".strip()

    cust_out_before = pkr(sale.customer.current_receivable) if sale.customer else bill_before
    if sale.customer:
        db.flush()
        recompute_customer_authoritative_receivable(db, sale.customer)
        sale.closing_receivable = sale.customer.current_receivable

    if acc:
        acc.current_balance = pkr(acc.current_balance + amt)

    tx_no = f"RCV-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    if sale.customer:
        pm_rec = CustomerPayment(
            payment_number=tx_no,
            customer_id=sale.customer_id,
            payment_amount=amt,
            allocated_amount=amt,
            unallocated_credit=0.0,
            outstanding_before=cust_out_before,
            outstanding_after=pkr(sale.customer.current_receivable),
            payment_method=acc.type if acc else payload.payment_method.upper(),
            account_id=acc.id if acc else None,
            admin_id=payload.admin_id,
            admin_name=(payload.admin_name or "Admin").strip(),
            remarks=payload.remarks or f"Installment against {sale.invoice_number}",
            status="CONFIRMED"
        )
        db.add(pm_rec)
        db.flush()
        db.add(CustomerPaymentAllocation(
            payment_id=pm_rec.id,
            sale_id=sale.id,
            invoice_number=sale.invoice_number,
            bill_original_amount=pkr(sale.total_amount),
            outstanding_before=bill_before,
            allocated_amount=amt,
            remaining_after=pkr(sale.receivable_amount)
        ))
    db.add(AccountTransaction(
        tx_number=tx_no,
        tx_type="CUSTOMER KHATA COLLECTION",
        account_id=acc.id if acc else None,
        channel=acc.type if acc else payload.payment_method.upper(),
        party=sale.customer.name if sale.customer else "Customer",
        reference_id=sale.id,
        admin_id=payload.admin_id,
        admin_name=(payload.admin_name or "Admin").strip(),
        description=payload.remarks or f"Received installment against {sale.invoice_number}",
        cash_in=amt,
        cash_out=0.0
    ))

    bump_version()
    db.commit()
    return {"status": "success", "invoice_number": sale.invoice_number, "snapshot": export_full_snapshot(db)}


# ==================== EXPENSES & ACCOUNTS HISTORY ====================

@app.get("/api/expenses")
def list_expenses(
    period: str = Query("all"),
    db: Session = Depends(get_db)
):
    start_dt, end_dt = get_period_bounds(period)
    q = db.query(Expense).order_by(Expense.id.desc())
    if start_dt:
        q = q.filter(Expense.expense_date >= start_dt)
    if end_dt:
        q = q.filter(Expense.expense_date < end_dt)
    return [
        {
            "id": e.id,
            "expense_number": e.expense_number,
            "expense_date": e.expense_date.strftime("%Y-%m-%d %H:%M") if e.expense_date else "",
            "category": e.category,
            "description": e.description or "",
            "payment_method": e.payment_method,
            "account_id": getattr(e, "account_id", None),
            "payment_arrangement": getattr(e, "payment_arrangement", "WALLET") or "WALLET",
            "amount": pkr(e.amount),
            "paid_to": e.paid_to or "",
            "reference": e.reference or "",
            "admin_id": getattr(e, "admin_id", None),
            "admin_name": getattr(e, "admin_name", "Admin") or "Admin"
        }
        for e in q.all()
    ]


@app.post("/api/expenses")
def create_expense(payload: ExpenseCreate, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    exp_no = f"EXP-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    amt = pkr(payload.amount)

    acc = handle_outflow_with_arrangement(
        db=db,
        amount=amt,
        account_id=payload.account_id,
        payment_method=payload.payment_method,
        arrangement=payload.payment_arrangement,
        lender_name=payload.lender_name,
        reference_no=exp_no,
        party_name=payload.paid_to or payload.category,
        description=f"Operating Expense: {payload.category} - {payload.description or ''}"
    )

    new_expense = Expense(
        expense_number=exp_no,
        category=payload.category,
        description=payload.description,
        payment_method=acc.type if acc else payload.payment_method.upper(),
        account_id=acc.id if acc else None,
        payment_arrangement=(payload.payment_arrangement or "WALLET").upper(),
        amount=amt,
        paid_to=payload.paid_to,
        reference=payload.reference,
        admin_id=payload.admin_id,
        admin_name=(payload.admin_name or "Admin").strip()
    )
    db.add(new_expense)
    bump_version()
    db.commit()
    return {
        "status": "success",
        "expense_number": exp_no,
        "amount": amt,
        "snapshot": export_full_snapshot(db)
    }


@app.get("/api/accounts/history")
def get_accounts_history(
    period: str = Query("monthly"),
    channel: str = Query("ALL"),
    db: Session = Depends(get_db)
):
    start_dt, end_dt = get_period_bounds(period)
    ledger = []

    sales_q = db.query(Sale).options(joinedload(Sale.customer))
    purchases_q = db.query(Purchase).options(joinedload(Purchase.supplier))
    expenses_q = db.query(Expense)
    tx_q = db.query(AccountTransaction)

    if start_dt:
        sales_q = sales_q.filter(Sale.invoice_date >= start_dt)
        purchases_q = purchases_q.filter(Purchase.invoice_date >= start_dt)
        expenses_q = expenses_q.filter(Expense.expense_date >= start_dt)
        tx_q = tx_q.filter(AccountTransaction.tx_date >= start_dt)
    if end_dt:
        sales_q = sales_q.filter(Sale.invoice_date < end_dt)
        purchases_q = purchases_q.filter(Purchase.invoice_date < end_dt)
        expenses_q = expenses_q.filter(Expense.expense_date < end_dt)
        tx_q = tx_q.filter(AccountTransaction.tx_date < end_dt)

    tx_rows = tx_q.all()

    for s in sales_q.all():
        if getattr(s, "doc_type", "SALE") == "ESTIMATE":
            continue
        pay_channel, clean_rem = extract_channel_and_remarks(s.remarks, "CASH")
        dtype = getattr(s, "doc_type", "SALE")
        # Separate initial payment on s.invoice_date from any later CPAY/RCV settlements
        later_settled = get_sale_later_settled_amount(db, s.id, s.invoice_number)
        initial_direct = pkr(max(0.0, pkr(s.received_amount) - later_settled))
        app_prev = pkr(getattr(s, "applied_to_previous", 0.0))
        has_cpay_atx = any(
            s.invoice_number in (t.description or "") and t.tx_type == "PREVIOUS KHATA COLLECTION"
            for t in tx_rows
        )
        effective_cash_in = pkr(initial_direct + (0.0 if has_cpay_atx else app_prev))
        is_unpaid_credit_bill = (effective_cash_in <= 0 and dtype == "SALE")
        effective_channel = "KHATA" if is_unpaid_credit_bill else pay_channel

        if channel != "ALL" and effective_channel != channel:
            continue

        if is_unpaid_credit_bill:
            tx_label = "CREDIT SALE (KHATA)"
            status_desc = (
                f"Credit Bill PKR {pkr(s.total_amount):,.0f} added to Khata (Unpaid: PKR {pkr(s.receivable_amount):,.0f})"
                + (f" | {clean_rem}" if clean_rem else "")
            )
        else:
            tx_label = "SALE RETURN" if dtype == "SALE_RETURN" else "SALE INFLOW"
            desc_parts = [clean_rem] if clean_rem else [f"{dtype} ({s.payment_status}) - Bill Total: PKR {pkr(s.total_amount):,.0f}"]
            if app_prev > 0 and not has_cpay_atx:
                desc_parts.append(f"[Bill: PKR {initial_direct:,.0f} + Old Khata Settled: PKR {app_prev:,.0f}]")
            status_desc = " ".join(desc_parts)

        ledger.append({
            "id": f"SALE-{s.id}",
            "entity_type": "SALE",
            "entity_id": s.id,
            "date": s.invoice_date.strftime("%Y-%m-%d %H:%M"),
            "timestamp": s.invoice_date.isoformat(),
            "type": tx_label,
            "reference": s.invoice_number,
            "party": s.customer.name if s.customer else "Customer",
            "channel": effective_channel,
            "admin_id": getattr(s, "admin_id", None),
            "admin_name": getattr(s, "admin_name", "Admin") or "Admin",
            "description": status_desc,
            "total_bill": pkr(s.total_amount),
            "cash_in": 0.0 if dtype == "SALE_RETURN" else effective_cash_in,
            "cash_out": effective_cash_in if dtype == "SALE_RETURN" else 0.0
        })

    for p in purchases_q.all():
        pay_channel, clean_rem = extract_channel_and_remarks(p.remarks, "CASH")
        dtype = getattr(p, "doc_type", "PURCHASE")
        pur_arr = (getattr(p, "payment_arrangement", "WALLET") or "WALLET").upper()
        later_pur_paid = get_purchase_later_settled_amount(db, p.id)
        initial_pur_paid = pkr(max(0.0, pkr(p.paid_amount) - later_pur_paid))
        app_prev_pur = pkr(getattr(p, "applied_to_previous", 0.0))
        has_ppay_atx = any(
            p.purchase_number in (t.description or "") and t.tx_type == "SUPPLIER KHATA PAYMENT"
            for t in tx_rows
        )
        # If paid via OWNER_CAPITAL or MARKET_LOAN, the cash inflow/outflow is already logged in AccountTransaction (ARR- / OUT-)
        raw_pur_cash = pkr(initial_pur_paid + (0.0 if has_ppay_atx else app_prev_pur))
        effective_cash_out = 0.0 if pur_arr in ("OWNER_CAPITAL", "MARKET_LOAN") else raw_pur_cash
        is_unpaid_credit_pur = (raw_pur_cash <= 0 and dtype == "PURCHASE")
        effective_channel = "KHATA" if is_unpaid_credit_pur else (pur_arr if pur_arr in ("OWNER_CAPITAL", "MARKET_LOAN") else pay_channel)

        if channel != "ALL" and effective_channel != channel:
            continue

        if is_unpaid_credit_pur:
            tx_label = "CREDIT PURCHASE (KHATA)"
            status_desc = (
                f"Supplier Credit Bill PKR {pkr(p.total_amount):,.0f} (Payable: PKR {pkr(p.payable_amount):,.0f})"
                + (f" | {clean_rem}" if clean_rem else "")
            )
        elif pur_arr in ("OWNER_CAPITAL", "MARKET_LOAN"):
            tx_label = f"PURCHASE ({pur_arr.replace('_', ' ')})"
            status_desc = f"Bill PKR {pkr(p.total_amount):,.0f} arranged via {pur_arr.replace('_', ' ')}" + (f" | {clean_rem}" if clean_rem else "")
        else:
            tx_label = "PURCHASE RETURN" if dtype == "PURCHASE_RETURN" else "PURCHASE OUTFLOW"
            desc_parts = [clean_rem] if clean_rem else [f"{dtype} ({p.payment_status}) - Bill Total: PKR {pkr(p.total_amount):,.0f}"]
            if app_prev_pur > 0 and not has_ppay_atx:
                desc_parts.append(f"[Bill: PKR {initial_pur_paid:,.0f} + Old Dues Settled: PKR {app_prev_pur:,.0f}]")
            status_desc = " ".join(desc_parts)

        ledger.append({
            "id": f"PUR-{p.id}",
            "entity_type": "PURCHASE",
            "entity_id": p.id,
            "date": p.invoice_date.strftime("%Y-%m-%d %H:%M"),
            "timestamp": p.invoice_date.isoformat(),
            "type": tx_label,
            "reference": p.purchase_number,
            "party": p.supplier.name if p.supplier else "Supplier",
            "channel": effective_channel,
            "admin_id": getattr(p, "admin_id", None),
            "admin_name": getattr(p, "admin_name", "Admin") or "Admin",
            "description": status_desc,
            "total_bill": pkr(p.total_amount),
            "cash_in": effective_cash_out if dtype == "PURCHASE_RETURN" else 0.0,
            "cash_out": 0.0 if dtype == "PURCHASE_RETURN" else effective_cash_out
        })

    for e in expenses_q.all():
        exp_arr = (getattr(e, "payment_arrangement", "WALLET") or "WALLET").upper()
        effective_exp_channel = exp_arr if exp_arr in ("OWNER_CAPITAL", "MARKET_LOAN") else e.payment_method
        if channel != "ALL" and effective_exp_channel != channel:
            continue
        effective_exp_out = 0.0 if exp_arr in ("OWNER_CAPITAL", "MARKET_LOAN") else pkr(e.amount)
        ledger.append({
            "id": f"EXP-{e.id}",
            "entity_type": "EXPENSE",
            "entity_id": e.id,
            "date": e.expense_date.strftime("%Y-%m-%d %H:%M"),
            "timestamp": e.expense_date.isoformat(),
            "type": f"EXPENSE ({exp_arr.replace('_', ' ')})" if exp_arr in ("OWNER_CAPITAL", "MARKET_LOAN") else "EXPENSE OUTFLOW",
            "reference": e.expense_number,
            "party": e.paid_to or e.category,
            "channel": effective_exp_channel,
            "admin_id": getattr(e, "admin_id", None),
            "admin_name": getattr(e, "admin_name", "Admin") or "Admin",
            "description": f"{e.category} - {e.description or ''}",
            "total_bill": pkr(e.amount),
            "cash_in": 0.0,
            "cash_out": effective_exp_out
        })

    for t in tx_rows:
        if channel != "ALL" and channel not in (t.channel or ""):
            continue
        ledger.append({
            "id": f"ATX-{t.id}",
            "entity_type": "ACCOUNT_TX",
            "entity_id": t.id,
            "date": t.tx_date.strftime("%Y-%m-%d %H:%M"),
            "timestamp": t.tx_date.isoformat(),
            "type": t.tx_type,
            "reference": t.tx_number,
            "party": t.party or "Account",
            "channel": t.channel,
            "admin_id": getattr(t, "admin_id", None),
            "admin_name": getattr(t, "admin_name", "Admin") or "Admin",
            "description": t.description or t.tx_type,
            "total_bill": pkr(max(t.cash_in, t.cash_out)),
            "cash_in": pkr(t.cash_in),
            "cash_out": pkr(t.cash_out)
        })

    ledger.sort(key=lambda x: x["timestamp"], reverse=True)
    return ledger


# ==================== VYAPAR COMPLETE REPORTS SUITE ====================

@app.get("/api/reports/vyapar")
def get_vyapar_reports(
    period: str = Query("monthly"),
    db: Session = Depends(get_db)
):
    start_dt, end_dt = get_period_bounds(period)

    # 1. Bill-Wise Profit & Loss Report (Eager-loaded in 1 batch)
    sales_q = (
        db.query(Sale)
        .options(
            joinedload(Sale.customer),
            selectinload(Sale.items).joinedload(SaleItem.product).joinedload(Product.brand),
            selectinload(Sale.items).joinedload(SaleItem.location)
        )
        .order_by(Sale.id.desc())
    )
    if start_dt:
        sales_q = sales_q.filter(Sale.invoice_date >= start_dt)
    if end_dt:
        sales_q = sales_q.filter(Sale.invoice_date < end_dt)

    period_sales = sales_q.all()
    bill_wise_pnl = []
    s_items_by_prod: Dict[int, List[SaleItem]] = {}

    for s in period_sales:
        if getattr(s, "doc_type", "SALE") == "ESTIMATE":
            continue
        for si in s.items:
            s_items_by_prod.setdefault(si.product_id, []).append(si)
        ser = serialize_sale(s)
        bill_wise_pnl.append({
            "id": s.id,
            "invoice_number": ser["invoice_number"],
            "doc_type": ser["doc_type"],
            "date": ser["invoice_date"],
            "customer_name": ser["customer_name"],
            "customer_city": ser["customer_city"],
            "customer_group": ser["customer_group"],
            "items_summary": ser["items_summary"],
            "sale_amount": ser["total_amount"],
            "cost_amount": ser["bill_cost"],
            "discount_amount": ser["discount_amount"],
            "freight_amount": ser["freight_amount"],
            "net_profit": ser["bill_profit"],
            "received_amount": ser["received_amount"],
            "pending_amount": ser["receivable_amount"]
        })

    # 2. Item-Wise Stock & Profit Summary Report (Single batch query instead of 2*N queries)
    pur_items_q = db.query(PurchaseItem).join(Purchase)
    if start_dt:
        pur_items_q = pur_items_q.filter(Purchase.invoice_date >= start_dt)
    if end_dt:
        pur_items_q = pur_items_q.filter(Purchase.invoice_date < end_dt)

    p_items_by_prod: Dict[int, List[PurchaseItem]] = {}
    for pi in pur_items_q.all():
        p_items_by_prod.setdefault(pi.product_id, []).append(pi)

    products = db.query(Product).options(joinedload(Product.brand)).order_by(Product.id.asc()).all()
    item_reports = []
    for p in products:
        upc = max(1, p.units_per_carton or 12)
        p_items = p_items_by_prod.get(p.id, [])
        s_items = s_items_by_prod.get(p.id, [])

        qty_bought_btls = sum(i.base_quantity for i in p_items)
        purchase_val = sum(pkr(i.line_total) for i in p_items)

        qty_sold_btls = sum(i.base_quantity for i in s_items)
        sale_val = sum(pkr(i.line_total) for i in s_items)
        sold_cogs = sum(compute_sale_item_exact_cost(i) for i in s_items)
        item_profit = pkr(sale_val - sold_cogs)

        ctn_buy = getattr(p, "carton_purchase_rate", 0.0) or pkr(p.purchase_rate * upc)
        closing_val = pkr((p.current_stock / upc) * ctn_buy) if ctn_buy > 0 else pkr(p.current_stock * p.purchase_rate)

        item_reports.append({
            "product_id": p.id,
            "sku": p.sku,
            "name": p.name,
            "brand_name": p.brand.name if p.brand else "ATH Oils",
            "pack_size": f"{int(p.pack_size)} {p.pack_unit}",
            "units_per_carton": upc,
            "purchased_bottles": qty_bought_btls,
            "purchased_formatted": f"{qty_bought_btls // upc} Ctn + {qty_bought_btls % upc} Btl",
            "purchase_value": pkr(purchase_val),
            "sold_bottles": qty_sold_btls,
            "sold_formatted": f"{qty_sold_btls // upc} Ctn + {qty_sold_btls % upc} Btl",
            "sale_revenue": pkr(sale_val),
            "cogs": pkr(sold_cogs),
            "profit": item_profit,
            "closing_bottles": p.current_stock,
            "closing_formatted": f"{p.current_stock // upc} Ctn + {p.current_stock % upc} Btl",
            "closing_valuation": closing_val
        })

    # 3. Customer Group / Route Summary
    group_map: Dict[str, Dict[str, Any]] = {}
    for c in db.query(Customer).options(selectinload(Customer.sales)).all():
        g_name = getattr(c, "group_name", "General Market") or "General Market"
        if g_name not in group_map:
            group_map[g_name] = {
                "group_name": g_name,
                "customers_count": 0,
                "total_receivable": 0.0,
                "total_sales": 0.0
            }
        group_map[g_name]["customers_count"] += 1
        group_map[g_name]["total_receivable"] = pkr(group_map[g_name]["total_receivable"] + pkr(c.current_receivable))
        c_sales = sum(pkr(s.total_amount) for s in c.sales if getattr(s, "doc_type", "SALE") == "SALE")
        group_map[g_name]["total_sales"] = pkr(group_map[g_name]["total_sales"] + c_sales)

    return {
        "period": period,
        "bill_wise_profit": bill_wise_pnl,
        "item_wise_summary": item_reports,
        "customer_groups": list(group_map.values()),
        "daybook": get_accounts_history(period=period, channel="ALL", db=db)
    }


# ==================== PASSWORD-PROTECTED REVERSE & RECYCLE BIN ====================

def pur_no_matches_atx(pur_row: Purchase, atx_desc: str) -> bool:
    if not pur_row:
        return False
    if not atx_desc:
        return True
    if pur_row.purchase_number in atx_desc:
        return True
    if "Paid installment against" in atx_desc:
        return True
    return False


@app.post("/api/security/reverse/{entity_type}/{entity_id}")
def reverse_and_move_to_trash(
    entity_type: str,
    entity_id: int,
    payload: PasswordVerifyRequest,
    db: Session = Depends(get_db)
):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    verify_admin_password(payload.admin_password, db=db, admin_id=payload.admin_id, admin_name=payload.admin_name)
    sync_postgres_sequences(db)
    etype = entity_type.upper()

    default_loc = db.query(StorageLocation).first()
    default_loc_id = default_loc.id if default_loc else 1

    try:
        if is_sqlite:
            db.execute(text("PRAGMA foreign_keys=OFF"))

        if etype == "SALE":
            sale = db.query(Sale).filter(Sale.id == entity_id).first()
            if not sale:
                raise HTTPException(status_code=404, detail="Sale invoice not found")

            sale_id_val = sale.id
            sale_inv_no = sale.invoice_number
            sale_cust_id = sale.customer_id
            channel, _ = extract_channel_and_remarks(sale.remarks, "CASH")
            dtype = getattr(sale, "doc_type", "SALE") or "SALE"
            cust_obj = sale.customer
            items_data = []
            for item in sale.items:
                items_data.append({
                    "product_id": item.product_id,
                    "location_id": item.location_id or default_loc_id,
                    "unit_type": item.unit_type,
                    "quantity": item.quantity,
                    "units_per_carton": item.units_per_carton,
                    "base_quantity": item.base_quantity,
                    "unit_rate": pkr(item.unit_rate),
                    "cost_per_bottle": getattr(item, "cost_per_bottle", 0.0),
                    "line_cost": pkr(getattr(item, "line_cost", 0.0)),
                    "line_total": pkr(item.line_total)
                })
                if item.product and dtype != "ESTIMATE":
                    rev_delta = -item.base_quantity if dtype == "SALE_RETURN" else item.base_quantity
                    adjust_location_stock(db, item.product, item.location_id or default_loc_id, rev_delta)

            # 1. If this Sale auto-settled older bills via a CPAY voucher, restore those older bills' balances
            auto_cpay_rows = (
                db.query(CustomerPayment)
                .filter(
                    CustomerPayment.customer_id == sale_cust_id,
                    CustomerPayment.remarks.ilike(f"%{sale_inv_no}%")
                )
                .all()
            )
            for cpay in auto_cpay_rows:
                cpay_no = cpay.payment_number
                for al in list(cpay.allocations):
                    if al.sale_id != sale_id_val:
                        older_sale = db.query(Sale).filter(Sale.id == al.sale_id).first()
                        if older_sale:
                            older_sale.received_amount = pkr(max(0.0, older_sale.received_amount - al.allocated_amount))
                            older_sale.receivable_amount = pkr(max(0.0, older_sale.total_amount - older_sale.received_amount))
                            older_sale.payment_status = (
                                "PAID" if older_sale.receivable_amount <= 0
                                else ("PARTIAL" if older_sale.received_amount > 0 else "UNPAID")
                            )
                    db.delete(al)
                db.flush()
                db.execute(
                    text("DELETE FROM account_transactions WHERE tx_number = :tno"),
                    {"tno": cpay_no}
                )
                db.delete(cpay)
            db.flush()

            # 2. Remove any remaining CustomerPaymentAllocation rows referencing this sale_id so PostgreSQL FK never blocks delete
            direct_allocs = (
                db.query(CustomerPaymentAllocation)
                .filter(CustomerPaymentAllocation.sale_id == sale_id_val)
                .all()
            )
            affected_payment_ids = {al.payment_id for al in direct_allocs}
            for al in direct_allocs:
                db.delete(al)
            db.flush()

            for pid in affected_payment_ids:
                pm_obj = db.query(CustomerPayment).filter(CustomerPayment.id == pid).first()
                if pm_obj:
                    rem_allocs = db.query(CustomerPaymentAllocation).filter(CustomerPaymentAllocation.payment_id == pid).count()
                    if rem_allocs == 0:
                        pm_no = pm_obj.payment_number
                        db.execute(
                            text("DELETE FROM account_transactions WHERE tx_number = :tno"),
                            {"tno": pm_no}
                        )
                        db.delete(pm_obj)
            db.flush()

            total_cash_effect = pkr(sale.received_amount + getattr(sale, "applied_to_previous", 0.0))
            if total_cash_effect > 0 and dtype != "ESTIMATE":
                acc = resolve_financial_account(db, getattr(sale, "account_id", None), channel)
                if acc:
                    if dtype == "SALE_RETURN":
                        acc.current_balance = pkr(acc.current_balance + total_cash_effect)
                    else:
                        acc.current_balance = pkr(max(0.0, acc.current_balance - total_cash_effect))

            snapshot = {
                "invoice_number": sale_inv_no,
                "doc_type": dtype,
                "customer_id": sale_cust_id,
                "subtotal_amount": pkr(getattr(sale, "subtotal_amount", sale.total_amount)),
                "discount_amount": pkr(getattr(sale, "discount_amount", 0.0)),
                "freight_amount": pkr(getattr(sale, "freight_amount", 0.0)),
                "total_amount": pkr(sale.total_amount),
                "received_amount": pkr(sale.received_amount),
                "receivable_amount": pkr(sale.receivable_amount),
                "payment_status": sale.payment_status,
                "account_id": getattr(sale, "account_id", None),
                "remarks": sale.remarks,
                "items": items_data
            }

            db.add(RecycleBin(
                entity_type="SALE",
                entity_id=sale_id_val,
                reference_code=sale_inv_no,
                title=f"{dtype} to {cust_obj.name if cust_obj else 'Customer'}",
                summary=f"Reversed {dtype} | Total: PKR {sale.total_amount:,.0f} | Received: PKR {total_cash_effect:,.0f}",
                amount=pkr(sale.total_amount),
                payload_json=json.dumps(snapshot)
            ))
            db.flush()

            db.query(AccountTransaction).filter(
                AccountTransaction.reference_id == sale_id_val,
                AccountTransaction.tx_type == "CUSTOMER KHATA COLLECTION"
            ).delete(synchronize_session=False)
            db.query(StockMovement).filter(StockMovement.reference_number == sale_inv_no).delete(synchronize_session=False)
            db.query(SaleItem).filter(SaleItem.sale_id == sale_id_val).delete(synchronize_session=False)
            db.expunge(sale)
            db.query(Sale).filter(Sale.id == sale_id_val).delete(synchronize_session=False)
            db.flush()

            if cust_obj and dtype != "ESTIMATE":
                recompute_customer_authoritative_receivable(db, cust_obj)

            bump_version()
            db.commit()
            return {"status": "reversed", "message": f"Sale {snapshot['invoice_number']} reversed & moved to Recycle Bin.", "snapshot": export_full_snapshot(db)}

        elif etype == "PURCHASE":
            pur = db.query(Purchase).filter(Purchase.id == entity_id).first()
            if not pur:
                raise HTTPException(status_code=404, detail="Purchase bill not found")

            pur_id_val = pur.id
            pur_no_val = pur.purchase_number
            pur_sup_id = pur.supplier_id
            pur_arr = (getattr(pur, "payment_arrangement", "WALLET") or "WALLET").upper()
            channel, _ = extract_channel_and_remarks(pur.remarks, "CASH")
            dtype = getattr(pur, "doc_type", "PURCHASE") or "PURCHASE"
            sup_obj = pur.supplier
            items_data = []
            for item in pur.items:
                items_data.append({
                    "product_id": item.product_id,
                    "location_id": item.location_id or default_loc_id,
                    "unit_type": item.unit_type,
                    "quantity": item.quantity,
                    "units_per_carton": item.units_per_carton,
                    "base_quantity": item.base_quantity,
                    "unit_rate": pkr(item.unit_rate),
                    "line_total": pkr(item.line_total)
                })
                if item.product:
                    loc_id = item.location_id or default_loc_id
                    loc_stock = db.query(ProductLocationStock).filter(
                        ProductLocationStock.product_id == item.product_id,
                        ProductLocationStock.location_id == loc_id
                    ).first()
                    if loc_stock:
                        if dtype == "PURCHASE_RETURN":
                            loc_stock.stock_bottles += int(item.base_quantity or 0)
                        else:
                            loc_stock.stock_bottles = max(0, int(loc_stock.stock_bottles or 0) - int(item.base_quantity or 0))
                    db.flush()
                    all_ls = db.query(ProductLocationStock).filter(ProductLocationStock.product_id == item.product_id).all()
                    item.product.current_stock = sum(max(0, int(x.stock_bottles or 0)) for x in all_ls)

            # 1. If this Purchase auto-settled older supplier bills via applied_to_previous, restore those older bills
            app_prev_pur = pkr(getattr(pur, "applied_to_previous", 0.0))
            if app_prev_pur > 0 and pur_sup_id:
                rem_to_restore = app_prev_pur
                older_purs = (
                    db.query(Purchase)
                    .filter(
                        Purchase.supplier_id == pur_sup_id,
                        Purchase.id != pur_id_val,
                        Purchase.doc_type == "PURCHASE",
                        Purchase.paid_amount > 0
                    )
                    .order_by(Purchase.id.desc())
                    .all()
                )
                for old_p in older_purs:
                    if rem_to_restore <= 0:
                        break
                    restore_amt = pkr(min(pkr(old_p.paid_amount), rem_to_restore))
                    if restore_amt > 0:
                        old_p.paid_amount = pkr(max(0.0, old_p.paid_amount - restore_amt))
                        old_p.payable_amount = pkr(max(0.0, old_p.total_amount - old_p.paid_amount))
                        old_p.payment_status = "PAID" if old_p.payable_amount <= 0 else ("PARTIAL" if old_p.paid_amount > 0 else "UNPAID")
                        rem_to_restore = pkr(rem_to_restore - restore_amt)
                db.query(AccountTransaction).filter(
                    AccountTransaction.tx_type == "SUPPLIER KHATA PAYMENT",
                    AccountTransaction.description.ilike(f"%{pur_no_val}%")
                ).delete(synchronize_session=False)

            # 2. Refund wallet or reverse arranged LoanAccount balance
            total_pur_cash = pkr(pur.paid_amount + app_prev_pur)
            if total_pur_cash > 0:
                if pur_arr == "WALLET":
                    acc = resolve_financial_account(db, getattr(pur, "account_id", None), channel)
                    if acc:
                        if dtype == "PURCHASE_RETURN":
                            acc.current_balance = pkr(max(0.0, acc.current_balance - total_pur_cash))
                        else:
                            acc.current_balance = pkr(acc.current_balance + total_pur_cash)
                elif pur_arr in ("OWNER_CAPITAL", "MARKET_LOAN"):
                    arr_txs = db.query(AccountTransaction).filter(
                        AccountTransaction.description.ilike(f"%{pur_no_val}%")
                    ).all()
                    for atx_row in arr_txs:
                        if atx_row.tx_type in ("OWNER CAPITAL INJECTION", "MARKET LOAN INFLOW") and atx_row.reference_id:
                            ln_obj = db.query(LoanAccount).filter(LoanAccount.id == atx_row.reference_id).first()
                            if ln_obj:
                                ln_obj.total_borrowed = pkr(max(0.0, ln_obj.total_borrowed - atx_row.cash_in))
                                ln_obj.current_balance = pkr(max(0.0, ln_obj.total_borrowed - ln_obj.total_repaid))
                    db.query(AccountTransaction).filter(
                        AccountTransaction.description.ilike(f"%{pur_no_val}%")
                    ).delete(synchronize_session=False)

            snapshot = {
                "purchase_number": pur_no_val,
                "doc_type": dtype,
                "supplier_id": pur_sup_id,
                "total_amount": pkr(pur.total_amount),
                "paid_amount": pkr(pur.paid_amount),
                "payable_amount": pkr(pur.payable_amount),
                "payment_status": pur.payment_status,
                "payment_arrangement": pur_arr,
                "account_id": getattr(pur, "account_id", None),
                "remarks": pur.remarks,
                "items": items_data
            }

            db.add(RecycleBin(
                entity_type="PURCHASE",
                entity_id=pur_id_val,
                reference_code=pur_no_val,
                title=f"Purchase Bill from {sup_obj.name if sup_obj else 'Supplier'}",
                summary=f"Reversed Purchase | Bill: PKR {pur.total_amount:,.0f} | Paid: PKR {total_pur_cash:,.0f}",
                amount=pkr(pur.total_amount),
                payload_json=json.dumps(snapshot)
            ))
            db.flush()

            db.query(AccountTransaction).filter(
                AccountTransaction.reference_id == pur_id_val,
                AccountTransaction.tx_type == "SUPPLIER KHATA PAYMENT"
            ).delete(synchronize_session=False)
            db.query(StockMovement).filter(StockMovement.reference_number == pur_no_val).delete(synchronize_session=False)
            db.query(PurchaseItem).filter(PurchaseItem.purchase_id == pur_id_val).delete(synchronize_session=False)
            db.expunge(pur)
            db.query(Purchase).filter(Purchase.id == pur_id_val).delete(synchronize_session=False)
            db.flush()

            if sup_obj:
                recompute_supplier_authoritative_payable(db, sup_obj)

            bump_version()
            db.commit()
            return {"status": "reversed", "message": f"Purchase {snapshot['purchase_number']} reversed & moved to Recycle Bin.", "snapshot": export_full_snapshot(db)}

        elif etype == "EXPENSE":
            exp = db.query(Expense).filter(Expense.id == entity_id).first()
            if not exp:
                raise HTTPException(status_code=404, detail="Expense not found")

            exp_id_val = exp.id
            exp_no_val = exp.expense_number
            exp_arr = (getattr(exp, "payment_arrangement", "WALLET") or "WALLET").upper()
            if exp_arr == "WALLET":
                acc = resolve_financial_account(db, getattr(exp, "account_id", None), exp.payment_method)
                if acc:
                    acc.current_balance = pkr(acc.current_balance + exp.amount)
            elif exp_arr in ("OWNER_CAPITAL", "MARKET_LOAN"):
                arr_txs = db.query(AccountTransaction).filter(
                    AccountTransaction.description.ilike(f"%{exp_no_val}%")
                ).all()
                for atx_row in arr_txs:
                    if atx_row.tx_type in ("OWNER CAPITAL INJECTION", "MARKET LOAN INFLOW") and atx_row.reference_id:
                        ln_obj = db.query(LoanAccount).filter(LoanAccount.id == atx_row.reference_id).first()
                        if ln_obj:
                            ln_obj.total_borrowed = pkr(max(0.0, ln_obj.total_borrowed - atx_row.cash_in))
                            ln_obj.current_balance = pkr(max(0.0, ln_obj.total_borrowed - ln_obj.total_repaid))
                db.query(AccountTransaction).filter(
                    AccountTransaction.description.ilike(f"%{exp_no_val}%")
                ).delete(synchronize_session=False)

            snapshot = {
                "expense_number": exp_no_val,
                "category": exp.category,
                "description": exp.description,
                "payment_method": exp.payment_method,
                "payment_arrangement": exp_arr,
                "account_id": getattr(exp, "account_id", None),
                "amount": pkr(exp.amount),
                "paid_to": exp.paid_to
            }

            db.add(RecycleBin(
                entity_type="EXPENSE",
                entity_id=exp_id_val,
                reference_code=exp_no_val,
                title=f"Expense: {exp.category} ({exp.paid_to or 'General'})",
                summary=f"Reversed Expense | Refunded PKR {exp.amount:,.0f} to {exp.payment_method}",
                amount=pkr(exp.amount),
                payload_json=json.dumps(snapshot)
            ))
            db.flush()
            db.expunge(exp)
            db.query(Expense).filter(Expense.id == exp_id_val).delete(synchronize_session=False)
            bump_version()
            db.commit()
            return {"status": "reversed", "message": f"Expense {snapshot['expense_number']} reversed & refunded.", "snapshot": export_full_snapshot(db)}

        elif etype == "ACCOUNT_TX":
            atx = db.query(AccountTransaction).filter(AccountTransaction.id == entity_id).first()
            if not atx:
                raise HTTPException(status_code=404, detail="Account transaction not found or already reversed.")

            atx_id_val = atx.id
            atx_no_val = atx.tx_number
            atx_type_val = atx.tx_type
            atx_acc_id = atx.account_id
            atx_to_acc_id = atx.to_account_id
            atx_channel = atx.channel or "CASH"
            atx_party = atx.party or "Account"
            atx_ref_id = getattr(atx, "reference_id", None)
            atx_desc = atx.description or atx_type_val
            atx_in = pkr(atx.cash_in)
            atx_out = pkr(atx.cash_out)
            tx_amount = pkr(max(atx_in, atx_out))

            if atx_type_val in ("CASH DEPOSIT", "CUSTOMER KHATA COLLECTION", "PREVIOUS KHATA COLLECTION", "CUSTOMER PAYMENT ALLOCATION"):
                acc = resolve_financial_account(db, atx_acc_id, atx_channel)
                if acc:
                    acc.current_balance = pkr(max(0.0, acc.current_balance - atx_in))
            elif atx_type_val in ("CASH WITHDRAWAL", "SUPPLIER KHATA PAYMENT", "LOAN / CAPITAL REPAYMENT"):
                acc = resolve_financial_account(db, atx_acc_id, atx_channel)
                if acc:
                    acc.current_balance = pkr(acc.current_balance + atx_out)
                if atx_type_val == "LOAN / CAPITAL REPAYMENT" and atx_ref_id:
                    ln_obj = db.query(LoanAccount).filter(LoanAccount.id == atx_ref_id).first()
                    if ln_obj:
                        ln_obj.total_repaid = pkr(max(0.0, ln_obj.total_repaid - atx_out))
                        ln_obj.current_balance = pkr(max(0.0, ln_obj.total_borrowed - ln_obj.total_repaid))
            elif atx_type_val == "ACCOUNT TRANSFER":
                from_acc = db.query(FinancialAccount).filter(FinancialAccount.id == atx_acc_id).first() if atx_acc_id else None
                to_acc = db.query(FinancialAccount).filter(FinancialAccount.id == atx_to_acc_id).first() if atx_to_acc_id else None
                if from_acc:
                    from_acc.current_balance = pkr(from_acc.current_balance + atx_out)
                if to_acc:
                    to_acc.current_balance = pkr(max(0.0, to_acc.current_balance - atx_in))

            # If this ledger row was a Customer Payment voucher (CPAY/RCV), restore the linked Sale bill balances
            linked_pm = db.query(CustomerPayment).filter(CustomerPayment.payment_number == atx_no_val).first()
            if linked_pm and linked_pm.status != "REVERSED":
                for al in list(linked_pm.allocations):
                    s_row = db.query(Sale).filter(Sale.id == al.sale_id).first()
                    if s_row:
                        s_row.received_amount = pkr(max(0.0, s_row.received_amount - al.allocated_amount))
                        s_row.receivable_amount = pkr(max(0.0, s_row.total_amount - s_row.received_amount))
                        s_row.payment_status = "PAID" if s_row.receivable_amount <= 0 else ("PARTIAL" if s_row.received_amount > 0 else "UNPAID")
                # If this CPAY was auto-created by a newer Sale (via include_previous_dues), clear applied_to_previous on that Sale
                if linked_pm.remarks and "Invoice #" in linked_pm.remarks:
                    trigger_inv_no = linked_pm.remarks.split("Invoice #", 1)[1].strip().split()[0]
                    trigger_sale = db.query(Sale).filter(Sale.invoice_number == trigger_inv_no).first()
                    if trigger_sale:
                        trigger_sale.applied_to_previous = 0.0
                linked_pm.status = "REVERSED"
                linked_pm.reversed_at = now_pkt()
                if linked_pm.customer:
                    db.flush()
                    recompute_customer_authoritative_receivable(db, linked_pm.customer)

            # If this ledger row was a Supplier Khata Payment (PPAY), restore the linked Purchase bill balance(s)
            if atx_type_val == "SUPPLIER KHATA PAYMENT":
                pur_row = db.query(Purchase).filter(Purchase.id == atx_ref_id).first() if atx_ref_id else None
                if pur_row and pur_no_matches_atx(pur_row, atx_desc):
                    pur_row.paid_amount = pkr(max(0.0, pur_row.paid_amount - atx_out))
                    pur_row.payable_amount = pkr(max(0.0, pur_row.total_amount - pur_row.paid_amount))
                    pur_row.payment_status = "PAID" if pur_row.payable_amount <= 0 else ("PARTIAL" if pur_row.paid_amount > 0 else "UNPAID")
                    if pur_row.supplier:
                        db.flush()
                        recompute_supplier_authoritative_payable(db, pur_row.supplier)
                else:
                    # Consolidated supplier payment where reference_id is supplier.id
                    sup_obj = db.query(Supplier).filter(Supplier.id == atx_ref_id).first() if atx_ref_id else None
                    if not sup_obj and atx_party:
                        sup_obj = db.query(Supplier).filter(Supplier.name.ilike(atx_party)).first()
                    if sup_obj:
                        rem_restore = atx_out
                        sup_purs = (
                            db.query(Purchase)
                            .filter(Purchase.supplier_id == sup_obj.id, Purchase.paid_amount > 0)
                            .order_by(Purchase.id.desc())
                            .all()
                        )
                        for sp in sup_purs:
                            if rem_restore <= 0:
                                break
                            if sp.purchase_number in atx_desc or len(sup_purs) == 1:
                                d_amt = pkr(min(pkr(sp.paid_amount), rem_restore))
                                sp.paid_amount = pkr(max(0.0, sp.paid_amount - d_amt))
                                sp.payable_amount = pkr(max(0.0, sp.total_amount - sp.paid_amount))
                                sp.payment_status = "PAID" if sp.payable_amount <= 0 else ("PARTIAL" if sp.paid_amount > 0 else "UNPAID")
                                rem_restore = pkr(rem_restore - d_amt)
                        db.flush()
                        recompute_supplier_authoritative_payable(db, sup_obj)

            atx_snapshot = {
                "tx_number": atx_no_val,
                "tx_type": atx_type_val,
                "account_id": atx_acc_id,
                "to_account_id": atx_to_acc_id,
                "channel": atx_channel,
                "party": atx_party,
                "reference_id": atx_ref_id,
                "description": atx_desc,
                "cash_in": atx_in,
                "cash_out": atx_out
            }
            db.add(RecycleBin(
                entity_type="ACCOUNT_TX",
                entity_id=atx_id_val,
                reference_code=atx_no_val,
                title=f"{atx_type_val}: {atx_party}",
                summary=f"Reversed {atx_type_val} | Amount: PKR {tx_amount:,.0f} | {atx_desc}",
                amount=tx_amount,
                payload_json=json.dumps(atx_snapshot)
            ))
            db.flush()
            db.expunge(atx)
            db.query(AccountTransaction).filter(AccountTransaction.id == atx_id_val).delete(synchronize_session=False)
            bump_version()
            db.commit()
            return {"status": "reversed", "message": f"Transaction {atx_no_val} reversed, balances restored, and moved to Recycle Bin.", "snapshot": export_full_snapshot(db)}

        elif etype == "CUSTOMER_PAYMENT":
            pm = db.query(CustomerPayment).filter(CustomerPayment.id == entity_id).first()
            if not pm:
                raise HTTPException(status_code=404, detail="Customer payment voucher not found")
            if pm.status == "REVERSED":
                raise HTTPException(status_code=400, detail="This payment voucher has already been reversed.")

            for al in pm.allocations:
                sale_row = db.query(Sale).filter(Sale.id == al.sale_id).first()
                if sale_row:
                    sale_row.received_amount = pkr(max(0.0, sale_row.received_amount - al.allocated_amount))
                    sale_row.receivable_amount = pkr(max(0.0, sale_row.total_amount - sale_row.received_amount))
                    sale_row.payment_status = (
                        "PAID" if sale_row.receivable_amount <= 0
                        else ("PARTIAL" if sale_row.received_amount > 0 else "UNPAID")
                    )

            pm.status = "REVERSED"
            pm.reversed_at = datetime.utcnow()
            pm.reversal_reason = payload.reason or "Authorized Admin Reversal"

            if pm.customer:
                if pm.unallocated_credit > 0:
                    pm.customer.advance_credit = pkr(max(0.0, getattr(pm.customer, "advance_credit", 0.0) - pm.unallocated_credit))
                db.flush()
                recompute_customer_authoritative_receivable(db, pm.customer)

            acc = resolve_financial_account(db, pm.account_id, pm.payment_method)
            if acc:
                acc.current_balance = pkr(max(0.0, acc.current_balance - pm.payment_amount))

            db.add(AccountTransaction(
                tx_number=f"REV-{pm.payment_number}",
                tx_type="PAYMENT REVERSAL AUDIT",
                account_id=acc.id if acc else None,
                channel=pm.payment_method,
                party=pm.customer.name if pm.customer else "Customer",
                reference_id=pm.id,
                description=f"Reversed Payment {pm.payment_number} (PKR {pkr(pm.payment_amount):,.0f}) - Restored bill balances",
                cash_in=0.0,
                cash_out=pkr(pm.payment_amount)
            ))
            bump_version()
            db.commit()
            return {
                "status": "reversed",
                "message": f"Payment {pm.payment_number} reversed and bill balances restored with full audit history.",
                "snapshot": export_full_snapshot(db)
            }

        elif etype == "PRODUCT":
            prod = db.query(Product).filter(Product.id == entity_id).first()
            if not prod:
                raise HTTPException(status_code=404, detail="Product not found")
            prod_id_val = prod.id
            linked_sales = db.query(SaleItem).filter(SaleItem.product_id == prod_id_val).count()
            linked_purs = db.query(PurchaseItem).filter(PurchaseItem.product_id == prod_id_val).count()
            if linked_sales > 0 or linked_purs > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete '{prod.name}' because it is linked to {linked_sales} Sale item(s) and {linked_purs} Purchase item(s). Reverse those bills first if you want to remove this product."
                )
            loc_list = [{"location_id": ls.location_id, "stock_bottles": ls.stock_bottles} for ls in prod.location_stocks]
            snapshot = {
                "sku": prod.sku,
                "name": prod.name,
                "brand_id": prod.brand_id,
                "viscosity_grade": prod.viscosity_grade,
                "pack_size": prod.pack_size,
                "pack_unit": prod.pack_unit,
                "units_per_carton": prod.units_per_carton,
                "purchase_rate": prod.purchase_rate,
                "sale_rate": prod.sale_rate,
                "carton_purchase_rate": getattr(prod, "carton_purchase_rate", 0.0),
                "carton_sale_rate": getattr(prod, "carton_sale_rate", 0.0),
                "current_stock": prod.current_stock,
                "reorder_level": prod.reorder_level,
                "locations": loc_list
            }
            db.add(RecycleBin(
                entity_type="PRODUCT",
                entity_id=prod_id_val,
                reference_code=prod.sku,
                title=f"Product: {prod.name}",
                summary=f"Stock: {prod.current_stock} Bottles ({int(prod.pack_size)} {prod.pack_unit})",
                amount=pkr(prod.current_stock * prod.purchase_rate),
                payload_json=json.dumps(snapshot)
            ))
            db.flush()
            for ls_obj in list(prod.location_stocks):
                db.expunge(ls_obj)
            db.expunge(prod)

            db.execute(text("DELETE FROM product_location_stocks WHERE product_id = :pid"), {"pid": prod_id_val})
            db.execute(text("DELETE FROM stock_movements WHERE product_id = :pid"), {"pid": prod_id_val})
            db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod_id_val})
            bump_version()
            db.commit()
            return {"status": "reversed", "message": f"Product {snapshot['name']} moved to Recycle Bin.", "snapshot": export_full_snapshot(db)}

        elif etype == "CUSTOMER":
            cus = db.query(Customer).filter(Customer.id == entity_id).first()
            if not cus:
                raise HTTPException(status_code=404, detail="Customer not found")
            cus_id_val = cus.id
            cust_sales_count = db.query(Sale).filter(Sale.customer_id == cus_id_val).count()
            if cust_sales_count > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete customer '{cus.name}' because they have {cust_sales_count} recorded Sale invoice(s). Reverse those invoices first to keep your accounting & cash balances accurate."
                )
            snapshot = {
                "code": cus.code,
                "name": cus.name,
                "phone": cus.phone,
                "cnic": getattr(cus, "cnic", None),
                "group_name": getattr(cus, "group_name", "General Market"),
                "city": cus.city,
                "credit_limit": pkr(cus.credit_limit),
                "current_receivable": pkr(cus.current_receivable)
            }
            db.add(RecycleBin(
                entity_type="CUSTOMER",
                entity_id=cus_id_val,
                reference_code=cus.code,
                title=f"Customer: {cus.name} ({cus.city})",
                summary=f"Phone: {cus.phone or 'N/A'} | Receivable Balance: PKR {cus.current_receivable:,.0f}",
                amount=pkr(cus.current_receivable),
                payload_json=json.dumps(snapshot)
            ))
            db.flush()
            db.expunge(cus)

            db.execute(text("DELETE FROM customers WHERE id = :cid"), {"cid": cus_id_val})
            bump_version()
            db.commit()
            return {"status": "reversed", "message": f"Customer {snapshot['name']} moved to Recycle Bin.", "snapshot": export_full_snapshot(db)}

        elif etype == "SUPPLIER":
            sup = db.query(Supplier).filter(Supplier.id == entity_id).first()
            if not sup:
                raise HTTPException(status_code=404, detail="Supplier not found")
            sup_id_val = sup.id
            sup_pur_count = db.query(Purchase).filter(Purchase.supplier_id == sup_id_val).count()
            if sup_pur_count > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete supplier '{sup.name}' because they have {sup_pur_count} recorded Purchase bill(s). Reverse those purchase bills first to keep your stock & cash balances accurate."
                )
            snapshot = {
                "code": sup.code,
                "name": sup.name,
                "phone": sup.phone,
                "cnic": getattr(sup, "cnic", None),
                "group_name": getattr(sup, "group_name", "General Suppliers"),
                "city": sup.city,
                "current_payable": pkr(sup.current_payable)
            }
            db.add(RecycleBin(
                entity_type="SUPPLIER",
                entity_id=sup_id_val,
                reference_code=sup.code,
                title=f"Supplier: {sup.name} ({sup.city})",
                summary=f"Phone: {sup.phone or 'N/A'} | Payable Balance: PKR {sup.current_payable:,.0f}",
                amount=pkr(sup.current_payable),
                payload_json=json.dumps(snapshot)
            ))
            db.flush()
            db.expunge(sup)

            db.execute(text("DELETE FROM suppliers WHERE id = :sid"), {"pid": sup_id_val, "sid": sup_id_val})
            bump_version()
            db.commit()
            return {"status": "reversed", "message": f"Supplier {snapshot['name']} moved to Recycle Bin.", "snapshot": export_full_snapshot(db)}

        elif etype == "LOCATION":
            total_locs_count = db.query(StorageLocation).count()
            if total_locs_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot delete the primary default location. At least one storage location must remain active."
                )
            loc = db.query(StorageLocation).filter(StorageLocation.id == entity_id).first()
            if not loc:
                raise HTTPException(status_code=404, detail="Location not found")
            loc_id_val = loc.id
            total_btls = sum(ps.stock_bottles for ps in loc.product_stocks)
            if total_btls > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete '{loc.name}' while it holds {total_btls} bottles. Transfer stock first."
                )
            fallback_loc = db.query(StorageLocation).filter(StorageLocation.id != loc_id_val).order_by(StorageLocation.id.asc()).first()
            fallback_loc_id = fallback_loc.id if fallback_loc else None

            snapshot = {"code": loc.code, "name": loc.name, "location_type": loc.location_type, "address": loc.address}
            db.add(RecycleBin(
                entity_type="LOCATION",
                entity_id=loc_id_val,
                reference_code=loc.code,
                title=f"Storage Location: {loc.name}",
                summary=f"Type: {loc.location_type} | Address: {loc.address or 'N/A'}",
                amount=0.0,
                payload_json=json.dumps(snapshot)
            ))
            db.flush()
            for ps_obj in list(loc.product_stocks):
                db.expunge(ps_obj)
            db.expunge(loc)

            if fallback_loc_id:
                db.query(SaleItem).filter(SaleItem.location_id == loc_id_val).update(
                    {SaleItem.location_id: fallback_loc_id}, synchronize_session=False
                )
                db.query(PurchaseItem).filter(PurchaseItem.location_id == loc_id_val).update(
                    {PurchaseItem.location_id: fallback_loc_id}, synchronize_session=False
                )
            db.execute(text("DELETE FROM product_location_stocks WHERE location_id = :lid"), {"lid": loc_id_val})
            db.execute(text("DELETE FROM storage_locations WHERE id = :lid"), {"lid": loc_id_val})
            bump_version()
            db.commit()
            return {"status": "reversed", "message": f"Location {snapshot['name']} moved to Recycle Bin.", "snapshot": export_full_snapshot(db)}

        elif etype == "ACCOUNT":
            acc = db.query(FinancialAccount).filter(FinancialAccount.id == entity_id).first()
            if not acc:
                raise HTTPException(status_code=404, detail="Financial account not found")
            acc_id_val = acc.id
            snapshot = {
                "name": acc.name,
                "type": acc.type,
                "account_number": acc.account_number,
                "current_balance": pkr(acc.current_balance)
            }
            db.add(RecycleBin(
                entity_type="ACCOUNT",
                entity_id=acc_id_val,
                reference_code=acc.type,
                title=f"Account: {acc.name}",
                summary=f"Type: {acc.type} | No: {acc.account_number or 'N/A'} | Balance: PKR {acc.current_balance:,.0f}",
                amount=pkr(acc.current_balance),
                payload_json=json.dumps(snapshot)
            ))
            db.flush()
            db.expunge(acc)

            db.execute(text("DELETE FROM financial_accounts WHERE id = :aid"), {"aid": acc_id_val})
            bump_version()
            db.commit()
            return {"status": "reversed", "message": f"Account {snapshot['name']} moved to Recycle Bin.", "snapshot": export_full_snapshot(db)}

        raise HTTPException(status_code=400, detail="Unsupported entity type.")
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Reversal error: {str(e)}")
    finally:
        if is_sqlite:
            db.execute(text("PRAGMA foreign_keys=ON"))


@app.get("/api/recycle-bin")
def list_recycle_bin(db: Session = Depends(get_db)):
    items = db.query(RecycleBin).order_by(RecycleBin.id.desc()).all()
    return [
        {
            "id": i.id,
            "entity_type": i.entity_type,
            "reference_code": i.reference_code,
            "title": i.title,
            "summary": i.summary,
            "amount": pkr(i.amount),
            "deleted_at": i.deleted_at.strftime("%Y-%m-%d %H:%M")
        }
        for i in items
    ]


@app.post("/api/recycle-bin/{trash_id}/restore")
def restore_from_recycle_bin(trash_id: int, db: Session = Depends(get_db)):
    trash = db.query(RecycleBin).filter(RecycleBin.id == trash_id).first()
    if not trash:
        raise HTTPException(status_code=404, detail="Recycle bin record not found")

    data = json.loads(trash.payload_json)
    etype = trash.entity_type

    if etype == "EXPENSE":
        exp = Expense(
            expense_number=data["expense_number"],
            category=data["category"],
            description=data.get("description"),
            payment_method=data.get("payment_method", "CASH"),
            account_id=data.get("account_id"),
            amount=pkr(data["amount"]),
            paid_to=data.get("paid_to")
        )
        db.add(exp)
        acc = resolve_financial_account(db, data.get("account_id"), exp.payment_method)
        if acc:
            acc.current_balance = pkr(max(0.0, acc.current_balance - exp.amount))

    elif etype == "PRODUCT":
        upc = max(1, int(data.get("units_per_carton", 12)))
        prod = Product(
            sku=data["sku"],
            name=data["name"],
            brand_id=data.get("brand_id", 1),
            viscosity_grade=data.get("viscosity_grade", "20W-50 4T"),
            pack_size=data.get("pack_size", 700),
            pack_unit=data.get("pack_unit", "ML"),
            units_per_carton=upc,
            purchase_rate=data.get("purchase_rate", 0.0),
            sale_rate=data.get("sale_rate", 0.0),
            carton_purchase_rate=pkr(data.get("carton_purchase_rate", 0.0)),
            carton_sale_rate=pkr(data.get("carton_sale_rate", 0.0)),
            current_stock=0,
            reorder_level=data.get("reorder_level", 12),
            is_favorite=True
        )
        db.add(prod)
        db.flush()
        for loc_entry in data.get("locations", []):
            adjust_location_stock(db, prod, loc_entry["location_id"], loc_entry["stock_bottles"])

    elif etype == "CUSTOMER":
        db.add(Customer(
            code=data["code"],
            name=data["name"],
            phone=data.get("phone"),
            cnic=data.get("cnic"),
            group_name=data.get("group_name", "General Market"),
            city=data.get("city", "Local"),
            credit_limit=pkr(data.get("credit_limit", 50000.0)),
            current_receivable=pkr(data.get("current_receivable", 0.0)),
            is_favorite=True
        ))

    elif etype == "SUPPLIER":
        db.add(Supplier(
            code=data["code"],
            name=data["name"],
            phone=data.get("phone"),
            cnic=data.get("cnic"),
            group_name=data.get("group_name", "General Suppliers"),
            city=data.get("city", "Local"),
            current_payable=pkr(data.get("current_payable", 0.0)),
            is_favorite=True
        ))

    elif etype == "LOCATION":
        db.add(StorageLocation(
            code=data["code"],
            name=data["name"],
            location_type=data.get("location_type", "WAREHOUSE"),
            address=data.get("address")
        ))

    elif etype == "ACCOUNT":
        db.add(FinancialAccount(
            name=data["name"],
            type=data.get("type", "CASH"),
            account_number=data.get("account_number"),
            current_balance=pkr(data.get("current_balance", 0.0))
        ))

    elif etype == "ACCOUNT_TX":
        tx_type = data.get("tx_type", "CASH DEPOSIT")
        cash_in = pkr(data.get("cash_in", 0.0))
        cash_out = pkr(data.get("cash_out", 0.0))
        acc_id = data.get("account_id")
        to_acc_id = data.get("to_account_id")
        channel = data.get("channel", "CASH")

        if tx_type in ("CASH DEPOSIT", "CUSTOMER KHATA COLLECTION", "PREVIOUS KHATA COLLECTION", "CUSTOMER PAYMENT ALLOCATION"):
            acc = resolve_financial_account(db, acc_id, channel)
            if acc:
                acc.current_balance = pkr(acc.current_balance + cash_in)
        elif tx_type in ("CASH WITHDRAWAL", "SUPPLIER KHATA PAYMENT", "LOAN / CAPITAL REPAYMENT"):
            acc = resolve_financial_account(db, acc_id, channel)
            if acc:
                acc.current_balance = pkr(max(0.0, acc.current_balance - cash_out))
        elif tx_type == "ACCOUNT TRANSFER":
            from_acc = db.query(FinancialAccount).filter(FinancialAccount.id == acc_id).first() if acc_id else None
            to_acc = db.query(FinancialAccount).filter(FinancialAccount.id == to_acc_id).first() if to_acc_id else None
            if from_acc:
                from_acc.current_balance = pkr(max(0.0, from_acc.current_balance - cash_out))
            if to_acc:
                to_acc.current_balance = pkr(to_acc.current_balance + cash_in)

        db.add(AccountTransaction(
            tx_number=data.get("tx_number") or f"ATX-{now_pkt().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}",
            tx_date=now_pkt(),
            tx_type=tx_type,
            account_id=acc_id,
            to_account_id=to_acc_id,
            channel=channel,
            party=data.get("party"),
            reference_id=data.get("reference_id"),
            description=data.get("description"),
            cash_in=cash_in,
            cash_out=cash_out
        ))

    elif etype == "SALE":
        restored_items = []
        dtype = data.get("doc_type", "SALE")
        for item in data.get("items", []):
            prod = db.query(Product).filter(Product.id == item["product_id"]).first()
            if prod and dtype != "ESTIMATE":
                delta = item["base_quantity"] if dtype == "SALE_RETURN" else -item["base_quantity"]
                adjust_location_stock(db, prod, item.get("location_id", 1), delta)
            restored_items.append(SaleItem(
                product_id=item["product_id"],
                location_id=item.get("location_id", 1),
                unit_type=item["unit_type"],
                quantity=item["quantity"],
                units_per_carton=item["units_per_carton"],
                base_quantity=item["base_quantity"],
                unit_rate=pkr(item["unit_rate"]),
                cost_per_bottle=item.get("cost_per_bottle", 0.0),
                line_cost=pkr(item.get("line_cost", 0.0)),
                line_total=pkr(item["line_total"])
            ))
        sale = Sale(
            invoice_number=data["invoice_number"],
            doc_type=dtype,
            customer_id=data["customer_id"],
            subtotal_amount=pkr(data.get("subtotal_amount", data["total_amount"])),
            discount_amount=pkr(data.get("discount_amount", 0.0)),
            freight_amount=pkr(data.get("freight_amount", 0.0)),
            total_amount=pkr(data["total_amount"]),
            received_amount=pkr(data["received_amount"]),
            receivable_amount=pkr(data["receivable_amount"]),
            payment_status=data["payment_status"],
            account_id=data.get("account_id"),
            remarks=data.get("remarks"),
            items=restored_items
        )
        db.add(sale)
        cus = db.query(Customer).filter(Customer.id == data["customer_id"]).first()
        if cus and dtype != "ESTIMATE":
            cus.current_receivable = pkr(cus.current_receivable + data["receivable_amount"])
        channel, _ = extract_channel_and_remarks(data.get("remarks"), "CASH")
        if data["received_amount"] > 0 and dtype != "ESTIMATE":
            acc = resolve_financial_account(db, data.get("account_id"), channel)
            if acc:
                acc.current_balance = pkr(acc.current_balance + data["received_amount"])

    elif etype == "PURCHASE":
        restored_items = []
        dtype = data.get("doc_type", "PURCHASE")
        for item in data.get("items", []):
            prod = db.query(Product).filter(Product.id == item["product_id"]).first()
            if prod:
                delta = -item["base_quantity"] if dtype == "PURCHASE_RETURN" else item["base_quantity"]
                adjust_location_stock(db, prod, item.get("location_id", 1), delta)
            restored_items.append(PurchaseItem(
                product_id=item["product_id"],
                location_id=item.get("location_id", 1),
                unit_type=item["unit_type"],
                quantity=item["quantity"],
                units_per_carton=item["units_per_carton"],
                base_quantity=item["base_quantity"],
                unit_rate=pkr(item["unit_rate"]),
                line_total=pkr(item["line_total"])
            ))
        pur = Purchase(
            purchase_number=data["purchase_number"],
            doc_type=dtype,
            supplier_id=data["supplier_id"],
            total_amount=pkr(data["total_amount"]),
            paid_amount=pkr(data["paid_amount"]),
            payable_amount=pkr(data["payable_amount"]),
            payment_status=data["payment_status"],
            account_id=data.get("account_id"),
            remarks=data.get("remarks"),
            items=restored_items
        )
        db.add(pur)
        sup = db.query(Supplier).filter(Supplier.id == data["supplier_id"]).first()
        if sup:
            sup.current_payable = pkr(sup.current_payable + data["payable_amount"])
        channel, _ = extract_channel_and_remarks(data.get("remarks"), "CASH")
        if data["paid_amount"] > 0:
            acc = resolve_financial_account(db, data.get("account_id"), channel)
            if acc:
                acc.current_balance = pkr(max(0.0, acc.current_balance - data["paid_amount"]))

    db.delete(trash)
    bump_version()
    db.commit()
    return {"status": "restored", "message": f"{trash.title} restored to active system.", "snapshot": export_full_snapshot(db)}


@app.post("/api/recycle-bin/{trash_id}/permanent-delete")
def permanent_delete_single(trash_id: int, payload: PasswordVerifyRequest, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    verify_admin_password(payload.admin_password, db=db, admin_id=payload.admin_id, admin_name=payload.admin_name)
    trash = db.query(RecycleBin).filter(RecycleBin.id == trash_id).first()
    if not trash:
        raise HTTPException(status_code=404, detail="Record not found in Recycle Bin")
    db.delete(trash)
    bump_version()
    db.commit()
    return {"status": "purged", "message": "Record permanently deleted from Recycle Bin.", "snapshot": export_full_snapshot(db)}


@app.post("/api/recycle-bin/empty")
def empty_recycle_bin(payload: PasswordVerifyRequest, db: Session = Depends(get_db)):
    sync_from_client_snapshot_if_newer(db, payload.client_snapshot)
    verify_admin_password(payload.admin_password, db=db, admin_id=payload.admin_id, admin_name=payload.admin_name)
    db.query(RecycleBin).delete(synchronize_session=False)
    bump_version()
    db.commit()
    return {"status": "emptied", "message": "Recycle Bin permanently emptied.", "snapshot": export_full_snapshot(db)}