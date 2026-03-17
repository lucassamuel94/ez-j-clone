import { useAdminUsers } from '@/hooks/useAdminUsers';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagementTable } from '@/components/admin/UserManagementTable';
import { InviteUserDialog } from '@/components/admin/InviteUserDialog';
import { PendingInvitationsTable } from '@/components/admin/PendingInvitationsTable';
import { ReportsSection } from '@/components/admin/ReportsSection';
import { MailingImportSection } from '@/components/admin/MailingImportSection';
import { ProductLibrarySection } from '@/components/admin/ProductLibrarySection';
import { AIPromptsSection } from '@/components/admin/AIPromptsSection';
import { BulkEnrichSection } from '@/components/admin/BulkEnrichSection';
import { DatabaseStatsSection } from '@/components/admin/DatabaseStatsSection';
import { EmailTemplatesManager } from '@/components/admin/EmailTemplatesManager';
import { RolesManagementSection } from '@/components/admin/RolesManagementSection';
import { Button } from '@/components/ui/button';
import { Package, Code2, Headphones, ShieldCheck } from 'lucide-react';
import { ArrowLeft, Users, Mail, Shield, Loader2, BarChart3, FileSpreadsheet, Target, Bot, Database, MailPlus } from 'lucide-react';
import { GoalsSection } from '@/components/admin/GoalsSection';
import { CallIntelligenceSection } from '@/components/admin/CallIntelligenceSection';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';

const AdminPage = () => {
  const {
    isCheckingAdmin,
    isCheckingManager,
    users,
    isLoadingUsers,
    availableRoles,
    invitations,
    isLoadingInvitations,
    toggleUserActive,
    updateUserRole,
    updateUserName,
    createInvitation,
    deleteInvitation,
  } = useAdminUsers();

  const { hasPermission, isLoading: isLoadingPerms } = usePermissions();

  const canAccess = hasPermission('access_admin');

  if (isCheckingAdmin || isCheckingManager || isLoadingPerms) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página. 
              Entre em contato com um administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Início
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <PageHeader
              icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.5} />}
              title="Painel Administrativo"
              subtitle="Gerencie usuários e configurações"
              className="pb-0 flex-1"
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue={hasPermission('view_reports') ? "reports" : hasPermission('access_call_intelligence') ? "call-intelligence" : "roles"} className="space-y-6">
          <TabsList className="flex-wrap">
            {hasPermission('view_reports') && (
              <TabsTrigger value="reports" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Relatórios
              </TabsTrigger>
            )}
            {hasPermission('manage_users') && (
              <>
                <TabsTrigger value="users" className="gap-2">
                  <Users className="h-4 w-4" />
                  Usuários
                </TabsTrigger>
                <TabsTrigger value="invitations" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Convites
                </TabsTrigger>
              </>
            )}
            {hasPermission('manage_goals') && (
              <TabsTrigger value="goals" className="gap-2">
                <Target className="h-4 w-4" />
                Metas
              </TabsTrigger>
            )}
            {hasPermission('manage_import') && (
              <TabsTrigger value="import" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Importação
              </TabsTrigger>
            )}
            {hasPermission('manage_products') && (
              <TabsTrigger value="products" className="gap-2">
                <Package className="h-4 w-4" />
                Produtos
              </TabsTrigger>
            )}
            {hasPermission('manage_ai') && (
              <TabsTrigger value="ai" className="gap-2">
                <Bot className="h-4 w-4" />
                IA
              </TabsTrigger>
            )}
            {hasPermission('manage_enrichment') && (
              <TabsTrigger value="enrich" className="gap-2">
                <Database className="h-4 w-4" />
                Enriquecimento
              </TabsTrigger>
            )}
            {hasPermission('manage_email_templates') && (
              <TabsTrigger value="email-templates" className="gap-2">
                <MailPlus className="h-4 w-4" />
                E-mail
              </TabsTrigger>
            )}
            {hasPermission('access_call_intelligence') && (
              <TabsTrigger value="call-intelligence" className="gap-2">
                <Headphones className="h-4 w-4" />
                Call Intelligence
              </TabsTrigger>
            )}
            {hasPermission('manage_roles') && (
              <TabsTrigger value="roles" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Perfis
              </TabsTrigger>
            )}
            {hasPermission('manage_embed_form') && (
              <TabsTrigger value="embed-form" className="gap-2" asChild>
                <Link to="/embed-form">
                  <Code2 className="h-4 w-4" />
                  Formulário
                </Link>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="reports" className="space-y-4">
            <ReportsSection />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Gerenciamento de Usuários</CardTitle>
                  <CardDescription>
                    Gerencie os usuários da plataforma, seus papéis e status.
                  </CardDescription>
                </div>
                <InviteUserDialog
                  onInvite={(email, role, roleId, teamId) => createInvitation.mutate({ email, role, roleId, teamId })}
                  isLoading={createInvitation.isPending}
                />
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <UserManagementTable
                    users={users}
                    roles={availableRoles}
                    onToggleActive={(userId, active) => toggleUserActive.mutate({ userId, active })}
                    onUpdateRole={(userId, roleId) => updateUserRole.mutate({ userId, roleId })}
                    onUpdateName={(userId, name) => updateUserName.mutate({ userId, name })}
                    isUpdating={toggleUserActive.isPending || updateUserRole.isPending || updateUserName.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Convites Pendentes</CardTitle>
                  <CardDescription>
                    Gerencie os convites enviados que ainda não foram aceitos.
                  </CardDescription>
                </div>
                <InviteUserDialog
                  onInvite={(email, role, roleId, teamId) => createInvitation.mutate({ email, role, roleId, teamId })}
                  isLoading={createInvitation.isPending}
                />
              </CardHeader>
              <CardContent>
                {isLoadingInvitations ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <PendingInvitationsTable
                    invitations={invitations}
                    onDelete={(invitationId) => deleteInvitation.mutate(invitationId)}
                    isDeleting={deleteInvitation.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="goals" className="space-y-4">
            <GoalsSection />
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <MailingImportSection />
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <ProductLibrarySection />
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <AIPromptsSection />
          </TabsContent>

          <TabsContent value="enrich" className="space-y-4">
            <BulkEnrichSection />
            <DatabaseStatsSection />
          </TabsContent>

          <TabsContent value="email-templates" className="space-y-4">
            <EmailTemplatesManager />
          </TabsContent>

          <TabsContent value="call-intelligence" className="space-y-4">
            <CallIntelligenceSection />
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <RolesManagementSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
