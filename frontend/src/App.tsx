import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench, Package, TrendingUp, ArrowRight, RefreshCw, BarChart3,
  Truck, Lock, LogOut, Plus, Edit3, Trash2, Calendar, ShoppingCart,
  Users, FileText, Wallet, Landmark, Menu, X, CheckCircle2, Clock,
  MapPin, ArrowLeftRight, RotateCcw, AlertOctagon, ChevronLeft,
  ChevronRight, Layers, Star, Droplet
} from 'lucide-react';
import type {
  TimePeriod, EntityType, DashboardStats, StorageLocation, Product,
  Customer, Supplier, SaleRecord, PurchaseRecord, Expense,
  FinancialAccount, AccountHistoryEntry, RecycleBinItem, LocationStockItem
} from './types';

const API_BASE = import.meta.env.DEV ? "http://127.0.0.1:8000/api" : "/api";

type MainSection = 'dashboard' | 'accounts' | 'inventory' | 'directory';
type AccountsSubTab = 'sales' | 'purchases' | 'partials' | 'expenses' | 'wallets' | 'ledger';
type InventorySubTab = 'stock_breakdown' | 'products_crud' | 'locations_transfer';
type DirectorySubTab = 'parties' | 'recycle';

interface NavState {
  main: MainSection;
  accSub: AccountsSubTab;
  invSub: InventorySubTab;
  dirSub: DirectorySubTab;
}

