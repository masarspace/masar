import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { materials, orders, drinks } from '@/lib/data';
import type { Order, Drink } from '@/lib/types';
import { OverviewChart } from './components/overview-chart';
import { DollarSign, Package, ShoppingCart, AlertTriangle } from 'lucide-react';
import { RecentOrders } from './components/recent-orders';
import { DashboardStats } from './components/dashboard-stats';

export default function DashboardPage() {
  
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          An overview of your buffet's performance.
        </p>
      </div>
      
      <DashboardStats />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Popular Drinks</CardTitle>
            <CardDescription>
              A summary of the most ordered drinks.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <OverviewChart />
          </CardContent>
        </Card>
        <Card className="col-span-4 lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>
              Here are the latest 5 orders from your store.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentOrders />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
