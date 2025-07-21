import { DrinksTable } from './components/drinks-table';
import { GlassWater } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function DrinksPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <GlassWater className="w-8 h-8" /> Drink Recipes
        </h1>
        <p className="text-muted-foreground">
          Define and manage the drink recipes available at your buffet.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Drink Menu</CardTitle>
          <CardDescription>A list of all drinks and their recipes.</CardDescription>
        </CardHeader>
        <CardContent>
          <DrinksTable />
        </CardContent>
      </Card>
    </div>
  );
}
