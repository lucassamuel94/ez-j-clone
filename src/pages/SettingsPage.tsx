import { Routes, Route, Navigate } from 'react-router-dom';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { PeopleSection } from '@/components/settings/PeopleSection';
import { PermissionsSection } from '@/components/settings/PermissionsSection';
import { TemplatesSection } from '@/components/settings/TemplatesSection';
import { ReportsSDRSection } from '@/components/admin/ReportsSDRSection';
import { ReportsCloserSection } from '@/components/admin/ReportsCloserSection';
import { GoalsSection } from '@/components/admin/GoalsSection';
import { MailingImportSection } from '@/components/admin/MailingImportSection';
import { ProductLibrarySection } from '@/components/admin/ProductLibrarySection';
import { AIPromptsSection } from '@/components/admin/AIPromptsSection';
import { BulkEnrichSection } from '@/components/admin/BulkEnrichSection';

import { EmailTemplatesManager } from '@/components/admin/EmailTemplatesManager';
import { CallIntelligenceSection } from '@/components/admin/CallIntelligenceSection';
import { AutomaticMessagesSection } from '@/components/settings/AutomaticMessagesSection';
import EmbedFormPage from '@/pages/EmbedFormPage';
import EmailSequencesPage from '@/pages/EmailSequencesPage';
import { ActiveClientsSection } from '@/components/clients/ActiveClientsSection';
import { ICPAnalysisSection } from '@/components/clients/ICPAnalysisSection';
import { PhaseStatusManager } from '@/components/settings/PhaseStatusManager';
import { TeamPhaseMapSection } from '@/components/settings/TeamPhaseMapSection';
import { PipelineStatusManager } from '@/components/settings/PipelineStatusManager';
import { EdgeFunctionsSection } from '@/components/settings/EdgeFunctionsSection';
import { ProjectTrashView } from '@/components/projects/ProjectTrashView';
import { ReportsMarketingSection } from '@/components/admin/ReportsMarketingSection';
import { IntegrationsCatalogSection } from '@/components/admin/IntegrationsCatalogSection';
import { UTMLinkGeneratorSection } from '@/components/admin/UTMLinkGeneratorSection';
function EnrichSection() {
  return (
    <div className="space-y-6">
      <BulkEnrichSection />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <SettingsLayout>
      <Routes>
        <Route index element={<Navigate to="/settings/people" replace />} />
        <Route path="people" element={<PeopleSection />} />
        <Route path="teams" element={<Navigate to="/settings/people" replace />} />
        <Route path="permissions" element={<PermissionsSection />} />
        
        <Route path="reports" element={<Navigate to="sdr" replace />} />
        <Route path="reports/sdr" element={<ReportsSDRSection />} />
        <Route path="reports/closer" element={<ReportsCloserSection />} />
        <Route path="reports/marketing" element={<ReportsMarketingSection />} />
        <Route path="goals" element={<GoalsSection />} />
        <Route path="import" element={<MailingImportSection />} />
        <Route path="products" element={<ProductLibrarySection />} />
        <Route path="ai" element={<AIPromptsSection />} />
        <Route path="enrich" element={<EnrichSection />} />
        <Route path="email-templates" element={<EmailTemplatesManager />} />
        <Route path="email-sequences" element={<EmailSequencesPage />} />
        <Route path="call-intelligence" element={<CallIntelligenceSection />} />
        <Route path="automatic-messages" element={<AutomaticMessagesSection />} />
        <Route path="forms" element={<EmbedFormPage />} />
        <Route path="logs" element={<Navigate to="/settings/people" replace />} />
        <Route path="clients" element={<ActiveClientsSection />} />
        <Route path="icp" element={<ICPAnalysisSection />} />
        <Route path="phase-statuses" element={<PhaseStatusManager />} />
        <Route path="team-phases" element={<TeamPhaseMapSection />} />
        <Route path="pipeline-statuses" element={<PipelineStatusManager />} />
        <Route path="edge-functions" element={<EdgeFunctionsSection />} />
        <Route path="trash" element={<ProjectTrashView />} />
        <Route path="integrations-catalog" element={<IntegrationsCatalogSection />} />
        <Route path="utm-generator" element={<UTMLinkGeneratorSection />} />
        <Route path="system" element={<Navigate to="/settings/permissions" replace />} />
        <Route path="*" element={<Navigate to="/settings" replace />} />
      </Routes>
    </SettingsLayout>
  );
}
