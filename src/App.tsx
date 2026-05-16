import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const PortfolioPage = lazy(() => import("@/pages/PortfolioPage"));
const MutualFundsPage = lazy(() => import("@/pages/MutualFundsPage"));
const ResearchPage = lazy(() => import("@/pages/ResearchPage"));
const WatchlistPage = lazy(() => import("@/pages/WatchlistPage"));
const ScreenerPage = lazy(() => import("@/pages/ScreenerPage"));
const MarketPage = lazy(() => import("@/pages/MarketPage"));
const AlertsPage = lazy(() => import("@/pages/AlertsPage"));
const LearnPage = lazy(() => import("@/pages/LearnPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const PnLPage = lazy(() => import("@/pages/PnLPage"));
const StockDetailPage = lazy(() => import("@/pages/stocks/StockDetailPage"));
const MFDetailPage = lazy(() => import("@/pages/mf/MFDetailPage"));
const MFComparePage = lazy(() => import("@/pages/mf/MFComparePage"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route
              path="/"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route
              path="/portfolio"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <PortfolioPage />
                </Suspense>
              }
            />
            <Route
              path="/pnl"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <PnLPage />
                </Suspense>
              }
            />
            <Route
              path="/mutual-funds"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <MutualFundsPage />
                </Suspense>
              }
            />
            <Route
              path="/research"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <ResearchPage />
                </Suspense>
              }
            />
            <Route
              path="/watchlist"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <WatchlistPage />
                </Suspense>
              }
            />
            <Route
              path="/screener"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <ScreenerPage />
                </Suspense>
              }
            />
            <Route
              path="/market"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <MarketPage />
                </Suspense>
              }
            />
            <Route
              path="/alerts"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <AlertsPage />
                </Suspense>
              }
            />
            <Route
              path="/learn"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <LearnPage />
                </Suspense>
              }
            />
            <Route
              path="/settings"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <SettingsPage />
                </Suspense>
              }
            />
            <Route
              path="/profile"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <ProfilePage />
                </Suspense>
              }
            />
            <Route
              path="/stocks/:symbol"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <StockDetailPage />
                </Suspense>
              }
            />
            <Route
              path="/mf/compare"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <MFComparePage />
                </Suspense>
              }
            />
            <Route
              path="/mf/:schemeCode"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <MFDetailPage />
                </Suspense>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
