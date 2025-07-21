"use client";

import * as React from 'react';
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
import { MoreHorizontal, PlusCircle, Edit, Trash2 } from 'lucide-react';
import type { Material } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function MaterialsTable({ data }: { data: Material[] }) {
  const [materials, setMaterials] = React.useState(data);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedMaterial, setSelectedMaterial] = React.useState<Material | null>(null);

  const handleAddClick = () => {
    setSelectedMaterial(null);
    setIsSheetOpen(true);
  };

  const handleEditClick = (material: Material) => {
    setSelectedMaterial(material);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setMaterials(materials.filter((m) => m.id !== id));
  };
  
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newMaterial = {
        id: selectedMaterial ? selectedMaterial.id : `mat-${Date.now()}`,
        name: formData.get('name') as string,
        stock: Number(formData.get('stock')),
        unit: formData.get('unit') as Material['unit'],
        lowStockThreshold: Number(formData.get('lowStockThreshold')),
    };

    if (selectedMaterial) {
        setMaterials(materials.map(m => m.id === newMaterial.id ? newMaterial : m));
    } else {
        setMaterials([...materials, newMaterial]);
    }
    setIsSheetOpen(false);
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> Add Material</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((material) => (
              <TableRow key={material.id}>
                <TableCell className="font-medium">{material.name}</TableCell>
                <TableCell>
                  {material.stock} {material.unit}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      material.stock < material.lowStockThreshold
                        ? 'destructive'
                        : 'default'
                    }
                  >
                    {material.stock < material.lowStockThreshold
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" name="name" defaultValue={selectedMaterial?.name} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="stock" className="text-right">Stock</Label>
              <Input id="stock" name="stock" type="number" defaultValue={selectedMaterial?.stock} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unit" className="text-right">Unit</Label>
               <Select name="unit" defaultValue={selectedMaterial?.unit}>
                <SelectTrigger className="col-span-3">
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
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lowStockThreshold" className="text-right whitespace-nowrap">Low Stock At</Label>
              <Input id="lowStockThreshold" name="lowStockThreshold" type="number" defaultValue={selectedMaterial?.lowStockThreshold} className="col-span-3" />
            </div>
          </div>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="submit">Save changes</Button>
            </SheetClose>
          </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
