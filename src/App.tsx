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
const ProposalSuccessPage = lazy(() => import("./pages/ProposalSuccessPage"));
const ProposalsListPage = lazy(() => import("./pages/ProposalsListPage"));
const EmbedFormPage = lazy(() => import("./pages/EmbedFormPage"));
const GoogleCalendarCallbackPage = lazy(() => import("./pages/GoogleCalendarCallbackPage"));
const FormPreviewPage = lazy(() => import("./pages/FormPreviewPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const PhaseDetailPage = lazy(() => import("./pages/PhaseDetailPage"));
const ApiAnalysisPage = lazy(() => import("./pages/ApiAnalysisPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));

const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const DeliveriesPage = lazy(() => import("./pages/DeliveriesPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const SDRIndicadoresPage = lazy(() => import("./pages/SDRIndicadoresPage"));
const SDRICPAnalysisPage = lazy(() => import("./pages/SDRICPAnalysisPage"));
const SDRCallIntelligencePage = lazy(() => import("./pages/SDRCallIntelligencePage"));
const ImportHistoryPage = lazy(() => import("./pages/ImportHistoryPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));

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
                <ProtectedRoute allowedRoles={['sdr', 'admin', 'manager']}>
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="/sdr/indicadores" element={
                <ProtectedRoute allowedRoles={['sdr', 'admin', 'manager']}>
                  <SDRIndicadoresPage />
                </ProtectedRoute>
              } />
              <Route path="/sdr/icp" element={
                <ProtectedRoute allowedRoles={['sdr', 'admin', 'manager']}>
                  <SDRICPAnalysisPage />
                </ProtectedRoute>
              } />
              <Route path="/sdr/call-intelligence" element={
                <ProtectedRoute allowedRoles={['sdr', 'admin', 'manager']}>
                  <SDRCallIntelligencePage />
                </ProtectedRoute>
              } />
              <Route path="/cadences" element={
                <ProtectedRoute allowedRoles={['sdr', 'admin', 'manager']}>
                  <CadencesPage />
                </ProtectedRoute>
              } />
              <Route path="/email-sequences" element={<Navigate to="/settings/email-sequences" replace />} />
              <Route path="/import-history" element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
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
                <ProtectedRoute allowedRoles={['closer', 'admin', 'manager']}>
                  <CloserPipelinePage />
                </ProtectedRoute>
              } />
              <Route path="/closer/evolucao" element={
                <ProtectedRoute allowedRoles={['closer', 'admin', 'manager']}>
                  <EvolutionPipelinePage />
                </ProtectedRoute>
              } />
              <Route path="/closer/api-oficial" element={
                <ProtectedRoute allowedRoles={['closer', 'admin', 'manager']}>
                  <ApiOficialPipelinePage />
                </ProtectedRoute>
              } />
              <Route path="/closer/indicadores" element={
                <ProtectedRoute allowedRoles={['closer', 'admin', 'manager']}>
                  <CloserIndicadoresPage />
                </ProtectedRoute>
              } />
              <Route path="/simulator" element={
                <ProtectedRoute allowedRoles={['sdr', 'closer', 'admin', 'manager']}>
                  <SimulatorPage />
                </ProtectedRoute>
              } />
              <Route path="/simulator/evolucao" element={
                <ProtectedRoute allowedRoles={['sdr', 'closer', 'admin', 'manager']}>
                  <EvolucaoSimulatorPage />
                </ProtectedRoute>
              } />
              <Route path="/proposal/:id" element={
                <ProtectedRoute allowedRoles={['closer', 'admin', 'manager']}>
                  <ProposalReviewPage />
                </ProtectedRoute>
              } />
              <Route path="/proposal-preview/:id" element={<ProposalPreviewPage />} />
              <Route path="/proposal-success/:id" element={
                <ProtectedRoute allowedRoles={['closer', 'admin', 'manager']}>
                  <ProposalSuccessPage />
                </ProtectedRoute>
              } />
              <Route path="/proposals" element={
                <ProtectedRoute allowedRoles={['closer', 'admin', 'manager']}>
                  <ProposalsListPage />
                </ProtectedRoute>
              } />
              <Route path="/embed-form" element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <EmbedFormPage />
                </ProtectedRoute>
              } />
              <Route path="/tasks" element={
                <ProtectedRoute allowedRoles={['admin', 'manager', 'closer', 'head_pos_venda', 'ux_po', 'dev_chatbot', 'treinamento', 'sdr']}>
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
                <ProtectedRoute allowedRoles={['admin', 'manager', 'closer', 'head_pos_venda', 'ux_po', 'dev_chatbot', 'treinamento']}>
                  <ProjectsPage />
                </ProtectedRoute>
              } />
              <Route path="/projects/phase/:phaseName" element={
                <ProtectedRoute allowedRoles={['admin', 'manager', 'closer', 'head_pos_venda', 'ux_po', 'dev_chatbot', 'treinamento']}>
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
                <ProtectedRoute allowedRoles={['closer', 'admin', 'manager']}>
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
