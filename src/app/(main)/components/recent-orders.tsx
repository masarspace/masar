"use client"

import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { orderConverter, drinkConverter } from '@/lib/converters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function RecentOrders() {
    const [ordersSnapshot, ordersLoading] = useCollection(
        query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5)).withConverter(orderConverter)
    );
    const [drinksSnapshot, drinksLoading] = useCollection(collection(db, 'drinks').withConverter(drinkConverter));

    const recentOrders = ordersSnapshot?.docs.map(doc => doc.data()) ?? [];
    const drinks = drinksSnapshot?.docs.map(doc => doc.data()) ?? [];

    const getDrinkName = (drinkId: string) => {
        return drinks.find((d) => d.id === drinkId)?.name || 'Unknown Drink';
    };

    if (ordersLoading || drinksLoading) {
        return (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
        )
    }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order ID</TableHead>
          <TableHead>Items</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recentOrders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-mono text-xs">{order.id}</TableCell>
            <TableCell>
              {order.items
                .map((i) => `${i.quantity}x ${getDrinkName(i.drinkId)}`)
                .join(', ')}
            </TableCell>
            <TableCell className="text-right">
              <Badge
                variant={
                  order.status === 'Completed'
                    ? 'default'
                    : order.status === 'Pending'
                    ? 'secondary'
                    : 'destructive'
                }
              >
                {order.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
