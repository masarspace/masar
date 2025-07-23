
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Clock, LogOut, Calendar as CalendarIcon, MoreHorizontal, Edit } from 'lucide-react';
import type { Reservation, Client, Room } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInMinutes, setHours, setMinutes } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ReservationsTable() {
  const [snapshot, loading] = useCollection(query(collection(db, 'reservations'), orderBy('startAt', 'desc')).withConverter(reservationConverter));
  const [clientsSnapshot, clientsLoading] = useCollection(collection(db, 'clients').withConverter(clientConverter));
  const [roomsSnapshot, roomsLoading] = useCollection(collection(db, 'rooms').withConverter(roomConverter));

  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [datePickerTarget, setDatePickerTarget] = React.useState<'start' | 'end'>('start');
  const [searchTerm, setSearchTerm] = React.useState('');
  const { toast } = useToast();
  
  const [selectedReservation, setSelectedReservation] = React.useState<Reservation | null>(null);

  // State for the form
  const [clientSelectionMode, setClientSelectionMode] = React.useState<'existing' | 'new'>('existing');
  const [newClientName, setNewClientName] = React.useState('');
  const [newClientPhone, setNewClientPhone] = React.useState('');
  const [selectedClientId, setSelectedClientId] = React.useState<string | undefined>();
  const [selectedRoomId, setSelectedRoomId] = React.useState<string | undefined>();
  const [startDate, setStartDate] = React.useState<Date | undefined>(new Date());
  const [startHour, setStartHour] = React.useState(new Date().getHours().toString().padStart(2, '0'));
  const [startMinute, setStartMinute] = React.useState(new Date().getMinutes().toString().padStart(2, '0'));
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [endHour, setEndHour] = React.useState(new Date().getHours().toString().padStart(2, '0'));
  const [endMinute, setEndMinute] = React.useState(new Date().getMinutes().toString().padStart(2, '0'));
  const [currentStatus, setCurrentStatus] = React.useState<Reservation['status']>('Pending');

  // State for end session alert
  const [endSessionAlertOpen, setEndSessionAlertOpen] = React.useState(false);
  const [reservationToEnd, setReservationToEnd] = React.useState<Reservation | null>(null);


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

  const getFullEndDate = React.useCallback(() => {
    if (!endDate) return null;
    const h = parseInt(endHour, 10);
    const m = parseInt(endMinute, 10);
    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) return null;

    return setMinutes(setHours(endDate, h), m);
  }, [endDate, endHour, endMinute]);


  const resetForm = () => {
    setSelectedReservation(null);
    setClientSelectionMode('existing');
    setNewClientName('');
    setNewClientPhone('');
    setSelectedClientId(undefined);
    setSelectedRoomId(undefined);
    const now = new Date();
    setStartDate(now);
    setStartHour(now.getHours().toString().padStart(2, '0'));
    setStartMinute(now.getMinutes().toString().padStart(2, '0'));
    setEndDate(undefined);
    setEndHour(now.getHours().toString().padStart(2, '0'));
    setEndMinute(now.getMinutes().toString().padStart(2, '0'));
    setCurrentStatus('Pending');
  };
  
  React.useEffect(() => {
    if (isSheetOpen) {
      if (selectedReservation) {
          const start = new Date(selectedReservation.startAt);
          setSelectedClientId(selectedReservation.clientId);
          setSelectedRoomId(selectedReservation.roomId);
          setStartDate(start);
          setStartHour(start.getHours().toString().padStart(2, '0'));
          setStartMinute(start.getMinutes().toString().padStart(2, '0'));
          setCurrentStatus(selectedReservation.status);

          if (selectedReservation.endAt) {
              const end = new Date(selectedReservation.endAt);
              setEndDate(end);
              setEndHour(end.getHours().toString().padStart(2, '0'));
              setEndMinute(end.getMinutes().toString().padStart(2, '0'));
          } else {
              const now = new Date();
              setEndDate(undefined);
              setEndHour(now.getHours().toString().padStart(2, '0'));
              setEndMinute(now.getMinutes().toString().padStart(2, '0'));
          }
      } else {
          resetForm();
      }
    }
  }, [isSheetOpen, selectedReservation]);

  React.useEffect(() => {
    if(selectedReservation && currentStatus === 'Completed' && !endDate) {
      setEndDate(new Date());
    }
  }, [currentStatus, selectedReservation, endDate]);

  React.useEffect(() => {
    const fullStartDate = getFullStartDate();
    const fullEndDate = getFullEndDate();
    if(fullStartDate && fullEndDate && fullEndDate < fullStartDate) {
        setEndDate(undefined);
    }
  }, [startDate, startHour, startMinute, getFullStartDate, getFullEndDate]);


  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fullStartDate = getFullStartDate();
    if (!fullStartDate) {
        toast({ variant: 'destructive', title: 'Invalid start date.' });
        return;
    }

    // --- EDITING LOGIC ---
    if (selectedReservation) {
        const fullEndDate = getFullEndDate();

        const updateData: any = {
            startAt: fullStartDate.toISOString(),
            status: currentStatus,
        };

        if (currentStatus === 'Completed') {
            const finalEndDate = fullEndDate || new Date();
             if (finalEndDate < fullStartDate) {
                toast({ variant: 'destructive', title: 'End date cannot be before start date.' });
                return;
            }

            const totalMinutes = Math.max(0, differenceInMinutes(finalEndDate, fullStartDate));
            const durationInHours = totalMinutes / 60;
            const pricePerHour = selectedReservation.roomPrice;
            const discountPercentage = selectedReservation.roomDiscount;
            const discountedPrice = pricePerHour * (1 - discountPercentage / 100);
            const totalCost = durationInHours * discountedPrice;
            
            updateData.endAt = finalEndDate.toISOString();
            updateData.totalCost = totalCost;

        } else {
            updateData.endAt = null;
            updateData.totalCost = null;
        }

        try {
            await updateDoc(doc(db, 'reservations', selectedReservation.id), updateData);
            toast({ title: "Reservation updated!"});
            setIsSheetOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error updating reservation", description: error.message });
        }
        return;
    }

    // --- CREATING LOGIC ---
    let client: Client | undefined;
    if (clientSelectionMode === 'new') {
        if (!newClientName) {
            toast({ variant: 'destructive', title: 'Please enter a name for the new client.' });
            return;
        }
        try {
            const newClientRef = await addDoc(collection(db, 'clients').withConverter(clientConverter), {
                id: '',
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

    if (!client || !room) {
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
        status: 'Pending',
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

  const handleEditClick = (reservation: Reservation) => {
      setSelectedReservation(reservation);
      setIsSheetOpen(true);
  }
  
  const handleAddClick = () => {
      setSelectedReservation(null);
      setIsSheetOpen(true);
  }

  const openDatePicker = (target: 'start' | 'end') => {
      setDatePickerTarget(target);
      setIsDatePickerOpen(true);
  }

  const handleEndSessionClick = (reservation: Reservation) => {
    setReservationToEnd(reservation);
    setEndSessionAlertOpen(true);
  };

  const confirmEndSession = async () => {
      if (!reservationToEnd) return;

      const fullStartDate = new Date(reservationToEnd.startAt);
      const finalEndDate = new Date(); // Use current time

      const totalMinutes = Math.max(0, differenceInMinutes(finalEndDate, fullStartDate));
      const durationInHours = totalMinutes / 60;
      const pricePerHour = reservationToEnd.roomPrice;
      const discountPercentage = reservationToEnd.roomDiscount;
      const discountedPrice = pricePerHour * (1 - discountPercentage / 100);
      const totalCost = durationInHours * discountedPrice;

      const updateData: Partial<Reservation> = {
          status: 'Completed',
          endAt: finalEndDate.toISOString(),
          totalCost: totalCost,
      };

      try {
          await updateDoc(doc(db, 'reservations', reservationToEnd.id), updateData as any);
          toast({ title: "Session Ended", description: "The reservation has been marked as completed."});
      } catch (error: any) {
          toast({ variant: "destructive", title: "Error ending session", description: error.message });
      } finally {
          setEndSessionAlertOpen(false);
          setReservationToEnd(null);
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
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> New Reservation</Button>
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
                  <Badge variant={
                      res.status === 'Completed' ? 'default' 
                      : res.status === 'Active' ? 'secondary' 
                      : res.status === 'Pending' ? 'outline'
                      : 'destructive'
                    }>
                    {res.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                       <DropdownMenuItem onClick={() => handleEditClick(res)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                       {(res.status === 'Pending' || res.status === 'Active') && (
                        <DropdownMenuItem onClick={() => handleEndSessionClick(res)}>
                            <LogOut className="mr-2 h-4 w-4" /> End Session
                        </DropdownMenuItem>
                       )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

       <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <DialogContent className="w-auto">
          <DialogHeader>
            <DialogTitle>Select Date and Time</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <Calendar
              mode="single"
              selected={datePickerTarget === 'start' ? startDate : endDate}
              onSelect={
                (date) => {
                    if (date) {
                        if (datePickerTarget === 'start') {
                            setStartDate(date);
                        } else {
                            setEndDate(date);
                        }
                    }
                }
              }
              disabled={datePickerTarget === 'end' ? { before: startDate || new Date() } : undefined}
              initialFocus
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={datePickerTarget === 'start' ? startHour : endHour}
                onChange={(e) =>
                  datePickerTarget === 'start'
                    ? setStartHour(e.target.value)
                    : setEndHour(e.target.value)
                }
                min="0"
                max="23"
                className="w-20"
                placeholder="HH"
              />
              <span>:</span>
              <Input
                type="number"
                value={
                  datePickerTarget === 'start' ? startMinute : endMinute
                }
                onChange={(e) =>
                  datePickerTarget === 'start'
                    ? setStartMinute(e.target.value)
                    : setEndMinute(e.target.value)
                }
                min="0"
                max="59"
                className="w-20"
                placeholder="MM"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
       
       <AlertDialog open={endSessionAlertOpen} onOpenChange={setEndSessionAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>End Reservation Session?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will mark the reservation as completed, set the end time to now, and calculate the total cost. This action cannot be undone.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmEndSession}>Confirm</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
       </AlertDialog>


      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="flex flex-col">
            <SheetHeader>
              <SheetTitle>{selectedReservation ? 'Edit Reservation' : 'New Reservation'}</SheetTitle>
              <SheetDescription>
                {selectedReservation ? 'Update the details for this reservation.' : 'Start a new room session for a client.'}
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 overflow-hidden">
             <ScrollArea className="flex-1 pr-4">
              <div className="grid gap-4 py-4">
                {selectedReservation ? (
                    <>
                        <div className="space-y-1">
                            <Label>Client</Label>
                            <p className="font-medium">{selectedReservation.clientName}</p>
                        </div>
                        <div className="space-y-1">
                            <Label>Room</Label>
                            <p className="font-medium">{selectedReservation.roomName}</p>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select name="status" value={currentStatus} onValueChange={(value) => setCurrentStatus(value as Reservation['status'])}>
                                <SelectTrigger>
                                <SelectValue placeholder="Select a status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Start Date & Time</Label>
                            <Button
                                type="button"
                                variant={"outline"}
                                className="w-full justify-start text-left font-normal"
                                onClick={() => openDatePicker('start')}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {getFullStartDate() ? format(getFullStartDate()!, "PPP p") : <span>Pick a date</span>}
                            </Button>
                        </div>
                        {(currentStatus === 'Completed' || selectedReservation.endAt) && (
                            <div className="space-y-2">
                                <Label>End Date & Time</Label>
                                <Button
                                    type="button"
                                    variant={"outline"}
                                    className="w-full justify-start text-left font-normal"
                                    onClick={() => openDatePicker('end')}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {getFullEndDate() ? format(getFullEndDate()!, "PPP p") : <span>Pick a date</span>}
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <>
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
                            <Button
                                type="button"
                                variant={"outline"}
                                className="w-full justify-start text-left font-normal"
                                onClick={() => openDatePicker('start')}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {getFullStartDate() ? format(getFullStartDate()!, "PPP p") : <span>Pick a date</span>}
                            </Button>
                        </div>
                    </>
                )}
              </div>
              </ScrollArea>
              <SheetFooter className="pt-4">
                  <Button type="submit">Save Changes</Button>
              </SheetFooter>
            </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
