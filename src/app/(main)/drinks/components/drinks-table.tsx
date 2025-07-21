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
import { MoreHorizontal, PlusCircle, Edit, Trash2 } from 'lucide-react';
import type { Drink, DrinkRecipeItem, Material } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DrinksTableProps {
  initialDrinks: Drink[];
  allMaterials: Material[];
}

export function DrinksTable({ initialDrinks, allMaterials }: DrinksTableProps) {
  const [drinks, setDrinks] = React.useState(initialDrinks);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedDrink, setSelectedDrink] = React.useState<Drink | null>(null);
  const [recipe, setRecipe] = React.useState<DrinkRecipeItem[]>([]);

  React.useEffect(() => {
    if(selectedDrink) {
      setRecipe(selectedDrink.recipe);
    } else {
      setRecipe([]);
    }
  }, [selectedDrink, isSheetOpen]);

  const handleAddClick = () => {
    setSelectedDrink(null);
    setIsSheetOpen(true);
  };

  const handleEditClick = (drink: Drink) => {
    setSelectedDrink(drink);
    setIsSheetOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDrinks(drinks.filter((d) => d.id !== id));
  };
  
  const handleRecipeChange = (materialId: string, checked: boolean | 'indeterminate') => {
    if (checked) {
      setRecipe([...recipe, { materialId, quantity: 0 }]);
    } else {
      setRecipe(recipe.filter(item => item.materialId !== materialId));
    }
  };

  const handleQuantityChange = (materialId: string, quantity: number) => {
    setRecipe(recipe.map(item => item.materialId === materialId ? { ...item, quantity } : item));
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newDrink = {
      id: selectedDrink ? selectedDrink.id : `drink-${Date.now()}`,
      name: formData.get('name') as string,
      price: Number(formData.get('price')),
      recipe: recipe.filter(r => r.quantity > 0),
    };

    if (selectedDrink) {
      setDrinks(drinks.map(d => d.id === newDrink.id ? newDrink : d));
    } else {
      setDrinks([...drinks, newDrink]);
    }
    setIsSheetOpen(false);
  };

  const getMaterialName = (id: string) => allMaterials.find(m => m.id === id)?.name || 'Unknown';

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleAddClick}><PlusCircle className="mr-2 h-4 w-4" /> Add Drink</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Recipe</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drinks.map((drink) => (
              <TableRow key={drink.id}>
                <TableCell className="font-medium">{drink.name}</TableCell>
                <TableCell>${drink.price.toFixed(2)}</TableCell>
                <TableCell>
                  {drink.recipe.map(item => `${item.quantity}${allMaterials.find(m=>m.id === item.materialId)?.unit || ''} ${getMaterialName(item.materialId)}`).join(', ')}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(drink)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteClick(drink.id)} className="text-destructive">
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
        <SheetContent className="sm:max-w-lg">
          <form onSubmit={handleFormSubmit}>
            <SheetHeader>
              <SheetTitle>{selectedDrink ? 'Edit Drink' : 'Add New Drink'}</SheetTitle>
              <SheetDescription>
                {selectedDrink ? 'Update the details of this drink recipe.' : 'Create a new drink recipe for your menu.'}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" defaultValue={selectedDrink?.name} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="price" className="text-right">Price</Label>
                <Input id="price" name="price" type="number" step="0.01" defaultValue={selectedDrink?.price} className="col-span-3" />
              </div>
              <div>
                <Label>Recipe Ingredients</Label>
                <ScrollArea className="h-72 mt-2 rounded-md border p-4">
                  <div className="space-y-4">
                    {allMaterials.map(material => {
                      const recipeItem = recipe.find(item => item.materialId === material.id);
                      return (
                        <div key={material.id} className="flex items-center gap-4">
                           <Checkbox
                              id={`mat-${material.id}`}
                              checked={!!recipeItem}
                              onCheckedChange={(checked) => handleRecipeChange(material.id, checked)}
                           />
                          <Label htmlFor={`mat-${material.id}`} className="flex-1">{material.name}</Label>
                          {recipeItem && (
                              <Input
                                  type="number"
                                  step="0.01"
                                  className="w-32"
                                  placeholder={`Qty (${material.unit})`}
                                  defaultValue={recipeItem.quantity}
                                  onChange={(e) => handleQuantityChange(material.id, Number(e.target.value))}
                               />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button type="submit">Save Recipe</Button>
              </SheetClose>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
