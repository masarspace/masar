"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { orders, drinks } from '@/lib/data';

// Aggregate data
const drinkCounts = orders.reduce((acc, order) => {
  order.items.forEach(item => {
    acc[item.drinkId] = (acc[item.drinkId] || 0) + item.quantity;
  });
  return acc;
}, {} as Record<string, number>);

const chartData = Object.entries(drinkCounts)
  .map(([drinkId, count]) => ({
    name: drinks.find(d => d.id === drinkId)?.name.split(' ')[0] || 'Unknown',
    total: count,
  }))
  .sort((a, b) => b.total - a.total);


export function OverviewChart() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            borderColor: 'hsl(var(--border))',
          }}
        />
        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
