
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { materialConverter } from '@/lib/converters';
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
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, PlusCircle, Edit, Trash2, Search } from 'lucide-react';
import type { Material } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export function MaterialsTable() {
  const [snapshot, loading] = useCollection(collection(db, 'materials').withConverter(materialConverter));
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedMaterial, setSelectedMaterial] = React.useState<Material | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  const materials = React.useMemo(() => {
    const baseMaterials = snapshot?.docs.map(doc => doc.data()) ?? [];
    if (!searchTerm) {
        return baseMaterials;
    }
    return baseMaterials.filter(material => 
        material.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [snapshot, searchTerm]);

  const handleAddClick = () => {
    setSelectedMaterial(null);
    setIsSheetOpen(true);
  };

  const handleEditClick = (material: Material) => {
    setSelectedMaterial(material);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if(!id) return;
    await deleteDoc(doc(db, 'materials', id));
  };
  
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const materialData = {
        name: formData.get('name') as string,
        stock: Number(formData.get('stock')),
        unit: formData.get('unit') as Material['unit'],
        lowStockThreshold: Number(formData.get('lowStockThreshold')),
    };

    if (selectedMaterial) {
        const materialDocRef = doc(db, 'materials', selectedMaterial.id);
        await updateDoc(materialDocRef, materialData);
    } else {
        await addDoc(collection(db, 'materials'), materialData);
    }
    setIsSheetOpen(false);
    setSelectedMaterial(null);
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
                <TableHead className="hidden md:table-cell">Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
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
                placeholder="Search materials..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> Add Material</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((material) => (
              <TableRow key={material.id}>
                <TableCell className="font-medium">{material.name}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {material.stock} {material.unit}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      material.stock === 0 ? 'destructive' :
                      material.stock < material.lowStockThreshold
                        ? 'secondary'
                        : 'default'
                    }
                  >
                    {material.stock === 0 ? 'Out of Stock' :
                     material.stock < material.lowStockThreshold
                      ? 'Low Stock'
                      : 'In Stock'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(material)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteClick(material.id)} className="text-destructive">
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
            <SheetTitle>{selectedMaterial ? 'Edit Material' : 'Add New Material'}</SheetTitle>
            <SheetDescription>
              {selectedMaterial ? 'Update the details of this material.' : 'Fill in the details for the new material.'}
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="name" className="sm:text-right">Name</Label>
              <Input id="name" name="name" defaultValue={selectedMaterial?.name} className="sm:col-span-3" required/>
            </div>
            <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="stock" className="sm:text-right">Stock</Label>
              <Input id="stock" name="stock" type="number" step="any" min="0" defaultValue={selectedMaterial?.stock} className="sm:col-span-3" required/>
            </div>
            <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="unit" className="sm:text-right">Unit</Label>
               <Select name="unit" defaultValue={selectedMaterial?.unit} required>
                <SelectTrigger className="sm:col-span-3">
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="l">l</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="piece">piece</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="grid sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="lowStockThreshold" className="sm:text-right whitespace-nowrap">Low Stock At</Label>
              <Input id="lowStockThreshold" name="lowStockThreshold" type="number" step="any" min="0" defaultValue={selectedMaterial?.lowStockThreshold} className="sm:col-span-3" required/>
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
