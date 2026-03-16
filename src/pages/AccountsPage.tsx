import { AppLayout } from "@/components/AppLayout";
import { ActiveClientsSection } from "@/components/clients/ActiveClientsSection";

export default function AccountsPage() {
  return (
    <AppLayout>
      <ActiveClientsSection />
    </AppLayout>
  );
}