// Ambient Viscous Golden Oil Droplets Layer
function OilDropletsBackdrop() {
  const drops = [
    { left: '6%', width: '7px', height: '12px', duration: '11s', delay: '0s' },
    { left: '19%', width: '5px', height: '9px', duration: '14s', delay: '3.5s' },
    { left: '34%', width: '8px', height: '14px', duration: '9.5s', delay: '1.8s' },
    { left: '52%', width: '6px', height: '10px', duration: '13s', delay: '5s' },
    { left: '68%', width: '9px', height: '15px', duration: '10.5s', delay: '2.2s' },
    { left: '83%', width: '6px', height: '11px', duration: '12.5s', delay: '4.1s' },
    { left: '94%', width: '7px', height: '13px', duration: '11.8s', delay: '0.9s' },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {drops.map((d, idx) => (
        <span
          key={idx}
          className="oil-droplet"
          style={{
            left: d.left,
            width: d.width,
            height: d.height,
            animationDuration: d.duration,
            animationDelay: d.delay,
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  // ==================== AUTHENTICATION STATE ====================
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('ath_admin_auth') === 'true';
  });
  const [loginUser, setLoginUser] = useState<string>('');
  const [loginPass, setLoginPass] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // ==================== NAVIGATION & BACK/FORWARD HISTORY ====================
  const [navHistory, setNavHistory] = useState<NavState[]>([
    { main: 'dashboard', accSub: 'sales', invSub: 'stock_breakdown', dirSub: 'parties' }
  ]);
  const [navIndex, setNavIndex] = useState<number>(0);
  const currentNav = navHistory[navIndex] || navHistory[0];

  const navigateTo = (partial: Partial<NavState>) => {
    const nextState: NavState = { ...currentNav, ...partial };
    if (
      nextState.main === currentNav.main &&
      nextState.accSub === currentNav.accSub &&
      nextState.invSub === currentNav.invSub &&
      nextState.dirSub === currentNav.dirSub
    ) {
      return;
    }
    const updated = navHistory.slice(0, navIndex + 1);
    updated.push(nextState);
    setNavHistory(updated);
    setNavIndex(updated.length - 1);
    setMobileMenuOpen(false);
  };

  const canGoBack = navIndex > 0;
  const canGoForward = navIndex < navHistory.length - 1;

  const handleBack = () => {
    if (canGoBack) setNavIndex(navIndex - 1);
  };

  const handleForward = () => {
    if (canGoForward) setNavIndex(navIndex + 1);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [period, setPeriod] = useState<TimePeriod>('monthly');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  // ==================== DATA STATES ====================
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [accountHistory, setAccountHistory] = useState<AccountHistoryEntry[]>([]);
  const [recycleBin, setRecycleBin] = useState<RecycleBinItem[]>([]);

  // ==================== SALE FORM STATE ====================
  const [saleCustomerId, setSaleCustomerId] = useState<number>(0);
  const [saleCustomerName, setSaleCustomerName] = useState<string>('');
  const [saleCustomerCity, setSaleCustomerCity] = useState<string>('');
  const [saleMarkFav, setSaleMarkFav] = useState<boolean>(false);
  const [saleProductId, setSaleProductId] = useState<number>(1);
  const [saleLocationId, setSaleLocationId] = useState<number>(1);
  const [saleUnitType, setSaleUnitType] = useState<'CARTON' | 'BOTTLE'>('CARTON');
  const [salePackSize, setSalePackSize] = useState<string>('700');
  const [saleCartonSize, setSaleCartonSize] = useState<string>('12');
  const [saleQuantity, setSaleQuantity] = useState<string>('');
  const [saleRate, setSaleRate] = useState<string>('');
  const [salePaymentMode, setSalePaymentMode] = useState<'UNPAID' | 'PARTIAL' | 'PAID'>('UNPAID');
  const [saleReceived, setSaleReceived] = useState<string>('');
  const [saleMethod, setSaleMethod] = useState<string>('CASH');
  const [saleRemarks, setSaleRemarks] = useState<string>('');

  // ==================== PURCHASE FORM STATE ====================
  const [purSupplierId, setPurSupplierId] = useState<number>(0);
  const [purSupplierName, setPurSupplierName] = useState<string>('');
  const [purSupplierCity, setPurSupplierCity] = useState<string>('');
  const [purMarkFav, setPurMarkFav] = useState<boolean>(false);
  const [purProductId, setPurProductId] = useState<number>(1);
  const [purLocationId, setPurLocationId] = useState<number>(2);
  const [purUnitType, setPurUnitType] = useState<'CARTON' | 'BOTTLE'>('CARTON');
  const [purPackSize, setPurPackSize] = useState<string>('700');
  const [purCartonSize, setPurCartonSize] = useState<string>('12');
  const [purQuantity, setPurQuantity] = useState<string>('');
  const [purRate, setPurRate] = useState<string>('');
  const [purNewSaleRatePerBottle, setPurNewSaleRatePerBottle] = useState<string>('');
  const [purPaymentMode, setPurPaymentMode] = useState<'UNPAID' | 'PARTIAL' | 'PAID'>('UNPAID');
  const [purPaid, setPurPaid] = useState<string>('');
  const [purMethod, setPurMethod] = useState<string>('CASH');
  const [purRemarks, setPurRemarks] = useState<string>('');

  // ==================== DIRECT STOCK SETTER & PRODUCT CRUD STATES ====================
  const [setStockProdId, setSetStockProdId] = useState<number>(1);
  const [setStockLocId, setSetStockLocId] = useState<number>(1);
  const [setStockBottles, setSetStockBottles] = useState<string>('');
  const [directPackSize, setDirectPackSize] = useState<string>('700');
  const [directCartonMax, setDirectCartonMax] = useState<string>('32');

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [prodSku, setProdSku] = useState<string>('');
  const [prodName, setProdName] = useState<string>('');
  const [prodBrandId, setProdBrandId] = useState<number>(1);
  const [prodViscosity, setProdViscosity] = useState<string>('20W-50 4T');
  const [prodPackSize, setProdPackSize] = useState<string>('700');
  const [prodUnitsPerCarton, setProdUnitsPerCarton] = useState<string>('12');
  const [prodPurchaseRate, setProdPurchaseRate] = useState<string>('');
  const [prodSaleRate, setProdSaleRate] = useState<string>('');
  const [prodInitialStock, setProdInitialStock] = useState<string>('');
  const [prodInitialLocId, setProdInitialLocId] = useState<number>(1);
  const [prodReorder, setProdReorder] = useState<string>('24');

  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [locName, setLocName] = useState<string>('');
  const [locType, setLocType] = useState<string>('WAREHOUSE');
  const [locAddress, setLocAddress] = useState<string>('');

  const [trfProductId, setTrfProductId] = useState<number>(1);
  const [trfFromLocId, setTrfFromLocId] = useState<number>(2);
  const [trfToLocId, setTrfToLocId] = useState<number>(1);
  const [trfUnitType, setTrfUnitType] = useState<'CARTON' | 'BOTTLE'>('CARTON');
  const [trfQuantity, setTrfQuantity] = useState<string>('');
  const [trfRemarks, setTrfRemarks] = useState<string>('');

  // ==================== EXPENSE, PARTY & ACCOUNT STATES ====================
  const [expCategory, setExpCategory] = useState<string>('Fuel');
  const [expDesc, setExpDesc] = useState<string>('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expMethod, setExpMethod] = useState<string>('CASH');
  const [expPaidTo, setExpPaidTo] = useState<string>('');

  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [cusName, setCusName] = useState<string>('');
  const [cusPhone, setCusPhone] = useState<string>('');
  const [cusCity, setCusCity] = useState<string>('');
  const [cusCreditLimit, setCusCreditLimit] = useState<string>('50000');
  const [cusReceivable, setCusReceivable] = useState<string>('');

  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [supName, setSupName] = useState<string>('');
  const [supPhone, setSupPhone] = useState<string>('');
  const [supCity, setSupCity] = useState<string>('');
  const [supPayable, setSupPayable] = useState<string>('');

  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [accName, setAccName] = useState<string>('');
  const [accType, setAccType] = useState<string>('CASH');
  const [accNumber, setAccNumber] = useState<string>('');
  const [accBalance, setAccBalance] = useState<string>('');

  // ==================== MODALS ====================
  const [partialModal, setPartialModal] = useState<{
    kind: 'SALE' | 'PURCHASE';
    id: number;
    refNumber: string;
    partyName: string;
    totalAmount: number;
    alreadyPaid: number;
    remainingBalance: number;
  } | null>(null);
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [partialMethod, setPartialMethod] = useState<string>('CASH');
  const [partialRemarks, setPartialRemarks] = useState<string>('');

  const [securityModal, setSecurityModal] = useState<{
    mode: 'REVERSE' | 'PERMANENT_DELETE' | 'EMPTY_BIN';
    entityType?: EntityType;
    entityId?: number;
    trashId?: number;
    title: string;
    description: string;
  } | null>(null);
  const [securityPassword, setSecurityPassword] = useState<string>('');
  const [securityError, setSecurityError] = useState<string>('');
  const [securityBusy, setSecurityBusy] = useState<boolean>(false);

  const notify = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 5000);
  };

  // ==================== CRASH-PROOF LOCATION INVENTORY MAP ====================
  const enrichedLocations = useMemo(() => {
    return (locations || []).map(loc => {
      if (Array.isArray(loc.items) && loc.items.length > 0) {
        return { ...loc, safeItems: loc.items };
      }
      const derived: LocationStockItem[] = [];
      for (const p of products || []) {
        const match = (p.locations || []).find(l => l.location_id === loc.id);
        if (match && match.stock_bottles > 0) {
          const upc = Math.max(1, p.units_per_carton || 12);
          const ctns = Math.floor(match.stock_bottles / upc);
          const loose = match.stock_bottles % upc;
          derived.push({
            product_id: p.id,
            product_name: p.name,
            sku: p.sku,
            pack_size: p.pack_size || `${p.pack_size_num || 700} ML`,
            units_per_carton: upc,
            stock_bottles: match.stock_bottles,
            cartons: ctns,
            loose_bottles: loose,
            formatted: `${ctns} Cartons & ${loose} Loose Bottles (Max ${upc} Btls/Carton)`
          });
        }
      }
      return { ...loc, safeItems: derived };
    });
  }, [locations, products]);

  // ==================== LOGIN HANDLER ====================
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser.trim(), password: loginPass })
      });
      if (!res.ok) {
        throw new Error('Invalid administrator username or password.');
      }
      localStorage.setItem('ath_admin_auth', 'true');
      setIsAuthenticated(true);
    } catch (err: any) {
      if (loginUser.trim() === 'Admin' && loginPass === 'Admin@786') {
        localStorage.setItem('ath_admin_auth', 'true');
        setIsAuthenticated(true);
      } else {
        setLoginError(err.message || 'Authentication failed.');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ath_admin_auth');
    setIsAuthenticated(false);
    setLoginUser('');
    setLoginPass('');
  };

  // ==================== FETCH ALL DATA ====================
  const fetchData = async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const [
        sRes, locRes, pRes, cRes, supRes,
        salesRes, purRes, eRes, aRes, hRes, binRes
      ] = await Promise.all([
        fetch(`${API_BASE}/dashboard/stats?period=${period}`),
        fetch(`${API_BASE}/locations`),
        fetch(`${API_BASE}/products`),
        fetch(`${API_BASE}/customers`),
        fetch(`${API_BASE}/suppliers`),
        fetch(`${API_BASE}/sales?period=${period}`),
        fetch(`${API_BASE}/purchases?period=${period}`),
        fetch(`${API_BASE}/expenses?period=${period}`),
        fetch(`${API_BASE}/accounts`),
        fetch(`${API_BASE}/accounts/history?period=${period}&channel=${channelFilter}`),
        fetch(`${API_BASE}/recycle-bin`)
      ]);

      if (sRes.ok) setStats(await sRes.json());
      if (locRes.ok) {
        const locData: StorageLocation[] = await locRes.json();
        setLocations(Array.isArray(locData) ? locData : []);
        if (Array.isArray(locData) && locData.length > 0) {
          const disp = locData.find(l => l.location_type === 'DISPLAY') || locData[0];
          const wh = locData.find(l => l.location_type === 'WAREHOUSE') || locData[0];
          setSaleLocationId(prev => (locData.some(l => l.id === prev) ? prev : disp.id));
          setPurLocationId(prev => (locData.some(l => l.id === prev) ? prev : wh.id));
          setProdInitialLocId(prev => (locData.some(l => l.id === prev) ? prev : wh.id));
          setSetStockLocId(prev => (locData.some(l => l.id === prev) ? prev : disp.id));
        }
      }
      if (pRes.ok) {
        const prodData: Product[] = await pRes.json();
        const safeProds = Array.isArray(prodData) ? prodData : [];
        setProducts(safeProds);
        if (safeProds.length > 0) {
          const sp = safeProds.find(p => p.id === saleProductId) || safeProds[0];
          setSalePackSize(String(sp.pack_size_num || 700));
          setSaleCartonSize(String(sp.units_per_carton || 12));

          const pp = safeProds.find(p => p.id === purProductId) || safeProds[0];
          setPurPackSize(String(pp.pack_size_num || 700));
          setPurCartonSize(String(pp.units_per_carton || 12));
        }
      }
      if (cRes.ok) setCustomers(await cRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      if (salesRes.ok) setSales(await salesRes.json());
      if (purRes.ok) setPurchases(await purRes.json());
      if (eRes.ok) setExpenses(await eRes.json());
      if (aRes.ok) setAccounts(await aRes.json());
      if (hRes.ok) setAccountHistory(await hRes.json());
      if (binRes.ok) setRecycleBin(await binRes.json());
    } catch (err) {
      console.error('Error syncing with backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated, period, channelFilter]);

  const handleSelectSaleProduct = (id: number) => {
    setSaleProductId(id);
    const p = products.find(x => x.id === id);
    if (p) {
      setSalePackSize(String(p.pack_size_num || 700));
      setSaleCartonSize(String(p.units_per_carton || 12));
    }
  };

  const handleSelectPurProduct = (id: number) => {
    setPurProductId(id);
    const p = products.find(x => x.id === id);
    if (p) {
      setPurPackSize(String(p.pack_size_num || 700));
      setPurCartonSize(String(p.units_per_carton || 12));
    }
  };

  // ==================== EXACT MATHEMATICAL FORMULAS ====================
  const saleUpc = Math.max(1, Math.round(Number(saleCartonSize) || 12));
  const saleQtyNum = Number(saleQuantity) || 0;
  const saleTotalBottles = saleUnitType === 'CARTON' ? Math.round(saleQtyNum * saleUpc) : Math.round(saleQtyNum);
  const saleCalcCartons = Math.floor(saleTotalBottles / saleUpc);
  const saleCalcLoose = saleTotalBottles % saleUpc;

  const computedSaleTotal = Math.round(saleQtyNum * (Number(saleRate) || 0) * 100) / 100;
  const computedSaleReceived =
    salePaymentMode === 'UNPAID'
      ? 0
      : salePaymentMode === 'PAID'
      ? computedSaleTotal
      : Math.round((Number(saleReceived) || 0) * 100) / 100;

  const purUpc = Math.max(1, Math.round(Number(purCartonSize) || 12));
  const purQtyNum = Number(purQuantity) || 0;
  const purTotalBottles = purUnitType === 'CARTON' ? Math.round(purQtyNum * purUpc) : Math.round(purQtyNum);
  const purCalcCartons = Math.floor(purTotalBottles / purUpc);
  const purCalcLoose = purTotalBottles % purUpc;

  const computedPurTotal = Math.round(purQtyNum * (Number(purRate) || 0) * 100) / 100;
  const computedPurPaid =
    purPaymentMode === 'UNPAID'
      ? 0
      : purPaymentMode === 'PAID'
      ? computedPurTotal
      : Math.round((Number(purPaid) || 0) * 100) / 100;

  const directStockNum = Math.max(0, Math.round(Number(setStockBottles) || 0));
  const directCartonMaxNum = Math.max(1, Math.round(Number(directCartonMax) || 12));
  const directPreviewCartons = Math.floor(directStockNum / directCartonMaxNum);
  const directPreviewLoose = directStockNum % directCartonMaxNum;

  // ==================== FAVORITES & STOCK INTELLIGENCE ====================
  const favoriteCustomers = useMemo(() => customers.filter(c => c.is_favorite), [customers]);
  const favoriteSuppliers = useMemo(() => suppliers.filter(s => s.is_favorite), [suppliers]);

  const selectedSaleProduct = useMemo(
    () => products.find(p => p.id === Number(saleProductId)) || null,
    [products, saleProductId]
  );
  const selectedSaleLocName = useMemo(
    () => locations.find(l => l.id === Number(saleLocationId))?.name || 'Selected Location',
    [locations, saleLocationId]
  );
  const saleLocAvailableBottles = useMemo(() => {
    if (!selectedSaleProduct) return 0;
    const match = (selectedSaleProduct.locations || []).find(l => l.location_id === Number(saleLocationId));
    return match ? match.stock_bottles : 0;
  }, [selectedSaleProduct, saleLocationId]);

  const saleAlternativeLocations = useMemo(() => {
    if (!selectedSaleProduct) return [];
    return (selectedSaleProduct.locations || []).filter(
      l => l.location_id !== Number(saleLocationId) && l.stock_bottles > 0
    );
  }, [selectedSaleProduct, saleLocationId]);

  const isSaleStockInsufficient =
    saleLocAvailableBottles <= 0 || (saleTotalBottles > 0 && saleTotalBottles > saleLocAvailableBottles);

  const selectedPurchaseProduct = useMemo(
    () => products.find(p => p.id === Number(purProductId)) || null,
    [products, purProductId]
  );

  const toggleCustomerFavorite = async (c: Customer) => {
    await fetch(`${API_BASE}/customers/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: !c.is_favorite })
    });
    notify(`${c.name} ${!c.is_favorite ? 'added to' : 'removed from'} Favorites!`);
    fetchData();
  };

  const toggleSupplierFavorite = async (s: Supplier) => {
    await fetch(`${API_BASE}/suppliers/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: !s.is_favorite })
    });
    notify(`${s.name} ${!s.is_favorite ? 'added to' : 'removed from'} Favorites!`);
    fetchData();
  };

  const handleInstantSaleFavorite = async () => {
    const cleanName = saleCustomerName.trim();
    if (!cleanName) {
      notify('Please type a Customer / Dealership name first to mark as Favorite.', true);
      return;
    }
    const nextFav = !saleMarkFav;
    setSaleMarkFav(nextFav);
    try {
      const existing = customers.find(
        c => c.id === saleCustomerId || c.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (existing) {
        await fetch(`${API_BASE}/customers/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_favorite: nextFav })
        });
        setSaleCustomerId(existing.id);
        notify(`${existing.name} ${nextFav ? 'saved to Favorites ★' : 'removed from Favorites'}`);
      } else if (nextFav) {
        const res = await fetch(`${API_BASE}/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            city: saleCustomerCity.trim() || 'Local',
            credit_limit: 50000,
            current_receivable: 0,
            is_favorite: true
          })
        });
        if (res.ok) {
          const created = await res.json();
          setSaleCustomerId(created.id);
          notify(`New Customer '${cleanName}' created & added to Favorites ★`);
        }
      }
      fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleInstantPurFavorite = async () => {
    const cleanName = purSupplierName.trim();
    if (!cleanName) {
      notify('Please type a Supplier / Dealership name first to mark as Favorite.', true);
      return;
    }
    const nextFav = !purMarkFav;
    setPurMarkFav(nextFav);
    try {
      const existing = suppliers.find(
        s => s.id === purSupplierId || s.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (existing) {
        await fetch(`${API_BASE}/suppliers/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_favorite: nextFav })
        });
        setPurSupplierId(existing.id);
        notify(`${existing.name} ${nextFav ? 'saved to Favorites ★' : 'removed from Favorites'}`);
      } else if (nextFav) {
        const res = await fetch(`${API_BASE}/suppliers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            city: purSupplierCity.trim() || 'Local',
            current_payable: 0,
            is_favorite: true
          })
        });
        if (res.ok) {
          const created = await res.json();
          setPurSupplierId(created.id);
          notify(`New Supplier '${cleanName}' created & added to Favorites ★`);
        }
      }
      fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // ==================== SALE & PURCHASE HANDLERS ====================
  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleCustomerName.trim() && !saleCustomerId) {
      notify('Please type a Customer / Dealership name or pick from Favorites.', true);
      return;
    }
    if (!saleQuantity || !saleRate || Number(saleQuantity) <= 0) {
      notify('Please enter valid Sale Quantity and Rate.', true);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: saleCustomerId || null,
          customer_name: saleCustomerName.trim(),
          customer_city: saleCustomerCity.trim() || 'Local',
          mark_favorite: saleMarkFav,
          items: [
            {
              product_id: Number(saleProductId),
              location_id: Number(saleLocationId),
              unit_type: saleUnitType,
              quantity: Number(saleQuantity),
              unit_rate: Number(saleRate),
              units_per_carton: saleUpc,
              pack_size: Number(salePackSize) || 700
            }
          ],
          received_amount: computedSaleReceived,
          payment_method: saleMethod,
          remarks: saleRemarks
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Sale failed');
      notify(`Invoice ${data.invoice_number} posted (${saleTotalBottles} Bottles = ${saleCalcCartons} Cartons & ${saleCalcLoose} Bottles).`);
      setSaleCustomerId(0);
      setSaleCustomerName('');
      setSaleCustomerCity('');
      setSaleMarkFav(false);
      setSaleQuantity('');
      setSaleRate('');
      setSaleReceived('');
      setSalePaymentMode('UNPAID');
      setSaleRemarks('');
      fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purSupplierName.trim() && !purSupplierId) {
      notify('Please type a Supplier / Dealership name or pick from Favorites.', true);
      return;
    }
    if (!purQuantity || !purRate || Number(purQuantity) <= 0) {
      notify('Please enter valid Purchase Quantity and Rate.', true);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: purSupplierId || null,
          supplier_name: purSupplierName.trim(),
          supplier_city: purSupplierCity.trim() || 'Local',
          mark_favorite: purMarkFav,
          items: [
            {
              product_id: Number(purProductId),
              location_id: Number(purLocationId),
              unit_type: purUnitType,
              quantity: Number(purQuantity),
              unit_rate: Number(purRate),
              units_per_carton: purUpc,
              pack_size: Number(purPackSize) || 700,
              new_sale_rate_per_bottle: purNewSaleRatePerBottle ? Number(purNewSaleRatePerBottle) : null
            }
          ],
          paid_amount: computedPurPaid,
          payment_method: purMethod,
          remarks: purRemarks
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Purchase failed');
      notify(`Purchase Bill ${data.purchase_number} recorded (${purTotalBottles} Bottles = ${purCalcCartons} Cartons & ${purCalcLoose} Bottles).`);
      setPurSupplierId(0);
      setPurSupplierName('');
      setPurSupplierCity('');
      setPurMarkFav(false);
      setPurQuantity('');
      setPurRate('');
      setPurNewSaleRatePerBottle('');
      setPurPaid('');
      setPurPaymentMode('UNPAID');
      setPurRemarks('');
      fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // ==================== DIRECT LOCATION STOCK SETTER HANDLER ====================
  const handleSetLocationStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setStockBottles === '') return;
    try {
      const res = await fetch(`${API_BASE}/inventory/set-location-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: Number(setStockProdId),
          location_id: Number(setStockLocId),
          stock_bottles: directStockNum,
          pack_size: Number(directPackSize) || 700,
          units_per_carton: directCartonMaxNum
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update location stock');
      notify(data.message);
      setSetStockBottles('');
      fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // ==================== PARTIAL PAYMENT INSTALLMENT HANDLER ====================
  const handleRecordPartialPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialModal || !partialAmount || Number(partialAmount) <= 0) return;
    const url =
      partialModal.kind === 'SALE'
        ? `${API_BASE}/sales/${partialModal.id}/payment`
        : `${API_BASE}/purchases/${partialModal.id}/payment`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(partialAmount),
          payment_method: partialMethod,
          remarks: partialRemarks
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Installment failed');
      notify(`Installment of PKR ${Number(partialAmount).toLocaleString()} settled against ${partialModal.refNumber}!`);
      setPartialModal(null);
      setPartialAmount('');
      setPartialRemarks('');
      fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // ==================== LOCATION & STOCK TRANSFER HANDLERS ====================
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingLocationId ? `${API_BASE}/locations/${editingLocationId}` : `${API_BASE}/locations`;
    const method = editingLocationId ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: locName,
          location_type: locType,
          address: locAddress
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Location save failed');
      notify(editingLocationId ? 'Storage Location updated!' : 'New Storage Location created!');
      setEditingLocationId(null);
      setLocName('');
      setLocAddress('');
      fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleStockTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trfQuantity || Number(trfQuantity) <= 0) return;
    try {
      const res = await fetch(`${API_BASE}/inventory/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: Number(trfProductId),
          from_location_id: Number(trfFromLocId),
          to_location_id: Number(trfToLocId),
          unit_type: trfUnitType,
          quantity: Number(trfQuantity),
          remarks: trfRemarks
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Stock transfer failed');
      notify(data.message);
      setTrfQuantity('');
      setTrfRemarks('');
      fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // ==================== PRODUCT CRUD HANDLER ====================
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingProductId ? `${API_BASE}/products/${editingProductId}` : `${API_BASE}/products`;
    const method = editingProductId ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: prodSku,
          name: prodName,
          brand_id: Number(prodBrandId),
          viscosity_grade: prodViscosity,
          pack_size: Number(prodPackSize) || 700,
          pack_unit: 'ML',
          units_per_carton: Number(prodUnitsPerCarton) || 12,
          purchase_rate: Number(prodPurchaseRate) || 0,
          sale_rate: Number(prodSaleRate) || 0,
          initial_stock: Number(prodInitialStock) || 0,
          location_id: Number(prodInitialLocId),
          reorder_level: Number(prodReorder) || 12
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Product save failed');
      notify(editingProductId ? 'Product SKU updated!' : 'New Product SKU added!');
      setEditingProductId(null);
      setProdSku('');
      setProdName('');
      setProdPurchaseRate('');
      setProdSaleRate('');
      setProdInitialStock('');
      fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // ==================== EXPENSE, CUSTOMER, SUPPLIER, ACCOUNT HANDLERS ====================
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount || Number(expAmount) <= 0) return;
    try {
      const res = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expCategory,
          description: expDesc,
          amount: Number(expAmount),
          payment_method: expMethod,
          paid_to: expPaidTo
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Expense failed');
      notify(`Expense ${data.expense_number} recorded for PKR ${data.amount.toLocaleString()}`);
      setExpAmount('');
      setExpDesc('');
      setExpPaidTo('');
      fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingCustomerId ? `${API_BASE}/customers/${editingCustomerId}` : `${API_BASE}/customers`;
    const method = editingCustomerId ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cusName,
        phone: cusPhone,
        city: cusCity,
        credit_limit: Number(cusCreditLimit) || 50000,
        current_receivable: Number(cusReceivable) || 0
      })
    });
    notify(editingCustomerId ? 'Customer updated!' : 'New Customer added!');
    setEditingCustomerId(null);
    setCusName('');
    setCusPhone('');
    setCusCity('');
    setCusReceivable('');
    fetchData();
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingSupplierId ? `${API_BASE}/suppliers/${editingSupplierId}` : `${API_BASE}/suppliers`;
    const method = editingSupplierId ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: supName,
        phone: supPhone,
        city: supCity,
        current_payable: Number(supPayable) || 0
      })
    });
    notify(editingSupplierId ? 'Supplier updated!' : 'New Supplier added!');
    setEditingSupplierId(null);
    setSupName('');
    setSupPhone('');
    setSupCity('');
    setSupPayable('');
    fetchData();
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingAccountId ? `${API_BASE}/accounts/${editingAccountId}` : `${API_BASE}/accounts`;
    const method = editingAccountId ? 'PUT' : 'POST';
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: accName,
        type: accType,
        account_number: accNumber,
        current_balance: Number(accBalance) || 0
      })
    });
    notify(editingAccountId ? 'Account balance updated!' : 'New Financial Account added!');
    setEditingAccountId(null);
    setAccName('');
    setAccNumber('');
    setAccBalance('');
    fetchData();
  };

  // ==================== PASSWORD-PROTECTED REVERSE & RECYCLE BIN ====================
  const triggerReverse = (entityType: EntityType, entityId: number, title: string) => {
    setSecurityPassword('');
    setSecurityError('');
    setSecurityModal({
      mode: 'REVERSE',
      entityType,
      entityId,
      title: `Reverse & Move to Recycle Bin: ${title}`,
      description:
        'This action reverses stock quantities in the storage location, adjusts customer/supplier balances, refunds/deducts the financial account, and moves the record to the Recycle Bin.'
    });
  };

  const handleExecuteSecurityAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityModal) return;
    setSecurityError('');
    setSecurityBusy(true);
    try {
      let url = '';
      if (securityModal.mode === 'REVERSE') {
        url = `${API_BASE}/security/reverse/${securityModal.entityType}/${securityModal.entityId}`;
      } else if (securityModal.mode === 'PERMANENT_DELETE') {
        url = `${API_BASE}/recycle-bin/${securityModal.trashId}/permanent-delete`;
      } else {
        url = `${API_BASE}/recycle-bin/empty`;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_password: securityPassword.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Authorization failed.');
      }
      notify(data.message || 'Authorized action executed.');
      setSecurityModal(null);
      setSecurityPassword('');
      fetchData();
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to execute action.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleRestoreFromBin = async (trashId: number) => {
    try {
      const res = await fetch(`${API_BASE}/recycle-bin/${trashId}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Restore failed');
      notify(data.message);
      fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const pendingSales = sales.filter(s => s.receivable_amount > 0);
  const pendingPurchases = purchases.filter(p => p.payable_amount > 0);

  // ==================== LOGIN SCREEN ====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <OilDropletsBackdrop />
        <div className="max-w-lg w-full glass-panel rounded-2xl overflow-hidden shadow-2xl animate-fade-in relative z-10 border border-amber-500/30">
          <div className="bg-black/90 border-b border-amber-500/30 p-2">
            <img
              src="/banner.jpg"
              alt="ATH Lubricants Banner"
              className="w-full h-auto object-contain rounded-xl"
            />
          </div>

          <form onSubmit={handleAdminLogin} className="p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight samsung-heading">
                  ATH <span className="oil-gradient-text">LUBRICANTS</span> ERP
                </h1>
                <p className="text-xs text-zinc-300">Executive Distribution & Financial Portal</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase text-amber-300 bg-amber-950/70 border border-amber-500/40 px-3 py-1.5 rounded-full">
                <Lock className="w-3.5 h-3.5 text-amber-400" /> Protected Access
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white">Administrator Username</label>
                <input
                  type="text"
                  required
                  placeholder="Enter administrator username"
                  value={loginUser}
                  onChange={e => setLoginUser(e.target.value)}
                  className="mt-1.5 erp-input"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white">Administrator Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter administrator password"
                  value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  className="mt-1.5 erp-input"
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-700 text-xs text-rose-200 font-semibold">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full btn-primary py-3.5 text-xs uppercase tracking-widest"
            >
              Sign In to Executive Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  const mainMenuItems: { id: MainSection; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'accounts', label: 'Accounts & Trade' },
    { id: 'inventory', label: 'Inventory & Warehouses' },
    { id: 'directory', label: `Parties & Bin (${stats?.trash_count ?? recycleBin.length})` }
  ];

  return (
    <div className="min-h-screen flex flex-col pb-20 lg:pb-8 relative">
      {/* Continuous Viscous Golden Oil Droplets Animation */}
      <OilDropletsBackdrop />

      {/* ==================== SAMSUNG-INSPIRED STICKY HEADER ==================== */}
      <header className="bg-[#050507]/85 backdrop-blur-2xl border-b border-amber-500/20 sticky top-0 z-40 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-black/80 p-1 rounded-xl border border-white/10">
              <button
                onClick={handleBack}
                disabled={!canGoBack}
                className={`p-1.5 rounded-lg transition ${
                  canGoBack ? 'text-white hover:bg-amber-500 hover:text-black' : 'text-zinc-600 cursor-not-allowed'
                }`}
                title="Back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleForward}
                disabled={!canGoForward}
                className={`p-1.5 rounded-lg transition ${
                  canGoForward ? 'text-white hover:bg-amber-500 hover:text-black' : 'text-zinc-600 cursor-not-allowed'
                }`}
                title="Forward"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="relative bg-gradient-to-br from-amber-500 via-amber-600 to-rose-600 p-2.5 rounded-xl text-black shadow-lg shadow-amber-500/30">
              <Wrench className="w-5 h-5 text-black" />
              <Droplet className="w-3 h-3 text-amber-300 fill-amber-400 absolute -bottom-1.5 right-1 oil-badge-drip" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-black tracking-tight text-white flex items-center gap-2 samsung-heading">
                ATH <span className="oil-gradient-text">LUBRICANTS</span>
              </h1>
              <p className="text-[11px] text-amber-300/90 font-medium hidden sm:block">
                Precision Motor Oil Distribution & Financial Command
              </p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1.5 bg-black/80 p-1.5 rounded-xl border border-white/10">
            {mainMenuItems.map(item => (
              <button
                key={item.id}
                onClick={() => navigateTo({ main: item.id })}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-tight transition-all duration-200 ${
                  currentNav.main === item.id
                    ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-md shadow-amber-500/25'
                    : 'text-zinc-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 text-amber-400 hover:text-white bg-black/80 border border-amber-500/30 rounded-xl transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 bg-black/80 hover:bg-rose-950/90 text-white hover:text-rose-300 border border-white/15 px-3.5 py-2 rounded-xl text-xs font-bold transition"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-white bg-amber-500/20 border border-amber-500/40 rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Sub-Menu Bar */}
        {currentNav.main !== 'dashboard' && (
          <div className="max-w-7xl mx-auto mt-3 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {currentNav.main === 'accounts' &&
                ([
                  { id: 'sales', label: 'Sales Invoices' },
                  { id: 'purchases', label: 'Purchase Bills' },
                  { id: 'partials', label: `Partial Payments (${pendingSales.length + pendingPurchases.length})` },
                  { id: 'expenses', label: 'Operating Expenses' },
                  { id: 'wallets', label: 'Cash & Bank Accounts' },
                  { id: 'ledger', label: 'Complete Ledger History' }
                ] as { id: AccountsSubTab; label: string }[]).map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => navigateTo({ main: 'accounts', accSub: sub.id })}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      currentNav.accSub === sub.id
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                        : 'bg-black/80 text-white border border-white/10 hover:border-amber-500/50'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}

              {currentNav.main === 'inventory' &&
                ([
                  { id: 'stock_breakdown', label: 'Location & Carton Stock Breakdown' },
                  { id: 'products_crud', label: 'Add / Edit Products & Carton Sizes' },
                  { id: 'locations_transfer', label: 'Warehouses & Stock Transfers' }
                ] as { id: InventorySubTab; label: string }[]).map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => navigateTo({ main: 'inventory', invSub: sub.id })}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      currentNav.invSub === sub.id
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                        : 'bg-black/80 text-white border border-white/10 hover:border-amber-500/50'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}

              {currentNav.main === 'directory' &&
                ([
                  { id: 'parties', label: 'Customers & Suppliers' },
                  { id: 'recycle', label: `Recycle Bin (${stats?.trash_count ?? recycleBin.length})` }
                ] as { id: DirectorySubTab; label: string }[]).map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => navigateTo({ main: 'directory', dirSub: sub.id })}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      currentNav.dirSub === sub.id
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                        : 'bg-black/80 text-white border border-white/10 hover:border-amber-500/50'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
            </div>
          </div>
        )}

        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2">
            {mainMenuItems.map(item => (
              <button
                key={item.id}
                onClick={() => navigateTo({ main: item.id })}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold text-left ${
                  currentNav.main === item.id
                    ? 'bg-amber-500 text-black'
                    : 'bg-black/90 text-white border border-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 space-y-6 relative z-10">
        {toast && (
          <div
            className={`glass-panel px-4 py-3 rounded-xl text-xs font-bold flex justify-between items-center animate-fade-in ${
              toast.isError
                ? 'border-rose-500/70 bg-rose-950/90 text-white'
                : 'border-emerald-500/70 bg-emerald-950/90 text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              {toast.isError ? <AlertOctagon className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {toast.msg}
            </span>
            <button onClick={() => setToast(null)}>✕</button>
          </div>
        )}

        {/* =========================================================================
            SECTION 1: EXECUTIVE DASHBOARD
           ========================================================================= */}
        {currentNav.main === 'dashboard' && stats && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                    EXECUTIVE REPORTING TIMEFRAME
                  </h2>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    Filter Sales, Purchases, Expenses, Net Profit & Cashflow Ledger
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex gap-2">
                {([
                  { id: 'daily', label: 'Daily (Today)' },
                  { id: 'weekly', label: 'Last Week (7D)' },
                  { id: 'monthly', label: 'Monthly (30D)' },
                  { id: 'all', label: 'All-Time' }
                ] as const).map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      period === p.id
                        ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-lg shadow-amber-500/30'
                        : 'bg-black/80 text-zinc-300 border border-white/10 hover:text-white hover:border-amber-500/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="kpi-card p-5 rounded-2xl">
                <div className="flex items-center justify-between text-white text-xs font-bold uppercase tracking-wider">
                  <span>Sales ({period})</span>
                  <span className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-emerald-400 tabular-nums">
                  PKR {stats.total_sales_revenue.toLocaleString()}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-200 border-t border-white/10 pt-2 tabular-nums">
                  <span>Collected: PKR {stats.sales_collected.toLocaleString()}</span>
                  <span className="text-amber-400 font-bold">Khata: PKR {stats.sales_pending.toLocaleString()}</span>
                </div>
              </div>

              <div className="kpi-card p-5 rounded-2xl">
                <div className="flex items-center justify-between text-white text-xs font-bold uppercase tracking-wider">
                  <span>Purchases ({period})</span>
                  <span className="p-2 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <ShoppingCart className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-amber-400 tabular-nums">
                  PKR {stats.total_purchases_cost.toLocaleString()}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-200 border-t border-white/10 pt-2 tabular-nums">
                  <span>Paid: PKR {stats.purchases_paid.toLocaleString()}</span>
                  <span className="text-rose-400 font-bold">Payable: PKR {stats.purchases_pending.toLocaleString()}</span>
                </div>
              </div>

              <div className="kpi-card p-5 rounded-2xl">
                <div className="flex items-center justify-between text-white text-xs font-bold uppercase tracking-wider">
                  <span>Net Profit ({period})</span>
                  <span className="p-2 rounded-lg bg-white/10 text-white border border-white/20">
                    <BarChart3 className="w-4 h-4" />
                  </span>
                </div>
                <div className={`mt-3 text-2xl font-black tabular-nums ${stats.net_profit >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  PKR {stats.net_profit.toLocaleString()}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-200 border-t border-white/10 pt-2 tabular-nums">
                  <span>Gross: PKR {stats.estimated_gross_profit.toLocaleString()}</span>
                  <span className="text-rose-400 font-bold">Exp: PKR {stats.total_expenses.toLocaleString()}</span>
                </div>
              </div>

              <div className="kpi-card p-5 rounded-2xl">
                <div className="flex items-center justify-between text-white text-xs font-bold uppercase tracking-wider">
                  <span>Liquid Cash & Wallets</span>
                  <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[11px] font-bold flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" /> PKR
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-emerald-400 tabular-nums">
                  PKR {stats.total_cash_bank.toLocaleString()}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-200 border-t border-white/10 pt-2 tabular-nums">
                  <span>Receivable: PKR {stats.total_receivable.toLocaleString()}</span>
                  <span className="text-rose-400 font-bold">Payable: PKR {stats.total_payable.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl bg-black/90">
                <img
                  src="/banner.jpg"
                  alt="ATH Motorcycle Engine Oil Banner"
                  className="w-full h-auto object-contain mx-auto block"
                />
              </div>

              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2 samsung-heading heading-reveal">
                    <Landmark className="w-4 h-4 text-emerald-400" /> Financial Accounts
                  </h3>
                  <button
                    onClick={() => navigateTo({ main: 'accounts', accSub: 'wallets' })}
                    className="text-xs text-amber-400 hover:text-amber-300 hover:underline font-bold"
                  >
                    Manage →
                  </button>
                </div>
                <div className="space-y-3">
                  {accounts.map(acc => (
                    <div
                      key={acc.id}
                      className="bg-black/80 hover:bg-black/95 p-4 rounded-xl border border-white/10 hover:border-amber-500/40 transition flex justify-between items-center"
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{acc.name}</div>
                        <div className="text-[11px] text-amber-400/90 font-mono">
                          {acc.type} • {acc.account_number || 'N/A'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-emerald-400 tabular-nums">
                          PKR {acc.current_balance.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-zinc-400">Active Balance</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 2: ACCOUNTS & TRADE
           ========================================================================= */}
        {currentNav.main === 'accounts' && (
          <div className="space-y-6 animate-fade-in">
            {currentNav.accSub === 'sales' && (
              <div className="space-y-6">
                <div className="glass-panel rounded-2xl p-5 sm:p-6">
                  <h3 className="text-sm font-extrabold text-white mb-4 flex items-center gap-2 samsung-heading heading-reveal">
                    <Plus className="w-4 h-4 text-amber-400" /> CREATE CUSTOMER SALE INVOICE
                  </h3>
                  <form onSubmit={handleCreateSale} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white font-semibold">Customer / Dealership</label>
                        <button
                          type="button"
                          onClick={handleInstantSaleFavorite}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border transition ${
                            saleMarkFav
                              ? 'bg-amber-500/25 text-amber-300 border-amber-400'
                              : 'bg-black/80 text-zinc-300 border-white/15 hover:text-white'
                          }`}
                        >
                          <Star className={`w-3 h-3 ${saleMarkFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                          {saleMarkFav ? '★ Saved in Favorites' : '☆ Mark as Favorite'}
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Type new or existing Customer / Dealership"
                        value={saleCustomerName}
                        onChange={e => {
                          setSaleCustomerName(e.target.value);
                          setSaleCustomerId(0);
                        }}
                        className="erp-input"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={saleCustomerId}
                          onChange={e => {
                            const id = Number(e.target.value);
                            setSaleCustomerId(id);
                            const fav = favoriteCustomers.find(c => c.id === id);
                            if (fav) {
                              setSaleCustomerName(fav.name);
                              setSaleCustomerCity(fav.city);
                              setSaleMarkFav(true);
                            }
                          }}
                          className="erp-input text-amber-300 font-semibold"
                        >
                          <option value={0}>★ Pick Favorite ({favoriteCustomers.length})</option>
                          {favoriteCustomers.map(c => (
                            <option key={c.id} value={c.id}>
                              ★ {c.name} ({c.city})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="City (Optional)"
                          value={saleCustomerCity}
                          onChange={e => setSaleCustomerCity(e.target.value)}
                          className="erp-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-white font-semibold">Product</label>
                      <select
                        value={saleProductId}
                        onChange={e => handleSelectSaleProduct(Number(e.target.value))}
                        className="mt-1.5 erp-input"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-amber-400 font-semibold">Dispatch From Location</label>
                      <select
                        value={saleLocationId}
                        onChange={e => setSaleLocationId(Number(e.target.value))}
                        className="mt-1.5 erp-input"
                      >
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-white font-semibold">Bottle Size (ML)</label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 700"
                          value={salePackSize}
                          onChange={e => setSalePackSize(e.target.value)}
                          className="mt-1.5 erp-input"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-amber-400 font-semibold">Bottles / Carton</label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 32"
                          value={saleCartonSize}
                          onChange={e => setSaleCartonSize(e.target.value)}
                          className="mt-1.5 erp-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-white font-semibold">Sale Unit & Quantity</label>
                      <div className="mt-1.5 flex gap-2">
                        <select
                          value={saleUnitType}
                          onChange={e => setSaleUnitType(e.target.value as 'CARTON' | 'BOTTLE')}
                          className="erp-input w-32 font-bold text-amber-400"
                        >
                          <option value="CARTON">CARTON</option>
                          <option value="BOTTLE">BOTTLE</option>
                        </select>
                        <input
                          type="number"
                          required
                          placeholder="Qty"
                          value={saleQuantity}
                          onChange={e => setSaleQuantity(e.target.value)}
                          className="erp-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-white font-semibold">Rate per {saleUnitType} (PKR)</label>
                      <input
                        type="number"
                        required
                        placeholder={`PKR per ${saleUnitType.toLowerCase()}`}
                        value={saleRate}
                        onChange={e => setSaleRate(e.target.value)}
                        className="mt-1.5 erp-input"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white font-semibold">Payment Terms</label>
                      <select
                        value={salePaymentMode}
                        onChange={e => {
                          const m = e.target.value as 'UNPAID' | 'PARTIAL' | 'PAID';
                          setSalePaymentMode(m);
                          if (m === 'UNPAID') setSaleReceived('');
                        }}
                        className="mt-1.5 erp-input font-semibold"
                      >
                        <option value="UNPAID">Unpaid / Credit</option>
                        <option value="PARTIAL">Partial Payment</option>
                        <option value="PAID">Full Paid</option>
                      </select>
                    </div>

                    {salePaymentMode === 'PARTIAL' && (
                      <div>
                        <label className="text-xs text-amber-400 font-semibold">Partial Received (PKR)</label>
                        <input
                          type="number"
                          required
                          placeholder="Enter PKR received"
                          value={saleReceived}
                          onChange={e => setSaleReceived(e.target.value)}
                          className="mt-1.5 erp-input"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-white font-semibold">Receiving Account</label>
                      <select
                        value={saleMethod}
                        onChange={e => setSaleMethod(e.target.value)}
                        className="mt-1.5 erp-input"
                      >
                        <option value="CASH">CASH DRAWER</option>
                        <option value="BANK">HBL BANK</option>
                        <option value="EASYPAISA">EASYPAISA</option>
                        <option value="JAZZCASH">JAZZCASH</option>
                      </select>
                    </div>

                    {selectedSaleProduct && (
                      <div className="sm:col-span-2 lg:col-span-4 rounded-xl p-3.5 bg-black/85 border border-white/15 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-zinc-300">Available in </span>
                            <strong className="text-amber-400">{selectedSaleLocName}</strong>:{' '}
                            <strong className={saleLocAvailableBottles > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {Math.floor(saleLocAvailableBottles / saleUpc)} Cartons & {saleLocAvailableBottles % saleUpc} Bottles ({saleLocAvailableBottles} Total Bottles • Size {selectedSaleProduct.pack_size})
                            </strong>
                          </div>
                          <div className="text-zinc-300">
                            Last Sale Rate: <strong className="text-emerald-400">PKR {selectedSaleProduct.carton_sale_rate.toLocaleString()}/Carton</strong> (PKR {selectedSaleProduct.sale_rate}/Btl)
                          </div>
                        </div>

                        {isSaleStockInsufficient && saleAlternativeLocations.length > 0 && (
                          <div className="p-3 rounded-lg bg-amber-950/75 border border-amber-500/60 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-amber-200 font-semibold">
                              ⚠️ Not enough stock in <span className="underline">{selectedSaleLocName}</span> ({saleLocAvailableBottles} Btls), but this item IS available in another location!
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {saleAlternativeLocations.map(alt => (
                                <button
                                  key={alt.location_id}
                                  type="button"
                                  onClick={() => setSaleLocationId(alt.location_id)}
                                  className="btn-oil px-3 py-1.5 text-xs"
                                >
                                  Switch to {alt.location_name} ({alt.cartons} Ctn + {alt.loose_bottles} Btl • {alt.stock_bottles} Btls)
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {isSaleStockInsufficient && saleAlternativeLocations.length === 0 && (
                          <div className="p-2.5 rounded-lg bg-rose-950/90 border border-rose-600 text-white font-semibold">
                            🚫 Sale Blocked: "{selectedSaleProduct.name}" is out of stock in {selectedSaleLocName} (Available: {saleLocAvailableBottles} Btls{saleTotalBottles > 0 ? `, Requested: ${saleTotalBottles} Btls` : ''}) and has 0 stock in other locations.
                          </div>
                        )}
                      </div>
                    )}

                    <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/10">
                      <div className="space-y-1 text-xs">
                        <div className="text-amber-400 font-bold">
                          Exact Carton Calculation: {saleTotalBottles} Bottles (Size {salePackSize} ML) = {saleCalcCartons} Cartons & {saleCalcLoose} Loose Bottles (Max {saleUpc} Bottles/Carton)
                        </div>
                        <div className="flex flex-wrap gap-4 text-white tabular-nums">
                          <span>Total Bill: <strong className="text-amber-300">PKR {computedSaleTotal.toLocaleString()}</strong></span>
                          <span>Received: <strong className="text-emerald-400">PKR {computedSaleReceived.toLocaleString()}</strong></span>
                          <span>Pending Khata: <strong className="text-rose-400">PKR {Math.max(0, computedSaleTotal - computedSaleReceived).toLocaleString()}</strong></span>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isSaleStockInsufficient}
                        className={`py-2.5 px-6 text-xs uppercase flex items-center gap-2 rounded-xl font-bold transition ${
                          isSaleStockInsufficient
                            ? 'bg-zinc-900 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                            : 'btn-primary'
                        }`}
                      >
                        {isSaleStockInsufficient ? 'Stock Unavailable — Cannot Sell' : 'Confirm & Post Sale'} <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>

                <div className="glass-panel rounded-2xl p-5">
                  <h3 className="text-sm font-extrabold text-white mb-4 samsung-heading heading-reveal">SALES INVOICES REGISTER</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs erp-table min-w-[780px]">
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Date</th>
                          <th>Customer</th>
                          <th>Location</th>
                          <th>Items & Carton Breakdown</th>
                          <th>Total</th>
                          <th>Received</th>
                          <th>Pending</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map(s => (
                          <tr key={s.id}>
                            <td className="font-mono font-bold text-amber-400">{s.invoice_number}</td>
                            <td className="text-zinc-300 font-mono">{s.invoice_date}</td>
                            <td className="font-bold text-white">{s.customer_name}</td>
                            <td className="text-amber-300 font-semibold">{s.location_summary}</td>
                            <td className="text-zinc-200">{s.items_summary}</td>
                            <td className="font-bold text-white tabular-nums">PKR {s.total_amount.toLocaleString()}</td>
                            <td className="text-emerald-400 font-bold tabular-nums">PKR {s.received_amount.toLocaleString()}</td>
                            <td className="font-bold text-rose-400 tabular-nums">PKR {s.receivable_amount.toLocaleString()}</td>
                            <td className="text-right space-x-2">
                              {s.receivable_amount > 0 && (
                                <button
                                  onClick={() =>
                                    setPartialModal({
                                      kind: 'SALE',
                                      id: s.id,
                                      refNumber: s.invoice_number,
                                      partyName: s.customer_name,
                                      totalAmount: s.total_amount,
                                      alreadyPaid: s.received_amount,
                                      remainingBalance: s.receivable_amount
                                    })
                                  }
                                  className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
                                >
                                  + Partial
                                </button>
                              )}
                              <button
                                onClick={() => triggerReverse('SALE', s.id, s.invoice_number)}
                                className="text-rose-400 hover:text-rose-300 p-1"
                              >
                                <RotateCcw className="w-4 h-4 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {currentNav.accSub === 'purchases' && (
              <div className="space-y-6">
                <div className="glass-panel rounded-2xl p-5 sm:p-6">
                  <h3 className="text-sm font-extrabold text-white mb-4 flex items-center gap-2 samsung-heading heading-reveal">
                    <ShoppingCart className="w-4 h-4 text-amber-400" /> RECORD SUPPLIER STOCK PURCHASE
                  </h3>
                  <form onSubmit={handleCreatePurchase} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white font-semibold">Supplier / Dealership</label>
                        <button
                          type="button"
                          onClick={handleInstantPurFavorite}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border transition ${
                            purMarkFav
                              ? 'bg-amber-500/25 text-amber-300 border-amber-400'
                              : 'bg-black/80 text-zinc-300 border-white/15 hover:text-white'
                          }`}
                        >
                          <Star className={`w-3 h-3 ${purMarkFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                          {purMarkFav ? '★ Saved in Favorites' : '☆ Mark as Favorite'}
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Type new or existing Supplier / Company"
                        value={purSupplierName}
                        onChange={e => {
                          setPurSupplierName(e.target.value);
                          setPurSupplierId(0);
                        }}
                        className="erp-input"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={purSupplierId}
                          onChange={e => {
                            const id = Number(e.target.value);
                            setPurSupplierId(id);
                            const fav = favoriteSuppliers.find(s => s.id === id);
                            if (fav) {
                              setPurSupplierName(fav.name);
                              setPurSupplierCity(fav.city);
                              setPurMarkFav(true);
                            }
                          }}
                          className="erp-input text-amber-300 font-semibold"
                        >
                          <option value={0}>★ Pick Favorite ({favoriteSuppliers.length})</option>
                          {favoriteSuppliers.map(s => (
                            <option key={s.id} value={s.id}>
                              ★ {s.name} ({s.city})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="City (Optional)"
                          value={purSupplierCity}
                          onChange={e => setPurSupplierCity(e.target.value)}
                          className="erp-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-white font-semibold">Product</label>
                      <select
                        value={purProductId}
                        onChange={e => handleSelectPurProduct(Number(e.target.value))}
                        className="mt-1.5 erp-input"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-amber-400 font-semibold">Store In Location</label>
                      <select
                        value={purLocationId}
                        onChange={e => setPurLocationId(Number(e.target.value))}
                        className="mt-1.5 erp-input"
                      >
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-white font-semibold">Bottle Size (ML)</label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 700"
                          value={purPackSize}
                          onChange={e => setPurPackSize(e.target.value)}
                          className="mt-1.5 erp-input"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-amber-400 font-semibold">Bottles / Carton</label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 32"
                          value={purCartonSize}
                          onChange={e => setPurCartonSize(e.target.value)}
                          className="mt-1.5 erp-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-white font-semibold">Purchase Unit & Quantity</label>
                      <div className="mt-1.5 flex gap-2">
                        <select
                          value={purUnitType}
                          onChange={e => setPurUnitType(e.target.value as 'CARTON' | 'BOTTLE')}
                          className="erp-input w-32 font-bold text-amber-400"
                        >
                          <option value="CARTON">CARTON</option>
                          <option value="BOTTLE">BOTTLE</option>
                        </select>
                        <input
                          type="number"
                          required
                          placeholder="Qty"
                          value={purQuantity}
                          onChange={e => setPurQuantity(e.target.value)}
                          className="erp-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-white font-semibold">Purchase Rate per {purUnitType} (PKR)</label>
                      <input
                        type="number"
                        required
                        placeholder={`PKR per ${purUnitType.toLowerCase()}`}
                        value={purRate}
                        onChange={e => setPurRate(e.target.value)}
                        className="mt-1.5 erp-input"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white font-semibold">Payment Terms</label>
                      <select
                        value={purPaymentMode}
                        onChange={e => {
                          const m = e.target.value as 'UNPAID' | 'PARTIAL' | 'PAID';
                          setPurPaymentMode(m);
                          if (m === 'UNPAID') setPurPaid('');
                        }}
                        className="mt-1.5 erp-input font-semibold"
                      >
                        <option value="UNPAID">Unpaid / Credit</option>
                        <option value="PARTIAL">Partial Paid</option>
                        <option value="PAID">Full Paid</option>
                      </select>
                    </div>

                    {purPaymentMode === 'PARTIAL' && (
                      <div>
                        <label className="text-xs text-amber-400 font-semibold">Partial Paid Now (PKR)</label>
                        <input
                          type="number"
                          required
                          placeholder="Enter PKR paid"
                          value={purPaid}
                          onChange={e => setPurPaid(e.target.value)}
                          className="mt-1.5 erp-input"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-white font-semibold">Payment Account</label>
                      <select
                        value={purMethod}
                        onChange={e => setPurMethod(e.target.value)}
                        className="mt-1.5 erp-input"
                      >
                        <option value="CASH">CASH DRAWER</option>
                        <option value="BANK">HBL BANK</option>
                        <option value="EASYPAISA">EASYPAISA</option>
                        <option value="JAZZCASH">JAZZCASH</option>
                      </select>
                    </div>

                    {selectedPurchaseProduct && (
                      <div className="sm:col-span-2 lg:col-span-4 rounded-xl p-4 bg-black/85 border border-white/15 space-y-2.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                          <div className="font-bold text-white">
                            Existing Stock for <span className="text-amber-400">{selectedPurchaseProduct.name}</span> (Size {selectedPurchaseProduct.pack_size} • Max {selectedPurchaseProduct.units_per_carton} Btls/Carton):{' '}
                            <span className="text-emerald-400">
                              {selectedPurchaseProduct.cartons} Cartons & {selectedPurchaseProduct.loose_bottles} Bottles ({selectedPurchaseProduct.current_stock_bottles} Total Bottles)
                            </span>
                          </div>
                          <div className="text-zinc-200 tabular-nums">
                            Last Purchase Price:{' '}
                            <strong className="text-amber-400">
                              PKR {selectedPurchaseProduct.carton_purchase_rate.toLocaleString()} / Carton
                            </strong>{' '}
                            (PKR {selectedPurchaseProduct.purchase_rate.toLocaleString()} / Bottle)
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-zinc-300 font-semibold">Stock Across Locations:</span>
                          {(selectedPurchaseProduct.locations || []).length === 0 ? (
                            <span className="text-zinc-500">0 Cartons & 0 Bottles in all locations</span>
                          ) : (
                            (selectedPurchaseProduct.locations || []).map(loc => (
                              <span
                                key={loc.location_id}
                                className="px-2.5 py-1 rounded-lg bg-black border border-amber-500/30 text-white tabular-nums"
                              >
                                <strong className="text-amber-400">{loc.location_name}:</strong> {loc.cartons} Cartons + {loc.loose_bottles} Bottles ({loc.stock_bottles} Btls)
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/10">
                      <div className="space-y-1 text-xs">
                        <div className="text-amber-400 font-bold">
                          New Purchase Calculation: +{purTotalBottles} Bottles (Size {purPackSize} ML) = +{purCalcCartons} Cartons & {purCalcLoose} Loose Bottles (Max {purUpc} Bottles/Carton)
                        </div>
                        <div className="flex flex-wrap gap-4 text-white tabular-nums">
                          <span>Total Bill: <strong className="text-amber-300">PKR {computedPurTotal.toLocaleString()}</strong></span>
                          <span>Paid Today: <strong className="text-emerald-400">PKR {computedPurPaid.toLocaleString()}</strong></span>
                          <span>Remaining Payable: <strong className="text-rose-400">PKR {Math.max(0, computedPurTotal - computedPurPaid).toLocaleString()}</strong></span>
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="btn-oil py-2.5 px-6 text-xs uppercase"
                      >
                        Save Purchase & Add Stock
                      </button>
                    </div>
                  </form>
                </div>

                <div className="glass-panel rounded-2xl p-5">
                  <h3 className="text-sm font-extrabold text-white mb-4 samsung-heading heading-reveal">PURCHASE BILLS REGISTER</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs erp-table min-w-[780px]">
                      <thead>
                        <tr>
                          <th>Bill #</th>
                          <th>Date</th>
                          <th>Supplier</th>
                          <th>Location</th>
                          <th>Items & Carton Breakdown</th>
                          <th>Total Bill</th>
                          <th>Paid</th>
                          <th>Payable</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map(p => (
                          <tr key={p.id}>
                            <td className="font-mono font-bold text-amber-400">{p.purchase_number}</td>
                            <td className="text-zinc-300 font-mono">{p.invoice_date}</td>
                            <td className="font-bold text-white">{p.supplier_name}</td>
                            <td className="text-emerald-400 font-semibold">{p.location_summary}</td>
                            <td className="text-zinc-200">{p.items_summary}</td>
                            <td className="font-bold text-white tabular-nums">PKR {p.total_amount.toLocaleString()}</td>
                            <td className="text-emerald-400 font-bold tabular-nums">PKR {p.paid_amount.toLocaleString()}</td>
                            <td className="font-bold text-rose-400 tabular-nums">PKR {p.payable_amount.toLocaleString()}</td>
                            <td className="text-right space-x-2">
                              {p.payable_amount > 0 && (
                                <button
                                  onClick={() =>
                                    setPartialModal({
                                      kind: 'PURCHASE',
                                      id: p.id,
                                      refNumber: p.purchase_number,
                                      partyName: p.supplier_name,
                                      totalAmount: p.total_amount,
                                      alreadyPaid: p.paid_amount,
                                      remainingBalance: p.payable_amount
                                    })
                                  }
                                  className="bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/40 px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
                                >
                                  + Partial
                                </button>
                              )}
                              <button
                                onClick={() => triggerReverse('PURCHASE', p.id, p.purchase_number)}
                                className="text-rose-400 hover:text-rose-300 p-1"
                              >
                                <RotateCcw className="w-4 h-4 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {currentNav.accSub === 'partials' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <Clock className="w-4 h-4 text-emerald-400" /> CUSTOMER PENDING INVOICES ({pendingSales.length})
                  </h3>
                  {pendingSales.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-400">No pending customer invoices.</div>
                  ) : (
                    pendingSales.map(s => (
                      <div key={s.id} className="bg-black/80 p-4 rounded-xl border border-white/10 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-xs font-bold text-amber-400">{s.invoice_number}</span>
                            <div className="text-sm font-bold text-white">{s.customer_name}</div>
                            <div className="text-[11px] text-zinc-300">{s.items_summary}</div>
                          </div>
                          <button
                            onClick={() =>
                              setPartialModal({
                                kind: 'SALE',
                                id: s.id,
                                refNumber: s.invoice_number,
                                partyName: s.customer_name,
                                totalAmount: s.total_amount,
                                alreadyPaid: s.received_amount,
                                remainingBalance: s.receivable_amount
                              })
                            }
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                          >
                            + Receive PKR
                          </button>
                        </div>
                        <div className="flex justify-between text-[11px] pt-2 border-t border-white/10 tabular-nums">
                          <span>Total: PKR {s.total_amount.toLocaleString()}</span>
                          <span className="text-emerald-400">Received: PKR {s.received_amount.toLocaleString()}</span>
                          <span className="text-amber-400 font-bold">Pending: PKR {s.receivable_amount.toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <Clock className="w-4 h-4 text-amber-400" /> SUPPLIER PENDING BILLS ({pendingPurchases.length})
                  </h3>
                  {pendingPurchases.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-400">No pending supplier bills.</div>
                  ) : (
                    pendingPurchases.map(p => (
                      <div key={p.id} className="bg-black/80 p-4 rounded-xl border border-white/10 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-xs font-bold text-amber-400">{p.purchase_number}</span>
                            <div className="text-sm font-bold text-white">{p.supplier_name}</div>
                            <div className="text-[11px] text-zinc-300">{p.items_summary}</div>
                          </div>
                          <button
                            onClick={() =>
                              setPartialModal({
                                kind: 'PURCHASE',
                                id: p.id,
                                refNumber: p.purchase_number,
                                partyName: p.supplier_name,
                                totalAmount: p.total_amount,
                                alreadyPaid: p.paid_amount,
                                remainingBalance: p.payable_amount
                              })
                            }
                            className="btn-oil px-3 py-1.5 text-xs"
                          >
                            + Pay PKR
                          </button>
                        </div>
                        <div className="flex justify-between text-[11px] pt-2 border-t border-white/10 tabular-nums">
                          <span>Bill: PKR {p.total_amount.toLocaleString()}</span>
                          <span className="text-emerald-400">Paid: PKR {p.paid_amount.toLocaleString()}</span>
                          <span className="text-rose-400 font-bold">Payable: PKR {p.payable_amount.toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {currentNav.accSub === 'expenses' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleCreateExpense} className="glass-panel rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <Truck className="w-4 h-4 text-rose-500" /> RECORD OPERATING EXPENSE
                  </h3>
                  <select
                    value={expCategory}
                    onChange={e => setExpCategory(e.target.value)}
                    className="erp-input"
                  >
                    <option value="Fuel">Vehicle Fuel</option>
                    <option value="Vehicle Maintenance">Vehicle Maintenance</option>
                    <option value="Salaries & Meals">Salaries & Staff Meals</option>
                    <option value="Shop Rent & Utilities">Shop Rent & Utilities</option>
                    <option value="Toll Tax & Challans">Toll Tax & Challans</option>
                  </select>
                  <input
                    type="number"
                    required
                    placeholder="Amount in PKR"
                    value={expAmount}
                    onChange={e => setExpAmount(e.target.value)}
                    className="erp-input"
                  />
                  <select
                    value={expMethod}
                    onChange={e => setExpMethod(e.target.value)}
                    className="erp-input"
                  >
                    <option value="CASH">CASH DRAWER</option>
                    <option value="BANK">HBL BANK</option>
                    <option value="EASYPAISA">EASYPAISA</option>
                    <option value="JAZZCASH">JAZZCASH</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Paid To"
                    value={expPaidTo}
                    onChange={e => setExpPaidTo(e.target.value)}
                    className="erp-input"
                  />
                  <input
                    type="text"
                    placeholder="Description / Notes"
                    value={expDesc}
                    onChange={e => setExpDesc(e.target.value)}
                    className="erp-input"
                  />
                  <button type="submit" className="w-full btn-primary py-2.5 text-xs uppercase">
                    Post Expense Voucher
                  </button>
                </form>

                <div className="lg:col-span-2 glass-panel rounded-2xl p-5 overflow-x-auto">
                  <h3 className="text-sm font-extrabold text-white mb-4 samsung-heading heading-reveal">EXPENSE VOUCHERS</h3>
                  <table className="w-full text-left text-xs erp-table min-w-[520px]">
                    <thead>
                      <tr>
                        <th>Voucher</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th>Account</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">Reverse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map(exp => (
                        <tr key={exp.id}>
                          <td className="font-mono text-zinc-300">{exp.expense_number}</td>
                          <td className="font-bold text-amber-400">{exp.category}</td>
                          <td className="text-white">{exp.description}</td>
                          <td className="font-mono">{exp.payment_method}</td>
                          <td className="text-right font-bold text-rose-400 tabular-nums">PKR {exp.amount.toLocaleString()}</td>
                          <td className="text-right">
                            <button
                              onClick={() => triggerReverse('EXPENSE', exp.id, exp.expense_number)}
                              className="text-rose-400 hover:text-rose-300"
                            >
                              <RotateCcw className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {currentNav.accSub === 'wallets' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleSaveAccount} className="glass-panel rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                    {editingAccountId ? 'EDIT FINANCIAL ACCOUNT' : 'ADD FINANCIAL ACCOUNT'}
                  </h3>
                  <input
                    type="text"
                    required
                    placeholder="Account Title (e.g. Meezan Bank / Cash)"
                    value={accName}
                    onChange={e => setAccName(e.target.value)}
                    className="erp-input"
                  />
                  <select
                    value={accType}
                    onChange={e => setAccType(e.target.value)}
                    className="erp-input"
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK">BANK</option>
                    <option value="EASYPAISA">EASYPAISA</option>
                    <option value="JAZZCASH">JAZZCASH</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Account / IBAN / Mobile #"
                    value={accNumber}
                    onChange={e => setAccNumber(e.target.value)}
                    className="erp-input"
                  />
                  <input
                    type="number"
                    required
                    placeholder="Current Balance (PKR)"
                    value={accBalance}
                    onChange={e => setAccBalance(e.target.value)}
                    className="erp-input"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase transition"
                    >
                      {editingAccountId ? 'Update Account' : 'Add Account'}
                    </button>
                    {editingAccountId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAccountId(null);
                          setAccName('');
                          setAccNumber('');
                          setAccBalance('');
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {accounts.map(acc => (
                    <div key={acc.id} className="glass-panel p-5 rounded-2xl flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-mono uppercase bg-black px-2.5 py-0.5 rounded-full text-amber-400 border border-amber-500/30">
                          {acc.type}
                        </span>
                        <div className="text-base font-bold text-white mt-1.5">{acc.name}</div>
                        <div className="text-xs text-zinc-300 font-mono">{acc.account_number || 'N/A'}</div>
                        <div className="text-xl font-extrabold text-emerald-400 mt-2 tabular-nums">
                          PKR {acc.current_balance.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingAccountId(acc.id);
                            setAccName(acc.name);
                            setAccType(acc.type);
                            setAccNumber(acc.account_number || '');
                            setAccBalance(String(acc.current_balance));
                          }}
                          className="p-2.5 bg-black/80 hover:bg-amber-500/20 text-amber-400 rounded-xl border border-white/10 transition"
                          title="Edit Account"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => triggerReverse('ACCOUNT', acc.id, acc.name)}
                          className="p-2.5 bg-black/80 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-white/10 transition"
                          title="Delete Account to Recycle Bin"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentNav.accSub === 'ledger' && (
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <FileText className="w-4 h-4 text-amber-400" /> COMPLETE PKR CASHFLOW LEDGER ({period.toUpperCase()})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {['ALL', 'CASH', 'BANK', 'EASYPAISA', 'JAZZCASH'].map(ch => (
                      <button
                        key={ch}
                        onClick={() => setChannelFilter(ch)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                          channelFilter === ch ? 'bg-amber-500 text-black' : 'bg-black/80 text-zinc-300 border border-white/10'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs erp-table min-w-[700px]">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Reference</th>
                        <th>Party</th>
                        <th>Channel</th>
                        <th>Description</th>
                        <th className="text-right">Cash In (+)</th>
                        <th className="text-right">Cash Out (-)</th>
                        <th className="text-right">Reverse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountHistory.map(h => (
                        <tr key={h.id}>
                          <td className="font-mono text-zinc-300">{h.date}</td>
                          <td className="font-bold text-white">{h.type}</td>
                          <td className="font-mono text-amber-400 font-bold">{h.reference}</td>
                          <td className="text-white font-semibold">{h.party}</td>
                          <td className="font-mono text-amber-300">{h.channel}</td>
                          <td className="text-zinc-300">{h.description}</td>
                          <td className="text-right font-bold text-emerald-400 tabular-nums">
                            {h.cash_in > 0 ? `+PKR ${h.cash_in.toLocaleString()}` : '-'}
                          </td>
                          <td className="text-right font-bold text-rose-400 tabular-nums">
                            {h.cash_out > 0 ? `-PKR ${h.cash_out.toLocaleString()}` : '-'}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => triggerReverse(h.entity_type, h.entity_id, h.reference)}
                              className="text-rose-400 hover:text-rose-300 p-1"
                            >
                              <RotateCcw className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION 3: INVENTORY & WAREHOUSES
           ========================================================================= */}
        {currentNav.main === 'inventory' && (
          <div className="space-y-6 animate-fade-in">
            {currentNav.invSub === 'stock_breakdown' && (
              <div className="space-y-6">
                <div className="glass-panel rounded-2xl p-5 sm:p-6">
                  <h3 className="text-sm font-extrabold text-white mb-3 flex items-center gap-2 samsung-heading heading-reveal">
                    <Layers className="w-4 h-4 text-amber-400" /> SET / ADJUST LOCATION STOCK BY BOTTLE SIZE & CARTON CAPACITY
                  </h3>
                  <form onSubmit={handleSetLocationStock} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="text-xs text-white font-semibold">Product (Name Only)</label>
                      <select
                        value={setStockProdId}
                        onChange={e => {
                          const id = Number(e.target.value);
                          setSetStockProdId(id);
                          const p = products.find(x => x.id === id);
                          if (p) {
                            setDirectPackSize(String(p.pack_size_num || 700));
                            setDirectCartonMax(String(p.units_per_carton || 12));
                          }
                        }}
                        className="mt-1 erp-input"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-amber-400 font-semibold">Storage Location</label>
                      <select
                        value={setStockLocId}
                        onChange={e => setSetStockLocId(Number(e.target.value))}
                        className="mt-1 erp-input"
                      >
                        {locations.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-white font-semibold">Total Bottles in Location</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 800"
                        value={setStockBottles}
                        onChange={e => setSetStockBottles(e.target.value)}
                        className="mt-1 erp-input"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-white font-semibold">Size (ML)</label>
                        <input
                          type="number"
                          required
                          placeholder="700"
                          value={directPackSize}
                          onChange={e => setDirectPackSize(e.target.value)}
                          className="mt-1 erp-input"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-emerald-400 font-semibold">Btls / Carton</label>
                        <input
                          type="number"
                          required
                          placeholder="32"
                          value={directCartonMax}
                          onChange={e => setDirectCartonMax(e.target.value)}
                          className="mt-1 erp-input"
                        />
                      </div>
                    </div>

                    <div className="flex items-end">
                      <button type="submit" className="w-full btn-primary py-2.5 text-xs uppercase">
                        Update Location Stock
                      </button>
                    </div>
                  </form>
                  {setStockBottles !== '' && (
                    <div className="mt-3 text-xs text-emerald-400 font-bold">
                      Live Carton Preview: {directStockNum} Bottles (Size {directPackSize} ML) = {directPreviewCartons} Cartons & {directPreviewLoose} Loose Bottles (at {directCartonMaxNum} Bottles per Carton)
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {enrichedLocations.map(loc => (
                    <div key={loc.id} className="glass-panel rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div>
                          <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                            {loc.location_type}
                          </span>
                          <h3 className="text-base font-extrabold text-white mt-1.5 samsung-heading">{loc.name}</h3>
                          <p className="text-xs text-zinc-300">{loc.address || loc.code}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-zinc-300 uppercase block">Total in {loc.name}</span>
                          <span className="text-lg font-black text-amber-400 tabular-nums">
                            {loc.total_bottles.toLocaleString()} Bottles
                          </span>
                        </div>
                      </div>

                      {loc.safeItems.length === 0 ? (
                        <div className="py-8 text-center text-xs text-zinc-400">
                          No stock recorded in {loc.name} yet. Use the form above or record a Purchase to add stock.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {loc.safeItems.map(item => (
                            <div
                              key={item.product_id}
                              className="bg-black/85 p-4 rounded-xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div>
                                <div className="text-sm font-bold text-white">
                                  <span className="text-amber-400 font-extrabold tabular-nums">
                                    {item.stock_bottles.toLocaleString()} Bottles
                                  </span>{' '}
                                  • Size <span className="text-amber-300">{item.pack_size}</span> •{' '}
                                  <span className="text-white">{item.product_name}</span>{' '}
                                  <span className="text-zinc-400 font-normal">in {loc.name}</span>
                                </div>
                                <div className="text-xs text-emerald-400 font-bold mt-1 tabular-nums">
                                  Calculated Cartons: {item.cartons} Cartons & {item.loose_bottles} Bottles (Max {item.units_per_carton} Bottles / Carton)
                                </div>
                              </div>
                              <span className="font-mono text-[11px] bg-black px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-300 shrink-0">
                                {item.sku}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="glass-panel rounded-2xl p-5">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                      ALL PRODUCTS BREAKDOWN BY BOTTLE SIZE, CARTON CAPACITY & LOCATION
                    </h3>
                    <button
                      onClick={() => navigateTo({ main: 'inventory', invSub: 'products_crud' })}
                      className="btn-primary text-xs px-4 py-2"
                    >
                      + Add New Product
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs erp-table min-w-[820px]">
                      <thead>
                        <tr>
                          <th>Product & Bottle Size</th>
                          <th>Max Carton Size</th>
                          <th>Per-Location Breakdown (Display vs Warehouse)</th>
                          <th>Combined Stock</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => {
                          const safeLocs = Array.isArray(p.locations) ? p.locations : [];
                          return (
                            <tr key={p.id}>
                              <td>
                                <div className="font-bold text-white text-sm">{p.name}</div>
                                <div className="text-xs text-amber-400 font-semibold mt-0.5">
                                  Bottle Size: {p.pack_size} • SKU: {p.sku}
                                </div>
                              </td>
                              <td>
                                <span className="bg-black border border-amber-500/40 px-3 py-1 rounded-lg font-mono font-bold text-amber-400">
                                  {p.units_per_carton} Btls / Carton
                                </span>
                              </td>
                              <td>
                                <div className="space-y-1.5">
                                  {safeLocs.length === 0 ? (
                                    <span className="text-zinc-500">0 Bottles stored</span>
                                  ) : (
                                    safeLocs.map(loc => (
                                      <div
                                        key={loc.location_id}
                                        className="bg-black/85 px-3 py-2 rounded-lg border border-white/10"
                                      >
                                        <div className="font-semibold text-white">
                                          <strong className="text-amber-400">{loc.stock_bottles} Bottles</strong> (Size {p.pack_size}){' '}
                                          {p.name} in <strong className="text-amber-300">{loc.location_name}</strong>
                                        </div>
                                        <div className="text-[11px] text-emerald-400 font-bold">
                                          Calculated: {loc.cartons} Cartons & {loc.loose_bottles} Bottles (Max {p.units_per_carton} Btls/Carton)
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="font-extrabold text-white text-sm tabular-nums">
                                  {p.current_stock_bottles.toLocaleString()} Bottles ({p.pack_size})
                                </div>
                                <div className="text-[11px] text-emerald-400 font-bold tabular-nums">
                                  {p.cartons} Cartons & {p.loose_bottles} Bottles
                                </div>
                              </td>
                              <td className="text-right space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingProductId(p.id);
                                    setProdSku(p.sku);
                                    setProdName(p.name);
                                    setProdBrandId(p.brand_id || 1);
                                    setProdViscosity(p.viscosity);
                                    setProdPackSize(String(p.pack_size_num || 700));
                                    setProdUnitsPerCarton(String(p.units_per_carton));
                                    setProdPurchaseRate(String(p.purchase_rate));
                                    setProdSaleRate(String(p.sale_rate));
                                    setProdReorder(String(p.reorder_level));
                                    navigateTo({ main: 'inventory', invSub: 'products_crud' });
                                  }}
                                  className="text-amber-400 hover:text-amber-300"
                                >
                                  <Edit3 className="w-4 h-4 inline" />
                                </button>
                                <button
                                  onClick={() => triggerReverse('PRODUCT', p.id, p.name)}
                                  className="text-rose-400 hover:text-rose-300"
                                >
                                  <Trash2 className="w-4 h-4 inline" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {currentNav.invSub === 'products_crud' && (
              <div className="glass-panel rounded-2xl p-5 sm:p-6">
                <h3 className="text-sm font-extrabold text-white mb-4 flex items-center gap-2 samsung-heading heading-reveal">
                  <Package className="w-4 h-4 text-amber-400" />{' '}
                  {editingProductId ? 'EDIT PRODUCT BOTTLE SIZE & CARTON CAPACITY' : 'ADD NEW LUBRICANT PRODUCT'}
                </h3>
                <form onSubmit={handleSaveProduct} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-white font-semibold">SKU Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ATH-205"
                      value={prodSku}
                      onChange={e => setProdSku(e.target.value)}
                      className="mt-1.5 erp-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white font-semibold">Product Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ATH 700ML / Altus"
                      value={prodName}
                      onChange={e => setProdName(e.target.value)}
                      className="mt-1.5 erp-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-amber-400 font-semibold">Bottle Size (ML)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 700, 800, 1000"
                      value={prodPackSize}
                      onChange={e => setProdPackSize(e.target.value)}
                      className="mt-1.5 erp-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-emerald-400 font-semibold">Max Bottles per Carton</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 12, 24, 32"
                      value={prodUnitsPerCarton}
                      onChange={e => setProdUnitsPerCarton(e.target.value)}
                      className="mt-1.5 erp-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white font-semibold">Viscosity Grade</label>
                    <input
                      type="text"
                      placeholder="e.g. 20W-50 4T"
                      value={prodViscosity}
                      onChange={e => setProdViscosity(e.target.value)}
                      className="mt-1.5 erp-input"
                    />
                  </div>
                  {!editingProductId && (
                    <>
                      <div>
                        <label className="text-xs text-white font-semibold">Initial Stock (Bottles)</label>
                        <input
                          type="number"
                          placeholder="e.g. 800"
                          value={prodInitialStock}
                          onChange={e => setProdInitialStock(e.target.value)}
                          className="mt-1.5 erp-input"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white font-semibold">Initial Storage Location</label>
                        <select
                          value={prodInitialLocId}
                          onChange={e => setProdInitialLocId(Number(e.target.value))}
                          className="mt-1.5 erp-input"
                        >
                          {locations.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      className="flex-1 btn-primary py-2.5 text-xs uppercase"
                    >
                      {editingProductId ? 'Update Product' : 'Save Product'}
                    </button>
                    {editingProductId && (
                      <button
                        type="button"
                        onClick={() => setEditingProductId(null)}
                        className="bg-zinc-800 px-4 py-2.5 rounded-xl text-xs"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {currentNav.invSub === 'locations_transfer' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <ArrowLeftRight className="w-4 h-4 text-amber-400" /> TRANSFER STOCK BETWEEN LOCATIONS
                  </h3>
                  <form onSubmit={handleStockTransfer} className="space-y-3">
                    <div>
                      <label className="text-xs text-white font-semibold">Select Product</label>
                      <select
                        value={trfProductId}
                        onChange={e => setTrfProductId(Number(e.target.value))}
                        className="mt-1 erp-input"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.pack_size})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-rose-400 font-semibold">From Location</label>
                        <select
                          value={trfFromLocId}
                          onChange={e => setTrfFromLocId(Number(e.target.value))}
                          className="mt-1 erp-input"
                        >
                          {locations.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-emerald-400 font-semibold">To Location</label>
                        <select
                          value={trfToLocId}
                          onChange={e => setTrfToLocId(Number(e.target.value))}
                          className="mt-1 erp-input"
                        >
                          {locations.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-white font-semibold">Unit Type</label>
                        <select
                          value={trfUnitType}
                          onChange={e => setTrfUnitType(e.target.value as 'CARTON' | 'BOTTLE')}
                          className="mt-1 erp-input font-bold text-amber-400"
                        >
                          <option value="CARTON">CARTON</option>
                          <option value="BOTTLE">BOTTLE</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">Quantity to Transfer</label>
                        <input
                          type="number"
                          required
                          placeholder="Enter Qty"
                          value={trfQuantity}
                          onChange={e => setTrfQuantity(e.target.value)}
                          className="mt-1 erp-input"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full btn-oil py-3 text-xs uppercase"
                    >
                      Execute Stock Transfer
                    </button>
                  </form>
                </div>

                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <MapPin className="w-4 h-4 text-rose-500" />{' '}
                    {editingLocationId ? 'EDIT STORAGE LOCATION' : 'ADD STORAGE LOCATION'}
                  </h3>
                  <form onSubmit={handleSaveLocation} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Location Name"
                      value={locName}
                      onChange={e => setLocName(e.target.value)}
                      className="erp-input"
                    />
                    <select
                      value={locType}
                      onChange={e => setLocType(e.target.value)}
                      className="erp-input"
                    >
                      <option value="DISPLAY">DISPLAY COUNTER</option>
                      <option value="WAREHOUSE">WAREHOUSE</option>
                      <option value="GODOWN">GODOWN</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Address / Room Note"
                      value={locAddress}
                      onChange={e => setLocAddress(e.target.value)}
                      className="erp-input"
                    />
                    <button
                      type="submit"
                      className="sm:col-span-3 btn-primary py-2.5 text-xs uppercase"
                    >
                      {editingLocationId ? 'Update Location' : 'Add Location'}
                    </button>
                  </form>

                  <div className="space-y-2.5">
                    {locations.map(loc => (
                      <div key={loc.id} className="bg-black/85 p-3.5 rounded-xl border border-white/10 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] font-mono bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded text-amber-300 font-bold">
                            {loc.location_type}
                          </span>
                          <div className="text-sm font-bold text-white mt-1">{loc.name}</div>
                          <div className="text-xs text-zinc-300">
                            {loc.address || loc.code} — {loc.total_bottles.toLocaleString()} Bottles
                          </div>
                        </div>
                        <div className="space-x-2">
                          <button
                            onClick={() => {
                              setEditingLocationId(loc.id);
                              setLocName(loc.name);
                              setLocType(loc.location_type);
                              setLocAddress(loc.address);
                            }}
                            className="text-amber-400 p-1.5"
                          >
                            <Edit3 className="w-4 h-4 inline" />
                          </button>
                          <button
                            onClick={() => triggerReverse('LOCATION', loc.id, loc.name)}
                            className="text-rose-400 p-1.5"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION 4: PARTIES & RECYCLE BIN
           ========================================================================= */}
        {currentNav.main === 'directory' && (
          <div className="space-y-6 animate-fade-in">
            {currentNav.dirSub === 'parties' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <Users className="w-4 h-4 text-emerald-400" /> {editingCustomerId ? 'EDIT CUSTOMER' : 'ADD WORKSHOP CUSTOMER'}
                  </h3>
                  <form onSubmit={handleSaveCustomer} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Customer Name"
                      value={cusName}
                      onChange={e => setCusName(e.target.value)}
                      className="erp-input"
                    />
                    <input
                      type="text"
                      required
                      placeholder="City"
                      value={cusCity}
                      onChange={e => setCusCity(e.target.value)}
                      className="erp-input"
                    />
                    <input
                      type="text"
                      placeholder="Phone Number"
                      value={cusPhone}
                      onChange={e => setCusPhone(e.target.value)}
                      className="erp-input"
                    />
                    <input
                      type="number"
                      placeholder="Opening Receivable (PKR)"
                      value={cusReceivable}
                      onChange={e => setCusReceivable(e.target.value)}
                      className="erp-input"
                    />
                    <button type="submit" className="sm:col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase transition">
                      {editingCustomerId ? 'Update Customer' : 'Save Customer'}
                    </button>
                  </form>

                  <div className="space-y-2.5">
                    {customers.map(c => (
                      <div key={c.id} className="bg-black/85 p-3.5 rounded-xl border border-white/10 flex justify-between items-center">
                        <div>
                          <div className="text-sm font-bold text-white">{c.name}</div>
                          <div className="text-xs text-zinc-300">{c.city} • {c.phone}</div>
                          <div className="text-xs font-bold text-amber-400 mt-1 tabular-nums">
                            Receivable: PKR {c.current_receivable.toLocaleString()}
                          </div>
                        </div>
                        <div className="space-x-1.5">
                          <button
                            onClick={() => toggleCustomerFavorite(c)}
                            className={`p-1.5 rounded-lg transition ${c.is_favorite ? 'text-amber-400' : 'text-zinc-500 hover:text-white'}`}
                            title="Toggle Favorite"
                          >
                            <Star className={`w-4 h-4 inline ${c.is_favorite ? 'fill-amber-400' : ''}`} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingCustomerId(c.id);
                              setCusName(c.name);
                              setCusCity(c.city);
                              setCusPhone(c.phone || '');
                              setCusReceivable(String(c.current_receivable));
                            }}
                            className="text-amber-400 p-1.5"
                          >
                            <Edit3 className="w-4 h-4 inline" />
                          </button>
                          <button
                            onClick={() => triggerReverse('CUSTOMER', c.id, c.name)}
                            className="text-rose-400 p-1.5"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <Truck className="w-4 h-4 text-amber-400" /> {editingSupplierId ? 'EDIT SUPPLIER' : 'ADD OIL SUPPLIER'}
                  </h3>
                  <form onSubmit={handleSaveSupplier} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Supplier Name"
                      value={supName}
                      onChange={e => setSupName(e.target.value)}
                      className="erp-input"
                    />
                    <input
                      type="text"
                      required
                      placeholder="City"
                      value={supCity}
                      onChange={e => setSupCity(e.target.value)}
                      className="erp-input"
                    />
                    <input
                      type="text"
                      placeholder="Phone Number"
                      value={supPhone}
                      onChange={e => setSupPhone(e.target.value)}
                      className="erp-input"
                    />
                    <input
                      type="number"
                      placeholder="Opening Payable (PKR)"
                      value={supPayable}
                      onChange={e => setSupPayable(e.target.value)}
                      className="erp-input"
                    />
                    <button type="submit" className="sm:col-span-2 btn-primary py-2.5 text-xs uppercase">
                      {editingSupplierId ? 'Update Supplier' : 'Save Supplier'}
                    </button>
                  </form>

                  <div className="space-y-2.5">
                    {suppliers.map(s => (
                      <div key={s.id} className="bg-black/85 p-3.5 rounded-xl border border-white/10 flex justify-between items-center">
                        <div>
                          <div className="text-sm font-bold text-white">{s.name}</div>
                          <div className="text-xs text-zinc-300">{s.city} • {s.phone}</div>
                          <div className="text-xs font-bold text-rose-400 mt-1 tabular-nums">
                            Payable: PKR {s.current_payable.toLocaleString()}
                          </div>
                        </div>
                        <div className="space-x-1.5">
                          <button
                            onClick={() => toggleSupplierFavorite(s)}
                            className={`p-1.5 rounded-lg transition ${s.is_favorite ? 'text-amber-400' : 'text-zinc-500 hover:text-white'}`}
                            title="Toggle Favorite"
                          >
                            <Star className={`w-4 h-4 inline ${s.is_favorite ? 'fill-amber-400' : ''}`} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingSupplierId(s.id);
                              setSupName(s.name);
                              setSupCity(s.city);
                              setSupPhone(s.phone || '');
                              setSupPayable(String(s.current_payable));
                            }}
                            className="text-amber-400 p-1.5"
                          >
                            <Edit3 className="w-4 h-4 inline" />
                          </button>
                          <button
                            onClick={() => triggerReverse('SUPPLIER', s.id, s.name)}
                            className="text-rose-400 p-1.5"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentNav.dirSub === 'recycle' && (
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                      <Trash2 className="w-4 h-4 text-rose-500" /> PROTECTED RECYCLE BIN & REVERSAL ARCHIVE
                    </h3>
                    <p className="text-xs text-zinc-300">
                      Restore reversed records with one click or permanently purge with administrator verification
                    </p>
                  </div>
                  {recycleBin.length > 0 && (
                    <button
                      onClick={() => {
                        setSecurityPassword('');
                        setSecurityError('');
                        setSecurityModal({
                          mode: 'EMPTY_BIN',
                          title: 'Permanently Empty Entire Recycle Bin',
                          description: 'All archived records in the Recycle Bin will be permanently purged.'
                        });
                      }}
                      className="btn-primary px-4 py-2 text-xs uppercase"
                    >
                      Empty Recycle Bin
                    </button>
                  )}
                </div>

                {recycleBin.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-400">
                    Recycle Bin is empty.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs erp-table min-w-[720px]">
                      <thead>
                        <tr>
                          <th>Deleted At</th>
                          <th>Type</th>
                          <th>Reference</th>
                          <th>Summary</th>
                          <th className="text-right">Amount</th>
                          <th className="text-right">Restore / Purge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recycleBin.map(item => (
                          <tr key={item.id}>
                            <td className="font-mono text-zinc-300">{item.deleted_at}</td>
                            <td>
                              <span className="px-2 py-0.5 rounded bg-black border border-amber-500/40 text-amber-400 font-mono text-[10px] font-bold">
                                {item.entity_type}
                              </span>
                            </td>
                            <td className="font-mono font-bold text-white">{item.reference_code}</td>
                            <td>
                              <div className="font-bold text-white">{item.title}</div>
                              <div className="text-[11px] text-zinc-300">{item.summary}</div>
                            </td>
                            <td className="text-right font-bold text-rose-400 tabular-nums">
                              PKR {item.amount.toLocaleString()}
                            </td>
                            <td className="text-right space-x-2">
                              <button
                                onClick={() => handleRestoreFromBin(item.id)}
                                className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 px-3 py-1 rounded-lg text-[11px] font-bold transition"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => {
                                  setSecurityPassword('');
                                  setSecurityError('');
                                  setSecurityModal({
                                    mode: 'PERMANENT_DELETE',
                                    trashId: item.id,
                                    title: `Permanently Delete ${item.reference_code}`,
                                    description: 'This item will be permanently erased from the Recycle Bin.'
                                  });
                                }}
                                className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 px-3 py-1 rounded-lg text-[11px] font-bold transition"
                              >
                                Delete Forever
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ==================== MODAL 1: PARTIAL PAYMENT INSTALLMENT ==================== */}
      {partialModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 space-y-4 border border-amber-500/40 animate-modal">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-white uppercase samsung-heading">
                {partialModal.kind === 'SALE' ? 'Receive Customer Installment' : 'Pay Supplier Installment'}
              </h3>
              <button onClick={() => setPartialModal(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black/85 p-3.5 rounded-xl border border-white/10 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Reference:</span>
                <span className="font-mono font-bold text-white">{partialModal.refNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Party:</span>
                <span className="font-bold text-white">{partialModal.partyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Remaining Balance:</span>
                <span className="text-amber-400 font-extrabold tabular-nums">
                  PKR {partialModal.remainingBalance.toLocaleString()}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordPartialPayment} className="space-y-3">
              <div>
                <label className="text-xs text-white font-semibold">Installment Amount (PKR)</label>
                <input
                  type="number"
                  required
                  placeholder={`Maximum PKR ${partialModal.remainingBalance}`}
                  value={partialAmount}
                  onChange={e => setPartialAmount(e.target.value)}
                  className="mt-1 erp-input"
                />
              </div>

              <div>
                <label className="text-xs text-white font-semibold">Account Channel</label>
                <select
                  value={partialMethod}
                  onChange={e => setPartialMethod(e.target.value)}
                  className="mt-1 erp-input"
                >
                  <option value="CASH">CASH DRAWER</option>
                  <option value="BANK">HBL BANK</option>
                  <option value="EASYPAISA">EASYPAISA</option>
                  <option value="JAZZCASH">JAZZCASH</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full btn-primary py-3 text-xs uppercase tracking-wider"
              >
                Confirm PKR Installment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: ADMIN PASSWORD SECURITY ==================== */}
      {securityModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 space-y-4 border border-rose-500/50 animate-modal">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-rose-400 uppercase flex items-center gap-2 samsung-heading">
                <Lock className="w-4 h-4" /> Administrator Security Verification
              </h3>
              <button onClick={() => setSecurityModal(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-bold text-white">{securityModal.title}</div>
              <p className="text-xs text-zinc-300">{securityModal.description}</p>
            </div>

            <form onSubmit={handleExecuteSecurityAction} className="space-y-3">
              <div>
                <label className="text-xs text-white font-semibold uppercase tracking-wider">
                  Administrator Password Required
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Enter administrator password to authorize"
                  value={securityPassword}
                  onChange={e => setSecurityPassword(e.target.value)}
                  className="mt-1.5 erp-input"
                />
              </div>

              {securityError && (
                <div className="p-2.5 rounded-lg bg-rose-950 border border-rose-700 text-xs text-rose-200 font-semibold">
                  {securityError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={securityBusy}
                  className="flex-1 btn-primary py-3 text-xs uppercase disabled:opacity-50"
                >
                  {securityBusy ? 'Verifying...' : 'Authorize & Execute'}
                </button>
                <button
                  type="button"
                  onClick={() => setSecurityModal(null)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MOBILE / TABLET FIXED BOTTOM BAR ==================== */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-black/95 backdrop-blur-xl border-t border-white/10 grid grid-cols-4 py-2 px-1 text-[10px] font-bold">
        <button
          onClick={() => navigateTo({ main: 'dashboard' })}
          className={`flex flex-col items-center gap-1 ${currentNav.main === 'dashboard' ? 'text-amber-400' : 'text-zinc-400'}`}
        >
          <BarChart3 className="w-4 h-4" /> Dashboard
        </button>
        <button
          onClick={() => navigateTo({ main: 'accounts' })}
          className={`flex flex-col items-center gap-1 ${currentNav.main === 'accounts' ? 'text-amber-400' : 'text-zinc-400'}`}
        >
          <Wallet className="w-4 h-4" /> Accounts
        </button>
        <button
          onClick={() => navigateTo({ main: 'inventory' })}
          className={`flex flex-col items-center gap-1 ${currentNav.main === 'inventory' ? 'text-amber-400' : 'text-zinc-400'}`}
        >
          <Package className="w-4 h-4" /> Inventory
        </button>
        <button
          onClick={() => navigateTo({ main: 'directory' })}
          className={`flex flex-col items-center gap-1 ${currentNav.main === 'directory' ? 'text-amber-400' : 'text-zinc-400'}`}
        >
          <Users className="w-4 h-4" /> Parties/Bin
        </button>
      </div>
    </div>
  );
}