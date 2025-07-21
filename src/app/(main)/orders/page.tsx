import { OrdersTable } from './components/orders-table';
import { ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="w-8 h-8" /> Order Tracking
        </h1>
        <p className="text-muted-foreground">
          Manage customer orders for your buffet drinks.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>A list of all customer orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersTable />
        </CardContent>
      </Card>
    </div>
  );
}
