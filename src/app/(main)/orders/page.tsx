import { orders, drinks } from '@/lib/data';
import { OrdersTable } from './components/orders-table';
import { ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="w-8 h-8" /> Order Tracking
        </h1>
        <p className="text-muted-foreground">
          Manage customer orders for your buffet drinks.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>A list of all customer orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersTable initialOrders={orders} allDrinks={drinks} />
        </CardContent>
      </Card>
    </div>
  );
}
