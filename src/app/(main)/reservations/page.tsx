import { ReservationsTable } from './components/reservations-table';
import { CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ReservationsPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <CalendarClock className="w-8 h-8" /> Room Reservations
        </h1>
        <p className="text-muted-foreground">
          Manage room bookings for your clients.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>All Reservations</CardTitle>
          <CardDescription>A list of all active and completed reservations.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReservationsTable />
        </CardContent>
      </Card>
    </div>
  );
}
