
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, doc, runTransaction, query, orderBy, getDocs, where } from 'firebase/firestore';
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
import { Calendar as CalendarIcon, Save, AlertCircle, FileText } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
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

type CountInput = {
    materialId: string;
    countedStock: string;
    systemStock: number; // Capture system stock at the time of rendering
}

export function InventoryCountForm() {
    const [materialsSnapshot, materialsLoading] = useCollection(collection(db, 'materials').withConverter(materialConverter));
    const [countsSnapshot, countsLoading] = useCollection(query(collection(db, 'inventoryCounts'), orderBy('date', 'desc')).withConverter(inventoryCountConverter));
    
    const allMaterials = React.useMemo(() => materialsSnapshot?.docs.map(doc => doc.data()) ?? [], [materialsSnapshot]);
    const previousCounts = React.useMemo(() => countsSnapshot?.docs.map(doc => doc.data()) ?? [], [countsSnapshot]);

    const [countDate, setCountDate] = React.useState<Date | undefined>(new Date());
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();
    const [counts, setCounts] = React.useState<CountInput[]>([]);
    const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
    const [reportData, setReportData] = React.useState<InventoryCount | null>(null);

    React.useEffect(() => {
        if (allMaterials.length > 0) {
            // When materials load, create the form state, capturing the current system stock
            setCounts(allMaterials.map(m => ({ materialId: m.id, countedStock: '', systemStock: m.stock })));
        }
    }, [allMaterials]);

    const handleCountChange = (materialId: string, value: string) => {
        setCounts(currentCounts => currentCounts.map(c => c.materialId === materialId ? {...c, countedStock: value} : c));
    }

    const handleSubmitClick = () => {
        if (!countDate) {
            toast({ variant: 'destructive', title: 'Please select a date for the count.' });
            return;
        }
        
        const itemsToSave = counts.filter(c => c.countedStock !== '' && !isNaN(parseFloat(c.countedStock)));
        if (itemsToSave.length === 0) {
            toast({ variant: 'destructive', title: 'Please enter a count for at least one material.' });
            return;
        }

        const newReportItems: InventoryCountItem[] = itemsToSave.map(item => {
            const material = allMaterials.find(m => m.id === item.materialId)!;
            const countedStock = parseFloat(item.countedStock);
            // Use the system stock that was captured when the form was loaded
            const systemStock = item.systemStock;
            const wastage = systemStock - countedStock;
            return {
                materialId: material.id,
                materialName: material.name,
                unit: material.unit,
                systemStock,
                countedStock,
                wastage
            }
        });
        
        setReportData({
            id: '', // temp ID
            date: countDate.toISOString(),
            items: newReportItems
        });

        setIsConfirmOpen(true);
    };

    const handleConfirmSubmit = async () => {
        if (!reportData) return;
        setIsSubmitting(true);

        try {
            await runTransaction(db, async (transaction) => {
                const countRef = doc(collection(db, 'inventoryCounts'));
                // Save the report data, which includes the historically accurate systemStock
                transaction.set(countRef.withConverter(inventoryCountConverter), { ...reportData, id: countRef.id });

                for(const item of reportData.items) {
                    // We only update the stock level and create an audit log if there is a difference
                    if (item.wastage !== 0) {
                        const materialRef = doc(db, 'materials', item.materialId);
                        // The stock is updated to the new physical count
                        transaction.update(materialRef, { stock: item.countedStock });

                        const auditLogRef = doc(collection(db, 'auditLog'));
                        transaction.set(auditLogRef.withConverter(auditLogConverter), {
                            id: auditLogRef.id,
                            materialId: item.materialId,
                            materialName: item.materialName,
                            change: -item.wastage, // Log the change needed to correct stock (e.g., wastage of 5 means change of -5)
                            type: 'adjustment',
                            relatedId: countRef.id,
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            });
            toast({ title: 'Inventory count saved and stock adjusted successfully!' });
            setIsConfirmOpen(false);
            setReportData(null);
            // Reset form: re-capture the latest system stock
            setCounts(allMaterials.map(m => ({ materialId: m.id, countedStock: '', systemStock: m.stock })));

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error saving count", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };


    if (materialsLoading || countsLoading) {
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
                        Enter the physical quantity for each material you've counted. When you save, the system will calculate the wastage (difference between system stock and your count) and automatically adjust the stock levels to match your physical count. An "adjustment" entry will be created in the Audit Log for each change.
                    </AlertDescription>
                </Alert>
                <div className="space-y-2">
                    <Label>Count Date</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant={"outline"}
                            className="w-[260px] justify-start text-left font-normal"
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {countDate ? format(countDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                            mode="single"
                            selected={countDate}
                            onSelect={setCountDate}
                            initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead>System Stock</TableHead>
                            <TableHead>Physical Count</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allMaterials.map((material) => {
                                const countInput = counts.find(c => c.materialId === material.id);
                                return (
                                <TableRow key={material.id}>
                                    <TableCell className="font-medium">{material.name}</TableCell>
                                    <TableCell>{countInput ? `${countInput.systemStock.toFixed(2)} ${material.unit}` : 'Loading...'}</TableCell>
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
                        <Save className="mr-2 h-4 w-4" />
                        Save and Review Count
                    </Button>
                </div>
            </div>

            <Separator />
            
            <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-lg font-medium">Previous Counts & Wastage Reports</h3>
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
                                    <TableCell>{format(new Date(count.date), "PPP")}</TableCell>
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
                    <p className="text-sm text-muted-foreground">No previous inventory counts found.</p>
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
                        <DialogTitle>{isConfirmOpen ? "Confirm Inventory & Adjust Stock" : `Wastage Report - ${reportData ? format(new Date(reportData.date), "PPP"): ''}`}</DialogTitle>
                        <DialogDescription>
                            {isConfirmOpen 
                                ? "Review the calculated wastage below. Saving will update your stock levels to match the physical count and create adjustment logs."
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
                                        <TableHead>System Stock</TableHead>
                                        <TableHead>Counted Stock</TableHead>
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
                    {isConfirmOpen && (
                         <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
                            <Button onClick={handleConfirmSubmit} disabled={isSubmitting}>
                                {isSubmitting ? "Saving..." : "Confirm & Save"}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
