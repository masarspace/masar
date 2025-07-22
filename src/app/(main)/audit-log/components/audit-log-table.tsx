
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { auditLogConverter, materialConverter } from '@/lib/converters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AuditLogTable() {
    const [logSnapshot, loading] = useCollection(
        query(collection(db, 'auditLog'), orderBy('createdAt', 'desc')).withConverter(auditLogConverter)
    );
    const [materialsSnapshot, materialsLoading] = useCollection(collection(db, 'materials').withConverter(materialConverter));
    
    const [searchTerm, setSearchTerm] = React.useState('');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [materialFilter, setMaterialFilter] = React.useState<string>('all');
    const [typeFilter, setTypeFilter] = React.useState<string>('all');

    const allMaterials = React.useMemo(() => materialsSnapshot?.docs.map(doc => doc.data()) ?? [], [materialsSnapshot]);
    
    const logs = React.useMemo(() => {
        let baseLogs = logSnapshot?.docs.map(doc => doc.data()) ?? [];
        
        if (dateRange?.from) {
            const fromDate = startOfDay(dateRange.from);
            const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            baseLogs = baseLogs.filter(log => {
                const logDate = new Date(log.createdAt);
                return logDate >= fromDate && logDate <= toDate;
            });
        }
        
        if (materialFilter !== 'all') {
            baseLogs = baseLogs.filter(log => log.materialId === materialFilter);
        }

        if (typeFilter !== 'all') {
            baseLogs = baseLogs.filter(log => log.type === typeFilter);
        }

        if (searchTerm) {
             baseLogs = baseLogs.filter(log =>
                log.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.relatedId.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return baseLogs;
    }, [logSnapshot, searchTerm, dateRange, materialFilter, typeFilter]);

    const [formattedDates, setFormattedDates] = React.useState<Map<string, string>>(new Map());

    React.useEffect(() => {
        if (logs.length > 0) {
          const newFormattedDates = new Map<string, string>();
          for (const log of logs) {
             newFormattedDates.set(log.id, new Intl.DateTimeFormat('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }).format(new Date(log.createdAt)));
          }
          setFormattedDates(newFormattedDates);
        }
    }, [logs]);

    if(loading || materialsLoading) {
        return (
            <div className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                  <Skeleton className="h-10 w-64" />
                  <Skeleton className="h-10 w-48" />
                  <Skeleton className="h-10 w-40" />
                  <Skeleton className="h-10 w-40" />
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Related ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(10)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
        )
    }

    const clearFilters = () => {
        setSearchTerm('');
        setDateRange(undefined);
        setMaterialFilter('all');
        setTypeFilter('all');
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search logs..."
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
                 <Select value={materialFilter} onValueChange={setMaterialFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by material" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Materials</SelectItem>
                        {allMaterials.map(mat => (
                            <SelectItem key={mat.id} value={mat.id}>{mat.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="purchase">Purchase</SelectItem>
                        <SelectItem value="sale">Sale</SelectItem>
                        <SelectItem value="adjustment">Adjustment</SelectItem>
                    </SelectContent>
                </Select>
                {(dateRange || materialFilter !== 'all' || typeFilter !== 'all') && <Button variant="ghost" onClick={clearFilters}>Clear Filters</Button>}
            </div>
            <div className="rounded-md border">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Related ID</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map(log => (
                        <TableRow key={log.id}>
                            <TableCell>{formattedDates.get(log.id) || <Skeleton className="h-5 w-36" />}</TableCell>
                            <TableCell>{log.materialName}</TableCell>
                            <TableCell>
                                <Badge variant={log.type === 'purchase' ? 'default' : log.type === 'sale' ? 'secondary' : 'outline'}>
                                    {log.type}
                                </Badge>
                            </TableCell>
                            <TableCell className={log.change > 0 ? "text-green-600" : "text-destructive"}>
                                {log.change > 0 ? '+' : ''}{log.change.toFixed(3)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{log.relatedId}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
        </div>
    )

}
