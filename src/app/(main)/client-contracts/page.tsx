import { ClientContractsTable } from './components/client-contracts-table';
import { UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ClientContractsPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <UserCheck className="w-8 h-8" /> Client Contracts
        </h1>
        <p className="text-muted-foreground">
          Assign and manage contracts for your clients.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>All Client Contracts</CardTitle>
          <CardDescription>A list of all assigned contracts.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientContractsTable />
        </CardContent>
      </Card>
    </div>
  );
}
