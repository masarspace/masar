
import { NewPurchaseOrderForm } from '../purchase-orders/components/new-purchase-order-form';
import { ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PurchasingStatusPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
       <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="w-8 h-8" /> New Purchase Order
        </h1>
        <p className="text-muted-foreground">
          Create a new order to replenish your material inventory.
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Create Purchase Order</CardTitle>
            <CardDescription>Select materials and specify quantities to order.</CardDescription>
        </CardHeader>
        <CardContent>
            <NewPurchaseOrderForm />
        </CardContent>
      </Card>
    </div>
  );
}
