"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, PlusCircle, Edit, Trash2 } from 'lucide-react';
import type { Order, OrderItem, Drink } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

export function OrdersTable() {
  const [ordersSnapshot, ordersLoading] = useCollection(collection(db, 'orders').withConverter(orderConverter));
  const [drinksSnapshot, drinksLoading] = useCollection(collection(db, 'drinks').withConverter(drinkConverter));

  const orders = ordersSnapshot?.docs.map(doc => doc.data()).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) ?? [];
  const allDrinks = drinksSnapshot?.docs.map(doc => doc.data()) ?? [];

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
    setSelectedOrder(order);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if(!id) return;
    await deleteDoc(doc(db, 'orders', id));
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
    const formData = new FormData(e.currentTarget);
    const orderData: Omit<Order, 'id'> = {
        status: (formData.get('status') as Order['status']) || 'Pending',
        createdAt: selectedOrder ? selectedOrder.createdAt : new Date().toISOString(),
        items: orderItems.filter(i => i.quantity > 0),
    };

    if (selectedOrder) {
        const orderDocRef = doc(db, 'orders', selectedOrder.id);
        await updateDoc(orderDocRef, orderData);
    } else {
        await addDoc(collection(db, 'orders').withConverter(orderConverter), orderData);
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

  if (ordersLoading || drinksLoading) {
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
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
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
                <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
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
                      <DropdownMenuItem onClick={() => handleEditClick(order)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteClick(order.id)} className="text-destructive">
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
                    <Select name="status" defaultValue={selectedOrder.status}>
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
