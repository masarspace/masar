import { RoomsTable } from './components/rooms-table';
import { BedDouble } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function RoomsPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BedDouble className="w-8 h-8" /> Room Management
        </h1>
        <p className="text-muted-foreground">
          Manage your rooms.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>All Rooms</CardTitle>
          <CardDescription>A list of all rooms.</CardDescription>
        </CardHeader>
        <CardContent>
          <RoomsTable />
        </CardContent>
      </Card>
    </div>
  );
}
