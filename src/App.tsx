/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { FirebaseProvider } from './context/FirebaseContext';
import { PublicLayout } from './components/PublicLayout';
import { AdminLayout, RequireAdmin } from './components/AdminLayout';

import { HomePage } from './pages/public/HomePage';
import { AboutPage } from './pages/public/AboutPage';
import { ServicesPage } from './pages/public/ServicesPage';
import { PortfolioPage } from './pages/public/PortfolioPage';
import { PortfolioDetailPage } from './pages/public/PortfolioDetailPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { BookingPage } from './pages/public/BookingPage';
import { ContactPage } from './pages/public/ContactPage';

import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminBookingsPage } from './pages/admin/AdminBookingsPage';
import { AdminPortfolioPage } from './pages/admin/AdminPortfolioPage';
import { AdminPackagesPage } from './pages/admin/AdminPackagesPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminCoupleNotesPage } from './pages/admin/AdminCoupleNotesPage';
import { AdminHomepagePage } from './pages/admin/AdminHomepagePage';
import { AdminInvoicesPage } from './pages/admin/AdminInvoicesPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#FF5A55] mb-3">
        404 · Page Not Found
      </p>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">
        This page does not exist.
      </h1>
      <p className="mt-3 text-sm text-[#171717]/70">
        Return to the UNSCRIPTED homepage or explore our portfolio and services.
      </p>
      <Link
        to="/"
        className="mt-8 inline-block px-6 py-3 bg-[#171717] text-white text-sm font-semibold hover:bg-[#D8FF3E] hover:text-[#171717] transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <FirebaseProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              {/* Public Website Routes */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/portfolio/:slug" element={<PortfolioDetailPage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/booking" element={<BookingPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>

              {/* Admin Authentication */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

              {/* Protected Admin Routes */}
              <Route
                element={
                  <RequireAdmin>
                    <AdminLayout />
                  </RequireAdmin>
                }
              >
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                <Route path="/admin/homepage" element={<AdminHomepagePage />} />
                <Route path="/admin/bookings" element={<AdminBookingsPage />} />
                <Route path="/admin/invoices" element={<AdminInvoicesPage />} />
                <Route path="/admin/portfolio" element={<AdminPortfolioPage />} />
                <Route path="/admin/packages" element={<AdminPackagesPage />} />
                <Route path="/admin/customers" element={<AdminCustomersPage />} />
                <Route path="/admin/couple-notes" element={<AdminCoupleNotesPage />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </FirebaseProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
