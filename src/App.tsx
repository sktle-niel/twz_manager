import { Suspense, lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import AppShell from "./components/AppShell"
import AdminShell from "./components/AdminShell"
import { RequireManager, RequireOwner } from "./components/RequireRole"
import { ScrollToTop } from "./components/ScrollToTop"
import { SessionProvider } from "./components/SessionProvider"
import { ToastProvider } from "./components/ToastProvider"
import AccountPage from "./pages/AccountPage"
import DepositsPage from "./pages/DepositsPage"
import ExpensesPage from "./pages/ExpensesPage"
import HistoryPage from "./pages/HistoryPage"
import LoginPage from "./pages/LoginPage"
import AdminHistoryPage from "./pages/AdminHistoryPage"
import AdminManagersPage from "./pages/AdminManagersPage"
import AdminSettingsPage from "./pages/AdminSettingsPage"
import AdminAccountPage from "./pages/AdminAccountPage"

// Route-split so the rest of the app does not pay for the chart library
const DashboardPage = lazy(() => import("./pages/DashboardPage"))
const AdminOverviewPage = lazy(() => import("./pages/AdminOverviewPage"))

function App() {
  return (
    <BrowserRouter>
      {/* Above the routes so it covers both shells and the login page at once */}
      <ScrollToTop />
      <ToastProvider>
        <SessionProvider>
        <Suspense fallback={<div className="min-h-[100dvh]" aria-busy="true" />}>
          <Routes>
          {/* Who may enter which side is the guards' decision, not the URL's */}
          <Route element={<RequireManager />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/deposits" element={<DepositsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Route>
          </Route>
          <Route path="/admin" element={<RequireOwner />}>
            <Route element={<AdminShell />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="history" element={<AdminHistoryPage />} />
              <Route path="managers" element={<AdminManagersPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
              <Route path="account" element={<AdminAccountPage />} />
            </Route>
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </SessionProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
