
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, doc, updateDoc, deleteDoc, runTransaction, writeBatch } from 'firebase/firestore';
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
  const [currentStatus, setCurrentStatus] = React.useState<Order['status'] | undefined>();

  React.useEffect(() => {
    if(selectedOrder) {
      setOrderItems(selectedOrder.items);
      setCurrentStatus(selectedOrder.status);
    } else {
      setOrderItems([]);
      setCurrentStatus('Pending');
    }
  }, [selectedOrder, isSheetOpen]);

  const handleAddClick = () => {
    setSelectedOrder(null);
    setOrderItems([]);
    setCurrentStatus('Pending');
    setIsSheetOpen(true);
  };

  const handleEditClick = (order: Order) => {
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = async (order: Order) => {
    if (!order.id) return;
    
    // Only return stock if the order was 'Completed' before deletion
    if (order.status === 'Completed') {
      try {
        await runTransaction(db, async (transaction) => {
          // Calculate stock to return
          const stockToReturn = new Map<string, number>();
          for (const item of order.items) {
            const drink = allDrinks.find(d => d.id === item.drinkId);
            if (drink) {
              for (const recipeItem of drink.recipe) {
                stockToReturn.set(recipeItem.materialId, (stockToReturn.get(recipeItem.materialId) || 0) + (recipeItem.quantity * item.quantity));
              }
            }
          }

          // Read all material docs
          const materialRefs = Array.from(stockToReturn.keys()).map(id => doc(db, 'materials', id));
          const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref.withConverter(materialConverter))));
          
          // Write all updates
          for (const materialDoc of materialDocs) {
            if (materialDoc.exists()) {
              const stockToAdd = stockToReturn.get(materialDoc.id) || 0;
              const newStock = materialDoc.data().stock + stockToAdd;
              transaction.update(materialDoc.ref, { stock: newStock });
            }
          }
          
          // Delete the order
          transaction.delete(doc(db, 'orders', order.id));
        });
        toast({ title: "Order deleted and stock restored." });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error deleting order", description: error.message });
      }
    } else {
      // If not completed, just delete it
      await deleteDoc(doc(db, 'orders', order.id));
      toast({ title: "Order deleted." });
    }
  };

  const handleUpdateStatus = async (order: Order, newStatus: Order['status']) => {
    if (order.status === newStatus) return;

    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', order.id);

            // Case 1: Pending -> Completed (Deduct stock)
            if (order.status === 'Pending' && newStatus === 'Completed') {
                const stockToDeduct = new Map<string, number>();
                for (const item of order.items) {
                    const drink = allDrinks.find(d => d.id === item.drinkId);
                    if (drink) {
                        for (const recipeItem of drink.recipe) {
                            stockToDeduct.set(recipeItem.materialId, (stockToDeduct.get(recipeItem.materialId) || 0) + (recipeItem.quantity * item.quantity));
                        }
                    }
                }
                const materialRefs = Array.from(stockToDeduct.keys()).map(id => doc(db, 'materials', id).withConverter(materialConverter));
                const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref)));

                for (const materialDoc of materialDocs) {
                    if (!materialDoc.exists()) throw new Error(`Material ${materialDoc.id} not found.`);
                    const newStock = materialDoc.data().stock - (stockToDeduct.get(materialDoc.id) || 0);
                    if (newStock < 0) throw new Error(`Insufficient stock for ${materialDoc.data().name}.`);
                    transaction.update(materialDoc.ref, { stock: newStock });
                }
            }
            // Case 2: Completed -> Pending or Cancelled (Return stock)
            else if (order.status === 'Completed' && (newStatus === 'Pending' || newStatus === 'Cancelled')) {
                const stockToReturn = new Map<string, number>();
                for (const item of order.items) {
                    const drink = allDrinks.find(d => d.id === item.drinkId);
                    if (drink) {
                        for (const recipeItem of drink.recipe) {
                            stockToReturn.set(recipeItem.materialId, (stockToReturn.get(recipeItem.materialId) || 0) + (recipeItem.quantity * item.quantity));
                        }
                    }
                }
                const materialRefs = Array.from(stockToReturn.keys()).map(id => doc(db, 'materials', id).withConverter(materialConverter));
                const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref)));

                for (const materialDoc of materialDocs) {
                    if (materialDoc.exists()) {
                        const newStock = materialDoc.data().stock + (stockToReturn.get(materialDoc.id) || 0);
                        transaction.update(materialDoc.ref, { stock: newStock });
                    }
                }
            }
            
            transaction.update(orderRef, { status: newStatus });
        });
        toast({ title: "Order status updated successfully!" });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error updating status", description: error.message });
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
    const newStatus = currentStatus;

    if (!newStatus) {
        toast({ variant: "destructive", title: "Cannot save order", description: "Please select a status." });
        return;
    }
    
    if (itemsToSave.length === 0) {
        toast({ variant: "destructive", title: "Cannot save order", description: "Please add at least one drink to the order." });
        return;
    }

    try {
        if (selectedOrder) {
            // Editing an existing order
            await runTransaction(db, async (transaction) => {
                const orderRef = doc(db, 'orders', selectedOrder.id);
                const oldStatus = selectedOrder.status;
                const oldItems = selectedOrder.items;
                
                const stockChanges = new Map<string, number>(); // positive to add stock, negative to remove

                // If was completed, return stock for old items
                if (oldStatus === 'Completed') {
                    for(const item of oldItems) {
                        const drink = allDrinks.find(d => d.id === item.drinkId);
                        if (drink) {
                            for (const recipeItem of drink.recipe) {
                                stockChanges.set(recipeItem.materialId, (stockChanges.get(recipeItem.materialId) || 0) + recipeItem.quantity * item.quantity);
                            }
                        }
                    }
                }

                // If will be completed, deduct stock for new items
                if (newStatus === 'Completed') {
                     for(const item of itemsToSave) {
                        const drink = allDrinks.find(d => d.id === item.drinkId);
                        if (drink) {
                            for (const recipeItem of drink.recipe) {
                                stockChanges.set(recipeItem.materialId, (stockChanges.get(recipeItem.materialId) || 0) - recipeItem.quantity * item.quantity);
                            }
                        }
                    }
                }

                const materialIds = Array.from(stockChanges.keys());
                if (materialIds.length > 0) {
                    const materialRefs = materialIds.map(id => doc(db, 'materials', id).withConverter(materialConverter));
                    const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref)));
                    
                    for(const materialDoc of materialDocs) {
                         if (!materialDoc.exists()) throw new Error(`Material with ID ${materialDoc.id} not found.`);
                         const change = stockChanges.get(materialDoc.id) || 0;
                         const newStock = materialDoc.data().stock + change;
                         if (newStock < 0) throw new Error(`Insufficient stock for ${materialDoc.data().name}.`);
                         transaction.update(materialDoc.ref, { stock: newStock });
                    }
                }

                transaction.update(orderRef, { items: itemsToSave, status: newStatus });
            });
            toast({ title: "Order updated successfully!" });

        } else {
            // Creating a new order
            const batch = writeBatch(db);
            const newOrderRef = doc(collection(db, 'orders'));
            batch.set(newOrderRef.withConverter(orderConverter), {
                status: 'Pending', // New orders are always pending
                createdAt: new Date().toISOString(),
                items: itemsToSave,
            });
            await batch.commit();
            toast({ title: "Order created successfully!" });
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error saving order", description: error.message });
        return; 
    }

    setIsSheetOpen(false);
    setSelectedOrder(null);
  }

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
                                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                Mark as Completed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'Cancelled')} className="text-destructive">
                                <XCircle className="mr-2 h-4 w-4" />
                                Mark as Cancelled
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                       )}
                       <DropdownMenuItem onClick={() => handleEditClick(order)} disabled={order.status === 'Cancelled'}>
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
                    <Select name="status" value={currentStatus} onValueChange={(value) => setCurrentStatus(value as Order['status'])} >
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
                              disabled={currentStatus === 'Cancelled'}
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
                                  disabled={currentStatus === 'Cancelled'}
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
