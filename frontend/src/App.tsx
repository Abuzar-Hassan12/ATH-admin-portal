import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Package, TrendingUp, ArrowRight, RefreshCw, BarChart3,
  Truck, Lock, LogOut, Plus, Edit3, Trash2, Calendar, ShoppingCart,
  Users, FileText, Wallet, Landmark, Menu, X, CheckCircle2, Clock,
  MapPin, ArrowLeftRight, RotateCcw, AlertOctagon, ChevronLeft,
  ChevronRight, Layers, Star, Droplet, Printer, Download, Share2,
  Search, Eye, Upload, ShieldCheck
} from 'lucide-react';
import type {
  TimePeriod, EntityType, DashboardStats, StorageLocation, Product,
  PartyGroupItem, PreviousSaleRateResponse,
  Customer, Supplier, SaleRecord, PurchaseRecord, Expense,
  FinancialAccount, LoanRecord, AccountHistoryEntry, RecycleBinItem,
  LocationStockItem, SaleDocType, PurchaseDocType, PaymentArrangementType,
  VyaparReportsData, Customer360Profile, Supplier360Profile,
  CustomerOutstandingLedger
} from './types';

const API_BASE = import.meta.env.DEV ? "http://127.0.0.1:8000/api" : "/api";

interface SearchableGroupSelectProps {
  partyType: 'CUSTOMER' | 'SUPPLIER';
  selectedGroupId: number | null;
  selectedGroupName: string;
  onSelectGroup: (group: { id: number | null; name: string; code?: string }) => void;
  allowAllOption?: boolean;
  allOptionLabel?: string;
  placeholder?: string;
}

