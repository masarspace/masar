
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { purchaseOrderConverter, materialConverter } from '@/lib/converters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, CheckCircle, XCircle, Truck } from 'lucide-react';
import type { PurchaseOrder } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";

export function PurchasingStatusTable() {
  const [purchaseOrdersSnapshot, poLoading] = useCollection(collection(db, 'purchaseOrders').withConverter(purchaseOrderConverter));
  const [materialsSnapshot, materialsLoading] = useCollection(collection(db, 'materials').withConverter(materialConverter));
  const { toast } = useToast();

  const purchaseOrders = React.useMemo(() => {
    return purchaseOrdersSnapshot?.docs.map(doc => doc.data()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) ?? [];
  }, [purchaseOrdersSnapshot]);
  
  const allMaterials = React.useMemo(() => {
    return materialsSnapshot?.docs.map(doc => doc.data()) ?? []
  }, [materialsSnapshot]);

  const [formattedDates, setFormattedDates] = React.useState<Map<string, {createdAt: string, receivedAt?: string}>>(new Map());
  
  React.useEffect(() => {
    if (purchaseOrders.length > 0) {
      const newFormattedDates = new Map();
      for (const order of purchaseOrders) {
        const createdAt = new Intl.DateTimeFormat('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        }).format(new Date(order.createdAt));
        
        const receivedAt = order.receivedAt ? new Intl.DateTimeFormat('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        }).format(new Date(order.receivedAt)) : undefined;

        newFormattedDates.set(order.id, { createdAt, receivedAt });
      }
      setFormattedDates(newFormattedDates);
    }
  }, [purchaseOrders]);

  const getMaterialName = (id: string) => allMaterials.find(m => m.id === id)?.name || 'Unknown';

  const handleUpdateStatus = async (orderId: string, newStatus: PurchaseOrder['status']) => {
     try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'purchaseOrders', orderId);
            const orderDoc = await transaction.get(orderRef.withConverter(purchaseOrderConverter));
            if (!orderDoc.exists()) throw new Error("Purchase order not found.");
            const orderData = orderDoc.data();
            
            let updateData: any = { status: newStatus };

            // When order is completed, add stock to materials
            if (newStatus === 'Completed' && orderData.status !== 'Completed') {
                updateData.receivedAt = new Date().toISOString();
                for (const item of orderData.items) {
                    const materialRef = doc(db, 'materials', item.materialId);
                    const materialDoc = await transaction.get(materialRef.withConverter(materialConverter));
                    if(!materialDoc.exists()) throw new Error(`Material ${getMaterialName(item.materialId)} not found.`);

                    const newStock = materialDoc.data().stock + item.quantity;
                    transaction.update(materialRef, { stock: newStock });
                }
            }

            // When order is moved from completed back to something else, remove stock
            if (orderData.status === 'Completed' && newStatus !== 'Completed') {
                updateData.receivedAt = null; // or delete field
                for (const item of orderData.items) {
                    const materialRef = doc(db, 'materials', item.materialId);
                    const materialDoc = await transaction.get(materialRef.withConverter(materialConverter));
                    if(!materialDoc.exists()) throw new Error(`Material ${getMaterialName(item.materialId)} not found.`);
                    
                    const newStock = materialDoc.data().stock - item.quantity;
                     if (newStock < 0) throw new Error(`Cannot reverse order, insufficient stock for ${materialDoc.data().name}.`);
                    transaction.update(materialRef, { stock: newStock });
                }
            }

            transaction.update(orderRef, updateData);
        });
        toast({ title: `Order status updated to ${newStatus}.`});
     } catch (error: any) {
        toast({ variant: "destructive", title: "Error updating status", description: error.message });
     }
  };

  const getOrderTotal = (items: PurchaseOrder['items']) => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  if (poLoading || materialsLoading) {
     return (
       <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
               <TableRow>
                <TableHead className="hidden lg:table-cell">Order ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="hidden md:table-cell">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden lg:table-cell">Order ID</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="hidden md:table-cell">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchaseOrders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="hidden lg:table-cell font-mono text-xs">{order.id}</TableCell>
              <TableCell>
                  <div>{order.category.name}</div>
                  <div className="text-xs text-muted-foreground">{order.location}</div>
                  <div className="text-xs text-muted-foreground">
                    Created: {formattedDates.get(order.id)?.createdAt || ''}
                  </div>
                   {order.receivedAt && (
                     <div className="text-xs text-muted-foreground">
                        Received: {formattedDates.get(order.id)?.receivedAt || ''}
                    </div>
                   )}
              </TableCell>
              <TableCell>
                {order.items.map(i => `${i.quantity} x ${getMaterialName(i.materialId)}`).join(', ')}
              </TableCell>
              <TableCell className="hidden md:table-cell">${getOrderTotal(order.items).toFixed(2)}</TableCell>
              <TableCell>
                <Badge variant={
                    order.status === 'Completed' ? 'default' :
                    order.status === 'Pending' ? 'secondary' :
                    order.status === 'Approved' ? 'outline' :
                    'destructive'
                }>
                  {order.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                     {order.status === 'Pending' && (
                      <>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Approved')}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                              Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Cancelled')} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel
                          </DropdownMenuItem>
                      </>
                     )}
                      {order.status === 'Approved' && (
                      <>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Completed')}>
                              <Truck className="mr-2 h-4 w-4 text-blue-500" />
                              Mark as Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Cancelled')} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel
                          </DropdownMenuItem>
                      </>
                     )}
                     {(order.status === 'Cancelled' || order.status === 'Completed') && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Pending')}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Re-open as Pending
                        </DropdownMenuItem>
                     )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
