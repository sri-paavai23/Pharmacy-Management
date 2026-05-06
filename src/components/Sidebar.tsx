'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingCart,
  Package, 
  LineChart, 
  Truck,
  Users,
  Activity,
  ShoppingBag,
  RotateCcw,
  Settings,
  BookOpen,
  Library,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from './SettingsProvider';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'POS', href: '/pos', icon: ShoppingCart },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Purchases', href: '/purchases', icon: ShoppingBag },
  { name: 'Counter Sale', href: '/counter-sale', icon: BookOpen },
  { name: 'History', href: '/history', icon: Clock },
  { name: 'Ledger Masters', href: '/accounting/masters', icon: Library },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Returns', href: '/returns', icon: RotateCcw },
  { name: 'Courier Process', href: '/senior-care', icon: Truck },
  { name: 'Reports', href: '/reports', icon: LineChart },
  { name: 'Settings', href: '/settings', icon: Settings },
];




export function Sidebar() {
  const pathname = usePathname();
  const { settings } = useSettings();
  const pharmacyName = settings.pharmacyName;

  // Split name for visual styling if it's long
  const nameParts = (pharmacyName || "Shree Velammal Pharmacy").split(' ');
  const firstPart = nameParts.slice(0, -1).join(' ');
  const lastPart = nameParts[nameParts.length - 1];

  return (
    <div className="flex bg-white flex-col w-64 border-r border-border h-full shadow-sm">
      <div className="p-6 shrink-0 flex items-center gap-3">
        <div className="bg-primary p-2 rounded-lg text-primary-foreground">
          <Activity className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-black text-slate-800 leading-none tracking-tight uppercase">
          {firstPart && <span className="text-xs font-bold text-slate-400 block tracking-widest mb-1">{firstPart}</span>}
          {lastPart}
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (pathname === '/' && item.href === '/dashboard');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border/60">
        <p className="text-xs text-center text-slate-400">
          VPMS v1.0 • Salem, TN
        </p>
      </div>
    </div>
  );
}
