
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, doc, runTransaction, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { orderConverter, drinkConverter, materialConverter, auditLogConverter } from '@/lib/converters';
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
import { MoreHorizontal, PlusCircle, Edit, Trash2, CheckCircle, XCircle, Search, Calendar as CalendarIcon } from 'lucide-react';
import type { Order, OrderItem } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';


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

export function OrdersTable() {
  const [ordersSnapshot, ordersLoading] = useCollection(collection(db, 'orders').withConverter(orderConverter));
  const [drinksSnapshot, drinksLoading] = useCollection(collection(db, 'drinks').withConverter(drinkConverter));
  const [materialsSnapshot, materialsLoading] = useCollection(collection(db, 'materials').withConverter(materialConverter));
  const { toast } = useToast();

  const allDrinks = React.useMemo(() => drinksSnapshot?.docs.map(doc => doc.data()) ?? [], [drinksSnapshot]);
  const allMaterials = React.useMemo(() => materialsSnapshot?.docs.map(doc => doc.data()) ?? [], [materialsSnapshot]);

  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [orderItems, setOrderItems] = React.useState<OrderItem[]>([]);
  const [currentStatus, setCurrentStatus] = React.useState<Order['status'] | undefined>();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  const getDrinkName = React.useCallback((id: string) => allDrinks.find(d => d.id === id)?.name || 'Unknown', [allDrinks]);

  const orders = React.useMemo(() => {
    let baseOrders = ordersSnapshot?.docs.map(doc => doc.data()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) ?? [];
    
    if (dateRange?.from) {
        const fromDate = startOfDay(dateRange.from);
        const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        baseOrders = baseOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= fromDate && orderDate <= toDate;
        });
    }

    if (searchTerm) {
        baseOrders = baseOrders.filter(order => 
            order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.items.some(item => getDrinkName(item.drinkId).toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }
    
    return baseOrders;
  }, [ordersSnapshot, searchTerm, dateRange, getDrinkName]);

  const [formattedDates, setFormattedDates] = React.useState<Map<string, string>>(new Map());
  
  React.useEffect(() => {
    if (orders.length > 0) {
      const newFormattedDates = new Map<string, string>();
      for (const order of orders) {
        // This effect runs only on the client, so `Intl` is safe here.
         newFormattedDates.set(order.id, new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(new Date(order.createdAt)));
      }
      setFormattedDates(newFormattedDates);
    }
  }, [orders]);
  
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
    
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', order.id);

        if (order.status !== 'Completed') {
          // If order was not completed, just delete it. No stock changes needed.
          transaction.delete(orderRef);
          return;
        }

        // --- READ PHASE ---
        // Collect all material refs and read them
        const materialRefsToRead = new Map<string, ReturnType<typeof doc>>();
        for (const item of order.items) {
          const drink = allDrinks.find(d => d.id === item.drinkId);
          if (drink) {
            for (const recipeItem of drink.recipe) {
              if (!materialRefsToRead.has(recipeItem.materialId)) {
                materialRefsToRead.set(recipeItem.materialId, doc(db, 'materials', recipeItem.materialId).withConverter(materialConverter));
              }
            }
          }
        }
        
        const materialDocs = await Promise.all(
          Array.from(materialRefsToRead.values()).map(ref => transaction.get(ref))
        );

        const materialDocsMap = new Map(materialDocs.map(doc => [doc.id, doc]));

        // --- WRITE PHASE ---
        // Now perform all writes
        for (const item of order.items) {
          const drink = allDrinks.find(d => d.id === item.drinkId);
          if (drink) {
            for (const recipeItem of drink.recipe) {
              const materialDoc = materialDocsMap.get(recipeItem.materialId);
              
              if (materialDoc && materialDoc.exists()) {
                const materialData = materialDoc.data();
                const conversionFactor = getConversionFactor(recipeItem.unit, materialData.unit);
                const stockToAdd = (recipeItem.quantity * item.quantity) * conversionFactor;

                // Update stock
                transaction.update(materialDoc.ref, { stock: materialData.stock + stockToAdd });
                
                // Log audit
                const auditLogRef = doc(collection(db, 'auditLog'));
                transaction.set(auditLogRef.withConverter(auditLogConverter), {
                  id: auditLogRef.id,
                  materialId: recipeItem.materialId,
                  materialName: materialData.name,
                  change: stockToAdd,
                  type: 'adjustment',
                  relatedId: order.id,
                  createdAt: new Date().toISOString()
                });
              }
            }
          }
        }
        
        transaction.delete(orderRef);
      });
      toast({ title: "Order deleted successfully." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error deleting order", description: error.message });
    }
  };

  const handleUpdateStatus = async (order: Order, newStatus: Order['status']) => {
    if (order.status === newStatus) return;

    try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'orders', order.id);
            const oldStatus = order.status;

            const materialChanges = new Map<string, { change: number, name: string }>();

            const calculateChanges = (multiplier: 1 | -1) => {
                 for (const item of order.items) {
                    const drink = allDrinks.find(d => d.id === item.drinkId);
                    if (drink) {
                        for (const recipeItem of drink.recipe) {
                            const material = allMaterials.find(m => m.id === recipeItem.materialId);
                            if (!material) continue;
                            const conversionFactor = getConversionFactor(recipeItem.unit, material.unit);
                            const change = (recipeItem.quantity * item.quantity * conversionFactor) * multiplier;

                            const existing = materialChanges.get(recipeItem.materialId) || { change: 0, name: ''};
                            materialChanges.set(recipeItem.materialId, {
                                change: existing.change + change,
                                name: material.name
                            });
                        }
                    }
                }
            }
            
            if (oldStatus === 'Completed') calculateChanges(1); // Return stock
            if (newStatus === 'Completed') calculateChanges(-1); // Deduct stock
            
            const materialRefs = Array.from(materialChanges.keys()).map(id => doc(db, 'materials', id).withConverter(materialConverter));
            const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref)));
            
            for(const materialDoc of materialDocs) {
                if (!materialDoc.exists()) throw new Error(`Material with ID ${materialDoc.id} not found.`);
                const changeData = materialChanges.get(materialDoc.id);
                if (!changeData) continue;

                const newStock = materialDoc.data().stock + changeData.change;
                if (newStock < 0) throw new Error(`Insufficient stock for ${materialDoc.data().name}.`);
                
                transaction.update(materialDoc.ref, { stock: newStock });

                // Log audit
                const auditLogRef = doc(collection(db, 'auditLog'));
                transaction.set(auditLogRef.withConverter(auditLogConverter), {
                    id: auditLogRef.id,
                    materialId: materialDoc.id,
                    materialName: materialDoc.data().name,
                    change: changeData.change,
                    type: changeData.change > 0 ? 'adjustment' : 'sale',
                    relatedId: order.id,
                    createdAt: new Date().toISOString()
                });
            }

            transaction.update(orderRef, { status: newStatus });
        });
        toast({ title: `Order marked as ${newStatus}.` });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error updating status", description: error.message });
    }
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
                
                const materialChanges = new Map<string, { change: number, name: string }>();

                const calculateChanges = (items: OrderItem[], multiplier: 1 | -1) => {
                    for(const item of items) {
                        const drink = allDrinks.find(d => d.id === item.drinkId);
                        if (drink) {
                            for (const recipeItem of drink.recipe) {
                                const material = allMaterials.find(m => m.id === recipeItem.materialId);
                                if (!material) continue;
                                const conversionFactor = getConversionFactor(recipeItem.unit, material.unit);
                                const change = (recipeItem.quantity * item.quantity * conversionFactor) * multiplier;

                                const existing = materialChanges.get(recipeItem.materialId) || { change: 0, name: '' };
                                materialChanges.set(recipeItem.materialId, {
                                    change: existing.change + change,
                                    name: material.name
                                });
                            }
                        }
                    }
                }

                // Revert old items if order was completed
                if (oldStatus === 'Completed') {
                   calculateChanges(oldItems, 1);
                }

                // Apply new items if order is now completed
                if (newStatus === 'Completed') {
                     calculateChanges(itemsToSave, -1);
                }

                const materialIds = Array.from(materialChanges.keys());
                if (materialIds.length > 0) {
                    const materialRefs = materialIds.map(id => doc(db, 'materials', id).withConverter(materialConverter));
                    const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref)));
                    
                    for(const materialDoc of materialDocs) {
                         if (!materialDoc.exists()) throw new Error(`Material with ID ${materialDoc.id} not found.`);
                         const changeData = materialChanges.get(materialDoc.id);
                         if (!changeData) continue;
                         const newStock = materialDoc.data().stock + changeData.change;
                         if (newStock < 0) throw new Error(`Insufficient stock for ${materialDoc.data().name}.`);
                         transaction.update(materialDoc.ref, { stock: newStock });

                         // Log audit
                        const auditLogRef = doc(collection(db, 'auditLog'));
                        transaction.set(auditLogRef.withConverter(auditLogConverter), {
                            id: auditLogRef.id,
                            materialId: materialDoc.id,
                            materialName: materialDoc.data().name,
                            change: changeData.change,
                            type: 'adjustment',
                            relatedId: selectedOrder.id,
                            createdAt: new Date().toISOString()
                        });
                    }
                }

                transaction.update(orderRef, { items: itemsToSave, status: newStatus });
            });
            toast({ title: "Order updated successfully!" });

        } else {
            // Creating a new order - NO stock change here. Stock is only deducted on completion.
            const newOrderRef = doc(collection(db, 'orders'));
            await runTransaction(db, async (transaction) => {
                 transaction.set(newOrderRef.withConverter(orderConverter), {
                    id: newOrderRef.id,
                    status: 'Pending', // New orders are always pending
                    createdAt: new Date().toISOString(),
                    items: itemsToSave,
                });
            });
            toast({ title: "Order created successfully!" });
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error saving order", description: error.message });
        return; 
    }

    setIsSheetOpen(false);
    setSelectedOrder(null);
  }

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

  const getOrderTotal = (items: OrderItem[]) => {
    return items.reduce((total, item) => {
        const drink = allDrinks.find(d => d.id === item.drinkId);
        return total + (drink ? drink.price * item.quantity : 0);
    }, 0);
  }

  if (ordersLoading || drinksLoading || materialsLoading) {
     return (
       <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
            <div className="flex gap-2">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-48" />
            </div>
            <Skeleton className="h-10 w-36" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">Order ID</TableHead>
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
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-36" /></TableCell>
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
    <>
      <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
        <div className="flex gap-2 items-center flex-wrap">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search orders..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className="w-[260px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {dateRange && <Button variant="ghost" onClick={() => setDateRange(undefined)}>Clear</Button>}
        </div>
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> Create Order</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell">Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="hidden md:table-cell">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="hidden sm:table-cell font-mono text-xs">{order.id}</TableCell>
                <TableCell>{formattedDates.get(order.id) || <Skeleton className="h-5 w-36" />}</TableCell>
                <TableCell>
                  {order.items.map(i => `${i.quantity}x ${getDrinkName(i.drinkId)}`).join(', ')}
                </TableCell>
                <TableCell className="hidden md:table-cell">${getOrderTotal(order.items).toFixed(2)}</TableCell>
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
                            <DropdownMenuItem onClick={() => handleUpdateStatus(order, 'Cancelled')}>
                                <XCircle className="mr-2 h-4 w-4 text-destructive" />
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
                 <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                    <Label htmlFor="status" className="sm:text-right">Status</Label>
                    <Select name="status" value={currentStatus} onValueChange={(value) => setCurrentStatus(value as Order['status'])} disabled={currentStatus === 'Cancelled'}>
                        <SelectTrigger className="sm:col-span-3">
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
              <Button type="submit" disabled={currentStatus === 'Cancelled'}>Save Order</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

    

    