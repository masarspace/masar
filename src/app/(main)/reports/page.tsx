import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { WastageReport } from './components/wastage-report';

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-8 h-full p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="w-8 h-8" /> Reports
        </h1>
        <p className="text-muted-foreground">
          Generate reports to analyze your buffet's performance and inventory.
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Wastage Report</CardTitle>
            <CardDescription>Analyze the difference between materials used and materials purchased to identify potential waste.</CardDescription>
        </CardHeader>
        <CardContent>
            <WastageReport />
        </CardContent>
      </Card>
    </div>
  );
}
