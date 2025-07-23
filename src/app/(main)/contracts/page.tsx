import { ContractsTable } from './components/contracts-table';
import { FileSignature } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ContractsPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileSignature className="w-8 h-8" /> Contract Management
        </h1>
        <p className="text-muted-foreground">
          Manage your contracts.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>All Contracts</CardTitle>
          <CardDescription>A list of all contracts.</CardDescription>
        </CardHeader>
        <CardContent>
          <ContractsTable />
        </CardContent>
      </Card>
    </div>
  );
}
