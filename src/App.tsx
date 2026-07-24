import { Suspense, lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import AppShell from "./components/AppShell"
import AccountPage from "./pages/AccountPage"
import DepositsPage from "./pages/DepositsPage"
import ExpensesPage from "./pages/ExpensesPage"
import HistoryPage from "./pages/HistoryPage"
import LoginPage from "./pages/LoginPage"

// Route-split so the rest of the app does not pay for the chart library
const DashboardPage = lazy(() => import("./pages/DashboardPage"))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-[100dvh]" aria-busy="true" />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/deposits" element={<DepositsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/account" element={<AccountPage />} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
