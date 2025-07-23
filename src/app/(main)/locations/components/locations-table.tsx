
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { locationConverter } from '@/lib/converters';
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
import type { Location } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

export function LocationsTable() {
  const [snapshot, loading] = useCollection(collection(db, 'locations').withConverter(locationConverter));
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedLocation, setSelectedLocation] = React.useState<Location | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  const locations = React.useMemo(() => {
    const baseLocations = snapshot?.docs.map(doc => doc.data()) ?? [];
    if (!searchTerm) {
      return baseLocations;
    }
    return baseLocations.filter(location => 
      location.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [snapshot, searchTerm]);

  const handleAddClick = () => {
    setSelectedLocation(null);
    setIsSheetOpen(true);
  };

  const handleEditClick = (location: Location) => {
    setSelectedLocation(location);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if(!id) return;
    await deleteDoc(doc(db, 'locations', id));
  };
  
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const locationData = {
        name: formData.get('name') as string,
    };

    if (selectedLocation) {
        const locationDocRef = doc(db, 'locations', selectedLocation.id);
        await updateDoc(locationDocRef, locationData);
    } else {
        await addDoc(collection(db, 'locations'), locationData);
    }
    setIsSheetOpen(false);
    setSelectedLocation(null);
  }

  if (loading) {
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
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
                placeholder="Search locations..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> Add Location</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((location) => (
              <TableRow key={location.id}>
                <TableCell className="font-medium">{location.name}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(location)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteClick(location.id)} className="text-destructive">
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
                <SheetTitle>{selectedLocation ? 'Edit Location' : 'Add New Location'}</SheetTitle>
                <SheetDescription>
                  {selectedLocation ? 'Update the details of this location.' : 'Fill in the details for the new location.'}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="name" className="sm:text-right">Name</Label>
                  <Input id="name" name="name" defaultValue={selectedLocation?.name} className="sm:col-span-3" required/>
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