function SearchableGroupSelect({
  partyType,
  selectedGroupId,
  selectedGroupName,
  onSelectGroup,
  allowAllOption = false,
  allOptionLabel = 'All Customer Groups',
  placeholder = 'Search or select group...'
}: SearchableGroupSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PartyGroupItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const limit = 20;

  const loadGroups = async (searchQ: string, nextOffset: number, append = false) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        q: searchQ,
        party_type: partyType,
        limit: String(limit),
        offset: String(nextOffset)
      });
      const res = await fetch(`${API_BASE}/party-groups?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load groups');
      const data = await res.json();
      const fetched: PartyGroupItem[] = Array.isArray(data.items) ? data.items : [];
      setItems(prev => (append ? [...prev, ...fetched] : fetched));
      setTotal(Number(data.total) || fetched.length);
      setOffset(nextOffset);
    } catch (err: any) {
      setError(err.message || 'Error loading groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      loadGroups(query, 0, false);
    }, 180);
    return () => clearTimeout(timer);
  }, [open, query, partyType]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateNewGroup = async () => {
    const clean = query.trim();
    if (!clean) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/party-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean, party_type: partyType })
      });
      if (!res.ok) throw new Error('Could not create group');
      const data = await res.json();
      if (data.group) {
        onSelectGroup({ id: data.group.id, name: data.group.name, code: data.group.code });
        setQuery('');
        setOpen(false);
      }
    } catch (err: any) {
      setError(err.message || 'Group creation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(items.length - 1, prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(0, prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && items[activeIndex]) {
      e.preventDefault();
      const g = items[activeIndex];
      onSelectGroup({ id: g.id, name: g.name, code: g.code });
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="erp-input flex items-center justify-between text-left font-semibold"
        >
          <span className="truncate">
            {allowAllOption && !selectedGroupId
              ? allOptionLabel
              : selectedGroupName || placeholder}
            {selectedGroupId ? (
              <span className="ml-1.5 text-[10px] font-mono text-yellow-300">
                (ID #{selectedGroupId})
              </span>
            ) : null}
          </span>
          <span className="text-yellow-300 text-xs ml-2">▼</span>
        </button>
        {(selectedGroupId || (!allowAllOption && selectedGroupName)) && (
          <button
            type="button"
            onClick={() =>
              onSelectGroup({
                id: null,
                name: allowAllOption ? 'ALL' : partyType === 'CUSTOMER' ? 'General Market' : 'General Suppliers'
              })
            }
            className="btn-secondary px-2.5 py-2 text-xs"
            title="Clear group selection"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="group-combobox-menu absolute left-0 right-0 mt-1.5 z-50 p-2.5 space-y-2 max-h-80 flex flex-col">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-yellow-400 absolute left-3 top-3" />
            <input
              type="text"
              autoFocus
              placeholder={placeholder}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setActiveIndex(-1);
              }}
              className="erp-input pl-8 py-1.5 text-xs"
            />
          </div>

          <div className="overflow-y-auto flex-1 space-y-1 max-h-52 pr-1">
            {allowAllOption && (
              <button
                type="button"
                onClick={() => {
                  onSelectGroup({ id: null, name: 'ALL' });
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition ${
                  !selectedGroupId ? 'bg-yellow-400 text-slate-950' : 'hover:bg-slate-800 text-white'
                }`}
              >
                <span>{allOptionLabel}</span>
                <span className="text-[10px] font-mono">All Records</span>
              </button>
            )}

            {loading && items.length === 0 && (
              <div className="py-4 text-center text-xs text-slate-300">Searching groups...</div>
            )}

            {!loading && error && (
              <div className="p-2.5 rounded-lg bg-rose-950/90 border border-rose-500 text-xs text-rose-200 flex items-center justify-between">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => loadGroups(query, 0, false)}
                  className="underline font-bold ml-2"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <div className="py-3 px-2 text-center space-y-2">
                <div className="text-xs text-slate-300">No matching group found for "{query}".</div>
                {query.trim() && !allowAllOption && (
                  <button
                    type="button"
                    onClick={handleCreateNewGroup}
                    className="btn-oil px-3 py-1.5 text-xs w-full"
                  >
                    + Create & Select Group "{query.trim()}"
                  </button>
                )}
              </div>
            )}

            {items.map((g, idx) => {
              const isSelected = selectedGroupId === g.id || (!selectedGroupId && selectedGroupName === g.name);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    onSelectGroup({ id: g.id, name: g.name, code: g.code });
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-yellow-400 text-slate-950 font-extrabold'
                      : idx === activeIndex
                      ? 'bg-slate-700 text-white'
                      : 'hover:bg-slate-800 text-white'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-bold">{g.name}</span>
                    {g.city ? <span className="ml-1.5 opacity-80">({g.city})</span> : null}
                    <div className={`text-[10px] font-mono ${isSelected ? 'text-slate-900' : 'text-yellow-300'}`}>
                      {g.code} • ID #{g.id} • {g.members_count ?? 0} Parties
                    </div>
                  </div>
                  <div className="text-right font-mono text-[11px] shrink-0">
                    PKR {pkr(g.total_balance).toLocaleString()}
                  </div>
                </button>
              );
            })}
          </div>

          {items.length < total && (
            <button
              type="button"
              disabled={loading}
              onClick={() => loadGroups(query, offset + limit, true)}
              className="btn-secondary w-full py-1.5 text-[11px]"
            >
              {loading ? 'Loading more...' : `Load More Groups (${items.length} of ${total})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type MainSection = 'dashboard' | 'accounts' | 'inventory' | 'directory' | 'reports';
type AccountsSubTab = 'sales' | 'purchases' | 'partials' | 'expenses' | 'wallets' | 'ledger';
type InventorySubTab = 'stock_breakdown' | 'products_crud' | 'locations_transfer';
type DirectorySubTab = 'parties' | 'recycle';
type ReportsSubTab = 'bill_pnl' | 'item_profit' | 'daybook' | 'groups_backup';

interface NavState {
  main: MainSection;
  accSub: AccountsSubTab;
  invSub: InventorySubTab;
  dirSub: DirectorySubTab;
  repSub: ReportsSubTab;
}

interface CartLineItem {
  product_id: number | null;
  product_name: string;
  company_name: string;
  mark_product_favorite: boolean;
  location_id: number;
  location_name: string;
  unit_type: 'CARTON' | 'BOTTLE';
  quantity: number;
  unit_rate: number;
  units_per_carton: number;
  pack_size: number;
  base_bottles: number;
  cartons: number;
  loose_bottles: number;
  line_total: number;
  new_sale_rate_per_bottle?: number | null;
}

const pkr = (v: number | string | undefined | null): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

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
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 no-print" aria-hidden="true">
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
    { main: 'dashboard', accSub: 'sales', invSub: 'stock_breakdown', dirSub: 'parties', repSub: 'bill_pnl' }
  ]);
  const [navIndex, setNavIndex] = useState<number>(0);
  const currentNav = navHistory[navIndex] || navHistory[0];

  const navigateTo = (partial: Partial<NavState>) => {
    const nextState: NavState = { ...currentNav, ...partial };
    if (
      nextState.main === currentNav.main &&
      nextState.accSub === currentNav.accSub &&
      nextState.invSub === currentNav.invSub &&
      nextState.dirSub === currentNav.dirSub &&
      nextState.repSub === currentNav.repSub
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
  const handleBack = () => { if (canGoBack) setNavIndex(navIndex - 1); };
  const handleForward = () => { if (canGoForward) setNavIndex(navIndex + 1); };

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [period, setPeriod] = useState<TimePeriod>('monthly');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);
  const initialSyncDone = useRef<boolean>(false);

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
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [accountHistory, setAccountHistory] = useState<AccountHistoryEntry[]>([]);
  const [recycleBin, setRecycleBin] = useState<RecycleBinItem[]>([]);
  const [vyaparReports, setVyaparReports] = useState<VyaparReportsData | null>(null);

  // ==================== SALE FORM & MULTI-ITEM CART STATE ====================
  const [saleDocType, setSaleDocType] = useState<SaleDocType>('SALE');
  const [saleCustomerId, setSaleCustomerId] = useState<number>(0);
  const [saleCustomerName, setSaleCustomerName] = useState<string>('');
  const [saleCustomerCity, setSaleCustomerCity] = useState<string>('');
  const [saleCustomerPhone, setSaleCustomerPhone] = useState<string>('');
  const [saleCustomerCnic, setSaleCustomerCnic] = useState<string>('');
  const [saleCustomerGroupId, setSaleCustomerGroupId] = useState<number | null>(null);
  const [saleCustomerGroup, setSaleCustomerGroup] = useState<string>('General Market');
  const [saleMarkFav, setSaleMarkFav] = useState<boolean>(false);

  const [saleProductId, setSaleProductId] = useState<number>(0);
  const [saleProductName, setSaleProductName] = useState<string>('');
  const [saleCompanyName, setSaleCompanyName] = useState<string>('');
  const [saleProdFav, setSaleProdFav] = useState<boolean>(false);
  const [saleLocationId, setSaleLocationId] = useState<number>(1);
  const [saleUnitType, setSaleUnitType] = useState<'CARTON' | 'BOTTLE'>('CARTON');
  const [salePackSize, setSalePackSize] = useState<string>('700');
  const [saleCartonSize, setSaleCartonSize] = useState<string>('12');
  const [saleQuantity, setSaleQuantity] = useState<string>('');
  const [saleRate, setSaleRate] = useState<string>('');
  const [saleCart, setSaleCart] = useState<CartLineItem[]>([]);

  // Historical Previous Sale Rate Reference (Never overwrites user input automatically)
  const [previousRateRef, setPreviousRateRef] = useState<PreviousSaleRateResponse | null>(null);
  const [previousRateLoading, setPreviousRateLoading] = useState<boolean>(false);

  // Sales Register Filter States
  const [salesRegisterDocFilter, setSalesRegisterDocFilter] = useState<'ALL' | SaleDocType>('ALL');
  const [salesRegisterSearch, setSalesRegisterSearch] = useState<string>('');
  const [salesRegisterLocationId, setSalesRegisterLocationId] = useState<number>(0);

  const [saleDiscount, setSaleDiscount] = useState<string>('');
  const [saleFreight, setSaleFreight] = useState<string>('');
  const [saleIncludePrevDues, setSaleIncludePrevDues] = useState<boolean>(false);
  const [salePaymentMode, setSalePaymentMode] = useState<'UNPAID' | 'PARTIAL' | 'PAID'>('UNPAID');
  const [saleReceived, setSaleReceived] = useState<string>('');
  const [saleAccountId, setSaleAccountId] = useState<number>(1);
  const [saleMethod, setSaleMethod] = useState<string>('CASH');
  const [saleRemarks, setSaleRemarks] = useState<string>('');

  // ==================== PURCHASE FORM & MULTI-ITEM CART STATE ====================
  const [purDocType, setPurDocType] = useState<PurchaseDocType>('PURCHASE');
  const [purSupplierId, setPurSupplierId] = useState<number>(0);
  const [purSupplierName, setPurSupplierName] = useState<string>('');
  const [purSupplierCity, setPurSupplierCity] = useState<string>('');
  const [purSupplierPhone, setPurSupplierPhone] = useState<string>('');
  const [purSupplierCnic, setPurSupplierCnic] = useState<string>('');
  const [purSupplierGroupId, setPurSupplierGroupId] = useState<number | null>(null);
  const [purSupplierGroup, setPurSupplierGroup] = useState<string>('General Suppliers');
  const [purMarkFav, setPurMarkFav] = useState<boolean>(false);

  const [purProductId, setPurProductId] = useState<number>(0);
  const [purProductName, setPurProductName] = useState<string>('');
  const [purCompanyName, setPurCompanyName] = useState<string>('');
  const [purProdFav, setPurProdFav] = useState<boolean>(false);
  const [purLocationId, setPurLocationId] = useState<number>(2);
  const [purUnitType, setPurUnitType] = useState<'CARTON' | 'BOTTLE'>('CARTON');
  const [purPackSize, setPurPackSize] = useState<string>('700');
  const [purCartonSize, setPurCartonSize] = useState<string>('12');
  const [purQuantity, setPurQuantity] = useState<string>('');
  const [purRate, setPurRate] = useState<string>('');
  const [purNewSaleRatePerBottle, setPurNewSaleRatePerBottle] = useState<string>('');
  const [purCart, setPurCart] = useState<CartLineItem[]>([]);

  const [purDiscount, setPurDiscount] = useState<string>('');
  const [purFreight, setPurFreight] = useState<string>('');
  const [purPaymentMode, setPurPaymentMode] = useState<'UNPAID' | 'PARTIAL' | 'PAID'>('UNPAID');
  const [purPaid, setPurPaid] = useState<string>('');
  const [purAccountId, setPurAccountId] = useState<number>(1);
  const [purMethod, setPurMethod] = useState<string>('CASH');
  const [purArrangement, setPurArrangement] = useState<PaymentArrangementType>('WALLET');
  const [purLenderName, setPurLenderName] = useState<string>('');
  const [purRemarks, setPurRemarks] = useState<string>('');

  // ==================== INVENTORY, EXPENSE, PARTY & WALLET STATES ====================
  const [setStockProdId, setSetStockProdId] = useState<number>(1);
  const [setStockLocId, setSetStockLocId] = useState<number>(1);
  const [setStockBottles, setSetStockBottles] = useState<string>('');
  const [directPackSize, setDirectPackSize] = useState<string>('700');
  const [directCartonMax, setDirectCartonMax] = useState<string>('12');

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [prodSku, setProdSku] = useState<string>('');
  const [prodName, setProdName] = useState<string>('');
  const [prodCompanyName, setProdCompanyName] = useState<string>('ATH Oils');
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

  const [expCategory, setExpCategory] = useState<string>('Fuel');
  const [expDesc, setExpDesc] = useState<string>('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expAccountId, setExpAccountId] = useState<number>(1);
  const [expMethod, setExpMethod] = useState<string>('CASH');
  const [expArrangement, setExpArrangement] = useState<PaymentArrangementType>('WALLET');
  const [expLenderName, setExpLenderName] = useState<string>('');
  const [expPaidTo, setExpPaidTo] = useState<string>('');

  const [partySearch, setPartySearch] = useState<string>('');
  const [selectedCustomerGroupIdFilter, setSelectedCustomerGroupIdFilter] = useState<number | null>(null);
  const [selectedCustomerGroupFilter, setSelectedCustomerGroupFilter] = useState<string>('ALL');

  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [cusName, setCusName] = useState<string>('');
  const [cusPhone, setCusPhone] = useState<string>('');
  const [cusCnic, setCusCnic] = useState<string>('');
  const [cusGroupId, setCusGroupId] = useState<number | null>(null);
  const [cusGroup, setCusGroup] = useState<string>('General Market');
  const [cusCity, setCusCity] = useState<string>('');
  const [cusCreditLimit, setCusCreditLimit] = useState<string>('50000');
  const [cusReceivable, setCusReceivable] = useState<string>('');
  const [cusIsFavorite, setCusIsFavorite] = useState<boolean>(false);

  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [supName, setSupName] = useState<string>('');
  const [supPhone, setSupPhone] = useState<string>('');
  const [supCnic, setSupCnic] = useState<string>('');
  const [supGroupId, setSupGroupId] = useState<number | null>(null);
  const [supGroup, setSupGroup] = useState<string>('General Suppliers');
  const [supCity, setSupCity] = useState<string>('');
  const [supPayable, setSupPayable] = useState<string>('');
  const [supIsFavorite, setSupIsFavorite] = useState<boolean>(false);
  const [prodIsFavorite, setProdIsFavorite] = useState<boolean>(false);

  // ==================== CUSTOMER OUTSTANDING LEDGER & PAYMENT ALLOCATION MODAL STATES ====================
  const [allocationLedgerModal, setAllocationLedgerModal] = useState<CustomerOutstandingLedger | null>(null);
  const [allocationPaymentInput, setAllocationPaymentInput] = useState<string>('');
  const [allocationPolicy, setAllocationPolicy] = useState<'OLDEST_FIRST' | 'NEWEST_FIRST'>('OLDEST_FIRST');
  const [allocationDraftMap, setAllocationDraftMap] = useState<Record<number, number>>({});
  const [allocationAccountId, setAllocationAccountId] = useState<number>(1);
  const [allocationMethod, setAllocationMethod] = useState<string>('CASH');
  const [allocationExcessAction, setAllocationExcessAction] = useState<'NONE' | 'ADVANCE_CREDIT'>('NONE');
  const [allocationRemarks, setAllocationRemarks] = useState<string>('');
  const [allocationConfirming, setAllocationConfirming] = useState<boolean>(false);
  const [allocationBusy, setAllocationBusy] = useState<boolean>(false);
  const [allocationError, setAllocationError] = useState<string>('');
  const [allocationIdempotencyKey, setAllocationIdempotencyKey] = useState<string>('');

  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [accName, setAccName] = useState<string>('');
  const [accType, setAccType] = useState<string>('CASH');
  const [accNumber, setAccNumber] = useState<string>('');
  const [accBalance, setAccBalance] = useState<string>('');

  const [adjAccountId, setAdjAccountId] = useState<number>(1);
  const [adjOperation, setAdjOperation] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [adjAmount, setAdjAmount] = useState<string>('');
  const [adjRemarks, setAdjRemarks] = useState<string>('');

  const [trfFromAccId, setTrfFromAccId] = useState<number>(4);
  const [trfToAccId, setTrfToAccId] = useState<number>(3);
  const [trfAccAmount, setTrfAccAmount] = useState<string>('');
  const [trfAccRemarks, setTrfAccRemarks] = useState<string>('');

  // ==================== MODALS (INVOICE, 360 PROFILE, PARTIAL, LOAN, SECURITY) ====================
  const [invoiceModal, setInvoiceModal] = useState<{
    kind: 'SALE' | 'PURCHASE';
    sale?: SaleRecord;
    purchase?: PurchaseRecord;
  } | null>(null);

  const [customerProfileModal, setCustomerProfileModal] = useState<Customer360Profile | null>(null);
  const [supplierProfileModal, setSupplierProfileModal] = useState<Supplier360Profile | null>(null);
  const [profileTab, setProfileTab] = useState<'invoices' | 'items' | 'payments'>('invoices');

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
  const [partialAccountId, setPartialAccountId] = useState<number>(1);
  const [partialMethod, setPartialMethod] = useState<string>('CASH');
  const [partialArrangement, setPartialArrangement] = useState<PaymentArrangementType>('WALLET');
  const [partialLenderName, setPartialLenderName] = useState<string>('');
  const [partialRemarks, setPartialRemarks] = useState<string>('');

  const [loanRepayModal, setLoanRepayModal] = useState<LoanRecord | null>(null);
  const [loanRepayAmount, setLoanRepayAmount] = useState<string>('');
  const [loanRepayAccId, setLoanRepayAccId] = useState<number>(1);
  const [loanRepayRemarks, setLoanRepayRemarks] = useState<string>('');

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
    setTimeout(() => setToast(null), 5500);
  };

  // ==================== SNAPSHOT & FAST SYNC ENGINE ====================
  const getSavedSnapshot = () => {
    try {
      const raw = localStorage.getItem('ath_erp_snapshot');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveSnapshot = (snap: any) => {
    if (snap && typeof snap === 'object' && snap.version) {
      try {
        localStorage.setItem('ath_erp_snapshot', JSON.stringify(snap));
      } catch {
        // Ignore storage quota limits
      }
    }
  };

  const apiSend = async (endpoint: string, method: 'POST' | 'PUT', payload: Record<string, any>) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        client_snapshot: !initialSyncDone.current ? getSavedSnapshot() : null
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Operation failed');
    }
    if (data.snapshot) {
      saveSnapshot(data.snapshot);
      initialSyncDone.current = true;
    }
    return data;
  };

  const fetchData = async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          channel: channelFilter,
          client_snapshot: !initialSyncDone.current ? getSavedSnapshot() : null
        })
      });
      if (!res.ok) throw new Error('Bootstrap sync failed');
      const data = await res.json();
      if (data.snapshot) {
        saveSnapshot(data.snapshot);
        initialSyncDone.current = true;
      }

      if (data.stats) setStats(data.stats);
      const locData: StorageLocation[] = Array.isArray(data.locations) ? data.locations : [];
      setLocations(locData);
      if (locData.length > 0) {
        const disp = locData.find(l => l.location_type === 'DISPLAY') || locData[0];
        const wh = locData.find(l => l.location_type === 'WAREHOUSE') || locData[0];
        setSaleLocationId(prev => (locData.some(l => l.id === prev) ? prev : disp.id));
        setPurLocationId(prev => (locData.some(l => l.id === prev) ? prev : wh.id));
        setProdInitialLocId(prev => (locData.some(l => l.id === prev) ? prev : wh.id));
        setSetStockLocId(prev => (locData.some(l => l.id === prev) ? prev : disp.id));
      }

      setProducts(Array.isArray(data.products) ? data.products : []);
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
      setSales(Array.isArray(data.sales) ? data.sales : []);
      setPurchases(Array.isArray(data.purchases) ? data.purchases : []);
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);

      const accList: FinancialAccount[] = Array.isArray(data.accounts) ? data.accounts : [];
      setAccounts(accList);
      if (accList.length > 0) {
        setAdjAccountId(prev => (accList.some(a => a.id === prev) ? prev : accList[0].id));
        setSaleAccountId(prev => (accList.some(a => a.id === prev) ? prev : accList[0].id));
        setPurAccountId(prev => (accList.some(a => a.id === prev) ? prev : accList[0].id));
        setExpAccountId(prev => (accList.some(a => a.id === prev) ? prev : accList[0].id));
        setPartialAccountId(prev => (accList.some(a => a.id === prev) ? prev : accList[0].id));
        setLoanRepayAccId(prev => (accList.some(a => a.id === prev) ? prev : accList[0].id));
      }

      setLoans(Array.isArray(data.loans) ? data.loans : []);
      setAccountHistory(Array.isArray(data.account_history) ? data.account_history : []);
      setRecycleBin(Array.isArray(data.recycle_bin) ? data.recycle_bin : []);
      if (data.vyapar_reports) setVyaparReports(data.vyapar_reports);
    } catch (err) {
      console.error('Error syncing with backend:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAuthenticated, period, channelFilter]);

  // ==================== ENRICHED LOCATIONS ====================
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

  // ==================== CUSTOMER & PRODUCT INTELLIGENCE ====================
  const favoriteCustomers = useMemo(() => customers.filter(c => c.is_favorite), [customers]);
  const favoriteSuppliers = useMemo(() => suppliers.filter(s => s.is_favorite), [suppliers]);
  const favoriteProducts = useMemo(() => products.filter(p => p.is_favorite !== false), [products]);

  const activeSaleCustomer = useMemo(() => {
    if (saleCustomerId) return customers.find(c => c.id === Number(saleCustomerId)) || null;
    if (saleCustomerName.trim()) {
      return customers.find(c => c.name.toLowerCase() === saleCustomerName.trim().toLowerCase()) || null;
    }
    return null;
  }, [customers, saleCustomerId, saleCustomerName]);

  const selectedSaleProduct = useMemo(() => {
    if (saleProductId) return products.find(p => p.id === Number(saleProductId)) || null;
    if (saleProductName.trim()) {
      const clean = saleProductName.trim().toLowerCase();
      const targetSize = Number(salePackSize) || 700;
      return (
        products.find(p => p.name.toLowerCase() === clean && Math.abs((p.pack_size_num || 700) - targetSize) < 1) ||
        products.find(p => p.name.toLowerCase() === clean) ||
        null
      );
    }
    return null;
  }, [products, saleProductId, saleProductName, salePackSize]);

  // Fetch authoritative historical sale rate for (activeSaleCustomer.id, selectedSaleProduct.id)
  // without ever overwriting manually entered current saleRate.
  useEffect(() => {
    if (!activeSaleCustomer?.id || !selectedSaleProduct?.id) {
      setPreviousRateRef(null);
      setPreviousRateLoading(false);
      return;
    }
    let cancelled = false;
    const fetchPrevRate = async () => {
      try {
        setPreviousRateLoading(true);
        const params = new URLSearchParams({
          product_id: String(selectedSaleProduct.id),
          unit_type: saleUnitType
        });
        const res = await fetch(`${API_BASE}/customers/${activeSaleCustomer.id}/previous-rate?${params.toString()}`);
        if (!res.ok) throw new Error('Could not fetch previous rate');
        const data: PreviousSaleRateResponse = await res.json();
        if (!cancelled) setPreviousRateRef(data);
      } catch {
        if (!cancelled) setPreviousRateRef(null);
      } finally {
        if (!cancelled) setPreviousRateLoading(false);
      }
    };
    fetchPrevRate();
    return () => {
      cancelled = true;
    };
  }, [activeSaleCustomer?.id, selectedSaleProduct?.id, saleUnitType]);

  const handleSelectSaleCustomer = (c: Customer) => {
    setSaleCustomerId(c.id);
    setSaleCustomerName(c.name);
    setSaleCustomerCity(c.city || 'Local');
    setSaleCustomerPhone(c.phone || '');
    setSaleCustomerCnic(c.cnic || '');
    setSaleCustomerGroupId(c.group_id ?? null);
    setSaleCustomerGroup(c.group_name || 'General Market');
    setSaleMarkFav(Boolean(c.is_favorite));
  };

  const handleSelectSaleProduct = (id: number) => {
    setSaleProductId(id);
    const p = products.find(x => x.id === id);
    if (p) {
      setSaleProductName(p.name);
      setSaleCompanyName(p.brand_name || 'ATH Oils');
      setSalePackSize(String(p.pack_size_num || 700));
      setSaleCartonSize(String(p.units_per_carton || 12));
      setSaleProdFav(Boolean(p.is_favorite));

      // Only populate default catalog rate if the user has not manually entered a rate yet.
      // Never auto-overwrite with customer historical rate; user applies it explicitly via "Use Previous Rate".
      setSaleRate(prev => {
        if (prev.trim() !== '') return prev;
        if (saleUnitType === 'CARTON' && p.carton_sale_rate > 0) return String(pkr(p.carton_sale_rate));
        if (saleUnitType === 'BOTTLE' && p.sale_rate > 0) return String(pkr(p.sale_rate));
        return prev;
      });
    }
  };

  const handleApplyPreviousSaleRate = () => {
    if (previousRateRef && previousRateRef.found && previousRateRef.applicable_rate !== undefined) {
      setSaleRate(String(pkr(previousRateRef.applicable_rate)));
      notify(
        `Applied previous sale rate of PKR ${pkr(previousRateRef.applicable_rate).toLocaleString()} per ${saleUnitType} (from ${previousRateRef.invoice_number}).`
      );
    }
  };

  const handleSelectPurProduct = (id: number) => {
    setPurProductId(id);
    const p = products.find(x => x.id === id);
    if (p) {
      setPurProductName(p.name);
      setPurCompanyName(p.brand_name || 'ATH Oils');
      setPurPackSize(String(p.pack_size_num || 700));
      setPurCartonSize(String(p.units_per_carton || 12));
      setPurProdFav(Boolean(p.is_favorite));
      if (purUnitType === 'CARTON' && p.carton_purchase_rate > 0) {
        setPurRate(String(pkr(p.carton_purchase_rate)));
      } else if (purUnitType === 'BOTTLE' && p.purchase_rate > 0) {
        setPurRate(String(pkr(p.purchase_rate)));
      }
    }
  };

  // ==================== EXACT WHOLE-PKR CART & BILLING FORMULAS ====================
  const saleUpc = Math.max(1, Math.round(Number(saleCartonSize) || 12));
  const saleQtyNum = Number(saleQuantity) || 0;
  const saleDraftBottles = saleUnitType === 'CARTON' ? Math.round(saleQtyNum * saleUpc) : Math.round(saleQtyNum);
  const saleDraftCartons = Math.floor(saleDraftBottles / saleUpc);
  const saleDraftLoose = saleDraftBottles % saleUpc;
  const saleDraftLineTotal = pkr(saleQtyNum * (Number(saleRate) || 0));

  const effectiveSaleSubtotal = useMemo(() => {
    const cartSum = saleCart.reduce((acc, it) => acc + pkr(it.line_total), 0);
    return pkr(cartSum + (saleQtyNum > 0 && Number(saleRate) >= 0 ? saleDraftLineTotal : 0));
  }, [saleCart, saleQtyNum, saleRate, saleDraftLineTotal]);

  const computedSaleTotal = useMemo(() => {
    return pkr(Math.max(0, effectiveSaleSubtotal - pkr(saleDiscount) + pkr(saleFreight)));
  }, [effectiveSaleSubtotal, saleDiscount, saleFreight]);

  const customerPreviousDues = pkr(activeSaleCustomer?.current_receivable || 0);
  const computedSaleGrandPayable = useMemo(() => {
    if (saleDocType !== 'SALE') return computedSaleTotal;
    return pkr(computedSaleTotal + (saleIncludePrevDues ? customerPreviousDues : 0));
  }, [computedSaleTotal, saleIncludePrevDues, customerPreviousDues, saleDocType]);

  const computedSaleReceived = useMemo(() => {
    if (saleDocType === 'ESTIMATE') return 0;
    if (salePaymentMode === 'UNPAID') return 0;
    if (salePaymentMode === 'PAID') return computedSaleGrandPayable;
    return pkr(saleReceived);
  }, [saleDocType, salePaymentMode, computedSaleGrandPayable, saleReceived]);

  const computedAppliedToPrev = useMemo(() => {
    if (saleDocType !== 'SALE' || computedSaleReceived <= computedSaleTotal) return 0;
    return pkr(Math.min(customerPreviousDues, computedSaleReceived - computedSaleTotal));
  }, [saleDocType, computedSaleReceived, computedSaleTotal, customerPreviousDues]);

  const computedClosingKhata = useMemo(() => {
    if (saleDocType === 'ESTIMATE') return customerPreviousDues;
    if (saleDocType === 'SALE_RETURN') {
      const unpaidRet = Math.max(0, computedSaleTotal - computedSaleReceived);
      return pkr(Math.max(0, customerPreviousDues - unpaidRet));
    }
    const newBillUnpaid = Math.max(0, computedSaleTotal - Math.min(computedSaleTotal, computedSaleReceived));
    return pkr(Math.max(0, customerPreviousDues + newBillUnpaid - computedAppliedToPrev));
  }, [saleDocType, customerPreviousDues, computedSaleTotal, computedSaleReceived, computedAppliedToPrev]);

  const purUpc = Math.max(1, Math.round(Number(purCartonSize) || 12));
  const purQtyNum = Number(purQuantity) || 0;
  const purDraftBottles = purUnitType === 'CARTON' ? Math.round(purQtyNum * purUpc) : Math.round(purQtyNum);
  const purDraftCartons = Math.floor(purDraftBottles / purUpc);
  const purDraftLoose = purDraftBottles % purUpc;
  const purDraftLineTotal = pkr(purQtyNum * (Number(purRate) || 0));

  const effectivePurSubtotal = useMemo(() => {
    const cartSum = purCart.reduce((acc, it) => acc + pkr(it.line_total), 0);
    return pkr(cartSum + (purQtyNum > 0 && Number(purRate) >= 0 ? purDraftLineTotal : 0));
  }, [purCart, purQtyNum, purRate, purDraftLineTotal]);

  const computedPurTotal = useMemo(() => {
    return pkr(Math.max(0, effectivePurSubtotal - pkr(purDiscount) + pkr(purFreight)));
  }, [effectivePurSubtotal, purDiscount, purFreight]);

  const computedPurPaid = useMemo(() => {
    if (purPaymentMode === 'UNPAID') return 0;
    if (purPaymentMode === 'PAID') return computedPurTotal;
    return pkr(purPaid);
  }, [purPaymentMode, computedPurTotal, purPaid]);

  const selectedPurAccount = useMemo(
    () => accounts.find(a => a.id === Number(purAccountId)) || accounts[0] || null,
    [accounts, purAccountId]
  );

  const isPurWalletInsufficient =
    purDocType === 'PURCHASE' &&
    computedPurPaid > 0 &&
    purArrangement === 'WALLET' &&
    selectedPurAccount &&
    pkr(selectedPurAccount.current_balance) < computedPurPaid;

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
    saleDocType === 'SALE' &&
    saleCart.length === 0 &&
    (!selectedSaleProduct ||
      saleLocAvailableBottles <= 0 ||
      (saleDraftBottles > 0 && saleDraftBottles > saleLocAvailableBottles));

  const selectedPurchaseProduct = useMemo(() => {
    if (purProductId) return products.find(p => p.id === Number(purProductId)) || null;
    if (purProductName.trim()) {
      return products.find(p => p.name.toLowerCase() === purProductName.trim().toLowerCase()) || null;
    }
    return null;
  }, [products, purProductId, purProductName]);

  const directStockNum = Math.max(0, Math.round(Number(setStockBottles) || 0));
  const directCartonMaxNum = Math.max(1, Math.round(Number(directCartonMax) || 12));
  const directPreviewCartons = Math.floor(directStockNum / directCartonMaxNum);
  const directPreviewLoose = directStockNum % directCartonMaxNum;

  // ==================== ADD ITEMS TO MULTI-ITEM CART ====================
  const handleAddSaleItemToCart = () => {
    if (!saleProductName.trim() && !saleProductId) {
      notify('Please select or type a Product name.', true);
      return;
    }
    if (!saleQuantity || Number(saleQuantity) <= 0 || saleRate === '') {
      notify('Please enter valid Quantity and Rate.', true);
      return;
    }
    if (saleDocType === 'SALE' && selectedSaleProduct && saleDraftBottles > saleLocAvailableBottles) {
      notify(`Not enough stock in ${selectedSaleLocName} (Available: ${saleLocAvailableBottles} Btls).`, true);
      return;
    }
    const locObj = locations.find(l => l.id === Number(saleLocationId));
    const newItem: CartLineItem = {
      product_id: saleProductId || null,
      product_name: saleProductName.trim(),
      company_name: saleCompanyName.trim() || 'ATH Oils',
      mark_product_favorite: saleProdFav,
      location_id: Number(saleLocationId),
      location_name: locObj ? locObj.name : 'Shop Display',
      unit_type: saleUnitType,
      quantity: Number(saleQuantity),
      unit_rate: pkr(saleRate),
      units_per_carton: saleUpc,
      pack_size: Number(salePackSize) || 700,
      base_bottles: saleDraftBottles,
      cartons: saleDraftCartons,
      loose_bottles: saleDraftLoose,
      line_total: saleDraftLineTotal
    };
    setSaleCart(prev => [...prev, newItem]);
    setSaleProductId(0);
    setSaleProductName('');
    setSaleQuantity('');
    setSaleRate('');
  };

  const handleAddPurItemToCart = () => {
    if (!purProductName.trim() && !purProductId) {
      notify('Please select or type a Product name.', true);
      return;
    }
    if (!purQuantity || Number(purQuantity) <= 0 || purRate === '') {
      notify('Please enter valid Purchase Quantity and Rate.', true);
      return;
    }
    const locObj = locations.find(l => l.id === Number(purLocationId));
    const newItem: CartLineItem = {
      product_id: purProductId || null,
      product_name: purProductName.trim(),
      company_name: purCompanyName.trim() || 'ATH Oils',
      mark_product_favorite: purProdFav,
      location_id: Number(purLocationId),
      location_name: locObj ? locObj.name : 'Main Warehouse',
      unit_type: purUnitType,
      quantity: Number(purQuantity),
      unit_rate: pkr(purRate),
      units_per_carton: purUpc,
      pack_size: Number(purPackSize) || 700,
      base_bottles: purDraftBottles,
      cartons: purDraftCartons,
      loose_bottles: purDraftLoose,
      line_total: purDraftLineTotal,
      new_sale_rate_per_bottle: purNewSaleRatePerBottle ? pkr(purNewSaleRatePerBottle) : null
    };
    setPurCart(prev => [...prev, newItem]);
    setPurProductId(0);
    setPurProductName('');
    setPurQuantity('');
    setPurRate('');
    setPurNewSaleRatePerBottle('');
  };

  // ==================== LOGIN & LOGOUT ====================
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser.trim(), password: loginPass })
      });
      if (!res.ok) throw new Error('Invalid administrator username or password.');
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

  // ==================== FAVORITE TOGGLES ====================
  const toggleCustomerFavorite = async (c: Customer) => {
    await apiSend(`/customers/${c.id}`, 'PUT', { is_favorite: !c.is_favorite });
    notify(`${c.name} ${!c.is_favorite ? 'added to' : 'removed from'} Favorites!`);
    fetchData();
  };

  const toggleSupplierFavorite = async (s: Supplier) => {
    await apiSend(`/suppliers/${s.id}`, 'PUT', { is_favorite: !s.is_favorite });
    notify(`${s.name} ${!s.is_favorite ? 'added to' : 'removed from'} Favorites!`);
    fetchData();
  };

  // ==================== CREATE SALE & PURCHASE HANDLERS ====================
  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleCustomerName.trim() && !saleCustomerId) {
      notify('Please type a Customer / Dealership name or select a saved customer.', true);
      return;
    }

    const finalItems: CartLineItem[] = [...saleCart];
    if (saleQuantity && Number(saleQuantity) > 0 && saleRate !== '' && (saleProductName.trim() || saleProductId)) {
      const locObj = locations.find(l => l.id === Number(saleLocationId));
      finalItems.push({
        product_id: saleProductId || null,
        product_name: saleProductName.trim(),
        company_name: saleCompanyName.trim() || 'ATH Oils',
        mark_product_favorite: saleProdFav,
        location_id: Number(saleLocationId),
        location_name: locObj ? locObj.name : 'Shop Display',
        unit_type: saleUnitType,
        quantity: Number(saleQuantity),
        unit_rate: pkr(saleRate),
        units_per_carton: saleUpc,
        pack_size: Number(salePackSize) || 700,
        base_bottles: saleDraftBottles,
        cartons: saleDraftCartons,
        loose_bottles: saleDraftLoose,
        line_total: saleDraftLineTotal
      });
    }

    if (finalItems.length === 0) {
      notify('Please enter a Product, Quantity, and Rate (or add items to the bill).', true);
      return;
    }

    // Cap direct invoice collection at the current invoice total; multi-bill settlements use the dedicated Allocation Modal
    const directBillReceived =
      saleDocType === 'ESTIMATE'
        ? 0
        : salePaymentMode === 'UNPAID'
        ? 0
        : salePaymentMode === 'PAID'
        ? computedSaleTotal
        : Math.min(computedSaleTotal, pkr(saleReceived));

    const selAcc = accounts.find(a => a.id === Number(saleAccountId));
    try {
      const data = await apiSend('/sales', 'POST', {
        doc_type: saleDocType,
        customer_id: saleCustomerId || null,
        customer_name: saleCustomerName.trim(),
        customer_city: saleCustomerCity.trim() || 'Local',
        customer_phone: saleCustomerPhone.trim() || null,
        customer_cnic: saleCustomerCnic.trim() || null,
        customer_group_id: saleCustomerGroupId,
        customer_group: saleCustomerGroup.trim() || 'General Market',
        mark_favorite: saleMarkFav ? true : null,
        items: finalItems.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name,
          company_name: it.company_name,
          mark_product_favorite: it.mark_product_favorite ? true : null,
          location_id: it.location_id,
          unit_type: it.unit_type,
          quantity: it.quantity,
          unit_rate: it.unit_rate,
          units_per_carton: it.units_per_carton,
          pack_size: it.pack_size
        })),
        discount_amount: pkr(saleDiscount),
        freight_amount: pkr(saleFreight),
        include_previous_dues: saleIncludePrevDues,
        received_amount: directBillReceived,
        account_id: Number(saleAccountId) || null,
        payment_method: selAcc ? selAcc.type : saleMethod,
        remarks: saleRemarks
      });

      notify(`${saleDocType} ${data.invoice_number} posted successfully!`);
      setSaleDocType('SALE');
      setSaleCart([]);
      setSaleCustomerId(0);
      setSaleCustomerName('');
      setSaleCustomerCity('');
      setSaleCustomerPhone('');
      setSaleCustomerCnic('');
      setSaleMarkFav(false);
      setSaleProdFav(false);
      setSaleQuantity('');
      setSaleRate('');
      setSaleDiscount('');
      setSaleFreight('');
      setSaleReceived('');
      setSalePaymentMode('UNPAID');
      setSaleRemarks('');
      await fetchData();

      if (data.sale) {
        setInvoiceModal({ kind: 'SALE', sale: data.sale });
      }
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleConvertEstimate = async (saleId: number) => {
    try {
      const data = await apiSend(`/sales/${saleId}/convert-estimate`, 'POST', {});
      notify(data.message);
      await fetchData();
      if (data.sale) setInvoiceModal({ kind: 'SALE', sale: data.sale });
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

    const finalItems: CartLineItem[] = [...purCart];
    if (purQuantity && Number(purQuantity) > 0 && purRate !== '' && (purProductName.trim() || purProductId)) {
      const locObj = locations.find(l => l.id === Number(purLocationId));
      finalItems.push({
        product_id: purProductId || null,
        product_name: purProductName.trim(),
        company_name: purCompanyName.trim() || 'ATH Oils',
        mark_product_favorite: purProdFav,
        location_id: Number(purLocationId),
        location_name: locObj ? locObj.name : 'Main Warehouse',
        unit_type: purUnitType,
        quantity: Number(purQuantity),
        unit_rate: pkr(purRate),
        units_per_carton: purUpc,
        pack_size: Number(purPackSize) || 700,
        base_bottles: purDraftBottles,
        cartons: purDraftCartons,
        loose_bottles: purDraftLoose,
        line_total: purDraftLineTotal,
        new_sale_rate_per_bottle: purNewSaleRatePerBottle ? pkr(purNewSaleRatePerBottle) : null
      });
    }

    if (finalItems.length === 0) {
      notify('Please enter a Product, Quantity, and Rate (or add items to the purchase bill).', true);
      return;
    }

    const selAcc = accounts.find(a => a.id === Number(purAccountId));
    try {
      const data = await apiSend('/purchases', 'POST', {
        doc_type: purDocType,
        supplier_id: purSupplierId || null,
        supplier_name: purSupplierName.trim(),
        supplier_city: purSupplierCity.trim() || 'Local',
        supplier_phone: purSupplierPhone.trim() || null,
        supplier_cnic: purSupplierCnic.trim() || null,
        supplier_group_id: purSupplierGroupId,
        supplier_group: purSupplierGroup.trim() || 'General Suppliers',
        mark_favorite: purMarkFav ? true : null,
        items: finalItems.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name,
          company_name: it.company_name,
          mark_product_favorite: it.mark_product_favorite ? true : null,
          location_id: it.location_id,
          unit_type: it.unit_type,
          quantity: it.quantity,
          unit_rate: it.unit_rate,
          units_per_carton: it.units_per_carton,
          pack_size: it.pack_size,
          new_sale_rate_per_bottle: it.new_sale_rate_per_bottle
        })),
        discount_amount: pkr(purDiscount),
        freight_amount: pkr(purFreight),
        paid_amount: computedPurPaid,
        account_id: Number(purAccountId) || null,
        payment_method: selAcc ? selAcc.type : purMethod,
        payment_arrangement: purArrangement,
        lender_name: purLenderName.trim() || null,
        remarks: purRemarks
      });

      notify(`Purchase Bill ${data.purchase_number} recorded!`);
      setPurCart([]);
      setPurSupplierId(0);
      setPurSupplierName('');
      setPurSupplierCity('');
      setPurSupplierPhone('');
      setPurSupplierCnic('');
      setPurQuantity('');
      setPurRate('');
      setPurNewSaleRatePerBottle('');
      setPurDiscount('');
      setPurFreight('');
      setPurPaid('');
      setPurPaymentMode('UNPAID');
      setPurArrangement('WALLET');
      setPurLenderName('');
      setPurRemarks('');
      await fetchData();

      if (data.purchase) {
        setInvoiceModal({ kind: 'PURCHASE', purchase: data.purchase });
      }
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // ==================== OTHER CRUD & TRANSACTION HANDLERS ====================
  const handleSetLocationStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setStockBottles === '') return;
    try {
      const data = await apiSend('/inventory/set-location-stock', 'POST', {
        product_id: Number(setStockProdId),
        location_id: Number(setStockLocId),
        stock_bottles: directStockNum,
        pack_size: Number(directPackSize) || 700,
        units_per_carton: directCartonMaxNum
      });
      notify(data.message);
      setSetStockBottles('');
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleRecordPartialPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialModal || !partialAmount || Number(partialAmount) <= 0) return;
    const endpoint =
      partialModal.kind === 'SALE'
        ? `/sales/${partialModal.id}/payment`
        : `/purchases/${partialModal.id}/payment`;
    const selAcc = accounts.find(a => a.id === Number(partialAccountId));
    try {
      await apiSend(endpoint, 'POST', {
        amount: pkr(partialAmount),
        account_id: Number(partialAccountId) || null,
        payment_method: selAcc ? selAcc.type : partialMethod,
        payment_arrangement: partialArrangement,
        lender_name: partialLenderName.trim() || null,
        remarks: partialRemarks
      });
      notify(`Installment of PKR ${pkr(partialAmount).toLocaleString()} settled against ${partialModal.refNumber}!`);
      setPartialModal(null);
      setPartialAmount('');
      setPartialRemarks('');
      setPartialArrangement('WALLET');
      setPartialLenderName('');
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleRepayLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanRepayModal || !loanRepayAmount || Number(loanRepayAmount) <= 0) return;
    try {
      const data = await apiSend('/loans/repay', 'POST', {
        loan_id: loanRepayModal.id,
        amount: pkr(loanRepayAmount),
        account_id: Number(loanRepayAccId),
        remarks: loanRepayRemarks
      });
      notify(data.message);
      setLoanRepayModal(null);
      setLoanRepayAmount('');
      setLoanRepayRemarks('');
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = editingLocationId ? `/locations/${editingLocationId}` : '/locations';
    const method = editingLocationId ? 'PUT' : 'POST';
    try {
      await apiSend(endpoint, method, { name: locName, location_type: locType, address: locAddress });
      notify(editingLocationId ? 'Storage Location updated!' : 'New Storage Location created!');
      setEditingLocationId(null);
      setLocName('');
      setLocAddress('');
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleStockTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trfQuantity || Number(trfQuantity) <= 0) return;
    try {
      const data = await apiSend('/inventory/transfer', 'POST', {
        product_id: Number(trfProductId),
        from_location_id: Number(trfFromLocId),
        to_location_id: Number(trfToLocId),
        unit_type: trfUnitType,
        quantity: Number(trfQuantity),
        remarks: trfRemarks
      });
      notify(data.message);
      setTrfQuantity('');
      setTrfRemarks('');
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = editingProductId ? `/products/${editingProductId}` : '/products';
    const method = editingProductId ? 'PUT' : 'POST';
    try {
      await apiSend(endpoint, method, {
        sku: prodSku || undefined,
        name: prodName,
        company_name: prodCompanyName.trim() || 'ATH Oils',
        brand_id: Number(prodBrandId),
        viscosity_grade: prodViscosity,
        pack_size: Number(prodPackSize) || 700,
        pack_unit: 'ML',
        units_per_carton: Number(prodUnitsPerCarton) || 12,
        purchase_rate: pkr(prodPurchaseRate),
        sale_rate: pkr(prodSaleRate),
        initial_stock: Number(prodInitialStock) || 0,
        location_id: Number(prodInitialLocId),
        reorder_level: Number(prodReorder) || 12,
        is_favorite: prodIsFavorite
      });
      notify(editingProductId ? 'Product updated!' : `New Product '${prodName}' added!`);
      setEditingProductId(null);
      setProdSku('');
      setProdName('');
      setProdPurchaseRate('');
      setProdSaleRate('');
      setProdInitialStock('');
      setProdIsFavorite(false);
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount || Number(expAmount) <= 0) return;
    const selAcc = accounts.find(a => a.id === Number(expAccountId));
    try {
      const data = await apiSend('/expenses', 'POST', {
        category: expCategory,
        description: expDesc,
        amount: pkr(expAmount),
        account_id: Number(expAccountId) || null,
        payment_method: selAcc ? selAcc.type : expMethod,
        payment_arrangement: expArrangement,
        lender_name: expLenderName.trim() || null,
        paid_to: expPaidTo
      });
      notify(`Expense ${data.expense_number} recorded for PKR ${pkr(data.amount).toLocaleString()}`);
      setExpAmount('');
      setExpDesc('');
      setExpPaidTo('');
      setExpArrangement('WALLET');
      setExpLenderName('');
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = editingCustomerId ? `/customers/${editingCustomerId}` : '/customers';
    const method = editingCustomerId ? 'PUT' : 'POST';
    try {
      await apiSend(endpoint, method, {
        name: cusName,
        phone: cusPhone,
        cnic: cusCnic,
        group_id: cusGroupId,
        group_name: cusGroup.trim() || 'General Market',
        city: cusCity,
        credit_limit: pkr(cusCreditLimit) || 50000,
        current_receivable: pkr(cusReceivable),
        is_favorite: cusIsFavorite
      });
      notify(editingCustomerId ? 'Customer updated!' : 'New Customer added!');
      setEditingCustomerId(null);
      setCusName('');
      setCusPhone('');
      setCusCnic('');
      setCusCity('');
      setCusReceivable('');
      setCusIsFavorite(false);
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = editingSupplierId ? `/suppliers/${editingSupplierId}` : '/suppliers';
    const method = editingSupplierId ? 'PUT' : 'POST';
    try {
      await apiSend(endpoint, method, {
        name: supName,
        phone: supPhone,
        cnic: supCnic,
        group_id: supGroupId,
        group_name: supGroup.trim() || 'General Suppliers',
        city: supCity,
        current_payable: pkr(supPayable),
        is_favorite: supIsFavorite
      });
      notify(editingSupplierId ? 'Supplier updated!' : 'New Supplier added!');
      setEditingSupplierId(null);
      setSupName('');
      setSupPhone('');
      setSupCnic('');
      setSupCity('');
      setSupPayable('');
      setSupIsFavorite(false);
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // ==================== CUSTOMER OUTSTANDING LEDGER & PAYMENT ALLOCATION ENGINE ====================
  const computeDefaultDraftAllocations = (
    bills: CustomerOutstandingLedger['outstanding_bills'],
    paymentAmt: number,
    policy: 'OLDEST_FIRST' | 'NEWEST_FIRST'
  ): Record<number, number> => {
    const ordered = [...bills].sort((a, b) =>
      policy === 'NEWEST_FIRST' ? b.sale_id - a.sale_id : a.sale_id - b.sale_id
    );
    let rem = pkr(paymentAmt);
    const map: Record<number, number> = {};
    for (const b of bills) map[b.sale_id] = 0;
    for (const b of ordered) {
      if (rem <= 0) break;
      const alloc = pkr(Math.min(b.remaining_balance, rem));
      map[b.sale_id] = alloc;
      rem = pkr(rem - alloc);
    }
    return map;
  };

  const openCustomerAllocationModal = async (customerId: number, initialPaymentAmt?: number) => {
    try {
      setAllocationError('');
      setAllocationConfirming(false);
      const res = await fetch(`${API_BASE}/customers/${customerId}/outstanding-ledger`);
      if (!res.ok) throw new Error('Could not load customer outstanding ledger');
      const ledger: CustomerOutstandingLedger = await res.json();
      setAllocationLedgerModal(ledger);
      const defaultPay = initialPaymentAmt && initialPaymentAmt > 0 ? pkr(initialPaymentAmt) : 0;
      setAllocationPaymentInput(defaultPay > 0 ? String(defaultPay) : '');
      setAllocationPolicy('OLDEST_FIRST');
      setAllocationExcessAction('NONE');
      setAllocationRemarks('');
      setAllocationIdempotencyKey(`PAY-${customerId}-${Date.now()}`);
      setAllocationDraftMap(
        computeDefaultDraftAllocations(ledger.outstanding_bills, defaultPay, 'OLDEST_FIRST')
      );
    } catch (err: any) {
      notify(err.message || 'Failed to load customer ledger', true);
    }
  };

  const handlePaymentInputOrPolicyChange = (
    rawAmount: string,
    nextPolicy: 'OLDEST_FIRST' | 'NEWEST_FIRST'
  ) => {
    setAllocationPaymentInput(rawAmount);
    setAllocationPolicy(nextPolicy);
    setAllocationConfirming(false);
    setAllocationError('');
    if (!allocationLedgerModal) return;
    const payVal = pkr(rawAmount);
    setAllocationDraftMap(
      computeDefaultDraftAllocations(allocationLedgerModal.outstanding_bills, payVal, nextPolicy)
    );
  };

  const handlePrioritizeBillFirst = (prioritySaleId: number) => {
    if (!allocationLedgerModal) return;
    const payVal = pkr(allocationPaymentInput);
    let rem = payVal;
    const nextMap: Record<number, number> = {};
    const targetBill = allocationLedgerModal.outstanding_bills.find(b => b.sale_id === prioritySaleId);
    if (targetBill && rem > 0) {
      const alloc = pkr(Math.min(targetBill.remaining_balance, rem));
      nextMap[targetBill.sale_id] = alloc;
      rem = pkr(rem - alloc);
    }
    for (const b of allocationLedgerModal.outstanding_bills) {
      if (b.sale_id === prioritySaleId) continue;
      const alloc = rem > 0 ? pkr(Math.min(b.remaining_balance, rem)) : 0;
      nextMap[b.sale_id] = alloc;
      rem = pkr(rem - alloc);
    }
    setAllocationDraftMap(nextMap);
    setAllocationConfirming(false);
    setAllocationError('');
  };

  const handleManualBillAllocationEdit = (saleId: number, rawVal: string, maxBillRemaining: number) => {
    const val = Math.max(0, Math.min(pkr(maxBillRemaining), pkr(rawVal)));
    setAllocationDraftMap(prev => ({
      ...prev,
      [saleId]: val
    }));
    setAllocationConfirming(false);
    setAllocationError('');
  };

  const handleExecuteConfirmedAllocation = async () => {
    if (!allocationLedgerModal) return;
    setAllocationError('');
    setAllocationBusy(true);
    const selAcc = accounts.find(a => a.id === Number(allocationAccountId));
    try {
      const allocationsPayload = Object.entries(allocationDraftMap)
        .map(([sid, amt]) => ({ sale_id: Number(sid), allocated_amount: pkr(amt) }))
        .filter(x => x.allocated_amount > 0);

      const data = await apiSend(
        `/customers/${allocationLedgerModal.customer_id}/confirm-payment-allocation`,
        'POST',
        {
          payment_amount: pkr(allocationPaymentInput),
          payment_method: selAcc ? selAcc.type : allocationMethod,
          account_id: Number(allocationAccountId) || null,
          allocations: allocationsPayload,
          excess_action: allocationExcessAction,
          remarks: allocationRemarks,
          idempotency_key: allocationIdempotencyKey
        }
      );
      notify(data.message || 'Payment allocation confirmed and saved!');
      if (data.ledger) {
        setAllocationLedgerModal(data.ledger);
      } else {
        setAllocationLedgerModal(null);
      }
      setAllocationPaymentInput('');
      setAllocationConfirming(false);
      setAllocationIdempotencyKey(`PAY-${allocationLedgerModal.customer_id}-${Date.now()}`);
      await fetchData();
    } catch (err: any) {
      setAllocationError(err.message || 'Payment allocation failed.');
    } finally {
      setAllocationBusy(false);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = editingAccountId ? `/accounts/${editingAccountId}` : '/accounts';
    const method = editingAccountId ? 'PUT' : 'POST';
    try {
      await apiSend(endpoint, method, {
        name: accName,
        type: accType,
        account_number: accNumber,
        current_balance: pkr(accBalance)
      });
      notify(editingAccountId ? 'Account updated!' : 'New Financial Account created!');
      setEditingAccountId(null);
      setAccName('');
      setAccNumber('');
      setAccBalance('');
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleAdjustAccountBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjAmount || Number(adjAmount) <= 0) return;
    try {
      const data = await apiSend('/accounts/adjust', 'POST', {
        account_id: Number(adjAccountId),
        operation: adjOperation,
        amount: pkr(adjAmount),
        remarks: adjRemarks
      });
      notify(data.message);
      setAdjAmount('');
      setAdjRemarks('');
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const handleTransferBetweenAccounts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trfAccAmount || Number(trfAccAmount) <= 0) return;
    try {
      const data = await apiSend('/accounts/transfer', 'POST', {
        from_account_id: Number(trfFromAccId),
        to_account_id: Number(trfToAccId),
        amount: pkr(trfAccAmount),
        remarks: trfAccRemarks
      });
      notify(data.message);
      setTrfAccAmount('');
      setTrfAccRemarks('');
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // ==================== 360° CUSTOMER & SUPPLIER PROFILE OPENERS ====================
  const openCustomer360 = async (customerId: number) => {
    try {
      const res = await fetch(`${API_BASE}/customers/${customerId}/profile`);
      if (!res.ok) throw new Error('Could not load customer profile');
      const data: Customer360Profile = await res.json();
      setProfileTab('invoices');
      setCustomerProfileModal(data);
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  const openSupplier360 = async (supplierId: number) => {
    try {
      const res = await fetch(`${API_BASE}/suppliers/${supplierId}/profile`);
      if (!res.ok) throw new Error('Could not load supplier profile');
      const data: Supplier360Profile = await res.json();
      setSupplierProfileModal(data);
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // ==================== 1-CLICK DATABASE BACKUP & RESTORE ====================
  const handleDownloadBackupJson = async () => {
    try {
      const res = await fetch(`${API_BASE}/backup/export`);
      const snap = await res.json();
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ATH-Lubricants-Backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify('Full Database Backup downloaded!');
    } catch (err: any) {
      notify('Backup export failed.', true);
    }
  };

  const handleImportBackupJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch(`${API_BASE}/backup/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: parsed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Restore failed');
      if (data.snapshot) saveSnapshot(data.snapshot);
      notify(data.message || 'Database restored successfully!');
      await fetchData();
    } catch (err: any) {
      notify(err.message || 'Invalid backup file.', true);
    } finally {
      e.target.value = '';
    }
  };

  // ==================== NATIVE HIGH-RES INVOICE PNG & PDF/PRINT GENERATOR ====================
  const downloadOrShareInvoiceImage = async (mode: 'DOWNLOAD' | 'SHARE') => {
    if (!invoiceModal) return;
    const isSale = invoiceModal.kind === 'SALE';
    const doc = isSale ? invoiceModal.sale : invoiceModal.purchase;
    if (!doc) return;

    const items = (doc.items || []) as any[];
    const canvas = document.createElement('canvas');
    const width = 920;
    const rowHeight = 46;
    const height = Math.max(760, 480 + items.length * rowHeight);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // White Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Top ATH Slate-Gray & Crimson Header Banner
    ctx.fillStyle = '#1E232D';
    ctx.fillRect(0, 0, width, 125);
    ctx.fillStyle = '#E11D48';
    ctx.fillRect(0, 125, width, 6);

    // Load /logo.png if available
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = '/logo.png';
      });
      if (img.width > 0) {
        ctx.drawImage(img, 36, 22, 82, 82);
      }
    } catch {
      // Fallback if logo not loaded
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillText('ATH LUBRICANTS', 135, 58);
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText('PRECISION MOTOR OIL DISTRIBUTION & TRADE INVOICE', 135, 84);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Official Computerized Tax / Trade Bill (PKR)', 135, 104);

    const refNo = isSale ? (doc as SaleRecord).invoice_number : (doc as PurchaseRecord).purchase_number;
    const docType = (doc as any).doc_type || (isSale ? 'SALE' : 'PURCHASE');

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(refNo, width - 36, 56);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '13px monospace';
    ctx.fillText(`Date: ${doc.invoice_date}`, width - 36, 82);
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(`${docType} • ${doc.payment_status}`, width - 36, 104);
    ctx.textAlign = 'left';

    // Party Info Box
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(36, 150, width - 72, 85);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(36, 150, width - 72, 85);

    const partyName = isSale ? (doc as SaleRecord).customer_name : (doc as PurchaseRecord).supplier_name;
    const partyCity = isSale ? (doc as SaleRecord).customer_city : (doc as PurchaseRecord).supplier_city;
    const partyPhone = isSale ? (doc as SaleRecord).customer_phone : (doc as PurchaseRecord).supplier_phone;
    const partyCnic = isSale ? (doc as SaleRecord).customer_cnic : (doc as PurchaseRecord).supplier_cnic;
    const partyGroup = isSale ? (doc as SaleRecord).customer_group : (doc as PurchaseRecord).supplier_group;

    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText(isSale ? 'BILLED TO CUSTOMER / DEALERSHIP:' : 'SUPPLIER / VENDOR:', 52, 172);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(`${partyName} (${partyCity || 'Local'})`, 52, 198);
    ctx.fillStyle = '#334155';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText(
      `Phone: ${partyPhone || 'N/A'}   |   CNIC: ${partyCnic || 'N/A'}   |   Group: ${partyGroup || 'General'}`,
      52,
      220
    );

    // Table Header
    let y = 260;
    ctx.fillStyle = '#1E232D';
    ctx.fillRect(36, y, width - 72, 36);
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText('#', 50, y + 23);
    ctx.fillText('PRODUCT & SIZE', 85, y + 23);
    ctx.fillText('QTY & CARTON BREAKDOWN', 370, y + 23);
    ctx.fillText('RATE (PKR)', 640, y + 23);
    ctx.textAlign = 'right';
    ctx.fillText('TOTAL (PKR)', width - 50, y + 23);
    ctx.textAlign = 'left';

    y += 36;
    items.forEach((it, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#F1F5F9';
      ctx.fillRect(36, y, width - 72, rowHeight);
      ctx.strokeStyle = '#E2E8F0';
      ctx.strokeRect(36, y, width - 72, rowHeight);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText(String(idx + 1), 50, y + 28);
      ctx.fillText(`${it.product_name} (${it.pack_size || '700 ML'})`, 85, y + 22);
      ctx.fillStyle = '#64748B';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(`${it.company_name || 'ATH Oils'} • ${it.location_name || ''}`, 85, y + 38);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(
        `${it.quantity} ${it.unit_type} (${it.base_quantity} Btls = ${it.cartons} Ctn + ${it.loose_bottles} Btl)`,
        370,
        y + 28
      );
      ctx.fillText(`PKR ${pkr(it.unit_rate).toLocaleString()}`, 640, y + 28);

      ctx.textAlign = 'right';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`PKR ${pkr(it.line_total).toLocaleString()}`, width - 50, y + 28);
      ctx.textAlign = 'left';
      y += rowHeight;
    });

    // Totals & Previous Dues Summary Box
    y += 20;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(width - 420, y, 384, 175);
    ctx.strokeStyle = '#94A3B8';
    ctx.strokeRect(width - 420, y, 384, 175);

    const drawSumRow = (label: string, val: string, rowY: number, color = '#0F172A', bold = false) => {
      ctx.fillStyle = '#475569';
      ctx.font = bold ? 'bold 14px Inter, sans-serif' : '13px Inter, sans-serif';
      ctx.fillText(label, width - 404, rowY);
      ctx.textAlign = 'right';
      ctx.fillStyle = color;
      ctx.font = bold ? 'bold 15px monospace' : 'bold 13px monospace';
      ctx.fillText(val, width - 52, rowY);
      ctx.textAlign = 'left';
    };

    drawSumRow('Current Bill Total:', `PKR ${pkr(doc.total_amount).toLocaleString()}`, y + 28, '#0F172A', true);
    if (isSale) {
      const sDoc = doc as SaleRecord;
      const prevDues = pkr(sDoc.previous_dues);
      const grandPay = pkr(sDoc.grand_payable || sDoc.total_amount + prevDues);
      const totalRecToday = pkr(sDoc.received_amount + (sDoc.applied_to_previous || 0));
      const closeRec = pkr(sDoc.closing_receivable ?? sDoc.receivable_amount);

      drawSumRow('+ Previous Balance (Old Khata):', `PKR ${prevDues.toLocaleString()}`, y + 56, '#D97706');
      drawSumRow('= Total Payable Amount:', `PKR ${grandPay.toLocaleString()}`, y + 84, '#0F172A', true);
      drawSumRow(`- Received Today (${sDoc.payment_method}):`, `PKR ${totalRecToday.toLocaleString()}`, y + 114, '#059669', true);
      drawSumRow('Net Closing Khata Balance:', `PKR ${closeRec.toLocaleString()}`, y + 148, '#E11D48', true);
    } else {
      const pDoc = doc as PurchaseRecord;
      drawSumRow(`Paid Amount (${pDoc.payment_method}):`, `PKR ${pkr(pDoc.paid_amount).toLocaleString()}`, y + 64, '#059669', true);
      drawSumRow('Remaining Payable Balance:', `PKR ${pkr(pDoc.payable_amount).toLocaleString()}`, y + 104, '#E11D48', true);
    }

    ctx.fillStyle = '#64748B';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Thank you for doing business with ATH Lubricants!', 36, y + 40);
    ctx.fillText(`Remarks: ${doc.remarks || 'None'}`, 36, y + 65);

    canvas.toBlob(async blob => {
      if (!blob) return;
      const fileName = `${refNo}.png`;
      if (mode === 'SHARE' && navigator.share) {
        try {
          const file = new File([blob], fileName, { type: 'image/png' });
          await navigator.share({
            title: `ATH Lubricants Invoice ${refNo}`,
            text: `Invoice ${refNo} for ${partyName} - Total PKR ${pkr(doc.total_amount).toLocaleString()}`,
            files: [file]
          });
          return;
        } catch {
          // Fallback to download if share canceled or unsupported
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      notify(`Invoice Image (${fileName}) downloaded!`);
    }, 'image/png');
  };

  // ==================== PRINT / SAVE PDF FOR SINGLE INVOICE OR ALL CUSTOMER INVOICES ====================
  const printSingleInvoicePdf = (thermal = false) => {
    if (!invoiceModal) return;
    const isSale = invoiceModal.kind === 'SALE';
    const doc = isSale ? invoiceModal.sale : invoiceModal.purchase;
    if (!doc) return;

    const refNo = isSale ? (doc as SaleRecord).invoice_number : (doc as PurchaseRecord).purchase_number;
    const partyName = isSale ? (doc as SaleRecord).customer_name : (doc as PurchaseRecord).supplier_name;
    const partyCity = isSale ? (doc as SaleRecord).customer_city : (doc as PurchaseRecord).supplier_city;
    const partyPhone = isSale ? (doc as SaleRecord).customer_phone : (doc as PurchaseRecord).supplier_phone;
    const partyCnic = isSale ? (doc as SaleRecord).customer_cnic : (doc as PurchaseRecord).supplier_cnic;
    const items = (doc.items || []) as any[];

    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) return;

    const rowsHtml = items
      .map(
        (it, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${it.product_name}</strong> (${it.pack_size || '700 ML'})<br/><small>${it.company_name || 'ATH Oils'}</small></td>
          <td>${it.quantity} ${it.unit_type}<br/><small>${it.base_quantity} Btls (${it.cartons} Ctn + ${it.loose_bottles} Btl)</small></td>
          <td style="text-align:right">PKR ${pkr(it.unit_rate).toLocaleString()}</td>
          <td style="text-align:right"><strong>PKR ${pkr(it.line_total).toLocaleString()}</strong></td>
        </tr>`
      )
      .join('');

    const sDoc = doc as SaleRecord;
    const prevDues = isSale ? pkr(sDoc.previous_dues) : 0;
    const grandPay = isSale ? pkr(sDoc.grand_payable || sDoc.total_amount + prevDues) : pkr(doc.total_amount);
    const recToday = isSale ? pkr(sDoc.received_amount + (sDoc.applied_to_previous || 0)) : pkr((doc as PurchaseRecord).paid_amount);
    const closingBal = isSale ? pkr(sDoc.closing_receivable ?? sDoc.receivable_amount) : pkr((doc as PurchaseRecord).payable_amount);

    win.document.write(`
      <html>
        <head>
          <title>Invoice ${refNo} - ATH Lubricants</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; margin: ${thermal ? '8px' : '28px'}; max-width: ${thermal ? '300px' : '840px'}; }
            .hdr { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #E11D48; padding-bottom: 12px; }
            .hdr img { height: 64px; object-fit: contain; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: ${thermal ? '11px' : '13px'}; }
            th, td { border: 1px solid #CBD5E1; padding: 8px; text-align: left; }
            th { background: #1E232D; color: #FACC15; }
            .sum-box { margin-top: 18px; margin-left: auto; width: ${thermal ? '100%' : '340px'}; border: 1px solid #64748B; padding: 12px; background: #F8FAFC; }
            .sum-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
            .sum-row.bold { font-weight: bold; font-size: 14px; border-top: 1px solid #CBD5E1; padding-top: 6px; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="hdr">
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="${window.location.origin}/logo.png" onerror="this.style.display='none'" />
              <div>
                <h2 style="margin:0;color:#1E232D;">ATH LUBRICANTS</h2>
                <div style="font-size:12px;color:#475569;">Precision Motor Oil Distribution & Trade Portal</div>
              </div>
            </div>
            <div style="text-align:right;">
              <h3 style="margin:0;color:#E11D48;">${refNo}</h3>
              <div style="font-size:12px;">Date: ${doc.invoice_date}</div>
              <div style="font-size:12px;font-weight:bold;">Status: ${doc.payment_status}</div>
            </div>
          </div>
          <div style="margin-top:14px;padding:10px;background:#F1F5F9;border:1px solid #CBD5E1;font-size:13px;">
            <strong>Party:</strong> ${partyName} (${partyCity || 'Local'}) &nbsp;|&nbsp;
            <strong>Phone:</strong> ${partyPhone || 'N/A'} &nbsp;|&nbsp;
            <strong>CNIC:</strong> ${partyCnic || 'N/A'}
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Qty & Cartons</th>
                <th style="text-align:right">Rate</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="sum-box">
            <div class="sum-row bold"><span>Current Bill Total:</span><span>PKR ${pkr(doc.total_amount).toLocaleString()}</span></div>
            ${
              isSale
                ? `
              <div class="sum-row"><span>+ Previous Dues (Old Khata):</span><span>PKR ${prevDues.toLocaleString()}</span></div>
              <div class="sum-row bold"><span>= Total Payable:</span><span>PKR ${grandPay.toLocaleString()}</span></div>
              <div class="sum-row" style="color:#059669;font-weight:bold;"><span>- Received Today (${doc.payment_method}):</span><span>PKR ${recToday.toLocaleString()}</span></div>
              <div class="sum-row bold" style="color:#E11D48;"><span>Net Closing Khata Balance:</span><span>PKR ${closingBal.toLocaleString()}</span></div>
            `
                : `
              <div class="sum-row" style="color:#059669;font-weight:bold;"><span>Paid (${doc.payment_method}):</span><span>PKR ${recToday.toLocaleString()}</span></div>
              <div class="sum-row bold" style="color:#E11D48;"><span>Remaining Payable:</span><span>PKR ${closingBal.toLocaleString()}</span></div>
            `
            }
          </div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const printAllCustomerInvoicesPdf = (profile: Customer360Profile) => {
    const win = window.open('', '_blank', 'width=960,height=800');
    if (!win) return;
    const c = profile.customer;
    const invHtml = profile.invoices
      .map(
        inv => `
        <div style="border:1px solid #94A3B8;padding:12px;margin-bottom:14px;page-break-inside:avoid;">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #CBD5E1;padding-bottom:6px;margin-bottom:8px;">
            <strong>${inv.invoice_number} (${inv.doc_type || 'SALE'})</strong>
            <span>Date: ${inv.invoice_date} | Status: <strong>${inv.payment_status}</strong></span>
          </div>
          <div style="font-size:12px;margin-bottom:8px;"><strong>Items:</strong> ${inv.items_summary}</div>
          <div style="display:flex;justify-content:space-between;font-size:12px;background:#F8FAFC;padding:6px;">
            <span>Bill Total: <strong>PKR ${pkr(inv.total_amount).toLocaleString()}</strong></span>
            <span>Old Dues: <strong>PKR ${pkr(inv.previous_dues).toLocaleString()}</strong></span>
            <span style="color:#059669;">Received: <strong>PKR ${pkr(inv.received_amount + (inv.applied_to_previous || 0)).toLocaleString()}</strong></span>
            <span style="color:#E11D48;">Bill Pending: <strong>PKR ${pkr(inv.receivable_amount).toLocaleString()}</strong></span>
          </div>
        </div>`
      )
      .join('');

    win.document.write(`
      <html>
        <head>
          <title>Complete Statement & All Invoices - ${c.name}</title>
          <style>body { font-family: Arial, sans-serif; margin: 24px; color: #111; }</style>
        </head>
        <body>
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #E11D48;padding-bottom:12px;margin-bottom:16px;">
            <div>
              <h2 style="margin:0;">ATH LUBRICANTS - PARTY COMPLETE STATEMENT</h2>
              <div style="font-size:13px;">Customer: <strong>${c.name}</strong> (${c.city}) | Group: ${c.group_name || 'General'} | CNIC: ${c.cnic || 'N/A'} | Phone: ${c.phone || 'N/A'}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:16px;font-weight:bold;color:#E11D48;">Current Closing Khata: PKR ${pkr(c.current_receivable).toLocaleString()}</div>
              <div style="font-size:12px;">Total Invoices: ${profile.invoices.length}</div>
            </div>
          </div>
          ${invHtml || '<p>No invoices recorded for this customer.</p>'}
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
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
      let endpoint = '';
      if (securityModal.mode === 'REVERSE') {
        endpoint = `/security/reverse/${securityModal.entityType}/${securityModal.entityId}`;
      } else if (securityModal.mode === 'PERMANENT_DELETE') {
        endpoint = `/recycle-bin/${securityModal.trashId}/permanent-delete`;
      } else {
        endpoint = `/recycle-bin/empty`;
      }
      const data = await apiSend(endpoint, 'POST', { admin_password: securityPassword.trim() });
      notify(data.message || 'Authorized action executed.');
      setSecurityModal(null);
      setSecurityPassword('');
      await fetchData();
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to execute action.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleRestoreFromBin = async (trashId: number) => {
    try {
      const data = await apiSend(`/recycle-bin/${trashId}/restore`, 'POST', {});
      notify(data.message);
      await fetchData();
    } catch (err: any) {
      notify(err.message, true);
    }
  };

  // ==================== FILTERED CUSTOMERS, SUPPLIERS & SALES ====================
  const filteredCustomers = useMemo(() => {
    const q = partySearch.trim().toLowerCase();
    return customers.filter(c => {
      if (selectedCustomerGroupIdFilter !== null) {
        const matchesId = c.group_id === selectedCustomerGroupIdFilter;
        const matchesFallbackName =
          selectedCustomerGroupFilter !== 'ALL' &&
          (c.group_name || 'General Market').toLowerCase() === selectedCustomerGroupFilter.toLowerCase();
        if (!matchesId && !matchesFallbackName) return false;
      } else if (
        selectedCustomerGroupFilter !== 'ALL' &&
        (c.group_name || 'General Market') !== selectedCustomerGroupFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.code || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.cnic || '').toLowerCase().includes(q) ||
        (c.group_name || '').toLowerCase().includes(q)
      );
    });
  }, [customers, partySearch, selectedCustomerGroupIdFilter, selectedCustomerGroupFilter]);

  const filteredSalesRegister = useMemo(() => {
    const q = salesRegisterSearch.trim().toLowerCase();
    return sales.filter(s => {
      const dtype = s.doc_type || 'SALE';
      if (salesRegisterDocFilter !== 'ALL' && dtype !== salesRegisterDocFilter) return false;
      if (salesRegisterLocationId > 0) {
        const hasLoc =
          (s.items || []).some(it => it.location_id === salesRegisterLocationId) ||
          (s.location_summary || '')
            .toLowerCase()
            .includes((locations.find(l => l.id === salesRegisterLocationId)?.name || '').toLowerCase());
        if (!hasLoc) return false;
      }
      if (!q) return true;
      return (
        s.invoice_number.toLowerCase().includes(q) ||
        (s.customer_name || '').toLowerCase().includes(q) ||
        (s.customer_city || '').toLowerCase().includes(q) ||
        (s.customer_group || '').toLowerCase().includes(q) ||
        (s.items_summary || '').toLowerCase().includes(q)
      );
    });
  }, [sales, salesRegisterDocFilter, salesRegisterLocationId, salesRegisterSearch, locations]);

  const filteredSuppliers = useMemo(() => {
    const q = partySearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.cnic || '').toLowerCase().includes(q) ||
        (s.group_name || '').toLowerCase().includes(q)
    );
  }, [suppliers, partySearch]);

  const pendingSales = sales.filter(s => s.receivable_amount > 0 && s.doc_type !== 'ESTIMATE');
  const pendingPurchases = purchases.filter(p => p.payable_amount > 0);

  // ==================== LOGIN SCREEN ====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <OilDropletsBackdrop />
        <div className="max-w-lg w-full glass-panel rounded-2xl overflow-hidden shadow-2xl animate-fade-in relative z-10 border border-yellow-400/40">
          <div className="bg-slate-900/90 border-b border-yellow-400/30 p-3 flex flex-col items-center gap-2">
            <img
              src="/logo.png"
              alt="ATH Lubricants Logo"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              className="h-20 w-auto object-contain drop-shadow-lg"
            />
            <img
              src="/banner.jpg"
              alt="ATH Lubricants Banner"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              className="w-full max-h-40 object-contain rounded-xl"
            />
          </div>
          <form onSubmit={handleAdminLogin} className="p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight samsung-heading">
                  ATH <span className="oil-gradient-text">LUBRICANTS</span> ERP
                </h1>
                <p className="text-xs text-slate-200">Executive Distribution, Billing & Vyapar Suite</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase text-yellow-300 bg-rose-950/80 border border-yellow-400/40 px-3 py-1.5 rounded-full">
                <Lock className="w-3.5 h-3.5 text-yellow-400" /> Protected
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white">Administrator Username</label>
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
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
                  name="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter administrator password"
                  value={loginPass}
                  onChange={e => setLoginPass(e.target.value)}
                  className="mt-1.5 erp-input"
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-500 text-xs text-white font-semibold">
                {loginError}
              </div>
            )}

            <button type="submit" className="w-full btn-primary py-3.5 text-xs uppercase tracking-widest">
              Sign In to Executive Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  const mainMenuItems: { id: MainSection; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'accounts', label: 'Billing & Accounts' },
    { id: 'inventory', label: 'Inventory & Godowns' },
    { id: 'directory', label: `Parties & Khata (${customers.length})` },
    { id: 'reports', label: 'Vyapar Reports & Backup' }
  ];

  return (
    <div className="min-h-screen flex flex-col pb-24 lg:pb-10 relative">
      <OilDropletsBackdrop />

      {/* ==================== STICKY HEADER WITH ATH LOGO ==================== */}
      <header className="bg-[#1E232D]/95 backdrop-blur-2xl border-b border-yellow-400/30 sticky top-0 z-40 px-3 sm:px-6 py-2.5 no-print shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-white/15">
              <button
                onClick={handleBack}
                disabled={!canGoBack}
                className={`p-1.5 rounded-lg transition ${
                  canGoBack ? 'text-white hover:bg-yellow-400 hover:text-slate-900' : 'text-slate-500 cursor-not-allowed'
                }`}
                title="Back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleForward}
                disabled={!canGoForward}
                className={`p-1.5 rounded-lg transition ${
                  canGoForward ? 'text-white hover:bg-yellow-400 hover:text-slate-900' : 'text-slate-500 cursor-not-allowed'
                }`}
                title="Forward"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="relative flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="ATH Logo"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                className="h-10 w-10 sm:h-11 sm:w-11 object-contain rounded-xl bg-white/10 p-1 border border-yellow-400/40"
              />
              <div>
                <h1 className="text-base sm:text-xl font-black tracking-tight text-white flex items-center gap-1.5 samsung-heading">
                  ATH <span className="oil-gradient-text">LUBRICANTS</span>
                  <Droplet className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 oil-badge-drip inline" />
                </h1>
                <p className="text-[11px] text-slate-200 font-medium hidden sm:block">
                  Precision Motor Oil Distribution, Billing & Vyapar Suite
                </p>
              </div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-xl border border-white/15">
            {mainMenuItems.map(item => (
              <button
                key={item.id}
                onClick={() => navigateTo({ main: item.id })}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold tracking-tight transition-all duration-200 ${
                  currentNav.main === item.id
                    ? 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-500 text-white shadow-md shadow-rose-600/30 border border-yellow-300/40'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadBackupJson}
              className="hidden sm:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-yellow-300 border border-yellow-400/40 px-3 py-2 rounded-xl text-xs font-bold transition"
              title="1-Click Save Full Database Backup"
            >
              <Download className="w-3.5 h-3.5" /> Backup DB
            </button>
            <button
              onClick={fetchData}
              className="p-2 text-yellow-400 hover:text-white bg-slate-800 border border-yellow-400/40 rounded-xl transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-yellow-400' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 bg-rose-700/80 hover:bg-rose-600 text-white border border-white/20 px-3 py-2 rounded-xl text-xs font-bold transition"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-white bg-rose-600/80 border border-yellow-400/40 rounded-xl"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Sub-Navigation Bar (Touch Scrollable on Mobile/Tablet) */}
        {currentNav.main !== 'dashboard' && (
          <div className="max-w-7xl mx-auto mt-2.5 pt-2 border-t border-white/15 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {currentNav.main === 'accounts' &&
              ([
                { id: 'sales', label: 'Sales & Quotations' },
                { id: 'purchases', label: 'Purchase Bills' },
                { id: 'partials', label: `Khata Installments (${pendingSales.length + pendingPurchases.length})` },
                { id: 'expenses', label: 'Operating Expenses' },
                { id: 'wallets', label: `Wallets & Loans (${loans.filter(l => l.current_balance > 0).length})` },
                { id: 'ledger', label: 'Cashflow Ledger' }
              ] as { id: AccountsSubTab; label: string }[]).map(sub => (
                <button
                  key={sub.id}
                  onClick={() => navigateTo({ main: 'accounts', accSub: sub.id })}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    currentNav.accSub === sub.id
                      ? 'bg-yellow-400 text-slate-950 shadow-md'
                      : 'bg-slate-800/90 text-white border border-white/15 hover:border-yellow-400/50'
                  }`}
                >
                  {sub.label}
                </button>
              ))}

            {currentNav.main === 'inventory' &&
              ([
                { id: 'stock_breakdown', label: 'Godown & Carton Stock Breakdown' },
                { id: 'products_crud', label: 'Add / Edit Products & Carton Sizes' },
                { id: 'locations_transfer', label: 'Warehouses & Stock Transfers' }
              ] as { id: InventorySubTab; label: string }[]).map(sub => (
                <button
                  key={sub.id}
                  onClick={() => navigateTo({ main: 'inventory', invSub: sub.id })}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    currentNav.invSub === sub.id
                      ? 'bg-yellow-400 text-slate-950 shadow-md'
                      : 'bg-slate-800/90 text-white border border-white/15 hover:border-yellow-400/50'
                  }`}
                >
                  {sub.label}
                </button>
              ))}

            {currentNav.main === 'directory' &&
              ([
                { id: 'parties', label: 'Customers, Groups, CNIC & 360° History' },
                { id: 'recycle', label: `Recycle Bin (${stats?.trash_count ?? recycleBin.length})` }
              ] as { id: DirectorySubTab; label: string }[]).map(sub => (
                <button
                  key={sub.id}
                  onClick={() => navigateTo({ main: 'directory', dirSub: sub.id })}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    currentNav.dirSub === sub.id
                      ? 'bg-yellow-400 text-slate-950 shadow-md'
                      : 'bg-slate-800/90 text-white border border-white/15 hover:border-yellow-400/50'
                  }`}
                >
                  {sub.label}
                </button>
              ))}

            {currentNav.main === 'reports' &&
              ([
                { id: 'bill_pnl', label: 'Bill-Wise Profit & Loss' },
                { id: 'item_profit', label: 'Item-Wise Stock & Profit' },
                { id: 'daybook', label: 'Day Book (Roznamcha)' },
                { id: 'groups_backup', label: 'Group Summary & Cloud Backup' }
              ] as { id: ReportsSubTab; label: string }[]).map(sub => (
                <button
                  key={sub.id}
                  onClick={() => navigateTo({ main: 'reports', repSub: sub.id })}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    currentNav.repSub === sub.id
                      ? 'bg-yellow-400 text-slate-950 shadow-md'
                      : 'bg-slate-800/90 text-white border border-white/15 hover:border-yellow-400/50'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
          </div>
        )}

        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-white/15 grid grid-cols-2 gap-2">
            {mainMenuItems.map(item => (
              <button
                key={item.id}
                onClick={() => navigateTo({ main: item.id })}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold text-left ${
                  currentNav.main === item.id
                    ? 'bg-yellow-400 text-slate-950'
                    : 'bg-slate-800 text-white border border-white/15'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={handleDownloadBackupJson}
              className="py-2.5 px-3 rounded-xl text-xs font-bold text-left bg-emerald-700 text-white"
            >
              Download DB Backup
            </button>
            <button
              onClick={handleLogout}
              className="py-2.5 px-3 rounded-xl text-xs font-bold text-left bg-rose-700 text-white"
            >
              Sign Out
            </button>
          </div>
        )}
      </header>

      {/* ==================== MAIN CONTENT CONTAINER ==================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-5 space-y-6 relative z-10 no-print">
        {toast && (
          <div
            className={`glass-panel px-4 py-3 rounded-xl text-xs font-bold flex justify-between items-center animate-fade-in ${
              toast.isError
                ? 'border-rose-500 bg-rose-950/95 text-white'
                : 'border-emerald-400 bg-emerald-950/95 text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              {toast.isError ? <AlertOctagon className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {toast.msg}
            </span>
            <button onClick={() => setToast(null)} className="text-sm font-bold px-2">✕</button>
          </div>
        )}

        {/* =========================================================================
            SECTION 1: EXECUTIVE DASHBOARD (100% WHOLE PKR)
           ========================================================================= */}
        {currentNav.main === 'dashboard' && stats && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-yellow-400/20 border border-yellow-400/50 text-yellow-300">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                    EXECUTIVE REPORTING TIMEFRAME
                  </h2>
                  <p className="text-xs text-slate-200 mt-0.5">
                    100% Whole-PKR Accounting • Sales, Purchases, Profit & Khata Command
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
                        ? 'bg-gradient-to-r from-rose-600 to-amber-500 text-white shadow-lg'
                        : 'bg-slate-800/90 text-slate-200 border border-white/15 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="kpi-card p-5 rounded-2xl">
                <div className="flex items-center justify-between text-white text-xs font-bold uppercase">
                  <span>Sales ({period})</span>
                  <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-emerald-300 tabular-nums">
                  PKR {pkr(stats.total_sales_revenue).toLocaleString()}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-200 border-t border-white/15 pt-2 tabular-nums">
                  <span>Collected: PKR {pkr(stats.sales_collected).toLocaleString()}</span>
                  <span className="text-yellow-300 font-bold">Khata: PKR {pkr(stats.sales_pending).toLocaleString()}</span>
                </div>
              </div>

              <div className="kpi-card p-5 rounded-2xl">
                <div className="flex items-center justify-between text-white text-xs font-bold uppercase">
                  <span>Purchases ({period})</span>
                  <span className="p-2 rounded-lg bg-yellow-400/20 text-yellow-300 border border-yellow-400/40">
                    <ShoppingCart className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-yellow-300 tabular-nums">
                  PKR {pkr(stats.total_purchases_cost).toLocaleString()}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-200 border-t border-white/15 pt-2 tabular-nums">
                  <span>Paid: PKR {pkr(stats.purchases_paid).toLocaleString()}</span>
                  <span className="text-rose-300 font-bold">Payable: PKR {pkr(stats.purchases_pending).toLocaleString()}</span>
                </div>
              </div>

              <div className="kpi-card p-5 rounded-2xl">
                <div className="flex items-center justify-between text-white text-xs font-bold uppercase">
                  <span>Net Profit ({period})</span>
                  <span className="p-2 rounded-lg bg-white/15 text-white border border-white/25">
                    <BarChart3 className="w-4 h-4" />
                  </span>
                </div>
                <div className={`mt-3 text-2xl font-black tabular-nums ${pkr(stats.net_profit) >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  PKR {pkr(stats.net_profit).toLocaleString()}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-200 border-t border-white/15 pt-2 tabular-nums">
                  <span>Gross: PKR {pkr(stats.estimated_gross_profit).toLocaleString()}</span>
                  <span className="text-rose-300 font-bold">Exp: PKR {pkr(stats.total_expenses).toLocaleString()}</span>
                </div>
              </div>

              <div className="kpi-card p-5 rounded-2xl">
                <div className="flex items-center justify-between text-white text-xs font-bold uppercase">
                  <span>Liquid Cash & Wallets</span>
                  <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-mono text-[11px] font-bold flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" /> PKR
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-emerald-300 tabular-nums">
                  PKR {pkr(stats.total_cash_bank).toLocaleString()}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-200 border-t border-white/15 pt-2 tabular-nums">
                  <span>Receivable: PKR {pkr(stats.total_receivable).toLocaleString()}</span>
                  <span className="text-rose-300 font-bold">Payable: PKR {pkr(stats.total_payable).toLocaleString()}</span>
                </div>
              </div>

              <div className="kpi-card p-5 rounded-2xl">
                <div className="flex items-center justify-between text-white text-xs font-bold uppercase">
                  <span>Live Stock Value</span>
                  <span className="p-2 rounded-lg bg-yellow-400/20 text-yellow-300 border border-yellow-400/40">
                    <Package className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3 text-2xl font-black text-yellow-300 tabular-nums">
                  PKR {pkr(stats.total_stock_value).toLocaleString()}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-200 border-t border-white/15 pt-2 tabular-nums">
                  <span>Total Stock: {pkr(stats.total_stock_bottles).toLocaleString()} Btls</span>
                  <span className="text-emerald-300 font-bold">Live Valuation</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden border border-yellow-400/40 shadow-2xl bg-slate-900/80 p-3 space-y-3">
                <img
                  src="/banner.jpg"
                  alt="ATH Motorcycle Engine Oil Banner"
                  className="w-full h-auto object-contain mx-auto block rounded-xl"
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <button
                    onClick={() => navigateTo({ main: 'accounts', accSub: 'sales' })}
                    className="btn-primary py-2.5 px-3 text-xs font-bold rounded-xl"
                  >
                    + New Sale Bill
                  </button>
                  <button
                    onClick={() => navigateTo({ main: 'accounts', accSub: 'purchases' })}
                    className="btn-oil py-2.5 px-3 text-xs font-bold rounded-xl"
                  >
                    + Stock Purchase
                  </button>
                  <button
                    onClick={() => navigateTo({ main: 'directory', dirSub: 'parties' })}
                    className="bg-slate-800 hover:bg-slate-700 text-white border border-white/20 py-2.5 px-3 text-xs font-bold rounded-xl"
                  >
                    Customer 360° Khata
                  </button>
                  <button
                    onClick={() => navigateTo({ main: 'reports', repSub: 'bill_pnl' })}
                    className="bg-slate-800 hover:bg-slate-700 text-yellow-300 border border-yellow-400/40 py-2.5 px-3 text-xs font-bold rounded-xl"
                  >
                    Bill-Wise P&L Report
                  </button>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2 samsung-heading heading-reveal">
                    <Landmark className="w-4 h-4 text-yellow-400" /> Financial Accounts
                  </h3>
                  <button
                    onClick={() => navigateTo({ main: 'accounts', accSub: 'wallets' })}
                    className="text-xs text-yellow-300 hover:underline font-bold"
                  >
                    Manage / Transfer →
                  </button>
                </div>
                <div className="space-y-2.5">
                  {accounts.map(acc => (
                    <div
                      key={acc.id}
                      className="bg-slate-800/90 p-3.5 rounded-xl border border-white/15 flex justify-between items-center"
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{acc.name}</div>
                        <div className="text-[11px] text-yellow-300 font-mono">
                          {acc.type} • {acc.account_number || 'Active'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-emerald-300 tabular-nums">
                          PKR {pkr(acc.current_balance).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-300">Available</div>
                      </div>
                    </div>
                  ))}
                  {pkr(stats.total_loan_payable) > 0 && (
                    <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-400/40 flex justify-between items-center text-xs">
                      <span className="font-bold text-rose-200">Arranged Loans / Capital Payable:</span>
                      <span className="font-mono font-extrabold text-rose-300">
                        PKR {pkr(stats.total_loan_payable).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 2: BILLING & ACCOUNTS (VYAPAR MULTI-ITEM + PREVIOUS KHATA)
           ========================================================================= */}
        {currentNav.main === 'accounts' && (
          <div className="space-y-6 animate-fade-in">
            {currentNav.accSub === 'sales' && (
              <div className="space-y-6">
                <div className="glass-panel rounded-2xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                      <Plus className="w-4 h-4 text-yellow-400" /> CREATE VYAPAR SALE INVOICE / RETURN / ESTIMATE
                    </h3>
                    <div className="flex gap-1.5">
                      {([
                        { id: 'SALE', label: 'Tax / Trade Sale Invoice' },
                        { id: 'SALE_RETURN', label: 'Sale Return (Credit Note)' },
                        { id: 'ESTIMATE', label: 'Quotation / Estimate' }
                      ] as { id: SaleDocType; label: string }[]).map(dt => (
                        <button
                          key={dt.id}
                          type="button"
                          onClick={() => setSaleDocType(dt.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            saleDocType === dt.id
                              ? 'bg-rose-600 text-white border border-yellow-300'
                              : 'bg-slate-800 text-slate-200 border border-white/15'
                          }`}
                        >
                          {dt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleCreateSale} className="space-y-4">
                    {saleDocType === 'ESTIMATE' && (
                      <div className="p-3 rounded-xl bg-amber-950/90 border border-yellow-400 text-xs text-yellow-200 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <strong>Quotation / Estimate Mode Active:</strong> Estimates do not deduct stock or add to Sales Revenue until converted to a confirmed Sale Invoice.
                        </span>
                        <button
                          type="button"
                          onClick={() => setSaleDocType('SALE')}
                          className="btn-oil px-3 py-1 text-xs"
                        >
                          Switch to Confirmed Tax / Trade Sale Invoice
                        </button>
                      </div>
                    )}

                    {/* Customer & Searchable Group ID Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="lg:col-span-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-white font-semibold">Customer / Workshop Name</label>
                          <button
                            type="button"
                            onClick={() => setSaleMarkFav(f => !f)}
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border transition ${
                              saleMarkFav
                                ? 'bg-yellow-400 text-slate-950 border-yellow-300'
                                : 'bg-slate-800 text-slate-300 border-white/15 hover:text-white'
                            }`}
                          >
                            <Star className={`w-3 h-3 ${saleMarkFav ? 'fill-slate-950' : ''}`} />
                            {saleMarkFav ? 'Explicitly Marked Favorite' : 'Mark Customer Favorite'}
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="Type Customer Name or select saved customer below"
                          value={saleCustomerName}
                          onChange={e => {
                            setSaleCustomerName(e.target.value);
                            const match = customers.find(c => c.name.toLowerCase() === e.target.value.trim().toLowerCase());
                            if (match) handleSelectSaleCustomer(match);
                            else setSaleCustomerId(0);
                          }}
                          className="erp-input"
                        />
                        <select
                          value={saleCustomerId}
                          onChange={e => {
                            const c = customers.find(x => x.id === Number(e.target.value));
                            if (c) handleSelectSaleCustomer(c);
                          }}
                          className="erp-input text-yellow-300 font-semibold"
                        >
                          <option value={0}>Select Saved Customer ({customers.length} Total • {favoriteCustomers.length} Favorites)</option>
                          {customers.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.is_favorite ? '★ ' : ''}{c.name} ({c.city}) — Khata: PKR {pkr(c.current_receivable).toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">City & Phone</label>
                        <input
                          type="text"
                          placeholder="City (e.g. Khour / Jand)"
                          value={saleCustomerCity}
                          onChange={e => setSaleCustomerCity(e.target.value)}
                          className="mt-1 erp-input"
                        />
                        <input
                          type="text"
                          placeholder="Phone Number"
                          value={saleCustomerPhone}
                          onChange={e => setSaleCustomerPhone(e.target.value)}
                          className="mt-1.5 erp-input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-yellow-300 font-semibold">Customer Group (Searchable ID) & CNIC</label>
                        <SearchableGroupSelect
                          partyType="CUSTOMER"
                          selectedGroupId={saleCustomerGroupId}
                          selectedGroupName={saleCustomerGroup}
                          onSelectGroup={g => {
                            setSaleCustomerGroupId(g.id);
                            setSaleCustomerGroup(g.name);
                          }}
                          placeholder="Search or create customer group..."
                        />
                        <input
                          type="text"
                          placeholder="CNIC (Optional)"
                          value={saleCustomerCnic}
                          onChange={e => setSaleCustomerCnic(e.target.value)}
                          className="mt-1.5 erp-input"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-yellow-300 font-semibold">Dispatch Location</label>
                        <select
                          value={saleLocationId}
                          onChange={e => setSaleLocationId(Number(e.target.value))}
                          className="mt-1 erp-input"
                        >
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                          ))}
                        </select>
                        {activeSaleCustomer && (
                          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                            <button
                              type="button"
                              onClick={() => openCustomer360(activeSaleCustomer.id)}
                              className="btn-secondary py-2 px-2 text-[11px]"
                            >
                              <Eye className="w-3.5 h-3.5" /> 360° History
                            </button>
                            <button
                              type="button"
                              onClick={() => openCustomerAllocationModal(activeSaleCustomer.id)}
                              className="btn-oil py-2 px-2 text-[11px]"
                            >
                              Allocate Payment
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Smart Customer Outstanding Ledger & Previous Dues Banner */}
                    {activeSaleCustomer && (
                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-yellow-400/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="font-bold text-white">
                            Selected Customer: <span className="text-yellow-300">{activeSaleCustomer.name}</span> (ID #{activeSaleCustomer.id} • Group: {activeSaleCustomer.group_name || 'General Market'})
                          </div>
                          <div className="text-slate-200">
                            Authoritative Unpaid Bills Balance (Old Khata):{' '}
                            <strong className={customerPreviousDues > 0 ? 'text-rose-400 text-sm' : 'text-emerald-400'}>
                              PKR {customerPreviousDues.toLocaleString()}
                            </strong>
                            {' '}• Credit Limit: PKR {pkr(activeSaleCustomer.credit_limit).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {customerPreviousDues > 0 && saleDocType === 'SALE' && (
                            <label className="flex items-center gap-2 bg-slate-800 border border-white/20 px-3 py-2 rounded-xl cursor-pointer font-bold text-white">
                              <input
                                type="checkbox"
                                checked={saleIncludePrevDues}
                                onChange={e => setSaleIncludePrevDues(e.target.checked)}
                                className="w-4 h-4 accent-yellow-400"
                              />
                              Display Previous Balance on Invoice Printout
                            </label>
                          )}
                          <button
                            type="button"
                            onClick={() => openCustomerAllocationModal(activeSaleCustomer.id)}
                            className="btn-primary px-3.5 py-2 text-xs"
                          >
                            Receive & Allocate Payment Across Bills (PKR {customerPreviousDues.toLocaleString()})
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Product Entry Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-white/15">
                      <div className="lg:col-span-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-white font-semibold">Select or Type Product</label>
                          <button
                            type="button"
                            onClick={() => setSaleProdFav(f => !f)}
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border transition ${
                              saleProdFav
                                ? 'bg-yellow-400 text-slate-950 border-yellow-300'
                                : 'bg-slate-800 text-slate-300 border-white/15 hover:text-white'
                            }`}
                          >
                            <Star className={`w-3 h-3 ${saleProdFav ? 'fill-slate-950' : ''}`} />
                            {saleProdFav ? 'Favorite Product' : 'Mark Favorite'}
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Type Product Name"
                          value={saleProductName}
                          onChange={e => {
                            setSaleProductName(e.target.value);
                            const match = products.find(p => p.name.toLowerCase() === e.target.value.trim().toLowerCase());
                            setSaleProductId(match ? match.id : 0);
                          }}
                          className="mt-1 erp-input"
                        />
                        <div className="grid grid-cols-2 gap-2 mt-1.5">
                          <select
                            value={saleProductId}
                            onChange={e => handleSelectSaleProduct(Number(e.target.value))}
                            className="erp-input text-yellow-300 font-semibold"
                          >
                            <option value={0}>Select Product ({products.length} Total • {favoriteProducts.length} Fav)</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.is_favorite ? '★ ' : ''}{p.name} ({p.pack_size})
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Brand (e.g. ATH / Shell)"
                            value={saleCompanyName}
                            onChange={e => setSaleCompanyName(e.target.value)}
                            className="erp-input"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">Size (ML) & Btls/Ctn</label>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          <input
                            type="number"
                            placeholder="700"
                            value={salePackSize}
                            onChange={e => setSalePackSize(e.target.value)}
                            className="erp-input"
                          />
                          <input
                            type="number"
                            placeholder="12"
                            value={saleCartonSize}
                            onChange={e => setSaleCartonSize(e.target.value)}
                            className="erp-input text-yellow-300 font-bold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">Unit & Quantity</label>
                        <div className="flex gap-1.5 mt-1">
                          <select
                            value={saleUnitType}
                            onChange={e => setSaleUnitType(e.target.value as 'CARTON' | 'BOTTLE')}
                            className="erp-input font-bold text-yellow-300"
                          >
                            <option value="CARTON">CARTON</option>
                            <option value="BOTTLE">BOTTLE</option>
                          </select>
                          <input
                            type="number"
                            placeholder="Qty"
                            value={saleQuantity}
                            onChange={e => setSaleQuantity(e.target.value)}
                            className="erp-input"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">Current Sale Rate ({saleUnitType})</label>
                        <input
                          type="number"
                          placeholder="Whole PKR Rate"
                          value={saleRate}
                          onChange={e => setSaleRate(e.target.value)}
                          className="mt-1 erp-input font-bold text-emerald-300"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleAddSaleItemToCart}
                          className="w-full btn-oil py-2.5 px-3 text-xs uppercase"
                        >
                          <Plus className="w-4 h-4" /> Add Item to Bill
                        </button>
                      </div>
                    </div>

                    {/* Customer-Product Previous Sale Rate Reference Banner (Never overwrites input silently) */}
                    {activeSaleCustomer && selectedSaleProduct && (
                      <div className="p-3 rounded-xl bg-slate-900/95 border border-emerald-400/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="text-slate-300 font-semibold">
                            Historical Price Reference for <strong className="text-white">{activeSaleCustomer.name}</strong> on <strong className="text-yellow-300">{selectedSaleProduct.name}</strong>:
                          </span>{' '}
                          {previousRateLoading ? (
                            <span className="text-yellow-300 font-mono">Checking previous sales history...</span>
                          ) : previousRateRef?.found ? (
                            <span className="text-emerald-300 font-bold">
                              Last Sold at PKR {pkr(previousRateRef.applicable_rate).toLocaleString()} per {saleUnitType}{' '}
                              <span className="text-slate-300 font-normal">
                                (Invoice {previousRateRef.invoice_number} on {previousRateRef.invoice_date} • Qty: {previousRateRef.quantity} {previousRateRef.historical_unit_type})
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">
                              No previous confirmed sale history for this customer and product pair.
                            </span>
                          )}
                        </div>
                        {previousRateRef?.found && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300">
                              Current Rate Input: <strong className="text-white">PKR {saleRate ? pkr(saleRate).toLocaleString() : 'Not set'}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={handleApplyPreviousSaleRate}
                              className="btn-oil px-3 py-1.5 text-xs"
                            >
                              Use Previous Rate (PKR {pkr(previousRateRef.applicable_rate).toLocaleString()})
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Multi-Item Cart List */}
                    {saleCart.length > 0 && (
                      <div className="bg-slate-900/90 p-3.5 rounded-xl border border-yellow-400/40 space-y-2">
                        <div className="text-xs font-extrabold text-yellow-300 uppercase">
                          Items in Current Invoice ({saleCart.length})
                        </div>
                        {saleCart.map((it, idx) => (
                          <div key={idx} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-800/90 px-3 py-2 rounded-lg border border-white/10">
                            <div>
                              <strong className="text-white">{idx + 1}. {it.product_name}</strong> ({it.pack_size} ML) —{' '}
                              <span className="text-yellow-300 font-mono">
                                {it.quantity} {it.unit_type} ({it.base_bottles} Btls = {it.cartons} Ctn + {it.loose_bottles} Btl)
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-emerald-300">
                                @ PKR {it.unit_rate.toLocaleString()} = PKR {it.line_total.toLocaleString()}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSaleCart(prev => prev.filter((_, i) => i !== idx))}
                                className="btn-danger px-2.5 py-1 text-[11px]"
                              >
                                Remove Item
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Stock Availability Alert */}
                    {selectedSaleProduct && saleDocType === 'SALE' && (
                      <div className="rounded-xl p-3 bg-slate-900/90 border border-white/15 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span>Stock in </span>
                            <strong className="text-yellow-300">{selectedSaleLocName}</strong>:{' '}
                            <strong className={saleLocAvailableBottles > 0 ? 'text-emerald-300' : 'text-rose-400'}>
                              {Math.floor(saleLocAvailableBottles / saleUpc)} Cartons & {saleLocAvailableBottles % saleUpc} Bottles ({saleLocAvailableBottles} Total Btls)
                            </strong>
                          </div>
                          <div>
                            Default Catalog Rate: <strong className="text-emerald-300">PKR {pkr(selectedSaleProduct.carton_sale_rate).toLocaleString()}/Ctn</strong>
                          </div>
                        </div>
                        {isSaleStockInsufficient && saleAlternativeLocations.length > 0 && (
                          <div className="p-2.5 rounded-lg bg-amber-950/90 border border-yellow-400 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-yellow-200 font-bold">Stock available in another location! Click to switch dispatch location:</span>
                            <div className="flex gap-2">
                              {saleAlternativeLocations.map(alt => (
                                <button
                                  key={alt.location_id}
                                  type="button"
                                  onClick={() => setSaleLocationId(alt.location_id)}
                                  className="btn-oil px-3 py-1 text-xs"
                                >
                                  Switch to {alt.location_name} ({alt.stock_bottles} Btls)
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Discount, Freight, Payment Terms & Receiving Account */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-white/15">
                      <div>
                        <label className="text-xs text-white font-semibold">Discount (PKR)</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={saleDiscount}
                          onChange={e => setSaleDiscount(e.target.value)}
                          className="mt-1 erp-input"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white font-semibold">Freight / Bilty (PKR)</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={saleFreight}
                          onChange={e => setSaleFreight(e.target.value)}
                          className="mt-1 erp-input"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white font-semibold">Payment Terms (This Bill)</label>
                        <select
                          value={salePaymentMode}
                          onChange={e => {
                            const m = e.target.value as 'UNPAID' | 'PARTIAL' | 'PAID';
                            setSalePaymentMode(m);
                            if (m === 'UNPAID') setSaleReceived('');
                          }}
                          className="mt-1 erp-input font-bold text-yellow-300"
                        >
                          <option value="UNPAID">Unpaid / Credit (Add to Khata)</option>
                          <option value="PARTIAL">Partial Payment on This Bill</option>
                          <option value="PAID">Full Paid (This Bill: PKR {computedSaleTotal.toLocaleString()})</option>
                        </select>
                      </div>
                      {salePaymentMode === 'PARTIAL' && (
                        <div>
                          <label className="text-xs text-yellow-300 font-semibold">Received for This Bill (PKR)</label>
                          <input
                            type="number"
                            required
                            placeholder={`Max PKR ${computedSaleTotal}`}
                            value={saleReceived}
                            onChange={e => setSaleReceived(e.target.value)}
                            className="mt-1 erp-input font-bold text-emerald-300"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-white font-semibold">Receiving Account</label>
                        <select
                          value={saleAccountId}
                          onChange={e => setSaleAccountId(Number(e.target.value))}
                          className="mt-1 erp-input"
                        >
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} (PKR {pkr(a.current_balance).toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Live Invoice Summary Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/15">
                      <div className="space-y-1 text-xs tabular-nums">
                        <div className="flex flex-wrap gap-4 text-white">
                          <span>Current Bill Total: <strong className="text-yellow-300">PKR {computedSaleTotal.toLocaleString()}</strong></span>
                          <span>Previous Khata: <strong className="text-rose-300">PKR {customerPreviousDues.toLocaleString()}</strong></span>
                          <span>Received on This Bill: <strong className="text-emerald-300">PKR {Math.min(computedSaleTotal, computedSaleReceived).toLocaleString()}</strong></span>
                          <span>Projected Total Khata: <strong className="text-rose-400">PKR {pkr(customerPreviousDues + Math.max(0, computedSaleTotal - Math.min(computedSaleTotal, computedSaleReceived))).toLocaleString()}</strong></span>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isSaleStockInsufficient}
                        className="btn-primary py-3 px-6 text-xs uppercase"
                      >
                        {isSaleStockInsufficient ? 'Stock Unavailable in Selected Location' : `Confirm & Post ${saleDocType === 'SALE' ? 'Sale Invoice' : saleDocType}`} <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>

                {/* Sales Register Table with Search, Document Filter & Location Filter */}
                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                        SALES, RETURNS & QUOTATIONS REGISTER ({filteredSalesRegister.length} OF {sales.length} RECORDS)
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Showing persisted records for timeframe: <strong className="text-yellow-300 uppercase">{period}</strong>
                        {period !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setPeriod('all')}
                            className="ml-2 underline text-yellow-300 font-bold"
                          >
                            Show All-Time Persisted Sales
                          </button>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-yellow-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          placeholder="Search Invoice #, Customer, Product..."
                          value={salesRegisterSearch}
                          onChange={e => setSalesRegisterSearch(e.target.value)}
                          className="erp-input pl-8 py-1.5 text-xs w-56"
                        />
                      </div>

                      <select
                        value={salesRegisterDocFilter}
                        onChange={e => setSalesRegisterDocFilter(e.target.value as any)}
                        className="erp-input py-1.5 text-xs w-40 font-bold text-yellow-300"
                      >
                        <option value="ALL">All Types ({sales.length})</option>
                        <option value="SALE">Confirmed Sales ({sales.filter(x => (x.doc_type || 'SALE') === 'SALE').length})</option>
                        <option value="ESTIMATE">Estimates ({sales.filter(x => x.doc_type === 'ESTIMATE').length})</option>
                        <option value="SALE_RETURN">Sale Returns ({sales.filter(x => x.doc_type === 'SALE_RETURN').length})</option>
                      </select>

                      <select
                        value={salesRegisterLocationId}
                        onChange={e => setSalesRegisterLocationId(Number(e.target.value))}
                        className="erp-input py-1.5 text-xs w-44"
                      >
                        <option value={0}>All Locations</option>
                        {locations.map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {sales.some(s => s.doc_type === 'ESTIMATE') && (
                    <div className="p-3 rounded-xl bg-amber-950/80 border border-yellow-400/50 text-xs text-yellow-200 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <strong>Note:</strong> You have {sales.filter(s => s.doc_type === 'ESTIMATE').length} Quotation/Estimate record(s). Estimates are not counted in confirmed Sales Revenue or Customer Khata until you click <strong>"Convert Estimate to Sale"</strong>.
                      </span>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs erp-table min-w-[920px]">
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Date & Time</th>
                          <th>Customer & Group</th>
                          <th>Location</th>
                          <th>Items, Qty & Rate Breakdown</th>
                          <th>Bill Total</th>
                          <th>Paid</th>
                          <th>Bill Remaining</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSalesRegister.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center py-8 text-slate-300">
                              No sales match the current filter ({period.toUpperCase()}).{' '}
                              {period !== 'all' && (
                                <button
                                  type="button"
                                  onClick={() => setPeriod('all')}
                                  className="underline text-yellow-300 font-bold ml-1"
                                >
                                  Click here to view All-Time Sales
                                </button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredSalesRegister.map(s => (
                            <tr key={s.id}>
                              <td className="font-mono font-bold text-yellow-300">
                                {s.invoice_number}
                                <span
                                  className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    s.doc_type === 'ESTIMATE'
                                      ? 'bg-amber-600 text-white'
                                      : s.doc_type === 'SALE_RETURN'
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-emerald-600/30 text-emerald-200 border border-emerald-400/40'
                                  }`}
                                >
                                  {s.doc_type || 'SALE'}
                                </span>
                              </td>
                              <td className="text-slate-200 font-mono">{s.invoice_date}</td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => openCustomer360(s.customer_id)}
                                  className="font-bold text-white hover:text-yellow-300 underline text-left"
                                >
                                  {s.customer_name}
                                </button>
                                <div className="text-[10px] text-slate-300">{s.customer_city} • {s.customer_group}</div>
                              </td>
                              <td className="text-yellow-300 font-semibold">{s.location_summary}</td>
                              <td className="text-slate-100 max-w-xs">{s.items_summary}</td>
                              <td className="font-bold text-white tabular-nums">PKR {pkr(s.total_amount).toLocaleString()}</td>
                              <td className="text-emerald-300 font-bold tabular-nums">
                                PKR {pkr(s.received_amount).toLocaleString()}
                              </td>
                              <td className="font-bold text-rose-300 tabular-nums">
                                PKR {pkr(s.receivable_amount).toLocaleString()}
                                <div className="text-[10px] font-mono text-slate-300">{s.payment_status}</div>
                              </td>
                              <td className="text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setInvoiceModal({ kind: 'SALE', sale: s })}
                                  className="btn-oil px-2.5 py-1 text-[11px]"
                                >
                                  View / Share Bill
                                </button>
                                {s.doc_type === 'ESTIMATE' && (
                                  <button
                                    type="button"
                                    onClick={() => handleConvertEstimate(s.id)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                  >
                                    Convert Estimate to Sale
                                  </button>
                                )}
                                {s.receivable_amount > 0 && s.doc_type !== 'ESTIMATE' && (
                                  <button
                                    type="button"
                                    onClick={() => openCustomerAllocationModal(s.customer_id)}
                                    className="btn-primary px-2.5 py-1 text-[11px]"
                                  >
                                    Allocate Payment
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => triggerReverse('SALE', s.id, s.invoice_number)}
                                  className="btn-danger px-2 py-1 text-[11px]"
                                  title="Reverse Invoice"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Reverse
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* PURCHASE BILLS & PAYMENT ARRANGEMENT ENGINE */}
            {currentNav.accSub === 'purchases' && (
              <div className="space-y-6">
                <div className="glass-panel rounded-2xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                      <ShoppingCart className="w-4 h-4 text-yellow-400" /> RECORD SUPPLIER PURCHASE BILL / RETURN
                    </h3>
                    <div className="flex gap-1.5">
                      {([
                        { id: 'PURCHASE', label: 'Stock Purchase Bill' },
                        { id: 'PURCHASE_RETURN', label: 'Purchase Return (Debit Note)' }
                      ] as { id: PurchaseDocType; label: string }[]).map(dt => (
                        <button
                          key={dt.id}
                          type="button"
                          onClick={() => setPurDocType(dt.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            purDocType === dt.id
                              ? 'bg-yellow-400 text-slate-950'
                              : 'bg-slate-800 text-slate-200 border border-white/15'
                          }`}
                        >
                          {dt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleCreatePurchase} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-white font-semibold">Supplier / Company Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Type Supplier Name"
                          value={purSupplierName}
                          onChange={e => {
                            setPurSupplierName(e.target.value);
                            setPurSupplierId(0);
                          }}
                          className="erp-input"
                        />
                        <select
                          value={purSupplierId}
                          onChange={e => {
                            const s = suppliers.find(x => x.id === Number(e.target.value));
                            if (s) {
                              setPurSupplierId(s.id);
                              setPurSupplierName(s.name);
                              setPurSupplierCity(s.city);
                              setPurSupplierPhone(s.phone || '');
                              setPurSupplierCnic(s.cnic || '');
                              setPurSupplierGroup(s.group_name || 'General Suppliers');
                            }
                          }}
                          className="erp-input text-yellow-300 font-semibold"
                        >
                          <option value={0}>★ Pick Supplier ({suppliers.length})</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">City & Phone</label>
                        <input
                          type="text"
                          placeholder="City"
                          value={purSupplierCity}
                          onChange={e => setPurSupplierCity(e.target.value)}
                          className="mt-1 erp-input"
                        />
                        <input
                          type="text"
                          placeholder="Phone"
                          value={purSupplierPhone}
                          onChange={e => setPurSupplierPhone(e.target.value)}
                          className="mt-1.5 erp-input"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">Supplier Group & CNIC</label>
                        <input
                          type="text"
                          placeholder="Group"
                          value={purSupplierGroup}
                          onChange={e => setPurSupplierGroup(e.target.value)}
                          className="mt-1 erp-input"
                        />
                        <input
                          type="text"
                          placeholder="CNIC (Optional)"
                          value={purSupplierCnic}
                          onChange={e => setPurSupplierCnic(e.target.value)}
                          className="mt-1.5 erp-input"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-yellow-300 font-semibold">Store In Warehouse</label>
                        <select
                          value={purLocationId}
                          onChange={e => setPurLocationId(Number(e.target.value))}
                          className="mt-1 erp-input"
                        >
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Product Entry Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-white/15">
                      <div className="lg:col-span-2">
                        <label className="text-xs text-white font-semibold">Product & Company</label>
                        <input
                          type="text"
                          placeholder="Type Product Name"
                          value={purProductName}
                          onChange={e => {
                            setPurProductName(e.target.value);
                            const match = products.find(p => p.name.toLowerCase() === e.target.value.trim().toLowerCase());
                            setPurProductId(match ? match.id : 0);
                          }}
                          className="mt-1 erp-input"
                        />
                        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                          <select
                            value={purProductId}
                            onChange={e => handleSelectPurProduct(Number(e.target.value))}
                            className="erp-input text-yellow-300 font-semibold"
                          >
                            <option value={0}>★ Pick Product ({products.length})</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.pack_size})</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Company"
                            value={purCompanyName}
                            onChange={e => setPurCompanyName(e.target.value)}
                            className="erp-input"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">Size (ML) & Btls/Ctn</label>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          <input
                            type="number"
                            value={purPackSize}
                            onChange={e => setPurPackSize(e.target.value)}
                            className="erp-input"
                          />
                          <input
                            type="number"
                            value={purCartonSize}
                            onChange={e => setPurCartonSize(e.target.value)}
                            className="erp-input text-yellow-300 font-bold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">Unit & Quantity</label>
                        <div className="flex gap-1.5 mt-1">
                          <select
                            value={purUnitType}
                            onChange={e => setPurUnitType(e.target.value as 'CARTON' | 'BOTTLE')}
                            className="erp-input font-bold text-yellow-300"
                          >
                            <option value="CARTON">CARTON</option>
                            <option value="BOTTLE">BOTTLE</option>
                          </select>
                          <input
                            type="number"
                            placeholder="Qty"
                            value={purQuantity}
                            onChange={e => setPurQuantity(e.target.value)}
                            className="erp-input"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">Buy Rate ({purUnitType})</label>
                        <input
                          type="number"
                          placeholder="PKR Rate"
                          value={purRate}
                          onChange={e => setPurRate(e.target.value)}
                          className="mt-1 erp-input font-bold text-yellow-300"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleAddPurItemToCart}
                          className="w-full btn-oil py-2.5 px-3 text-xs uppercase flex items-center justify-center gap-1"
                        >
                          <Plus className="w-4 h-4" /> Add to Bill
                        </button>
                      </div>
                    </div>

                    {purCart.length > 0 && (
                      <div className="bg-slate-900/90 p-3.5 rounded-xl border border-yellow-400/40 space-y-2">
                        <div className="text-xs font-extrabold text-yellow-300 uppercase">
                          Items in Purchase Bill ({purCart.length})
                        </div>
                        {purCart.map((it, idx) => (
                          <div key={idx} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-800 px-3 py-2 rounded-lg">
                            <span>
                              <strong className="text-white">{idx + 1}. {it.product_name}</strong> ({it.pack_size} ML) — {it.quantity} {it.unit_type} ({it.base_bottles} Btls)
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-yellow-300">PKR {it.line_total.toLocaleString()}</span>
                              <button
                                type="button"
                                onClick={() => setPurCart(prev => prev.filter((_, i) => i !== idx))}
                                className="text-rose-400 font-bold"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Payment & Zero-Cash Protection / Loan Arrangement Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-white/15">
                      <div>
                        <label className="text-xs text-white font-semibold">Payment Terms</label>
                        <select
                          value={purPaymentMode}
                          onChange={e => {
                            const m = e.target.value as 'UNPAID' | 'PARTIAL' | 'PAID';
                            setPurPaymentMode(m);
                            if (m === 'UNPAID') setPurPaid('');
                          }}
                          className="mt-1 erp-input font-bold text-yellow-300"
                        >
                          <option value="UNPAID">Unpaid (Supplier Khata)</option>
                          <option value="PARTIAL">Partial Paid</option>
                          <option value="PAID">Full Paid</option>
                        </select>
                      </div>

                      {purPaymentMode === 'PARTIAL' && (
                        <div>
                          <label className="text-xs text-yellow-300 font-semibold">Paid Now (PKR)</label>
                          <input
                            type="number"
                            required
                            placeholder="PKR Paid"
                            value={purPaid}
                            onChange={e => setPurPaid(e.target.value)}
                            className="mt-1 erp-input"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-xs text-white font-semibold">Payment Account</label>
                        <select
                          value={purAccountId}
                          onChange={e => setPurAccountId(Number(e.target.value))}
                          className="mt-1 erp-input"
                        >
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} (Avail: PKR {pkr(a.current_balance).toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-yellow-300 font-semibold">How Is Payment Arranged?</label>
                        <select
                          value={purArrangement}
                          onChange={e => setPurArrangement(e.target.value as PaymentArrangementType)}
                          className="mt-1 erp-input font-bold"
                        >
                          <option value="WALLET">Deduct from Selected Account</option>
                          <option value="OWNER_CAPITAL">Arranged from Owner Pocket / Capital</option>
                          <option value="MARKET_LOAN">Arranged via Market Loan / Udhaar</option>
                        </select>
                      </div>

                      {(purArrangement === 'OWNER_CAPITAL' || purArrangement === 'MARKET_LOAN') && (
                        <div>
                          <label className="text-xs text-rose-300 font-semibold">Lender / Owner Name</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Owner Pocket / Ali Loan"
                            value={purLenderName}
                            onChange={e => setPurLenderName(e.target.value)}
                            className="mt-1 erp-input"
                          />
                        </div>
                      )}
                    </div>

                    {/* Zero-Cash Warning Alert */}
                    {isPurWalletInsufficient && (
                      <div className="p-3.5 rounded-xl bg-rose-950/90 border border-rose-400 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="text-white font-bold">
                          ⚠️ Insufficient Balance in <span className="text-yellow-300">{selectedPurAccount?.name}</span> (Available: PKR {pkr(selectedPurAccount?.current_balance).toLocaleString()}, Required: PKR {computedPurPaid.toLocaleString()}). Account cannot go negative!
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => { setPurArrangement('OWNER_CAPITAL'); setPurLenderName('Owner Pocket Capital'); }}
                            className="btn-oil px-3 py-1.5 text-xs"
                          >
                            Use Owner Pocket Capital
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPurArrangement('MARKET_LOAN'); setPurLenderName('Market Loan'); }}
                            className="bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                          >
                            Record as Market Loan
                          </button>
                          <button
                            type="button"
                            onClick={() => setPurPaymentMode('UNPAID')}
                            className="bg-slate-800 text-white border border-white/20 px-3 py-1.5 rounded-lg text-xs font-bold"
                          >
                            Keep on Supplier Credit
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/15">
                      <div className="flex flex-wrap gap-4 text-xs text-white tabular-nums">
                        <span>Total Bill: <strong className="text-yellow-300">PKR {computedPurTotal.toLocaleString()}</strong></span>
                        <span>Paid Today: <strong className="text-emerald-300">PKR {computedPurPaid.toLocaleString()}</strong></span>
                        <span>Remaining Payable: <strong className="text-rose-300">PKR {Math.max(0, computedPurTotal - computedPurPaid).toLocaleString()}</strong></span>
                      </div>
                      <button
                        type="submit"
                        disabled={Boolean(isPurWalletInsufficient)}
                        className={`py-3 px-6 text-xs uppercase rounded-xl font-bold ${
                          isPurWalletInsufficient ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'btn-oil'
                        }`}
                      >
                        Save Purchase & Update Stock
                      </button>
                    </div>
                  </form>
                </div>

                {/* Purchase Register */}
                <div className="glass-panel rounded-2xl p-5">
                  <h3 className="text-sm font-extrabold text-white mb-4 samsung-heading heading-reveal">PURCHASE BILLS REGISTER</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs erp-table min-w-[820px]">
                      <thead>
                        <tr>
                          <th>Bill #</th>
                          <th>Date</th>
                          <th>Supplier</th>
                          <th>Items & Carton Breakdown</th>
                          <th>Total Bill</th>
                          <th>Paid</th>
                          <th>Payable</th>
                          <th className="text-right">Bill / Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map(p => (
                          <tr key={p.id}>
                            <td className="font-mono font-bold text-yellow-300">{p.purchase_number}</td>
                            <td className="text-slate-200 font-mono">{p.invoice_date}</td>
                            <td className="font-bold text-white">{p.supplier_name}</td>
                            <td className="text-slate-100 max-w-xs">{p.items_summary}</td>
                            <td className="font-bold text-white tabular-nums">PKR {pkr(p.total_amount).toLocaleString()}</td>
                            <td className="text-emerald-300 font-bold tabular-nums">PKR {pkr(p.paid_amount).toLocaleString()}</td>
                            <td className="font-bold text-rose-300 tabular-nums">PKR {pkr(p.payable_amount).toLocaleString()}</td>
                            <td className="text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => setInvoiceModal({ kind: 'PURCHASE', purchase: p })}
                                className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 px-2.5 py-1 rounded-lg text-[11px] font-extrabold"
                              >
                                View Bill
                              </button>
                              {p.payable_amount > 0 && (
                                <button
                                  onClick={() =>
                                    setPartialModal({
                                      kind: 'PURCHASE',
                                      id: p.id,
                                      refNumber: p.purchase_number,
                                      partyName: p.supplier_name,
                                      totalAmount: pkr(p.total_amount),
                                      alreadyPaid: pkr(p.paid_amount),
                                      remainingBalance: pkr(p.payable_amount)
                                    })
                                  }
                                  className="bg-amber-500/25 hover:bg-amber-500 text-yellow-300 hover:text-slate-950 border border-yellow-400/40 px-2 py-1 rounded-lg text-[11px] font-bold"
                                >
                                  + Pay
                                </button>
                              )}
                              <button
                                onClick={() => triggerReverse('PURCHASE', p.id, p.purchase_number)}
                                className="text-rose-300 hover:text-white p-1"
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

            {/* PARTIAL PAYMENTS TAB */}
            {currentNav.accSub === 'partials' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <Clock className="w-4 h-4 text-emerald-400" /> CUSTOMER PENDING KHATA INVOICES ({pendingSales.length})
                  </h3>
                  {pendingSales.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-300">No pending customer invoices.</div>
                  ) : (
                    pendingSales.map(s => (
                      <div key={s.id} className="bg-slate-800/90 p-4 rounded-xl border border-white/15 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-xs font-bold text-yellow-300">{s.invoice_number}</span>
                            <div className="text-sm font-bold text-white">{s.customer_name}</div>
                            <div className="text-[11px] text-slate-200">{s.items_summary}</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openCustomerAllocationModal(s.customer_id)}
                              className="btn-primary px-3 py-1.5 text-xs"
                            >
                              Allocate & Receive Payment
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between text-[11px] pt-2 border-t border-white/15 tabular-nums">
                          <span>Bill: PKR {pkr(s.total_amount).toLocaleString()}</span>
                          <span className="text-emerald-300">Received: PKR {pkr(s.received_amount).toLocaleString()}</span>
                          <span className="text-yellow-300 font-bold">Pending: PKR {pkr(s.receivable_amount).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <Clock className="w-4 h-4 text-yellow-400" /> SUPPLIER PENDING BILLS ({pendingPurchases.length})
                  </h3>
                  {pendingPurchases.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-300">No pending supplier bills.</div>
                  ) : (
                    pendingPurchases.map(p => (
                      <div key={p.id} className="bg-slate-800/90 p-4 rounded-xl border border-white/15 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-xs font-bold text-yellow-300">{p.purchase_number}</span>
                            <div className="text-sm font-bold text-white">{p.supplier_name}</div>
                            <div className="text-[11px] text-slate-200">{p.items_summary}</div>
                          </div>
                          <button
                            onClick={() =>
                              setPartialModal({
                                kind: 'PURCHASE',
                                id: p.id,
                                refNumber: p.purchase_number,
                                partyName: p.supplier_name,
                                totalAmount: pkr(p.total_amount),
                                alreadyPaid: pkr(p.paid_amount),
                                remainingBalance: pkr(p.payable_amount)
                              })
                            }
                            className="btn-oil px-3 py-1.5 text-xs"
                          >
                            + Pay PKR
                          </button>
                        </div>
                        <div className="flex justify-between text-[11px] pt-2 border-t border-white/15 tabular-nums">
                          <span>Bill: PKR {pkr(p.total_amount).toLocaleString()}</span>
                          <span className="text-emerald-300">Paid: PKR {pkr(p.paid_amount).toLocaleString()}</span>
                          <span className="text-rose-300 font-bold">Payable: PKR {pkr(p.payable_amount).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* OPERATING EXPENSES TAB */}
            {currentNav.accSub === 'expenses' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleCreateExpense} className="glass-panel rounded-2xl p-5 space-y-3.5">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <Truck className="w-4 h-4 text-rose-400" /> RECORD OPERATING EXPENSE
                  </h3>
                  <select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="erp-input">
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
                    value={expAccountId}
                    onChange={e => setExpAccountId(Number(e.target.value))}
                    className="erp-input"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} (Avail: PKR {pkr(a.current_balance).toLocaleString()})
                      </option>
                    ))}
                  </select>
                  <select
                    value={expArrangement}
                    onChange={e => setExpArrangement(e.target.value as PaymentArrangementType)}
                    className="erp-input font-bold text-yellow-300"
                  >
                    <option value="WALLET">Deduct from Selected Account</option>
                    <option value="OWNER_CAPITAL">Paid from Owner Pocket / Capital</option>
                    <option value="MARKET_LOAN">Paid via Market Loan / Udhaar</option>
                  </select>
                  {expArrangement !== 'WALLET' && (
                    <input
                      type="text"
                      required
                      placeholder="Lender / Owner Name"
                      value={expLenderName}
                      onChange={e => setExpLenderName(e.target.value)}
                      className="erp-input"
                    />
                  )}
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
                        <th>Channel</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">Reverse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map(exp => (
                        <tr key={exp.id}>
                          <td className="font-mono text-slate-200">{exp.expense_number}</td>
                          <td className="font-bold text-yellow-300">{exp.category}</td>
                          <td className="text-white">{exp.description}</td>
                          <td className="font-mono">{exp.payment_method}</td>
                          <td className="text-right font-bold text-rose-300 tabular-nums">PKR {pkr(exp.amount).toLocaleString()}</td>
                          <td className="text-right">
                            <button onClick={() => triggerReverse('EXPENSE', exp.id, exp.expense_number)} className="text-rose-300">
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

            {/* WALLETS, TRANSFERS & LOAN ARRANGEMENT TRACKER */}
            {currentNav.accSub === 'wallets' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <form onSubmit={handleAdjustAccountBalance} className="glass-panel rounded-2xl p-5 space-y-3 border border-emerald-400/30">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                      <Plus className="w-4 h-4 text-emerald-400" /> ADD OR WITHDRAW FUNDS (+PKR)
                    </h3>
                    <select value={adjAccountId} onChange={e => setAdjAccountId(Number(e.target.value))} className="erp-input">
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} — Curr: PKR {pkr(acc.current_balance).toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={adjOperation}
                        onChange={e => setAdjOperation(e.target.value as 'DEPOSIT' | 'WITHDRAW')}
                        className="erp-input font-bold text-yellow-300"
                      >
                        <option value="DEPOSIT">+ DEPOSIT</option>
                        <option value="WITHDRAW">- WITHDRAW</option>
                      </select>
                      <input
                        type="number"
                        required
                        placeholder="Amount PKR"
                        value={adjAmount}
                        onChange={e => setAdjAmount(e.target.value)}
                        className="erp-input"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Reason / Note"
                      value={adjRemarks}
                      onChange={e => setAdjRemarks(e.target.value)}
                      className="erp-input"
                    />
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase">
                      {adjOperation === 'DEPOSIT' ? '+ Add Funds' : '- Withdraw Funds'}
                    </button>
                  </form>

                  <form onSubmit={handleTransferBetweenAccounts} className="glass-panel rounded-2xl p-5 space-y-3 border border-yellow-400/30">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                      <ArrowLeftRight className="w-4 h-4 text-yellow-400" /> TRANSFER BETWEEN ACCOUNTS
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-rose-300 font-bold">From Account</label>
                        <select value={trfFromAccId} onChange={e => setTrfFromAccId(Number(e.target.value))} className="mt-1 erp-input">
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name} ({pkr(acc.current_balance).toLocaleString()})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-emerald-300 font-bold">To Account</label>
                        <select value={trfToAccId} onChange={e => setTrfToAccId(Number(e.target.value))} className="mt-1 erp-input">
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name} ({pkr(acc.current_balance).toLocaleString()})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <input
                      type="number"
                      required
                      placeholder="Transfer Amount PKR"
                      value={trfAccAmount}
                      onChange={e => setTrfAccAmount(e.target.value)}
                      className="erp-input"
                    />
                    <input
                      type="text"
                      placeholder="Transfer Note"
                      value={trfAccRemarks}
                      onChange={e => setTrfAccRemarks(e.target.value)}
                      className="erp-input"
                    />
                    <button type="submit" className="w-full btn-oil py-2.5 text-xs uppercase">Transfer Funds Now</button>
                  </form>

                  <form onSubmit={handleSaveAccount} className="glass-panel rounded-2xl p-5 space-y-3">
                    <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                      {editingAccountId ? 'EDIT ACCOUNT' : 'CREATE NEW ACCOUNT'}
                    </h3>
                    <input
                      type="text"
                      required
                      placeholder="Account Title (e.g. Meezan Bank)"
                      value={accName}
                      onChange={e => setAccName(e.target.value)}
                      className="erp-input"
                    />
                    <select value={accType} onChange={e => setAccType(e.target.value)} className="erp-input">
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
                      placeholder="Opening Balance (PKR)"
                      value={accBalance}
                      onChange={e => setAccBalance(e.target.value)}
                      className="erp-input"
                    />
                    <button type="submit" className="w-full btn-primary py-2.5 text-xs uppercase">
                      {editingAccountId ? 'Save Changes' : 'Create Account'}
                    </button>
                  </form>
                </div>

                {/* Live Account Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {accounts.map(acc => (
                    <div key={acc.id} className="glass-panel p-5 rounded-2xl flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase bg-slate-900 px-2.5 py-0.5 rounded-full text-yellow-300 border border-yellow-400/30">
                            {acc.type}
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                setEditingAccountId(acc.id);
                                setAccName(acc.name);
                                setAccType(acc.type);
                                setAccNumber(acc.account_number || '');
                                setAccBalance(String(pkr(acc.current_balance)));
                              }}
                              className="p-1.5 bg-slate-800 text-yellow-300 rounded-lg"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => triggerReverse('ACCOUNT', acc.id, acc.name)}
                              className="p-1.5 bg-slate-800 text-rose-300 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="text-base font-bold text-white mt-2">{acc.name}</div>
                        <div className="text-xs text-slate-300 font-mono">{acc.account_number || 'N/A'}</div>
                      </div>
                      <div className="text-2xl font-black text-emerald-300 tabular-nums border-t border-white/15 pt-3">
                        PKR {pkr(acc.current_balance).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Loan & Owner Capital Arrangement Tracker */}
                <div className="glass-panel rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                    ARRANGED LOANS & OWNER POCKET CAPITAL LEDGER ({loans.length})
                  </h3>
                  {loans.length === 0 ? (
                    <div className="text-xs text-slate-300 py-4">
                      No external loans or owner pocket arrangements recorded yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs erp-table">
                        <thead>
                          <tr>
                            <th>Lender / Source</th>
                            <th>Type</th>
                            <th>Total Arranged</th>
                            <th>Total Repaid</th>
                            <th>Payable Balance</th>
                            <th className="text-right">Settle / Repay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loans.map(ln => (
                            <tr key={ln.id}>
                              <td className="font-bold text-white">{ln.lender_name}</td>
                              <td className="font-mono text-yellow-300">{ln.loan_type}</td>
                              <td className="tabular-nums">PKR {pkr(ln.total_borrowed).toLocaleString()}</td>
                              <td className="text-emerald-300 tabular-nums">PKR {pkr(ln.total_repaid).toLocaleString()}</td>
                              <td className="font-bold text-rose-300 tabular-nums">PKR {pkr(ln.current_balance).toLocaleString()}</td>
                              <td className="text-right">
                                {ln.current_balance > 0 && (
                                  <button
                                    onClick={() => setLoanRepayModal(ln)}
                                    className="btn-oil px-3 py-1 text-xs"
                                  >
                                    Repay Now
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LEDGER HISTORY TAB */}
            {currentNav.accSub === 'ledger' && (
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                    <FileText className="w-4 h-4 text-yellow-400" /> COMPLETE PKR CASHFLOW LEDGER ({period.toUpperCase()})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {['ALL', 'CASH', 'BANK', 'EASYPAISA', 'JAZZCASH'].map(ch => (
                      <button
                        key={ch}
                        onClick={() => setChannelFilter(ch)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                          channelFilter === ch ? 'bg-yellow-400 text-slate-950' : 'bg-slate-800 text-slate-200 border border-white/15'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs erp-table min-w-[720px]">
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
                          <td className="font-mono text-slate-200">{h.date}</td>
                          <td className="font-bold text-white">{h.type}</td>
                          <td className="font-mono text-yellow-300 font-bold">{h.reference}</td>
                          <td className="text-white font-semibold">{h.party}</td>
                          <td className="font-mono text-amber-300">{h.channel}</td>
                          <td className="text-slate-200">{h.description}</td>
                          <td className="text-right font-bold text-emerald-300 tabular-nums">
                            {h.cash_in > 0 ? `+PKR ${pkr(h.cash_in).toLocaleString()}` : '-'}
                          </td>
                          <td className="text-right font-bold text-rose-300 tabular-nums">
                            {h.cash_out > 0 ? `-PKR ${pkr(h.cash_out).toLocaleString()}` : '-'}
                          </td>
                          <td className="text-right">
                            <button onClick={() => triggerReverse(h.entity_type, h.entity_id, h.reference)} className="text-rose-300 p-1">
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
                    <Layers className="w-4 h-4 text-yellow-400" /> SET / ADJUST LOCATION STOCK BY BOTTLE SIZE & CARTON CAPACITY
                  </h3>
                  <form onSubmit={handleSetLocationStock} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="text-xs text-white font-semibold">Product</label>
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
                          <option key={p.id} value={p.id}>{p.name} ({p.pack_size})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-yellow-300 font-semibold">Storage Location</label>
                      <select value={setStockLocId} onChange={e => setSetStockLocId(Number(e.target.value))} className="mt-1 erp-input">
                        {locations.map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
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
                          value={directPackSize}
                          onChange={e => setDirectPackSize(e.target.value)}
                          className="mt-1 erp-input"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-emerald-300 font-semibold">Btls / Carton</label>
                        <input
                          type="number"
                          required
                          value={directCartonMax}
                          onChange={e => setDirectCartonMax(e.target.value)}
                          className="mt-1 erp-input"
                        />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className="w-full btn-primary py-2.5 text-xs uppercase">Update Location Stock</button>
                    </div>
                  </form>
                  {setStockBottles !== '' && (
                    <div className="mt-3 text-xs text-emerald-300 font-bold">
                      Live Carton Preview: {directStockNum} Bottles = {directPreviewCartons} Cartons & {directPreviewLoose} Loose Bottles
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {enrichedLocations.map(loc => (
                    <div key={loc.id} className="glass-panel rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/15 pb-3">
                        <div>
                          <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 font-bold">
                            {loc.location_type}
                          </span>
                          <h3 className="text-base font-extrabold text-white mt-1.5 samsung-heading">{loc.name}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-yellow-300 tabular-nums">
                            {loc.total_bottles.toLocaleString()} Bottles
                          </span>
                        </div>
                      </div>
                      {loc.safeItems.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-300">No stock in {loc.name} yet.</div>
                      ) : (
                        <div className="space-y-2.5">
                          {loc.safeItems.map(item => (
                            <div key={item.product_id} className="bg-slate-800/90 p-3.5 rounded-xl border border-white/15 flex justify-between items-center">
                              <div>
                                <div className="text-sm font-bold text-white">
                                  <span className="text-yellow-300">{item.stock_bottles} Bottles</span> ({item.pack_size}) — {item.product_name}
                                </div>
                                <div className="text-xs text-emerald-300 font-bold">
                                  {item.cartons} Cartons & {item.loose_bottles} Loose Bottles (Max {item.units_per_carton}/Ctn)
                                </div>
                              </div>
                              <span className="font-mono text-[11px] bg-slate-900 px-2.5 py-1 rounded-lg text-yellow-300">{item.sku}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                      ALL PRODUCTS STOCK VALUATION, BUY/SALE RATES & CARTON BREAKDOWN
                    </h3>
                    <button
                      onClick={() => navigateTo({ main: 'inventory', invSub: 'products_crud' })}
                      className="btn-primary text-xs px-4 py-2"
                    >
                      + Add New Product
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs erp-table min-w-[860px]">
                      <thead>
                        <tr>
                          <th>Product & Size</th>
                          <th>Carton Capacity</th>
                          <th>Warehouse Breakdown</th>
                          <th>Total Stock</th>
                          <th>Buy & Sale Rates</th>
                          <th>Live Stock Value</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.id}>
                            <td>
                              <div className="font-bold text-white">{p.name}</div>
                              <div className="text-[11px] text-yellow-300 font-mono">{p.brand_name} • {p.pack_size} • {p.sku}</div>
                            </td>
                            <td className="font-mono font-bold text-yellow-300">{p.units_per_carton} Btls / Ctn</td>
                            <td>
                              {(p.locations || []).length === 0 ? (
                                <span className="text-slate-400">0 Btls</span>
                              ) : (
                                <div className="space-y-1">
                                  {(p.locations || []).map(l => (
                                    <div key={l.location_id} className="text-[11px]">
                                      <strong className="text-yellow-300">{l.location_name}:</strong> {l.cartons} Ctn + {l.loose_bottles} Btl ({l.stock_bottles} Btls)
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="font-extrabold text-white tabular-nums">{p.current_stock_bottles.toLocaleString()} Btls</div>
                              <div className="text-[11px] text-emerald-300 font-bold">{p.cartons} Ctn + {p.loose_bottles} Btl</div>
                            </td>
                            <td className="tabular-nums">
                              <div className="text-slate-200">Buy: <strong className="text-yellow-300">PKR {pkr(p.carton_purchase_rate).toLocaleString()}/Ctn</strong></div>
                              <div className="text-slate-200">Sale: <strong className="text-emerald-300">PKR {pkr(p.carton_sale_rate).toLocaleString()}/Ctn</strong></div>
                            </td>
                            <td className="font-extrabold text-yellow-300 tabular-nums">
                              PKR {pkr(p.stock_valuation).toLocaleString()}
                            </td>
                            <td className="text-right space-x-2">
                              <button
                                onClick={() => {
                                  setEditingProductId(p.id);
                                  setProdSku(p.sku);
                                  setProdName(p.name);
                                  setProdCompanyName(p.brand_name || 'ATH Oils');
                                  setProdBrandId(p.brand_id || 1);
                                  setProdViscosity(p.viscosity);
                                  setProdPackSize(String(p.pack_size_num || 700));
                                  setProdUnitsPerCarton(String(p.units_per_carton));
                                  setProdPurchaseRate(String(pkr(p.purchase_rate)));
                                  setProdSaleRate(String(pkr(p.sale_rate)));
                                  setProdReorder(String(p.reorder_level));
                                  navigateTo({ main: 'inventory', invSub: 'products_crud' });
                                }}
                                className="text-yellow-300 hover:text-white p-1"
                              >
                                <Edit3 className="w-4 h-4 inline" />
                              </button>
                              <button
                                onClick={() => triggerReverse('PRODUCT', p.id, p.name)}
                                className="text-rose-300 hover:text-white p-1"
                              >
                                <Trash2 className="w-4 h-4 inline" />
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

            {currentNav.invSub === 'products_crud' && (
              <div className="glass-panel rounded-2xl p-5 sm:p-6">
                <h3 className="text-sm font-extrabold text-white mb-4 flex items-center gap-2 samsung-heading heading-reveal">
                  <Package className="w-4 h-4 text-yellow-400" /> {editingProductId ? 'EDIT PRODUCT' : 'ADD NEW LUBRICANT PRODUCT'}
                </h3>
                <form onSubmit={handleSaveProduct} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <input type="text" required placeholder="SKU Code" value={prodSku} onChange={e => setProdSku(e.target.value)} className="erp-input" />
                  <input type="text" required placeholder="Product Name" value={prodName} onChange={e => setProdName(e.target.value)} className="erp-input" />
                  <input type="text" required placeholder="Brand / Company" value={prodCompanyName} onChange={e => setProdCompanyName(e.target.value)} className="erp-input" />
                  <input type="number" required placeholder="Bottle Size (ML)" value={prodPackSize} onChange={e => setProdPackSize(e.target.value)} className="erp-input" />
                  <input type="number" required placeholder="Bottles per Carton" value={prodUnitsPerCarton} onChange={e => setProdUnitsPerCarton(e.target.value)} className="erp-input" />
                  <input type="number" placeholder="Purchase Rate / Bottle" value={prodPurchaseRate} onChange={e => setProdPurchaseRate(e.target.value)} className="erp-input" />
                  <input type="number" placeholder="Sale Rate / Bottle" value={prodSaleRate} onChange={e => setProdSaleRate(e.target.value)} className="erp-input" />
                  <label className="flex items-center gap-2 bg-slate-800/90 px-3 py-2.5 rounded-xl border border-white/15 text-xs font-bold text-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodIsFavorite}
                      onChange={e => setProdIsFavorite(e.target.checked)}
                      className="w-4 h-4 accent-yellow-400"
                    />
                    Explicitly Mark as Favorite Product
                  </label>
                  <button type="submit" className="btn-primary py-2.5 text-xs uppercase">{editingProductId ? 'Update Product' : 'Save Product'}</button>
                </form>
              </div>
            )}

            {currentNav.invSub === 'locations_transfer' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form onSubmit={handleStockTransfer} className="glass-panel rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">TRANSFER STOCK BETWEEN GODOWNS</h3>
                  <select value={trfProductId} onChange={e => setTrfProductId(Number(e.target.value))} className="erp-input">
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.pack_size})</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={trfFromLocId} onChange={e => setTrfFromLocId(Number(e.target.value))} className="erp-input">
                      {locations.map(l => <option key={l.id} value={l.id}>From: {l.name}</option>)}
                    </select>
                    <select value={trfToLocId} onChange={e => setTrfToLocId(Number(e.target.value))} className="erp-input">
                      {locations.map(l => <option key={l.id} value={l.id}>To: {l.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select value={trfUnitType} onChange={e => setTrfUnitType(e.target.value as 'CARTON' | 'BOTTLE')} className="erp-input">
                      <option value="CARTON">CARTON</option>
                      <option value="BOTTLE">BOTTLE</option>
                    </select>
                    <input type="number" required placeholder="Quantity" value={trfQuantity} onChange={e => setTrfQuantity(e.target.value)} className="erp-input" />
                  </div>
                  <button type="submit" className="w-full btn-oil py-2.5 text-xs uppercase">Execute Stock Transfer</button>
                </form>

                <form onSubmit={handleSaveLocation} className="glass-panel rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">ADD STORAGE LOCATION</h3>
                  <input type="text" required placeholder="Location Name" value={locName} onChange={e => setLocName(e.target.value)} className="erp-input" />
                  <select value={locType} onChange={e => setLocType(e.target.value)} className="erp-input">
                    <option value="DISPLAY">DISPLAY COUNTER</option>
                    <option value="WAREHOUSE">WAREHOUSE</option>
                    <option value="GODOWN">GODOWN</option>
                  </select>
                  <input type="text" placeholder="Address" value={locAddress} onChange={e => setLocAddress(e.target.value)} className="erp-input" />
                  <button type="submit" className="w-full btn-primary py-2.5 text-xs uppercase">Save Location</button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SECTION 4: PARTIES, GROUPS, CNIC SEARCH & 360° CUSTOMER HISTORY
           ========================================================================= */}
        {currentNav.main === 'directory' && (
          <div className="space-y-6 animate-fade-in">
            {currentNav.dirSub === 'parties' && (
              <div className="space-y-6">
                {/* Search & Scalable Server-Paginated Group Filter Bar */}
                <div className="glass-panel p-4 rounded-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                    <div className="relative w-full">
                      <Search className="w-4 h-4 text-yellow-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        placeholder="Search Customer or Supplier by Name, Code, City, Group, Phone or CNIC..."
                        value={partySearch}
                        onChange={e => setPartySearch(e.target.value)}
                        className="erp-input pl-10"
                      />
                    </div>
                    <div className="w-full">
                      <SearchableGroupSelect
                        partyType="CUSTOMER"
                        selectedGroupId={selectedCustomerGroupIdFilter}
                        selectedGroupName={selectedCustomerGroupFilter === 'ALL' ? '' : selectedCustomerGroupFilter}
                        allowAllOption={true}
                        allOptionLabel={`All Customer Groups (${customers.length} Customers)`}
                        placeholder="Filter customers by searchable group..."
                        onSelectGroup={g => {
                          setSelectedCustomerGroupIdFilter(g.id);
                          setSelectedCustomerGroupFilter(g.name || 'ALL');
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Customer Directory + Searchable Group ID + CNIC */}
                  <div className="glass-panel rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                      <Users className="w-4 h-4 text-emerald-400" /> {editingCustomerId ? 'EDIT CUSTOMER RECORD' : 'ADD CUSTOMER (WITH GROUP ID & CNIC)'}
                    </h3>
                    <form onSubmit={handleSaveCustomer} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input type="text" required placeholder="Customer / Workshop Name" value={cusName} onChange={e => setCusName(e.target.value)} className="erp-input" />
                      <input type="text" required placeholder="City (e.g. Khour / Talagang)" value={cusCity} onChange={e => setCusCity(e.target.value)} className="erp-input" />
                      <div>
                        <SearchableGroupSelect
                          partyType="CUSTOMER"
                          selectedGroupId={cusGroupId}
                          selectedGroupName={cusGroup}
                          onSelectGroup={g => {
                            setCusGroupId(g.id);
                            setCusGroup(g.name);
                          }}
                          placeholder="Search or create customer group..."
                        />
                      </div>
                      <input type="text" placeholder="CNIC (e.g. 37104-1234567-1)" value={cusCnic} onChange={e => setCusCnic(e.target.value)} className="erp-input" />
                      <input type="text" placeholder="Phone Number" value={cusPhone} onChange={e => setCusPhone(e.target.value)} className="erp-input" />
                      <input type="number" placeholder="Opening Receivable (PKR)" value={cusReceivable} onChange={e => setCusReceivable(e.target.value)} className="erp-input" />
                      <label className="sm:col-span-2 flex items-center gap-2 bg-slate-800/90 px-3 py-2 rounded-xl border border-white/15 text-xs font-bold text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cusIsFavorite}
                          onChange={e => setCusIsFavorite(e.target.checked)}
                          className="w-4 h-4 accent-yellow-400"
                        />
                        Explicitly Mark Customer as Favorite
                      </label>
                      <div className="sm:col-span-2 flex gap-2">
                        <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase">
                          {editingCustomerId ? 'Save Customer Changes' : 'Create Customer Record'}
                        </button>
                        {editingCustomerId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCustomerId(null);
                              setCusName('');
                              setCusCity('');
                              setCusPhone('');
                              setCusCnic('');
                              setCusReceivable('');
                              setCusIsFavorite(false);
                            }}
                            className="btn-secondary px-4 py-2.5 text-xs"
                          >
                            Cancel Edit
                          </button>
                        )}
                      </div>
                    </form>

                    <div className="space-y-2.5">
                      {filteredCustomers.map(c => (
                        <div key={c.id} className="bg-slate-800/95 p-3.5 rounded-xl border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="cursor-pointer" onClick={() => openCustomer360(c.id)}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-white hover:text-yellow-300 underline">{c.name}</span>
                              <span className="text-[10px] font-mono text-slate-300">({c.code} • ID #{c.id})</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 font-bold">
                                {c.group_name || 'General Market'} {c.group_id ? `[#${c.group_id}]` : ''}
                              </span>
                            </div>
                            <div className="text-xs text-slate-200 mt-0.5">
                              {c.city} • Phone: {c.phone || 'N/A'} • CNIC: {c.cnic || 'N/A'}
                            </div>
                            <div className="text-xs font-bold text-yellow-300 mt-1 tabular-nums">
                              Khata Receivable: PKR {pkr(c.current_receivable).toLocaleString()} • Confirmed Sales: PKR {pkr(c.total_sales_amount).toLocaleString()}
                              {pkr(c.advance_credit) > 0 && (
                                <span className="ml-2 text-emerald-300">• Advance Credit: PKR {pkr(c.advance_credit).toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openCustomerAllocationModal(c.id)}
                              className="btn-primary px-2.5 py-1.5 text-[11px]"
                            >
                              Receive / Allocate Payment
                            </button>
                            <button
                              type="button"
                              onClick={() => openCustomer360(c.id)}
                              className="btn-oil px-2.5 py-1.5 text-[11px]"
                            >
                              <Eye className="w-3.5 h-3.5" /> 360° History
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCustomerFavorite(c)}
                              className={`p-1.5 rounded-lg border border-white/10 ${c.is_favorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-400 hover:text-white'}`}
                              title={c.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                            >
                              <Star className={`w-4 h-4 ${c.is_favorite ? 'fill-yellow-400' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCustomerId(c.id);
                                setCusName(c.name);
                                setCusCity(c.city);
                                setCusGroupId(c.group_id ?? null);
                                setCusGroup(c.group_name || 'General Market');
                                setCusCnic(c.cnic || '');
                                setCusPhone(c.phone || '');
                                setCusReceivable(String(pkr(c.current_receivable)));
                                setCusIsFavorite(Boolean(c.is_favorite));
                              }}
                              className="btn-secondary p-1.5 text-yellow-300"
                              title="Edit Customer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerReverse('CUSTOMER', c.id, c.name)}
                              className="btn-danger p-1.5"
                              title="Delete / Move to Recycle Bin"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Supplier Directory */}
                  <div className="glass-panel rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                      <Truck className="w-4 h-4 text-yellow-400" /> {editingSupplierId ? 'EDIT SUPPLIER' : 'ADD OIL SUPPLIER'}
                    </h3>
                    <form onSubmit={handleSaveSupplier} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input type="text" required placeholder="Supplier Name" value={supName} onChange={e => setSupName(e.target.value)} className="erp-input" />
                      <input type="text" required placeholder="City" value={supCity} onChange={e => setSupCity(e.target.value)} className="erp-input" />
                      <input type="text" placeholder="Supplier Group" value={supGroup} onChange={e => setSupGroup(e.target.value)} className="erp-input" />
                      <input type="text" placeholder="CNIC" value={supCnic} onChange={e => setSupCnic(e.target.value)} className="erp-input" />
                      <input type="text" placeholder="Phone Number" value={supPhone} onChange={e => setSupPhone(e.target.value)} className="erp-input" />
                      <input type="number" placeholder="Opening Payable (PKR)" value={supPayable} onChange={e => setSupPayable(e.target.value)} className="erp-input" />
                      <button type="submit" className="sm:col-span-2 btn-primary py-2.5 text-xs uppercase">
                        {editingSupplierId ? 'Update Supplier' : 'Save Supplier'}
                      </button>
                    </form>

                    <div className="space-y-2.5">
                      {filteredSuppliers.map(s => (
                        <div key={s.id} className="bg-slate-800/95 p-3.5 rounded-xl border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="cursor-pointer" onClick={() => openSupplier360(s.id)}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white hover:text-yellow-300 underline">{s.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-400/40 font-bold">
                                {s.group_name || 'General Suppliers'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-200 mt-0.5">
                              {s.city} • Phone: {s.phone || 'N/A'} • CNIC: {s.cnic || 'N/A'}
                            </div>
                            <div className="text-xs font-bold text-rose-300 mt-1 tabular-nums">
                              Payable Balance: PKR {pkr(s.current_payable).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openSupplier360(s.id)} className="btn-oil px-2.5 py-1.5 text-[11px]">
                              Bills History
                            </button>
                            <button
                              onClick={() => {
                                setEditingSupplierId(s.id);
                                setSupName(s.name);
                                setSupCity(s.city);
                                setSupGroup(s.group_name || 'General Suppliers');
                                setSupCnic(s.cnic || '');
                                setSupPhone(s.phone || '');
                                setSupPayable(String(pkr(s.current_payable)));
                              }}
                              className="text-yellow-300 p-1.5"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => triggerReverse('SUPPLIER', s.id, s.name)} className="text-rose-300 p-1.5">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentNav.dirSub === 'recycle' && (
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-white/15 pb-3">
                  <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                    PROTECTED RECYCLE BIN ({recycleBin.length})
                  </h3>
                  {recycleBin.length > 0 && (
                    <button
                      onClick={() =>
                        setSecurityModal({
                          mode: 'EMPTY_BIN',
                          title: 'Permanently Empty Recycle Bin',
                          description: 'All archived records in the Recycle Bin will be permanently purged.'
                        })
                      }
                      className="btn-primary px-4 py-2 text-xs uppercase"
                    >
                      Empty Recycle Bin
                    </button>
                  )}
                </div>
                {recycleBin.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-300">Recycle Bin is empty.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs erp-table">
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
                            <td className="font-mono text-slate-200">{item.deleted_at}</td>
                            <td className="font-mono text-yellow-300 font-bold">{item.entity_type}</td>
                            <td className="font-mono font-bold text-white">{item.reference_code}</td>
                            <td>
                              <div className="font-bold text-white">{item.title}</div>
                              <div className="text-[11px] text-slate-200">{item.summary}</div>
                            </td>
                            <td className="text-right font-bold text-rose-300 tabular-nums">PKR {pkr(item.amount).toLocaleString()}</td>
                            <td className="text-right space-x-2">
                              <button
                                onClick={() => handleRestoreFromBin(item.id)}
                                className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-[11px] font-bold"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() =>
                                  setSecurityModal({
                                    mode: 'PERMANENT_DELETE',
                                    trashId: item.id,
                                    title: `Permanently Delete ${item.reference_code}`,
                                    description: 'This item will be permanently erased.'
                                  })
                                }
                                className="bg-rose-600 text-white px-3 py-1 rounded-lg text-[11px] font-bold"
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

        {/* =========================================================================
            SECTION 5: VYAPAR COMPLETE REPORTS CENTER & CLOUD BACKUP
           ========================================================================= */}
        {currentNav.main === 'reports' && vyaparReports && (
          <div className="space-y-6 animate-fade-in">
            {/* Period Selector */}
            <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                  VYAPAR BUSINESS REPORTS & ANALYTICS ({period.toUpperCase()})
                </h2>
                <p className="text-xs text-slate-200">
                  Bill-Wise Profit, Item-Wise Stock & Profit, Roznamcha Day Book & Group Receivables
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['daily', 'weekly', 'monthly', 'all'] as TimePeriod[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase ${
                      period === p ? 'bg-yellow-400 text-slate-950' : 'bg-slate-800 text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {currentNav.repSub === 'bill_pnl' && (
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                  BILL-WISE PROFIT & LOSS REPORT ({vyaparReports.bill_wise_profit.length} INVOICES)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs erp-table min-w-[820px]">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>Customer & Group</th>
                        <th>Items</th>
                        <th className="text-right">Sale Bill</th>
                        <th className="text-right">Exact Cost (COGS)</th>
                        <th className="text-right">Net Profit</th>
                        <th className="text-right">View Bill</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vyaparReports.bill_wise_profit.map(row => (
                        <tr key={row.id}>
                          <td className="font-mono font-bold text-yellow-300">{row.invoice_number}</td>
                          <td className="font-mono text-slate-200">{row.date}</td>
                          <td>
                            <div className="font-bold text-white">{row.customer_name}</div>
                            <div className="text-[10px] text-slate-300">{row.customer_city} • {row.customer_group}</div>
                          </td>
                          <td className="text-slate-100 max-w-xs">{row.items_summary}</td>
                          <td className="text-right font-bold text-white tabular-nums">PKR {pkr(row.sale_amount).toLocaleString()}</td>
                          <td className="text-right text-amber-300 tabular-nums">PKR {pkr(row.cost_amount).toLocaleString()}</td>
                          <td className={`text-right font-extrabold tabular-nums ${pkr(row.net_profit) >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                            PKR {pkr(row.net_profit).toLocaleString()}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => {
                                const found = sales.find(s => s.id === row.id);
                                if (found) setInvoiceModal({ kind: 'SALE', sale: found });
                              }}
                              className="btn-oil px-2.5 py-1 text-[11px]"
                            >
                              Open Bill
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {currentNav.repSub === 'item_profit' && (
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                  ITEM-WISE STOCK, PURCHASE, SALE & PROFIT SUMMARY
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs erp-table min-w-[860px]">
                    <thead>
                      <tr>
                        <th>Product & Size</th>
                        <th>Purchased Qty</th>
                        <th>Purchase Value</th>
                        <th>Sold Qty</th>
                        <th>Sale Revenue</th>
                        <th>Net Profit Earned</th>
                        <th>Closing Stock</th>
                        <th className="text-right">Stock Valuation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vyaparReports.item_wise_summary.map(it => (
                        <tr key={it.product_id}>
                          <td>
                            <div className="font-bold text-white">{it.name} ({it.pack_size})</div>
                            <div className="text-[10px] text-yellow-300">{it.brand_name} • {it.sku}</div>
                          </td>
                          <td className="font-mono text-slate-200">{it.purchased_formatted}</td>
                          <td className="tabular-nums">PKR {pkr(it.purchase_value).toLocaleString()}</td>
                          <td className="font-mono text-yellow-300">{it.sold_formatted}</td>
                          <td className="font-bold text-white tabular-nums">PKR {pkr(it.sale_revenue).toLocaleString()}</td>
                          <td className="font-extrabold text-emerald-300 tabular-nums">PKR {pkr(it.profit).toLocaleString()}</td>
                          <td className="font-mono font-bold text-white">{it.closing_formatted}</td>
                          <td className="text-right font-bold text-yellow-300 tabular-nums">PKR {pkr(it.closing_valuation).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {currentNav.repSub === 'daybook' && (
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                  DAY BOOK (ROZNAMCHA) — ALL TRANSACTIONS ({vyaparReports.daybook.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs erp-table min-w-[760px]">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Type</th>
                        <th>Ref #</th>
                        <th>Party</th>
                        <th>Channel</th>
                        <th>Details</th>
                        <th className="text-right">Cash In</th>
                        <th className="text-right">Cash Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vyaparReports.daybook.map(d => (
                        <tr key={d.id}>
                          <td className="font-mono text-slate-200">{d.date}</td>
                          <td className="font-bold text-white">{d.type}</td>
                          <td className="font-mono text-yellow-300">{d.reference}</td>
                          <td className="font-semibold text-white">{d.party}</td>
                          <td className="font-mono">{d.channel}</td>
                          <td className="text-slate-200">{d.description}</td>
                          <td className="text-right font-bold text-emerald-300 tabular-nums">
                            {d.cash_in > 0 ? `+PKR ${pkr(d.cash_in).toLocaleString()}` : '-'}
                          </td>
                          <td className="text-right font-bold text-rose-300 tabular-nums">
                            {d.cash_out > 0 ? `-PKR ${pkr(d.cash_out).toLocaleString()}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {currentNav.repSub === 'groups_backup' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                    PARTY GROUP / CITY ROUTE SUMMARY
                  </h3>
                  <table className="w-full text-left text-xs erp-table">
                    <thead>
                      <tr>
                        <th>Group / Route Name</th>
                        <th>Customers</th>
                        <th className="text-right">Total Sales</th>
                        <th className="text-right">Pending Khata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vyaparReports.customer_groups.map(g => (
                        <tr key={g.group_name}>
                          <td className="font-bold text-yellow-300">{g.group_name}</td>
                          <td>{g.customers_count} Parties</td>
                          <td className="text-right font-bold text-white tabular-nums">PKR {pkr(g.total_sales).toLocaleString()}</td>
                          <td className="text-right font-bold text-rose-300 tabular-nums">PKR {pkr(g.total_receivable).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="glass-panel rounded-2xl p-6 space-y-4 border border-yellow-400/40">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-extrabold text-white samsung-heading">
                        100% PERMANENT DATA SAFETY & BACKUP VAULT
                      </h3>
                      <p className="text-xs text-slate-200">
                        Export a complete JSON snapshot of your entire ERP at any time or restore across any future version.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={handleDownloadBackupJson}
                      className="btn-oil py-3 px-4 text-xs uppercase flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Download Full Backup
                    </button>
                    <label className="btn-primary py-3 px-4 text-xs uppercase flex items-center justify-center gap-2 cursor-pointer text-center">
                      <Upload className="w-4 h-4" /> Restore Backup File
                      <input type="file" accept=".json" onChange={handleImportBackupJson} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ==================== MODAL 1: PROFESSIONAL VYAPAR INVOICE (IMAGE, PDF & PRINT) ==================== */}
      {invoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white text-slate-900 max-w-3xl w-full rounded-2xl shadow-2xl overflow-hidden animate-modal my-auto">
            {/* Top Action Toolbar */}
            <div className="bg-[#1E232D] px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b-4 border-rose-600 no-print">
              <span className="text-xs font-extrabold text-yellow-300 uppercase">
                Vyapar Digital Invoice Preview
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => downloadOrShareInvoiceImage('DOWNLOAD')}
                  className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Save Image (PNG)
                </button>
                <button
                  onClick={() => downloadOrShareInvoiceImage('SHARE')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share on WhatsApp
                </button>
                <button
                  onClick={() => printSingleInvoicePdf(false)}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save PDF (A4)
                </button>
                <button
                  onClick={() => printSingleInvoicePdf(true)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                >
                  Thermal 80mm
                </button>
                <button onClick={() => setInvoiceModal(null)} className="text-slate-300 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Invoice Body */}
            {(() => {
              const isSale = invoiceModal.kind === 'SALE';
              const doc = isSale ? invoiceModal.sale! : invoiceModal.purchase!;
              const refNo = isSale ? (doc as SaleRecord).invoice_number : (doc as PurchaseRecord).purchase_number;
              const partyName = isSale ? (doc as SaleRecord).customer_name : (doc as PurchaseRecord).supplier_name;
              const partyCity = isSale ? (doc as SaleRecord).customer_city : (doc as PurchaseRecord).supplier_city;
              const partyPhone = isSale ? (doc as SaleRecord).customer_phone : (doc as PurchaseRecord).supplier_phone;
              const partyCnic = isSale ? (doc as SaleRecord).customer_cnic : (doc as PurchaseRecord).supplier_cnic;
              const partyGroup = isSale ? (doc as SaleRecord).customer_group : (doc as PurchaseRecord).supplier_group;
              const items = (doc.items || []) as any[];
              const sDoc = doc as SaleRecord;
              const prevDues = isSale ? pkr(sDoc.previous_dues) : 0;
              const grandPay = isSale ? pkr(sDoc.grand_payable || sDoc.total_amount + prevDues) : pkr(doc.total_amount);
              const recToday = isSale ? pkr(sDoc.received_amount + (sDoc.applied_to_previous || 0)) : pkr((doc as PurchaseRecord).paid_amount);
              const closingBal = isSale ? pkr(sDoc.closing_receivable ?? sDoc.receivable_amount) : pkr((doc as PurchaseRecord).payable_amount);

              return (
                <div className="p-6 space-y-5">
                  <div className="flex flex-wrap justify-between items-center gap-4 border-b-2 border-slate-200 pb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src="/logo.png"
                        alt="ATH Lubricants"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        className="h-14 w-14 object-contain"
                      />
                      <div>
                        <h2 className="text-xl font-black text-slate-900">ATH LUBRICANTS</h2>
                        <p className="text-xs text-slate-600 font-semibold">Precision Motor Oil Distribution & Trade Invoice</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-rose-600 font-mono">{refNo}</div>
                      <div className="text-xs text-slate-600 font-mono">Date: {doc.invoice_date}</div>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        {(doc as any).doc_type || invoiceModal.kind} • {doc.payment_status}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-300 text-xs flex flex-wrap justify-between gap-2">
                    <div>
                      <span className="text-slate-500 font-bold uppercase block">{isSale ? 'Billed To Customer:' : 'Supplier:'}</span>
                      <strong className="text-sm text-slate-900">{partyName} ({partyCity || 'Local'})</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block">Phone & CNIC:</span>
                      <span className="font-semibold text-slate-800">{partyPhone || 'N/A'} • CNIC: {partyCnic || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block">Route / Group:</span>
                      <span className="font-semibold text-slate-800">{partyGroup || 'General'}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border border-slate-300">
                      <thead className="bg-slate-900 text-yellow-300">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Product & Size</th>
                          <th className="p-2.5">Qty & Carton Breakdown</th>
                          <th className="p-2.5 text-right">Rate (PKR)</th>
                          <th className="p-2.5 text-right">Total (PKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, idx) => (
                          <tr key={idx} className="border-t border-slate-200">
                            <td className="p-2.5 font-bold">{idx + 1}</td>
                            <td className="p-2.5">
                              <div className="font-bold text-slate-900">{it.product_name} ({it.pack_size || '700 ML'})</div>
                              <div className="text-[11px] text-slate-500">{it.company_name} • {it.location_name}</div>
                            </td>
                            <td className="p-2.5 font-mono">
                              {it.quantity} {it.unit_type} ({it.base_quantity} Btls = {it.cartons} Ctn + {it.loose_bottles} Btl)
                            </td>
                            <td className="p-2.5 text-right font-mono">PKR {pkr(it.unit_rate).toLocaleString()}</td>
                            <td className="p-2.5 text-right font-mono font-bold">PKR {pkr(it.line_total).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                    <div className="text-xs text-slate-600 space-y-1">
                      <div><strong>Payment Channel:</strong> {doc.payment_method}</div>
                      <div><strong>Remarks:</strong> {doc.remarks || 'Standard Trade Bill'}</div>
                    </div>
                    <div className="w-full sm:w-80 bg-slate-100 p-4 rounded-xl border border-slate-300 space-y-1.5 text-xs tabular-nums">
                      <div className="flex justify-between font-bold text-slate-900 text-sm">
                        <span>Current Bill Total:</span>
                        <span>PKR {pkr(doc.total_amount).toLocaleString()}</span>
                      </div>
                      {isSale && (
                        <>
                          <div className="flex justify-between text-amber-700 font-semibold">
                            <span>+ Previous Balance (Old Khata):</span>
                            <span>PKR {prevDues.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-300 pt-1">
                            <span>= Total Payable Amount:</span>
                            <span>PKR {grandPay.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-emerald-700 font-bold">
                            <span>- Received Today ({doc.payment_method}):</span>
                            <span>PKR {recToday.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-rose-600 font-black text-sm border-t border-slate-300 pt-1.5">
                            <span>Net Closing Khata Balance:</span>
                            <span>PKR {closingBal.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                      {!isSale && (
                        <>
                          <div className="flex justify-between text-emerald-700 font-bold">
                            <span>Paid Today ({doc.payment_method}):</span>
                            <span>PKR {recToday.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-rose-600 font-black text-sm border-t border-slate-300 pt-1.5">
                            <span>Remaining Payable:</span>
                            <span>PKR {closingBal.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: CUSTOMER 360° PROFILE & ALL-INVOICES PDF ==================== */}
      {customerProfileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="glass-panel max-w-4xl w-full rounded-2xl p-5 sm:p-6 space-y-4 border border-yellow-400/50 animate-modal my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-yellow-400 text-slate-950 font-extrabold">
                  {customerProfileModal.customer.group_name || 'General Market'}
                </span>
                <h3 className="text-lg font-black text-white mt-1">
                  {customerProfileModal.customer.name} ({customerProfileModal.customer.city})
                </h3>
                <p className="text-xs text-slate-200">
                  Phone: {customerProfileModal.customer.phone || 'N/A'} • CNIC: {customerProfileModal.customer.cnic || 'N/A'} • Current Khata:{' '}
                  <strong className="text-yellow-300">PKR {pkr(customerProfileModal.customer.current_receivable).toLocaleString()}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printAllCustomerInvoicesPdf(customerProfileModal)}
                  className="btn-oil px-3.5 py-2 text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Download / Print All Invoices PDF
                </button>
                <button onClick={() => setCustomerProfileModal(null)} className="text-slate-300 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              {([
                { id: 'invoices', label: `All Invoices (${customerProfileModal.invoices.length})` },
                { id: 'items', label: `Last Purchased Items & Rates (${customerProfileModal.item_history.length})` },
                { id: 'payments', label: `Payment & Khata History (${customerProfileModal.payments.length})` }
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setProfileTab(t.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold ${
                    profileTab === t.id ? 'bg-yellow-400 text-slate-950' : 'bg-slate-800 text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {profileTab === 'invoices' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs erp-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Bill Total</th>
                      <th>Old Dues</th>
                      <th>Received</th>
                      <th>Closing</th>
                      <th className="text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerProfileModal.invoices.map(inv => (
                      <tr key={inv.id}>
                        <td className="font-mono font-bold text-yellow-300">{inv.invoice_number}</td>
                        <td className="font-mono">{inv.invoice_date}</td>
                        <td>{inv.items_summary}</td>
                        <td className="font-bold">PKR {pkr(inv.total_amount).toLocaleString()}</td>
                        <td>PKR {pkr(inv.previous_dues).toLocaleString()}</td>
                        <td className="text-emerald-300 font-bold">
                          PKR {pkr(inv.received_amount + (inv.applied_to_previous || 0)).toLocaleString()}
                        </td>
                        <td className="text-rose-300 font-bold">PKR {pkr(inv.closing_receivable ?? inv.receivable_amount).toLocaleString()}</td>
                        <td className="text-right">
                          <button
                            onClick={() => setInvoiceModal({ kind: 'SALE', sale: inv })}
                            className="bg-yellow-400 text-slate-950 px-2.5 py-1 rounded font-bold"
                          >
                            View Bill
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {profileTab === 'items' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs erp-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Invoice #</th>
                      <th>Product & Size</th>
                      <th>Qty</th>
                      <th>Charged Rate</th>
                      <th className="text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerProfileModal.item_history.map((it, idx) => (
                      <tr key={idx}>
                        <td className="font-mono">{it.date}</td>
                        <td className="font-mono text-yellow-300">{it.invoice_number}</td>
                        <td className="font-bold text-white">{it.product_name} ({it.pack_size})</td>
                        <td>{it.quantity} {it.unit_type} ({it.base_quantity} Btls)</td>
                        <td className="font-mono font-bold text-emerald-300">PKR {pkr(it.unit_rate).toLocaleString()}</td>
                        <td className="text-right font-mono font-bold">PKR {pkr(it.line_total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {profileTab === 'payments' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs erp-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Voucher #</th>
                      <th>Type</th>
                      <th>Channel</th>
                      <th>Description</th>
                      <th className="text-right">Collected (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerProfileModal.payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-300">
                          No separate installment vouchers recorded yet.
                        </td>
                      </tr>
                    ) : (
                      customerProfileModal.payments.map(p => (
                        <tr key={p.id}>
                          <td className="font-mono">{p.date}</td>
                          <td className="font-mono text-yellow-300">{p.tx_number}</td>
                          <td className="font-bold">{p.tx_type}</td>
                          <td>{p.channel}</td>
                          <td>{p.description}</td>
                          <td className="text-right font-bold text-emerald-300">
                            PKR {pkr(p.cash_in).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ==================== MODAL: CUSTOMER OUTSTANDING LEDGER & PAYMENT ALLOCATION WORKFLOW ==================== */}
      {allocationLedgerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto no-print">
          <div className="glass-panel max-w-5xl w-full rounded-2xl p-5 sm:p-6 space-y-5 border border-yellow-400/50 animate-modal my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-yellow-400 text-slate-950 font-extrabold">
                  Auditable Customer Outstanding Ledger & Payment Allocation
                </span>
                <h3 className="text-lg font-black text-white mt-1">
                  {allocationLedgerModal.customer_name} ({allocationLedgerModal.city}) —{' '}
                  <span className="text-yellow-300 font-mono">{allocationLedgerModal.customer_code}</span>
                </h3>
                <p className="text-xs text-slate-200">
                  Group: {allocationLedgerModal.group_name} • Phone: {allocationLedgerModal.phone || 'N/A'} • CNIC: {allocationLedgerModal.cnic || 'N/A'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAllocationLedgerModal(null);
                  setAllocationConfirming(false);
                  setAllocationError('');
                }}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                <X className="w-4 h-4" /> Close Window
              </button>
            </div>

            {(() => {
              const unpaidBills = allocationLedgerModal.outstanding_bills || [];
              const totalOutBefore = pkr(allocationLedgerModal.total_bills_outstanding);
              const enteredPayment = pkr(allocationPaymentInput);
              const totalAllocatedNow = unpaidBills.reduce(
                (acc, b) => acc + pkr(allocationDraftMap[b.sale_id] || 0),
                0
              );
              const projectedRemainingAfter = pkr(Math.max(0, totalOutBefore - totalAllocatedNow));
              const unallocatedDiff = pkr(enteredPayment - totalAllocatedNow);

              return (
                <div className="space-y-5">
                  {/* Top KPI Summary Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-white/15">
                      <div className="text-slate-300 font-semibold">Total Outstanding Before</div>
                      <div className="text-xl font-black text-rose-400 tabular-nums mt-1">
                        PKR {totalOutBefore.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-400">{unpaidBills.length} Unpaid / Partial Bill(s)</div>
                    </div>

                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-yellow-400/40">
                      <div className="text-yellow-300 font-semibold">Payment Received Amount</div>
                      <div className="text-xl font-black text-yellow-300 tabular-nums mt-1">
                        PKR {enteredPayment.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-300">Proposal / Draft Mode</div>
                    </div>

                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-emerald-400/40">
                      <div className="text-emerald-300 font-semibold">Allocated Across Bills</div>
                      <div className="text-xl font-black text-emerald-300 tabular-nums mt-1">
                        PKR {totalAllocatedNow.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-300">
                        {unallocatedDiff === 0
                          ? '100% of payment allocated'
                          : unallocatedDiff > 0
                          ? `PKR ${unallocatedDiff.toLocaleString()} unallocated`
                          : `Exceeds payment by PKR ${Math.abs(unallocatedDiff).toLocaleString()}`}
                      </div>
                    </div>

                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-white/20">
                      <div className="text-white font-semibold">Projected Remaining Afterward</div>
                      <div className="text-xl font-black text-white tabular-nums mt-1">
                        PKR {projectedRemainingAfter.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-amber-300 font-bold">
                        PKR {projectedRemainingAfter.toLocaleString()} will remain outstanding
                      </div>
                    </div>
                  </div>

                  {/* Payment Input & Default Proposal Controls */}
                  <div className="bg-slate-900/90 p-4 rounded-xl border border-white/15 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-yellow-300 font-bold">1. Enter Payment Received (PKR)</label>
                        <input
                          type="number"
                          placeholder="e.g. 30000"
                          value={allocationPaymentInput}
                          onChange={e => handlePaymentInputOrPolicyChange(e.target.value, allocationPolicy)}
                          className="mt-1 erp-input font-extrabold text-emerald-300"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">2. Default Proposal Rule</label>
                        <select
                          value={allocationPolicy}
                          onChange={e =>
                            handlePaymentInputOrPolicyChange(
                              allocationPaymentInput,
                              e.target.value as 'OLDEST_FIRST' | 'NEWEST_FIRST'
                            )
                          }
                          className="mt-1 erp-input font-bold text-yellow-300"
                        >
                          <option value="OLDEST_FIRST">Oldest Bill First (Default Proposal)</option>
                          <option value="NEWEST_FIRST">Newest Bill First</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">3. Receiving Financial Account</label>
                        <select
                          value={allocationAccountId}
                          onChange={e => {
                            const id = Number(e.target.value);
                            setAllocationAccountId(id);
                            const acc = accounts.find(a => a.id === id);
                            if (acc) setAllocationMethod(acc.type);
                          }}
                          className="mt-1 erp-input"
                        >
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.type}) — PKR {pkr(a.current_balance).toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-white font-semibold">4. Payment Note / Reference</label>
                        <input
                          type="text"
                          placeholder="Optional voucher note"
                          value={allocationRemarks}
                          onChange={e => setAllocationRemarks(e.target.value)}
                          className="mt-1 erp-input"
                        />
                      </div>
                    </div>

                    {/* Bill-by-Bill Interactive Allocation Table */}
                    {unpaidBills.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-800/80 text-center text-xs text-emerald-300 font-bold">
                        This customer currently has no unpaid bills.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs erp-table">
                          <thead>
                            <tr>
                              <th>Bill / Invoice #</th>
                              <th>Date</th>
                              <th className="text-right">Original Amount</th>
                              <th className="text-right">Previously Paid</th>
                              <th className="text-right">Outstanding Before</th>
                              <th className="text-right">Proposed / Custom Allocation (PKR)</th>
                              <th className="text-right">Remaining Afterward</th>
                              <th className="text-right">Prioritize Bill</th>
                            </tr>
                          </thead>
                          <tbody>
                            {unpaidBills.map(b => {
                              const allocVal = pkr(allocationDraftMap[b.sale_id] || 0);
                              const remAfter = pkr(Math.max(0, b.remaining_balance - allocVal));
                              return (
                                <tr key={b.sale_id}>
                                  <td className="font-mono font-bold text-yellow-300">
                                    {b.invoice_number}
                                    <div className="text-[10px] text-slate-300 font-sans">{b.items_summary}</div>
                                  </td>
                                  <td className="font-mono text-slate-200">{b.invoice_date}</td>
                                  <td className="text-right font-mono">PKR {pkr(b.original_amount).toLocaleString()}</td>
                                  <td className="text-right font-mono text-emerald-300">
                                    PKR {pkr(b.previously_paid).toLocaleString()}
                                  </td>
                                  <td className="text-right font-mono font-bold text-rose-300">
                                    PKR {pkr(b.remaining_balance).toLocaleString()}
                                  </td>
                                  <td className="text-right w-48">
                                    <input
                                      type="number"
                                      min={0}
                                      max={b.remaining_balance}
                                      value={allocVal}
                                      onChange={e =>
                                        handleManualBillAllocationEdit(b.sale_id, e.target.value, b.remaining_balance)
                                      }
                                      className="erp-input py-1.5 px-2.5 text-right font-mono font-extrabold text-yellow-300"
                                    />
                                  </td>
                                  <td className="text-right font-mono font-extrabold text-white">
                                    PKR {remAfter.toLocaleString()}
                                    <span
                                      className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
                                        remAfter <= 0
                                          ? 'bg-emerald-600 text-white'
                                          : allocVal > 0 || b.previously_paid > 0
                                          ? 'bg-amber-500 text-slate-950'
                                          : 'bg-slate-700 text-slate-300'
                                      }`}
                                    >
                                      {remAfter <= 0 ? 'PAID' : allocVal > 0 || b.previously_paid > 0 ? 'PARTIAL' : 'UNPAID'}
                                    </span>
                                  </td>
                                  <td className="text-right">
                                    <button
                                      type="button"
                                      onClick={() => handlePrioritizeBillFirst(b.sale_id)}
                                      className="btn-secondary px-2.5 py-1 text-[11px]"
                                    >
                                      Settle This Bill First
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-950/90 font-extrabold text-white">
                              <td colSpan={4} className="p-3 text-right uppercase text-yellow-300">
                                Total Allocation Summary:
                              </td>
                              <td className="p-3 text-right font-mono text-rose-300">
                                PKR {totalOutBefore.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-emerald-300">
                                PKR {totalAllocatedNow.toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-mono text-yellow-300">
                                PKR {projectedRemainingAfter.toLocaleString()}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {/* Excess Payment Handling */}
                    {unallocatedDiff > 0 && enteredPayment > 0 && (
                      <div className="p-3.5 rounded-xl bg-amber-950/90 border border-yellow-400 text-xs space-y-2">
                        <div className="font-bold text-yellow-200">
                          Unallocated Payment Notice: PKR {unallocatedDiff.toLocaleString()} of your PKR {enteredPayment.toLocaleString()} payment is not allocated to any bill.
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAllocationPaymentInput(String(totalAllocatedNow))}
                            className="btn-oil px-3 py-1.5 text-xs"
                          >
                            Match Payment Amount to Allocated Bills (PKR {totalAllocatedNow.toLocaleString()})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllocationExcessAction('ADVANCE_CREDIT')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                              allocationExcessAction === 'ADVANCE_CREDIT'
                                ? 'bg-emerald-600 text-white border-white'
                                : 'bg-slate-800 text-slate-200 border-white/20'
                            }`}
                          >
                            Save Excess PKR {unallocatedDiff.toLocaleString()} as Customer Advance Credit
                          </button>
                        </div>
                      </div>
                    )}

                    {allocationError && (
                      <div className="p-3 rounded-xl bg-rose-950 border border-rose-500 text-xs text-rose-200 font-bold">
                        {allocationError}
                      </div>
                    )}

                    {/* Step 1: Review Proposal Button vs Step 2: Explicit Confirmation Box */}
                    {!allocationConfirming ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="text-xs text-slate-200">
                          <strong>Status:</strong> Proposal Only (Not Saved).{' '}
                          <strong className="text-yellow-300">
                            PKR {projectedRemainingAfter.toLocaleString()} will remain outstanding
                          </strong>{' '}
                          after this payment.
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAllocationLedgerModal(null);
                              setAllocationConfirming(false);
                            }}
                            className="btn-secondary px-4 py-2.5 text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={enteredPayment <= 0 || unallocatedDiff < 0}
                            onClick={() => setAllocationConfirming(true)}
                            className="btn-primary px-5 py-2.5 text-xs uppercase"
                          >
                            Review & Confirm Allocation →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-emerald-950/90 border-2 border-emerald-400 space-y-3 animate-fade-in">
                        <div className="text-xs font-extrabold text-emerald-300 uppercase">
                          Final Confirmation Summary — Please Verify Before Saving
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-white">
                          <div>Customer: <strong>{allocationLedgerModal.customer_name}</strong></div>
                          <div>Payment Received: <strong className="text-yellow-300">PKR {enteredPayment.toLocaleString()}</strong></div>
                          <div>Total Allocated: <strong className="text-emerald-300">PKR {totalAllocatedNow.toLocaleString()}</strong></div>
                          <div>Outstanding Before: <strong>PKR {totalOutBefore.toLocaleString()}</strong></div>
                          <div>Projected Outstanding After: <strong className="text-rose-300">PKR {projectedRemainingAfter.toLocaleString()}</strong></div>
                          {unallocatedDiff > 0 && (
                            <div>Excess Advance Credit: <strong>PKR {unallocatedDiff.toLocaleString()}</strong></div>
                          )}
                        </div>
                        <div className="text-xs text-slate-200 space-y-1 border-t border-white/15 pt-2">
                          {unpaidBills
                            .filter(b => pkr(allocationDraftMap[b.sale_id] || 0) > 0)
                            .map(b => {
                              const alloc = pkr(allocationDraftMap[b.sale_id] || 0);
                              const rem = pkr(Math.max(0, b.remaining_balance - alloc));
                              return (
                                <div key={b.sale_id} className="font-mono">
                                  • {b.invoice_number}: Before PKR {b.remaining_balance.toLocaleString()} → Allocated{' '}
                                  <strong className="text-emerald-300">PKR {alloc.toLocaleString()}</strong> → Remaining{' '}
                                  <strong className="text-yellow-300">PKR {rem.toLocaleString()}</strong>
                                </div>
                              );
                            })}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            disabled={allocationBusy}
                            onClick={() => setAllocationConfirming(false)}
                            className="btn-secondary px-4 py-2.5 text-xs"
                          >
                            Back / Change Bill Allocation
                          </button>
                          <button
                            type="button"
                            disabled={allocationBusy}
                            onClick={handleExecuteConfirmedAllocation}
                            className="btn-oil px-6 py-2.5 text-xs uppercase"
                          >
                            {allocationBusy ? 'Saving Payment...' : 'Confirm Payment & Allocation'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Complete Auditable Bill & Payment Allocation History */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-yellow-300 uppercase">
                      Confirmed Payment Vouchers & Bill Allocation Audit Trail ({allocationLedgerModal.payment_history.length})
                    </h4>
                    {allocationLedgerModal.payment_history.length === 0 ? (
                      <div className="text-xs text-slate-400 py-3">No payment allocation vouchers recorded for this customer yet.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs erp-table">
                          <thead>
                            <tr>
                              <th>Voucher #</th>
                              <th>Date</th>
                              <th>Payment Received</th>
                              <th>Bill-by-Bill Allocation Breakdown</th>
                              <th>Before → After</th>
                              <th>Status</th>
                              <th className="text-right">Audit / Reverse</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allocationLedgerModal.payment_history.map(pm => (
                              <tr key={pm.id}>
                                <td className="font-mono font-bold text-yellow-300">{pm.payment_number}</td>
                                <td className="font-mono">{pm.payment_date}</td>
                                <td className="font-mono font-bold text-emerald-300">
                                  PKR {pkr(pm.payment_amount).toLocaleString()} ({pm.payment_method})
                                </td>
                                <td>
                                  {pm.allocations.map((al, i) => (
                                    <div key={i} className="font-mono text-[11px]">
                                      {al.invoice_number}: Paid PKR {pkr(al.allocated_amount).toLocaleString()} (Rem: PKR {pkr(al.remaining_after).toLocaleString()})
                                    </div>
                                  ))}
                                </td>
                                <td className="font-mono text-[11px]">
                                  PKR {pkr(pm.outstanding_before).toLocaleString()} → PKR {pkr(pm.outstanding_after).toLocaleString()}
                                </td>
                                <td>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      pm.status === 'REVERSED' ? 'bg-rose-700 text-white' : 'bg-emerald-700 text-white'
                                    }`}
                                  >
                                    {pm.status}
                                  </span>
                                </td>
                                <td className="text-right">
                                  {pm.status !== 'REVERSED' && (
                                    <button
                                      type="button"
                                      onClick={() => triggerReverse('CUSTOMER_PAYMENT', pm.id, pm.payment_number)}
                                      className="btn-danger px-2.5 py-1 text-[11px]"
                                    >
                                      Reverse Payment
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ==================== MODAL: SUPPLIER 360° BILLS PROFILE ==================== */}
      {supplierProfileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto no-print">
          <div className="glass-panel max-w-4xl w-full rounded-2xl p-5 sm:p-6 space-y-4 border border-yellow-400/50 animate-modal my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-bold">
                  {supplierProfileModal.supplier.group_name || 'General Suppliers'}
                </span>
                <h3 className="text-lg font-black text-white mt-1">
                  {supplierProfileModal.supplier.name} ({supplierProfileModal.supplier.city})
                </h3>
                <p className="text-xs text-slate-200">
                  Phone: {supplierProfileModal.supplier.phone || 'N/A'} • CNIC: {supplierProfileModal.supplier.cnic || 'N/A'} • Payable Balance:{' '}
                  <strong className="text-rose-300">PKR {pkr(supplierProfileModal.supplier.current_payable).toLocaleString()}</strong>
                </p>
              </div>
              <button onClick={() => setSupplierProfileModal(null)} className="text-slate-300 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs erp-table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total Bill</th>
                    <th>Paid</th>
                    <th>Payable</th>
                    <th className="text-right">View Bill</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierProfileModal.bills.map(b => (
                    <tr key={b.id}>
                      <td className="font-mono font-bold text-yellow-300">{b.purchase_number}</td>
                      <td className="font-mono">{b.invoice_date}</td>
                      <td>{b.items_summary}</td>
                      <td className="font-bold">PKR {pkr(b.total_amount).toLocaleString()}</td>
                      <td className="text-emerald-300 font-bold">PKR {pkr(b.paid_amount).toLocaleString()}</td>
                      <td className="text-rose-300 font-bold">PKR {pkr(b.payable_amount).toLocaleString()}</td>
                      <td className="text-right">
                        <button
                          onClick={() => setInvoiceModal({ kind: 'PURCHASE', purchase: b })}
                          className="bg-yellow-400 text-slate-950 px-2.5 py-1 rounded font-bold"
                        >
                          Open Bill
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

      {/* ==================== MODAL: REPAY LOAN / OWNER CAPITAL ==================== */}
      {loanRepayModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 no-print">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 space-y-4 border border-yellow-400/40 animate-modal">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-white uppercase samsung-heading">
                Repay Arranged Loan / Capital
              </h3>
              <button onClick={() => setLoanRepayModal(null)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-white/15 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-300">Lender / Source:</span>
                <span className="font-bold text-white">{loanRepayModal.lender_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Payable Balance:</span>
                <span className="text-rose-300 font-extrabold">PKR {pkr(loanRepayModal.current_balance).toLocaleString()}</span>
              </div>
            </div>
            <form onSubmit={handleRepayLoan} className="space-y-3">
              <div>
                <label className="text-xs text-white font-semibold">Repayment Amount (PKR)</label>
                <input
                  type="number"
                  required
                  placeholder={`Max PKR ${pkr(loanRepayModal.current_balance)}`}
                  value={loanRepayAmount}
                  onChange={e => setLoanRepayAmount(e.target.value)}
                  className="mt-1 erp-input"
                />
              </div>
              <div>
                <label className="text-xs text-white font-semibold">Pay From Account</label>
                <select
                  value={loanRepayAccId}
                  onChange={e => setLoanRepayAccId(Number(e.target.value))}
                  className="mt-1 erp-input"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Avail: PKR {pkr(a.current_balance).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="Repayment note (optional)"
                value={loanRepayRemarks}
                onChange={e => setLoanRepayRemarks(e.target.value)}
                className="erp-input"
              />
              <button type="submit" className="w-full btn-oil py-3 text-xs uppercase">
                Confirm Repayment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: PARTIAL PAYMENT INSTALLMENT ==================== */}
      {partialModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 no-print">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 space-y-4 border border-yellow-400/40 animate-modal">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-white uppercase samsung-heading">
                {partialModal.kind === 'SALE' ? 'Receive Customer Khata Installment' : 'Pay Supplier Khata Installment'}
              </h3>
              <button onClick={() => setPartialModal(null)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-white/15 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-300">Reference Bill:</span>
                <span className="font-mono font-bold text-yellow-300">{partialModal.refNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Party Name:</span>
                <span className="font-bold text-white">{partialModal.partyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Total Bill Amount:</span>
                <span className="font-mono text-white">PKR {pkr(partialModal.totalAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Already Settled:</span>
                <span className="font-mono text-emerald-300">PKR {pkr(partialModal.alreadyPaid).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-1.5">
                <span className="text-slate-200 font-semibold">Remaining Balance:</span>
                <span className="text-rose-400 font-extrabold tabular-nums">
                  PKR {pkr(partialModal.remainingBalance).toLocaleString()}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordPartialPayment} className="space-y-3">
              <div>
                <label className="text-xs text-white font-semibold">Installment Amount (PKR)</label>
                <input
                  type="number"
                  required
                  placeholder={`Maximum PKR ${pkr(partialModal.remainingBalance)}`}
                  value={partialAmount}
                  onChange={e => setPartialAmount(e.target.value)}
                  className="mt-1 erp-input"
                />
              </div>

              <div>
                <label className="text-xs text-white font-semibold">Select Financial Account</label>
                <select
                  value={partialAccountId}
                  onChange={e => {
                    const id = Number(e.target.value);
                    setPartialAccountId(id);
                    const acc = accounts.find(a => a.id === id);
                    if (acc) setPartialMethod(acc.type);
                  }}
                  className="mt-1 erp-input"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type}) — Avail: PKR {pkr(a.current_balance).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {partialModal.kind === 'PURCHASE' && (
                <>
                  <div>
                    <label className="text-xs text-yellow-300 font-semibold">Payment Arrangement</label>
                    <select
                      value={partialArrangement}
                      onChange={e => setPartialArrangement(e.target.value as PaymentArrangementType)}
                      className="mt-1 erp-input font-bold"
                    >
                      <option value="WALLET">Deduct from Selected Account</option>
                      <option value="OWNER_CAPITAL">Arranged from Owner Pocket / Capital</option>
                      <option value="MARKET_LOAN">Arranged via Market Loan / Udhaar</option>
                    </select>
                  </div>
                  {partialArrangement !== 'WALLET' && (
                    <div>
                      <label className="text-xs text-rose-300 font-semibold">Lender / Owner Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Owner Pocket / Market Loan"
                        value={partialLenderName}
                        onChange={e => setPartialLenderName(e.target.value)}
                        className="mt-1 erp-input"
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="text-xs text-white font-semibold">Remarks / Payment Note</label>
                <input
                  type="text"
                  placeholder="Optional installment note"
                  value={partialRemarks}
                  onChange={e => setPartialRemarks(e.target.value)}
                  className="mt-1 erp-input"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 btn-primary py-3 text-xs uppercase tracking-wider"
                >
                  Confirm PKR Installment
                </button>
                <button
                  type="button"
                  onClick={() => setPartialModal(null)}
                  className="btn-secondary px-4 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADMIN PASSWORD SECURITY ==================== */}
      {securityModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 no-print">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 space-y-4 border border-rose-500/50 animate-modal">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-extrabold text-rose-400 uppercase flex items-center gap-2 samsung-heading">
                <Lock className="w-4 h-4" /> Administrator Security Verification
              </h3>
              <button onClick={() => setSecurityModal(null)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-bold text-white">{securityModal.title}</div>
              <p className="text-xs text-slate-200">{securityModal.description}</p>
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
                  autoComplete="current-password"
                  placeholder="Enter administrator password to authorize"
                  value={securityPassword}
                  onChange={e => setSecurityPassword(e.target.value)}
                  className="mt-1.5 erp-input"
                />
              </div>

              {securityError && (
                <div className="p-2.5 rounded-lg bg-rose-950 border border-rose-600 text-xs text-rose-200 font-semibold">
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
                  className="btn-secondary px-4 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MOBILE / TABLET FIXED BOTTOM BAR ==================== */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-white/15 grid grid-cols-5 py-2 px-1 text-[10px] font-bold no-print">
        <button
          onClick={() => navigateTo({ main: 'dashboard' })}
          className={`flex flex-col items-center gap-1 ${
            currentNav.main === 'dashboard' ? 'text-yellow-300' : 'text-slate-300'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Dashboard
        </button>
        <button
          onClick={() => navigateTo({ main: 'accounts' })}
          className={`flex flex-col items-center gap-1 ${
            currentNav.main === 'accounts' ? 'text-yellow-300' : 'text-slate-300'
          }`}
        >
          <Wallet className="w-4 h-4" /> Trade
        </button>
        <button
          onClick={() => navigateTo({ main: 'inventory' })}
          className={`flex flex-col items-center gap-1 ${
            currentNav.main === 'inventory' ? 'text-yellow-300' : 'text-slate-300'
          }`}
        >
          <Package className="w-4 h-4" /> Stock
        </button>
        <button
          onClick={() => navigateTo({ main: 'reports' })}
          className={`flex flex-col items-center gap-1 ${
            currentNav.main === 'reports' ? 'text-yellow-300' : 'text-slate-300'
          }`}
        >
          <FileText className="w-4 h-4" /> Reports
        </button>
        <button
          onClick={() => navigateTo({ main: 'directory' })}
          className={`flex flex-col items-center gap-1 ${
            currentNav.main === 'directory' ? 'text-yellow-300' : 'text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" /> Parties
        </button>
      </div>
    </div>
  );
}