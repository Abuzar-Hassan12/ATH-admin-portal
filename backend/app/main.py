from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
from typing import Optional
import json
import uuid

from .database import engine, Base, get_db
from .models import (
    Brand, StorageLocation, Product, ProductLocationStock,
    Supplier, Customer, Purchase, PurchaseItem,
    Sale, SaleItem, StockMovement, FinancialAccount, Expense, RecycleBin
)
from .schemas import (
    LoginRequest, PasswordVerifyRequest, PartialPaymentRequest,
    LocationCreate, LocationUpdate, StockTransferRequest, DirectLocationStockSet,
    ProductCreate, ProductUpdate,
    CustomerCreate, CustomerUpdate,
    SupplierCreate, SupplierUpdate,
    FinancialAccountCreate, FinancialAccountUpdate,
    PurchaseCreate, SaleCreate, ExpenseCreate
)
from .seed import seed_database

Base.metadata.create_all(bind=engine)

app = FastAPI(title="ATH Lubricants - Enterprise ERP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    seed_database()
    with engine.connect() as conn:
        for tbl in ["customers", "suppliers"]:
            try:
                cols = [r[1] for r in conn.execute(text(f"PRAGMA table_info({tbl})")).fetchall()]
                if "is_favorite" not in cols:
                    conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN is_favorite BOOLEAN DEFAULT 1"))
                    conn.commit()
                # If no favorites are marked yet, mark existing records as favorite so dropdown is populated
                fav_count = conn.execute(text(f"SELECT COUNT(*) FROM {tbl} WHERE is_favorite = 1")).scalar()
                if fav_count == 0:
                    conn.execute(text(f"UPDATE {tbl} SET is_favorite = 1"))
                    conn.commit()
            except Exception:
                pass


def verify_admin_password(pw: str):
    if not pw or pw.strip() != "Admin@786":
        raise HTTPException(status_code=403, detail="Incorrect Admin Password. Authorization denied.")


def get_period_start(period: str) -> Optional[datetime]:
    now = datetime.utcnow()
    if period == "daily":
        return datetime(now.year, now.month, now.day)
    elif period == "weekly":
        return now - timedelta(days=7)
    elif period == "monthly":
        return now - timedelta(days=30)
    return None


def extract_channel_and_remarks(raw_remarks: Optional[str], default_channel: str = "CASH"):
    if not raw_remarks:
        return default_channel, ""
    if "|" in raw_remarks:
        parts = raw_remarks.split("|", 1)
        return parts[0].strip().upper(), parts[1].strip()
    return default_channel, raw_remarks


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
            detail=f"Sale Blocked! '{product.name}' is out of stock in '{loc_name}' (Available: {loc_stock.stock_bottles} Btls, Required: {abs(delta_bottles)} Btls) and has 0 stock in other locations."
        )

    loc_stock.stock_bottles += delta_bottles
    db.flush()

    all_loc_stocks = db.query(ProductLocationStock).filter(ProductLocationStock.product_id == product.id).all()
    product.current_stock = sum(ls.stock_bottles for ls in all_loc_stocks)


# ==================== AUTHENTICATION ====================
@app.post("/api/auth/login")
def admin_login(payload: LoginRequest):
    if payload.username.strip() == "Admin" and payload.password == "Admin@786":
        return {
            "status": "authenticated",
            "username": "Admin",
            "role": "System Administrator"
        }
    raise HTTPException(status_code=401, detail="Invalid username or password.")


# ==================== DASHBOARD KPI STATS ====================
@app.get("/api/dashboard/stats")
def get_dashboard_stats(
    period: str = Query("monthly", pattern="^(daily|weekly|monthly|all)$"),
    db: Session = Depends(get_db)
):
    start_dt = get_period_start(period)

    products = db.query(Product).all()
    total_stock_bottles = sum(p.current_stock for p in products)
    total_stock_value = sum(p.current_stock * p.purchase_rate for p in products)

    customers = db.query(Customer).all()
    total_receivable = sum(c.current_receivable for c in customers)

    suppliers = db.query(Supplier).all()
    total_payable = sum(s.current_payable for s in suppliers)

    accounts = db.query(FinancialAccount).all()
    total_cash_bank = sum(a.current_balance for a in accounts)

    sales_q = db.query(Sale)
    purchases_q = db.query(Purchase)
    expenses_q = db.query(Expense)

    if start_dt:
        sales_q = sales_q.filter(Sale.invoice_date >= start_dt)
        purchases_q = purchases_q.filter(Purchase.invoice_date >= start_dt)
        expenses_q = expenses_q.filter(Expense.expense_date >= start_dt)

    sales_list = sales_q.all()
    purchases_list = purchases_q.all()
    expenses_list = expenses_q.all()

    period_sales_revenue = sum(s.total_amount for s in sales_list)
    period_sales_collected = sum(s.received_amount for s in sales_list)
    period_sales_pending = sum(s.receivable_amount for s in sales_list)

    period_purchases_cost = sum(p.total_amount for p in purchases_list)
    period_purchases_paid = sum(p.paid_amount for p in purchases_list)
    period_purchases_pending = sum(p.payable_amount for p in purchases_list)

    period_expenses = sum(e.amount for e in expenses_list)

    cogs = 0.0
    for s in sales_list:
        for item in s.items:
            prod_buy_rate = (
                item.product.purchase_rate
                if (item.product and item.product.purchase_rate > 0)
                else (item.unit_rate / max(1, item.units_per_carton if item.unit_type == "CARTON" else 1)) * 0.85
            )
            cogs += item.base_quantity * prod_buy_rate

    gross_profit = period_sales_revenue - cogs
    net_profit = gross_profit - period_expenses
    trash_count = db.query(RecycleBin).count()

    return {
        "period": period,
        "total_stock_bottles": total_stock_bottles,
        "total_stock_value": round(total_stock_value, 2),
        "total_receivable": round(total_receivable, 2),
        "total_payable": round(total_payable, 2),
        "total_cash_bank": round(total_cash_bank, 2),
        "total_sales_revenue": round(period_sales_revenue, 2),
        "sales_collected": round(period_sales_collected, 2),
        "sales_pending": round(period_sales_pending, 2),
        "sales_count": len(sales_list),
        "total_purchases_cost": round(period_purchases_cost, 2),
        "purchases_paid": round(period_purchases_paid, 2),
        "purchases_pending": round(period_purchases_pending, 2),
        "purchases_count": len(purchases_list),
        "total_expenses": round(period_expenses, 2),
        "expenses_count": len(expenses_list),
        "estimated_gross_profit": round(gross_profit, 2),
        "net_profit": round(net_profit, 2),
        "net_cash_flow": round(period_sales_collected - period_purchases_paid - period_expenses, 2),
        "trash_count": trash_count
    }


