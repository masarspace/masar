
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { reservationConverter, clientConverter, roomConverter } from '@/lib/converters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Clock, LogOut } from 'lucide-react';
import type { Reservation, Client, Room } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

export function ReservationsTable() {
  const [snapshot, loading] = useCollection(query(collection(db, 'reservations'), orderBy('startAt', 'desc')).withConverter(reservationConverter));
  const [clientsSnapshot, clientsLoading] = useCollection(collection(db, 'clients').withConverter(clientConverter));
  const [roomsSnapshot, roomsLoading] = useCollection(collection(db, 'rooms').withConverter(roomConverter));

  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const { toast } = useToast();

  const allClients = React.useMemo(() => clientsSnapshot?.docs.map(doc => doc.data()) ?? [], [clientsSnapshot]);
  const allRooms = React.useMemo(() => roomsSnapshot?.docs.map(doc => doc.data()) ?? [], [roomsSnapshot]);

  const reservations = React.useMemo(() => {
    const baseReservations = snapshot?.docs.map(doc => doc.data()) ?? [];
    if (!searchTerm) {
      return baseReservations;
    }
    return baseReservations.filter(res => 
      res.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      res.roomName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [snapshot, searchTerm]);
  
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const clientId = formData.get('clientId') as string;
    const roomId = formData.get('roomId') as string;

    const client = allClients.find(c => c.id === clientId);
    const room = allRooms.find(r => r.id === roomId);

    if (!client || !room) {
        toast({ variant: 'destructive', title: 'Invalid client or room selected.' });
        return;
    }

    const reservationData: Omit<Reservation, 'id'> = {
        clientId: client.id,
        clientName: client.name,
        roomId: room.id,
        roomName: room.name,
        roomPrice: room.price,
        roomDiscount: room.discount || 0,
        startAt: new Date().toISOString(),
        endAt: null,
        status: 'Active',
        totalCost: null,
    };

    try {
        await addDoc(collection(db, 'reservations').withConverter(reservationConverter), reservationData);
        toast({ title: "Reservation created successfully!"});
        setIsSheetOpen(false);
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error creating reservation", description: error.message });
    }
  }

  const handleEndSession = async (reservation: Reservation) => {
    const now = new Date();
    const start = new Date(reservation.startAt);
    
    // Calculate duration in hours, with minutes as a fraction of an hour
    const totalMinutes = differenceInMinutes(now, start);
    const durationInHours = totalMinutes / 60;
    
    const pricePerHour = reservation.roomPrice;
    const discountPercentage = reservation.roomDiscount;

    const discountedPrice = pricePerHour * (1 - discountPercentage / 100);
    const totalCost = durationInHours * discountedPrice;

    try {
        await updateDoc(doc(db, 'reservations', reservation.id), {
            endAt: now.toISOString(),
            status: 'Completed',
            totalCost: totalCost,
        });
        toast({
            title: "Session Ended",
            description: `Total cost for ${reservation.roomName} is $${totalCost.toFixed(2)}.`
        });
    } catch(error: any) {
         toast({ variant: "destructive", title: "Error ending session", description: error.message });
    }
  }

  const isLoading = loading || clientsLoading || roomsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-40" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
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
      <div className="flex justify-between items-center mb-4 gap-4">
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search by client or room..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <Button onClick={() => setIsSheetOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> New Reservation</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>End Time</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reservations.map((res) => (
              <TableRow key={res.id}>
                <TableCell className="font-medium">{res.clientName}</TableCell>
                <TableCell>
                  <div>{res.roomName}</div>
                  <div className="text-xs text-muted-foreground">${res.roomPrice.toFixed(2)}/hr {res.roomDiscount > 0 && `(-${res.roomDiscount}%)`}</div>
                </TableCell>
                <TableCell>{format(new Date(res.startAt), 'PPp')}</TableCell>
                <TableCell>{res.endAt ? format(new Date(res.endAt), 'PPp') : 'Active'}</TableCell>
                <TableCell>{res.totalCost ? `$${res.totalCost.toFixed(2)}` : 'N/A'}</TableCell>
                 <TableCell>
                  <Badge variant={res.status === 'Completed' ? 'default' : 'secondary'}>
                    {res.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {res.status === 'Active' && (
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button variant="outline" size="sm"><LogOut className="mr-2 h-4 w-4"/> End Session</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>End Room Session?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will mark the session as completed and calculate the final cost. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleEndSession(res)}>Confirm & End Session</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
            <form onSubmit={handleFormSubmit}>
              <SheetHeader>
                <SheetTitle>New Reservation</SheetTitle>
                <SheetDescription>
                  Start a new room session for a client. The start time will be set to the current time.
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                 <div className="space-y-2">
                  <Label htmlFor="clientId">Client</Label>
                   <Select name="clientId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {allClients.map(client => (
                          <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="roomId">Room</Label>
                   <Select name="roomId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a room" />
                    </SelectTrigger>
                    <SelectContent>
                      {allRooms.map(room => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.name} (${room.price}/hr)
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SheetFooter>
                  <Button type="submit">Start Reservation</Button>
              </SheetFooter>
            </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
