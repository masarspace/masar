
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { clientContractConverter, clientConverter, contractConverter } from '@/lib/converters';
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Edit, Trash2, Search, Calendar as CalendarIcon } from 'lucide-react';
import type { ClientContract, Client, Contract } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { Calendar } from '@/components/ui/calendar';
import { format, addMonths, isAfter } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export function ClientContractsTable() {
  const [snapshot, loading] = useCollection(query(collection(db, 'clientContracts'), orderBy('startDate', 'desc')).withConverter(clientContractConverter));
  const [clientsSnapshot, clientsLoading] = useCollection(collection(db, 'clients').withConverter(clientConverter));
  const [contractsSnapshot, contractsLoading] = useCollection(collection(db, 'contracts').withConverter(contractConverter));

  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedClientContract, setSelectedClientContract] = React.useState<ClientContract | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const { toast } = useToast();

  // Form State
  const [selectedClientId, setSelectedClientId] = React.useState<string | undefined>();
  const [selectedContractId, setSelectedContractId] = React.useState<string | undefined>();
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);

  const allClients = React.useMemo(() => clientsSnapshot?.docs.map(doc => doc.data()) ?? [], [clientsSnapshot]);
  const allContracts = React.useMemo(() => contractsSnapshot?.docs.map(doc => doc.data()) ?? [], [contractsSnapshot]);

  const clientContracts = React.useMemo(() => {
    const baseContracts = snapshot?.docs.map(doc => doc.data()) ?? [];
    if (!searchTerm) {
      return baseContracts;
    }
    return baseContracts.filter(cc => 
      cc.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cc.contractName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [snapshot, searchTerm]);
  
  React.useEffect(() => {
    if (selectedContractId && startDate) {
      const contract = allContracts.find(c => c.id === selectedContractId);
      if (contract) {
        setEndDate(addMonths(startDate, contract.period));
      }
    } else {
      setEndDate(undefined);
    }
  }, [selectedContractId, startDate, allContracts]);

  React.useEffect(() => {
      if (isSheetOpen) {
          if (selectedClientContract) {
              setSelectedClientId(selectedClientContract.clientId);
              setSelectedContractId(selectedClientContract.contractId);
              setStartDate(new Date(selectedClientContract.startDate));
          } else {
              setSelectedClientId(undefined);
              setSelectedContractId(undefined);
              setStartDate(new Date());
          }
      }
  }, [isSheetOpen, selectedClientContract]);

  const handleAddClick = () => {
    setSelectedClientContract(null);
    setIsSheetOpen(true);
  };

  const handleEditClick = (clientContract: ClientContract) => {
    setSelectedClientContract(clientContract);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = (clientContract: ClientContract) => {
    setSelectedClientContract(clientContract);
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = async () => {
      if (!selectedClientContract) return;
      await deleteDoc(doc(db, 'clientContracts', selectedClientContract.id));
      toast({ title: "Client contract deleted successfully." });
      setIsDeleteDialogOpen(false);
  }

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const client = allClients.find(c => c.id === selectedClientId);
    const contract = allContracts.find(c => c.id === selectedContractId);

    if (!client || !contract || !startDate || !endDate) {
        toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a client, contract, and start date.' });
        return;
    }

    const data = {
        clientId: client.id,
        clientName: client.name,
        contractId: contract.id,
        contractName: contract.name,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: isAfter(new Date(), endDate) ? 'Expired' : 'Active' as ClientContract['status'],
    };

    if (selectedClientContract) {
        await updateDoc(doc(db, 'clientContracts', selectedClientContract.id), data);
        toast({ title: "Client contract updated!" });
    } else {
        await addDoc(collection(db, 'clientContracts').withConverter(clientContractConverter), data);
        toast({ title: "Client contract created!" });
    }
    setIsSheetOpen(false);
    setSelectedClientContract(null);
  }
  
  const getStatus = (endDate: string): { status: ClientContract['status'], variant: 'default' | 'secondary' | 'destructive' } => {
      const now = new Date();
      if (isAfter(now, new Date(endDate))) {
          return { status: 'Expired', variant: 'secondary' };
      }
      return { status: 'Active', variant: 'default' };
  };

  const isLoading = loading || clientsLoading || contractsLoading;

  if (isLoading) {
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
                <TableHead>Client</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
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
                placeholder="Search contracts..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> New Client Contract</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientContracts.map((cc) => {
                const { status, variant } = getStatus(cc.endDate);
                return (
                  <TableRow key={cc.id}>
                    <TableCell className="font-medium">{cc.clientName}</TableCell>
                    <TableCell>{cc.contractName}</TableCell>
                    <TableCell>{format(new Date(cc.startDate), 'PP')}</TableCell>
                    <TableCell>{format(new Date(cc.endDate), 'PP')}</TableCell>
                    <TableCell><Badge variant={variant}>{status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClick(cc)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClick(cc)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
            })}
          </TableBody>
        </Table>
      </div>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
            <form onSubmit={handleFormSubmit}>
              <SheetHeader>
                <SheetTitle>{selectedClientContract ? 'Edit Client Contract' : 'New Client Contract'}</SheetTitle>
                <SheetDescription>
                  {selectedClientContract ? 'Update the details of this contract assignment.' : 'Assign a contract to a client.'}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                    <Label htmlFor="clientId" className="sm:text-right">Client</Label>
                    <Select name="clientId" value={selectedClientId} onValueChange={setSelectedClientId} required>
                        <SelectTrigger className="sm:col-span-3">
                        <SelectValue placeholder="Select a client" />
                        </SelectTrigger>
                        <SelectContent>
                        {allClients.map(client => (
                            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                    <Label htmlFor="contractId" className="sm:text-right">Contract</Label>
                    <Select name="contractId" value={selectedContractId} onValueChange={setSelectedContractId} required>
                        <SelectTrigger className="sm:col-span-3">
                        <SelectValue placeholder="Select a contract" />
                        </SelectTrigger>
                        <SelectContent>
                        {allContracts.map(contract => (
                            <SelectItem key={contract.id} value={contract.id}>{contract.name} ({contract.period} months)</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="startDate" className="sm:text-right">Start Date</Label>
                   <Button
                        type="button"
                        variant={"outline"}
                        className="sm:col-span-3 justify-start text-left font-normal"
                        onClick={() => setIsDatePickerOpen(true)}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                </div>
                {endDate && (
                     <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                        <Label className="sm:text-right">End Date</Label>
                        <p className="sm:col-span-3 font-medium text-muted-foreground">{format(endDate, "PPP")}</p>
                    </div>
                )}
              </div>
              <SheetFooter>
                  <Button type="submit">Save changes</Button>
              </SheetFooter>
            </form>
        </SheetContent>
      </Sheet>
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                client contract.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <DialogContent className="w-auto">
          <DialogHeader>
            <DialogTitle>Select Date</DialogTitle>
          </DialogHeader>
            <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => {
                    setStartDate(date);
                }}
                initialFocus
            />
          <DialogFooter>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
