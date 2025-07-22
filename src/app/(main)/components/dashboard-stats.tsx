"use client";

import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { orderConverter, drinkConverter, materialConverter } from '@/lib/converters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Package, ShoppingCart, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { Order, Drink, Material } from '@/lib/types';


export function DashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [allOrdersSnapshot, allOrdersLoading] = useCollection(collection(db, 'orders').withConverter(orderConverter));
    const [todayOrdersSnapshot, todayOrdersLoading] = useCollection(
        query(
            collection(db, 'orders'),
            where('createdAt', '>=', today.toISOString()),
            where('createdAt', '<', tomorrow.toISOString())
        ).withConverter(orderConverter)
    );
    const [drinksSnapshot, drinksLoading] = useCollection(collection(db, 'drinks').withConverter(drinkConverter));
    const [materialsSnapshot, materialsLoading] = useCollection(collection(db, 'materials').withConverter(materialConverter));

    const allOrders = allOrdersSnapshot?.docs.map(doc => doc.data()) ?? [];
    const todayOrders = todayOrdersSnapshot?.docs.map(doc => doc.data()) ?? [];
    const drinks = drinksSnapshot?.docs.map(doc => doc.data()) ?? [];
    const materials = materialsSnapshot?.docs.map(doc => doc.data()) ?? [];
    
    const loading = allOrdersLoading || todayOrdersLoading || drinksLoading || materialsLoading;

    const totalRevenue = allOrders
        .filter((order) => order.status === 'Completed')
        .reduce((sum, order) => {
        const orderTotal = order.items.reduce((orderSum, item) => {
            const drink = drinks.find((d) => d.id === item.drinkId);
            return orderSum + (drink ? drink.price * item.quantity : 0);
        }, 0);
        return sum + orderTotal;
        }, 0);

    const dailyRevenue = todayOrders
        .filter((order) => order.status === 'Completed')
        .reduce((sum, order) => {
            const orderTotal = order.items.reduce((orderSum, item) => {
                const drink = drinks.find(d => d.id === item.drinkId);
                return orderSum + (drink ? drink.price * item.quantity : 0);
            }, 0);
            return sum + orderTotal;
        }, 0);

    const inStockItems = materials.filter(
        (material) => material.stock >= material.lowStockThreshold
    ).length;
    
    const lowStockItems = materials.filter(
        (material) => material.stock > 0 && material.stock < material.lowStockThreshold
    ).length;

    const outOfStockItems = materials.filter(
        (material) => material.stock === 0
    ).length;
    
    const dailyOrdersCount = todayOrders.length;
    const dailyPendingOrdersCount = todayOrders.filter(o => o.status === 'Pending').length;

    if (loading) {
        return (
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-4" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-12" />
                            <Skeleton className="h-4 w-32 mt-1" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                    All-time completed orders
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${dailyRevenue.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                    Today's completed orders
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Daily Orders</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">+{dailyOrdersCount}</div>
                    <p className="text-xs text-muted-foreground">
                    Orders placed today
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                    Daily Pending Orders
                    </CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                    {dailyPendingOrdersCount}
                    </div>
                    <p className="text-xs text-muted-foreground">
                    Awaiting completion from today
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                    In Stock
                    </CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{inStockItems}</div>
                    <p className="text-xs text-muted-foreground">
                    Items with healthy stock
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                    Low Stock
                    </CardTitle>
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{lowStockItems}</div>
                    <p className="text-xs text-muted-foreground">
                    Items needing re-order soon
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                    Out of Stock
                    </CardTitle>
                    <XCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{outOfStockItems}</div>
                    <p className="text-xs text-muted-foreground">
                    Items to re-order immediately
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
