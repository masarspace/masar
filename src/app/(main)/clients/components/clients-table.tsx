
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { clientConverter } from '@/lib/converters';
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
import type { Client } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

export function ClientsTable() {
  const [snapshot, loading] = useCollection(collection(db, 'clients').withConverter(clientConverter));
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  const clients = React.useMemo(() => {
    const baseClients = snapshot?.docs.map(doc => doc.data()) ?? [];
    if (!searchTerm) {
      return baseClients;
    }
    return baseClients.filter(client => 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [snapshot, searchTerm]);

  const handleAddClick = () => {
    setSelectedClient(null);
    setIsSheetOpen(true);
  };

  const handleEditClick = (client: Client) => {
    setSelectedClient(client);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if(!id) return;
    await deleteDoc(doc(db, 'clients', id));
  };
  
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const clientData = {
        name: formData.get('name') as string,
        phoneNumber: formData.get('phoneNumber') as string,
    };

    if (selectedClient) {
        const clientDocRef = doc(db, 'clients', selectedClient.id);
        await updateDoc(clientDocRef, clientData);
    } else {
        await addDoc(collection(db, 'clients'), clientData);
    }
    setIsSheetOpen(false);
    setSelectedClient(null);
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
                <TableHead>Phone Number</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-48" /></TableCell>
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
                placeholder="Search clients..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> Add Client</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.name}</TableCell>
                <TableCell>{client.phoneNumber || 'N/A'}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(client)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteClick(client.id)} className="text-destructive">
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
                <SheetTitle>{selectedClient ? 'Edit Client' : 'Add New Client'}</SheetTitle>
                <SheetDescription>
                  {selectedClient ? 'Update the details of this client.' : 'Fill in the details for the new client.'}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="name" className="sm:text-right">Name</Label>
                  <Input id="name" name="name" defaultValue={selectedClient?.name} className="sm:col-span-3" required/>
                </div>
                <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="phoneNumber" className="sm:text-right">Phone Number</Label>
                  <Input id="phoneNumber" name="phoneNumber" defaultValue={selectedClient?.phoneNumber} className="sm:col-span-3" />
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
