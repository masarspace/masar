
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { contractConverter } from '@/lib/converters';
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
import type { Contract } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export function ContractsTable() {
  const [snapshot, loading] = useCollection(collection(db, 'contracts').withConverter(contractConverter));
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedContract, setSelectedContract] = React.useState<Contract | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const [contractType, setContractType] = React.useState<'short' | 'long' | undefined>(selectedContract?.type);
  const [period, setPeriod] = React.useState<number | undefined>(selectedContract?.period);

  React.useEffect(() => {
    if (isSheetOpen) {
      if (selectedContract) {
        setContractType(selectedContract.type);
        setPeriod(selectedContract.period);
      } else {
        setContractType(undefined);
        setPeriod(undefined);
      }
    }
  }, [isSheetOpen, selectedContract]);


  const contracts = React.useMemo(() => {
    const baseContracts = snapshot?.docs.map(doc => doc.data()) ?? [];
    if (!searchTerm) {
      return baseContracts;
    }
    return baseContracts.filter(contract => 
      contract.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [snapshot, searchTerm]);

  const handleAddClick = () => {
    setSelectedContract(null);
    setIsSheetOpen(true);
  };

  const handleEditClick = (contract: Contract) => {
    setSelectedContract(contract);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if(!id) return;
    await deleteDoc(doc(db, 'contracts', id));
  };

  const handleTypeChange = (value: 'short' | 'long') => {
    setContractType(value);
    if (value === 'long') {
      setPeriod(12);
    } else {
      // Reset period if switching from long to short
      if (period === 12 && contractType === 'long') {
        setPeriod(undefined);
      }
    }
  };

  const handlePeriodChange = (value: string) => {
    setPeriod(Number(value));
  };
  
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const contractData = {
        name: formData.get('name') as string,
        type: contractType,
        period: period,
    };

    if (selectedContract) {
        const contractDocRef = doc(db, 'contracts', selectedContract.id);
        await updateDoc(contractDocRef, contractData);
    } else {
        await addDoc(collection(db, 'contracts'), contractData);
    }
    setIsSheetOpen(false);
    setSelectedContract(null);
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
                <TableHead>Type</TableHead>
                <TableHead>Period (Months)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
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
                placeholder="Search contracts..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> Add Contract</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Period (Months)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell className="font-medium">{contract.name}</TableCell>
                <TableCell className="capitalize">{contract.type}</TableCell>
                <TableCell>{contract.period}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(contract)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteClick(contract.id)} className="text-destructive">
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
                <SheetTitle>{selectedContract ? 'Edit Contract' : 'Add New Contract'}</SheetTitle>
                <SheetDescription>
                  {selectedContract ? 'Update the details of this contract.' : 'Fill in the details for the new contract.'}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="name" className="sm:text-right">Contract Name</Label>
                  <Input id="name" name="name" defaultValue={selectedContract?.name} className="sm:col-span-3" required/>
                </div>
                <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                    <Label className="sm:text-right">Contract Type</Label>
                    <RadioGroup
                        defaultValue={selectedContract?.type}
                        onValueChange={handleTypeChange}
                        className="sm:col-span-3 flex gap-4"
                        required
                    >
                        <div className="flex items-center space-x-2">
                        <RadioGroupItem value="short" id="short" />
                        <Label htmlFor="short">Short</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                        <RadioGroupItem value="long" id="long" />
                        <Label htmlFor="long">Long</Label>
                        </div>
                    </RadioGroup>
                </div>
                 {contractType && <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
                  <Label htmlFor="period" className="sm:text-right">Period (Months)</Label>
                   <Select name="period" value={period?.toString()} onValueChange={handlePeriodChange} required>
                    <SelectTrigger className="sm:col-span-3">
                      <SelectValue placeholder="Select a period" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractType === 'short' && <>
                        <SelectItem value="3">3 Months</SelectItem>
                        <SelectItem value="6">6 Months</SelectItem>
                      </>}
                      <SelectItem value="12">12 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>}
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
