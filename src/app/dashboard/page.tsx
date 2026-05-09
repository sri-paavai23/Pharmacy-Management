import prisma from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, IndianRupee, PackagePlus, Truck } from "lucide-react";
import { DashboardChart } from "@/components/DashboardChart";
import { ChartFilter } from "./ChartFilter";

export const dynamic = 'force-dynamic';

export default async function DashboardPage(props: { searchParams: Promise<{ range?: string, start?: string, end?: string }> }) {
  const searchParams = await props.searchParams;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Stats calculations
  const todaysSales = await prisma.sale.aggregate({
    where: { createdAt: { gte: today } },
    _sum: { totalAmount: true, totalProfit: true },
  });

  const todaysRefunds = await prisma.salesreturn.aggregate({
    where: { date: { gte: today } },
    _sum: { refundAmount: true },
  });

  const h1SalesCount = await prisma.sale.count({
    where: {
      createdAt: { gte: today },
      saleitem: { some: { batch: { product: { scheduleH1: true } } } }
    }
  });

  const revenue = todaysSales._sum.totalAmount || 0;
  const refunds = todaysRefunds._sum.refundAmount || 0;
  const netRevenue = revenue - refunds;

  // Low stock
  const lowStockCount = await prisma.batch.count({
    where: { currentStock: { lte: 20 } },
  });

  // Pending senior care (as placeholder for deliveries)
  const activeSubscribers = await prisma.customer.count({
    where: { isSeniorCitizen: true },
  });

  // Expiry alerts (next 90 days)
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setDate(today.getDate() + 90);
  
  const expiryCount = await prisma.batch.count({
    where: { 
      expiryDate: { lte: threeMonthsFromNow, gt: today },
      currentStock: { gt: 0 }
    },
  });

  const range = searchParams.range || 'week';

  let startDate = new Date();
  let endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  
  let numPoints = 7;
  let interval = 'day';

  if (range === 'day') {
    startDate.setHours(0, 0, 0, 0);
    numPoints = 24;
    interval = 'hour';
  } else if (range === 'month') {
    startDate.setDate(today.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);
    numPoints = 30;
  } else if (range === 'custom') {
    if (searchParams.start && searchParams.end) {
       startDate = new Date(searchParams.start);
       endDate = new Date(searchParams.end);
       endDate.setHours(23, 59, 59, 999);
       const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
       numPoints = diffDays;
       if (numPoints <= 1) {
          numPoints = 24;
          interval = 'hour';
       }
    } else {
       startDate.setDate(today.getDate() - 6);
       startDate.setHours(0, 0, 0, 0);
       numPoints = 7;
    }
  } else {
    startDate.setDate(today.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    numPoints = 7;
  }

  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: startDate, lte: endDate } },
    select: { createdAt: true, totalAmount: true, totalProfit: true },
    orderBy: { createdAt: 'asc' }
  });

  const chartDataMap = new Map();
  if (interval === 'hour') {
    for (let i = 0; i < 24; i++) {
      const d = new Date(startDate);
      d.setHours(d.getHours() + i);
      const str = d.toLocaleTimeString("en-US", { hour: 'numeric', hour12: true });
      chartDataMap.set(str, { name: str, revenue: 0, profit: 0 });
    }
  } else {
    for (let i = 0; i < numPoints; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const str = d.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' });
      chartDataMap.set(str, { name: str, revenue: 0, profit: 0 });
    }
  }

  for (const sale of sales) {
    let str = "";
    if (interval === 'hour') {
      str = sale.createdAt.toLocaleTimeString("en-US", { hour: 'numeric', hour12: true });
    } else {
      str = sale.createdAt.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' });
    }
    if (chartDataMap.has(str)) {
      const existing = chartDataMap.get(str);
      existing.revenue += sale.totalAmount;
      existing.profit += sale.totalProfit;
    }
  }

  const chartData = Array.from(chartDataMap.values());

  return (
    <div className="p-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 border-l-8 border-primary pl-6 rounded-sm">
            Pharmacy Control Center
          </h1>
          <p className="text-slate-400 font-bold mt-2 pl-8">Real-time operational overview</p>
        </div>
        <div className="text-sm font-black text-slate-500 bg-white px-6 py-3 rounded-2xl border shadow-sm flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">

        {/* Net Revenue */}
        <Card className="shadow-xl border-0 overflow-hidden group hover:shadow-2xl transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-blue-50/50">
            <CardTitle className="text-xs font-black uppercase text-blue-600 tracking-widest">Net Revenue Today</CardTitle>
            <IndianRupee className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-black text-slate-800">₹{netRevenue.toFixed(2)}</div>
            <div className="flex items-center gap-2 mt-2">
               <span className="text-[10px] font-bold text-slate-400">GROSS: ₹{revenue.toFixed(2)}</span>
               {refunds > 0 && <span className="text-[10px] font-bold text-red-500">REFUNDS: -₹{refunds.toFixed(2)}</span>}
            </div>
          </CardContent>
        </Card>

        {/* H1 Compliance */}
        <Card className="shadow-xl border-0 overflow-hidden group hover:shadow-2xl transition-all border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-red-50/50">
            <CardTitle className="text-xs font-black uppercase text-red-600 tracking-widest">H1 Sales Today</CardTitle>
            <Activity className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-black text-slate-800">{h1SalesCount} Sales</div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 italic">Strict Doctor Registry Linkage Active</p>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="shadow-xl border-0 overflow-hidden group hover:shadow-2xl transition-all border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-amber-50/50">
            <CardTitle className="text-xs font-black uppercase text-amber-600 tracking-widest">Critical Stock</CardTitle>
            <PackagePlus className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-black text-amber-600">{lowStockCount} SKUs</div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Immediate Purchase Required</p>
          </CardContent>
        </Card>

        {/* Deliveries */}
        <Card className="shadow-xl border-0 overflow-hidden group hover:shadow-2xl transition-all border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-purple-50/50">
            <CardTitle className="text-xs font-black uppercase text-purple-600 tracking-widest">Active Subscribers</CardTitle>
            <Truck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-black text-purple-600">{activeSubscribers}</div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Senior Citizen Care Program</p>
          </CardContent>
        </Card>

        {/* Expiry Alerts */}
        <Card className="shadow-xl border-0 overflow-hidden group hover:shadow-2xl transition-all border-l-4 border-l-red-400">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-red-50">
            <CardTitle className="text-xs font-black uppercase text-red-500 tracking-widest">Expiry Alerts</CardTitle>
            <Activity className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-black text-red-600">{expiryCount} Batches</div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Expiring in &lt; 90 Days</p>
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <Card className="col-span-12 shadow-2xl border-0 overflow-hidden">
          <CardHeader className="bg-slate-900 px-8 py-6 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-black text-white tracking-tight">Revenue Performance</CardTitle>
            <div className="flex gap-4 items-center">
               <ChartFilter />
               <div className="flex gap-4 ml-4">
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"/><span className="text-[10px] font-bold text-white/60 uppercase">Revenue</span></div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"/><span className="text-[10px] font-bold text-white/60 uppercase">Profit</span></div>
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-10 bg-white">
            <div className="h-[400px] min-h-[400px] w-full">
              <DashboardChart data={chartData} showProfit={true} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

