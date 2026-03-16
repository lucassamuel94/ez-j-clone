import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductPlansTable } from './ProductPlansTable';
import { EZCallPlansTable } from './EZCallPlansTable';
import { SetupPlansTable } from './SetupPlansTable';
import { MetaCostsTable } from './MetaCostsTable';

export const ProductLibrarySection = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Biblioteca de Produtos</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ez_chat">
          <TabsList>
            <TabsTrigger value="ez_chat">EZ Chat</TabsTrigger>
            <TabsTrigger value="ez_call">EZ Call</TabsTrigger>
            <TabsTrigger value="monitoria">MonitorIA</TabsTrigger>
            <TabsTrigger value="setup_integracoes">Setup/Integrações</TabsTrigger>
            <TabsTrigger value="meta_custos">Custos Meta</TabsTrigger>
          </TabsList>

          <TabsContent value="ez_chat">
            <ProductPlansTable
              category="ez_chat"
              description="Gerencie os planos EZ Chat exibidos no simulador e nas propostas comerciais."
            />
          </TabsContent>

          <TabsContent value="ez_call">
            <EZCallPlansTable />
          </TabsContent>

          <TabsContent value="monitoria">
            <ProductPlansTable
              category="monitoria"
              description="Gerencie os planos MonitorIA."
            />
          </TabsContent>

          <TabsContent value="setup_integracoes">
            <SetupPlansTable />
          </TabsContent>

          <TabsContent value="meta_custos">
            <MetaCostsTable />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
