
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { roomConverter, locationConverter } from '@/lib/converters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Edit, Trash2, Search } from 'lucide-react';
import type { Room, Location } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function RoomsTable() {
  const [snapshot, loading] = useCollection(collection(db, 'rooms').withConverter(roomConverter));
  const [locationsSnapshot, locationsLoading] = useCollection(collection(db, 'locations').withConverter(locationConverter));
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedRoom, setSelectedRoom] = React.useState<Room | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  const allLocations = React.useMemo(() => locationsSnapshot?.docs.map(doc => doc.data()) ?? [], [locationsSnapshot]);

  const rooms = React.useMemo(() => {
    const baseRooms = snapshot?.docs.map(doc => doc.data()) ?? [];
    if (!searchTerm) {
      return baseRooms;
    }
    return baseRooms.filter(room => 
      room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.locationName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [snapshot, searchTerm]);

  const handleAddClick = () => {
    setSelectedRoom(null);
    setIsSheetOpen(true);
  };

  const handleEditClick = (room: Room) => {
    setSelectedRoom(room);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if(!id) return;
    await deleteDoc(doc(db, 'rooms', id));
  };
  
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const locationId = formData.get('locationId') as string;
    const location = allLocations.find(l => l.id === locationId);
    if (!location) return;

    const roomData = {
        name: formData.get('name') as string,
        price: Number(formData.get('price')),
        discount: Number(formData.get('discount')) || 0,
        locationId: location.id,
        locationName: location.name,
    };

    if (selectedRoom) {
        const roomDocRef = doc(db, 'rooms', selectedRoom.id);
        await updateDoc(roomDocRef, roomData);
    } else {
        await addDoc(collection(db, 'rooms'), roomData);
    }
    setIsSheetOpen(false);
    setSelectedRoom(null);
  }

  if (loading || locationsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-36" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
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
                placeholder="Search rooms..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> Add Room</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell className="font-medium">{room.name}</TableCell>
                <TableCell>{room.locationName}</TableCell>
                <TableCell>${room.price.toFixed(2)}</TableCell>
                <TableCell>{room.discount ? `${room.discount}%` : 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(room)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteClick(room.id)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                <SheetTitle>{selectedRoom ? 'Edit Room' : 'Add New Room'}</SheetTitle>
                <SheetDescription>
                  {selectedRoom ? 'Update the details of this room.' : 'Fill in the details for the new room.'}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="name" className="sm:text-right">Name</Label>
                  <Input id="name" name="name" defaultValue={selectedRoom?.name} className="sm:col-span-3" required/>
                </div>
                 <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="locationId" className="sm:text-right">Location</Label>
                   <Select name="locationId" defaultValue={selectedRoom?.locationId} required>
                    <SelectTrigger className="sm:col-span-3">
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      {allLocations.map(loc => (
                          <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="price" className="sm:text-right">Price</Label>
                  <Input id="price" name="price" type="number" step="0.01" defaultValue={selectedRoom?.price} className="sm:col-span-3" required/>
                </div>
                <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="discount" className="sm:text-right">Discount (%)</Label>
                  <Input id="discount" name="discount" type="number" step="1" defaultValue={selectedRoom?.discount} className="sm:col-span-3" />
                </div>
              </div>
              <SheetFooter>
                  <Button type="submit">Save changes</Button>
              </SheetFooter>
            </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
