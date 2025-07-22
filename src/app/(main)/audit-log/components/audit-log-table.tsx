"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { auditLogConverter } from '@/lib/converters';
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

export function AuditLogTable() {
    const [logSnapshot, loading] = useCollection(
        query(collection(db, 'auditLog'), orderBy('createdAt', 'desc')).withConverter(auditLogConverter)
    );
    
    const logs = React.useMemo(() => logSnapshot?.docs.map(doc => doc.data()) ?? [], [logSnapshot]);
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

    if(loading) {
        return (
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
        )
    }

    return (
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
    )

}
