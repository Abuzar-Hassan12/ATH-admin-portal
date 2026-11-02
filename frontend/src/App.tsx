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
  CustomerOutstandingLedger, AdminUserRecord, PartnerTransparencyRow
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
type InventorySubTab = 'stock_breakdown' | 'locations_transfer';
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
  // Subtle top brand accent bar only — no floating cartoon droplets
  return (
    <div
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#005B66] via-[#FF6B3D] to-[#005B66] pointer-events-none z-50 no-print"
      aria-hidden="true"
    />
  );
}

function AthFracturedCurrentHero({ onNavigate }: { onNavigate: (partial: Partial<NavState>) => void }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#F7F7F5]/15 bg-[#00282E] p-5 shadow-lg">
      {/* Subtle ATH Fractured Current Brand Vector Accent */}
      <svg
        className="absolute right-0 top-0 h-full w-1/2 opacity-20 pointer-events-none"
        viewBox="0 0 500 320"
        fill="none"
        preserveAspectRatio="none"
      >
        <path d="M140 340 C220 220, 340 160, 520 20" stroke="#FF6B3D" strokeWidth="10" strokeLinecap="round" />
        <path d="M200 340 C280 230, 380 180, 540 65" stroke="#F7F7F5" strokeWidth="4" strokeLinecap="round" strokeDasharray="14 18" />
        <path d="M80 340 C170 200, 290 120, 490 -10" stroke="#005B66" strokeWidth="16" strokeLinecap="round" />
      </svg>

      <div className="relative z-10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F7F7F5]/10 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="bg-[#F7F7F5] px-3 py-1.5 rounded-lg border border-white shadow-sm shrink-0">
              <img
                src="/logo.png"
                alt="ATH Lubricants"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                className="h-9 w-auto object-contain"
              />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#FF6B3D]">
                Awan Trade Hub • Commercial Distribution & ERP
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-[#F7F7F5]">
                ATH LUBRICANTS — <span className="text-[#FF6B3D]">GOLD 4T</span> M2 / M4 SERIES
              </h2>
              <p className="text-xs text-[#F7F7F5]/75">
                SAE 20W-40 API SL • 12 × 700 ML Master Cartons • Smoother Ride | Better Protection | Longer Life
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-[#001D21] text-emerald-300 border border-emerald-400/30">
              PKR Whole-Rupee Ledger
            </span>
          </div>
        </div>

        {/* Direct Commercial Operations Launchpad */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate({ main: 'accounts', accSub: 'sales' })}
            className="btn-primary py-2.5 px-3 text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> New Sale Invoice
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ main: 'accounts', accSub: 'purchases' })}
            className="btn-oil py-2.5 px-3 text-xs"
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Record Purchase
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ main: 'accounts', accSub: 'partials' })}
            className="btn-secondary py-2.5 px-3 text-xs"
          >
            <Clock className="w-3.5 h-3.5 text-[#FF6B3D]" /> Settle Khata Dues
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ main: 'reports', repSub: 'daybook' })}
            className="btn-secondary py-2.5 px-3 text-xs"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-300" /> Day Book (Roznamcha)
          </button>
        </div>
      </div>
    </div>
  );
}

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes inactivity timeout

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_NAMES_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

/** Returns current wall-clock Date components in Pakistan Standard Time (Asia/Karachi, UTC+5) */
function getNowPktParts(): { year: number; month: number; day: number; weekday: string; ymd: string; time12: string } {
  const now = new Date();
  const pktMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (5 * 3600 * 1000);
  const d = new Date(pktMs);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = DAY_NAMES_FULL[d.getDay()];
  const ymd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  let hrs = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  hrs = hrs % 12 || 12;
  const time12 = `${String(hrs).padStart(2, '0')}:${mins} ${ampm}`;
  return { year, month, day, weekday, ymd, time12 };
}

/** Formats YYYY-MM-DD into '12-October-2026' (or with Day Name if includeDay=true) */
function formatHumanPktDate(ymd: string, includeDay = false): string {
  if (!ymd || ymd.length < 10) return ymd || '';
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const mName = MONTH_NAMES_FULL[m - 1] || 'Month';
  const base = `${String(d).padStart(2, '0')}-${mName}-${y}`;
  if (!includeDay) return base;
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES_FULL[dt.getDay()]}, ${base}`;
}

/** Formats 'YYYY-MM-DD HH:MM' or ISO string into '28-October-2026 • 06:40 PM' */
function formatRecordDateTimePkt(raw: string | undefined | null): string {
  if (!raw) return '';
  const clean = String(raw).trim().replace('T', ' ');
  const ymd = clean.slice(0, 10);
  const hm = clean.slice(11, 16);
  const datePart = formatHumanPktDate(ymd, false);
  if (!hm || !hm.includes(':')) return datePart;
  const [hStr, mStr] = hm.split(':');
  let h = Number(hStr);
  if (!Number.isFinite(h)) return `${datePart} ${hm}`;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${datePart} • ${String(h).padStart(2, '0')}:${mStr} ${ampm}`;
}

/** Extracts 'YYYY-MM-DD' date key from any record date/timestamp string */
function extractRecordYmd(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw).trim().slice(0, 10);
}

/** Normalizes CNIC by stripping all non-digit characters */
function normalizeCnic(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw).replace(/\D+/g, '');
}

/** Normalizes phone numbers (+92 / 0092 / 03xx-xxxxxxx -> 03xxxxxxxxx) */
function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D+/g, '');
  if (digits.startsWith('0092') && digits.length >= 12) {
    digits = '0' + digits.slice(4);
  } else if (digits.startsWith('92') && digits.length === 12) {
    digits = '0' + digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith('3')) {
    digits = '0' + digits;
  }
  return digits;
}

