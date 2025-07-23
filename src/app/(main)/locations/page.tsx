import { LocationsTable } from './components/locations-table';
import { MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LocationsPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <MapPin className="w-8 h-8" /> Location Management
        </h1>
        <p className="text-muted-foreground">
          Manage your locations.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>All Locations</CardTitle>
          <CardDescription>A list of all locations.</CardDescription>
        </CardHeader>
        <CardContent>
          <LocationsTable />
        </CardContent>
      </Card>
    </div>
  );
}
