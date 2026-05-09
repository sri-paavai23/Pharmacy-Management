"use client";

import { memo, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";

interface ChartData {
  name: string;
  revenue: number;
  profit: number;
}

export const DashboardChart = memo(({ data, showProfit = true }: { data: ChartData[], showProfit?: boolean }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          {showProfit && (
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          )}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
        <Tooltip
          contentStyle={{ backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0" }}
          itemStyle={{ fontSize: "14px", fontWeight: 500 }}
          formatter={(value: unknown) => [`₹${Number(value || 0).toFixed(2)}`, "Value"]}
        />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" activeDot={{ r: 8 }} />
        {showProfit && (
          <Area type="monotone" dataKey="profit" name="Gross Profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" activeDot={{ r: 8 }} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
});

DashboardChart.displayName = "DashboardChart";