# ==================== STORAGE LOCATIONS ====================
@app.get("/api/locations")
def list_locations(db: Session = Depends(get_db)):
    locs = db.query(StorageLocation).order_by(StorageLocation.id.asc()).all()
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
    existing = db.query(StorageLocation).filter(StorageLocation.name == payload.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="A location with this name already exists.")
    code = f"LOC-{uuid.uuid4().hex[:4].upper()}"
    loc = StorageLocation(
        code=code,
        name=payload.name.strip(),
        location_type=payload.location_type.upper(),
        address=payload.address
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@app.put("/api/locations/{location_id}")
def update_location(location_id: int, payload: LocationUpdate, db: Session = Depends(get_db)):
    loc = db.query(StorageLocation).filter(StorageLocation.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(loc, k, v)
    db.commit()
    return loc


# ==================== DIRECT LOCATION STOCK SET & STOCK TRANSFER ====================
@app.post("/api/inventory/set-location-stock")
def set_location_stock_direct(payload: DirectLocationStockSet, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    loc = db.query(StorageLocation).filter(StorageLocation.id == payload.location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Storage location not found.")

    if payload.pack_size and payload.pack_size > 0:
        product.pack_size = payload.pack_size
    if payload.units_per_carton and payload.units_per_carton > 0:
        product.units_per_carton = payload.units_per_carton

    loc_stock = db.query(ProductLocationStock).filter(
        ProductLocationStock.product_id == product.id,
        ProductLocationStock.location_id == loc.id
    ).first()

    if not loc_stock:
        loc_stock = ProductLocationStock(
            product_id=product.id,
            location_id=loc.id,
            stock_bottles=payload.stock_bottles
        )
        db.add(loc_stock)
    else:
        loc_stock.stock_bottles = payload.stock_bottles

    db.flush()
    all_loc_stocks = db.query(ProductLocationStock).filter(ProductLocationStock.product_id == product.id).all()
    product.current_stock = sum(ls.stock_bottles for ls in all_loc_stocks)
    db.commit()

    upc = product.units_per_carton if product.units_per_carton > 0 else 12
    ctns = payload.stock_bottles // upc
    loose = payload.stock_bottles % upc
    return {
        "status": "success",
        "message": f"Updated {product.name} ({int(product.pack_size)} {product.pack_unit}) in {loc.name} to {payload.stock_bottles} Bottles ({ctns} Cartons + {loose} Bottles)."
    }


@app.post("/api/inventory/transfer")
def transfer_stock(payload: StockTransferRequest, db: Session = Depends(get_db)):
    if payload.from_location_id == payload.to_location_id:
        raise HTTPException(status_code=400, detail="Source and Destination locations must be different.")

    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    from_loc = db.query(StorageLocation).filter(StorageLocation.id == payload.from_location_id).first()
    to_loc = db.query(StorageLocation).filter(StorageLocation.id == payload.to_location_id).first()
    if not from_loc or not to_loc:
        raise HTTPException(status_code=404, detail="Location not found.")

    upc = product.units_per_carton if product.units_per_carton > 0 else 12
    base_bottles = int(round(payload.quantity * upc)) if payload.unit_type == "CARTON" else int(round(payload.quantity))

    adjust_location_stock(db, product, from_loc.id, -base_bottles)
    adjust_location_stock(db, product, to_loc.id, base_bottles)

    ref_no = f"TRF-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    db.add(StockMovement(
        product_id=product.id,
        movement_type=f"TRANSFER ({from_loc.name} -> {to_loc.name})",
        reference_number=ref_no,
        qty_in=base_bottles,
        qty_out=base_bottles,
        running_balance=product.current_stock
    ))
    db.commit()
    return {
        "status": "success",
        "reference": ref_no,
        "message": f"Transferred {base_bottles} bottles ({int(product.pack_size)} {product.pack_unit}) of {product.name} from {from_loc.name} to {to_loc.name}."
    }


# ==================== PRODUCTS & LOCATION BREAKDOWN ====================
@app.get("/api/products")
def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.id.asc()).all()
    result = []
    for p in products:
        upc = p.units_per_carton if p.units_per_carton > 0 else 12
        cartons = p.current_stock // upc
        loose_bottles = p.current_stock % upc

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
            "carton_purchase_rate": round(p.purchase_rate * upc, 2),
            "carton_sale_rate": round(p.sale_rate * upc, 2),
            "current_stock_bottles": p.current_stock,
            "cartons": cartons,
            "loose_bottles": loose_bottles,
            "current_stock_formatted": f"{cartons} Cartons + {loose_bottles} Bottles",
            "stock_valuation": round(p.current_stock * p.purchase_rate, 2),
            "reorder_level": p.reorder_level,
            "is_low_stock": p.current_stock <= p.reorder_level,
            "locations": loc_breakdown
        })
    return result


