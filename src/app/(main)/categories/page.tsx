import { CategoriesTable } from './components/categories-table';
import { Tags } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Tags className="w-8 h-8" /> Purchase Categories
        </h1>
        <p className="text-muted-foreground">
          Manage categories for your purchase orders.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>A list of all purchase order categories.</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoriesTable />
        </CardContent>
      </Card>
    </div>
  );
}