/** Normalizes name, village/city, and group text for comparison */
function normalizeIdentityText(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function App() {
  // ==================== AUTHENTICATION & 15-MINUTE INACTIVITY TIMEOUT ====================
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const isAuth = localStorage.getItem('ath_admin_auth') === 'true';
    const lastTs = Number(localStorage.getItem('ath_admin_auth_ts') || 0);
    if (!isAuth || !lastTs || Date.now() - lastTs > INACTIVITY_TIMEOUT_MS) {
      localStorage.removeItem('ath_admin_auth');
      localStorage.removeItem('ath_admin_auth_ts');
      return false;
    }
    return true;
  });
  const [currentAdmin, setCurrentAdmin] = useState<AdminUserRecord | null>(() => {
    try {
      const raw = localStorage.getItem('ath_admin_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [authTab, setAuthTab] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [loginUser, setLoginUser] = useState<string>('');
  const [loginPass, setLoginPass] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [signupFullName, setSignupFullName] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupUsername, setSignupUsername] = useState<string>('');
  const [signupPassword, setSignupPassword] = useState<string>('');
  const [signupSuccessMsg, setSignupSuccessMsg] = useState<string>('');
  const [authBusy, setAuthBusy] = useState<boolean>(false);

  const [adminsList, setAdminsList] = useState<AdminUserRecord[]>([]);
  const [partnerTransparency, setPartnerTransparency] = useState<PartnerTransparencyRow[]>([]);
  const [dashboardPartnerView, setDashboardPartnerView] = useState<'ALL' | 'MINE'>('ALL');

  useEffect(() => {
    if (!isAuthenticated) return;
    const updateActivityTimestamp = () => {
      localStorage.setItem('ath_admin_auth_ts', String(Date.now()));
    };
    const checkInactivity = setInterval(() => {
      const lastTs = Number(localStorage.getItem('ath_admin_auth_ts') || 0);
      if (!lastTs || Date.now() - lastTs > INACTIVITY_TIMEOUT_MS) {
        localStorage.removeItem('ath_admin_auth');
        localStorage.removeItem('ath_admin_auth_ts');
        setIsAuthenticated(false);
      }
    }, 15000);

    window.addEventListener('mousemove', updateActivityTimestamp);
    window.addEventListener('mousedown', updateActivityTimestamp);
    window.addEventListener('keydown', updateActivityTimestamp);
    window.addEventListener('touchstart', updateActivityTimestamp);
    return () => {
      clearInterval(checkInactivity);
      window.removeEventListener('mousemove', updateActivityTimestamp);
      window.removeEventListener('mousedown', updateActivityTimestamp);
      window.removeEventListener('keydown', updateActivityTimestamp);
      window.removeEventListener('touchstart', updateActivityTimestamp);
    };
  }, [isAuthenticated]);

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
  // Default to daily ('daily') in Pakistan Standard Time (12:00 AM to 11:59 PM PKT)
  const [period, setPeriod] = useState<TimePeriod>('daily');
  const [customDate, setCustomDate] = useState<string>(''); // Start Date (or Single Specific Date)
  const [customDateTo, setCustomDateTo] = useState<string>(''); // End Date for Range (e.g. 12-October-2026 To 31-October-2026)
  const [pktClock, setPktClock] = useState(() => getNowPktParts());
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);
  const initialSyncDone = useRef<boolean>(false);

  // Live Pakistan Standard Time clock: automatically rolls over day at 12:00 AM midnight PKT
  useEffect(() => {
    const timer = setInterval(() => {
      setPktClock(getNowPktParts());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // ==================== DATA STATES (WITH INSTANT REFRESH CACHE) ====================
  const cachedUiBoot = useMemo(() => {
    try {
      const raw = localStorage.getItem('ath_ui_cache_v2');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [rawStats, setStats] = useState<DashboardStats | null>(() => cachedUiBoot?.stats || null);
  const [locations, setLocations] = useState<StorageLocation[]>(() => cachedUiBoot?.locations || []);
  const [products, setProducts] = useState<Product[]>(() => cachedUiBoot?.products || []);
  const [customers, setCustomers] = useState<Customer[]>(() => cachedUiBoot?.customers || []);
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => cachedUiBoot?.suppliers || []);
  const [allSales, setSales] = useState<SaleRecord[]>(() => cachedUiBoot?.sales || []);
  const [allPurchases, setPurchases] = useState<PurchaseRecord[]>(() => cachedUiBoot?.purchases || []);
  const [allPendingSales, setAllPendingSales] = useState<SaleRecord[]>(() => cachedUiBoot?.pending_sales || []);
  const [allPendingPurchases, setAllPendingPurchases] = useState<PurchaseRecord[]>(() => cachedUiBoot?.pending_purchases || []);
  const [allExpenses, setExpenses] = useState<Expense[]>(() => cachedUiBoot?.expenses || []);
  const [accounts, setAccounts] = useState<FinancialAccount[]>(() => cachedUiBoot?.accounts || []);
  const [loans, setLoans] = useState<LoanRecord[]>(() => cachedUiBoot?.loans || []);
  const [allAccountHistory, setAccountHistory] = useState<AccountHistoryEntry[]>(() => cachedUiBoot?.account_history || []);
  const [recycleBin, setRecycleBin] = useState<RecycleBinItem[]>(() => cachedUiBoot?.recycle_bin || []);
  const [rawVyaparReports, setVyaparReports] = useState<VyaparReportsData | null>(() => cachedUiBoot?.vyapar_reports || null);
  const fetchSeqRef = useRef<number>(0);
  const fetchAbortRef = useRef<AbortController | null>(null);

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

  // ==================== SNAPSHOT & PERMANENT DATA PROTECTION ENGINE ====================
  const getSnapshotActivityCount = (snap: any): number => {
    if (!snap || typeof snap !== 'object') return 0;
    const txCount =
      (Array.isArray(snap.sales) ? snap.sales.length : 0) +
      (Array.isArray(snap.purchases) ? snap.purchases.length : 0) +
      (Array.isArray(snap.expenses) ? snap.expenses.length : 0) +
      (Array.isArray(snap.account_transactions) ? snap.account_transactions.length : 0) +
      (Array.isArray(snap.customer_payments) ? snap.customer_payments.length : 0);
    const stockCount = Array.isArray(snap.location_stocks)
      ? snap.location_stocks.reduce((sum: number, ls: any) => sum + (Number(ls.stock_bottles) || 0), 0)
      : 0;
    const cashCount = Array.isArray(snap.accounts)
      ? snap.accounts.reduce((sum: number, a: any) => sum + Math.abs(Number(a.current_balance) || 0), 0)
      : 0;
    const customParties =
      Math.max(0, (Array.isArray(snap.customers) ? snap.customers.length : 0) - 4) +
      Math.max(0, (Array.isArray(snap.suppliers) ? snap.suppliers.length : 0) - 2);
    return txCount + stockCount + cashCount + customParties;
  };

  const getSavedSnapshot = () => {
    try {
      // Once connected to permanent PostgreSQL, do not upload bulky localStorage snapshots on every API call
      if (localStorage.getItem('ath_pg_persistent') === 'true') {
        return null;
      }
      const raw = localStorage.getItem('ath_erp_snapshot');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const getSnapshotTxCount = (snap: any): number => {
    if (!snap || typeof snap !== 'object') return 0;
    return (
      (Array.isArray(snap.sales) ? snap.sales.length : 0) +
      (Array.isArray(snap.purchases) ? snap.purchases.length : 0) +
      (Array.isArray(snap.expenses) ? snap.expenses.length : 0) +
      (Array.isArray(snap.account_transactions) ? snap.account_transactions.length : 0) +
      (Array.isArray(snap.customer_payments) ? snap.customer_payments.length : 0)
    );
  };

  const saveSnapshot = (snap: any, allowOverwriteIfEmpty = false) => {
    if (!snap || typeof snap !== 'object' || !snap.version) return;
    try {
      if (snap.persistent) {
        localStorage.setItem('ath_pg_persistent', 'true');
        return;
      }
      const existing = getSavedSnapshot();
      const existingTxs = getSnapshotTxCount(existing);
      const incomingTxs = getSnapshotTxCount(snap);
      if (!allowOverwriteIfEmpty && existingTxs > 0 && incomingTxs === 0) {
        return;
      }
      localStorage.setItem('ath_erp_snapshot', JSON.stringify(snap));
    } catch {
      // Ignore storage quota limits
    }
  };

  const resilientFetch = async (
    url: string,
    options: RequestInit,
    maxRetries = 2
  ): Promise<{ res: Response; data: any }> => {
    let lastErr: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, options);
        const text = await res.text();
        let data: any = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          if ([502, 503, 504].includes(res.status) && attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 900 * (attempt + 1)));
            continue;
          }
          throw new Error(`Server returned status ${res.status}. Please try again.`);
        }
        return { res, data };
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        lastErr = err;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 850 * (attempt + 1)));
          continue;
        }
      }
    }
    const rawMsg = String(lastErr?.message || '');
    if (rawMsg.toLowerCase().includes('failed to fetch') || rawMsg.toLowerCase().includes('networkerror')) {
      throw new Error('Unable to reach the server. Please ensure your connection is active and try again.');
    }
    throw lastErr || new Error('Network request failed.');
  };

  const apiSend = async (endpoint: string, method: 'POST' | 'PUT', payload: Record<string, any>) => {
    const { res, data } = await resilientFetch(
      `${API_BASE}${endpoint}`,
      {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: currentAdmin?.id || 1,
          admin_name: currentAdmin?.full_name || currentAdmin?.username || 'Admin',
          ...payload,
          client_snapshot: getSavedSnapshot()
        })
      },
      2
    );
    if (!res.ok) {
      throw new Error(data.detail || 'Operation failed');
    }
    if (data.snapshot) {
      saveSnapshot(data.snapshot, true);
      initialSyncDone.current = true;
    }
    return data;
  };

  const fetchData = async () => {
    if (!isAuthenticated) return;
    const requestId = ++fetchSeqRef.current;
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    setLoading(true);

    try {
      // Fetch complete dataset once via POST /api/bootstrap so all date/timeframe filters switch in 0ms!
      const { res, data } = await resilientFetch(
        `${API_BASE}/bootstrap`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            period: 'all',
            custom_date: null,
            channel: 'ALL',
            client_snapshot: getSavedSnapshot()
          })
        },
        2
      );
      if (!res.ok) throw new Error(data.detail || 'Failed to sync ERP database');
      if (requestId !== fetchSeqRef.current) return;

      if (data.snapshot) {
        saveSnapshot(data.snapshot, false);
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
      setAllPendingSales(Array.isArray(data.pending_sales) ? data.pending_sales : []);
      setAllPendingPurchases(Array.isArray(data.pending_purchases) ? data.pending_purchases : []);
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
      setVyaparReports(data.vyapar_reports || null);
      setAdminsList(Array.isArray(data.admins) ? data.admins : []);
      setPartnerTransparency(Array.isArray(data.partner_transparency) ? data.partner_transparency : []);

      try {
        const { snapshot, ...uiCache } = data;
        localStorage.setItem('ath_ui_cache_v2', JSON.stringify(uiCache));
      } catch {
        // Ignore storage quota
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError' && requestId === fetchSeqRef.current) {
        console.error('Sync warning:', err);
      }
    } finally {
      if (requestId === fetchSeqRef.current) setLoading(false);
    }
  };

  // Only fetch from server on login; timeframe & date-range switches happen in 0ms in memory!
  useEffect(() => {
    fetchData();
  }, [isAuthenticated]);

  // ==================== INSTANT 0ms PAKISTAN TIME (PKT) DATE RANGE & FILTER ENGINE ====================
  const activeDateRangeInfo = useMemo(() => {
    const todayYmd = pktClock.ymd;
    const [yr, mo, dy] = todayYmd.split('-').map(Number);
    const monthName = MONTH_NAMES_FULL[(mo || 1) - 1] || 'October';

    if (customDate) {
      const startYmd = customDate;
      const endYmd = customDateTo && customDateTo >= customDate ? customDateTo : customDate;
      const label =
        startYmd === endYmd
          ? `${formatHumanPktDate(startYmd, true)} (12:00 AM – 11:59 PM PKT)`
          : `${formatHumanPktDate(startYmd)} To ${formatHumanPktDate(endYmd)} (12:00 AM – 11:59 PM PKT)`;
      return { startYmd, endYmd, badge: startYmd === endYmd ? formatHumanPktDate(startYmd) : `${formatHumanPktDate(startYmd)} To ${formatHumanPktDate(endYmd)}`, fullLabel: label };
    }

    if (period === 'daily') {
      return {
        startYmd: todayYmd,
        endYmd: todayYmd,
        badge: `TODAY • ${formatHumanPktDate(todayYmd)}`,
        fullLabel: `Today — ${formatHumanPktDate(todayYmd, true)} (12:00 AM To 11:59 PM PKT)`
      };
    }

    if (period === 'weekly') {
      const startDt = new Date(yr, (mo || 1) - 1, (dy || 1) - 6);
      const startYmd = `${startDt.getFullYear()}-${String(startDt.getMonth() + 1).padStart(2, '0')}-${String(startDt.getDate()).padStart(2, '0')}`;
      return {
        startYmd,
        endYmd: todayYmd,
        badge: `7 DAYS (${formatHumanPktDate(startYmd)} To ${formatHumanPktDate(todayYmd)})`,
        fullLabel: `Last 7 Days — ${formatHumanPktDate(startYmd)} To ${formatHumanPktDate(todayYmd)} (PKT)`
      };
    }

    if (period === 'monthly') {
      const firstOfMonth = `${yr}-${String(mo).padStart(2, '0')}-01`;
      return {
        startYmd: firstOfMonth,
        endYmd: todayYmd,
        badge: `${monthName.toUpperCase()} ${yr} (${formatHumanPktDate(firstOfMonth)} To ${formatHumanPktDate(todayYmd)})`,
        fullLabel: `Month of ${monthName} ${yr} — ${formatHumanPktDate(firstOfMonth)} To ${formatHumanPktDate(todayYmd)} (PKT)`
      };
    }

    return {
      startYmd: '1970-01-01',
      endYmd: '2099-12-31',
      badge: 'ALL-TIME RECORDS',
      fullLabel: `All-Time Complete Business History (Up to ${formatHumanPktDate(todayYmd)} 11:59 PM PKT)`
    };
  }, [period, customDate, customDateTo, pktClock.ymd]);

  const isDateInActiveRange = (rawDateStr: string | undefined | null): boolean => {
    const ymd = extractRecordYmd(rawDateStr);
    if (!ymd) return true;
    return ymd >= activeDateRangeInfo.startYmd && ymd <= activeDateRangeInfo.endYmd;
  };

  // Filtered Sales, Purchases, Expenses & Cashflow Ledger for the active Pakistan date range (0ms)
  const sales = useMemo(
    () => allSales.filter(s => isDateInActiveRange(s.invoice_date)),
    [allSales, activeDateRangeInfo]
  );

  const purchases = useMemo(
    () => allPurchases.filter(p => isDateInActiveRange(p.invoice_date)),
    [allPurchases, activeDateRangeInfo]
  );

  const expenses = useMemo(
    () => allExpenses.filter(e => isDateInActiveRange(e.expense_date)),
    [allExpenses, activeDateRangeInfo]
  );

  const accountHistory = useMemo(
    () =>
      allAccountHistory.filter(h => {
        if (!isDateInActiveRange(h.date || h.timestamp)) return false;
        if (channelFilter !== 'ALL' && !String(h.channel || '').toUpperCase().includes(channelFilter)) {
          return false;
        }
        return true;
      }),
    [allAccountHistory, activeDateRangeInfo, channelFilter]
  );

  // Instant Synchronized Dashboard KPIs for the Active Date Range
  const stats = useMemo<DashboardStats | null>(() => {
    if (!rawStats && products.length === 0 && accounts.length === 0) return null;
    const activeConfirmedSales = sales.filter(s => (s.doc_type || 'SALE') !== 'ESTIMATE');
    let salesRev = 0;
    let salesPend = 0;
    let totalCogs = 0;

    for (const s of activeConfirmedSales) {
      const sign = s.doc_type === 'SALE_RETURN' ? -1 : 1;
      const tot = pkr(s.total_amount);
      salesRev += sign * tot;
      if ((s.doc_type || 'SALE') === 'SALE') {
        salesPend += pkr(s.receivable_amount);
      }
      totalCogs += sign * pkr(s.bill_cost);
    }

    let purCost = 0;
    let purPend = 0;
    for (const p of purchases) {
      const sign = p.doc_type === 'PURCHASE_RETURN' ? -1 : 1;
      const tot = pkr(p.total_amount);
      purCost += sign * tot;
      if ((p.doc_type || 'PURCHASE') === 'PURCHASE') {
        purPend += pkr(p.payable_amount);
      }
    }

    // Reconcile Sales Collected & Purchases Paid directly from dated ledger entries in the active range
    let salesCol = 0;
    let purPaid = 0;
    for (const h of accountHistory) {
      if (
        h.entity_type === 'SALE' ||
        h.type === 'CUSTOMER PAYMENT ALLOCATION' ||
        h.type === 'CUSTOMER KHATA COLLECTION' ||
        h.type === 'PREVIOUS KHATA COLLECTION'
      ) {
        salesCol += pkr(h.cash_in) - pkr(h.cash_out);
      } else if (
        h.entity_type === 'PURCHASE' ||
        h.type === 'SUPPLIER KHATA PAYMENT' ||
        h.type === 'ARRANGED PAYMENT OUTFLOW'
      ) {
        purPaid += pkr(h.cash_out) - pkr(h.cash_in);
      }
    }

    const expTotal = expenses.reduce((sum, e) => sum + pkr(e.amount), 0);
    const grossProfit = pkr(salesRev - totalCogs);
    const netProfit = pkr(grossProfit - expTotal);

    const totalStockBottles = products.reduce((sum, p) => sum + pkr(p.current_stock_bottles), 0);
    const totalStockVal = products.reduce((sum, p) => sum + pkr(p.stock_valuation), 0);
    const totalRec = customers.reduce((sum, c) => sum + pkr(c.current_receivable), 0);
    const totalPay = suppliers.reduce((sum, s) => sum + pkr(s.current_payable), 0);
    const totalCash = accounts.reduce((sum, a) => sum + pkr(a.current_balance), 0);
    const totalLoans = loans.reduce((sum, l) => sum + pkr(l.current_balance), 0);

    return {
      period,
      total_stock_bottles: totalStockBottles,
      total_stock_value: totalStockVal,
      total_receivable: totalRec,
      total_payable: totalPay,
      total_loan_payable: totalLoans,
      total_cash_bank: totalCash,
      total_sales_revenue: pkr(salesRev),
      sales_collected: pkr(salesCol),
      sales_pending: pkr(salesPend),
      sales_count: activeConfirmedSales.length,
      total_purchases_cost: pkr(purCost),
      purchases_paid: pkr(purPaid),
      purchases_pending: pkr(purPend),
      purchases_count: purchases.length,
      total_expenses: pkr(expTotal),
      expenses_count: expenses.length,
      estimated_gross_profit: grossProfit,
      net_profit: netProfit,
      net_cash_flow: pkr(salesCol - purPaid - expTotal),
      trash_count: recycleBin.length
    };
  }, [rawStats, sales, purchases, expenses, products, customers, suppliers, accounts, loans, recycleBin, period]);

  // Instant Synchronized Vyapar Reports for the Active Date Range
  const vyaparReports = useMemo<VyaparReportsData | null>(() => {
    if (!rawVyaparReports && products.length === 0) return null;
    const billWise = sales
      .filter(s => (s.doc_type || 'SALE') !== 'ESTIMATE')
      .map(s => ({
        id: s.id,
        invoice_number: s.invoice_number,
        doc_type: s.doc_type || 'SALE',
        date: formatRecordDateTimePkt(s.invoice_date),
        customer_name: s.customer_name,
        customer_city: s.customer_city || 'Local',
        customer_group: s.customer_group || 'General Market',
        items_summary: s.items_summary,
        sale_amount: pkr(s.total_amount),
        cost_amount: pkr(s.bill_cost),
        discount_amount: pkr(s.discount_amount),
        freight_amount: pkr(s.freight_amount),
        net_profit: pkr(s.bill_profit),
        received_amount: pkr(s.received_amount) + pkr(s.applied_to_previous),
        pending_amount: pkr(s.receivable_amount)
      }));

    const itemSummary = products.map(p => {
      const upc = Math.max(1, p.units_per_carton || 12);
      let boughtBtls = 0;
      let boughtVal = 0;
      for (const pur of purchases) {
        for (const it of pur.items || []) {
          if (it.product_id === p.id) {
            boughtBtls += pkr(it.base_quantity);
            boughtVal += pkr(it.line_total);
          }
        }
      }
      let soldBtls = 0;
      let soldVal = 0;
      let soldCogs = 0;
      for (const sal of sales) {
        if ((sal.doc_type || 'SALE') === 'ESTIMATE') continue;
        for (const it of sal.items || []) {
          if (it.product_id === p.id) {
            soldBtls += pkr(it.base_quantity);
            soldVal += pkr(it.line_total);
            soldCogs += pkr(it.line_cost);
          }
        }
      }
      return {
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        brand_name: p.brand_name,
        pack_size: p.pack_size,
        units_per_carton: upc,
        purchased_bottles: boughtBtls,
        purchased_formatted: `${Math.floor(boughtBtls / upc)} Ctn + ${boughtBtls % upc} Btl`,
        purchase_value: pkr(boughtVal),
        sold_bottles: soldBtls,
        sold_formatted: `${Math.floor(soldBtls / upc)} Ctn + ${soldBtls % upc} Btl`,
        sale_revenue: pkr(soldVal),
        cogs: pkr(soldCogs),
        profit: pkr(soldVal - soldCogs),
        closing_bottles: p.current_stock_bottles,
        closing_formatted: `${p.cartons} Ctn + ${p.loose_bottles} Btl`,
        closing_valuation: pkr(p.stock_valuation)
      };
    });

    return {
      period,
      bill_wise_profit: billWise,
      item_wise_summary: itemSummary,
      customer_groups: rawVyaparReports?.customer_groups || [],
      daybook: accountHistory
    };
  }, [rawVyaparReports, sales, purchases, products, accountHistory, period]);

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

  const [saleForceNewCustomer, setSaleForceNewCustomer] = useState<boolean>(false);
  const [purForceNewSupplier, setPurForceNewSupplier] = useState<boolean>(false);
  const [expandedKhataPartyKeys, setExpandedKhataPartyKeys] = useState<Record<string, boolean>>({});
  const [selectedKhataBillIds, setSelectedKhataBillIds] = useState<Record<string, number[]>>({});

  const [allocationSelectedSaleIds, setAllocationSelectedSaleIds] = useState<number[]>([]);

  // Multi-factor Customer Identity Evaluation (CNIC -> Phone -> Name + City + Group)
  const saleCustomerIdentityCheck = useMemo(() => {
    if (saleCustomerId > 0) {
      const exact = customers.find(c => c.id === Number(saleCustomerId)) || null;
      return { verifiedCustomer: exact, possibleMatches: [] as Customer[] };
    }
    if (saleForceNewCustomer) {
      return { verifiedCustomer: null, possibleMatches: [] as Customer[] };
    }
    const nName = normalizeIdentityText(saleCustomerName);
    const nCnic = normalizeCnic(saleCustomerCnic);
    const nPhone = normalizePhone(saleCustomerPhone);
    const nCity = normalizeIdentityText(saleCustomerCity);

    if (!nName && !nCnic && !nPhone) {
      return { verifiedCustomer: null, possibleMatches: [] as Customer[] };
    }

    // 1. Exact CNIC match is strongest identifier
    if (nCnic.length >= 5) {
      const cnicMatch = customers.find(c => normalizeCnic(c.cnic) === nCnic);
      if (cnicMatch) {
        return { verifiedCustomer: cnicMatch, possibleMatches: [cnicMatch] };
      }
    }

    // 2. Find candidates sharing Name or Phone
    const candidates = customers.filter(c => {
      const cName = normalizeIdentityText(c.name);
      const cPhone = normalizePhone(c.phone);
      const cCnic = normalizeCnic(c.cnic);
      if (nCnic && cCnic && nCnic === cCnic) return true;
      if (nPhone.length >= 7 && cPhone === nPhone) return true;
      if (nName && cName === nName) return true;
      return false;
    });

    if (candidates.length === 0) {
      return { verifiedCustomer: null, possibleMatches: [] as Customer[] };
    }

    // Check if there is a single unambiguous multi-factor match (e.g. Name + Phone match with no CNIC conflict)
    if (candidates.length === 1) {
      const cand = candidates[0];
      const cCnic = normalizeCnic(cand.cnic);
      const cPhone = normalizePhone(cand.phone);
      const cCity = normalizeIdentityText(cand.city);
      const cnicConflict = Boolean(nCnic && cCnic && nCnic !== cCnic);
      const phoneConflict = Boolean(nPhone && cPhone && nPhone !== cPhone);
      const cityConflict = Boolean(nCity && nCity !== 'local' && cCity && cCity !== 'local' && nCity !== cCity);

      if (!cnicConflict && !phoneConflict && !cityConflict) {
        // Strong match if phone matches or if no conflicting identifiers exist
        if ((nPhone && cPhone === nPhone) || (nCnic && cCnic === nCnic)) {
          return { verifiedCustomer: cand, possibleMatches: [cand] };
        }
      }
    }

    // Otherwise, identity is uncertain or has multiple/conflicting matches -> ask user to confirm!
    return { verifiedCustomer: null, possibleMatches: candidates };
  }, [customers, saleCustomerId, saleCustomerName, saleCustomerPhone, saleCustomerCnic, saleCustomerCity, saleForceNewCustomer]);

  const activeSaleCustomer = saleCustomerIdentityCheck.verifiedCustomer;

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
    if (saleDocType !== 'SALE' || computedSaleReceived <= 0 || customerPreviousDues <= 0) return 0;
    if (saleIncludePrevDues) {
      // Oldest Bill First (FIFO): settle previous Khata first, remainder goes to current bill
      return pkr(Math.min(customerPreviousDues, computedSaleReceived));
    }
    if (computedSaleReceived <= computedSaleTotal) return 0;
    return pkr(Math.min(customerPreviousDues, computedSaleReceived - computedSaleTotal));
  }, [saleDocType, saleIncludePrevDues, computedSaleReceived, computedSaleTotal, customerPreviousDues]);

  const computedAllocatedToNewBill = useMemo(() => {
    if (saleDocType === 'ESTIMATE') return 0;
    const remAfterPrev = Math.max(0, computedSaleReceived - computedAppliedToPrev);
    return pkr(Math.min(computedSaleTotal, remAfterPrev));
  }, [saleDocType, computedSaleReceived, computedAppliedToPrev, computedSaleTotal]);

  const computedClosingKhata = useMemo(() => {
    if (saleDocType === 'ESTIMATE') return customerPreviousDues;
    if (saleDocType === 'SALE_RETURN') {
      const unpaidRet = Math.max(0, computedSaleTotal - computedSaleReceived);
      return pkr(Math.max(0, customerPreviousDues - unpaidRet));
    }
    const totalDues = computedSaleTotal + customerPreviousDues;
    return pkr(Math.max(0, totalDues - (computedAllocatedToNewBill + computedAppliedToPrev)));
  }, [saleDocType, customerPreviousDues, computedSaleTotal, computedSaleReceived, computedAllocatedToNewBill, computedAppliedToPrev]);

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

  const totalStockAcrossAllLocs = useMemo(() => {
    return selectedSaleProduct ? (selectedSaleProduct.current_stock_bottles || 0) : 0;
  }, [selectedSaleProduct]);

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
    Boolean(
      !selectedSaleProduct ||
      totalStockAcrossAllLocs <= 0 ||
      saleLocAvailableBottles <= 0 ||
      (saleDraftBottles > 0 && saleDraftBottles > saleLocAvailableBottles)
    );

  const purSupplierIdentityCheck = useMemo(() => {
    if (purSupplierId > 0) {
      const exact = suppliers.find(s => s.id === Number(purSupplierId)) || null;
      return { verifiedSupplier: exact, possibleMatches: [] as Supplier[] };
    }
    if (purForceNewSupplier) {
      return { verifiedSupplier: null, possibleMatches: [] as Supplier[] };
    }
    const nName = normalizeIdentityText(purSupplierName);
    const nCnic = normalizeCnic(purSupplierCnic);
    const nPhone = normalizePhone(purSupplierPhone);
    const nCity = normalizeIdentityText(purSupplierCity);

    if (!nName && !nCnic && !nPhone) {
      return { verifiedSupplier: null, possibleMatches: [] as Supplier[] };
    }

    if (nCnic.length >= 5) {
      const cnicMatch = suppliers.find(s => normalizeCnic(s.cnic) === nCnic);
      if (cnicMatch) {
        return { verifiedSupplier: cnicMatch, possibleMatches: [cnicMatch] };
      }
    }

    const candidates = suppliers.filter(s => {
      const sName = normalizeIdentityText(s.name);
      const sPhone = normalizePhone(s.phone);
      const sCnic = normalizeCnic(s.cnic);
      if (nCnic && sCnic && nCnic === sCnic) return true;
      if (nPhone.length >= 7 && sPhone === nPhone) return true;
      if (nName && sName === nName) return true;
      return false;
    });

    if (candidates.length === 1) {
      const cand = candidates[0];
      const sCnic = normalizeCnic(cand.cnic);
      const sPhone = normalizePhone(cand.phone);
      const sCity = normalizeIdentityText(cand.city);
      const cnicConflict = Boolean(nCnic && sCnic && nCnic !== sCnic);
      const phoneConflict = Boolean(nPhone && sPhone && nPhone !== sPhone);
      const cityConflict = Boolean(nCity && nCity !== 'local' && sCity && sCity !== 'local' && nCity !== sCity);

      if (!cnicConflict && !phoneConflict && !cityConflict) {
        if ((nPhone && sPhone === nPhone) || (nCnic && sCnic === nCnic)) {
          return { verifiedSupplier: cand, possibleMatches: [cand] };
        }
      }
    }

    return { verifiedSupplier: null, possibleMatches: candidates };
  }, [suppliers, purSupplierId, purSupplierName, purSupplierPhone, purSupplierCnic, purSupplierCity, purForceNewSupplier]);

  const activePurSupplier = purSupplierIdentityCheck.verifiedSupplier;

  const supplierPreviousDues = pkr(activePurSupplier?.current_payable || 0);

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
    if (saleDocType === 'SALE' && selectedSaleProduct) {
      if (totalStockAcrossAllLocs <= 0) {
        notify(`Zero Stock Available! '${selectedSaleProduct.name}' is completely out of stock in all locations. Add stock via Purchase Bill first.`, true);
        return;
      }
      if (saleDraftBottles > saleLocAvailableBottles) {
        notify(`Not enough stock in ${selectedSaleLocName} (Available: ${saleLocAvailableBottles} Btls, Requested: ${saleDraftBottles} Btls). Please adjust quantity or switch godown.`, true);
        return;
      }
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
    if (authBusy) return;
    setLoginError('');
    setSignupSuccessMsg('');
    setAuthBusy(true);
    try {
      const { res, data } = await resilientFetch(
        `${API_BASE}/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: loginUser.trim(),
            password: loginPass
          })
        },
        2
      );
      if (!res.ok) {
        throw new Error(data.detail || 'Invalid email/username or password.');
      }
      if (data.snapshot) {
        saveSnapshot(data.snapshot, false);
      }
      const profile: AdminUserRecord = {
        id: data.id || 1,
        full_name: data.full_name || data.username || 'Authorized User',
        email: data.email || '',
        username: data.username || loginUser.trim(),
        role: data.role || 'ADMIN',
        approval_status: data.approval_status || 'APPROVED',
        is_super_admin: Boolean(data.is_super_admin)
      };
      localStorage.setItem('ath_admin_auth', 'true');
      localStorage.setItem('ath_admin_auth_ts', String(Date.now()));
      localStorage.setItem('ath_admin_profile', JSON.stringify(profile));
      setCurrentAdmin(profile);
      setIsAuthenticated(true);
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAdminSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy) return;
    setLoginError('');
    setSignupSuccessMsg('');
    setAuthBusy(true);
    try {
      const { res, data } = await resilientFetch(
        `${API_BASE}/auth/signup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: signupFullName.trim(),
            email: signupEmail.trim().toLowerCase(),
            username: signupUsername.trim() || signupEmail.trim().split('@')[0],
            password: signupPassword,
            role: 'ADMIN'
          })
        },
        2
      );
      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed.');
      }
      if (data.snapshot) saveSnapshot(data.snapshot, true);
      setSignupSuccessMsg(data.message);
      setLoginUser(signupEmail.trim().toLowerCase());
      setSignupFullName('');
      setSignupEmail('');
      setSignupUsername('');
      setSignupPassword('');
      setAuthTab('LOGIN');
    } catch (err: any) {
      setLoginError(err.message || 'Registration failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleAdminApprovalDecision = async (targetAdminId: number, decision: 'APPROVED' | 'NOT_APPROVED') => {
    try {
      const approverIdent = currentAdmin?.email || currentAdmin?.username || 'Admin';
      const data = await apiSend(`/auth/admins/${targetAdminId}/decision`, 'POST', {
        approver_email: approverIdent,
        decision
      });
      notify(data.message || `Admin status updated to ${decision}`);
      await fetchData();
    } catch (err: any) {
      notify(err.message || 'Approval update failed', true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ath_admin_auth');
    localStorage.removeItem('ath_admin_auth_ts');
    localStorage.removeItem('ath_admin_profile');
    setIsAuthenticated(false);
    setCurrentAdmin(null);
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

  // ==================== CREATE SALE & PURCHASE HANDLERS (WITH IDEMPOTENCY & DOUBLE-SUBMIT LOCKS) ====================
  const [saleSubmitting, setSaleSubmitting] = useState<boolean>(false);
  const saleSubmitLockRef = useRef<boolean>(false);
  const saleIdempotencyKeyRef = useRef<string>(`SALE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const [purSubmitting, setPurSubmitting] = useState<boolean>(false);
  const purSubmitLockRef = useRef<boolean>(false);
  const purIdempotencyKeyRef = useRef<string>(`PUR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saleSubmitLockRef.current || saleSubmitting) return;

    if (!saleCustomerName.trim() && !saleCustomerId) {
      notify('Please type a Customer / Dealership name or select a saved customer.', true);
      return;
    }

    const finalItems: CartLineItem[] = [...saleCart];
    if (saleQuantity && Number(saleQuantity) > 0 && saleRate !== '' && (saleProductName.trim() || saleProductId)) {
      const locObj = locations.find(l => l.id === Number(saleLocationId));
      finalItems.push({
        product_id: saleProductId || null,
        product_name: saleProductName.trim() || selectedSaleProduct?.name || 'Product',
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
      notify('Please enter a Product, Quantity, and Rate (or click "+ Add Item to Bill" first).', true);
      return;
    }

    const directBillReceived =
      saleDocType === 'ESTIMATE'
        ? 0
        : salePaymentMode === 'UNPAID'
        ? 0
        : salePaymentMode === 'PAID'
        ? (saleIncludePrevDues ? computedSaleGrandPayable : computedSaleTotal)
        : pkr(saleReceived);

    const selAcc = accounts.find(a => a.id === Number(saleAccountId));
    saleSubmitLockRef.current = true;
    setSaleSubmitting(true);

    try {
      const data = await apiSend('/sales', 'POST', {
        idempotency_key: saleIdempotencyKeyRef.current,
        doc_type: saleDocType,
        customer_id: saleCustomerId || null,
        customer_name: saleCustomerName.trim() || activeSaleCustomer?.name || '',
        customer_city: saleCustomerCity.trim() || activeSaleCustomer?.city || 'Local',
        customer_phone: saleCustomerPhone.trim() || null,
        customer_cnic: saleCustomerCnic.trim() || null,
        customer_group_id: saleCustomerGroupId,
        customer_group: saleCustomerGroup.trim() || 'General Market',
        mark_favorite: saleMarkFav ? true : null,
        force_create_new_party: saleForceNewCustomer,
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

      // Rotate idempotency key ONLY after confirmed success
      saleIdempotencyKeyRef.current = `SALE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      notify(`${saleDocType} ${data.invoice_number} posted successfully!`);
      if (data.sale) {
        setSales(prev => (prev.some(x => x.id === data.sale.id) ? prev : [data.sale, ...prev]));
        setInvoiceModal({ kind: 'SALE', sale: data.sale });
      }
      setSaleDocType('SALE');
      setSaleCart([]);
      setSaleCustomerId(0);
      setSaleCustomerName('');
      setSaleCustomerCity('');
      setSaleCustomerPhone('');
      setSaleCustomerCnic('');
      setSaleMarkFav(false);
      setSaleForceNewCustomer(false);
      setSaleProdFav(false);
      setSaleQuantity('');
      setSaleRate('');
      setSaleDiscount('');
      setSaleFreight('');
      setSaleReceived('');
      setSalePaymentMode('UNPAID');
      setSaleRemarks('');
      await fetchData();
    } catch (err: any) {
      notify(err.message || 'Could not post Sale Invoice. Your entered items are preserved.', true);
    } finally {
      saleSubmitLockRef.current = false;
      setSaleSubmitting(false);
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
    if (purSubmitLockRef.current || purSubmitting) return;

    if (!purSupplierName.trim() && !purSupplierId) {
      notify('Please type a Supplier / Dealership name or pick a saved Supplier.', true);
      return;
    }

    const finalItems: CartLineItem[] = [...purCart];
    if (purQuantity && Number(purQuantity) > 0 && purRate !== '' && (purProductName.trim() || purProductId)) {
      const locObj = locations.find(l => l.id === Number(purLocationId));
      finalItems.push({
        product_id: purProductId || null,
        product_name: purProductName.trim() || selectedPurchaseProduct?.name || 'Product',
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
      notify('Please enter a Product, Quantity, and Buy Rate (or click "+ Add to Bill" first).', true);
      return;
    }

    const selAcc = accounts.find(a => a.id === Number(purAccountId));
    purSubmitLockRef.current = true;
    setPurSubmitting(true);

    try {
      const data = await apiSend('/purchases', 'POST', {
        idempotency_key: purIdempotencyKeyRef.current,
        doc_type: purDocType,
        supplier_id: purSupplierId || null,
        supplier_name: purSupplierName.trim() || activePurSupplier?.name || '',
        supplier_city: purSupplierCity.trim() || activePurSupplier?.city || 'Local',
        supplier_phone: purSupplierPhone.trim() || null,
        supplier_cnic: purSupplierCnic.trim() || null,
        supplier_group_id: purSupplierGroupId,
        supplier_group: purSupplierGroup.trim() || 'General Suppliers',
        mark_favorite: purMarkFav ? true : null,
        force_create_new_party: purForceNewSupplier,
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

      // Rotate idempotency key ONLY after confirmed success
      purIdempotencyKeyRef.current = `PUR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      notify(`Purchase Bill ${data.purchase_number} recorded!`);
      if (data.purchase) {
        setPurchases(prev => (prev.some(x => x.id === data.purchase.id) ? prev : [data.purchase, ...prev]));
        setInvoiceModal({ kind: 'PURCHASE', purchase: data.purchase });
      }
      setPurCart([]);
      setPurSupplierId(0);
      setPurSupplierName('');
      setPurSupplierCity('');
      setPurSupplierPhone('');
      setPurSupplierCnic('');
      setPurForceNewSupplier(false);
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
    } catch (err: any) {
      notify(err.message || 'Could not save Purchase Bill. Your entered items are preserved.', true);
    } finally {
      purSubmitLockRef.current = false;
      setPurSubmitting(false);
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

  const openCustomerAllocationModal = async (
    customerId: number,
    initialPaymentAmt?: number,
    preselectedSaleIds?: number[]
  ) => {
    try {
      setAllocationError('');
      setAllocationConfirming(false);
      const { res, data: ledger } = await resilientFetch(
        `${API_BASE}/customers/${customerId}/outstanding-ledger`,
        { method: 'GET' },
        2
      );
      if (!res.ok) throw new Error('Could not load customer outstanding ledger');
      setAllocationLedgerModal(ledger);
      const allBillIds = (ledger.outstanding_bills || []).map((b: any) => b.sale_id);
      const activeIds =
        preselectedSaleIds && preselectedSaleIds.length > 0 ? preselectedSaleIds : allBillIds;
      setAllocationSelectedSaleIds(activeIds);

      const targetBills = (ledger.outstanding_bills || []).filter((b: any) =>
        activeIds.includes(b.sale_id)
      );
      const selectedSum = targetBills.reduce((s: number, b: any) => s + pkr(b.remaining_balance), 0);
      const defaultPay =
        initialPaymentAmt !== undefined && initialPaymentAmt > 0
          ? pkr(initialPaymentAmt)
          : preselectedSaleIds && preselectedSaleIds.length > 0
          ? selectedSum
          : pkr(ledger.total_bills_outstanding);

      setAllocationPaymentInput(defaultPay > 0 ? String(defaultPay) : '');
      setAllocationPolicy('OLDEST_FIRST');
      setAllocationExcessAction('NONE');
      setAllocationRemarks('');
      setAllocationIdempotencyKey(`PAY-${customerId}-${Date.now()}`);

      const draft = computeDefaultDraftAllocations(targetBills, defaultPay, 'OLDEST_FIRST');
      const fullMap: Record<number, number> = {};
      for (const b of ledger.outstanding_bills || []) {
        fullMap[b.sale_id] = draft[b.sale_id] || 0;
      }
      setAllocationDraftMap(fullMap);
    } catch (err: any) {
      notify(err.message || 'Failed to load customer ledger', true);
    }
  };

  const toggleCustomerBillSelectionInModal = (saleId: number) => {
    if (!allocationLedgerModal) return;
    const nextIds = allocationSelectedSaleIds.includes(saleId)
      ? allocationSelectedSaleIds.filter(id => id !== saleId)
      : [...allocationSelectedSaleIds, saleId];
    setAllocationSelectedSaleIds(nextIds);
    const activeBills = allocationLedgerModal.outstanding_bills.filter(b =>
      nextIds.includes(b.sale_id)
    );
    const selectedTotal = activeBills.reduce((sum, b) => sum + pkr(b.remaining_balance), 0);
    setAllocationPaymentInput(selectedTotal > 0 ? String(selectedTotal) : '');
    const subDraft = computeDefaultDraftAllocations(activeBills, selectedTotal, allocationPolicy);
    const nextMap: Record<number, number> = {};
    for (const b of allocationLedgerModal.outstanding_bills) {
      nextMap[b.sale_id] = subDraft[b.sale_id] || 0;
    }
    setAllocationDraftMap(nextMap);
    setAllocationConfirming(false);
    setAllocationError('');
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

  // ==================== RESOLVE AUTHENTICATED CREATOR SIGNATURE ====================
  const resolveInvoiceAuthorizerSignature = (doc: any): { signatureText: string; fullName: string; roleLabel: string } => {
    const rawSaved = String(doc?.admin_name || '').trim();
    const cleanedSaved = rawSaved.replace(/\s*\(Super Admin\)\s*/gi, '').trim();
    const matchedAdmin = adminsList.find(
      a =>
        (doc?.admin_id && a.id === doc.admin_id) ||
        (cleanedSaved &&
          (a.full_name.toLowerCase() === cleanedSaved.toLowerCase() ||
            a.username.toLowerCase() === cleanedSaved.toLowerCase()))
    );

    if (matchedAdmin) {
      const cleanFull = matchedAdmin.full_name.replace(/\s*\(Super Admin\)\s*/gi, '').trim();
      const sig =
        matchedAdmin.username && matchedAdmin.username.toLowerCase() !== 'admin'
          ? matchedAdmin.username
          : cleanFull;
      return {
        signatureText: sig,
        fullName: cleanFull,
        roleLabel: `${matchedAdmin.username} • ${matchedAdmin.role}`
      };
    }

    if (cleanedSaved && cleanedSaved.toLowerCase() !== 'admin') {
      return {
        signatureText: cleanedSaved,
        fullName: cleanedSaved,
        roleLabel: currentAdmin?.username || 'Authorized Partner'
      };
    }

    const fallbackFull = (currentAdmin?.full_name || currentAdmin?.username || 'Malik Abuzar')
      .replace(/\s*\(Super Admin\)\s*/gi, '')
      .trim();
    const fallbackSig =
      currentAdmin?.username && currentAdmin.username.toLowerCase() !== 'admin'
        ? currentAdmin.username
        : fallbackFull;

    return {
      signatureText: fallbackSig,
      fullName: fallbackFull,
      roleLabel: `${currentAdmin?.username || fallbackSig} • ${currentAdmin?.role || 'SUPER_ADMIN'}`
    };
  };

  // ==================== NATIVE HIGH-RES INVOICE PNG & PDF/PRINT GENERATOR ====================
  const downloadOrShareInvoiceImage = async (mode: 'DOWNLOAD' | 'SHARE') => {
    if (!invoiceModal) return;
    const isSale = invoiceModal.kind === 'SALE';
    const doc = isSale ? invoiceModal.sale : invoiceModal.purchase;
    if (!doc) return;

    const items = (doc.items || []) as any[];
    const canvas = document.createElement('canvas');
    const width = 940;
    const rowHeight = 48;
    const height = Math.max(920, 620 + items.length * rowHeight);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Crisp White Paper Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Top ATH Brand Accent Bar (Petrol Teal #005B66 + Coral Orange #FF6B3D)
    ctx.fillStyle = '#005B66';
    ctx.fillRect(0, 0, width, 10);
    ctx.fillStyle = '#FF6B3D';
    ctx.fillRect(width * 0.62, 0, width * 0.38, 10);

    // 2. Bold "INVOICE" Heading & Awan Trade Hub / ATH Lubricants Identity
    ctx.fillStyle = '#00262B';
    ctx.font = '900 46px Inter, Arial, sans-serif';
    ctx.fillText('INVOICE', 48, 78);

    ctx.fillStyle = '#005B66';
    ctx.font = 'bold 15px Inter, Arial, sans-serif';
    ctx.fillText('ATH LUBRICANTS — AWAN TRADE HUB', 48, 106);
    ctx.fillStyle = '#475569';
    ctx.font = '12px Inter, Arial, sans-serif';
    ctx.fillText('Gold 4T Series • Smoother Ride | Better Protection | Longer Life', 48, 125);

    // Load /logo.png on Top Right if available
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = '/logo.png';
      });
      if (img.width > 0) {
        ctx.drawImage(img, width - 155, 32, 105, 76);
      }
    } catch {
      // Fallback if logo not loaded
    }

    const refNo = isSale ? (doc as SaleRecord).invoice_number : (doc as PurchaseRecord).purchase_number;
    const docType = (doc as any).doc_type || (isSale ? 'SALE' : 'PURCHASE');
    const partyName = isSale ? (doc as SaleRecord).customer_name : (doc as PurchaseRecord).supplier_name;
    const partyCity = isSale ? (doc as SaleRecord).customer_city : (doc as PurchaseRecord).supplier_city;
    const partyPhone = isSale ? (doc as SaleRecord).customer_phone : (doc as PurchaseRecord).supplier_phone;
    const partyCnic = isSale ? (doc as SaleRecord).customer_cnic : (doc as PurchaseRecord).supplier_cnic;
    const partyGroup = isSale ? (doc as SaleRecord).customer_group : (doc as PurchaseRecord).supplier_group;
    const locSummary = (doc as any).location_summary || (isSale ? 'Shop Display' : 'Main Warehouse');

    // 3. 3-Column Meta Section: BILL TO | DISPATCH LOCATION | INVOICE DETAILS
    const metaY = 165;
    ctx.fillStyle = '#00262B';
    ctx.font = 'bold 13px Inter, Arial, sans-serif';
    ctx.fillText(isSale ? 'BILL TO' : 'SUPPLIER / VENDOR', 48, metaY);
    ctx.fillText(isSale ? 'SHIP / DISPATCH FROM' : 'RECEIVING GODOWN', 330, metaY);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 16px Inter, Arial, sans-serif';
    ctx.fillText(partyName || ' Valued Partner', 48, metaY + 24);
    ctx.fillStyle = '#334155';
    ctx.font = '12px Inter, Arial, sans-serif';
    ctx.fillText(`City / Route: ${partyCity || 'Local'} (${partyGroup || 'General'})`, 48, metaY + 44);
    ctx.fillText(`Phone: ${partyPhone || 'N/A'}`, 48, metaY + 62);
    ctx.fillText(`CNIC: ${partyCnic || 'N/A'}`, 48, metaY + 80);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 14px Inter, Arial, sans-serif';
    ctx.fillText(locSummary, 330, metaY + 24);
    ctx.fillStyle = '#334155';
    ctx.font = '12px Inter, Arial, sans-serif';
    ctx.fillText(`Channel: ${doc.payment_method || 'CASH'}`, 330, metaY + 44);
    ctx.fillText(`Document: ${docType}`, 330, metaY + 62);
    ctx.fillText(`Remarks: ${doc.remarks || 'Standard Trade Bill'}`, 330, metaY + 80);

    // Right Column Meta Labels & Values
    const drawMetaRight = (lbl: string, val: string, rY: number, highlight = false) => {
      ctx.fillStyle = '#00262B';
      ctx.font = 'bold 12px Inter, Arial, sans-serif';
      ctx.fillText(lbl, 610, rY);
      ctx.textAlign = 'right';
      ctx.fillStyle = highlight ? '#FF6B3D' : '#0F172A';
      ctx.font = highlight ? 'bold 14px monospace' : 'bold 12px monospace';
      ctx.fillText(val, width - 48, rY);
      ctx.textAlign = 'left';
    };
    drawMetaRight('INVOICE #', refNo, metaY, true);
    drawMetaRight('INVOICE DATE', formatRecordDateTimePkt(doc.invoice_date), metaY + 24);
    drawMetaRight('PAYMENT STATUS', doc.payment_status, metaY + 48);
    drawMetaRight('CURRENCY', 'PKR (Whole Rupees)', metaY + 72);

    // 4. Star Divider & Coral-Orange Bordered Table Header
    let y = 272;
    ctx.fillStyle = '#005B66';
    ctx.font = '12px sans-serif';
    ctx.fillText('★  '.repeat(43).trim(), 48, y);

    y += 12;
    ctx.strokeStyle = '#FF6B3D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(width - 48, y);
    ctx.stroke();

    ctx.fillStyle = '#00262B';
    ctx.font = 'bold 12px Inter, Arial, sans-serif';
    ctx.fillText('QTY', 58, y + 24);
    ctx.fillText('DESCRIPTION & PACK SIZE', 165, y + 24);
    ctx.textAlign = 'right';
    ctx.fillText('UNIT PRICE (PKR)', 715, y + 24);
    ctx.fillText('AMOUNT (PKR)', width - 58, y + 24);
    ctx.textAlign = 'left';

    y += 36;
    ctx.strokeStyle = '#FF6B3D';
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(width - 48, y);
    ctx.stroke();

    // 5. Line Items Rows
    items.forEach((it, idx) => {
      if (idx % 2 === 1) {
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(48, y, width - 96, rowHeight);
      }
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`${it.quantity} ${it.unit_type}`, 58, y + 28);

      ctx.font = 'bold 13px Inter, Arial, sans-serif';
      ctx.fillText(`${it.product_name} (${it.pack_size || '700 ML'})`, 165, y + 21);
      ctx.fillStyle = '#475569';
      ctx.font = '11px Inter, Arial, sans-serif';
      ctx.fillText(
        `${it.company_name || 'ATH Oils'} • ${it.base_quantity} Btls (${it.cartons} Ctn + ${it.loose_bottles} Btl) • ${it.location_name || ''}`,
        165,
        y + 39
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0F172A';
      ctx.font = '13px monospace';
      ctx.fillText(pkr(it.unit_rate).toLocaleString(), 715, y + 28);
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`PKR ${pkr(it.line_total).toLocaleString()}`, width - 58, y + 28);
      ctx.textAlign = 'left';

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(48, y + rowHeight);
      ctx.lineTo(width - 48, y + rowHeight);
      ctx.stroke();
      y += rowHeight;
    });

    // 6. Totals & Khata Summary (Right-Aligned)
    y += 24;
    const sDoc = doc as SaleRecord;
    const pDoc = doc as PurchaseRecord;
    const curTotal = pkr(doc.total_amount);
    const prevDues = isSale ? pkr(sDoc.previous_dues) : pkr(pDoc.previous_dues);
    const grandPay = pkr(curTotal + prevDues);
    const appliedPrev = isSale ? pkr(sDoc.applied_to_previous) : pkr(pDoc.applied_to_previous);
    const rawPaid = isSale ? pkr(sDoc.received_amount) : pkr(pDoc.paid_amount);
    const billPortion = rawPaid > curTotal ? curTotal : rawPaid;
    const totalRecToday = pkr(billPortion + appliedPrev);
    const closeBal = isSale
      ? pkr(sDoc.closing_receivable ?? Math.max(0, grandPay - totalRecToday))
      : pkr(pDoc.closing_payable ?? Math.max(0, grandPay - totalRecToday));

    const drawTotalRow = (label: string, val: string, rY: number, color = '#0F172A', isBold = false, isLarge = false) => {
      ctx.textAlign = 'right';
      ctx.fillStyle = isBold ? '#00262B' : '#475569';
      ctx.font = isLarge ? '900 16px Inter, Arial, sans-serif' : isBold ? 'bold 13px Inter, Arial, sans-serif' : '13px Inter, Arial, sans-serif';
      ctx.fillText(label, 715, rY);
      ctx.fillStyle = color;
      ctx.font = isLarge ? '900 18px monospace' : isBold ? 'bold 14px monospace' : '13px monospace';
      ctx.fillText(val, width - 58, rY);
      ctx.textAlign = 'left';
    };

    drawTotalRow('Current Bill Total', `PKR ${curTotal.toLocaleString()}`, y, '#0F172A', true);
    drawTotalRow('+ Previous Khata Balance', `PKR ${prevDues.toLocaleString()}`, y + 26, '#D97706');
    drawTotalRow('= Total Payable Amount', `PKR ${grandPay.toLocaleString()}`, y + 52, '#00262B', true);
    drawTotalRow(`- ${isSale ? 'Received' : 'Paid'} Today (${doc.payment_method})`, `PKR ${totalRecToday.toLocaleString()}`, y + 78, '#059669', true);
    drawTotalRow(
      isSale ? 'NET CLOSING KHATA BALANCE' : 'NET CLOSING SUPPLIER PAYABLE',
      `PKR ${closeBal.toLocaleString()}`,
      y + 110,
      '#FF6B3D',
      true,
      true
    );

    // 7. ATH "Fractured Current" Flowing Stripes & Dynamic Droplets Across Lower Section (Petrol Teal #005B66 & Coral Orange #FF6B3D)
    const waveBaseY = y + 170;
    ctx.save();
    const drawFlowingStripe = (yOffset: number, color: string, lineW: number, dash: number[] = []) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.lineCap = 'round';
      ctx.setLineDash(dash);
      ctx.moveTo(30, waveBaseY + yOffset + 45);
      ctx.bezierCurveTo(
        width * 0.32,
        waveBaseY + yOffset - 55,
        width * 0.65,
        waveBaseY + yOffset - 35,
        width - 30,
        waveBaseY + yOffset + 25
      );
      ctx.stroke();
    };
    drawFlowingStripe(0, 'rgba(0, 91, 102, 0.16)', 22);
    drawFlowingStripe(18, 'rgba(255, 107, 61, 0.25)', 10);
    drawFlowingStripe(34, 'rgba(0, 91, 102, 0.22)', 6, [18, 14]);
    drawFlowingStripe(50, 'rgba(255, 107, 61, 0.18)', 14);
    ctx.setLineDash([]);

    // Dynamic ATH Oil Droplets along the Fractured Current
    const droplets = [
      { cx: 180, cy: waveBaseY + 12, r: 6, col: '#FF6B3D' },
      { cx: 310, cy: waveBaseY - 8, r: 4.5, col: '#005B66' },
      { cx: 460, cy: waveBaseY + 4, r: 7, col: '#FF6B3D' },
      { cx: 590, cy: waveBaseY - 6, r: 5, col: '#005B66' },
      { cx: 760, cy: waveBaseY + 15, r: 6, col: '#FF6B3D' }
    ];
    droplets.forEach(d => {
      ctx.beginPath();
      ctx.fillStyle = d.col;
      ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // 8. Authenticated User Signature (Handwritten Script Style)
    const sigInfo = resolveInvoiceAuthorizerSignature(doc);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00262B';
    ctx.font = 'italic bold 32px "Segoe Script", "Brush Script MT", "Lucida Handwriting", Georgia, cursive';
    ctx.fillText(sigInfo.signatureText, width - 195, waveBaseY - 4);

    ctx.strokeStyle = '#005B66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width - 315, waveBaseY + 10);
    ctx.lineTo(width - 75, waveBaseY + 10);
    ctx.stroke();

    ctx.fillStyle = '#005B66';
    ctx.font = 'bold 11px Inter, Arial, sans-serif';
    ctx.fillText(`AUTHORIZED SIGNATURE — ${sigInfo.fullName.toUpperCase()}`, width - 195, waveBaseY + 28);
    ctx.fillStyle = '#64748B';
    ctx.font = '10px monospace';
    ctx.fillText(`Verified By: ${sigInfo.roleLabel}`, width - 195, waveBaseY + 43);
    ctx.restore();

    // 9. Bottom Footer: Script "Thank you" | TERMS & CONDITIONS
    const footerY = height - 55;
    ctx.fillStyle = '#00262B';
    ctx.font = 'italic bold 36px Georgia, "Times New Roman", serif';
    ctx.fillText('Thank you', 160, footerY + 10);

    ctx.strokeStyle = '#005B66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(395, footerY - 26);
    ctx.lineTo(395, footerY + 24);
    ctx.stroke();

    ctx.fillStyle = '#FF6B3D';
    ctx.font = 'bold 12px Inter, Arial, sans-serif';
    ctx.fillText('TERMS & CONDITIONS', 415, footerY - 10);
    ctx.fillStyle = '#334155';
    ctx.font = '11px Inter, Arial, sans-serif';
    ctx.fillText('100% Whole-PKR Computerized Trade Bill • Smoother Ride | Better Protection | Longer Life', 415, footerY + 8);
    ctx.fillText('Please quote Invoice # on all payments to ATH Lubricants (Awan Trade Hub).', 415, footerY + 24);

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

  // ==================== PRINT / SAVE PDF FOR SINGLE INVOICE (WHITE ATH FRACTURED CURRENT THEME) ====================
  const printSingleInvoicePdf = (thermal = false) => {
    if (!invoiceModal) return;
    const isSale = invoiceModal.kind === 'SALE';
    const doc = isSale ? invoiceModal.sale : invoiceModal.purchase;
    if (!doc) return;

    const refNo = isSale ? (doc as SaleRecord).invoice_number : (doc as PurchaseRecord).purchase_number;
    const docType = (doc as any).doc_type || (isSale ? 'SALE' : 'PURCHASE');
    const partyName = isSale ? (doc as SaleRecord).customer_name : (doc as PurchaseRecord).supplier_name;
    const partyCity = isSale ? (doc as SaleRecord).customer_city : (doc as PurchaseRecord).supplier_city;
    const partyPhone = isSale ? (doc as SaleRecord).customer_phone : (doc as PurchaseRecord).supplier_phone;
    const partyCnic = isSale ? (doc as SaleRecord).customer_cnic : (doc as PurchaseRecord).supplier_cnic;
    const partyGroup = isSale ? (doc as SaleRecord).customer_group : (doc as PurchaseRecord).supplier_group;
    const locSummary = (doc as any).location_summary || (isSale ? 'Shop Display' : 'Main Warehouse');
    const items = (doc.items || []) as any[];
    const sigInfo = resolveInvoiceAuthorizerSignature(doc);

    const win = window.open('', '_blank', 'width=940,height=820');
    if (!win) return;

    const rowsHtml = items
      .map(
        (it, idx) => `
        <tr style="background:${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
          <td style="font-family:monospace;font-weight:bold;">${it.quantity} ${it.unit_type}</td>
          <td>
            <div style="font-weight:800;color:#00262B;">${idx + 1}. ${it.product_name} (${it.pack_size || '700 ML'})</div>
            <div style="font-size:11px;color:#475569;">${it.company_name || 'ATH Oils'} • ${it.base_quantity} Btls (${it.cartons} Ctn + ${it.loose_bottles} Btl) • ${it.location_name || ''}</div>
          </td>
          <td style="text-align:right;font-family:monospace;">PKR ${pkr(it.unit_rate).toLocaleString()}</td>
          <td style="text-align:right;font-family:monospace;font-weight:800;color:#00262B;">PKR ${pkr(it.line_total).toLocaleString()}</td>
        </tr>`
      )
      .join('');

    const sDoc = doc as SaleRecord;
    const pDoc = doc as PurchaseRecord;
    const curTotal = pkr(doc.total_amount);
    const prevDues = isSale ? pkr(sDoc.previous_dues) : pkr(pDoc.previous_dues);
    const grandPay = pkr(curTotal + prevDues);
    const appliedPrev = isSale ? pkr(sDoc.applied_to_previous) : pkr(pDoc.applied_to_previous);
    const rawPaid = isSale ? pkr(sDoc.received_amount) : pkr(pDoc.paid_amount);
    const billPortion = rawPaid > curTotal ? curTotal : rawPaid;
    const recToday = pkr(billPortion + appliedPrev);
    const closingBal = isSale
      ? pkr(sDoc.closing_receivable ?? Math.max(0, grandPay - recToday))
      : pkr(pDoc.closing_payable ?? Math.max(0, grandPay - recToday));

    win.document.write(`
      <html>
        <head>
          <title>Invoice ${refNo} - ATH Lubricants</title>
          <style>
            @page { margin: ${thermal ? '4mm' : '12mm'}; }
            body { font-family: 'Inter', Arial, sans-serif; background: #FFFFFF; color: #0F172A; margin: 0; padding: ${thermal ? '8px' : '28px'}; max-width: ${thermal ? '300px' : '860px'}; margin-inline: auto; }
            .top-bar { height: 8px; background: linear-gradient(90deg, #005B66 62%, #FF6B3D 38%); margin-bottom: 20px; border-radius: 4px; }
            .hdr { display: flex; justify-content: space-between; align-items: flex-start; }
            .inv-title { font-size: ${thermal ? '26px' : '44px'}; font-weight: 900; color: #00262B; letter-spacing: -1px; margin: 0; line-height: 1; }
            .meta-grid { display: grid; grid-template-columns: ${thermal ? '1fr' : '1.2fr 1fr 1.1fr'}; gap: 16px; margin-top: 22px; font-size: 12px; }
            .meta-head { font-weight: 800; color: #00262B; text-transform: uppercase; margin-bottom: 4px; font-size: 12px; }
            .stars { color: #005B66; font-size: 11px; letter-spacing: 3px; overflow: hidden; white-space: nowrap; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: ${thermal ? '11px' : '13px'}; }
            thead th { border-top: 2px solid #FF6B3D; border-bottom: 2px solid #FF6B3D; padding: 10px 8px; text-align: left; color: #00262B; font-weight: 800; text-transform: uppercase; font-size: 12px; }
            tbody td { border-bottom: 1px solid #E2E8F0; padding: 10px 8px; vertical-align: top; }
            .sum-wrap { display: flex; justify-content: flex-end; margin-top: 18px; }
            .sum-table { width: ${thermal ? '100%' : '380px'}; font-size: 13px; }
            .sum-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .sum-row.total { font-weight: 900; font-size: 16px; color: #FF6B3D; border-top: 2px solid #00262B; padding-top: 8px; margin-top: 4px; }
            .wave-sig-wrap { position: relative; margin-top: 28px; padding-top: 10px; min-height: 120px; }
            .sig-box { position: relative; z-index: 2; margin-left: auto; width: 260px; text-align: center; }
            .sig-script { font-family: 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', Georgia, cursive; font-size: 28px; font-weight: bold; font-style: italic; color: #00262B; line-height: 1.1; }
            .sig-line { border-top: 1.5px solid #005B66; margin-top: 4px; padding-top: 4px; font-size: 11px; font-weight: 800; color: #005B66; text-transform: uppercase; }
            .ftr { display: flex; align-items: center; gap: 20px; margin-top: 22px; padding-top: 14px; border-top: 1px solid #E2E8F0; }
            .thank-you { font-family: Georgia, serif; font-size: 32px; font-weight: bold; font-style: italic; color: #00262B; padding-right: 18px; border-right: 2px solid #005B66; }
          </style>
        </head>
        <body>
          <div class="top-bar"></div>
          <div class="hdr">
            <div>
              <h1 class="inv-title">INVOICE</h1>
              <div style="font-weight:800;color:#005B66;margin-top:6px;font-size:14px;">ATH LUBRICANTS — AWAN TRADE HUB</div>
              <div style="font-size:11px;color:#475569;">Gold 4T Series • Smoother Ride | Better Protection | Longer Life</div>
            </div>
            <img src="${window.location.origin}/logo.png" onerror="this.style.display='none'" style="height:64px;object-fit:contain;" />
          </div>

          <div class="meta-grid">
            <div>
              <div class="meta-head">${isSale ? 'BILL TO' : 'SUPPLIER / VENDOR'}</div>
              <div style="font-weight:800;font-size:15px;color:#0F172A;">${partyName}</div>
              <div>City / Route: <strong>${partyCity || 'Local'}</strong> (${partyGroup || 'General'})</div>
              <div>Phone: ${partyPhone || 'N/A'}</div>
              <div>CNIC: ${partyCnic || 'N/A'}</div>
            </div>
            <div>
              <div class="meta-head">${isSale ? 'SHIP / DISPATCH FROM' : 'RECEIVING GODOWN'}</div>
              <div style="font-weight:800;font-size:14px;color:#0F172A;">${locSummary}</div>
              <div>Payment Channel: <strong>${doc.payment_method}</strong></div>
              <div>Document Type: <strong>${docType}</strong></div>
              <div>Remarks: ${doc.remarks || 'Standard Trade Bill'}</div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><strong style="color:#00262B;">INVOICE #</strong><span style="font-family:monospace;font-weight:800;color:#FF6B3D;">${refNo}</span></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><strong style="color:#00262B;">INVOICE DATE</strong><span style="font-family:monospace;">${formatRecordDateTimePkt(doc.invoice_date)}</span></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><strong style="color:#00262B;">STATUS</strong><span style="font-weight:800;color:#059669;">${doc.payment_status}</span></div>
            </div>
          </div>

          <div class="stars">★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★ ★</div>
          <table>
            <thead>
              <tr>
                <th>QTY</th>
                <th>DESCRIPTION & PACK SIZE</th>
                <th style="text-align:right">UNIT PRICE</th>
                <th style="text-align:right">AMOUNT</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div class="sum-wrap">
            <div class="sum-table">
              <div class="sum-row"><span>Current Bill Total:</span><strong style="font-family:monospace;">PKR ${curTotal.toLocaleString()}</strong></div>
              <div class="sum-row" style="color:#D97706;"><span>+ Previous Balance (Old Khata):</span><strong style="font-family:monospace;">PKR ${prevDues.toLocaleString()}</strong></div>
              <div class="sum-row" style="font-weight:800;border-top:1px solid #CBD5E1;padding-top:4px;"><span>= Total Payable Amount:</span><span style="font-family:monospace;">PKR ${grandPay.toLocaleString()}</span></div>
              <div class="sum-row" style="color:#059669;font-weight:800;"><span>- ${isSale ? 'Received' : 'Paid'} Today (${doc.payment_method}):</span><span style="font-family:monospace;">PKR ${recToday.toLocaleString()}</span></div>
              <div class="sum-row total"><span>${isSale ? 'Net Closing Khata:' : 'Net Closing Payable:'}</span><span style="font-family:monospace;">PKR ${closingBal.toLocaleString()}</span></div>
            </div>
          </div>

          <div class="wave-sig-wrap">
            <svg viewBox="0 0 800 120" style="position:absolute;inset:0;width:100%;height:120px;z-index:1;pointer-events:none;" preserveAspectRatio="none">
              <path d="M 10 95 C 240 15, 520 20, 790 75" stroke="#005B66" stroke-opacity="0.16" stroke-width="18" fill="none" stroke-linecap="round" />
              <path d="M 10 108 C 260 32, 540 35, 790 88" stroke="#FF6B3D" stroke-opacity="0.28" stroke-width="8" fill="none" stroke-linecap="round" />
              <path d="M 30 116 C 280 48, 550 48, 790 102" stroke="#005B66" stroke-opacity="0.24" stroke-width="5" stroke-dasharray="14 12" fill="none" stroke-linecap="round" />
              <circle cx="180" cy="65" r="5" fill="#FF6B3D" />
              <circle cx="320" cy="46" r="4" fill="#005B66" />
              <circle cx="450" cy="52" r="6" fill="#FF6B3D" />
            </svg>
            <div class="sig-box">
              <div class="sig-script">${sigInfo.signatureText}</div>
              <div class="sig-line">Authorized Signature • ${sigInfo.fullName}</div>
              <div style="font-size:10px;color:#64748B;font-family:monospace;">Verified By: ${sigInfo.roleLabel}</div>
            </div>
          </div>

          <div class="ftr">
            <div class="thank-you">Thank you</div>
            <div>
              <div style="font-weight:800;color:#FF6B3D;font-size:12px;text-transform:uppercase;">TERMS & CONDITIONS</div>
              <div style="font-size:11px;color:#334155;margin-top:2px;">100% Whole-PKR Audited Trade Bill • Smoother Ride | Better Protection | Longer Life</div>
              <div style="font-size:11px;color:#334155;">Please quote Invoice # ${refNo} on all settlements to ATH Lubricants (Awan Trade Hub).</div>
            </div>
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

  const pendingSales = useMemo(() => {
    const source = allSales.length > 0 ? allSales : (allPendingSales.length > 0 ? allPendingSales : sales);
    return source.filter(s => pkr(s.receivable_amount) > 0 && (s.doc_type || 'SALE') !== 'ESTIMATE');
  }, [allSales, allPendingSales, sales]);

  const pendingPurchases = useMemo(() => {
    const source = allPurchases.length > 0 ? allPurchases : (allPendingPurchases.length > 0 ? allPendingPurchases : purchases);
    return source.filter(p => pkr(p.payable_amount) > 0);
  }, [allPurchases, allPendingPurchases, purchases]);

  // ==================== MULTI-FACTOR IDENTITY MATCHING & CONSOLIDATED KHATA ENGINE ====================
  // Detect possible existing Customer matches when typing a name in the Sale form without auto-merging
  const possibleSaleCustomerMatches = useMemo(() => {
    if (saleCustomerId > 0 || saleForceNewCustomer) return [];
    const typedName = normalizeIdentityText(saleCustomerName);
    const typedCnic = normalizeCnic(saleCustomerCnic);
    const typedPhone = normalizePhone(saleCustomerPhone);
    if (!typedName && !typedCnic && !typedPhone) return [];

    return customers.filter(c => {
      const cCnic = normalizeCnic(c.cnic);
      const cPhone = normalizePhone(c.phone);
      const cName = normalizeIdentityText(c.name);
      if (typedCnic && cCnic && typedCnic === cCnic) return true;
      if (typedPhone && cPhone && typedPhone.length >= 10 && typedPhone === cPhone) return true;
      if (typedName.length >= 3 && (cName === typedName || cName.includes(typedName) || typedName.includes(cName))) {
        return true;
      }
      return false;
    });
  }, [customers, saleCustomerId, saleCustomerName, saleCustomerCnic, saleCustomerPhone, saleForceNewCustomer]);

  // Detect possible existing Supplier matches when typing a name in the Purchase form without auto-merging
  const possiblePurSupplierMatches = useMemo(() => {
    if (purSupplierId > 0 || purForceNewSupplier) return [];
    const typedName = normalizeIdentityText(purSupplierName);
    const typedCnic = normalizeCnic(purSupplierCnic);
    const typedPhone = normalizePhone(purSupplierPhone);
    if (!typedName && !typedCnic && !typedPhone) return [];

    return suppliers.filter(s => {
      const sCnic = normalizeCnic(s.cnic);
      const sPhone = normalizePhone(s.phone);
      const sName = normalizeIdentityText(s.name);
      if (typedCnic && sCnic && typedCnic === sCnic) return true;
      if (typedPhone && sPhone && typedPhone.length >= 10 && typedPhone === sPhone) return true;
      if (typedName.length >= 3 && (sName === typedName || sName.includes(typedName) || typedName.includes(sName))) {
        return true;
      }
      return false;
    });
  }, [suppliers, purSupplierId, purSupplierName, purSupplierCnic, purSupplierPhone, purForceNewSupplier]);

  // Consolidate multiple unpaid Sale bills by unique verified Customer identity
  const consolidatedCustomerDues = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        groupKey: string;
        customer_id: number;
        customer_name: string;
        customer_code: string;
        city: string;
        phone: string;
        cnic: string;
        group_name: string;
        total_original: number;
        total_paid: number;
        total_remaining: number;
        bills: SaleRecord[];
      }
    >();

    for (const s of pendingSales) {
      const custObj = customers.find(c => c.id === s.customer_id);
      const cnicNorm = normalizeCnic(custObj?.cnic || s.customer_cnic);
      const phoneNorm = normalizePhone(custObj?.phone || s.customer_phone);
      const nameNorm = normalizeIdentityText(custObj?.name || s.customer_name);
      const cityNorm = normalizeIdentityText(custObj?.city || s.customer_city || 'local');
      const grpNorm = normalizeIdentityText(custObj?.group_name || s.customer_group || 'general market');

      // Multi-factor key: never merge two records by name alone if ID, CNIC, Phone, or City differ
      let identityKey = `CUS-ID-${s.customer_id}`;
      if (cnicNorm.length >= 13) {
        identityKey = `CUS-CNIC-${cnicNorm}`;
      } else if (!s.customer_id && phoneNorm.length >= 10) {
        identityKey = `CUS-PH-${nameNorm}-${phoneNorm}-${cityNorm}`;
      } else if (!s.customer_id) {
        identityKey = `CUS-COMPOSITE-${nameNorm}-${cityNorm}-${grpNorm}`;
      }

      const existing = groupsMap.get(identityKey);
      const orig = pkr(s.total_amount);
      const paid = pkr(s.received_amount);
      const rem = pkr(s.receivable_amount);

      if (existing) {
        existing.total_original = pkr(existing.total_original + orig);
        existing.total_paid = pkr(existing.total_paid + paid);
        existing.total_remaining = pkr(existing.total_remaining + rem);
        existing.bills.push(s);
      } else {
        groupsMap.set(identityKey, {
          groupKey: identityKey,
          customer_id: s.customer_id,
          customer_name: custObj?.name || s.customer_name || 'Customer',
          customer_code: custObj?.code || `CUS-${s.customer_id}`,
          city: custObj?.city || s.customer_city || 'Local',
          phone: custObj?.phone || s.customer_phone || '',
          cnic: custObj?.cnic || s.customer_cnic || '',
          group_name: custObj?.group_name || s.customer_group || 'General Market',
          total_original: orig,
          total_paid: paid,
          total_remaining: rem,
          bills: [s]
        });
      }
    }

    const list = Array.from(groupsMap.values());
    for (const grp of list) {
      grp.bills.sort((a, b) => a.id - b.id);
    }
    return list.sort((a, b) => b.total_remaining - a.total_remaining);
  }, [pendingSales, customers]);

  // Consolidate multiple unpaid Purchase bills by unique verified Supplier identity
  const consolidatedSupplierDues = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        groupKey: string;
        supplier_id: number;
        supplier_name: string;
        supplier_code: string;
        city: string;
        phone: string;
        cnic: string;
        group_name: string;
        total_original: number;
        total_paid: number;
        total_remaining: number;
        bills: PurchaseRecord[];
      }
    >();

    for (const p of pendingPurchases) {
      const supObj = suppliers.find(s => s.id === p.supplier_id);
      const cnicNorm = normalizeCnic(supObj?.cnic || p.supplier_cnic);
      const phoneNorm = normalizePhone(supObj?.phone || p.supplier_phone);
      const nameNorm = normalizeIdentityText(supObj?.name || p.supplier_name);
      const cityNorm = normalizeIdentityText(supObj?.city || p.supplier_city || 'local');
      const grpNorm = normalizeIdentityText(supObj?.group_name || p.supplier_group || 'general suppliers');

      let identityKey = `SUP-ID-${p.supplier_id}`;
      if (cnicNorm.length >= 13) {
        identityKey = `SUP-CNIC-${cnicNorm}`;
      } else if (!p.supplier_id && phoneNorm.length >= 10) {
        identityKey = `SUP-PH-${nameNorm}-${phoneNorm}-${cityNorm}`;
      } else if (!p.supplier_id) {
        identityKey = `SUP-COMPOSITE-${nameNorm}-${cityNorm}-${grpNorm}`;
      }

      const existing = groupsMap.get(identityKey);
      const orig = pkr(p.total_amount);
      const paid = pkr(p.paid_amount);
      const rem = pkr(p.payable_amount);

      if (existing) {
        existing.total_original = pkr(existing.total_original + orig);
        existing.total_paid = pkr(existing.total_paid + paid);
        existing.total_remaining = pkr(existing.total_remaining + rem);
        existing.bills.push(p);
      } else {
        groupsMap.set(identityKey, {
          groupKey: identityKey,
          supplier_id: p.supplier_id,
          supplier_name: supObj?.name || p.supplier_name || 'Supplier',
          supplier_code: supObj?.code || `SUP-${p.supplier_id}`,
          city: supObj?.city || p.supplier_city || 'Local',
          phone: supObj?.phone || p.supplier_phone || '',
          cnic: supObj?.cnic || p.supplier_cnic || '',
          group_name: supObj?.group_name || p.supplier_group || 'General Suppliers',
          total_original: orig,
          total_paid: paid,
          total_remaining: rem,
          bills: [p]
        });
      }
    }

    const list = Array.from(groupsMap.values());
    for (const grp of list) {
      grp.bills.sort((a, b) => a.id - b.id);
    }
    return list.sort((a, b) => b.total_remaining - a.total_remaining);
  }, [pendingPurchases, suppliers]);

  // Expand/collapse state for consolidated Customer & Supplier cards in Khata Dues
  const [collapsedKhataKeys, setCollapsedKhataKeys] = useState<Record<string, boolean>>({});
  const toggleKhataCardExpand = (key: string) => {
    setCollapsedKhataKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Consolidated Supplier Multi-Bill Payment Allocation Modal State
  const [supplierAllocationModal, setSupplierAllocationModal] = useState<{
    supplier_id: number;
    supplier_name: string;
    supplier_code: string;
    city: string;
    phone: string;
    cnic: string;
    group_name: string;
    total_outstanding: number;
    bills: PurchaseRecord[];
  } | null>(null);
  const [supAllocPaymentInput, setSupAllocPaymentInput] = useState<string>('');
  const [supAllocPolicy, setSupAllocPolicy] = useState<'OLDEST_FIRST' | 'NEWEST_FIRST'>('OLDEST_FIRST');
  const [supAllocSelectedMap, setSupAllocSelectedMap] = useState<Record<number, boolean>>({});
  const [supAllocDraftMap, setSupAllocDraftMap] = useState<Record<number, number>>({});
  const [supAllocAccountId, setSupAllocAccountId] = useState<number>(1);
  const [supAllocArrangement, setSupAllocArrangement] = useState<PaymentArrangementType>('WALLET');
  const [supAllocLenderName, setSupAllocLenderName] = useState<string>('');
  const [supAllocRemarks, setSupAllocRemarks] = useState<string>('');
  const [supAllocConfirming, setSupAllocConfirming] = useState<boolean>(false);
  const [supAllocBusy, setSupAllocBusy] = useState<boolean>(false);
  const [supAllocError, setSupAllocError] = useState<string>('');

  const computeSupplierDraftAllocations = (
    bills: PurchaseRecord[],
    selectedMap: Record<number, boolean>,
    paymentAmt: number,
    policy: 'OLDEST_FIRST' | 'NEWEST_FIRST'
  ): Record<number, number> => {
    const ordered = [...bills].sort((a, b) => (policy === 'NEWEST_FIRST' ? b.id - a.id : a.id - b.id));
    let rem = pkr(paymentAmt);
    const map: Record<number, number> = {};
    for (const b of bills) map[b.id] = 0;
    for (const b of ordered) {
      if (rem <= 0) break;
      if (selectedMap[b.id] === false) continue;
      const alloc = pkr(Math.min(pkr(b.payable_amount), rem));
      map[b.id] = alloc;
      rem = pkr(rem - alloc);
    }
    return map;
  };

  const openSupplierAllocationModal = (
    grp: (typeof consolidatedSupplierDues)[number],
    focusPurchaseId?: number
  ) => {
    setSupAllocError('');
    setSupAllocConfirming(false);
    const selMap: Record<number, boolean> = {};
    let defaultPay = 0;
    for (const b of grp.bills) {
      const isSelected = focusPurchaseId ? b.id === focusPurchaseId : true;
      selMap[b.id] = isSelected;
      if (isSelected) defaultPay = pkr(defaultPay + pkr(b.payable_amount));
    }
    setSupplierAllocationModal({
      supplier_id: grp.supplier_id,
      supplier_name: grp.supplier_name,
      supplier_code: grp.supplier_code,
      city: grp.city,
      phone: grp.phone,
      cnic: grp.cnic,
      group_name: grp.group_name,
      total_outstanding: grp.total_remaining,
      bills: grp.bills
    });
    setSupAllocSelectedMap(selMap);
    setSupAllocPaymentInput(defaultPay > 0 ? String(defaultPay) : '');
    setSupAllocPolicy('OLDEST_FIRST');
    setSupAllocArrangement('WALLET');
    setSupAllocLenderName('');
    setSupAllocRemarks('');
    setSupAllocDraftMap(computeSupplierDraftAllocations(grp.bills, selMap, defaultPay, 'OLDEST_FIRST'));
  };

  const handleSupAllocInputChange = (
    rawAmt: string,
    nextPolicy: 'OLDEST_FIRST' | 'NEWEST_FIRST',
    nextSelMap = supAllocSelectedMap
  ) => {
    setSupAllocPaymentInput(rawAmt);
    setSupAllocPolicy(nextPolicy);
    setSupAllocConfirming(false);
    setSupAllocError('');
    if (!supplierAllocationModal) return;
    setSupAllocDraftMap(
      computeSupplierDraftAllocations(supplierAllocationModal.bills, nextSelMap, pkr(rawAmt), nextPolicy)
    );
  };

  const handleToggleSupBillSelection = (purchaseId: number) => {
    if (!supplierAllocationModal) return;
    const nextSel = { ...supAllocSelectedMap, [purchaseId]: supAllocSelectedMap[purchaseId] === false };
    setSupAllocSelectedMap(nextSel);
    const selectedSum = supplierAllocationModal.bills.reduce(
      (sum, b) => sum + (nextSel[b.id] !== false ? pkr(b.payable_amount) : 0),
      0
    );
    setSupAllocPaymentInput(selectedSum > 0 ? String(selectedSum) : '');
    setSupAllocDraftMap(
      computeSupplierDraftAllocations(supplierAllocationModal.bills, nextSel, selectedSum, supAllocPolicy)
    );
    setSupAllocConfirming(false);
    setSupAllocError('');
  };

  const handleExecuteSupplierConsolidatedPayment = async () => {
    if (!supplierAllocationModal || supAllocBusy) return;
    setSupAllocError('');
    const entries = Object.entries(supAllocDraftMap)
      .map(([pid, amt]) => ({ purchase_id: Number(pid), amount: pkr(amt) }))
      .filter(x => x.amount > 0);

    if (entries.length === 0) {
      setSupAllocError('Please allocate a payment amount to at least one supplier bill.');
      return;
    }

    const selAcc = accounts.find(a => a.id === Number(supAllocAccountId));
    setSupAllocBusy(true);
    try {
      for (const item of entries) {
        await apiSend(`/purchases/${item.purchase_id}/payment`, 'POST', {
          amount: item.amount,
          account_id: Number(supAllocAccountId) || null,
          payment_method: selAcc ? selAcc.type : 'CASH',
          payment_arrangement: supAllocArrangement,
          lender_name: supAllocLenderName.trim() || null,
          remarks:
            supAllocRemarks.trim() ||
            `Consolidated Supplier Settlement (${entries.length} bill${entries.length > 1 ? 's' : ''})`
        });
      }
      const totalSettled = entries.reduce((s, x) => s + x.amount, 0);
      notify(
        `Settled PKR ${totalSettled.toLocaleString()} across ${entries.length} bill(s) for ${supplierAllocationModal.supplier_name}!`
      );
      setSupplierAllocationModal(null);
      setSupAllocConfirming(false);
      await fetchData();
    } catch (err: any) {
      setSupAllocError(err.message || 'Supplier payment settlement failed.');
    } finally {
      setSupAllocBusy(false);
    }
  };

  const headerMenuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen]);

  // ==================== LOGIN SCREEN (OFFICIAL AWAN TRADE HUB — COMMERCIAL ERP PORTAL) ====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative bg-[#00191D]">
        <OilDropletsBackdrop />
        <div className="max-w-md w-full glass-panel rounded-xl overflow-hidden shadow-2xl animate-fade-in relative z-10 border border-[#F7F7F5]/20">
          {/* Top Brand Stripe */}
          <div className="h-1.5 w-full flex">
            <div className="w-2/3 bg-[#005B66]" />
            <div className="w-1/3 bg-[#FF6B3D]" />
          </div>

          <div className="bg-[#002227] border-b border-[#F7F7F5]/12 p-6 flex flex-col items-center text-center gap-3">
            <div className="bg-[#F7F7F5] px-5 py-2.5 rounded-lg shadow-sm border border-white">
              <img
                src="/logo.png"
                alt="ATH Lubricants Logo"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                className="h-12 w-auto object-contain"
              />
            </div>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#FF6B3D]">
                Awan Trade Hub • Enterprise ERP & Khata Suite
              </div>
              <p className="text-xs text-[#F7F7F5]/80 mt-0.5 font-medium">
                Smoother Ride &nbsp;|&nbsp; Better Protection &nbsp;|&nbsp; Longer Life
              </p>
            </div>

            {/* Mode Switcher: Partner Sign In vs Admin Registration */}
            <div className="grid grid-cols-2 gap-1.5 w-full mt-1 bg-[#00171A] p-1 rounded-lg border border-[#F7F7F5]/15">
              <button
                type="button"
                onClick={() => { setAuthTab('LOGIN'); setLoginError(''); }}
                className={`py-2 rounded-md text-xs font-bold uppercase tracking-wider transition ${
                  authTab === 'LOGIN' ? 'bg-[#FF6B3D] text-white shadow-sm' : 'text-[#F7F7F5]/75 hover:text-white'
                }`}
              >
                Partner Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('SIGNUP'); setLoginError(''); setSignupSuccessMsg(''); }}
                className={`py-2 rounded-md text-xs font-bold uppercase tracking-wider transition ${
                  authTab === 'SIGNUP' ? 'bg-[#005B66] text-white shadow-sm' : 'text-[#F7F7F5]/75 hover:text-white'
                }`}
              >
                Admin Registration
              </button>
            </div>
          </div>

          {authTab === 'LOGIN' ? (
            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-[#F7F7F5]/10 pb-3">
                <div>
                  <h1 className="text-base font-extrabold text-[#F7F7F5] tracking-tight uppercase">
                    Sign In to <span className="text-[#FF6B3D]">ATH Portal</span>
                  </h1>
                  <p className="text-[11px] text-[#F7F7F5]/70">
                    15-minute inactivity protection • Enter registered credentials
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-md">
                  <Lock className="w-3 h-3" /> Encrypted
                </span>
              </div>

              {signupSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-950/90 border border-emerald-400 text-xs text-emerald-200 font-semibold">
                  {signupSuccessMsg}
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-[#F7F7F5] block mb-1">
                    Email Address or Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    required
                    placeholder="Enter your email address or username"
                    value={loginUser}
                    onChange={e => setLoginUser(e.target.value)}
                    className="erp-input"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#F7F7F5] block mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    required
                    placeholder="Enter your password"
                    value={loginPass}
                    onChange={e => setLoginPass(e.target.value)}
                    className="erp-input"
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-lg bg-rose-950/90 border border-rose-500 text-xs text-white font-semibold">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="w-full btn-primary py-3 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {authBusy ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Authenticating Session...
                  </>
                ) : (
                  'Sign In to Executive Portal'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminSignup} className="p-6 space-y-4">
              <div className="border-b border-[#F7F7F5]/10 pb-2.5">
                <h2 className="text-sm font-extrabold text-[#F7F7F5] uppercase">
                  New Partner / Admin Registration
                </h2>
                <p className="text-[11px] text-[#F7F7F5]/75 mt-0.5">
                  Register with your official email. Accounts require authorization from the{' '}
                  <strong className="text-[#FF6B3D]">System Administrator</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-[#F7F7F5] block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={signupFullName}
                    onChange={e => setSignupFullName(e.target.value)}
                    className="erp-input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-[#FF6B3D] block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    className="erp-input"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#F7F7F5] block mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="Choose username"
                    value={signupUsername}
                    onChange={e => setSignupUsername(e.target.value)}
                    className="erp-input"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#F7F7F5] block mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    className="erp-input"
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-lg bg-rose-950/90 border border-rose-500 text-xs text-white font-semibold">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="w-full btn-oil py-3 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {authBusy ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Submitting Request...
                  </>
                ) : (
                  'Submit Registration for Approval'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const mainMenuItems: { id: MainSection; label: string; badge?: string | number; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    {
      id: 'accounts',
      label: 'Sales, Purchases & Accounts',
      badge: consolidatedCustomerDues.length + consolidatedSupplierDues.length || undefined,
      icon: <ShoppingCart className="w-3.5 h-3.5" />
    },
    {
      id: 'inventory',
      label: 'Godowns & Stock',
      badge: products.length,
      icon: <Package className="w-3.5 h-3.5" />
    },
    {
      id: 'directory',
      label: 'Parties & Khata',
      badge: customers.length,
      icon: <Users className="w-3.5 h-3.5" />
    },
    {
      id: 'reports',
      label: 'Reports & Backup',
      icon: <FileText className="w-3.5 h-3.5" />
    }
  ];

  const lowStockProducts = useMemo(
    () => products.filter(p => p.is_low_stock || p.current_stock_bottles <= p.reorder_level),
    [products]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#001D21] text-[#F7F7F5] pb-12 relative">
      <OilDropletsBackdrop />

      {/* ==================== SINGLE UNIFIED ENTERPRISE TOP NAVIGATION HEADER ==================== */}
      <header
        ref={headerMenuRef}
        className="bg-[#00181C]/95 backdrop-blur-md border-b border-[#F7F7F5]/15 sticky top-0 z-40 no-print shadow-lg"
      >
        {/* Primary Top Bar */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          {/* Left: Brand Logo + Back/Forward History Controls */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => navigateTo({ main: 'dashboard' })}
              className="flex items-center gap-2.5 text-left group focus:outline-none shrink-0"
            >
              <div className="bg-[#F7F7F5] px-2.5 py-1 rounded-md border border-white shadow-sm group-hover:border-[#FF6B3D] transition">
                <img
                  src="/logo.png"
                  alt="ATH Logo"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  className="h-7 sm:h-8 w-auto object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-black tracking-tight text-[#F7F7F5] leading-none">
                  ATH <span className="text-[#FF6B3D]">LUBRICANTS</span>
                </div>
                <div className="text-[10px] text-[#F7F7F5]/70 font-medium tracking-wide uppercase mt-0.5 truncate">
                  Awan Trade Hub ERP
                </div>
              </div>
            </button>

            <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-[#F7F7F5]/15">
              <button
                type="button"
                disabled={!canGoBack}
                onClick={handleBack}
                className="p-1.5 rounded-md bg-[#00282E] border border-[#F7F7F5]/15 text-white hover:border-[#FF6B3D] disabled:opacity-30 transition"
                title="Navigate Back"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!canGoForward}
                onClick={handleForward}
                className="p-1.5 rounded-md bg-[#00282E] border border-[#F7F7F5]/15 text-white hover:border-[#FF6B3D] disabled:opacity-30 transition"
                title="Navigate Forward"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Center: Single Authoritative Desktop Top-Menu Navigation */}
          <nav
            className="hidden lg:flex items-center gap-1 bg-[#00242A] p-1 rounded-lg border border-[#F7F7F5]/15"
            aria-label="Primary ERP Navigation"
          >
            {mainMenuItems.map(item => {
              const isActive = currentNav.main === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo({ main: item.id })}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold tracking-tight transition flex items-center gap-2 whitespace-nowrap ${
                    isActive
                      ? 'bg-[#FF6B3D] text-white shadow-sm'
                      : 'text-[#F7F7F5]/85 hover:text-white hover:bg-[#00343C]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-extrabold ${
                        isActive ? 'bg-black/25 text-white' : 'bg-[#00181C] text-[#FF6B3D]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Sync + Backup + Authenticated Partner Profile + Mobile Menu Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchData}
              className="btn-secondary px-2.5 py-1.5 text-xs"
              title="Synchronize Live Database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FF6B3D]' : ''}`} />
              <span className="hidden xl:inline">Sync</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadBackupJson}
              className="hidden md:inline-flex items-center gap-1.5 btn-oil px-3 py-1.5 text-xs"
              title="1-Click Download Full Database Backup"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup DB</span>
            </button>

            {/* Authenticated User Capsule & Sign Out */}
            <div className="hidden sm:flex items-center gap-2 bg-[#00242A] pl-2.5 pr-1.5 py-1 rounded-lg border border-[#F7F7F5]/15">
              <div className="w-6 h-6 rounded-md bg-[#005B66] border border-[#FF6B3D]/50 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                {(currentAdmin?.full_name || currentAdmin?.username || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="hidden xl:block pr-1 text-left">
                <div className="text-[11px] font-bold text-white leading-tight truncate max-w-[120px]">
                  {currentAdmin?.full_name || currentAdmin?.username || 'Admin'}
                </div>
                <div className="text-[9px] font-mono uppercase text-[#FF6B3D] leading-tight">
                  {currentAdmin?.role || 'PARTNER'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="btn-signout px-2.5 py-1 text-[11px] font-bold flex items-center gap-1"
                title="End Executive Session"
              >
                <LogOut className="w-3 h-3 text-[#FF6B3D]" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Mobile & Tablet Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#00282E] hover:bg-[#00373E] rounded-lg border border-[#F7F7F5]/25 transition"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4 text-[#FF6B3D]" /> : <Menu className="w-4 h-4 text-[#FF6B3D]" />}
              <span>Menu</span>
            </button>
          </div>
        </div>

        {/* Second-Tier Contextual Module Sub-Navigation Bar */}
        {currentNav.main !== 'dashboard' && (
          <div className="bg-[#001418] border-t border-[#F7F7F5]/10 px-3 sm:px-6 py-2">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {currentNav.main === 'accounts' &&
                  ([
                    { id: 'sales', label: 'Customer Sales' },
                    { id: 'purchases', label: 'Supplier Purchases' },
                    {
                      id: 'partials',
                      label: `Khata Dues (${consolidatedCustomerDues.length} Cust • ${consolidatedSupplierDues.length} Sup)`
                    },
                    { id: 'expenses', label: 'Operating Expenses' },
                    { id: 'wallets', label: `Cash & Bank Wallets (${accounts.length})` },
                    { id: 'ledger', label: 'Cashflow Ledger' }
                  ] as { id: AccountsSubTab; label: string }[]).map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => navigateTo({ main: 'accounts', accSub: sub.id })}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition shrink-0 ${
                        currentNav.accSub === sub.id
                          ? 'bg-[#005B66] text-white border-b-2 border-[#FF6B3D]'
                          : 'text-[#F7F7F5]/75 hover:text-white hover:bg-[#00242A]'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}

                {currentNav.main === 'inventory' &&
                  ([
                    { id: 'stock_breakdown', label: 'Godown & Carton Breakdown' },
                    { id: 'locations_transfer', label: 'Warehouses & Stock Transfers' }
                  ] as { id: InventorySubTab; label: string }[]).map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => navigateTo({ main: 'inventory', invSub: sub.id })}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition shrink-0 ${
                        currentNav.invSub === sub.id
                          ? 'bg-[#005B66] text-white border-b-2 border-[#FF6B3D]'
                          : 'text-[#F7F7F5]/75 hover:text-white hover:bg-[#00242A]'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}

                {currentNav.main === 'directory' &&
                  ([
                    { id: 'parties', label: 'Customers, Suppliers & 360° Khata' },
                    { id: 'recycle', label: `Recycle Bin (${stats?.trash_count ?? recycleBin.length})` }
                  ] as { id: DirectorySubTab; label: string }[]).map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => navigateTo({ main: 'directory', dirSub: sub.id })}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition shrink-0 ${
                        currentNav.dirSub === sub.id
                          ? 'bg-[#005B66] text-white border-b-2 border-[#FF6B3D]'
                          : 'text-[#F7F7F5]/75 hover:text-white hover:bg-[#00242A]'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}

                {currentNav.main === 'reports' &&
                  ([
                    { id: 'bill_pnl', label: 'Bill-Wise Profit & Loss' },
                    { id: 'item_profit', label: 'Product Stock & Profit' },
                    { id: 'daybook', label: 'Day Book (Roznamcha)' },
                    { id: 'groups_backup', label: 'Route Groups & Backup Vault' }
                  ] as { id: ReportsSubTab; label: string }[]).map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => navigateTo({ main: 'reports', repSub: sub.id })}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition shrink-0 ${
                        currentNav.repSub === sub.id
                          ? 'bg-[#005B66] text-white border-b-2 border-[#FF6B3D]'
                          : 'text-[#F7F7F5]/75 hover:text-white hover:bg-[#00242A]'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
              </div>

              <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-300 shrink-0">
                ● PKT {pktClock.time12}
              </span>
            </div>
          </div>
        )}

        {/* Responsive Mobile & Tablet Top-Menu Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#00181C] border-t border-[#F7F7F5]/15 px-3 sm:px-6 py-3 space-y-3 max-h-[82vh] overflow-y-auto shadow-2xl">
            {/* Active User Row */}
            <div className="bg-[#00242A] p-3 rounded-lg border border-[#F7F7F5]/15 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-md bg-[#005B66] border border-[#FF6B3D]/50 text-white font-black text-xs flex items-center justify-center shrink-0">
                  {(currentAdmin?.full_name || currentAdmin?.username || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-white truncate">
                    {currentAdmin?.full_name || currentAdmin?.username || 'Authorized Partner'}
                  </div>
                  <div className="text-[10px] font-mono text-[#FF6B3D] truncate">
                    {currentAdmin?.username || 'Admin'} • {currentAdmin?.role || 'ADMIN'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="btn-signout px-3 py-1.5 text-xs font-bold flex items-center gap-1 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5 text-[#FF6B3D]" /> Sign Out
              </button>
            </div>

            {/* Primary Modules */}
            <div className="space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#FF6B3D] px-1">
                Primary Modules
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {mainMenuItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo({ main: item.id })}
                    className={`py-2.5 px-3 rounded-lg text-xs font-bold text-left flex items-center justify-between transition ${
                      currentNav.main === item.id
                        ? 'bg-[#FF6B3D] text-white'
                        : 'bg-[#00242A] text-[#F7F7F5] border border-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 opacity-80" />
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Module Shortcuts */}
            <div className="space-y-1 pt-1 border-t border-white/10">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#F7F7F5]/60 px-1">
                Direct Sub-Modules & Actions
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => navigateTo({ main: 'accounts', accSub: 'sales' })}
                  className="py-2 px-3 rounded-lg text-[11px] font-bold text-left bg-[#00242A] text-emerald-300 border border-white/10"
                >
                  Customer Sales
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo({ main: 'accounts', accSub: 'purchases' })}
                  className="py-2 px-3 rounded-lg text-[11px] font-bold text-left bg-[#00242A] text-[#FF6B3D] border border-white/10"
                >
                  Supplier Purchases
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo({ main: 'accounts', accSub: 'partials' })}
                  className="py-2 px-3 rounded-lg text-[11px] font-bold text-left bg-[#00242A] text-amber-300 border border-white/10"
                >
                  Khata Dues ({consolidatedCustomerDues.length + consolidatedSupplierDues.length})
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo({ main: 'accounts', accSub: 'wallets' })}
                  className="py-2 px-3 rounded-lg text-[11px] font-bold text-left bg-[#00242A] text-white border border-white/10"
                >
                  Cash & Wallets
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo({ main: 'accounts', accSub: 'expenses' })}
                  className="py-2 px-3 rounded-lg text-[11px] font-bold text-left bg-[#00242A] text-white border border-white/10"
                >
                  Expenses
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo({ main: 'accounts', accSub: 'ledger' })}
                  className="py-2 px-3 rounded-lg text-[11px] font-bold text-left bg-[#00242A] text-white border border-white/10"
                >
                  Cashflow Ledger
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo({ main: 'inventory', invSub: 'locations_transfer' })}
                  className="py-2 px-3 rounded-lg text-[11px] font-bold text-left bg-[#00242A] text-white border border-white/10"
                >
                  Stock Transfers
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo({ main: 'directory', dirSub: 'recycle' })}
                  className="py-2 px-3 rounded-lg text-[11px] font-bold text-left bg-[#00242A] text-rose-300 border border-white/10"
                >
                  Recycle Bin ({stats?.trash_count ?? recycleBin.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleDownloadBackupJson();
                  }}
                  className="py-2 px-3 rounded-lg text-[11px] font-bold text-left bg-[#F7F7F5] text-[#00262B] col-span-2 sm:col-span-1"
                >
                  ↓ Backup Database
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ==================== MAIN CONTENT CONTAINER ==================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-5 space-y-5 relative z-10 no-print">
        {toast && (
          <div
            className={`glass-panel px-4 py-3 rounded-lg text-xs font-bold flex justify-between items-center ${
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
            SECTION 1: ENTERPRISE EXECUTIVE DASHBOARD (100% WHOLE PKR)
           ========================================================================= */}
        {currentNav.main === 'dashboard' && !stats && (
          <div className="glass-panel p-8 rounded-xl text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-[#FF6B3D] animate-spin mx-auto" />
            <div className="text-sm font-extrabold text-white">Syncing Live Executive ERP Database...</div>
            <div className="text-xs text-slate-300">Loading Sales, Purchases, Godown Stock & Partner Ledgers</div>
          </div>
        )}

        {currentNav.main === 'dashboard' && stats && (
          <div className="space-y-5 animate-fade-in">
            {/* Super Admin Approval Requests Bar */}
            {(currentAdmin?.is_super_admin || currentAdmin?.role === 'SUPER_ADMIN' || currentAdmin?.username === 'Admin') &&
              adminsList.some(a => a.approval_status === 'PENDING') && (
                <div className="glass-panel p-4 rounded-xl border-2 border-[#FF6B3D] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#FF6B3D] text-white font-extrabold">
                        Super Administrator Authorization Required
                      </span>
                      <h3 className="text-sm font-black text-white mt-1">
                        PENDING ADMIN REGISTRATION REQUESTS ({adminsList.filter(a => a.approval_status === 'PENDING').length})
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {adminsList
                      .filter(a => a.approval_status === 'PENDING')
                      .map(req => (
                        <div
                          key={req.id}
                          className="bg-[#001D21] p-3 rounded-lg border border-[#F7F7F5]/15 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-extrabold text-white text-sm">{req.full_name}</div>
                            <div className="text-[#FF6B3D] font-mono">
                              Email: {req.email} • Username: {req.username} • Role: {req.role}
                            </div>
                            <div className="text-[11px] text-slate-300">Requested At: {req.created_at}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAdminApprovalDecision(req.id, 'APPROVED')}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-1.5 rounded-md text-xs transition"
                            >
                              ✓ Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdminApprovalDecision(req.id, 'NOT_APPROVED')}
                              className="btn-danger px-3.5 py-1.5 text-xs"
                            >
                              ✕ Decline
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Executive Reporting Filter & PKT Status Bar */}
            <div className="glass-panel p-3.5 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-md bg-[#00181C] border border-[#005B66] text-[11px] font-mono font-bold text-emerald-300">
                  ● PKT {pktClock.time12}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-white">
                  {activeDateRangeInfo.fullLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {([
                  { id: 'daily', label: 'Today' },
                  { id: 'weekly', label: 'Last 7 Days' },
                  { id: 'monthly', label: 'This Month' },
                  { id: 'all', label: 'All-Time' }
                ] as const).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setCustomDate('');
                      setCustomDateTo('');
                      setPeriod(p.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition ${
                      !customDate && period === p.id
                        ? 'bg-[#FF6B3D] text-white'
                        : 'bg-[#00181C] text-[#F7F7F5] border border-[#F7F7F5]/20 hover:border-[#FF6B3D]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}

                <div className="flex items-center gap-1.5 bg-[#00181C] px-2.5 py-1 rounded-md border border-[#F7F7F5]/20 text-xs">
                  <span className="text-[11px] text-slate-300 font-semibold">From:</span>
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => {
                      setCustomDate(e.target.value);
                      if (!customDateTo || customDateTo < e.target.value) {
                        setCustomDateTo(e.target.value);
                      }
                    }}
                    className="bg-transparent text-xs font-mono text-white outline-none"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="date"
                    value={customDateTo || customDate}
                    min={customDate || undefined}
                    onChange={e => {
                      if (!customDate) setCustomDate(e.target.value);
                      setCustomDateTo(e.target.value);
                    }}
                    className="bg-transparent text-xs font-mono text-white outline-none"
                  />
                  {customDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomDate('');
                        setCustomDateTo('');
                      }}
                      className="text-rose-400 font-bold px-1"
                      title="Clear Custom Date"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 5 Structured Executive Financial KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div
                onClick={() => navigateTo({ main: 'accounts', accSub: 'sales' })}
                className="kpi-card p-4 rounded-xl cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-300">
                  <span>Sales Revenue</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-white tabular-nums">
                  PKR {pkr(stats.total_sales_revenue).toLocaleString()}
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] tabular-nums">
                  <span className="text-emerald-300 font-semibold">Collected: PKR {pkr(stats.sales_collected).toLocaleString()}</span>
                  <span className="text-slate-300">{stats.sales_count} Bills</span>
                </div>
              </div>

              <div
                onClick={() => navigateTo({ main: 'accounts', accSub: 'purchases' })}
                className="kpi-card p-4 rounded-xl cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-300">
                  <span>Stock Purchases</span>
                  <ShoppingCart className="w-4 h-4 text-[#FF6B3D]" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-white tabular-nums">
                  PKR {pkr(stats.total_purchases_cost).toLocaleString()}
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] tabular-nums">
                  <span className="text-[#FF6B3D] font-semibold">Paid: PKR {pkr(stats.purchases_paid).toLocaleString()}</span>
                  <span className="text-slate-300">{stats.purchases_count} Bills</span>
                </div>
              </div>

              <div
                onClick={() => navigateTo({ main: 'accounts', accSub: 'partials' })}
                className="kpi-card p-4 rounded-xl cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-300">
                  <span>Market Khata Dues</span>
                  <Users className="w-4 h-4 text-amber-300" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-amber-300 tabular-nums">
                  PKR {pkr(stats.total_receivable).toLocaleString()}
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] tabular-nums">
                  <span className="text-slate-300">{consolidatedCustomerDues.length} Cust</span>
                  <span className="text-rose-300 font-bold">Payable: PKR {pkr(stats.total_payable).toLocaleString()}</span>
                </div>
              </div>

              <div
                onClick={() => navigateTo({ main: 'accounts', accSub: 'wallets' })}
                className="kpi-card p-4 rounded-xl cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-300">
                  <span>Cash & Bank Wallets</span>
                  <Wallet className="w-4 h-4 text-emerald-300" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-300 tabular-nums">
                  PKR {pkr(stats.total_cash_bank).toLocaleString()}
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] tabular-nums">
                  <span className="text-slate-300">Net P&L: PKR {pkr(stats.net_profit).toLocaleString()}</span>
                  <span className="text-rose-300">Exp: PKR {pkr(stats.total_expenses).toLocaleString()}</span>
                </div>
              </div>

              <div
                onClick={() => navigateTo({ main: 'inventory', invSub: 'stock_breakdown' })}
                className="kpi-card p-4 rounded-xl cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-300">
                  <span>Live Stock Value</span>
                  <Package className="w-4 h-4 text-[#FF6B3D]" />
                </div>
                <div className="mt-2 text-xl sm:text-2xl font-black text-white tabular-nums">
                  PKR {pkr(stats.total_stock_value).toLocaleString()}
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] tabular-nums">
                  <span className="text-slate-200 font-semibold">{pkr(stats.total_stock_bottles).toLocaleString()} Bottles</span>
                  <span className={lowStockProducts.length > 0 ? 'text-amber-300 font-bold' : 'text-emerald-300'}>
                    {lowStockProducts.length > 0 ? `${lowStockProducts.length} Low Stock` : 'Stock Healthy'}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2: Brand Operations Command Panel (Left 2 Cols) + Financial Accounts & Godown Summary (Right 1 Col) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              <div className="lg:col-span-2 space-y-5">
                <AthFracturedCurrentHero onNavigate={navigateTo} />

                {/* Recent Business Transactions Table */}
                <div className="glass-panel rounded-xl p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wide">
                        Recent Business Transactions ({accountHistory.length})
                      </h3>
                      <p className="text-[11px] text-slate-300">
                        Audited inflows, outflows, and Khata settlements for the active period
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo({ main: 'accounts', accSub: 'ledger' })}
                      className="text-xs font-bold text-[#FF6B3D] hover:underline"
                    >
                      Open Full Cashflow Ledger →
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs erp-table">
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Type</th>
                          <th>Ref #</th>
                          <th>Party</th>
                          <th className="text-right">Cash In (+)</th>
                          <th className="text-right">Cash Out (-)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountHistory.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-6 text-slate-400">
                              No transactions recorded in this date range.
                            </td>
                          </tr>
                        ) : (
                          accountHistory.slice(0, 7).map(h => (
                            <tr key={h.id}>
                              <td className="font-mono text-slate-300 whitespace-nowrap">{formatRecordDateTimePkt(h.date)}</td>
                              <td className="font-bold text-white whitespace-nowrap">{h.type}</td>
                              <td className="font-mono text-[#FF6B3D] font-bold whitespace-nowrap">{h.reference}</td>
                              <td className="text-slate-100 font-semibold truncate max-w-[160px]">{h.party}</td>
                              <td className="text-right font-mono font-bold text-emerald-300 tabular-nums whitespace-nowrap">
                                {h.cash_in > 0 ? `+PKR ${pkr(h.cash_in).toLocaleString()}` : '—'}
                              </td>
                              <td className="text-right font-mono font-bold text-rose-300 tabular-nums whitespace-nowrap">
                                {h.cash_out > 0 ? `-PKR ${pkr(h.cash_out).toLocaleString()}` : '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Financial Accounts + Godown Stock Summary */}
              <div className="space-y-5">
                <div className="glass-panel rounded-xl p-4 sm:p-5 space-y-3">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-[#FF6B3D]" /> Cash & Bank Accounts
                    </h3>
                    <button
                      type="button"
                      onClick={() => navigateTo({ main: 'accounts', accSub: 'wallets' })}
                      className="text-xs text-[#FF6B3D] hover:underline font-bold"
                    >
                      Manage →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {accounts.map(acc => (
                      <div
                        key={acc.id}
                        className="bg-[#001D21] p-3 rounded-lg border border-white/10 flex justify-between items-center"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{acc.name}</div>
                          <div className="text-[10px] text-[#FF6B3D] font-mono">
                            {acc.type} • {acc.account_number || 'Active'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs sm:text-sm font-extrabold text-emerald-300 tabular-nums font-mono">
                            PKR {pkr(acc.current_balance).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {pkr(stats.total_loan_payable) > 0 && (
                      <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-400/40 flex justify-between items-center text-xs">
                        <span className="font-bold text-rose-200">Arranged Loans Payable:</span>
                        <span className="font-mono font-extrabold text-rose-300">
                          PKR {pkr(stats.total_loan_payable).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Godown Stock Summary Card */}
                <div className="glass-panel rounded-xl p-4 sm:p-5 space-y-3">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#FF6B3D]" /> Godowns & Warehouses
                    </h3>
                    <button
                      type="button"
                      onClick={() => navigateTo({ main: 'inventory', invSub: 'stock_breakdown' })}
                      className="text-xs text-[#FF6B3D] hover:underline font-bold"
                    >
                      Stock Details →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {enrichedLocations.map(loc => (
                      <div
                        key={loc.id}
                        className="bg-[#001D21] p-3 rounded-lg border border-white/10 flex justify-between items-center text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">{loc.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {loc.location_type} • {loc.safeItems.length} Active SKUs
                          </div>
                        </div>
                        <div className="text-right font-mono font-extrabold text-amber-300 tabular-nums">
                          {loc.total_bottles.toLocaleString()} Btls
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Partner & Admin Operational Transparency */}
            <div className="glass-panel rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F7F7F5]/10 pb-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wide">
                    Partner & Admin Operational Transparency ({activeDateRangeInfo.badge})
                  </h3>
                  <p className="text-[11px] text-[#F7F7F5]/75">
                    Side-by-side audit of Sales, Purchases, Cash Collections, and Expenses recorded by each authorized partner
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDashboardPartnerView('ALL')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold ${
                      dashboardPartnerView === 'ALL' ? 'bg-[#FF6B3D] text-white' : 'bg-[#001D21] text-[#F7F7F5] border border-white/15'
                    }`}
                  >
                    All Partners ({partnerTransparency.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardPartnerView('MINE')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold ${
                      dashboardPartnerView === 'MINE' ? 'bg-[#F7F7F5] text-[#00262B]' : 'bg-[#001D21] text-[#F7F7F5] border border-white/15'
                    }`}
                  >
                    My Activity ({currentAdmin?.username || 'Admin'})
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {partnerTransparency
                  .filter(pt =>
                    dashboardPartnerView === 'ALL'
                      ? true
                      : pt.admin_id === (currentAdmin?.id || 1) ||
                        (Boolean(currentAdmin?.email) && pt.email.toLowerCase() === currentAdmin!.email.toLowerCase())
                  )
                  .map((pt, idx) => (
                    <div
                      key={pt.admin_id}
                      className="bg-[#001D21] p-4 rounded-xl border border-[#F7F7F5]/15 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-[#F7F7F5]/10 pb-2.5">
                        <div>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#005B66] text-white font-bold">
                            Partner #{idx + 1} • {pt.role}
                          </span>
                          <h4 className="text-sm font-black text-white mt-1">{pt.full_name}</h4>
                          <div className="text-[11px] text-[#F7F7F5]/70 font-mono">
                            Username: {pt.username}
                          </div>
                        </div>
                        {pt.admin_id === (currentAdmin?.id || 1) && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold">
                            ● Active Session
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
                        <div className="bg-[#00282E] p-2.5 rounded-lg border border-white/10">
                          <div className="text-[10px] text-slate-300 uppercase">Sales Billed</div>
                          <div className="text-xs font-extrabold text-emerald-300 mt-0.5 font-mono">
                            PKR {pkr(pt.sales_total).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">{pt.sales_count} Bills</div>
                        </div>
                        <div className="bg-[#00282E] p-2.5 rounded-lg border border-white/10">
                          <div className="text-[10px] text-slate-300 uppercase">Purchases</div>
                          <div className="text-xs font-extrabold text-[#FF6B3D] mt-0.5 font-mono">
                            PKR {pkr(pt.purchases_total).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">{pt.purchases_count} Bills</div>
                        </div>
                        <div className="bg-[#00282E] p-2.5 rounded-lg border border-white/10">
                          <div className="text-[10px] text-slate-300 uppercase">Cash Inflow</div>
                          <div className="text-xs font-extrabold text-[#F7F7F5] mt-0.5 font-mono">
                            PKR {pkr(pt.deposits_total).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">{pt.deposits_count} Entries</div>
                        </div>
                        <div className="bg-[#00282E] p-2.5 rounded-lg border border-white/10">
                          <div className="text-[10px] text-slate-300 uppercase">Expenses</div>
                          <div className="text-xs font-extrabold text-rose-300 mt-0.5 font-mono">
                            PKR {pkr(pt.expenses_total).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">{pt.expenses_count} Vouchers</div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SECTION 2: BILLING & ACCOUNTS (VYAPAR MULTI-ITEM + PREVIOUS KHATA)
           ========================================================================= */}
        {currentNav.main === 'accounts' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-panel p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-[#FF6B3D]" />
                <span className="text-xs font-extrabold text-white uppercase tracking-wide">
                  Active Records Filter: <span className="text-[#FF6B3D]">{customDate || period.toUpperCase()}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  { id: 'daily', label: 'Today (Daily)' },
                  { id: 'weekly', label: 'Last 7 Days' },
                  { id: 'monthly', label: 'Monthly (30D)' },
                  { id: 'all', label: 'All-Time' }
                ] as const).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setCustomDate('');
                      setPeriod(p.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                      !customDate && period === p.id
                        ? 'bg-[#FF6B3D] text-white shadow'
                        : 'bg-[#002B31] text-[#F7F7F5] border border-[#F7F7F5]/20 hover:border-[#FF6B3D]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 bg-[#002B31] px-3 py-1 rounded-full border border-[#F7F7F5]/25">
                  <span className="text-[11px] font-bold text-[#FF6B3D]">Date:</span>
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    className="bg-transparent text-xs font-mono text-white outline-none"
                  />
                  {customDate && (
                    <button
                      type="button"
                      onClick={() => setCustomDate('')}
                      className="text-xs text-rose-400 font-bold ml-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {currentNav.accSub === 'sales' && (
              <div className="space-y-6">
                <div className="glass-panel rounded-2xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                      <Plus className="w-4 h-4 text-[#FF6B3D]" /> CREATE CUSTOMER SALE INVOICE
                    </h3>
                    <span className="text-xs font-bold text-[#F7F7F5]/80">
                      Recorded by Admin: <strong className="text-[#FF6B3D]">{currentAdmin?.full_name || 'Admin'}</strong>
                    </span>
                  </div>

                  <form onSubmit={handleCreateSale} className="space-y-4">

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
                            setSaleCustomerId(0);
                            setSaleForceNewCustomer(false);
                          }}
                          className="erp-input"
                        />
                        {possibleSaleCustomerMatches.length > 0 && (
                          <div className="p-2.5 rounded-xl bg-amber-950/95 border border-yellow-400/70 space-y-1.5 text-[11px] animate-fade-in">
                            <div className="font-extrabold text-yellow-300 flex items-center justify-between">
                              <span>Possible Existing Customer Match ({possibleSaleCustomerMatches.length}) — Confirm Identity:</span>
                              <button
                                type="button"
                                onClick={() => setSaleForceNewCustomer(true)}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-white px-2 py-0.5 rounded border border-white/20"
                              >
                                + Keep as Separate New Customer
                              </button>
                            </div>
                            {possibleSaleCustomerMatches.slice(0, 3).map(m => (
                              <div
                                key={m.id}
                                className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-white/10"
                              >
                                <div className="text-white">
                                  <strong>{m.name}</strong> ({m.city}) • Group: <span className="text-yellow-300">{m.group_name}</span> • Phone: <span className="font-mono">{m.phone || 'N/A'}</span> • CNIC: <span className="font-mono">{m.cnic || 'N/A'}</span> • Khata: <strong className="text-rose-300">PKR {pkr(m.current_receivable).toLocaleString()}</strong>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSelectSaleCustomer(m)}
                                  className="btn-oil px-2.5 py-1 text-[10px]"
                                >
                                  ✓ Select This Customer (ID #{m.id})
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
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
                              Settle Previous Bill First (FIFO) & Include Old Khata on Invoice
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

                    {/* Live Stock Breakdown & Purchase Cost Intelligence */}
                    {selectedSaleProduct && saleDocType === 'SALE' && (
                      <div className="rounded-2xl p-4 bg-[#00262B]/95 border border-[#F7F7F5]/20 space-y-3 text-xs animate-fade-in">
                        {/* Out-Of-Stock Everywhere Warning */}
                        {totalStockAcrossAllLocs <= 0 ? (
                          <div className="p-3 rounded-xl bg-rose-950/90 border-2 border-rose-500 text-rose-200 font-bold flex items-center justify-between">
                            <span>
                              Zero Stock Available! <strong>{selectedSaleProduct.name}</strong> is completely out of stock across all godowns.
                            </span>
                            <span className="text-[11px] bg-rose-600 text-white px-2.5 py-1 rounded-full font-mono uppercase">
                              0 Bottles in System
                            </span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Selected Godown Stock */}
                            <div className="bg-[#00373E] p-3 rounded-xl border border-white/10 space-y-1">
                              <span className="text-[10px] text-slate-300 uppercase block font-semibold">
                                Dispatching From: <strong className="text-white">{selectedSaleLocName}</strong>
                              </span>
                              <div className={`text-base font-black tabular-nums ${saleLocAvailableBottles > 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                                {Math.floor(saleLocAvailableBottles / saleUpc)} Ctn + {saleLocAvailableBottles % saleUpc} Btl
                              </div>
                              <div className="text-[11px] text-slate-300">
                                ({saleLocAvailableBottles} Available Bottles)
                              </div>
                            </div>

                            {/* Total Stock in All Godowns */}
                            <div className="bg-[#00373E] p-3 rounded-xl border border-white/10 space-y-1">
                              <span className="text-[10px] text-slate-300 uppercase block font-semibold">
                                Total All Warehouses:
                              </span>
                              <div className="text-base font-black text-yellow-300 tabular-nums">
                                {Math.floor(totalStockAcrossAllLocs / saleUpc)} Ctn + {totalStockAcrossAllLocs % saleUpc} Btl
                              </div>
                              <div className="text-[11px] text-slate-300 font-mono">
                                {totalStockAcrossAllLocs} Total Bottles in Godowns
                              </div>
                            </div>

                            {/* Purchase Cost & Profit Reference */}
                            <div className="bg-[#00373E] p-3 rounded-xl border border-white/10 space-y-1">
                              <span className="text-[10px] text-[#FF6B3D] uppercase block font-bold">
                                Purchase Price (Your Cost):
                              </span>
                              <div className="text-base font-black text-rose-300 tabular-nums">
                                PKR {pkr(selectedSaleProduct.carton_purchase_rate).toLocaleString()} <span className="text-[11px] text-slate-300 font-normal">/Ctn</span>
                              </div>
                              <div className="text-[11px] text-slate-300 font-mono">
                                (PKR {pkr(selectedSaleProduct.purchase_rate).toLocaleString()} per bottle)
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Location Switcher if another godown has stock */}
                        {saleLocAvailableBottles <= 0 && saleAlternativeLocations.length > 0 && (
                          <div className="p-3 rounded-xl bg-amber-950/90 border border-yellow-400 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-yellow-200 font-bold">
                              Stock is 0 in {selectedSaleLocName}, but available in other godowns. Click to switch:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {saleAlternativeLocations.map(alt => (
                                <button
                                  key={alt.location_id}
                                  type="button"
                                  onClick={() => setSaleLocationId(alt.location_id)}
                                  className="btn-oil px-3 py-1.5 text-xs font-bold"
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
                          <label className="text-xs text-yellow-300 font-semibold">Received Amount (PKR)</label>
                          <input
                            type="number"
                            required
                            placeholder={`Total Due: PKR ${computedSaleGrandPayable.toLocaleString()}`}
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
                          <span>Total Due (New + Old): <strong className="text-white">PKR {pkr(computedSaleTotal + customerPreviousDues).toLocaleString()}</strong></span>
                          <span>
                            Total Received Today: <strong className="text-emerald-300">PKR {computedSaleReceived.toLocaleString()}</strong>
                            {computedSaleReceived > 0 && (
                              <span className="ml-1.5 text-[11px] bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 px-2 py-0.5 rounded-full">
                                Prev Bill Settled: PKR {computedAppliedToPrev.toLocaleString()} • This Bill Paid: PKR {computedAllocatedToNewBill.toLocaleString()} (Rem New Bill: PKR {pkr(computedSaleTotal - computedAllocatedToNewBill).toLocaleString()})
                              </span>
                            )}
                          </span>
                          <span>Projected Closing Khata: <strong className="text-rose-400">PKR {computedClosingKhata.toLocaleString()}</strong></span>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isSaleStockInsufficient || saleSubmitting}
                        className={`py-3 px-6 text-xs uppercase rounded-full font-extrabold flex items-center gap-2 ${
                          isSaleStockInsufficient || saleSubmitting
                            ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                            : 'btn-primary'
                        }`}
                      >
                        {saleSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Posting Invoice... Please Wait
                          </>
                        ) : isSaleStockInsufficient ? (
                          'Stock Unavailable in Selected Location'
                        ) : (
                          <>
                            Confirm & Post {saleDocType === 'SALE' ? 'Sale Invoice' : saleDocType} <ArrowRight className="w-4 h-4" />
                          </>
                        )}
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
                          <th>Recorded By (Admin)</th>
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
                            <td colSpan={10} className="text-center py-8 text-slate-300">
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
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    s.admin_name === currentAdmin?.full_name || s.admin_name === currentAdmin?.username
                                      ? 'bg-[#FF6B3D] text-white'
                                      : 'bg-[#00373E] text-[#F7F7F5] border border-white/20'
                                  }`}
                                >
                                  {s.admin_name || 'Admin'}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  onClick={() => openCustomer360(s.customer_id)}
                                  className="font-bold text-white hover:text-yellow-300 underline text-left"
                                >
                                  {s.customer_name}
                                </button>
                                <div className="text-[10px] text-slate-300">
                                  {s.customer_city} • {s.customer_group}
                                </div>
                              </td>
                              <td className="text-yellow-300 font-semibold">{s.location_summary}</td>
                              <td className="text-slate-100 max-w-xs">{s.items_summary}</td>
                              <td className="font-bold text-white tabular-nums">
                                PKR {pkr(s.total_amount).toLocaleString()}
                              </td>
                              <td className="text-emerald-300 font-bold tabular-nums">
                                {(() => {
                                  const billPart = pkr(s.received_amount) > pkr(s.total_amount) ? pkr(s.total_amount) : pkr(s.received_amount);
                                  const oldPart = pkr(s.applied_to_previous);
                                  return (
                                    <>
                                      PKR {pkr(billPart + oldPart).toLocaleString()}
                                      {oldPart > 0 && (
                                        <div className="text-[10px] font-mono text-emerald-200">
                                          (Bill: {billPart.toLocaleString()} + Old: {oldPart.toLocaleString()})
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="font-bold text-rose-300 tabular-nums">
                                <div>Bill: PKR {pkr(s.receivable_amount).toLocaleString()}</div>
                                <div className="text-[10px] font-mono text-[#FF6B3D]">
                                  Khata: PKR {pkr(s.closing_receivable ?? s.receivable_amount).toLocaleString()} ({s.payment_status})
                                </div>
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
                      <ShoppingCart className="w-4 h-4 text-[#FF6B3D]" /> RECORD SUPPLIER STOCK PURCHASE (ADDS NEW OR EXISTING PRODUCTS TO STOCK)
                    </h3>
                    <span className="text-xs font-bold text-[#F7F7F5]/80">
                      Recorded by Admin: <strong className="text-[#FF6B3D]">{currentAdmin?.full_name || 'Admin'}</strong>
                    </span>
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
                            setPurForceNewSupplier(false);
                          }}
                          className="erp-input"
                        />
                        {possiblePurSupplierMatches.length > 0 && (
                          <div className="p-2.5 rounded-xl bg-amber-950/95 border border-yellow-400/70 space-y-1.5 text-[11px] animate-fade-in">
                            <div className="font-extrabold text-yellow-300 flex items-center justify-between">
                              <span>Possible Existing Supplier Match ({possiblePurSupplierMatches.length}):</span>
                              <button
                                type="button"
                                onClick={() => setPurForceNewSupplier(true)}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-white px-2 py-0.5 rounded border border-white/20"
                              >
                                + Keep as Separate New Supplier
                              </button>
                            </div>
                            {possiblePurSupplierMatches.slice(0, 3).map(s => (
                              <div
                                key={s.id}
                                className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-white/10"
                              >
                                <div className="text-white">
                                  <strong>{s.name}</strong> ({s.city}) • Phone: <span className="font-mono">{s.phone || 'N/A'}</span> • CNIC: <span className="font-mono">{s.cnic || 'N/A'}</span> • Payable: <strong className="text-rose-300">PKR {pkr(s.current_payable).toLocaleString()}</strong>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPurSupplierId(s.id);
                                    setPurSupplierName(s.name);
                                    setPurSupplierCity(s.city);
                                    setPurSupplierPhone(s.phone || '');
                                    setPurSupplierCnic(s.cnic || '');
                                    setPurSupplierGroup(s.group_name || 'General Suppliers');
                                  }}
                                  className="btn-oil px-2.5 py-1 text-[10px]"
                                >
                                  ✓ Select This Supplier (ID #{s.id})
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
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

                    {/* Supplier Outstanding Ledger & Previous Khata Banner */}
                    {activePurSupplier && (
                      <div className="p-3.5 rounded-xl bg-[#00262B]/95 border border-[#FF6B3D]/50 flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
                        <div className="space-y-0.5">
                          <div className="font-bold text-white">
                            Selected Supplier: <span className="text-[#FF6B3D]">{activePurSupplier.name}</span> ({activePurSupplier.city})
                          </div>
                          <div className="text-slate-200">
                            Previous Supplier Payable Balance (Old Dues):{' '}
                            <strong className={supplierPreviousDues > 0 ? 'text-rose-400 text-sm' : 'text-emerald-400'}>
                              PKR {supplierPreviousDues.toLocaleString()}
                            </strong>
                          </div>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className="text-[11px] text-slate-300 block">Projected Total Payable to Supplier (Old + New):</span>
                          <span className="text-sm font-black text-[#FF6B3D]">
                            PKR {pkr(Math.max(0, supplierPreviousDues + computedPurTotal - computedPurPaid)).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}

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
                        <span>Current Bill: <strong className="text-[#FF6B3D]">PKR {computedPurTotal.toLocaleString()}</strong></span>
                        <span>Previous Supplier Payable: <strong className="text-rose-300">PKR {supplierPreviousDues.toLocaleString()}</strong></span>
                        <span>Total Due (Old + New): <strong className="text-white">PKR {pkr(supplierPreviousDues + computedPurTotal).toLocaleString()}</strong></span>
                        <span>
                          Paid Today: <strong className="text-emerald-300">PKR {computedPurPaid.toLocaleString()}</strong>
                          {computedPurPaid > computedPurTotal && supplierPreviousDues > 0 && (
                            <span className="ml-1.5 text-[11px] bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 px-2 py-0.5 rounded-full">
                              Auto-settles PKR {pkr(Math.min(supplierPreviousDues, computedPurPaid - computedPurTotal)).toLocaleString()} of Old Dues
                            </span>
                          )}
                        </span>
                        <span>Total Closing Supplier Payable: <strong className="text-rose-400">PKR {pkr(Math.max(0, supplierPreviousDues + computedPurTotal - computedPurPaid)).toLocaleString()}</strong></span>
                      </div>
                      <button
                        type="submit"
                        disabled={Boolean(isPurWalletInsufficient) || purSubmitting}
                        className={`py-3 px-6 text-xs uppercase rounded-xl font-bold flex items-center gap-2 ${
                          isPurWalletInsufficient || purSubmitting
                            ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                            : 'btn-oil'
                        }`}
                      >
                        {purSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Saving Purchase Bill... Please Wait
                          </>
                        ) : (
                          'Save Purchase & Update Stock'
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Purchase Register */}
                <div className="glass-panel rounded-2xl p-5">
                  <h3 className="text-sm font-extrabold text-white mb-4 samsung-heading heading-reveal">PURCHASE BILLS REGISTER</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs erp-table min-w-[860px]">
                      <thead>
                        <tr>
                          <th>Bill #</th>
                          <th>Date</th>
                          <th>Supplier</th>
                          <th>Items & Carton Breakdown</th>
                          <th>Total Bill</th>
                          <th>Paid</th>
                          <th>Bill Payable / Closing</th>
                          <th className="text-right">Bill / Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map(p => (
                          <tr key={p.id}>
                            <td className="font-mono font-bold text-[#FF6B3D]">{p.purchase_number}</td>
                            <td className="text-slate-200 font-mono">{p.invoice_date}</td>
                            <td className="font-bold text-white">{p.supplier_name}</td>
                            <td className="text-slate-100 max-w-xs">{p.items_summary}</td>
                            <td className="font-bold text-white tabular-nums">PKR {pkr(p.total_amount).toLocaleString()}</td>
                            <td className="text-emerald-300 font-bold tabular-nums">
                              PKR {pkr(p.paid_amount + (p.applied_to_previous || 0)).toLocaleString()}
                              {pkr(p.applied_to_previous) > 0 && (
                                <div className="text-[10px] font-mono text-emerald-200">
                                  (Bill: {pkr(p.paid_amount).toLocaleString()} + Old: {pkr(p.applied_to_previous).toLocaleString()})
                                </div>
                              )}
                            </td>
                            <td className="font-bold text-rose-300 tabular-nums">
                              <div>Bill: PKR {pkr(p.payable_amount).toLocaleString()}</div>
                              <div className="text-[10px] font-mono text-[#FF6B3D]">
                                Total Supplier Due: PKR {pkr(p.closing_payable ?? p.payable_amount).toLocaleString()} ({p.payment_status})
                              </div>
                            </td>
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

            {/* PARTIAL PAYMENTS & CONSOLIDATED KHATA DUES TAB */}
            {currentNav.accSub === 'partials' && (
              <div className="space-y-6">
                {/* Top Summary KPI Banner for Unique People vs Individual Bills */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass-panel p-4 rounded-2xl border border-emerald-400/30">
                    <div className="text-[11px] font-bold uppercase text-emerald-300">Unique Customers With Dues</div>
                    <div className="text-2xl font-black text-white mt-1 tabular-nums">
                      {consolidatedCustomerDues.length} {consolidatedCustomerDues.length === 1 ? 'Customer' : 'Customers'}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">
                      Across {pendingSales.length} Unpaid Sale {pendingSales.length === 1 ? 'Bill' : 'Bills'}
                    </div>
                  </div>

                  <div className="glass-panel p-4 rounded-2xl border border-emerald-400/30">
                    <div className="text-[11px] font-bold uppercase text-emerald-300">Total Customer Khata Receivable</div>
                    <div className="text-2xl font-black text-emerald-300 mt-1 tabular-nums">
                      PKR {consolidatedCustomerDues.reduce((s, g) => s + pkr(g.total_remaining), 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">Consolidated by CNIC, Phone, Name & Route</div>
                  </div>

                  <div className="glass-panel p-4 rounded-2xl border border-[#FF6B3D]/40">
                    <div className="text-[11px] font-bold uppercase text-[#FF6B3D]">Unique Suppliers With Dues</div>
                    <div className="text-2xl font-black text-white mt-1 tabular-nums">
                      {consolidatedSupplierDues.length} {consolidatedSupplierDues.length === 1 ? 'Supplier' : 'Suppliers'}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">
                      Across {pendingPurchases.length} Unpaid Purchase {pendingPurchases.length === 1 ? 'Bill' : 'Bills'}
                    </div>
                  </div>

                  <div className="glass-panel p-4 rounded-2xl border border-[#FF6B3D]/40">
                    <div className="text-[11px] font-bold uppercase text-[#FF6B3D]">Total Supplier Khata Payable</div>
                    <div className="text-2xl font-black text-rose-300 mt-1 tabular-nums">
                      PKR {consolidatedSupplierDues.reduce((s, g) => s + pkr(g.total_remaining), 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">Consolidated by CNIC, Phone, Name & City</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  {/* LEFT COLUMN: CONSOLIDATED CUSTOMERS & INDIVIDUAL BILLS */}
                  <div className="glass-panel rounded-2xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
                      <div>
                        <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                          <Users className="w-4 h-4 text-emerald-400" /> CONSOLIDATED CUSTOMER KHATA ({consolidatedCustomerDues.length} UNIQUE {consolidatedCustomerDues.length === 1 ? 'CUSTOMER' : 'CUSTOMERS'})
                        </h3>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Multiple bills for the same verified customer are grouped together. Click any customer to inspect individual bills or clear all dues at once.
                        </p>
                      </div>
                    </div>

                    {consolidatedCustomerDues.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-300">
                        No outstanding customer bills. All customer accounts are settled!
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {consolidatedCustomerDues.map(grp => {
                          const isCollapsed = Boolean(collapsedKhataKeys[grp.groupKey]);
                          return (
                            <div
                              key={grp.groupKey}
                              className="bg-[#002227]/95 rounded-2xl border border-emerald-400/35 overflow-hidden shadow-lg"
                            >
                              {/* Consolidated Customer Header Banner */}
                              <div className="p-4 bg-gradient-to-r from-[#002B31] to-[#003B43] border-b border-white/15 flex flex-wrap items-center justify-between gap-3">
                                <div
                                  className="cursor-pointer space-y-1"
                                  onClick={() => toggleKhataCardExpand(grp.groupKey)}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-base font-black text-white hover:text-yellow-300 underline">
                                      {grp.customer_name}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#FF6B3D] text-white">
                                      {grp.bills.length} Outstanding {grp.bills.length === 1 ? 'Bill' : 'Bills'}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                                      Total Due: PKR {pkr(grp.total_remaining).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-200 font-mono flex flex-wrap gap-x-3 gap-y-0.5">
                                    <span>ID: {grp.customer_code}</span>
                                    <span>• City: <strong className="text-white">{grp.city}</strong></span>
                                    <span>• Group: <strong className="text-yellow-300">{grp.group_name}</strong></span>
                                    {grp.phone && <span>• Ph: {grp.phone}</span>}
                                    {grp.cnic && <span>• CNIC: {grp.cnic}</span>}
                                  </div>
                                </div>

                                {/* Consolidated Customer Action Menu */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openCustomerAllocationModal(grp.customer_id, grp.total_remaining)}
                                    className="btn-primary px-3.5 py-2 text-xs"
                                    title="Clear all or selected bills for this customer in one payment"
                                  >
                                    Clear All / Select Bills (PKR {pkr(grp.total_remaining).toLocaleString()})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openCustomer360(grp.customer_id)}
                                    className="btn-secondary px-2.5 py-2 text-[11px]"
                                    title="View 360° Customer Statement & Payment History"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> 360° History
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleKhataCardExpand(grp.groupKey)}
                                    className="bg-slate-800 hover:bg-slate-700 text-yellow-300 px-2.5 py-2 rounded-xl text-[11px] font-bold border border-white/15"
                                  >
                                    {isCollapsed ? `Show ${grp.bills.length} Bills ▼` : 'Hide Bills ▲'}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Individual Bills List for This Customer */}
                              {!isCollapsed && (
                                <div className="p-3.5 space-y-2.5 bg-slate-950/50">
                                  {grp.bills.map((b, idx) => (
                                    <div
                                      key={b.id}
                                      className="bg-slate-900/95 p-3.5 rounded-xl border border-white/15 space-y-2.5"
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="space-y-0.5">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[11px] font-extrabold text-slate-400">
                                              Bill #{idx + 1}:
                                            </span>
                                            <span className="font-mono text-xs font-black text-yellow-300">
                                              {b.invoice_number}
                                            </span>
                                            <span className="text-[11px] font-mono text-slate-300">
                                              • Date: {formatRecordDateTimePkt(b.invoice_date)}
                                            </span>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                                              {b.payment_status}
                                            </span>
                                          </div>
                                          <div className="text-xs text-slate-200">{b.items_summary}</div>
                                          {b.remarks && (
                                            <div className="text-[11px] font-mono text-emerald-300/90">
                                              History / Note: {b.remarks}
                                            </div>
                                          )}
                                        </div>

                                        {/* Per-Bill Options Toolbar */}
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPartialModal({
                                                kind: 'SALE',
                                                id: b.id,
                                                refNumber: b.invoice_number,
                                                partyName: grp.customer_name,
                                                totalAmount: pkr(b.total_amount),
                                                alreadyPaid: pkr(b.received_amount),
                                                remainingBalance: pkr(b.receivable_amount)
                                              })
                                            }
                                            className="btn-oil px-2.5 py-1 text-[11px]"
                                            title="Record Partial Installment on This Bill"
                                          >
                                            Partial Payment
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPartialAmount(String(pkr(b.receivable_amount)));
                                              setPartialModal({
                                                kind: 'SALE',
                                                id: b.id,
                                                refNumber: b.invoice_number,
                                                partyName: grp.customer_name,
                                                totalAmount: pkr(b.total_amount),
                                                alreadyPaid: pkr(b.received_amount),
                                                remainingBalance: pkr(b.receivable_amount)
                                              });
                                            }}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-full text-[11px] font-extrabold shadow"
                                            title="Clear This Single Bill in Full"
                                          >
                                            ✓ Clear Bill (PKR {pkr(b.receivable_amount).toLocaleString()})
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setInvoiceModal({ kind: 'SALE', sale: b })}
                                            className="btn-secondary px-2.5 py-1 text-[11px]"
                                            title="View, Print or Download Invoice"
                                          >
                                            <Printer className="w-3 h-3" /> View / Print Bill
                                          </button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-[11px] tabular-nums">
                                        <div>
                                          <span className="text-slate-400">Original Bill:</span>{' '}
                                          <strong className="text-white">PKR {pkr(b.total_amount).toLocaleString()}</strong>
                                        </div>
                                        <div>
                                          <span className="text-slate-400">Already Paid:</span>{' '}
                                          <strong className="text-emerald-300">PKR {pkr(b.received_amount).toLocaleString()}</strong>
                                        </div>
                                        <div className="text-right">
                                          <span className="text-slate-400">Remaining Due:</span>{' '}
                                          <strong className="text-rose-400 text-xs">PKR {pkr(b.receivable_amount).toLocaleString()}</strong>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN: CONSOLIDATED SUPPLIERS & INDIVIDUAL BILLS */}
                  <div className="glass-panel rounded-2xl p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 pb-3">
                      <div>
                        <h3 className="text-sm font-extrabold text-white flex items-center gap-2 samsung-heading heading-reveal">
                          <Truck className="w-4 h-4 text-[#FF6B3D]" /> CONSOLIDATED SUPPLIER PAYABLES ({consolidatedSupplierDues.length} UNIQUE {consolidatedSupplierDues.length === 1 ? 'SUPPLIER' : 'SUPPLIERS'})
                        </h3>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Multiple unpaid purchase bills for the same supplier are grouped together. Settle a single bill or clear all supplier bills in one payment.
                        </p>
                      </div>
                    </div>

                    {consolidatedSupplierDues.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-300">
                        No pending supplier bills. All supplier payables are settled!
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {consolidatedSupplierDues.map(grp => {
                          const isCollapsed = Boolean(collapsedKhataKeys[grp.groupKey]);
                          return (
                            <div
                              key={grp.groupKey}
                              className="bg-[#002227]/95 rounded-2xl border border-[#FF6B3D]/40 overflow-hidden shadow-lg"
                            >
                              {/* Consolidated Supplier Header Banner */}
                              <div className="p-4 bg-gradient-to-r from-[#002B31] to-[#003B43] border-b border-white/15 flex flex-wrap items-center justify-between gap-3">
                                <div
                                  className="cursor-pointer space-y-1"
                                  onClick={() => toggleKhataCardExpand(grp.groupKey)}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-base font-black text-white hover:text-yellow-300 underline">
                                      {grp.supplier_name}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#FF6B3D] text-white">
                                      {grp.bills.length} Outstanding {grp.bills.length === 1 ? 'Bill' : 'Bills'}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-400/40">
                                      Total Payable: PKR {pkr(grp.total_remaining).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-200 font-mono flex flex-wrap gap-x-3 gap-y-0.5">
                                    <span>ID: {grp.supplier_code}</span>
                                    <span>• City: <strong className="text-white">{grp.city}</strong></span>
                                    <span>• Group: <strong className="text-yellow-300">{grp.group_name}</strong></span>
                                    {grp.phone && <span>• Ph: {grp.phone}</span>}
                                    {grp.cnic && <span>• CNIC: {grp.cnic}</span>}
                                  </div>
                                </div>

                                {/* Consolidated Supplier Action Menu */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openSupplierAllocationModal(grp)}
                                    className="btn-oil px-3.5 py-2 text-xs"
                                    title="Clear all or selected bills for this supplier in one consolidated payment"
                                  >
                                    Clear All / Select Bills (PKR {pkr(grp.total_remaining).toLocaleString()})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openSupplier360(grp.supplier_id)}
                                    className="btn-secondary px-2.5 py-2 text-[11px]"
                                    title="View Supplier 360° Bills & History"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> Bills History
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleKhataCardExpand(grp.groupKey)}
                                    className="bg-slate-800 hover:bg-slate-700 text-yellow-300 px-2.5 py-2 rounded-xl text-[11px] font-bold border border-white/15"
                                  >
                                    {isCollapsed ? `Show ${grp.bills.length} Bills ▼` : 'Hide Bills ▲'}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Individual Bills List for This Supplier */}
                              {!isCollapsed && (
                                <div className="p-3.5 space-y-2.5 bg-slate-950/50">
                                  {grp.bills.map((b, idx) => (
                                    <div
                                      key={b.id}
                                      className="bg-slate-900/95 p-3.5 rounded-xl border border-white/15 space-y-2.5"
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="space-y-0.5">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[11px] font-extrabold text-slate-400">
                                              Bill #{idx + 1}:
                                            </span>
                                            <span className="font-mono text-xs font-black text-[#FF6B3D]">
                                              {b.purchase_number}
                                            </span>
                                            <span className="text-[11px] font-mono text-slate-300">
                                              • Date: {formatRecordDateTimePkt(b.invoice_date)}
                                            </span>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                                              {b.payment_status}
                                            </span>
                                          </div>
                                          <div className="text-xs text-slate-200">{b.items_summary}</div>
                                          {b.remarks && (
                                            <div className="text-[11px] font-mono text-emerald-300/90">
                                              History / Note: {b.remarks}
                                            </div>
                                          )}
                                        </div>

                                        {/* Per-Bill Options Toolbar */}
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPartialAmount('');
                                              setPartialModal({
                                                kind: 'PURCHASE',
                                                id: b.id,
                                                refNumber: b.purchase_number,
                                                partyName: grp.supplier_name,
                                                totalAmount: pkr(b.total_amount),
                                                alreadyPaid: pkr(b.paid_amount),
                                                remainingBalance: pkr(b.payable_amount)
                                              });
                                            }}
                                            className="btn-oil px-2.5 py-1 text-[11px]"
                                            title="Record Partial Installment on This Purchase Bill"
                                          >
                                            Partial Payment
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPartialAmount(String(pkr(b.payable_amount)));
                                              setPartialModal({
                                                kind: 'PURCHASE',
                                                id: b.id,
                                                refNumber: b.purchase_number,
                                                partyName: grp.supplier_name,
                                                totalAmount: pkr(b.total_amount),
                                                alreadyPaid: pkr(b.paid_amount),
                                                remainingBalance: pkr(b.payable_amount)
                                              });
                                            }}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-full text-[11px] font-extrabold shadow"
                                            title="Clear This Single Purchase Bill in Full"
                                          >
                                            ✓ Clear Bill (PKR {pkr(b.payable_amount).toLocaleString()})
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setInvoiceModal({ kind: 'PURCHASE', purchase: b })}
                                            className="btn-secondary px-2.5 py-1 text-[11px]"
                                            title="View, Print or Download Purchase Bill"
                                          >
                                            <Printer className="w-3 h-3" /> View / Print Bill
                                          </button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-[11px] tabular-nums">
                                        <div>
                                          <span className="text-slate-400">Original Bill:</span>{' '}
                                          <strong className="text-white">PKR {pkr(b.total_amount).toLocaleString()}</strong>
                                        </div>
                                        <div>
                                          <span className="text-slate-400">Already Paid:</span>{' '}
                                          <strong className="text-emerald-300">PKR {pkr(b.paid_amount).toLocaleString()}</strong>
                                        </div>
                                        <div className="text-right">
                                          <span className="text-slate-400">Remaining Payable:</span>{' '}
                                          <strong className="text-rose-400 text-xs">PKR {pkr(b.payable_amount).toLocaleString()}</strong>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigateTo({ main: 'accounts', accSub: 'purchases' })}
                        className="btn-primary text-xs px-4 py-2"
                      >
                        + Add New Product via Purchase Bill
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateTo({ main: 'inventory', invSub: 'locations_transfer' })}
                        className="btn-oil text-xs px-4 py-2"
                      >
                        Transfer Stock Between Godowns
                      </button>
                    </div>
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
                              <div className="text-[11px] text-[#FF6B3D] font-mono">{p.brand_name} • {p.pack_size} • {p.sku}</div>
                            </td>
                            <td className="font-mono font-bold text-[#F7F7F5]">{p.units_per_carton} Btls / Ctn</td>
                            <td>
                              {(p.locations || []).length === 0 ? (
                                <span className="text-slate-400">0 Btls</span>
                              ) : (
                                <div className="space-y-1">
                                  {(p.locations || []).map(l => (
                                    <div key={l.location_id} className="text-[11px]">
                                      <strong className="text-[#FF6B3D]">{l.location_name}:</strong> {l.cartons} Ctn + {l.loose_bottles} Btl ({l.stock_bottles} Btls)
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
                              <div className="text-slate-200">Buy: <strong className="text-[#FF6B3D]">PKR {pkr(p.carton_purchase_rate).toLocaleString()}/Ctn</strong></div>
                              <div className="text-slate-200">Sale: <strong className="text-emerald-300">PKR {pkr(p.carton_sale_rate).toLocaleString()}/Ctn</strong></div>
                            </td>
                            <td className="font-extrabold text-[#F7F7F5] tabular-nums">
                              PKR {pkr(p.stock_valuation).toLocaleString()}
                            </td>
                            <td className="text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => triggerReverse('PRODUCT', p.id, p.name)}
                                className="btn-danger px-2.5 py-1 text-[11px]"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
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
            {/* Period & Specific Date Selector */}
            <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-white samsung-heading heading-reveal">
                  ATH LUBRICANTS BUSINESS REPORTS & ANALYTICS ({customDate || period.toUpperCase()})
                </h2>
                <p className="text-xs text-[#F7F7F5]/80">
                  Bill-Wise Profit, Product Stock & Profit, Roznamcha Day Book & Route Group Receivables
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { id: 'daily', label: 'Today (Daily)' },
                  { id: 'weekly', label: 'Last 7 Days' },
                  { id: 'monthly', label: 'Monthly (30D)' },
                  { id: 'all', label: 'All-Time' }
                ] as const).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setCustomDate('');
                      setPeriod(p.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold ${
                      !customDate && period === p.id
                        ? 'bg-[#FF6B3D] text-white shadow'
                        : 'bg-[#002B31] text-[#F7F7F5] border border-[#F7F7F5]/20'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 bg-[#002B31] px-3 py-1 rounded-full border border-[#F7F7F5]/25">
                  <span className="text-[11px] font-bold text-[#FF6B3D]">Specific Date:</span>
                  <input
                    type="date"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    className="bg-transparent text-xs font-mono text-white outline-none"
                  />
                  {customDate && (
                    <button
                      type="button"
                      onClick={() => setCustomDate('')}
                      className="text-xs text-rose-400 font-bold ml-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
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

      {/* ==================== MODAL 1: PROFESSIONAL WHITE ATH LUBRICANTS INVOICE (IMAGE, PDF & PRINT) ==================== */}
      {invoiceModal && (
        <div className="fixed inset-0 z-50 bg-[#00181C]/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden animate-modal my-auto border-2 border-[#005B66] bg-white">
            {/* Top Action Toolbar (Official ATH Petrol Teal & Coral Orange Theme) */}
            <div className="bg-gradient-to-r from-[#002227] via-[#00373E] to-[#005B66] px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#FF6B3D] no-print">
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-[#FF6B3D] fill-[#FF6B3D]" />
                <span className="text-xs font-extrabold text-[#F7F7F5] uppercase tracking-wider">
                  ATH Lubricants Official Trade Invoice
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadOrShareInvoiceImage('DOWNLOAD')}
                  className="btn-oil px-3 py-1.5 text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Save Image (PNG)
                </button>
                <button
                  type="button"
                  onClick={() => downloadOrShareInvoiceImage('SHARE')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => printSingleInvoicePdf(false)}
                  className="btn-primary px-3 py-1.5 text-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / PDF (A4)
                </button>
                <button
                  type="button"
                  onClick={() => printSingleInvoicePdf(true)}
                  className="btn-secondary px-3 py-1.5 text-xs"
                >
                  Thermal 80mm
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceModal(null)}
                  className="p-1.5 rounded-full bg-[#00262B] text-[#F7F7F5] hover:bg-[#FF6B3D] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Crisp White Business Invoice Sheet with ATH "Fractured Current" Stripes & Real User Signature */}
            {(() => {
              const isSale = invoiceModal.kind === 'SALE';
              const doc = isSale ? invoiceModal.sale! : invoiceModal.purchase!;
              const refNo = isSale ? (doc as SaleRecord).invoice_number : (doc as PurchaseRecord).purchase_number;
              const docType = (doc as any).doc_type || invoiceModal.kind;
              const partyName = isSale ? (doc as SaleRecord).customer_name : (doc as PurchaseRecord).supplier_name;
              const partyCity = isSale ? (doc as SaleRecord).customer_city : (doc as PurchaseRecord).supplier_city;
              const partyPhone = isSale ? (doc as SaleRecord).customer_phone : (doc as PurchaseRecord).supplier_phone;
              const partyCnic = isSale ? (doc as SaleRecord).customer_cnic : (doc as PurchaseRecord).supplier_cnic;
              const partyGroup = isSale ? (doc as SaleRecord).customer_group : (doc as PurchaseRecord).supplier_group;
              const locSummary = (doc as any).location_summary || (isSale ? 'Shop Display' : 'Main Warehouse');
              const items = (doc.items || []) as any[];
              const sigInfo = resolveInvoiceAuthorizerSignature(doc);

              const sDoc = doc as SaleRecord;
              const pDoc = doc as PurchaseRecord;

              const currentBillTotal = pkr(doc.total_amount);
              const prevDues = isSale ? pkr(sDoc.previous_dues) : pkr(pDoc.previous_dues);
              const grandPay = pkr(currentBillTotal + prevDues);

              const appliedPrev = isSale ? pkr(sDoc.applied_to_previous) : pkr(pDoc.applied_to_previous);
              const rawPaidField = isSale ? pkr(sDoc.received_amount) : pkr(pDoc.paid_amount);
              const billPortionPaid = rawPaidField > currentBillTotal ? currentBillTotal : rawPaidField;
              const recToday = pkr(billPortionPaid + appliedPrev);

              const closingBal = isSale
                ? pkr(sDoc.closing_receivable ?? Math.max(0, grandPay - recToday))
                : pkr(pDoc.closing_payable ?? Math.max(0, grandPay - recToday));

              return (
                <div className="bg-white text-slate-900 p-6 sm:p-10 space-y-6 relative overflow-hidden">
                  {/* Top ATH Petrol Teal & Coral Orange Brand Ribbon */}
                  <div className="h-2.5 w-full rounded-full overflow-hidden flex -mt-2 mb-2">
                    <div className="w-3/5 bg-[#005B66]" />
                    <div className="w-2/5 bg-[#FF6B3D]" />
                  </div>

                  {/* Row 1: Bold INVOICE Title + Company Identity (Left) & Official ATH Logo (Right) */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[#00262B] leading-none">
                        INVOICE
                      </h1>
                      <div className="mt-2 text-sm font-extrabold text-[#005B66] uppercase tracking-wide">
                        ATH Lubricants • Awan Trade Hub
                      </div>
                      <div className="text-xs text-slate-600 font-medium">
                        Gold 4T Series (M2 / M4 SAE 20W-40 API SL) — Smoother Ride | Better Protection | Longer Life
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-[#F7F7F5] px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
                      <img
                        src="/logo.png"
                        alt="ATH Lubricants"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        className="h-12 sm:h-14 w-auto object-contain"
                      />
                    </div>
                  </div>

                  {/* Row 2: 3-Column Structured Meta Info (BILL TO | SHIP/DISPATCH TO | INVOICE DETAILS) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 text-xs">
                    <div className="space-y-1">
                      <div className="text-xs font-black uppercase tracking-wider text-[#00262B]">
                        {isSale ? 'BILL TO' : 'SUPPLIER / VENDOR'}
                      </div>
                      <div className="text-base font-extrabold text-slate-950">
                        {partyName}
                      </div>
                      <div className="text-slate-700 font-medium">
                        City / Village: <strong className="text-slate-900">{partyCity || 'Local'}</strong>
                      </div>
                      <div className="text-slate-700">
                        Route / Group: <strong className="text-[#005B66]">{partyGroup || 'General'}</strong>
                      </div>
                      <div className="text-slate-600 font-mono">
                        Phone: {partyPhone || 'N/A'}
                      </div>
                      <div className="text-slate-600 font-mono">
                        CNIC: {partyCnic || 'N/A'}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-black uppercase tracking-wider text-[#00262B]">
                        {isSale ? 'SHIP / DISPATCH FROM' : 'RECEIVING GODOWN'}
                      </div>
                      <div className="text-sm font-extrabold text-slate-950">
                        {locSummary}
                      </div>
                      <div className="text-slate-700">
                        Payment Channel: <strong className="text-slate-900">{doc.payment_method}</strong>
                      </div>
                      <div className="text-slate-700">
                        Document Type: <strong className="text-[#005B66]">{docType}</strong>
                      </div>
                      <div className="text-slate-600">
                        Remarks: {doc.remarks || 'Standard Trade Bill'}
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:text-right">
                      <div className="flex sm:justify-end justify-between gap-4">
                        <span className="font-black uppercase text-[#00262B]">INVOICE #</span>
                        <span className="font-mono font-extrabold text-[#FF6B3D] text-sm">{refNo}</span>
                      </div>
                      <div className="flex sm:justify-end justify-between gap-4">
                        <span className="font-black uppercase text-[#00262B]">INVOICE DATE</span>
                        <span className="font-mono text-slate-800 font-semibold">{formatRecordDateTimePkt(doc.invoice_date)}</span>
                      </div>
                      <div className="flex sm:justify-end justify-between gap-4">
                        <span className="font-black uppercase text-[#00262B]">STATUS</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {doc.payment_status}
                        </span>
                      </div>
                      <div className="flex sm:justify-end justify-between gap-4">
                        <span className="font-black uppercase text-[#00262B]">AUTHORIZED BY</span>
                        <span className="font-bold text-[#005B66]">{sigInfo.fullName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Star Divider + Coral-Orange Bordered Table */}
                  <div className="pt-1">
                    <div
                      className="text-[11px] text-[#005B66] tracking-[0.28em] overflow-hidden whitespace-nowrap font-bold select-none mb-1.5"
                      aria-hidden="true"
                    >
                      ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-y-2 border-[#FF6B3D] text-[#00262B] font-black uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-28">QTY</th>
                            <th className="py-2.5 px-3">DESCRIPTION & PACK SIZE</th>
                            <th className="py-2.5 px-3 text-right w-36">UNIT PRICE</th>
                            <th className="py-2.5 px-3 text-right w-40">AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {items.map((it, idx) => (
                            <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/80' : 'bg-white'}>
                              <td className="py-3 px-3 font-mono font-extrabold text-slate-900">
                                {it.quantity} {it.unit_type}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-extrabold text-[#00262B] text-sm">
                                  {idx + 1}. {it.product_name} ({it.pack_size || '700 ML'})
                                </div>
                                <div className="text-[11px] text-slate-600 font-medium">
                                  {it.company_name || 'ATH Oils'} • {it.base_quantity} Bottles ({it.cartons} Ctn + {it.loose_bottles} Btl) • {it.location_name}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-slate-800 font-semibold tabular-nums">
                                PKR {pkr(it.unit_rate).toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-950 text-sm tabular-nums">
                                PKR {pkr(it.line_total).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Row 4: Right-Aligned Financial Totals */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
                    <div className="text-xs text-slate-600 space-y-1 max-w-sm">
                      {appliedPrev > 0 && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-mono text-[11px]">
                          <strong>Payment Allocation Breakdown:</strong> PKR {billPortionPaid.toLocaleString()} allocated to this bill + PKR {appliedPrev.toLocaleString()} settled on Previous Khata bills.
                        </div>
                      )}
                    </div>

                    <div className="w-full sm:w-96 space-y-2 text-xs tabular-nums">
                      <div className="flex justify-between text-slate-800 font-bold text-sm">
                        <span>Current Bill Total</span>
                        <span className="font-mono">PKR {currentBillTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-amber-700 font-semibold">
                        <span>+ Previous Balance (Old Khata)</span>
                        <span className="font-mono">PKR {prevDues.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[#00262B] font-extrabold border-t border-slate-300 pt-1.5 text-sm">
                        <span>= Total Payable Amount</span>
                        <span className="font-mono">PKR {grandPay.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-extrabold">
                        <span>- {isSale ? 'Received Today' : 'Paid Today'} ({doc.payment_method})</span>
                        <span className="font-mono">PKR {recToday.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-[#FF6B3D] font-black text-lg border-t-2 border-[#00262B] pt-2">
                        <span className="text-[#00262B] text-sm uppercase tracking-wide">
                          {isSale ? 'Net Closing Khata' : 'Net Closing Payable'}
                        </span>
                        <span className="font-mono">PKR {closingBal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 5: ATH "Fractured Current" Flowing Stripes Watermark + Authenticated User Cursive Signature */}
                  <div className="relative pt-6 pb-2 min-h-[135px] flex items-end justify-end">
                    {/* ATH Fractured Current SVG Pattern (Petrol Teal #005B66, Coral Orange #FF6B3D & Dynamic Oil Droplets) */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 800 140"
                      fill="none"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M -10 115 C 220 25, 480 20, 810 85"
                        stroke="#005B66"
                        strokeOpacity="0.14"
                        strokeWidth="24"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 10 128 C 250 42, 510 38, 810 100"
                        stroke="#FF6B3D"
                        strokeOpacity="0.28"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 40 136 C 280 58, 540 52, 810 114"
                        stroke="#005B66"
                        strokeOpacity="0.25"
                        strokeWidth="5"
                        strokeDasharray="16 14"
                        strokeLinecap="round"
                      />
                      <path
                        d="M -10 95 C 200 10, 460 12, 810 68"
                        stroke="#FF6B3D"
                        strokeOpacity="0.16"
                        strokeWidth="12"
                        strokeLinecap="round"
                      />
                      <circle cx="150" cy="74" r="6" fill="#FF6B3D" fillOpacity="0.75" />
                      <circle cx="285" cy="52" r="4.5" fill="#005B66" fillOpacity="0.7" />
                      <circle cx="420" cy="58" r="7" fill="#FF6B3D" fillOpacity="0.75" />
                      <circle cx="545" cy="48" r="5" fill="#005B66" fillOpacity="0.7" />
                    </svg>

                    {/* Authenticated User Handwritten Signature Block */}
                    <div className="relative z-10 w-64 sm:w-72 text-center ml-auto pr-2">
                      <div
                        className="text-2xl sm:text-3xl font-bold italic text-[#00262B] select-none leading-tight"
                        style={{
                          fontFamily: '"Segoe Script", "Brush Script MT", "Lucida Handwriting", Georgia, cursive'
                        }}
                      >
                        {sigInfo.signatureText}
                      </div>
                      <div className="border-t-2 border-[#005B66] mt-1 pt-1 text-[11px] font-black uppercase tracking-wider text-[#005B66]">
                        Authorized Signature • {sigInfo.fullName}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        Verified By: {sigInfo.roleLabel}
                      </div>
                    </div>
                  </div>

                  {/* Row 6: Footer ("Thank you" | TERMS & CONDITIONS) */}
                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                    <div
                      className="text-3xl sm:text-4xl font-bold italic text-[#00262B] sm:border-r-2 sm:border-[#005B66] sm:pr-6 shrink-0"
                      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                    >
                      Thank you
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <div className="font-black uppercase tracking-wider text-[#FF6B3D]">
                        TERMS & CONDITIONS
                      </div>
                      <div className="text-slate-700 font-medium">
                        100% Whole-PKR Computerized Trade Bill • Smoother Ride | Better Protection | Longer Life
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Please quote Invoice # <strong className="text-slate-800 font-mono">{refNo}</strong> on all payments and correspondence with ATH Lubricants (Awan Trade Hub).
                      </div>
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

      {/* ==================== MODAL: CONSOLIDATED SUPPLIER MULTI-BILL PAYMENT ALLOCATION ==================== */}
      {supplierAllocationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto no-print">
          <div className="glass-panel max-w-5xl w-full rounded-2xl p-5 sm:p-6 space-y-5 border border-[#FF6B3D]/60 animate-modal my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-[#FF6B3D] text-white font-extrabold">
                  Consolidated Supplier Multi-Bill Settlement
                </span>
                <h3 className="text-lg font-black text-white mt-1">
                  {supplierAllocationModal.supplier_name} ({supplierAllocationModal.city}) —{' '}
                  <span className="text-yellow-300 font-mono">{supplierAllocationModal.supplier_code}</span>
                </h3>
                <p className="text-xs text-slate-200">
                  Group: {supplierAllocationModal.group_name} • Phone: {supplierAllocationModal.phone || 'N/A'} • CNIC: {supplierAllocationModal.cnic || 'N/A'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSupplierAllocationModal(null);
                  setSupAllocConfirming(false);
                  setSupAllocError('');
                }}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                <X className="w-4 h-4" /> Close Window
              </button>
            </div>

            {(() => {
              const bills = supplierAllocationModal.bills || [];
              const totalOutBefore = pkr(supplierAllocationModal.total_outstanding);
              const enteredPay = pkr(supAllocPaymentInput);
              const totalAllocatedNow = bills.reduce((s, b) => s + pkr(supAllocDraftMap[b.id] || 0), 0);
              const projectedRemAfter = pkr(Math.max(0, totalOutBefore - totalAllocatedNow));

              return (
                <div className="space-y-4">
                  {/* Top Summary Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-white/15">
                      <div className="text-slate-300 font-semibold">Total Payable Before</div>
                      <div className="text-xl font-black text-rose-400 tabular-nums mt-1">
                        PKR {totalOutBefore.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-400">{bills.length} Unpaid Purchase Bill(s)</div>
                    </div>
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-yellow-400/40">
                      <div className="text-yellow-300 font-semibold">Payment Amount</div>
                      <div className="text-xl font-black text-yellow-300 tabular-nums mt-1">
                        PKR {enteredPay.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-300">Selected Bills Settlement</div>
                    </div>
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-emerald-400/40">
                      <div className="text-emerald-300 font-semibold">Allocated Across Bills</div>
                      <div className="text-xl font-black text-emerald-300 tabular-nums mt-1">
                        PKR {totalAllocatedNow.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-300">
                        {bills.filter(b => pkr(supAllocDraftMap[b.id] || 0) > 0).length} Bill(s) Being Settled
                      </div>
                    </div>
                    <div className="bg-slate-900/90 p-3.5 rounded-xl border border-white/20">
                      <div className="text-white font-semibold">Remaining Payable After</div>
                      <div className="text-xl font-black text-white tabular-nums mt-1">
                        PKR {projectedRemAfter.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-amber-300 font-bold">
                        PKR {projectedRemAfter.toLocaleString()} will remain payable
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="bg-slate-900/90 p-4 rounded-xl border border-white/15 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-yellow-300 font-bold">1. Total Payment to Supplier (PKR)</label>
                        <input
                          type="number"
                          placeholder="Enter PKR amount"
                          value={supAllocPaymentInput}
                          onChange={e => handleSupAllocInputChange(e.target.value, supAllocPolicy)}
                          className="mt-1 erp-input font-extrabold text-emerald-300"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white font-semibold">2. Allocation Rule</label>
                        <select
                          value={supAllocPolicy}
                          onChange={e =>
                            handleSupAllocInputChange(
                              supAllocPaymentInput,
                              e.target.value as 'OLDEST_FIRST' | 'NEWEST_FIRST'
                            )
                          }
                          className="mt-1 erp-input font-bold text-yellow-300"
                        >
                          <option value="OLDEST_FIRST">Oldest Bill First (FIFO)</option>
                          <option value="NEWEST_FIRST">Newest Bill First</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-white font-semibold">3. Payment Account</label>
                        <select
                          value={supAllocAccountId}
                          onChange={e => setSupAllocAccountId(Number(e.target.value))}
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
                        <label className="text-xs text-white font-semibold">4. Payment Arrangement</label>
                        <select
                          value={supAllocArrangement}
                          onChange={e => setSupAllocArrangement(e.target.value as PaymentArrangementType)}
                          className="mt-1 erp-input font-bold text-yellow-300"
                        >
                          <option value="WALLET">Deduct from Account</option>
                          <option value="OWNER_CAPITAL">Owner Pocket / Capital</option>
                          <option value="MARKET_LOAN">Market Loan / Udhaar</option>
                        </select>
                      </div>
                    </div>

                    {supAllocArrangement !== 'WALLET' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Lender / Owner Name (e.g. Owner Pocket Capital)"
                          value={supAllocLenderName}
                          onChange={e => setSupAllocLenderName(e.target.value)}
                          className="erp-input"
                        />
                        <input
                          type="text"
                          placeholder="Payment Remarks / Reference"
                          value={supAllocRemarks}
                          onChange={e => setSupAllocRemarks(e.target.value)}
                          className="erp-input"
                        />
                      </div>
                    )}

                    {/* Bill Selection & Allocation Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs erp-table">
                        <thead>
                          <tr>
                            <th>Select</th>
                            <th>Purchase Bill #</th>
                            <th>Date</th>
                            <th className="text-right">Original Bill</th>
                            <th className="text-right">Already Paid</th>
                            <th className="text-right">Payable Before</th>
                            <th className="text-right">Allocated Now (PKR)</th>
                            <th className="text-right">Remaining After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bills.map(b => {
                            const allocVal = pkr(supAllocDraftMap[b.id] || 0);
                            const remAfter = pkr(Math.max(0, pkr(b.payable_amount) - allocVal));
                            const isChecked = supAllocSelectedMap[b.id] !== false;
                            return (
                              <tr key={b.id}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleSupBillSelection(b.id)}
                                    className="w-4 h-4 accent-yellow-400 cursor-pointer"
                                  />
                                </td>
                                <td className="font-mono font-bold text-[#FF6B3D]">
                                  {b.purchase_number}
                                  <div className="text-[10px] text-slate-300 font-sans">{b.items_summary}</div>
                                </td>
                                <td className="font-mono text-slate-200">{formatRecordDateTimePkt(b.invoice_date)}</td>
                                <td className="text-right font-mono">PKR {pkr(b.total_amount).toLocaleString()}</td>
                                <td className="text-right font-mono text-emerald-300">PKR {pkr(b.paid_amount).toLocaleString()}</td>
                                <td className="text-right font-mono font-bold text-rose-300">PKR {pkr(b.payable_amount).toLocaleString()}</td>
                                <td className="text-right w-44">
                                  <input
                                    type="number"
                                    min={0}
                                    max={pkr(b.payable_amount)}
                                    value={allocVal}
                                    onChange={e => {
                                      const val = Math.max(0, Math.min(pkr(b.payable_amount), pkr(e.target.value)));
                                      const nextMap = { ...supAllocDraftMap, [b.id]: val };
                                      setSupAllocDraftMap(nextMap);
                                      const newSum = Object.values(nextMap).reduce((s, v) => s + pkr(v), 0);
                                      setSupAllocPaymentInput(String(newSum));
                                      setSupAllocConfirming(false);
                                    }}
                                    className="erp-input py-1 px-2 text-right font-mono font-extrabold text-yellow-300"
                                  />
                                </td>
                                <td className="text-right font-mono font-extrabold text-white">
                                  PKR {remAfter.toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {supAllocError && (
                      <div className="p-3 rounded-xl bg-rose-950 border border-rose-500 text-xs text-rose-200 font-bold">
                        {supAllocError}
                      </div>
                    )}

                    {!supAllocConfirming ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="text-xs text-slate-200">
                          Allocating <strong className="text-emerald-300">PKR {totalAllocatedNow.toLocaleString()}</strong> across selected bills.{' '}
                          <strong className="text-yellow-300">PKR {projectedRemAfter.toLocaleString()}</strong> will remain payable afterward.
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSupplierAllocationModal(null)}
                            className="btn-secondary px-4 py-2 text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={totalAllocatedNow <= 0}
                            onClick={() => setSupAllocConfirming(true)}
                            className="btn-primary px-5 py-2.5 text-xs uppercase"
                          >
                            Review & Confirm Supplier Payment →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-emerald-950/90 border-2 border-emerald-400 space-y-3 animate-fade-in">
                        <div className="text-xs font-extrabold text-emerald-300 uppercase">
                          Confirm Consolidated Supplier Settlement
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-white">
                          <div>Supplier: <strong>{supplierAllocationModal.supplier_name}</strong></div>
                          <div>Total Paying Now: <strong className="text-emerald-300">PKR {totalAllocatedNow.toLocaleString()}</strong></div>
                          <div>Remaining Payable After: <strong className="text-rose-300">PKR {projectedRemAfter.toLocaleString()}</strong></div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            disabled={supAllocBusy}
                            onClick={() => setSupAllocConfirming(false)}
                            className="btn-secondary px-4 py-2 text-xs"
                          >
                            Back / Edit
                          </button>
                          <button
                            type="button"
                            disabled={supAllocBusy}
                            onClick={handleExecuteSupplierConsolidatedPayment}
                            className="btn-oil px-6 py-2.5 text-xs uppercase"
                          >
                            {supAllocBusy ? 'Posting Payments...' : 'Confirm & Settle Selected Bills'}
                          </button>
                        </div>
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
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#002227]/95 backdrop-blur-2xl border-t border-[#F7F7F5]/20 grid grid-cols-5 py-1.5 px-1.5 text-[10px] font-bold no-print shadow-2xl mobile-bottom-nav">
        <button
          type="button"
          onClick={() => navigateTo({ main: 'dashboard' })}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition ${
            currentNav.main === 'dashboard'
              ? 'bg-[#FF6B3D] text-white font-extrabold shadow'
              : 'text-[#F7F7F5]/75 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          onClick={() => navigateTo({ main: 'accounts' })}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition ${
            currentNav.main === 'accounts'
              ? 'bg-[#FF6B3D] text-white font-extrabold shadow'
              : 'text-[#F7F7F5]/75 hover:text-white'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Billing</span>
        </button>
        <button
          type="button"
          onClick={() => navigateTo({ main: 'inventory' })}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition ${
            currentNav.main === 'inventory'
              ? 'bg-[#FF6B3D] text-white font-extrabold shadow'
              : 'text-[#F7F7F5]/75 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Godowns</span>
        </button>
        <button
          type="button"
          onClick={() => navigateTo({ main: 'directory' })}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition ${
            currentNav.main === 'directory'
              ? 'bg-[#FF6B3D] text-white font-extrabold shadow'
              : 'text-[#F7F7F5]/75 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Parties</span>
        </button>
        <button
          type="button"
          onClick={() => navigateTo({ main: 'reports' })}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition ${
            currentNav.main === 'reports'
              ? 'bg-[#FF6B3D] text-white font-extrabold shadow'
              : 'text-[#F7F7F5]/75 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Reports</span>
        </button>
      </div>
    </div>
  );
}



