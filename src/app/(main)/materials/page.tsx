import { materials } from '@/lib/data';
import { MaterialsTable } from './components/materials-table';
import { Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function MaterialsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Package className="w-8 h-8" /> Material Management
        </h1>
        <p className="text-muted-foreground">
          Create, view, and manage your buffet's raw materials.
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Materials Inventory</CardTitle>
            <CardDescription>A list of all materials in your inventory.</CardDescription>
        </CardHeader>
        <CardContent>
            <MaterialsTable data={materials} />
        </CardContent>
      </Card>
    </div>
  );
}
