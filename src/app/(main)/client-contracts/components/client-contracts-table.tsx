
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
import { format, addMonths, isAfter, startOfDay, endOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function ClientContractsTable() {
  const [snapshot, loading] = useCollection(query(collection(db, 'clientContracts'), orderBy('startDate', 'desc')).withConverter(clientContractConverter));
  const [clientsSnapshot, clientsLoading] = useCollection(collection(db, 'clients').withConverter(clientConverter));
  const [contractsSnapshot, contractsLoading] = useCollection(collection(db, 'contracts').withConverter(contractConverter));

  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedClientContract, setSelectedClientContract] = React.useState<ClientContract | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const { toast } = useToast();

  // Filter State
  const [searchTerm, setSearchTerm] = React.useState('');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [contractFilter, setContractFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');


  // Form State
  const [selectedClientId, setSelectedClientId] = React.useState<string | undefined>();
  const [selectedContractId, setSelectedContractId] = React.useState<string | undefined>();
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [currentStatus, setCurrentStatus] = React.useState<ClientContract['status']>('Active');
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);

  const allClients = React.useMemo(() => clientsSnapshot?.docs.map(doc => doc.data()) ?? [], [clientsSnapshot]);
  const allContracts = React.useMemo(() => contractsSnapshot?.docs.map(doc => doc.data()) ?? [], [contractsSnapshot]);

  const clientContracts = React.useMemo(() => {
    let baseContracts = snapshot?.docs.map(doc => {
      const client = allClients.find(c => c.id === doc.data().clientId);
      const contract = allContracts.find(c => c.id === doc.data().contractId);
      return {
        ...doc.data(),
        clientPhone: client?.phoneNumber,
        contractPeriod: contract?.period,
      };
    }) ?? [];

    if (dateRange?.from) {
      const fromDate = startOfDay(dateRange.from);
      const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      baseContracts = baseContracts.filter(cc => {
        const contractDate = new Date(cc.startDate);
        return contractDate >= fromDate && contractDate <= toDate;
      });
    }

    if (contractFilter !== 'all') {
      baseContracts = baseContracts.filter(cc => cc.contractId === contractFilter);
    }
    
    if (statusFilter !== 'all') {
      baseContracts = baseContracts.filter(cc => cc.status === statusFilter);
    }

    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      baseContracts = baseContracts.filter(cc => 
        cc.clientName.toLowerCase().includes(lowercasedFilter) ||
        cc.contractName.toLowerCase().includes(lowercasedFilter)
      );
    }

    return baseContracts;
  }, [snapshot, allClients, allContracts, searchTerm, dateRange, contractFilter, statusFilter]);
  
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
              setCurrentStatus(selectedClientContract.status);
          } else {
              setSelectedClientId(undefined);
              setSelectedContractId(undefined);
              setStartDate(new Date());
              setCurrentStatus('Active');
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

    let status = currentStatus;
    if (status !== 'Cancelled' && isAfter(new Date(), endDate)) {
        status = 'Expired';
    }


    const data = {
        clientId: client.id,
        clientName: client.name,
        contractId: contract.id,
        contractName: contract.name,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: status,
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
  
  const getStatusVariant = (status: ClientContract['status']): 'default' | 'secondary' | 'destructive' => {
      switch (status) {
          case 'Active':
              return 'default';
          case 'Expired':
              return 'secondary';
          case 'Cancelled':
              return 'destructive';
          default:
              return 'outline';
      }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateRange(undefined);
    setContractFilter('all');
    setStatusFilter('all');
  }

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
                 <TableHead>Client Phone</TableHead>
                <TableHead>Contract</TableHead>
                 <TableHead>Period</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
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
      <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search client or contract..."
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
                    <span>Filter by date range</span>
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
            <Select value={contractFilter} onValueChange={setContractFilter}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by contract" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Contracts</SelectItem>
                    {allContracts.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
             <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
            </Select>
            {(searchTerm || dateRange || contractFilter !== 'all' || statusFilter !== 'all') && <Button variant="ghost" onClick={clearFilters}>Clear Filters</Button>}
        </div>
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> New Client Contract</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Client Phone</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientContracts.map((cc) => {
                const variant = getStatusVariant(cc.status);
                return (
                  <TableRow key={cc.id}>
                    <TableCell className="font-medium">{cc.clientName}</TableCell>
                    <TableCell>{cc.clientPhone || 'N/A'}</TableCell>
                    <TableCell>{cc.contractName}</TableCell>
                    <TableCell>{cc.contractPeriod} months</TableCell>
                    <TableCell>{format(new Date(cc.startDate), 'PP')}</TableCell>
                    <TableCell>{format(new Date(cc.endDate), 'PP')}</TableCell>
                    <TableCell><Badge variant={variant}>{cc.status}</Badge></TableCell>
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
                 <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                    <Label htmlFor="status" className="sm:text-right">Status</Label>
                    <Select name="status" value={currentStatus} onValueChange={(v) => setCurrentStatus(v as ClientContract['status'])} required>
                        <SelectTrigger className="sm:col-span-3">
                        <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Expired">Expired</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
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
