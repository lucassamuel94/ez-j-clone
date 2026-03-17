import { lazy, Suspense, useState } from "react"; // perf-audit-v2

import { Navigate } from "react-router-dom";
import LoaderScreen from "@/components/LoaderScreen";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { WebPhoneProvider } from "@/contexts/WebPhoneContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { AuthSessionProvider } from "@/contexts/AuthSessionContext";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminOnlyRoute } from "@/components/AdminOnlyRoute";
import PageLoadingFallback from "@/components/PageLoadingFallback";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

// Lazy-loaded pages — cache bust
const HomePage = lazy(() => import("./pages/HomePage"));
const Index = lazy(() => import("./pages/Index"));
const CadencesPage = lazy(() => import("./pages/CadencesPage"));
const EmailSequencesPage = lazy(() => import("./pages/EmailSequencesPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const CloserPipelinePage = lazy(() => import("./pages/CloserPipelinePage"));
const CloserIndicadoresPage = lazy(() => import("./pages/CloserIndicadoresPage"));
const EvolutionPipelinePage = lazy(() => import("./pages/EvolutionPipelinePage"));
const ApiOficialPipelinePage = lazy(() => import("./pages/ApiOficialPipelinePage"));
const SimulatorPage = lazy(() => import("./pages/SimulatorPage"));
const EvolucaoSimulatorPage = lazy(() => import("./pages/EvolucaoSimulatorPage"));
const ProposalReviewPage = lazy(() => import("./pages/ProposalReviewPage"));
const ProposalPreviewPage = lazy(() => import("./pages/ProposalPreviewPage"));
const CallAnalysisSharePage = lazy(() => import("./pages/CallAnalysisSharePage"));
const ProposalSuccessPage = lazy(() => import("./pages/ProposalSuccessPage"));
const ProposalsListPage = lazy(() => import("./pages/ProposalsListPage"));
const EmbedFormPage = lazy(() => import("./pages/EmbedFormPage"));
const GoogleCalendarCallbackPage = lazy(() => import("./pages/GoogleCalendarCallbackPage"));
const FormPreviewPage = lazy(() => import("./pages/FormPreviewPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const PostVendaDashboardPage = lazy(() => import("./pages/PostVendaDashboardPage"));
const PhaseDetailPage = lazy(() => import("./pages/PhaseDetailPage"));
const ApiAnalysisPage = lazy(() => import("./pages/ApiAnalysisPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));

const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const DeliveriesPage = lazy(() => import("./pages/DeliveriesPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const SDRIndicadoresPage = lazy(() => import("./pages/SDRIndicadoresPage"));
const SDRICPAnalysisPage = lazy(() => import("./pages/SDRICPAnalysisPage"));
const SDRCallIntelligencePage = lazy(() => import("./pages/SDRCallIntelligencePage"));
const SDRMyClientsPage = lazy(() => import("./pages/SDRMyClientsPage"));
const CloserCallIntelligencePage = lazy(() => import("./pages/CloserCallIntelligencePage"));
const ImportHistoryPage = lazy(() => import("./pages/ImportHistoryPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));

const AccessDeniedPage = lazy(() => import("./pages/AccessDeniedPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,       // 30s — avoid refetches on tab switch / remount
      gcTime: 5 * 60 * 1000,      // 5min — keep cache while navigating
      refetchOnWindowFocus: false, // explicit invalidation only
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
  },
});

const HeartbeatWrapper = ({ children }: { children: React.ReactNode }) => {
  useHeartbeat();
  return <>{children}</>;
};

const App = () => {
  const [loaderDone, setLoaderDone] = useState(false);

  return (
    <>
      {!loaderDone && <LoaderScreen onComplete={() => setLoaderDone(true)} />}
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
      <WebPhoneProvider>
        <SidebarProvider>
        <TooltipProvider>
          <Sonner />
          <HeartbeatWrapper>
          <BrowserRouter>
            <RouteErrorBoundary>
            <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              } />
              <Route path="/leads" element={
                <ProtectedRoute requiredPermission="view_sdr_leads">
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="/sdr/indicadores" element={
                <ProtectedRoute requiredPermission="view_sdr_indicators">
                  <SDRIndicadoresPage />
                </ProtectedRoute>
              } />
              <Route path="/sdr/icp" element={
                <ProtectedRoute requiredPermission="view_sdr_leads">
                  <SDRICPAnalysisPage />
                </ProtectedRoute>
              } />
              <Route path="/sdr/call-intelligence" element={
                <ProtectedRoute requiredPermission="access_call_intelligence">
                  <SDRCallIntelligencePage />
                </ProtectedRoute>
              } />
              <Route path="/sdr/meus-clientes" element={
                <ProtectedRoute requiredPermission="view_accounts">
                  <SDRMyClientsPage />
                </ProtectedRoute>
              } />
              <Route path="/cadences" element={
                <ProtectedRoute requiredPermission="view_cadences">
                  <CadencesPage />
                </ProtectedRoute>
              } />
              <Route path="/email-sequences" element={<Navigate to="/settings/email-sequences" replace />} />
              <Route path="/import-history" element={
                <ProtectedRoute requiredPermission="manage_import">
                  <ImportHistoryPage />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={<Navigate to="/settings" replace />} />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />
              <Route path="/closer" element={
                <ProtectedRoute requiredPermission="view_closer_pipeline">
                  <CloserPipelinePage />
                </ProtectedRoute>
              } />
              <Route path="/closer/evolucao" element={
                <ProtectedRoute requiredPermission="view_closer_pipeline">
                  <EvolutionPipelinePage />
                </ProtectedRoute>
              } />
              <Route path="/closer/api-oficial" element={
                <ProtectedRoute requiredPermission="view_closer_pipeline">
                  <ApiOficialPipelinePage />
                </ProtectedRoute>
              } />
              <Route path="/closer/call-intelligence" element={
                <ProtectedRoute requiredPermission="access_call_intelligence">
                  <CloserCallIntelligencePage />
                </ProtectedRoute>
              } />
              <Route path="/closer/indicadores" element={
                <ProtectedRoute requiredPermission="view_closer_indicators">
                  <CloserIndicadoresPage />
                </ProtectedRoute>
              } />
              <Route path="/simulator" element={
                <ProtectedRoute requiredPermission="view_simulator">
                  <SimulatorPage />
                </ProtectedRoute>
              } />
              <Route path="/simulator/evolucao" element={
                <ProtectedRoute requiredPermission="view_simulator">
                  <EvolucaoSimulatorPage />
                </ProtectedRoute>
              } />
              <Route path="/proposal/:id" element={
                <ProtectedRoute requiredPermission="view_proposals">
                  <ProposalReviewPage />
                </ProtectedRoute>
              } />
              <Route path="/proposal-preview/:id" element={<ProposalPreviewPage />} />
              <Route path="/call-analysis/share/:token" element={<CallAnalysisSharePage />} />
              <Route path="/proposal-success/:id" element={
                <ProtectedRoute requiredPermission="view_proposals">
                  <ProposalSuccessPage />
                </ProtectedRoute>
              } />
              <Route path="/proposals" element={
                <ProtectedRoute requiredPermission="view_proposals">
                  <ProposalsListPage />
                </ProtectedRoute>
              } />
              <Route path="/embed-form" element={
                <ProtectedRoute requiredPermission="manage_embed_form">
                  <EmbedFormPage />
                </ProtectedRoute>
              } />
              <Route path="/tasks" element={
                <ProtectedRoute requiredPermission="view_tasks">
                  <TasksPage />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              } />
              <Route path="/calendar" element={
                <ProtectedRoute>
                  <CalendarPage />
                </ProtectedRoute>
              } />
              <Route path="/projects" element={
                <ProtectedRoute requiredPermission="view_projects">
                  <ProjectsPage />
                </ProtectedRoute>
              } />
              <Route path="/projects/dashboard" element={
                <AdminOnlyRoute>
                  <PostVendaDashboardPage />
                </AdminOnlyRoute>
              } />
              <Route path="/projects/phase/:phaseName" element={
                <ProtectedRoute requiredPermission="view_project_phases">
                  <PhaseDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/integrations" element={
                <ProtectedRoute>
                  <IntegrationsPage />
                </ProtectedRoute>
              } />
              <Route path="/deliveries" element={
                <ProtectedRoute>
                  <DeliveriesPage />
                </ProtectedRoute>
              } />
              <Route path="/accounts" element={
                <ProtectedRoute requiredPermission="view_accounts">
                  <AccountsPage />
                </ProtectedRoute>
              } />
              <Route path="/settings/*" element={
                <ProtectedRoute requiredPermission="access_admin">
                  <SettingsPage />
                </ProtectedRoute>
              } />
              <Route path="/api-analysis" element={
                <ProtectedRoute>
                  <ApiAnalysisPage />
                </ProtectedRoute>
              } />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/form-preview" element={<FormPreviewPage />} />
              <Route path="/google-calendar-callback" element={<GoogleCalendarCallbackPage />} />
              <Route path="/access-denied" element={<AccessDeniedPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </RouteErrorBoundary>
          </BrowserRouter>
          </HeartbeatWrapper>
        </TooltipProvider>
        </SidebarProvider>
      </WebPhoneProvider>
      </AuthSessionProvider>
    </QueryClientProvider>
  </ThemeProvider>
    </>
  );
};

export default App;
