
import { PurchasingStatusTable } from '../purchasing-status/components/purchasing-status-table';
import { Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PurchaseTrackingPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Truck className="w-8 h-8" /> Purchase Tracking
        </h1>
        <p className="text-muted-foreground">
          Track and manage all your ongoing and completed purchase orders.
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>All Purchase Orders</CardTitle>
            <CardDescription>A list of all purchase orders and their current status.</CardDescription>
        </CardHeader>
        <CardContent>
            <PurchasingStatusTable />
        </CardContent>
      </Card>
    </div>
  );
}
