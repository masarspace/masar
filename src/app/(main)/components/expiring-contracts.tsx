
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { clientContractConverter } from '@/lib/converters';
import { differenceInDays, format, startOfToday, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileClock } from 'lucide-react';
import Link from 'next/link';

export function ExpiringContracts() {
    const today = startOfToday();
    const thirtyDaysFromNow = addDays(today, 30);

    const [snapshot, loading] = useCollection(
        query(
            collection(db, 'clientContracts'),
            where('status', '==', 'Active'),
            where('endDate', '>=', today.toISOString()),
            where('endDate', '<=', thirtyDaysFromNow.toISOString()),
            orderBy('endDate', 'asc')
        ).withConverter(clientContractConverter)
    );

    const expiringContracts = React.useMemo(() => {
        return snapshot?.docs.map(doc => doc.data()) ?? [];
    }, [snapshot]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Contracts Ending Soon</CardTitle>
                    <CardDescription>
                        Contracts expiring in the next 30 days.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileClock className="w-6 h-6" /> Contracts Ending Soon
                </CardTitle>
                <CardDescription>
                    These active contracts are set to expire in the next 30 days.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {expiringContracts.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client</TableHead>
                                <TableHead>Contract</TableHead>
                                <TableHead className="text-right">Expires On</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expiringContracts.map(contract => {
                                const daysLeft = differenceInDays(new Date(contract.endDate), today);
                                return (
                                    <TableRow key={contract.id}>
                                        <TableCell>
                                            <Link href="/clients" className="hover:underline text-primary">
                                                {contract.clientName}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{contract.contractName}</TableCell>
                                        <TableCell className="text-right">
                                            <div>{format(new Date(contract.endDate), 'PP')}</div>
                                            <div className="text-xs text-muted-foreground">{daysLeft} days left</div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="text-sm text-center text-muted-foreground py-8">
                        No contracts are expiring in the next 30 days.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
