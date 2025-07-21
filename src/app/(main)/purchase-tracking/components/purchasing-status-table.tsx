
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, doc, runTransaction, query, orderBy, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { purchaseOrderConverter, materialConverter, purchaseCategoryConverter } from '@/lib/converters';
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
import { MoreHorizontal, CheckCircle, XCircle, Truck, RefreshCw, Search, Calendar as CalendarIcon } from 'lucide-react';
import type { PurchaseOrder } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [categoriesSnapshot, categoriesLoading] = useCollection(collection(db, 'purchaseCategories').withConverter(purchaseCategoryConverter));
  
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');

  const allMaterials = React.useMemo(() => materialsSnapshot?.docs.map(doc => doc.data()) ?? [], [materialsSnapshot]);
  const allCategories = React.useMemo(() => categoriesSnapshot?.docs.map(doc => doc.data()) ?? [], [categoriesSnapshot]);
  
  const getMaterialName = React.useCallback((id: string) => allMaterials.find(m => m.id === id)?.name || 'Unknown', [allMaterials]);

  const purchaseOrders = React.useMemo(() => {
    let baseOrders = purchaseOrdersSnapshot?.docs.map(doc => doc.data()) ?? [];
    
    if (dateRange?.from) {
        const fromDate = startOfDay(dateRange.from);
        const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        baseOrders = baseOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= fromDate && orderDate <= toDate;
        });
    }

    if (categoryFilter !== 'all') {
        baseOrders = baseOrders.filter(order => order.category.id === categoryFilter);
    }

    if (searchTerm) {
        baseOrders = baseOrders.filter(order => 
            order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.items.some(item => getMaterialName(item.materialId).toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }
    
    return baseOrders;
  }, [purchaseOrdersSnapshot, searchTerm, dateRange, categoryFilter, getMaterialName]);

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

  const handleUpdateStatus = async (orderId: string, newStatus: PurchaseOrder['status']) => {
     try {
        await runTransaction(db, async (transaction) => {
            const orderRef = doc(db, 'purchaseOrders', orderId).withConverter(purchaseOrderConverter);
            const orderDoc = await transaction.get(orderRef);
            if (!orderDoc.exists()) throw new Error("Purchase order not found.");
            
            const orderData = orderDoc.data();
            const oldStatus = orderData.status;

            if (oldStatus === newStatus) return;

            const materialRefs = orderData.items.map(item => 
                doc(db, 'materials', item.materialId).withConverter(materialConverter)
            );
            const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref)));
            
            const poUpdateData: any = { status: newStatus };

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

  if (poLoading || materialsLoading || categoriesLoading) {
     return (
       <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
            <div className="flex gap-2">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-40" />
            </div>
        </div>
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
    <>
    <div className="flex items-center mb-4 gap-2 flex-wrap">
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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
        {(dateRange || categoryFilter !== 'all') && <Button variant="ghost" onClick={() => { setSearchTerm(''); setDateRange(undefined); setCategoryFilter('all'); }}>Clear Filters</Button>}
    </div>
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
                    <div className="space-y-1">
                        {order.items.map((i, index) => (
                            <div key={index}>
                                <span>{i.quantity}{i.unit} x {getMaterialName(i.materialId)}</span>
                                {i.note && <p className="text-muted-foreground italic text-xs pl-2">- {i.note}</p>}
                            </div>
                        ))}
                    </div>
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
    </>
  );
}
