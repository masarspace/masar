
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
import { PlusCircle, Search, Clock, LogOut, Calendar as CalendarIcon } from 'lucide-react';
import type { Reservation, Client, Room } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInMinutes, setHours, setMinutes } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

export function ReservationsTable() {
  const [snapshot, loading] = useCollection(query(collection(db, 'reservations'), orderBy('startAt', 'desc')).withConverter(reservationConverter));
  const [clientsSnapshot, clientsLoading] = useCollection(collection(db, 'clients').withConverter(clientConverter));
  const [roomsSnapshot, roomsLoading] = useCollection(collection(db, 'rooms').withConverter(roomConverter));

  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const { toast } = useToast();

  // State for the form
  const [clientSelectionMode, setClientSelectionMode] = React.useState<'existing' | 'new'>('existing');
  const [newClientName, setNewClientName] = React.useState('');
  const [newClientPhone, setNewClientPhone] = React.useState('');
  const [selectedClientId, setSelectedClientId] = React.useState<string | undefined>();
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | undefined>();
  const [startDate, setStartDate] = React.useState<Date | undefined>(new Date());
  const [startHour, setStartHour] = React.useState(new Date().getHours().toString().padStart(2, '0'));
  const [startMinute, setStartMinute] = React.useState(new Date().getMinutes().toString().padStart(2, '0'));


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
  
  const getFullStartDate = React.useCallback(() => {
    if (!startDate) return null;
    const h = parseInt(startHour, 10);
    const m = parseInt(startMinute, 10);
    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) return null;

    return setMinutes(setHours(startDate, h), m);
  }, [startDate, startHour, startMinute]);


  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let client: Client | undefined;

    if (clientSelectionMode === 'new') {
        if (!newClientName) {
            toast({ variant: 'destructive', title: 'Please enter a name for the new client.' });
            return;
        }
        try {
            const newClientRef = await addDoc(collection(db, 'clients').withConverter(clientConverter), {
                id: '', // Firestore will generate
                name: newClientName,
                phoneNumber: newClientPhone,
            });
            client = { id: newClientRef.id, name: newClientName, phoneNumber: newClientPhone };
        } catch (error: any) {
             toast({ variant: "destructive", title: "Error creating client", description: error.message });
             return;
        }
    } else {
        client = allClients.find(c => c.id === selectedClientId);
    }
    
    const room = allRooms.find(r => r.id === selectedRoomId);
    const fullStartDate = getFullStartDate();

    if (!client || !room || !fullStartDate) {
        toast({ variant: 'destructive', title: 'Invalid client, room, or date selected.' });
        return;
    }

    const reservationData: Omit<Reservation, 'id'> = {
        clientId: client.id,
        clientName: client.name,
        roomId: room.id,
        roomName: room.name,
        roomPrice: room.price,
        roomDiscount: room.discount || 0,
        startAt: fullStartDate.toISOString(),
        endAt: null,
        status: 'Active',
        totalCost: null,
    };

    try {
        await addDoc(collection(db, 'reservations').withConverter(reservationConverter), reservationData);
        toast({ title: "Reservation created successfully!"});
        setIsSheetOpen(false);
        // Reset form state
        setClientSelectionMode('existing');
        setNewClientName('');
        setNewClientPhone('');
        setSelectedClientId(undefined);
        setSelectedRoomId(undefined);
        setStartDate(new Date());
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error creating reservation", description: error.message });
    }
  }

  const handleEndSession = async (reservation: Reservation) => {
    const now = new Date();
    const start = new Date(reservation.startAt);
    
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
                  Start a new room session for a client.
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                 <div className="space-y-2">
                    <Label>Client</Label>
                    <RadioGroup value={clientSelectionMode} onValueChange={(v) => setClientSelectionMode(v as 'existing' | 'new')} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="existing" id="existing"/>
                            <Label htmlFor="existing">Existing Client</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="new" id="new"/>
                            <Label htmlFor="new">New Client</Label>
                        </div>
                    </RadioGroup>
                 </div>
                 {clientSelectionMode === 'existing' ? (
                     <Select name="clientId" value={selectedClientId} onValueChange={setSelectedClientId} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a client" />
                        </SelectTrigger>
                        <SelectContent>
                          {allClients.map(client => (
                              <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                 ) : (
                    <div className="grid gap-2 p-2 border rounded-md">
                        <Label htmlFor="newClientName">New Client Name</Label>
                        <Input id="newClientName" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} required/>
                        <Label htmlFor="newClientPhone">Phone Number (Optional)</Label>
                        <Input id="newClientPhone" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
                    </div>
                 )}
                 <div className="space-y-2">
                  <Label htmlFor="roomId">Room</Label>
                   <Select name="roomId" value={selectedRoomId} onValueChange={setSelectedRoomId} required>
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
                <div className="space-y-2">
                    <Label>Reservation Start Date & Time</Label>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className="w-full sm:w-[240px] justify-start text-left font-normal"
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {getFullStartDate() ? format(getFullStartDate()!, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={startDate}
                                onSelect={setStartDate}
                                initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <div className="flex items-center gap-2">
                            <Input type="number" value={startHour} onChange={e => setStartHour(e.target.value)} min="0" max="23" className="w-20" placeholder="HH"/>
                            <span>:</span>
                            <Input type="number" value={startMinute} onChange={e => setStartMinute(e.target.value)} min="0" max="59" className="w-20" placeholder="MM" />
                        </div>
                    </div>
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

    