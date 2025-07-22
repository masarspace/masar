
"use client";

import * as React from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { orderConverter, drinkConverter } from '@/lib/converters';
import type { Order, Drink } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as XLSX from 'xlsx';


type ReportData = {
    totalRevenue: number;
    totalOrders: number;
    drinksSold: {
        id: string;
        name: string;
        quantity: number;
        revenue: number;
    }[];
}

export function SalesReport() {
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date())});
    const [reportData, setReportData] = React.useState<ReportData | null>(null);
    const [loading, setLoading] = React.useState(false);
    
    const [drinksSnapshot, drinksLoading] = useCollection(collection(db, 'drinks').withConverter(drinkConverter));
    const allDrinks = React.useMemo(() => drinksSnapshot?.docs.map(doc => doc.data()) ?? [], [drinksSnapshot]);

    const handleGenerateReport = async () => {
        if (!dateRange?.from) return;
        setLoading(true);
        setReportData(null);

        const fromDate = startOfDay(dateRange.from);
        const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        
        const ordersQuery = query(
            collection(db, 'orders'),
            where('status', '==', 'Completed'),
            where('createdAt', '>=', fromDate.toISOString()),
            where('createdAt', '<=', toDate.toISOString())
        ).withConverter(orderConverter);

        const ordersSnapshot = await getDocs(ordersQuery);
        const completedOrders = ordersSnapshot.docs.map(d => d.data());

        let totalRevenue = 0;
        const drinksSoldMap = new Map<string, { name: string, quantity: number, revenue: number }>();

        completedOrders.forEach(order => {
            order.items.forEach(item => {
                const drink = allDrinks.find(d => d.id === item.drinkId);
                if (drink) {
                    const itemRevenue = drink.price * item.quantity;
                    totalRevenue += itemRevenue;
                    const existing = drinksSoldMap.get(drink.id) || { name: drink.name, quantity: 0, revenue: 0 };
                    existing.quantity += item.quantity;
                    existing.revenue += itemRevenue;
                    drinksSoldMap.set(drink.id, existing);
                }
            });
        });

        const drinksSold = Array.from(drinksSoldMap.entries()).map(([id, data]) => ({
            id,
            name: data.name,
            quantity: data.quantity,
            revenue: data.revenue
        })).sort((a,b) => b.revenue - a.revenue);

        setReportData({
            totalRevenue,
            totalOrders: completedOrders.length,
            drinksSold
        });
        setLoading(false);
    }

    const handleDownloadExcel = () => {
        if (!reportData) return;

        const summaryData = [
            { metric: "Total Revenue", value: `$${reportData.totalRevenue.toFixed(2)}` },
            { metric: "Total Orders", value: reportData.totalOrders },
            { metric: "Unique Drinks Sold", value: reportData.drinksSold.length },
        ];
        
        const drinksData = reportData.drinksSold.map(d => ({
            "Drink Name": d.name,
            "Quantity Sold": d.quantity,
            "Total Revenue": d.revenue,
        }));
        
        const summarySheet = XLSX.utils.json_to_sheet(summaryData, { skipHeader: true });
        const drinksSheet = XLSX.utils.json_to_sheet(drinksData);

        // Adjust column widths
        summarySheet['!cols'] = [{ wch: 20 }, { wch: 15 }];
        drinksSheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Sales Summary");
        XLSX.utils.book_append_sheet(workbook, drinksSheet, "Drink Sales Details");

        XLSX.writeFile(workbook, `SalesReport_${format(dateRange?.from || new Date(), 'yyyy-MM-dd')}_${format(dateRange?.to || new Date(), 'yyyy-MM-dd')}.xlsx`);
    };
    
    return (
        <div className="space-y-4">
            <div className="flex gap-2 items-center flex-wrap">
                 <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date-sales"
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
                <Button onClick={handleGenerateReport} disabled={loading || drinksLoading}>
                    {loading ? "Generating..." : "Generate Report"}
                </Button>
                {reportData && (
                    <Button variant="outline" onClick={handleDownloadExcel}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Excel
                    </Button>
                )}
            </div>
            
            {loading && <Skeleton className="h-48 w-full"/>}

            {reportData ? (
                 <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">${reportData.totalRevenue.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{reportData.totalOrders}</div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Unique Drinks Sold</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{reportData.drinksSold.length}</div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Drink Name</TableHead>
                                    <TableHead className="text-right">Quantity Sold</TableHead>
                                    <TableHead className="text-right">Total Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.drinksSold.map(drink => (
                                    <TableRow key={drink.id}>
                                        <TableCell className="font-medium">{drink.name}</TableCell>
                                        <TableCell className="text-right">{drink.quantity}</TableCell>
                                        <TableCell className="text-right">${drink.revenue.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                 </div>
            ) : !loading && (
                <Alert>
                    <Lightbulb className="h-4 w-4" />
                    <AlertTitle>Generate a Sales Report</AlertTitle>
                    <AlertDescription>
                        Select a date range and click "Generate Report" to see an analysis of your sales performance.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    )
}
