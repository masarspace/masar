
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { auditLogConverter, materialConverter } from '@/lib/converters';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Search } from 'lucide-react';
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

type ReportRow = {
    materialId: string;
    materialName: string;
    unit: string;
    purchased: number;
    sold: number;
    waste: number;
    wastePercentage: number;
}

export function WastageReport() {
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date())});
    const [reportData, setReportData] = React.useState<ReportRow[]>([]);
    const [loading, setLoading] = React.useState(false);
    
    const [materialsSnapshot, materialsLoading] = useCollection(collection(db, 'materials').withConverter(materialConverter));
    const allMaterials = React.useMemo(() => materialsSnapshot?.docs.map(doc => doc.data()) ?? [], [materialsSnapshot]);

    const handleGenerateReport = async () => {
        if (!dateRange?.from) return;
        setLoading(true);

        const fromDate = startOfDay(dateRange.from);
        const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        
        const auditLogQuery = query(
            collection(db, 'auditLog'),
            where('createdAt', '>=', fromDate.toISOString()),
            where('createdAt', '<=', toDate.toISOString())
        ).withConverter(auditLogConverter);

        const auditLogSnapshot = await getDocs(auditLogQuery);
        const logs = auditLogSnapshot.docs.map(d => d.data());

        const reportMap = new Map<string, { purchased: number, sold: number }>();

        logs.forEach(log => {
            const entry = reportMap.get(log.materialId) || { purchased: 0, sold: 0 };
            if (log.type === 'purchase') {
                entry.purchased += log.change;
            } else if (log.type === 'sale') {
                entry.sold += Math.abs(log.change);
            }
            reportMap.set(log.materialId, entry);
        });

        const data: ReportRow[] = Array.from(reportMap.entries()).map(([materialId, values]) => {
            const material = allMaterials.find(m => m.id === materialId);
            const waste = values.purchased - values.sold;
            const wastePercentage = values.purchased > 0 ? (waste / values.purchased) * 100 : 0;
            return {
                materialId,
                materialName: material?.name || 'Unknown',
                unit: material?.unit || '',
                purchased: values.purchased,
                sold: values.sold,
                waste: waste,
                wastePercentage: wastePercentage,
            }
        });

        setReportData(data.sort((a,b) => b.wastePercentage - a.wastePercentage));
        setLoading(false);
    }
    
    const isReportGenerated = reportData.length > 0;

    return (
        <div className="space-y-4">
            <div className="flex gap-2 items-center flex-wrap">
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
                <Button onClick={handleGenerateReport} disabled={loading || materialsLoading}>
                    {loading ? "Generating..." : "Generate Report"}
                </Button>
            </div>
            
            {loading ? (
                 <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Purchased</TableHead>
                        <TableHead>Used in Sales</TableHead>
                        <TableHead>Wastage</TableHead>
                        <TableHead>Wastage %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(3)].map((_,i) => (
                             <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                                <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                                <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                                <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                                <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
            ) : isReportGenerated ? (
                 <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Purchased</TableHead>
                        <TableHead>Used in Sales</TableHead>
                        <TableHead>Wastage (Potential)</TableHead>
                        <TableHead>Wastage %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportData.map(row => (
                            <TableRow key={row.materialId}>
                                <TableCell>{row.materialName}</TableCell>
                                <TableCell>{row.purchased.toFixed(2)} {row.unit}</TableCell>
                                <TableCell>{row.sold.toFixed(2)} {row.unit}</TableCell>
                                <TableCell className={row.waste > 0 ? "text-destructive" : ""}>
                                    {row.waste.toFixed(2)} {row.unit}
                                </TableCell>
                                <TableCell className={row.wastePercentage > 10 ? "text-destructive font-bold" : ""}>
                                    {row.wastePercentage.toFixed(1)}%
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
            ) : (
                <Alert>
                    <Lightbulb className="h-4 w-4" />
                    <AlertTitle>Generate a Report</AlertTitle>
                    <AlertDescription>
                        Select a date range and click "Generate Report" to see an analysis of your material wastage.
                    </AlertDescription>
                </Alert>
            )}
        </div>
    )
}
