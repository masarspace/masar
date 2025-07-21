
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, doc, runTransaction, query, orderBy, deleteField, writeBatch } from 'firebase/firestore';
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
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, CheckCircle, XCircle, Truck, RefreshCw } from 'lucide-react';
import type { PurchaseOrder } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const CONVERSION_FACTORS: Record<string, number> = {
  'g_to_kg': 0.001,
  'kg_to_g': 1000,
  'ml_to_l': 0.001,
  'l_to_ml': 1000,
};

function getConversionFactor(fromUnit: string, toUnit: string): number {
    if (fromUnit === toUnit) return 1;
    const key = `${fromUnit}_to_${toUnit}`;
    return CONVERSION_FACTORS[key] || 1; // Default to 1 if no conversion is defined
}

export function PurchasingStatusTable() {
  const [purchaseOrdersSnapshot, poLoading] = useCollection(query(collection(db, 'purchaseOrders'), orderBy('createdAt', 'desc')).withConverter(purchaseOrderConverter));
  const [materialsSnapshot, materialsLoading] = useCollection(collection(db, 'materials').withConverter(materialConverter));
  const { toast } = useToast();

  const purchaseOrders = React.useMemo(() => {
    return purchaseOrdersSnapshot?.docs.map(doc => doc.data()) ?? [];
  }, [purchaseOrdersSnapshot]);
  
  const allMaterials = React.useMemo(() => {
    return materialsSnapshot?.docs.map(doc => doc.data()) ?? []
  }, [materialsSnapshot]);

  const [formattedDates, setFormattedDates] = React.useState<Map<string, {createdAt: string, receivedAt?: string}>>(new Map());
  
  React.useEffect(() => {
    if (purchaseOrders.length > 0) {
      const newFormattedDates = new Map();
      for (const order of purchaseOrders) {
        // This effect runs only on the client, so `Intl` is safe here.
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
            
            // Step 1: Read all documents first
            const orderDoc = await transaction.get(orderRef.withConverter(purchaseOrderConverter));
            if (!orderDoc.exists()) throw new Error("Purchase order not found.");
            
            const orderData = orderDoc.data();
            const oldStatus = orderData.status;

            if (oldStatus === newStatus) return;

            const materialRefs = orderData.items.map(item => 
                doc(db, 'materials', item.materialId).withConverter(materialConverter)
            );
            const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref)));
            
            const poUpdateData: any = { status: newStatus };

            // Step 2: Perform logic and prepare writes
            // When order is COMPLETED, add stock to materials
            if (newStatus === 'Completed' && oldStatus !== 'Completed') {
                poUpdateData.receivedAt = new Date().toISOString();
                for (let i = 0; i < materialDocs.length; i++) {
                    const materialDoc = materialDocs[i];
                    const item = orderData.items[i];
                    if (!materialDoc.exists()) throw new Error(`Material ${getMaterialName(item.materialId)} not found.`);
                    const materialData = materialDoc.data();
                    const conversionFactor = getConversionFactor(item.unit, materialData.unit);
                    const quantityToAdd = item.quantity * conversionFactor;
                    const newStock = materialData.stock + quantityToAdd;
                    transaction.update(materialDoc.ref, { stock: newStock });
                }
            }
            // When order is moved FROM completed, REMOVE stock
            else if (oldStatus === 'Completed' && newStatus !== 'Completed') {
                poUpdateData.receivedAt = deleteField();
                 for (let i = 0; i < materialDocs.length; i++) {
                    const materialDoc = materialDocs[i];
                    const item = orderData.items[i];
                    if (!materialDoc.exists()) throw new Error(`Material ${getMaterialName(item.materialId)} not found.`);
                    const materialData = materialDoc.data();
                    const conversionFactor = getConversionFactor(item.unit, materialData.unit);
                    const quantityToRemove = item.quantity * conversionFactor;
                    const newStock = materialData.stock - quantityToRemove;
                    if (newStock < 0) throw new Error(`Cannot reverse order, insufficient stock for ${materialData.name}.`);
                    transaction.update(materialDoc.ref, { stock: newStock });
                }
            }
            
            // Step 3: Write all updates at the end
            transaction.update(orderRef, poUpdateData);
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
                <TableHead>Details</TableHead>
                <TableHead>Received</TableHead>
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
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden lg:table-cell">Order ID</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Received</TableHead>
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
                    <div>{formattedDates.get(order.id)?.createdAt || <Skeleton className="h-5 w-24" />}</div>
                    <div className="text-xs text-muted-foreground">{order.category.name}</div>
                    <div className="text-xs text-muted-foreground">{order.location}</div>
                </TableCell>
                <TableCell>
                  {order.receivedAt ? (formattedDates.get(order.id)?.receivedAt || <Skeleton className="h-5 w-24" />) : 'N/A'}
                </TableCell>
                <TableCell>
                   <Tooltip>
                      <TooltipTrigger asChild>
                          <div className="truncate max-w-xs cursor-default">
                              {order.items.map(i => `${i.quantity}${i.unit} x ${getMaterialName(i.materialId)}`).join(', ')}
                          </div>
                      </TooltipTrigger>
                      <TooltipContent>
                          <ul className="list-disc list-inside p-2 space-y-1">
                              {order.items.map((i, index) => (
                                  <li key={index}>
                                      <span>{i.quantity}{i.unit} x {getMaterialName(i.materialId)}</span>
                                      {i.note && <p className="text-muted-foreground italic text-xs pl-2">- {i.note}</p>}
                                  </li>
                              ))}
                          </ul>
                      </TooltipContent>
                  </Tooltip>
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
                              <RefreshCw className="mr-2 h-4 w-4" />
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
    </TooltipProvider>
  );
}
