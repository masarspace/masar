
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, doc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { orderConverter, drinkConverter, materialConverter } from '@/lib/converters';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, PlusCircle, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import type { Order, OrderItem, Drink, Material } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";

export function OrdersTable() {
  const [ordersSnapshot, ordersLoading] = useCollection(collection(db, 'orders').withConverter(orderConverter));
  const [drinksSnapshot, drinksLoading] = useCollection(collection(db, 'drinks').withConverter(drinkConverter));
  const [materialsSnapshot, materialsLoading] = useCollection(collection(db, 'materials').withConverter(materialConverter));

  const { toast } = useToast();

  const orders = ordersSnapshot?.docs.map(doc => doc.data()).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) ?? [];
  const allDrinks = drinksSnapshot?.docs.map(doc => doc.data()) ?? [];
  const allMaterials = materialsSnapshot?.docs.map(doc => doc.data()) ?? [];

  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);

  React.useEffect(() => {
    if(selectedOrder) {
      setOrderItems(selectedOrder.items);
    } else {
      setOrderItems([]);
    }
  }, [selectedOrder, isSheetOpen]);

  const handleAddClick = () => {
    setSelectedOrder(null);
    setOrderItems([]);
    setIsSheetOpen(true);
  };

  const handleEditClick = (order: Order) => {
    if(order.status !== 'Pending') {
      toast({
        variant: "destructive",
        title: "Cannot edit order",
        description: "Only pending orders can be edited.",
      });
      return;
    }
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = async (order: Order) => {
    if(!order.id) return;
    
    // If order is not cancelled, return stock before deleting
    if(order.status === 'Pending' || order.status === 'Completed') {
      try {
        await runTransaction(db, async (transaction) => {
          for (const item of order.items) {
            const drink = allDrinks.find(d => d.id === item.drinkId);
            if (drink) {
              for (const recipeItem of drink.recipe) {
                const materialRef = doc(db, 'materials', recipeItem.materialId).withConverter(materialConverter);
                const materialDoc = await transaction.get(materialRef);
                if (!materialDoc.exists()) throw new Error("Material not found");
                const stockToReturn = recipeItem.quantity * item.quantity;
                transaction.update(materialRef, { stock: materialDoc.data().stock + stockToReturn });
              }
            }
          }
          const orderRef = doc(db, 'orders', order.id);
          transaction.delete(orderRef);
        });
        toast({ title: "Order deleted and stock restored."});
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error deleting order", description: error.message });
      }
    } else { // Order is already cancelled, just delete it
      await deleteDoc(doc(db, 'orders', order.id));
      toast({ title: "Order deleted."});
    }
  };

  const handleItemChange = (drinkId: string, checked: boolean | 'indeterminate') => {
    if (checked) {
      setOrderItems([...orderItems, { drinkId, quantity: 1 }]);
    } else {
      setOrderItems(orderItems.filter(item => item.drinkId !== drinkId));
    }
  };

  const handleQuantityChange = (drinkId: string, quantity: number) => {
    setOrderItems(orderItems.map(item => item.drinkId === drinkId ? { ...item, quantity } : item));
  };
  
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const itemsToSave = orderItems.filter(i => i.quantity > 0);
    
    if (itemsToSave.length === 0) {
        toast({ variant: "destructive", title: "Cannot save order", description: "Please add at least one drink to the order." });
        return;
    }

    if (selectedOrder) {
        // Editing an existing order
        try {
            await runTransaction(db, async (transaction) => {
                const orderDocRef = doc(db, 'orders', selectedOrder.id);
                const currentOrderDoc = await transaction.get(orderDocRef.withConverter(orderConverter));
                if (!currentOrderDoc.exists()) throw new Error("Order does not exist!");
                
                const oldItems = currentOrderDoc.data().items;

                // Calculate stock changes
                const stockChanges = new Map<string, number>();

                const processItems = (items: OrderItem[], factor: 1 | -1) => {
                    for (const item of items) {
                        const drink = allDrinks.find(d => d.id === item.drinkId);
                        if (drink) {
                            for (const recipeItem of drink.recipe) {
                                const currentChange = stockChanges.get(recipeItem.materialId) || 0;
                                stockChanges.set(recipeItem.materialId, currentChange + recipeItem.quantity * item.quantity * factor);
                            }
                        }
                    }
                };

                processItems(oldItems, 1); // Add back old item stock
                processItems(itemsToSave, -1); // Deduct new item stock

                const materialRefs = Array.from(stockChanges.keys()).map(id => doc(db, 'materials', id).withConverter(materialConverter));
                const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref)));

                for(let i = 0; i < materialDocs.length; i++) {
                    const materialDoc = materialDocs[i];
                    const materialId = materialRefs[i].id;
                    const change = stockChanges.get(materialId) || 0;
                    
                    if (!materialDoc.exists()) throw new Error(`Material with ID ${materialId} not found.`);
                    
                    const newStock = materialDoc.data().stock + change;
                    if (newStock < 0) {
                        throw new Error(`Insufficient stock for ${materialDoc.data().name}.`);
                    }
                    transaction.update(materialRefs[i], { stock: newStock });
                }

                transaction.update(orderDocRef, { items: itemsToSave });
            });
            toast({ title: "Order updated successfully!" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error updating order", description: error.message });
            return;
        }

    } else {
        // Creating a new order
        try {
            await runTransaction(db, async (transaction) => {
                const materialStockDeltas = new Map<string, number>();

                for (const item of itemsToSave) {
                    const drink = allDrinks.find(d => d.id === item.drinkId);
                    if (drink) {
                        for (const recipeItem of drink.recipe) {
                            const currentDelta = materialStockDeltas.get(recipeItem.materialId) || 0;
                            materialStockDeltas.set(recipeItem.materialId, currentDelta + (recipeItem.quantity * item.quantity));
                        }
                    }
                }
                
                const materialRefs = Array.from(materialStockDeltas.keys()).map(id => doc(db, 'materials', id).withConverter(materialConverter));
                const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref)));
                
                for (let i = 0; i < materialDocs.length; i++) {
                    const materialDoc = materialDocs[i];
                    const materialId = materialRefs[i].id;
                    
                    if (!materialDoc.exists()) {
                        throw new Error(`Material with ID ${materialId} not found.`);
                    }
                    const requiredStock = materialStockDeltas.get(materialId)!;
                    const currentStock = materialDoc.data().stock;
                    if (currentStock < requiredStock) {
                        throw new Error(`Insufficient stock for ${materialDoc.data().name}. Required: ${requiredStock}, Available: ${currentStock}`);
                    }
                }

                for (let i = 0; i < materialDocs.length; i++) {
                    const materialDoc = materialDocs[i];
                    const materialId = materialRefs[i].id;
                    const requiredStock = materialStockDeltas.get(materialId)!;
                    const currentStock = materialDoc.data().stock;
                    transaction.update(materialRefs[i], { stock: currentStock - requiredStock });
                }

                const newOrderRef = doc(collection(db, 'orders'));
                transaction.set(newOrderRef.withConverter(orderConverter), {
                    status: 'Pending',
                    createdAt: new Date().toISOString(),
                    items: itemsToSave,
                });
            });
            toast({ title: "Order created successfully!" });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error creating order", description: error.message });
            return; 
        }
    }

    setIsSheetOpen(false);
    setSelectedOrder(null);
  }

  const handleUpdateStatus = async (order: Order, newStatus: 'Completed' | 'Cancelled') => {
    if (!order || order.status !== 'Pending') return;
    
    if (newStatus === 'Cancelled') {
        try {
            await runTransaction(db, async (transaction) => {
                for (const item of order.items) {
                    const drink = allDrinks.find(d => d.id === item.drinkId);
                    if (drink) {
                        for (const recipeItem of drink.recipe) {
                            const materialRef = doc(db, 'materials', recipeItem.materialId).withConverter(materialConverter);
                            const materialDoc = await transaction.get(materialRef);
                            if (!materialDoc.exists()) throw new Error("Material not found");
                            const stockToReturn = recipeItem.quantity * item.quantity;
                            transaction.update(materialRef, { stock: materialDoc.data().stock + stockToReturn });
                        }
                    }
                }
                const orderRef = doc(db, 'orders', order.id);
                transaction.update(orderRef, { status: newStatus });
            });
            toast({ title: "Order cancelled and stock restored."});
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error cancelling order", description: error.message });
        }
    } else if (newStatus === 'Completed') {
        const orderDocRef = doc(db, 'orders', order.id);
        await updateDoc(orderDocRef, { status: newStatus });
        toast({title: "Order marked as completed."});
    }
  };

  const getDrinkName = (id: string) => allDrinks.find(d => d.id === id)?.name || 'Unknown';

  const getOrderTotal = (items: OrderItem[]) => {
    return items.reduce((total, item) => {
        const drink = allDrinks.find(d => d.id === item.drinkId);
        return total + (drink ? drink.price * item.quantity : 0);
    }, 0);
  }

  const formatOrderDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('en-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Cairo',
      }).format(new Date(isoString));
    } catch (e) {
      return new Date(isoString).toLocaleDateString(); // Fallback
    }
  }


  if (ordersLoading || drinksLoading || materialsLoading) {
     return (
       <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
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
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> Create Order</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">{order.id}</TableCell>
                <TableCell>{formatOrderDate(order.createdAt)}</TableCell>
                <TableCell>
                  {order.items.map(i => `${i.quantity}x ${getDrinkName(i.drinkId)}`).join(', ')}
                </TableCell>
                <TableCell>${getOrderTotal(order.items).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={order.status === 'Completed' ? 'default' : order.status === 'Pending' ? 'secondary' : 'destructive'}>
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
                          <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'Completed')}>
                            <CheckCircle className="mr-2 h-4 w-4" /> Mark as Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'Cancelled')} className="text-destructive">
                             <XCircle className="mr-2 h-4 w-4" /> Mark as Cancelled
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem onClick={() => handleEditClick(order)} disabled={order.status !== 'Pending'}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteClick(order)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          <form onSubmit={handleFormSubmit}>
            <SheetHeader>
              <SheetTitle>{selectedOrder ? 'Edit Order' : 'Create New Order'}</SheetTitle>
              <SheetDescription>
                {selectedOrder ? 'Update the details of this order.' : 'Select drinks to create a new order.'}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              {selectedOrder && (
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">Status</Label>
                    <Select name="status" defaultValue={selectedOrder.status} disabled>
                        <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Set status" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
              )}
               <div>
                <Label>Drinks</Label>
                <ScrollArea className="h-72 mt-2 rounded-md border p-4">
                  <div className="space-y-4">
                    {allDrinks.map(drink => {
                      const orderItem = orderItems.find(item => item.drinkId === drink.id);
                      return (
                        <div key={drink.id} className="flex items-center gap-4">
                           <Checkbox
                              id={`drink-${drink.id}`}
                              checked={!!orderItem}
                              onCheckedChange={(checked) => handleItemChange(drink.id, checked)}
                           />
                          <Label htmlFor={`drink-${drink.id}`} className="flex-1">{drink.name} - ${drink.price.toFixed(2)}</Label>
                          {orderItem && (
                              <Input
                                  type="number"
                                  className="w-24"
                                  min="1"
                                  placeholder="Qty"
                                  defaultValue={orderItem.quantity}
                                  onChange={(e) => handleQuantityChange(drink.id, Number(e.target.value))}
                                  required
                               />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <SheetFooter>
              <Button type="submit">Save Order</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
