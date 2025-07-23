import { ClientsTable } from './components/clients-table';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ClientsPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="w-8 h-8" /> Client Management
        </h1>
        <p className="text-muted-foreground">
          Manage your clients.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>A list of all clients.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientsTable />
        </CardContent>
      </Card>
    </div>
  );
}
