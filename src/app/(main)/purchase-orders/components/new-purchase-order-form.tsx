
"use client";

import * as React from 'react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, addDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { materialConverter, purchaseCategoryConverter, purchaseOrderConverter } from '@/lib/converters';
import type { PurchaseOrderItem, Material, PurchaseCategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';

export function NewPurchaseOrderForm() {
  const [materialsSnapshot, materialsLoading] = useCollection(collection(db, 'materials').withConverter(materialConverter));
  const [categoriesSnapshot, categoriesLoading] = useCollection(collection(db, 'purchaseCategories').withConverter(purchaseCategoryConverter));
  
  const allMaterials = materialsSnapshot?.docs.map(doc => doc.data()) ?? [];
  const allCategories = categoriesSnapshot?.docs.map(doc => doc.data()) ?? [];

  const [orderItems, setOrderItems] = React.useState<PurchaseOrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleItemChange = (materialId: string, checked: boolean | 'indeterminate') => {
    if (checked) {
      setOrderItems([...orderItems, { materialId, quantity: 1, price: 0 }]);
    } else {
      setOrderItems(orderItems.filter(item => item.materialId !== materialId));
    }
  };

  const handleFieldChange = (materialId: string, field: 'quantity' | 'price', value: number) => {
    setOrderItems(orderItems.map(item => item.materialId === materialId ? { ...item, [field]: value } : item));
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const itemsToSave = orderItems.filter(i => i.quantity > 0 && i.price > 0);
    const categoryId = formData.get('categoryId') as string;
    const location = formData.get('location') as string;
    
    if (itemsToSave.length === 0) {
        toast({ variant: "destructive", title: "Cannot create order", description: "Please add at least one material with a valid quantity and price." });
        setIsSubmitting(false);
        return;
    }
    if (!categoryId || !location) {
        toast({ variant: "destructive", title: "Cannot create order", description: "Please select a category and specify a location." });
        setIsSubmitting(false);
        return;
    }

    const selectedCategory = allCategories.find(c => c.id === categoryId);
    if (!selectedCategory) {
        toast({ variant: "destructive", title: "Cannot create order", description: "Invalid category selected." });
        setIsSubmitting(false);
        return;
    }
    
    const newOrderRef = doc(collection(db, 'purchaseOrders'));
    try {
        await addDoc(collection(db, 'purchaseOrders').withConverter(purchaseOrderConverter), {
            id: newOrderRef.id,
            status: 'Pending',
            createdAt: new Date().toISOString(),
            items: itemsToSave,
            category: { id: selectedCategory.id, name: selectedCategory.name },
            location,
        });
        toast({ title: "Purchase order created successfully!", description: "You can track its status on the Purchasing Status page." });
        router.push('/purchasing-status');
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error creating order", description: error.message });
        setIsSubmitting(false);
    }
  };

  const getMaterialUnit = (id: string) => allMaterials.find(m => m.id === id)?.unit || '';

  if (materialsLoading || categoriesLoading) {
    return <Skeleton className="h-[400px] w-full" />
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-8">
        <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="categoryId">Category</Label>
                <Select name="categoryId" required>
                    <SelectTrigger id="categoryId">
                        <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                        {allCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="location">Purchase Location</Label>
                <Input id="location" name="location" placeholder="e.g. Local Market, Online Supplier" required />
            </div>
        </div>

        <div>
            <Label>Materials to Order</Label>
            <ScrollArea className="h-72 mt-2 rounded-md border">
                <div className="p-4 space-y-4">
                {allMaterials.map(material => {
                    const orderItem = orderItems.find(item => item.materialId === material.id);
                    return (
                    <div key={material.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-2 rounded-md border">
                        <div className="flex items-center gap-2 flex-1">
                            <Checkbox
                                id={`mat-${material.id}`}
                                checked={!!orderItem}
                                onCheckedChange={(checked) => handleItemChange(material.id, checked)}
                            />
                            <Label htmlFor={`mat-${material.id}`} className="font-medium">{material.name}</Label>
                        </div>
                        {orderItem && (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Input
                                    type="number"
                                    className="w-full sm:w-28"
                                    min="0.01"
                                    step="0.01"
                                    placeholder={`Qty (${getMaterialUnit(material.id)})`}
                                    defaultValue={orderItem.quantity === 1 ? '' : orderItem.quantity}
                                    onChange={(e) => handleFieldChange(material.id, 'quantity', Number(e.target.value))}
                                    required
                                />
                                <Input
                                    type="number"
                                    className="w-full sm:w-28"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="Price/unit"
                                    onChange={(e) => handleFieldChange(material.id, 'price', Number(e.target.value))}
                                    required
                                />
                            </div>
                        )}
                    </div>
                    )
                })}
                </div>
            </ScrollArea>
        </div>
        <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Create Purchase Order'}</Button>
        </div>
    </form>
  );
}
