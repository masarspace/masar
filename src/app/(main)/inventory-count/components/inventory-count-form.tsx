
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, doc, runTransaction, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { materialConverter, inventoryCountConverter, auditLogConverter } from '@/lib/converters';
import type { Material, InventoryCount, InventoryCountItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Save, AlertCircle, FileText, RefreshCw, Download } from 'lucide-react';
import { format, startOfDay, endOfDay, isToday, setHours, setMinutes } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { DateRange } from 'react-day-picker';
import * as XLSX from 'xlsx';


type CountInput = {
    materialId: string;
    countedStock: string;
}

export function InventoryCountForm() {
    const [materialsSnapshot, materialsLoading] = useCollection(collection(db, 'materials').withConverter(materialConverter));
    const [allCountsSnapshot, allCountsLoading] = useCollection(query(collection(db, 'inventoryCounts'), orderBy('date', 'desc')).withConverter(inventoryCountConverter));
    
    const allMaterials = React.useMemo(() => materialsSnapshot?.docs.map(doc => doc.data()) ?? [], [materialsSnapshot]);

    const [countDate, setCountDate] = React.useState<Date | undefined>(new Date());
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();
    const [counts, setCounts] = React.useState<CountInput[]>([]);
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
    const [reportData, setReportData] = React.useState<InventoryCount | null>(null);
    const [hour, setHour] = React.useState(new Date().getHours().toString().padStart(2,'0'));
    const [minute, setMinute] = React.useState(new Date().getMinutes().toString().padStart(2,'0'));
    const [previousCountsDateRange, setPreviousCountsDateRange] = React.useState<DateRange | undefined>();

    const previousCounts = React.useMemo(() => {
        let baseCounts = allCountsSnapshot?.docs.map(doc => doc.data()) ?? [];
        if (previousCountsDateRange?.from) {
            const fromDate = startOfDay(previousCountsDateRange.from);
            const toDate = previousCountsDateRange.to ? endOfDay(previousCountsDateRange.to) : endOfDay(previousCountsDateRange.from);
            baseCounts = baseCounts.filter(count => {
                const countDate = new Date(count.date);
                return countDate >= fromDate && countDate <= toDate;
            });
        }
        return baseCounts;
    }, [allCountsSnapshot, previousCountsDateRange]);


    React.useEffect(() => {
        if (allMaterials.length > 0) {
            setCounts(allMaterials.map(m => ({ materialId: m.id, countedStock: '' })));
        }
    }, [allMaterials]);

    const handleCountChange = (materialId: string, value: string) => {
        setCounts(currentCounts => currentCounts.map(c => c.materialId === materialId ? {...c, countedStock: value} : c));
    }
    
    const getFullCountDate = React.useCallback(() => {
        if (!countDate) return null;
        const h = parseInt(hour, 10);
        const m = parseInt(minute, 10);
        if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) return null;

        return setMinutes(setHours(countDate, h), m);
    }, [countDate, hour, minute]);


    const handleSubmitClick = async () => {
        const fullCountDate = getFullCountDate();
        if (!fullCountDate) {
            toast({ variant: 'destructive', title: 'Please select a valid date and time for the count.' });
            return;
        }
        
        const itemsToSave = counts.filter(c => c.countedStock !== '' && !isNaN(parseFloat(c.countedStock)));
        if (itemsToSave.length === 0) {
            toast({ variant: 'destructive', title: 'Please enter a count for at least one material.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const newReportItems: InventoryCountItem[] = [];
            
            const countTimestamp = fullCountDate;

            for (const item of itemsToSave) {
                const material = allMaterials.find(m => m.id === item.materialId)!;
                let systemStock = material.stock; // Start with current stock

                // Get all audit logs for this material
                const auditLogQuery = query(
                    collection(db, 'auditLog'),
                    where('materialId', '==', item.materialId)
                ).withConverter(auditLogConverter);

                const auditLogSnapshot = await getDocs(auditLogQuery);
                const allLogsForMaterial = auditLogSnapshot.docs.map(d => d.data());
                
                // Filter logs that happened *after* the count date on the client
                const logsAfterCount = allLogsForMaterial.filter(log => new Date(log.createdAt) > countTimestamp);


                // Rewind the stock changes to get the historical stock
                for (const log of logsAfterCount) {
                    systemStock -= log.change;
                }

                const countedStock = parseFloat(item.countedStock);
                const wastage = systemStock - countedStock;
                
                newReportItems.push({
                    materialId: material.id,
                    materialName: material.name,
                    unit: material.unit,
                    systemStock,
                    countedStock,
                    wastage
                });
            }
            
            setReportData({
                id: '', // temp ID
                date: new Date().toISOString(), // Use precise timestamp for the record itself
                items: newReportItems
            });

            setIsConfirmOpen(true);
        } catch (error: any) {
             toast({ variant: "destructive", title: "Error calculating historical stock", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmSubmit = async () => {
        const fullCountDate = getFullCountDate();
        if (!reportData || !fullCountDate) return;
        setIsSubmitting(true);
        
        const shouldAdjustStock = isToday(fullCountDate);

        try {
            await runTransaction(db, async (transaction) => {
                const countRef = doc(collection(db, 'inventoryCounts'));
                
                // --- READ PHASE ---
                const itemsWithChanges = reportData.items.filter(item => (item.countedStock - item.systemStock) !== 0);
                const materialRefs = shouldAdjustStock ? itemsWithChanges.map(item => doc(db, 'materials', item.materialId).withConverter(materialConverter)) : [];
                
                const materialDocs = shouldAdjustStock ? await Promise.all(materialRefs.map(ref => transaction.get(ref))) : [];
                const materialMap = new Map(materialDocs.map(doc => [doc.id, doc]));

                // --- WRITE PHASE ---
                // 1. Set the inventory count report
                transaction.set(countRef.withConverter(inventoryCountConverter), { ...reportData, id: countRef.id, date: fullCountDate.toISOString() });
                
                // 2. Update materials and create audit logs ONLY IF date is today
                if (shouldAdjustStock) {
                    for(const item of itemsWithChanges) {
                        const materialDoc = materialMap.get(item.materialId);
                        if (!materialDoc || !materialDoc.exists()) {
                            throw new Error(`Material ${item.materialName} not found during transaction.`);
                        }

                        const changeRequired = item.countedStock - materialDoc.data().stock;
                        
                        transaction.update(materialDoc.ref, { stock: item.countedStock });

                        if(changeRequired !== 0) {
                            const auditLogRef = doc(collection(db, 'auditLog'));
                            transaction.set(auditLogRef.withConverter(auditLogConverter), {
                                id: auditLogRef.id,
                                materialId: item.materialId,
                                materialName: item.materialName,
                                change: changeRequired,
                                type: 'adjustment',
                                relatedId: countRef.id,
                                createdAt: reportData.date
                            });
                        }
                    }
                }
            });
            
            if (shouldAdjustStock) {
                toast({ title: 'Inventory count saved!', description: 'Current stock has been adjusted.' });
            } else {
                 toast({ title: 'Historical inventory count saved!', description: 'Current stock was not adjusted.' });
            }
            
            setIsConfirmOpen(false);
            setReportData(null);
            setCounts(allMaterials.map(m => ({ materialId: m.id, countedStock: '' })));

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error saving count", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDownloadExcel = () => {
        if (!previousCounts || previousCounts.length === 0) return;

        const reportRows = previousCounts.flatMap(count => 
            count.items.map(item => ({
                "Report Date": format(new Date(count.date), "yyyy-MM-dd HH:mm"),
                "Material Name": item.materialName,
                "System Stock": item.systemStock,
                "Counted Stock": item.countedStock,
                "Wastage": item.wastage,
                "Unit": item.unit
            }))
        );

        const worksheet = XLSX.utils.json_to_sheet(reportRows);
        worksheet['!cols'] = [
            { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Wastage Reports");

        const dateFromString = previousCountsDateRange?.from ? format(previousCountsDateRange.from, 'yyyy-MM-dd') : 'start';
        const dateToString = previousCountsDateRange?.to ? format(previousCountsDateRange.to, 'yyyy-MM-dd') : 'end';
        XLSX.writeFile(workbook, `WastageReport_${dateFromString}_to_${dateToString}.xlsx`);
    };


    if (materialsLoading || allCountsLoading) {
        return <Skeleton className="h-[400px] w-full" />
    }
  
    return (
        <div className="space-y-8">
            <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Record New Count</h3>
                </div>
                 <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>How this works</AlertTitle>
                    <AlertDescription>
                       Select a date and time, then enter the physical quantity for each material. If you select today's date, the system will adjust the *current* stock levels to match your physical count. If you select a past date, the count will be saved for historical wastage analysis but will **not** alter current stock levels.
                    </AlertDescription>
                </Alert>
                <div className="space-y-2">
                    <Label>Count Date &amp; Time</Label>
                    <div className="flex items-center gap-2">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className="w-[260px] justify-start text-left font-normal"
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {getFullCountDate() ? format(getFullCountDate()!, "PPP p") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={countDate}
                                onSelect={setCountDate}
                                initialFocus
                                disabled={(date) => date > new Date()}
                                />
                            </PopoverContent>
                        </Popover>
                        <Input type="number" value={hour} onChange={e => setHour(e.target.value)} min="0" max="23" className="w-20" placeholder="HH"/>
                        <span>:</span>
                        <Input type="number" value={minute} onChange={e => setMinute(e.target.value)} min="0" max="59" className="w-20" placeholder="MM" />
                    </div>
                </div>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead>Physical Count</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allMaterials.map((material) => {
                                const countInput = counts.find(c => c.materialId === material.id);
                                return (
                                <TableRow key={material.id}>
                                    <TableCell className="font-medium">{material.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Input 
                                                type="number" 
                                                step="any" 
                                                className="w-32"
                                                placeholder="Enter count"
                                                value={countInput?.countedStock ?? ''}
                                                onChange={(e) => handleCountChange(material.id, e.target.value)}
                                            />
                                            <span>{material.unit}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSubmitClick} disabled={isSubmitting}>
                        {isSubmitting ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Calculating...</> : <><Save className="mr-2 h-4 w-4" /> Save and Review Count</>}
                    </Button>
                </div>
            </div>

            <Separator />
            
            <div className="space-y-4 p-4 border rounded-lg">
                 <div className="flex items-center justify-between flex-wrap gap-4">
                    <h3 className="text-lg font-medium">Previous Counts &amp; Wastage Reports</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                       <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                id="date-wastage"
                                variant={"outline"}
                                className="w-[260px] justify-start text-left font-normal"
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {previousCountsDateRange?.from ? (
                                    previousCountsDateRange.to ? (
                                    <>
                                        {format(previousCountsDateRange.from, "LLL dd, y")} -{" "}
                                        {format(previousCountsDateRange.to, "LLL dd, y")}
                                    </>
                                    ) : (
                                    format(previousCountsDateRange.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>Filter by date range</span>
                                )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={previousCountsDateRange?.from}
                                selected={previousCountsDateRange}
                                onSelect={setPreviousCountsDateRange}
                                numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                         <Button variant="outline" onClick={handleDownloadExcel} disabled={previousCounts.length === 0}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Excel
                        </Button>
                        {previousCountsDateRange && <Button variant="ghost" onClick={() => setPreviousCountsDateRange(undefined)}>Clear</Button>}
                    </div>
                </div>

                {previousCounts.length > 0 ? (
                <div className="rounded-md border">
                   <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Total Items Counted</TableHead>
                                <TableHead>Total Wastage Value</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {previousCounts.map(count => {
                                const totalWastage = count.items.reduce((sum, item) => sum + item.wastage, 0);
                                return (
                                <TableRow key={count.id}>
                                    <TableCell>{format(new Date(count.date), "PPp")}</TableCell>
                                    <TableCell>{count.items.length}</TableCell>
                                    <TableCell className={totalWastage > 0 ? "text-destructive" : "text-green-600"}>{totalWastage.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => setReportData(count)}>
                                            <FileText className="mr-2 h-4 w-4" />
                                            View Report
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No previous inventory counts found for the selected date range.</p>
                )}
            </div>

            <Dialog open={isConfirmOpen || !!reportData} onOpenChange={(open) => {
                 if (!open) {
                    setIsConfirmOpen(false);
                    setReportData(null);
                 }
            }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isConfirmOpen ? "Confirm Inventory &amp; Adjust Stock" : `Wastage Report - ${reportData ? format(new Date(reportData.date), "PPp"): ''}`}</DialogTitle>
                        <DialogDescription>
                            {isConfirmOpen 
                                ? (getFullCountDate() && isToday(getFullCountDate()!) ? "Review the calculated wastage. Saving will update your stock levels and create adjustment logs." : "This is a historical count. Saving will create a wastage report but will NOT adjust current stock levels.")
                                : "A detailed report of the inventory count performed."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    {reportData && (
                        <div className="max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Material</TableHead>
                                        <TableHead>System Stock (Calculated)</TableHead>
                                        <TableHead>Counted Stock (Physical)</TableHead>
                                        <TableHead>Wastage</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.items.map(item => (
                                        <TableRow key={item.materialId}>
                                            <TableCell>{item.materialName}</TableCell>
                                            <TableCell>{item.systemStock.toFixed(2)} {item.unit}</TableCell>
                                            <TableCell>{item.countedStock.toFixed(2)} {item.unit}</TableCell>
                                            <TableCell className={item.wastage > 0 ? "text-destructive" : item.wastage < 0 ? "text-green-600" : ""}>
                                                {item.wastage.toFixed(2)} {item.unit}
                                                {item.wastage < 0 && <span className="text-xs italic ml-1">(Surplus)</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {isConfirmOpen && getFullCountDate() && (
                         <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
                            <Button onClick={handleConfirmSubmit} disabled={isSubmitting}>
                                {isSubmitting ? "Saving..." : `Confirm &amp; Save ${isToday(getFullCountDate()) ? '(Adjust Stock)' : '(No Adjustment)'}`}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
