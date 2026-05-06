"use client";

import { useState } from "react";
import { product, batch, sale, customer, doctor, saleitem, journalentry, journalline, ledger, accountgroup } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { DashboardChart } from "@/components/DashboardChart";
import { Button } from "@/components/ui/button";
import { Calendar, Activity, IndianRupee, Printer, Download, PackageOpen, Clock, ShieldCheck, Landmark } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";

type MappedChartData = { name: string; revenue: number; profit: number };
type ItemProfit = { name: string; qtySold: number; revenue: number; profit: number };

type SaleWithCompliance = sale & {
  Customer: customer | null,
  Doctor: doctor | null,
  items: (saleitem & { Batch: batch & { Product: product } })[]
};

type JournalEntryWithLines = journalentry & {
  lines: (journalline & { Ledger: ledger })[]
};

type LedgerWithGroup = ledger & {
  Group: accountgroup
};

export function ReportsClient({
  period,
  totalRevenue,
  totalProfit,
  totalTax,
  chartData,
  profitByItem,
  h1Sales,
  journalEntries,
  ledgers,
  taxBySlab,
  stockProducts = []
}: {
  period: string;
  totalRevenue: number;
  totalProfit: number;
  totalTax: number;
  chartData: MappedChartData[];
  profitByItem: ItemProfit[];
  h1Sales: SaleWithCompliance[];
  journalEntries: JournalEntryWithLines[];
  ledgers: LedgerWithGroup[];
  taxBySlab: Record<string, number>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stockProducts?: any[];
}) {
  const [activeTab, setActiveTab] = useState<"analytics" | "h1register" | "daybook" | "trialbalance" | "stock">("analytics");
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const handlePrint = () => {
    window.print();
  };

  const updateDateRange = (key: "from" | "to", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", "custom");
    params.set(key, value);
    router.push(`?${params.toString()}`);
  };

  const exportCSV = () => {
    let csvData = "";
    
    if (activeTab === "analytics") {
      csvData += "Product Name,Qty Sold,Total Revenue,Gross Profit,Margin %\n";
      profitByItem.forEach(item => {
        csvData += `"${item.name}",${item.qtySold},${item.revenue},${item.profit},${((item.profit/item.revenue)*100).toFixed(1)}%\n`;
      });
    } else if (activeTab === "h1register") {
      csvData += "Date,Invoice,Patient,Doctor,Items\n";
      h1Sales.forEach(s => {
        const itemStr = s.items.map(i => i.Batch.Product.name).join(" | ");
        csvData += `"${new Date(s.createdAt).toLocaleDateString()}",${s.invoiceNumber},"${s.Customer?.name || 'Walk-in'}","${s.Doctor?.name || 'N/A'}","${itemStr}"\n`;
      });
    } else if (activeTab === "daybook") {
      csvData += "Date,Voucher No,Type,Narration,Debit,Credit\n";
      journalEntries.forEach(v => {
         v.lines.forEach(l => {
            csvData += `"${new Date(v.date).toLocaleDateString()}",${v.voucherNumber},${v.voucherType},"${v.narration}",${l.debit},${l.credit}\n`;
         });
      });
    }

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `report_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 border-l-8 border-primary pl-6 rounded-sm">
            Financials & Compliance
          </h1>
          <p className="text-slate-500 font-bold mt-2 pl-8 uppercase text-[10px] tracking-widest">Audit-ready registers and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-slate-300 rounded-2xl font-black text-xs" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2 text-slate-400" /> Export CSV
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg rounded-2xl font-black text-xs h-11 px-6" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Print Register
          </Button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b-2 border-slate-100 print:hidden sticky top-16 bg-slate-50/80 backdrop-blur-md z-1">
        {[
          { id: "analytics", label: "Financial Analytics", icon: Activity, color: "primary" },
          { id: "h1register", label: "H1 Drug Register", icon: ShieldCheck, color: "red-500" },
          { id: "daybook", label: "Day Book", icon: Clock, color: "blue-500" },
          { id: "trialbalance", label: "Trial Balance", icon: Landmark, color: "emerald-500" },
          { id: "stock", label: "Inventory Health", icon: PackageOpen, color: "amber-500" },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)} 
              className={cn(
                "px-6 py-3 rounded-t-2xl font-black text-xs flex gap-2 items-center transition-all border-b-4", 
                isActive 
                  ? `border-${tab.color} text-${tab.color} bg-white shadow-sm` 
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              )}
            >
              <Icon className="w-4 h-4" /> {tab.label.toUpperCase()}
            </button>
          );
        })}
      </div>

      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="flex bg-white p-1 rounded-2xl border shadow-sm items-center w-fit print:hidden gap-2">
            <Calendar className="w-4 h-4 text-slate-400 ml-4 mr-2" />
            <Link href="?period=7days"><Button variant={period === "7days" ? "secondary" : "ghost"} size="sm" className="rounded-xl px-4 py-1.5 font-black text-[10px]">7D</Button></Link>
            <Link href="?period=30days"><Button variant={period === "30days" ? "secondary" : "ghost"} size="sm" className="rounded-xl px-4 py-1.5 font-black text-[10px]">30D</Button></Link>
            <Link href="?period=thisMonth"><Button variant={period === "thisMonth" ? "secondary" : "ghost"} size="sm" className="rounded-xl px-4 py-1.5 font-black text-[10px]">MTD</Button></Link>
            
            <div className="h-4 w-px bg-slate-200 mx-2" />
            
            <div className="flex items-center gap-2 pr-2">
               <span className="text-[9px] font-black text-slate-400 uppercase">Custom:</span>
               <input 
                 type="date" 
                 value={from}
                 className={cn("text-[10px] font-bold border-none bg-slate-50 rounded-lg px-2 h-8 outline-none focus:ring-1 ring-primary", period === "custom" && "bg-primary/10 text-primary")}
                 onChange={(e) => updateDateRange("from", e.target.value)}
               />
               <span className="text-[10px] font-bold text-slate-300">to</span>
               <input 
                 type="date" 
                 value={to}
                 className={cn("text-[10px] font-bold border-none bg-slate-50 rounded-lg px-2 h-8 outline-none focus:ring-1 ring-primary", period === "custom" && "bg-primary/10 text-primary")}
                 onChange={(e) => updateDateRange("to", e.target.value)}
               />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card className="shadow-2xl border-0 overflow-hidden group">
              <CardHeader className="flex flex-row items-center justify-between pb-2 bg-blue-50/50">
                <CardTitle className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Revenue</CardTitle>
                <IndianRupee className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent className="pt-6">
                <div className="text-3xl font-black text-slate-800">₹{totalRevenue.toFixed(2)}</div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Total Period Turnover</p>
              </CardContent>
            </Card>
            <Card className="shadow-2xl border-0 overflow-hidden group">
              <CardHeader className="flex flex-row items-center justify-between pb-2 bg-emerald-50/50">
                <CardTitle className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Gross Profit</CardTitle>
                <Activity className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="pt-6">
                <div className="text-3xl font-black text-slate-800">₹{totalProfit.toFixed(2)}</div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Operating Margin</p>
              </CardContent>
            </Card>
            <Card className="shadow-2xl border-0 overflow-hidden group">
              <CardHeader className="flex flex-row items-center justify-between pb-2 bg-amber-50/50">
                <CardTitle className="text-[10px] font-black uppercase text-amber-600 tracking-widest">GST Summary</CardTitle>
                <Landmark className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="pt-6">
                <div className="text-3xl font-black text-slate-800">₹{totalTax.toFixed(2)}</div>
                <div className="flex flex-col gap-2 mt-4 max-h-24 overflow-y-auto scrollbar-hide">
                   {Object.entries(taxBySlab).map(([rate, amount]) => (
                     <div key={rate} className="flex justify-between items-center border-b border-amber-100/50 pb-2 last:border-0">
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">GST {rate}%</span>
                           <span className="text-[7px] text-slate-400 font-bold">CGST {(parseFloat(rate)/2)}% + SGST {(parseFloat(rate)/2)}%</span>
                        </div>
                        <span className="text-sm font-black text-slate-700">₹{amount.toFixed(2)}</span>
                     </div>
                   ))}
                   {Object.keys(taxBySlab).length === 0 && <span className="text-[10px] text-slate-300 italic">No taxable sales</span>}
                </div>

              </CardContent>
            </Card>
          </div>

          <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden">
             <CardHeader className="bg-slate-900 p-8 text-white flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-black tracking-tight uppercase">Revenue vs Profit Trend</CardTitle>
                <Badge className="bg-white/10 text-white border-0 font-bold px-4 py-1.5 uppercase text-[9px] tracking-widest">Live Period Updates</Badge>
             </CardHeader>
             <CardContent className="p-10 bg-white">
                <div className="h-[400px]">
                   <DashboardChart data={chartData} />
                </div>
             </CardContent>
          </Card>

          <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden">
            <CardHeader className="bg-white border-b-2 border-slate-50 p-8">
              <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">Drug Performance Ranking</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50 h-16">
                  <TableRow className="border-none">
                    <TableHead className="pl-8 font-black text-[10px] uppercase tracking-widest text-slate-400">Medicine Name</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400">Units Sold</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400">Total Revenue</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400">Gross Margin</TableHead>
                    <TableHead className="text-right pr-8 font-black text-[10px] uppercase tracking-widest text-slate-400">Profit %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profitByItem.map(item => (
                    <TableRow key={item.name} className="h-20 hover:bg-slate-50 transition-colors group">
                      <TableCell className="pl-8 font-black text-slate-800 text-lg group-hover:text-primary transition-colors">{item.name}</TableCell>
                      <TableCell className="text-right"><Badge variant="outline" className="font-black text-slate-500 px-3">{item.qtySold}</Badge></TableCell>
                      <TableCell className="text-right font-bold text-slate-600">₹{item.revenue.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-black text-emerald-600 text-lg">₹{item.profit.toFixed(2)}</TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex flex-col items-end">
                           <span className="text-xs font-black text-slate-800">{((item.profit / item.revenue) * 100).toFixed(1)}%</span>
                           <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (item.profit / item.revenue) * 100)}%` }} />
                           </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "daybook" && (
        <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-5">
           <CardHeader className="bg-blue-600 p-8 text-white flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-black">Daily Transaction Book</CardTitle>
                <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mt-1">Chronological list of all vouchers</p>
              </div>
              <Clock className="w-10 h-10 opacity-20" />
           </CardHeader>
           <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 h-16">
                  <TableRow>
                    <TableHead className="pl-8 font-black text-[10px] uppercase tracking-widest text-slate-400">Date & Ref</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Voucher Particulars</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400">Debit (Dr)</TableHead>
                    <TableHead className="text-right pr-8 font-black text-[10px] uppercase tracking-widest text-slate-400">Credit (Cr)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journalEntries.map(v => (
                    v.lines.map((l, idx) => (
                      <TableRow key={`${v.id}-${idx}`} className="h-16 hover:bg-slate-50 transition-colors border-l-4 border-l-transparent hover:border-l-blue-500">
                        <TableCell className="pl-8">
                           {idx === 0 && (
                             <div className="flex flex-col">
                               <span className="font-black text-slate-900">{new Date(v.date).toLocaleDateString()}</span>
                               <span className="text-[10px] font-bold text-blue-500 uppercase">{v.voucherNumber}</span>
                             </div>
                           )}
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-col">
                             <div className="flex items-center gap-2">
                               <span className={cn("text-xs font-black", l.debit > 0 ? "text-slate-800" : "text-emerald-600 pl-4")}>
                                 {l.debit > 0 ? "" : "To "} {l.Ledger.name}
                               </span>
                             </div>
                             {idx === v.lines.length - 1 && v.narration && <div className="text-[9px] text-slate-400 italic mt-1 pl-4">({v.narration})</div>}
                           </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-slate-800">
                           {l.debit > 0 ? `₹${l.debit.toFixed(2)}` : ""}
                        </TableCell>
                        <TableCell className="text-right pr-8 font-black text-emerald-600">
                           {l.credit > 0 ? `₹${l.credit.toFixed(2)}` : ""}
                        </TableCell>
                      </TableRow>
                    ))
                  ))}
                  {journalEntries.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400">No transactions recorded for this period.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
           </CardContent>
        </Card>
      )}

      {activeTab === "trialbalance" && (
        <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden animate-in slide-in-from-right-10">
           <CardHeader className="bg-emerald-600 p-8 text-white flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-black">Trial Balance</CardTitle>
                <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mt-1">Ledger standing & balance verification</p>
              </div>
              <Landmark className="w-10 h-10 opacity-20" />
           </CardHeader>
           <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 h-16">
                  <TableRow>
                    <TableHead className="pl-8 font-black text-[10px] uppercase tracking-widest text-slate-400">Account Particulars (Group)</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400">Debit Balance (Dr)</TableHead>
                    <TableHead className="text-right pr-8 font-black text-[10px] uppercase tracking-widest text-slate-400">Credit Balance (Cr)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgers.map(l => (
                    <TableRow key={l.id} className="h-16 hover:bg-slate-50 transition-colors">
                      <TableCell className="pl-8">
                         <div className="flex flex-col">
                            <span className="font-black text-slate-800 uppercase text-xs">{l.name}</span>
                            <span className="text-[10px] font-bold text-slate-400">{l.Group.name}</span>
                         </div>
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-800 text-lg">
                         {(l.currentBalance >= 0 && l.balanceType === "Dr") || (l.currentBalance < 0 && l.balanceType === "Cr") ? `₹${Math.abs(l.currentBalance).toFixed(2)}` : ""}
                      </TableCell>
                      <TableCell className="text-right pr-8 font-black text-emerald-600 text-lg">
                         {(l.currentBalance < 0 && l.balanceType === "Dr") || (l.currentBalance >= 0 && l.balanceType === "Cr") ? `₹${Math.abs(l.currentBalance).toFixed(2)}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="bg-slate-900 text-white font-black h-20">
                   <TableRow>
                      <TableCell className="pl-8 text-xl uppercase tracking-tighter">Grand Total Verification</TableCell>
                      <TableCell className="text-right text-2xl">
                         ₹{ledgers.reduce((acc, l) => {
                            const isDr = (l.currentBalance >= 0 && l.balanceType === "Dr") || (l.currentBalance < 0 && l.balanceType === "Cr");
                            return acc + (isDr ? Math.abs(l.currentBalance) : 0);
                         }, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right pr-8 text-2xl text-emerald-400">
                         ₹{ledgers.reduce((acc, l) => {
                            const isCr = (l.currentBalance < 0 && l.balanceType === "Dr") || (l.currentBalance >= 0 && l.balanceType === "Cr");
                            return acc + (isCr ? Math.abs(l.currentBalance) : 0);
                         }, 0).toFixed(2)}
                      </TableCell>
                   </TableRow>
                </TableFooter>
              </Table>
           </CardContent>
        </Card>
      )}

      {activeTab === "h1register" && (
        <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden animate-in slide-in-from-bottom-4">
           {/* H1 Register UI remains mostly same but styles improved */}
           <CardHeader className="bg-red-600 p-8 text-white flex justify-between items-center">
              <div>
                 <CardTitle className="text-2xl font-black text-white">Schedule H1 Register</CardTitle>
                 <p className="text-red-100 text-[10px] font-black uppercase tracking-widest mt-1">Legally mandated drug tracking audit</p>
              </div>
              <ShieldCheck className="w-10 h-10 opacity-20" />
           </CardHeader>
           <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/80 h-16">
                  <TableRow>
                    <TableHead className="pl-8 font-black text-slate-800 text-xs uppercase">Date & Invoice</TableHead>
                    <TableHead className="font-black text-slate-800 text-xs uppercase">Patient Details</TableHead>
                    <TableHead className="font-black text-slate-800 text-xs uppercase">Prescribing Doctor</TableHead>
                    <TableHead className="font-black text-slate-800 text-xs uppercase">H1 Drug Names</TableHead>
                    <TableHead className="text-right pr-8 font-black text-slate-800 text-xs uppercase">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {h1Sales.map(s => (
                     <TableRow key={s.id} className="h-20 hover:bg-red-50/30 transition-colors border-l-4 border-l-transparent hover:border-l-red-500">
                        <TableCell className="pl-8">
                           <div className="font-black text-slate-900">{new Date(s.createdAt).toLocaleDateString()}</div>
                           <div className="text-[10px] font-black text-red-600 uppercase mt-0.5">{s.invoiceNumber}</div>
                        </TableCell>
                        <TableCell>
                           <div className="font-black text-slate-800 uppercase text-xs">{s.Customer?.name || 'Walk-In'}</div>
                           <div className="text-[10px] text-slate-400 font-bold">{s.Customer?.phone || 'NO CONTACT'}</div>
                        </TableCell>
                        <TableCell>
                           <div className="font-black text-slate-800 text-xs uppercase">{s.Doctor?.name || 'REGISTRY MISSING'}</div>
                           <div className="text-[10px] text-red-500 font-black uppercase tracking-tighter">Reg: {s.Doctor?.registrationNumber || 'N/A'}</div>
                        </TableCell>
                        <TableCell>
                           <div className="flex flex-wrap gap-1.5">
                              {s.items.filter(i => i.Batch.Product.scheduleH1).map(i => (
                                <Badge key={i.id} variant="secondary" className="text-[9px] font-black uppercase bg-red-100/50 text-red-700 border-red-200">
                                  {i.Batch.Product.name}
                                </Badge>
                              ))}
                           </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                           <span className="font-black text-slate-900 text-lg">{s.items.reduce((acc, i) => acc + (i.Batch.Product.scheduleH1 ? i.quantity : 0), 0)}</span>
                        </TableCell>
                     </TableRow>
                   ))}
                </TableBody>
              </Table>
           </CardContent>
        </Card>
      )}

      {activeTab === "stock" && (
        <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden">
           <CardHeader className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <CardTitle className="text-2xl font-black uppercase tracking-tight">Consolidated Stock Register</CardTitle>
              <PackageOpen className="w-10 h-10 opacity-20" />
           </CardHeader>
           <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 h-16">
                  <TableRow>
                    <TableHead className="pl-8 font-black text-[10px] uppercase tracking-widest text-slate-400">Product Profile</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 text-center">Batch</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400 text-center">Expiry</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400">Stock</TableHead>
                    <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400">MRP</TableHead>
                    <TableHead className="text-right pr-8 font-black text-[10px] uppercase tracking-widest text-slate-400">Valuation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                   {stockProducts.length > 0 ? stockProducts.flatMap((product: any) =>
                     // eslint-disable-next-line @typescript-eslint/no-explicit-any
                     product.batches.map((batch: any) => {
                       const expiry = new Date(batch.expiryDate);
                       const now = new Date();
                       const daysToExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                       const isExpired = daysToExpiry < 0;
                       const isExpiringSoon = !isExpired && daysToExpiry < 90;
                       return (
                         <TableRow key={batch.id} className="h-16 hover:bg-slate-50 transition-colors">
                           <TableCell className="pl-8">
                             <div className="font-black text-slate-800 uppercase text-xs">{product.name}</div>
                             <div className="text-[10px] text-slate-400">{product.category} • Pack: {product.packSize}</div>
                           </TableCell>
                           <TableCell className="text-center font-mono text-xs text-slate-600">#{batch.batchNumber}</TableCell>
                           <TableCell className="text-center">
                             <span className={`text-xs font-black px-2 py-1 rounded-full ${
                               isExpired ? 'bg-red-100 text-red-600' :
                               isExpiringSoon ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                             }`}>
                               {expiry.toLocaleDateString('en-GB')}
                             </span>
                           </TableCell>
                           <TableCell className={`text-right font-black text-lg ${
                             batch.currentStock === 0 ? 'text-red-500' :
                             batch.currentStock < 20 ? 'text-amber-500' : 'text-slate-800'
                           }`}>{batch.currentStock}</TableCell>
                           <TableCell className="text-right font-bold text-slate-600">₹{batch.mrp.toFixed(2)}</TableCell>
                           <TableCell className="text-right pr-8 font-black text-slate-800">
                             ₹{(batch.currentStock * batch.purchasePrice).toFixed(2)}
                           </TableCell>
                         </TableRow>
                       );
                     })
                   ) : (
                     <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs">No inventory data found</TableCell></TableRow>
                   )}
                </TableBody>
              </Table>
           </CardContent>
        </Card>
      )}
    </div>
  );
}


