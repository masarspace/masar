"use client";

import { useCollection } from 'react-firebase-hooks/firestore';
import { collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { orderConverter, drinkConverter, materialConverter } from '@/lib/converters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Package, ShoppingCart, AlertTriangle } from 'lucide-react';
import type { Order, Drink, Material } from '@/lib/types';


export function DashboardStats() {
    const [ordersSnapshot, ordersLoading] = useCollection(collection(db, 'orders').withConverter(orderConverter));
    const [drinksSnapshot, drinksLoading] = useCollection(collection(db, 'drinks').withConverter(drinkConverter));
    const [materialsSnapshot, materialsLoading] = useCollection(collection(db, 'materials').withConverter(materialConverter));

    const orders = ordersSnapshot?.docs.map(doc => doc.data()) ?? [];
    const drinks = drinksSnapshot?.docs.map(doc => doc.data()) ?? [];
    const materials = materialsSnapshot?.docs.map(doc => doc.data()) ?? [];
    
    const loading = ordersLoading || drinksLoading || materialsLoading;

    const totalRevenue = orders
        .filter((order) => order.status === 'Completed')
        .reduce((sum, order) => {
        const orderTotal = order.items.reduce((orderSum, item) => {
            const drink = drinks.find((d) => d.id === item.drinkId);
            return orderSum + (drink ? drink.price * item.quantity : 0);
        }, 0);
        return sum + orderTotal;
        }, 0);

    const lowStockItems = materials.filter(
        (material) => material.stock < material.lowStockThreshold
    );

    const pendingOrdersCount = orders.filter((o) => o.status === 'Pending').length;

    const totalOrdersCount = orders.length;

    if (loading) {
        return (
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-4 w-32 mt-1" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-8 w-12" />
                        <Skeleton className="h-4 w-28 mt-1" />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                         <Skeleton className="h-8 w-12" />
                        <Skeleton className="h-4 w-24 mt-1" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                         <AlertTriangle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                         <Skeleton className="h-8 w-12" />
                        <Skeleton className="h-4 w-28 mt-1" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                    Based on completed orders
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">+{totalOrdersCount}</div>
                    <p className="text-xs text-muted-foreground">
                    Across all statuses
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                    Pending Orders
                    </CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                    {pendingOrdersCount}
                    </div>
                    <p className="text-xs text-muted-foreground">
                    Awaiting completion
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                    Low Stock Items
                    </CardTitle>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{lowStockItems.length}</div>
                    <p className="text-xs text-muted-foreground">
                    Items needing re-order
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