@app.post("/api/products")
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    existing = db.query(Product).filter(Product.sku == payload.sku.strip().upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"SKU {payload.sku} already exists.")

    new_prod = Product(
        sku=payload.sku.strip().upper(),
        name=payload.name.strip(),
        brand_id=payload.brand_id,
        viscosity_grade=payload.viscosity_grade,
        pack_size=payload.pack_size,
        pack_unit=payload.pack_unit,
        units_per_carton=payload.units_per_carton,
        purchase_rate=payload.purchase_rate,
        sale_rate=payload.sale_rate,
        current_stock=0,
        reorder_level=payload.reorder_level
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

    db.commit()
    db.refresh(new_prod)
    return {"status": "success", "id": new_prod.id}


@app.put("/api/products/{product_id}")
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(prod, field, value)
    db.commit()
    return {"status": "success", "id": prod.id}


# ==================== CUSTOMERS & SUPPLIERS & ACCOUNTS ====================
@app.get("/api/customers")
def list_customers(db: Session = Depends(get_db)):
    return db.query(Customer).order_by(Customer.id.asc()).all()


@app.post("/api/customers")
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    code = payload.code or f"CUS-{uuid.uuid4().hex[:4].upper()}"
    c = Customer(
        code=code,
        name=payload.name.strip(),
        contact_person=payload.contact_person,
        phone=payload.phone,
        city=(payload.city or "Local").strip(),
        address=payload.address,
        credit_limit=payload.credit_limit,
        opening_receivable=payload.current_receivable,
        current_receivable=payload.current_receivable,
        is_favorite=bool(payload.is_favorite)
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    return c


@app.get("/api/suppliers")
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).order_by(Supplier.id.asc()).all()


@app.post("/api/suppliers")
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    code = payload.code or f"SUP-{uuid.uuid4().hex[:4].upper()}"
    s = Supplier(
        code=code,
        name=payload.name.strip(),
        contact_person=payload.contact_person,
        phone=payload.phone,
        city=(payload.city or "Local").strip(),
        address=payload.address,
        opening_payable=payload.current_payable,
        current_payable=payload.current_payable,
        is_favorite=bool(payload.is_favorite)
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@app.put("/api/suppliers/{supplier_id}")
def update_supplier(supplier_id: int, payload: SupplierUpdate, db: Session = Depends(get_db)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    return s


@app.get("/api/accounts")
def list_financial_accounts(db: Session = Depends(get_db)):
    return db.query(FinancialAccount).order_by(FinancialAccount.id.asc()).all()


@app.post("/api/accounts")
def create_financial_account(payload: FinancialAccountCreate, db: Session = Depends(get_db)):
    acc = FinancialAccount(
        name=payload.name,
        type=payload.type.upper(),
        account_number=payload.account_number,
        current_balance=payload.current_balance
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@app.put("/api/accounts/{account_id}")
def update_financial_account(account_id: int, payload: FinancialAccountUpdate, db: Session = Depends(get_db)):
    acc = db.query(FinancialAccount).filter(FinancialAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    for k, v in payload.dict(exclude_unset=True).items():
        setattr(acc, k, v)
    db.commit()
    return acc


# ==================== LOCATION-AWARE PURCHASES ENGINE ====================
@app.get("/api/purchases")
def list_purchases(
    period: str = Query("all", pattern="^(daily|weekly|monthly|all)$"),
    db: Session = Depends(get_db)
):
    start_dt = get_period_start(period)
    q = db.query(Purchase).order_by(Purchase.id.desc())
    if start_dt:
        q = q.filter(Purchase.invoice_date >= start_dt)
    purchases = q.all()
    result = []
    for p in purchases:
        channel, clean_rem = extract_channel_and_remarks(p.remarks, "CASH")
        item_descriptions = []
        loc_names = []
        for i in p.items:
            p_name = i.product.name if i.product else "Unknown"
            p_size = f"{int(i.product.pack_size)}{i.product.pack_unit}" if i.product else ""
            l_name = i.location.name if i.location else "Main Warehouse"
            upc = max(1, i.units_per_carton)
            ctns = i.base_quantity // upc
            loose = i.base_quantity % upc
            item_descriptions.append(
                f"{int(i.quantity)} {i.unit_type} {p_name} ({p_size}) → {i.base_quantity} Btls [{ctns} Ctn + {loose} Btl @ {upc}/Ctn]"
            )
            if l_name not in loc_names:
                loc_names.append(l_name)

        result.append({
            "id": p.id,
            "purchase_number": p.purchase_number,
            "supplier_id": p.supplier_id,
            "supplier_name": p.supplier.name if p.supplier else "Unknown",
            "invoice_date": p.invoice_date.strftime("%Y-%m-%d %H:%M"),
            "total_amount": round(p.total_amount, 2),
            "paid_amount": round(p.paid_amount, 2),
            "payable_amount": round(p.payable_amount, 2),
            "payment_status": p.payment_status,
            "payment_method": channel,
            "remarks": clean_rem,
            "location_summary": ", ".join(loc_names) if loc_names else "Main Warehouse",
            "items_summary": ", ".join(item_descriptions)
        })
    return result


@app.post("/api/purchases")
def create_purchase(payload: PurchaseCreate, db: Session = Depends(get_db)):
    supplier = None
    if payload.supplier_name and payload.supplier_name.strip():
        clean_name = payload.supplier_name.strip()
        supplier = db.query(Supplier).filter(Supplier.name.ilike(clean_name)).first()
        if not supplier:
            supplier = Supplier(
                code=f"SUP-{uuid.uuid4().hex[:4].upper()}",
                name=clean_name,
                city=(payload.supplier_city or "Local").strip(),
                opening_payable=0.0,
                current_payable=0.0,
                is_favorite=bool(payload.mark_favorite)
            )
            db.add(supplier)
            db.flush()
    elif payload.supplier_id:
        supplier = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()

    if not supplier:
        raise HTTPException(status_code=400, detail="Please enter a Supplier name or select from Favorites.")

    if payload.mark_favorite:
        supplier.is_favorite = True

    total_amount = 0.0
    purchase_items = []
    stock_updates = []

    for item in payload.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product ID {item.product_id} not found")

        loc = db.query(StorageLocation).filter(StorageLocation.id == item.location_id).first()
        if not loc:
            loc = db.query(StorageLocation).first()

        if item.pack_size and item.pack_size > 0:
            product.pack_size = item.pack_size
        if item.units_per_carton and item.units_per_carton > 0:
            product.units_per_carton = item.units_per_carton

        upc = product.units_per_carton if product.units_per_carton > 0 else 12
        base_qty = int(round(item.quantity * upc)) if item.unit_type == "CARTON" else int(round(item.quantity))
        line_total = round(item.quantity * item.unit_rate, 2)
        total_amount = round(total_amount + line_total, 2)

        per_bottle_buy = (item.unit_rate / upc) if item.unit_type == "CARTON" else item.unit_rate
        product.purchase_rate = round(per_bottle_buy, 2)
        if item.new_sale_rate_per_bottle and item.new_sale_rate_per_bottle > 0:
            product.sale_rate = round(item.new_sale_rate_per_bottle, 2)

        purchase_items.append(PurchaseItem(
            product_id=product.id,
            location_id=loc.id if loc else None,
            unit_type=item.unit_type,
            quantity=item.quantity,
            units_per_carton=upc,
            base_quantity=base_qty,
            unit_rate=item.unit_rate,
            line_total=line_total
        ))
        stock_updates.append((product, loc.id if loc else 1, base_qty))

    paid_amt = round(payload.paid_amount, 2)
    payable = round(max(0.0, total_amount - paid_amt), 2)
    payment_status = "PAID" if payable <= 0 else ("PARTIAL" if paid_amt > 0 else "UNPAID")
    pur_no = f"PUR-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    stored_remarks = f"{payload.payment_method.upper()}|{payload.remarks or ''}"

    new_purchase = Purchase(
        purchase_number=pur_no,
        supplier_id=supplier.id,
        total_amount=total_amount,
        paid_amount=paid_amt,
        payable_amount=payable,
        payment_status=payment_status,
        remarks=stored_remarks,
        items=purchase_items
    )
    db.add(new_purchase)

    for prod, loc_id, base_qty in stock_updates:
        adjust_location_stock(db, prod, loc_id, base_qty)
        db.add(StockMovement(
            product_id=prod.id,
            movement_type="PURCHASE",
            reference_number=pur_no,
            qty_in=base_qty,
            running_balance=prod.current_stock
        ))

    supplier.current_payable = round(supplier.current_payable + payable, 2)

    if paid_amt > 0:
        acc = db.query(FinancialAccount).filter(FinancialAccount.type == payload.payment_method.upper()).first()
        if not acc:
            acc = db.query(FinancialAccount).first()
        if acc:
            acc.current_balance = round(acc.current_balance - paid_amt, 2)

    db.commit()
    db.refresh(new_purchase)
    return {"status": "success", "purchase_number": pur_no, "total": total_amount, "payable": payable}


@app.post("/api/purchases/{purchase_id}/payment")
def record_purchase_partial_payment(purchase_id: int, payload: PartialPaymentRequest, db: Session = Depends(get_db)):
    pur = db.query(Purchase).filter(Purchase.id == purchase_id).first()
    if not pur:
        raise HTTPException(status_code=404, detail="Purchase bill not found")
    if pur.payable_amount <= 0:
        raise HTTPException(status_code=400, detail="This purchase bill is already settled.")
    if payload.amount > pur.payable_amount:
        raise HTTPException(status_code=400, detail=f"Amount exceeds remaining payable of PKR {pur.payable_amount}")

    amt = round(payload.amount, 2)
    pur.paid_amount = round(pur.paid_amount + amt, 2)
    pur.payable_amount = round(max(0.0, pur.total_amount - pur.paid_amount), 2)
    pur.payment_status = "PAID" if pur.payable_amount <= 0 else "PARTIAL"

    _, prev_remarks = extract_channel_and_remarks(pur.remarks, "CASH")
    note = f"[Inst: -PKR {int(amt)} via {payload.payment_method}]"
    pur.remarks = f"{payload.payment_method.upper()}|{prev_remarks} {note}".strip()

    if pur.supplier:
        pur.supplier.current_payable = round(max(0.0, pur.supplier.current_payable - amt), 2)

    acc = db.query(FinancialAccount).filter(FinancialAccount.type == payload.payment_method.upper()).first()
    if acc:
        acc.current_balance = round(acc.current_balance - amt, 2)

    db.commit()
    return {"status": "success", "purchase_number": pur.purchase_number}


# ==================== LOCATION-AWARE SALES ENGINE ====================
@app.get("/api/sales")
def list_sales(
    period: str = Query("all", pattern="^(daily|weekly|monthly|all)$"),
    db: Session = Depends(get_db)
):
    start_dt = get_period_start(period)
    q = db.query(Sale).order_by(Sale.id.desc())
    if start_dt:
        q = q.filter(Sale.invoice_date >= start_dt)
    sales = q.all()
    result = []
    for s in sales:
        channel, clean_rem = extract_channel_and_remarks(s.remarks, "CASH")
        item_descriptions = []
        loc_names = []
        for i in s.items:
            p_name = i.product.name if i.product else "Unknown"
            p_size = f"{int(i.product.pack_size)}{i.product.pack_unit}" if i.product else ""
            l_name = i.location.name if i.location else "Shop Display"
            upc = max(1, i.units_per_carton)
            ctns = i.base_quantity // upc
            loose = i.base_quantity % upc
            item_descriptions.append(
                f"{int(i.quantity)} {i.unit_type} {p_name} ({p_size}) → {i.base_quantity} Btls [{ctns} Ctn + {loose} Btl @ {upc}/Ctn]"
            )
            if l_name not in loc_names:
                loc_names.append(l_name)

        result.append({
            "id": s.id,
            "invoice_number": s.invoice_number,
            "customer_id": s.customer_id,
            "customer_name": s.customer.name if s.customer else "Unknown",
            "invoice_date": s.invoice_date.strftime("%Y-%m-%d %H:%M"),
            "total_amount": round(s.total_amount, 2),
            "received_amount": round(s.received_amount, 2),
            "receivable_amount": round(s.receivable_amount, 2),
            "payment_status": s.payment_status,
            "payment_method": channel,
            "remarks": clean_rem,
            "location_summary": ", ".join(loc_names) if loc_names else "Shop Display",
            "items_summary": ", ".join(item_descriptions)
        })
    return result


@app.post("/api/sales")
def create_sale(payload: SaleCreate, db: Session = Depends(get_db)):
    customer = None
    if payload.customer_name and payload.customer_name.strip():
        clean_name = payload.customer_name.strip()
        customer = db.query(Customer).filter(Customer.name.ilike(clean_name)).first()
        if not customer:
            customer = Customer(
                code=f"CUS-{uuid.uuid4().hex[:4].upper()}",
                name=clean_name,
                city=(payload.customer_city or "Local").strip(),
                credit_limit=50000.0,
                opening_receivable=0.0,
                current_receivable=0.0,
                is_favorite=bool(payload.mark_favorite)
            )
            db.add(customer)
            db.flush()
    elif payload.customer_id:
        customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()

    if not customer:
        raise HTTPException(status_code=400, detail="Please enter a Customer / Dealership name or select from Favorites.")

    if payload.mark_favorite:
        customer.is_favorite = True

    total_amount = 0.0
    sale_items = []
    stock_deductions = []

    for item in payload.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product ID {item.product_id} not found")

        loc = db.query(StorageLocation).filter(StorageLocation.id == item.location_id).first()
        if not loc:
            loc = db.query(StorageLocation).first()

        if item.pack_size and item.pack_size > 0:
            product.pack_size = item.pack_size
        if item.units_per_carton and item.units_per_carton > 0:
            product.units_per_carton = item.units_per_carton

        upc = product.units_per_carton if product.units_per_carton > 0 else 12
        base_qty = int(round(item.quantity * upc)) if item.unit_type == "CARTON" else int(round(item.quantity))

        per_bottle_sale = (item.unit_rate / upc) if item.unit_type == "CARTON" else item.unit_rate
        product.sale_rate = round(per_bottle_sale, 2)

        line_total = round(item.quantity * item.unit_rate, 2)
        total_amount = round(total_amount + line_total, 2)

        sale_items.append(SaleItem(
            product_id=product.id,
            location_id=loc.id if loc else None,
            unit_type=item.unit_type,
            quantity=item.quantity,
            units_per_carton=upc,
            base_quantity=base_qty,
            unit_rate=item.unit_rate,
            line_total=line_total
        ))
        stock_deductions.append((product, loc.id if loc else 1, base_qty))

    for prod, loc_id, base_qty in stock_deductions:
        adjust_location_stock(db, prod, loc_id, -base_qty)

    rec_amt = round(payload.received_amount, 2)
    receivable = round(max(0.0, total_amount - rec_amt), 2)
    payment_status = "PAID" if receivable <= 0 else ("PARTIAL" if rec_amt > 0 else "UNPAID")
    invoice_no = f"INV-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    stored_remarks = f"{payload.payment_method.upper()}|{payload.remarks or ''}"

    new_sale = Sale(
        invoice_number=invoice_no,
        customer_id=customer.id,
        total_amount=total_amount,
        received_amount=rec_amt,
        receivable_amount=receivable,
        payment_status=payment_status,
        remarks=stored_remarks,
        items=sale_items
    )
    db.add(new_sale)

    for prod, _, base_qty in stock_deductions:
        db.add(StockMovement(
            product_id=prod.id,
            movement_type="SALE",
            reference_number=invoice_no,
            qty_out=base_qty,
            running_balance=prod.current_stock
        ))

    customer.current_receivable = round(customer.current_receivable + receivable, 2)

    if rec_amt > 0:
        acc = db.query(FinancialAccount).filter(FinancialAccount.type == payload.payment_method.upper()).first()
        if not acc:
            acc = db.query(FinancialAccount).first()
        if acc:
            acc.current_balance = round(acc.current_balance + rec_amt, 2)

    db.commit()
    db.refresh(new_sale)
    return {"status": "success", "invoice_number": invoice_no, "total": total_amount, "receivable": receivable}


@app.post("/api/sales/{sale_id}/payment")
def record_sale_partial_payment(sale_id: int, payload: PartialPaymentRequest, db: Session = Depends(get_db)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale invoice not found")
    if sale.receivable_amount <= 0:
        raise HTTPException(status_code=400, detail="This sale invoice is already settled.")
    if payload.amount > sale.receivable_amount:
        raise HTTPException(status_code=400, detail=f"Amount exceeds remaining balance of PKR {sale.receivable_amount}")

    amt = round(payload.amount, 2)
    sale.received_amount = round(sale.received_amount + amt, 2)
    sale.receivable_amount = round(max(0.0, sale.total_amount - sale.received_amount), 2)
    sale.payment_status = "PAID" if sale.receivable_amount <= 0 else "PARTIAL"

    _, prev_remarks = extract_channel_and_remarks(sale.remarks, "CASH")
    note = f"[Inst: +PKR {int(amt)} via {payload.payment_method}]"
    sale.remarks = f"{payload.payment_method.upper()}|{prev_remarks} {note}".strip()

    if sale.customer:
        sale.customer.current_receivable = round(max(0.0, sale.customer.current_receivable - amt), 2)

    acc = db.query(FinancialAccount).filter(FinancialAccount.type == payload.payment_method.upper()).first()
    if acc:
        acc.current_balance = round(acc.current_balance + amt, 2)

    db.commit()
    return {"status": "success", "invoice_number": sale.invoice_number}


# ==================== EXPENSES & ACCOUNTS HISTORY ====================
@app.get("/api/expenses")
def list_expenses(
    period: str = Query("all", pattern="^(daily|weekly|monthly|all)$"),
    db: Session = Depends(get_db)
):
    start_dt = get_period_start(period)
    q = db.query(Expense).order_by(Expense.id.desc())
    if start_dt:
        q = q.filter(Expense.expense_date >= start_dt)
    return q.all()


@app.post("/api/expenses")
def create_expense(payload: ExpenseCreate, db: Session = Depends(get_db)):
    exp_no = f"EXP-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    amt = round(payload.amount, 2)
    new_expense = Expense(
        expense_number=exp_no,
        category=payload.category,
        description=payload.description,
        payment_method=payload.payment_method,
        amount=amt,
        paid_to=payload.paid_to,
        reference=payload.reference
    )
    db.add(new_expense)

    account = db.query(FinancialAccount).filter(FinancialAccount.type == payload.payment_method).first()
    if account:
        account.current_balance = round(account.current_balance - amt, 2)

    db.commit()
    return {"status": "success", "expense_number": exp_no, "amount": amt}


@app.get("/api/accounts/history")
def get_accounts_history(
    period: str = Query("monthly", pattern="^(daily|weekly|monthly|all)$"),
    channel: str = Query("ALL"),
    db: Session = Depends(get_db)
):
    start_dt = get_period_start(period)
    ledger = []

    for s in db.query(Sale).all():
        if start_dt and s.invoice_date < start_dt:
            continue
        pay_channel, clean_rem = extract_channel_and_remarks(s.remarks, "CASH")
        if channel != "ALL" and pay_channel != channel:
            continue
        ledger.append({
            "id": f"SALE-{s.id}",
            "entity_type": "SALE",
            "entity_id": s.id,
            "date": s.invoice_date.strftime("%Y-%m-%d %H:%M"),
            "timestamp": s.invoice_date.isoformat(),
            "type": "SALE INFLOW",
            "reference": s.invoice_number,
            "party": s.customer.name if s.customer else "Customer",
            "channel": pay_channel,
            "description": clean_rem or f"Sale Invoice ({s.payment_status})",
            "total_bill": round(s.total_amount, 2),
            "cash_in": round(s.received_amount, 2),
            "cash_out": 0.0
        })

    for p in db.query(Purchase).all():
        if start_dt and p.invoice_date < start_dt:
            continue
        pay_channel, clean_rem = extract_channel_and_remarks(p.remarks, "CASH")
        if channel != "ALL" and pay_channel != channel:
            continue
        ledger.append({
            "id": f"PUR-{p.id}",
            "entity_type": "PURCHASE",
            "entity_id": p.id,
            "date": p.invoice_date.strftime("%Y-%m-%d %H:%M"),
            "timestamp": p.invoice_date.isoformat(),
            "type": "PURCHASE OUTFLOW",
            "reference": p.purchase_number,
            "party": p.supplier.name if p.supplier else "Supplier",
            "channel": pay_channel,
            "description": clean_rem or f"Stock Purchase ({p.payment_status})",
            "total_bill": round(p.total_amount, 2),
            "cash_in": 0.0,
            "cash_out": round(p.paid_amount, 2)
        })

    for e in db.query(Expense).all():
        if start_dt and e.expense_date < start_dt:
            continue
        if channel != "ALL" and e.payment_method != channel:
            continue
        ledger.append({
            "id": f"EXP-{e.id}",
            "entity_type": "EXPENSE",
            "entity_id": e.id,
            "date": e.expense_date.strftime("%Y-%m-%d %H:%M"),
            "timestamp": e.expense_date.isoformat(),
            "type": "EXPENSE OUTFLOW",
            "reference": e.expense_number,
            "party": e.paid_to or e.category,
            "channel": e.payment_method,
            "description": f"{e.category} - {e.description or ''}",
            "total_bill": round(e.amount, 2),
            "cash_in": 0.0,
            "cash_out": round(e.amount, 2)
        })

    ledger.sort(key=lambda x: x["timestamp"], reverse=True)
    return ledger


# ==================== PASSWORD-PROTECTED REVERSE & RECYCLE BIN (100% SQLITE FK-SAFE) ====================
@app.post("/api/security/reverse/{entity_type}/{entity_id}")
def reverse_and_move_to_trash(
    entity_type: str,
    entity_id: int,
    payload: PasswordVerifyRequest,
    db: Session = Depends(get_db)
):
    verify_admin_password(payload.admin_password)
    etype = entity_type.upper()
    default_loc = db.query(StorageLocation).first()
    default_loc_id = default_loc.id if default_loc else 1

    try:
        # Temporarily disable SQLite FK enforcement during atomic cascade cleanup
        db.execute(text("PRAGMA foreign_keys=OFF"))

        if etype == "SALE":
            sale = db.query(Sale).filter(Sale.id == entity_id).first()
            if not sale:
                raise HTTPException(status_code=404, detail="Sale invoice not found")

            channel, _ = extract_channel_and_remarks(sale.remarks, "CASH")
            items_data = []
            for item in sale.items:
                items_data.append({
                    "product_id": item.product_id,
                    "location_id": item.location_id or default_loc_id,
                    "unit_type": item.unit_type,
                    "quantity": item.quantity,
                    "units_per_carton": item.units_per_carton,
                    "base_quantity": item.base_quantity,
                    "unit_rate": item.unit_rate,
                    "line_total": item.line_total
                })
                if item.product:
                    adjust_location_stock(db, item.product, item.location_id or default_loc_id, item.base_quantity)

            if sale.customer:
                sale.customer.current_receivable = round(max(0.0, sale.customer.current_receivable - sale.receivable_amount), 2)

            if sale.received_amount > 0:
                acc = db.query(FinancialAccount).filter(FinancialAccount.type == channel).first()
                if acc:
                    acc.current_balance = round(acc.current_balance - sale.received_amount, 2)

            snapshot = {
                "invoice_number": sale.invoice_number,
                "customer_id": sale.customer_id,
                "total_amount": sale.total_amount,
                "received_amount": sale.received_amount,
                "receivable_amount": sale.receivable_amount,
                "payment_status": sale.payment_status,
                "remarks": sale.remarks,
                "items": items_data
            }

            db.add(RecycleBin(
                entity_type="SALE",
                entity_id=sale.id,
                reference_code=sale.invoice_number,
                title=f"Sale Invoice to {sale.customer.name if sale.customer else 'Customer'}",
                summary=f"Reversed Sale | Total: PKR {sale.total_amount:,.0f} | Received: PKR {sale.received_amount:,.0f}",
                amount=sale.total_amount,
                payload_json=json.dumps(snapshot)
            ))
            db.execute(text("DELETE FROM stock_movements WHERE reference_number = :ref"), {"ref": sale.invoice_number})
            db.execute(text("DELETE FROM sale_items WHERE sale_id = :sid"), {"sid": sale.id})
            db.execute(text("DELETE FROM sales WHERE id = :sid"), {"sid": sale.id})
            db.commit()
            return {"status": "reversed", "message": f"Sale {snapshot['invoice_number']} reversed & moved to Recycle Bin."}

        elif etype == "PURCHASE":
            pur = db.query(Purchase).filter(Purchase.id == entity_id).first()
            if not pur:
                raise HTTPException(status_code=404, detail="Purchase bill not found")

            channel, _ = extract_channel_and_remarks(pur.remarks, "CASH")
            items_data = []
            for item in pur.items:
                items_data.append({
                    "product_id": item.product_id,
                    "location_id": item.location_id or default_loc_id,
                    "unit_type": item.unit_type,
                    "quantity": item.quantity,
                    "units_per_carton": item.units_per_carton,
                    "base_quantity": item.base_quantity,
                    "unit_rate": item.unit_rate,
                    "line_total": item.line_total
                })
                if item.product:
                    loc_id = item.location_id or default_loc_id
                    loc_stock = db.query(ProductLocationStock).filter(
                        ProductLocationStock.product_id == item.product_id,
                        ProductLocationStock.location_id == loc_id
                    ).first()
                    if loc_stock:
                        loc_stock.stock_bottles = max(0, loc_stock.stock_bottles - item.base_quantity)
                    db.flush()
                    all_ls = db.query(ProductLocationStock).filter(ProductLocationStock.product_id == item.product_id).all()
                    item.product.current_stock = sum(x.stock_bottles for x in all_ls)

            if pur.supplier:
                pur.supplier.current_payable = round(max(0.0, pur.supplier.current_payable - pur.payable_amount), 2)

            if pur.paid_amount > 0:
                acc = db.query(FinancialAccount).filter(FinancialAccount.type == channel).first()
                if acc:
                    acc.current_balance = round(acc.current_balance + pur.paid_amount, 2)

            snapshot = {
                "purchase_number": pur.purchase_number,
                "supplier_id": pur.supplier_id,
                "total_amount": pur.total_amount,
                "paid_amount": pur.paid_amount,
                "payable_amount": pur.payable_amount,
                "payment_status": pur.payment_status,
                "remarks": pur.remarks,
                "items": items_data
            }

            db.add(RecycleBin(
                entity_type="PURCHASE",
                entity_id=pur.id,
                reference_code=pur.purchase_number,
                title=f"Purchase Bill from {pur.supplier.name if pur.supplier else 'Supplier'}",
                summary=f"Reversed Purchase | Bill: PKR {pur.total_amount:,.0f} | Paid: PKR {pur.paid_amount:,.0f}",
                amount=pur.total_amount,
                payload_json=json.dumps(snapshot)
            ))
            db.execute(text("DELETE FROM stock_movements WHERE reference_number = :ref"), {"ref": pur.purchase_number})
            db.execute(text("DELETE FROM purchase_items WHERE purchase_id = :pid"), {"pid": pur.id})
            db.execute(text("DELETE FROM purchases WHERE id = :pid"), {"pid": pur.id})
            db.commit()
            return {"status": "reversed", "message": f"Purchase {snapshot['purchase_number']} reversed & moved to Recycle Bin."}

        elif etype == "EXPENSE":
            exp = db.query(Expense).filter(Expense.id == entity_id).first()
            if not exp:
                raise HTTPException(status_code=404, detail="Expense not found")

            acc = db.query(FinancialAccount).filter(FinancialAccount.type == exp.payment_method).first()
            if acc:
                acc.current_balance = round(acc.current_balance + exp.amount, 2)

            snapshot = {
                "expense_number": exp.expense_number,
                "category": exp.category,
                "description": exp.description,
                "payment_method": exp.payment_method,
                "amount": exp.amount,
                "paid_to": exp.paid_to
            }

            db.add(RecycleBin(
                entity_type="EXPENSE",
                entity_id=exp.id,
                reference_code=exp.expense_number,
                title=f"Expense: {exp.category} ({exp.paid_to or 'General'})",
                summary=f"Reversed Expense | Refunded PKR {exp.amount:,.0f} to {exp.payment_method}",
                amount=exp.amount,
                payload_json=json.dumps(snapshot)
            ))
            db.execute(text("DELETE FROM expenses WHERE id = :eid"), {"eid": exp.id})
            db.commit()
            return {"status": "reversed", "message": f"Expense {snapshot['expense_number']} reversed & refunded."}

        elif etype == "PRODUCT":
            prod = db.query(Product).filter(Product.id == entity_id).first()
            if not prod:
                raise HTTPException(status_code=404, detail="Product not found")

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
                "current_stock": prod.current_stock,
                "reorder_level": prod.reorder_level,
                "locations": loc_list
            }

            db.add(RecycleBin(
                entity_type="PRODUCT",
                entity_id=prod.id,
                reference_code=prod.sku,
                title=f"Product: {prod.name}",
                summary=f"Stock: {prod.current_stock} Bottles ({int(prod.pack_size)} {prod.pack_unit})",
                amount=prod.current_stock * prod.purchase_rate,
                payload_json=json.dumps(snapshot)
            ))
            db.execute(text("DELETE FROM product_location_stocks WHERE product_id = :pid"), {"pid": prod.id})
            db.execute(text("DELETE FROM stock_movements WHERE product_id = :pid"), {"pid": prod.id})
            db.execute(text("DELETE FROM sale_items WHERE product_id = :pid"), {"pid": prod.id})
            db.execute(text("DELETE FROM purchase_items WHERE product_id = :pid"), {"pid": prod.id})
            db.execute(text("DELETE FROM products WHERE id = :pid"), {"pid": prod.id})
            db.commit()
            return {"status": "reversed", "message": f"Product {snapshot['name']} moved to Recycle Bin."}

        elif etype == "CUSTOMER":
            cus = db.query(Customer).filter(Customer.id == entity_id).first()
            if not cus:
                raise HTTPException(status_code=404, detail="Customer not found")

            snapshot = {
                "code": cus.code,
                "name": cus.name,
                "phone": cus.phone,
                "city": cus.city,
                "credit_limit": cus.credit_limit,
                "current_receivable": cus.current_receivable
            }
            db.add(RecycleBin(
                entity_type="CUSTOMER",
                entity_id=cus.id,
                reference_code=cus.code,
                title=f"Customer: {cus.name} ({cus.city})",
                summary=f"Phone: {cus.phone or 'N/A'} | Receivable Balance: PKR {cus.current_receivable:,.0f}",
                amount=cus.current_receivable,
                payload_json=json.dumps(snapshot)
            ))
            db.execute(text("DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE customer_id = :cid)"), {"cid": cus.id})
            db.execute(text("DELETE FROM sales WHERE customer_id = :cid"), {"cid": cus.id})
            db.execute(text("DELETE FROM customers WHERE id = :cid"), {"cid": cus.id})
            db.commit()
            return {"status": "reversed", "message": f"Customer {snapshot['name']} moved to Recycle Bin."}

        elif etype == "SUPPLIER":
            sup = db.query(Supplier).filter(Supplier.id == entity_id).first()
            if not sup:
                raise HTTPException(status_code=404, detail="Supplier not found")

            snapshot = {
                "code": sup.code,
                "name": sup.name,
                "phone": sup.phone,
                "city": sup.city,
                "current_payable": sup.current_payable
            }
            db.add(RecycleBin(
                entity_type="SUPPLIER",
                entity_id=sup.id,
                reference_code=sup.code,
                title=f"Supplier: {sup.name} ({sup.city})",
                summary=f"Phone: {sup.phone or 'N/A'} | Payable Balance: PKR {sup.current_payable:,.0f}",
                amount=sup.current_payable,
                payload_json=json.dumps(snapshot)
            ))
            db.execute(text("DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE supplier_id = :sid)"), {"sid": sup.id})
            db.execute(text("DELETE FROM purchases WHERE supplier_id = :sid"), {"sid": sup.id})
            db.execute(text("DELETE FROM suppliers WHERE id = :sid"), {"sid": sup.id})
            db.commit()
            return {"status": "reversed", "message": f"Supplier {snapshot['name']} moved to Recycle Bin."}

        elif etype == "LOCATION":
            loc = db.query(StorageLocation).filter(StorageLocation.id == entity_id).first()
            if not loc:
                raise HTTPException(status_code=404, detail="Location not found")
            total_btls = sum(ps.stock_bottles for ps in loc.product_stocks)
            if total_btls > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete '{loc.name}' while it holds {total_btls} bottles. Transfer stock first."
                )
            snapshot = {"code": loc.code, "name": loc.name, "location_type": loc.location_type, "address": loc.address}
            db.add(RecycleBin(
                entity_type="LOCATION",
                entity_id=loc.id,
                reference_code=loc.code,
                title=f"Storage Location: {loc.name}",
                summary=f"Type: {loc.location_type} | Address: {loc.address or 'N/A'}",
                amount=0.0,
                payload_json=json.dumps(snapshot)
            ))
            db.execute(text("DELETE FROM product_location_stocks WHERE location_id = :lid"), {"lid": loc.id})
            db.execute(text("DELETE FROM storage_locations WHERE id = :lid"), {"lid": loc.id})
            db.commit()
            return {"status": "reversed", "message": f"Location {snapshot['name']} moved to Recycle Bin."}

        elif etype == "ACCOUNT":
            acc = db.query(FinancialAccount).filter(FinancialAccount.id == entity_id).first()
            if not acc:
                raise HTTPException(status_code=404, detail="Financial account not found")
            snapshot = {
                "name": acc.name,
                "type": acc.type,
                "account_number": acc.account_number,
                "current_balance": acc.current_balance
            }
            db.add(RecycleBin(
                entity_type="ACCOUNT",
                entity_id=acc.id,
                reference_code=acc.type,
                title=f"Account: {acc.name}",
                summary=f"Type: {acc.type} | No: {acc.account_number or 'N/A'} | Balance: PKR {acc.current_balance:,.0f}",
                amount=acc.current_balance,
                payload_json=json.dumps(snapshot)
            ))
            db.execute(text("DELETE FROM financial_accounts WHERE id = :aid"), {"aid": acc.id})
            db.commit()
            return {"status": "reversed", "message": f"Account {snapshot['name']} moved to Recycle Bin."}

        raise HTTPException(status_code=400, detail="Unsupported entity type.")
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Reversal error: {str(e)}")
    finally:
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
            "amount": i.amount,
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
            amount=data["amount"],
            paid_to=data.get("paid_to")
        )
        db.add(exp)
        acc = db.query(FinancialAccount).filter(FinancialAccount.type == exp.payment_method).first()
        if acc:
            acc.current_balance = round(acc.current_balance - exp.amount, 2)

    elif etype == "PRODUCT":
        prod = Product(
            sku=data["sku"],
            name=data["name"],
            brand_id=data.get("brand_id", 1),
            viscosity_grade=data.get("viscosity_grade", "20W-50 4T"),
            pack_size=data.get("pack_size", 700),
            pack_unit=data.get("pack_unit", "ML"),
            units_per_carton=data.get("units_per_carton", 12),
            purchase_rate=data.get("purchase_rate", 0.0),
            sale_rate=data.get("sale_rate", 0.0),
            current_stock=0,
            reorder_level=data.get("reorder_level", 12)
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
            city=data.get("city", "Local"),
            credit_limit=data.get("credit_limit", 50000.0),
            current_receivable=data.get("current_receivable", 0.0)
        ))

    elif etype == "SUPPLIER":
        db.add(Supplier(
            code=data["code"],
            name=data["name"],
            phone=data.get("phone"),
            city=data.get("city", "Local"),
            current_payable=data.get("current_payable", 0.0)
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
            current_balance=data.get("current_balance", 0.0)
        ))

    elif etype == "SALE":
        restored_items = []
        for item in data.get("items", []):
            prod = db.query(Product).filter(Product.id == item["product_id"]).first()
            if prod:
                adjust_location_stock(db, prod, item.get("location_id", 1), -item["base_quantity"])
            restored_items.append(SaleItem(
                product_id=item["product_id"],
                location_id=item.get("location_id", 1),
                unit_type=item["unit_type"],
                quantity=item["quantity"],
                units_per_carton=item["units_per_carton"],
                base_quantity=item["base_quantity"],
                unit_rate=item["unit_rate"],
                line_total=item["line_total"]
            ))
        sale = Sale(
            invoice_number=data["invoice_number"],
            customer_id=data["customer_id"],
            total_amount=data["total_amount"],
            received_amount=data["received_amount"],
            receivable_amount=data["receivable_amount"],
            payment_status=data["payment_status"],
            remarks=data.get("remarks"),
            items=restored_items
        )
        db.add(sale)
        cus = db.query(Customer).filter(Customer.id == data["customer_id"]).first()
        if cus:
            cus.current_receivable = round(cus.current_receivable + data["receivable_amount"], 2)
        channel, _ = extract_channel_and_remarks(data.get("remarks"), "CASH")
        if data["received_amount"] > 0:
            acc = db.query(FinancialAccount).filter(FinancialAccount.type == channel).first()
            if acc:
                acc.current_balance = round(acc.current_balance + data["received_amount"], 2)

    elif etype == "PURCHASE":
        restored_items = []
        for item in data.get("items", []):
            prod = db.query(Product).filter(Product.id == item["product_id"]).first()
            if prod:
                adjust_location_stock(db, prod, item.get("location_id", 1), item["base_quantity"])
            restored_items.append(PurchaseItem(
                product_id=item["product_id"],
                location_id=item.get("location_id", 1),
                unit_type=item["unit_type"],
                quantity=item["quantity"],
                units_per_carton=item["units_per_carton"],
                base_quantity=item["base_quantity"],
                unit_rate=item["unit_rate"],
                line_total=item["line_total"]
            ))
        pur = Purchase(
            purchase_number=data["purchase_number"],
            supplier_id=data["supplier_id"],
            total_amount=data["total_amount"],
            paid_amount=data["paid_amount"],
            payable_amount=data["payable_amount"],
            payment_status=data["payment_status"],
            remarks=data.get("remarks"),
            items=restored_items
        )
        db.add(pur)
        sup = db.query(Supplier).filter(Supplier.id == data["supplier_id"]).first()
        if sup:
            sup.current_payable = round(sup.current_payable + data["payable_amount"], 2)
        channel, _ = extract_channel_and_remarks(data.get("remarks"), "CASH")
        if data["paid_amount"] > 0:
            acc = db.query(FinancialAccount).filter(FinancialAccount.type == channel).first()
            if acc:
                acc.current_balance = round(acc.current_balance - data["paid_amount"], 2)

    db.delete(trash)
    db.commit()
    return {"status": "restored", "message": f"{trash.title} restored to active system."}


@app.post("/api/recycle-bin/{trash_id}/permanent-delete")
def permanent_delete_single(trash_id: int, payload: PasswordVerifyRequest, db: Session = Depends(get_db)):
    verify_admin_password(payload.admin_password)
    trash = db.query(RecycleBin).filter(RecycleBin.id == trash_id).first()
    if not trash:
        raise HTTPException(status_code=404, detail="Record not found in Recycle Bin")
    db.delete(trash)
    db.commit()
    return {"status": "purged", "message": "Record permanently deleted from Recycle Bin."}


@app.post("/api/recycle-bin/empty")
def empty_recycle_bin(payload: PasswordVerifyRequest, db: Session = Depends(get_db)):
    verify_admin_password(payload.admin_password)
    db.query(RecycleBin).delete(synchronize_session=False)
    db.commit()
    return {"status": "emptied", "message": "Recycle Bin permanently emptied."}