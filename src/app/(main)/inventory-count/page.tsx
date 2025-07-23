import { Boxes } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InventoryCountForm } from './components/inventory-count-form';

export default function InventoryCountPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Boxes className="w-8 h-8" /> Inventory Count & Wastage
        </h1>
        <p className="text-muted-foreground">
          Perform physical inventory counts to identify and track wastage.
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Physical Inventory Count</CardTitle>
            <CardDescription>Record the actual stock level for your materials.</CardDescription>
        </CardHeader>
        <CardContent>
            <InventoryCountForm />
        </CardContent>
      </Card>
    </div>
  );
}
