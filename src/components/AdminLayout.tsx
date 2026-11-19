import React, { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  LayoutTemplate,
  CalendarCheck,
  Image,
  Package,
  Users,
  MessageSquareQuote,
  FileText,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Loader2,
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';

const ADMIN_NAV = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Homepage', to: '/admin/homepage', icon: LayoutTemplate },
  { label: 'Bookings', to: '/admin/bookings', icon: CalendarCheck },
  { label: 'Invoice Management', to: '/admin/invoices', icon: FileText },
  { label: 'Portfolio', to: '/admin/portfolio', icon: Image },
  { label: 'Packages', to: '/admin/packages', icon: Package },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Couple Notes', to: '/admin/couple-notes', icon: MessageSquareQuote },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
];

export function RequireAdmin({ children }: { children?: React.ReactNode }) {
  const { user, isAdmin, authReady } = useFirebase();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F5F1E9] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm font-mono text-[#171717]/75">
          <Loader2 className="w-5 h-5 animate-spin" />
          Verifying admin session...
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}

export function AdminLayout({ children }: { children?: React.ReactNode }) {
  const { user, signOutAdmin } = useFirebase();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentNav = ADMIN_NAV.find((n) => location.pathname.startsWith(n.to));

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#171717] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-[#171717] text-white shrink-0 border-r border-[#171717]">
        <div className="h-16 px-6 flex items-center justify-between border-b border-white/10">
          <Link to="/admin/dashboard" className="font-display text-lg font-extrabold tracking-tight">
            UNSCRIPTED
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#D8FF3E]">
            Admin
          </span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#D8FF3E] text-[#171717] font-semibold'
                      : 'text-white/75 hover:text-white hover:bg-white/8'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <Link
            to="/"
            className="flex items-center justify-between px-3 py-2 text-xs text-white/75 hover:text-white border border-white/15 hover:border-white/40 transition-colors"
          >
            <span>Public Website</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <div className="px-1">
            <p className="text-xs font-medium text-white truncate">
              {user?.displayName || 'Administrator'}
            </p>
            <p className="text-[11px] font-mono text-white/55 truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => signOutAdmin()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white/80 hover:text-white bg-white/8 hover:bg-[#FF5A55] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#171717] text-white flex flex-col z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
              <span className="font-display text-lg font-extrabold">UNSCRIPTED</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 text-white/75 hover:text-white cursor-pointer"
                aria-label="Close admin sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {ADMIN_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium ${
                        isActive
                          ? 'bg-[#D8FF3E] text-[#171717] font-semibold'
                          : 'text-white/75 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10 space-y-2">
              <Link
                to="/"
                className="flex items-center justify-between px-3 py-2 text-xs text-white/80 border border-white/15"
              >
                <span>Public Website</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => signOutAdmin()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-[#FF5A55] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-[#171717]/12 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 border border-[#171717]/15 text-[#171717] cursor-pointer"
              aria-label="Open admin menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-[#171717]/55 truncate">
              <span>Admin</span>
              <span aria-hidden="true">/</span>
              <span className="text-[#171717] font-semibold">
                {currentNav?.label || 'Workspace'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/booking"
              className="px-3.5 py-1.5 border border-[#171717]/20 text-xs font-semibold hover:border-[#171717] transition-colors whitespace-nowrap shrink-0"
            >
              View Booking Form
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
