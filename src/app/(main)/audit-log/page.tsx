import { History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AuditLogTable } from './components/audit-log-table';

export default function AuditLogPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="w-8 h-8" /> Inventory Audit Log
        </h1>
        <p className="text-muted-foreground">
          A detailed history of all inventory transactions.
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>A chronological list of stock changes from sales and purchases.</CardDescription>
        </CardHeader>
        <CardContent>
            <AuditLogTable />
        </CardContent>
      </Card>
    </div>
  );
}
