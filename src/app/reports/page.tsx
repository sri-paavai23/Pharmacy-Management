import prisma from "@/lib/db";
import { ReportsClient } from "./ReportsClient";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function ReportsPage(props: { searchParams: Promise<{ period?: string, from?: string, to?: string }> }) {
  const searchParams = await props.searchParams;
  const period = searchParams.period || "7days";
  const from = searchParams.from;
  const to = searchParams.to;
  const cookieStore = await cookies();
  const fyId = cookieStore.get("activeFinancialYearId")?.value;

  const activeFY = await prisma.financialyear.findFirst({
    where: fyId ? { id: fyId } : { isActive: true }
  });

  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();
  
  if (period === "7days") startDate.setDate(now.getDate() - 7);
  else if (period === "30days") startDate.setDate(now.getDate() - 30);
  else if (period === "thisMonth") startDate.setDate(1);
  else if (period === "custom" && from) {
    startDate = new Date(from);
    if (to) endDate = new Date(to);
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  // Fetch sales for active FY using correct Prisma relation names
  const rawSales = await prisma.sale.findMany({
    where: { 
       createdAt: { gte: startDate, lte: endDate },
       financialYearId: activeFY?.id 
    },
    include: {
      customer: true,
      doctor: true,
      saleitem: { 
        include: { 
          batch: { 
            include: { 
              product: { 
                select: { name: true, taxRate: true, scheduleH1: true, id: true, category: true, manufacturer: true, hsnCode: true, isPrescriptionRequired: true, packSize: true } 
              } 
            } 
          } 
        } 
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  // Remap for the client component which expects capitalized relation names
  const sales = rawSales.map(s => ({
    ...s,
    Customer: s.customer,
    Doctor: s.doctor,
    items: s.saleitem.map(si => ({
      ...si,
      Batch: {
        ...si.batch,
        Product: si.batch.product,
      }
    }))
  }));

  // Fetch returns for the same period to compute NET figures
  const returns = await prisma.salesreturn.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    include: {
      sale: {
        include: {
          saleitem: {
              include: { batch: { include: { product: { select: { name: true, taxRate: true } } } } }
          }
        }
      }
    }
  });

  let totalRefunds = 0;
  let totalReturnProfit = 0;
  const returnChartMap = new Map<string, number>();

  for (const ret of returns) {
    totalRefunds += ret.refundAmount;
    // Estimate profit lost: refundAmount / totalAmount * totalProfit of original sale
    if (ret.sale && ret.sale.totalAmount > 0) {
      const profitRatio = ret.sale.totalProfit / ret.sale.totalAmount;
      totalReturnProfit += ret.refundAmount * profitRatio;
    }
    const dStr = ret.date.toLocaleDateString("en-US", { month: 'short', day: 'numeric' });
    returnChartMap.set(dStr, (returnChartMap.get(dStr) || 0) + ret.refundAmount);
  }

  // Calculate totals
  const chartMap = new Map();
  let grossRevenue = 0, grossProfit = 0, totalTax = 0;

  for (const sale of sales) {
    grossRevenue += sale.totalAmount;
    grossProfit += sale.totalProfit;
    totalTax += sale.totalTax;
    const dStr = sale.createdAt.toLocaleDateString("en-US", { month: 'short', day: 'numeric' });
    if (!chartMap.has(dStr)) chartMap.set(dStr, { name: dStr, revenue: 0, profit: 0 });
    const item = chartMap.get(dStr);
    item.revenue += sale.totalAmount;
    item.profit += sale.totalProfit;
  }

  // Subtract returns from chart daily data
  for (const [dStr, refund] of returnChartMap) {
    if (chartMap.has(dStr)) {
      const item = chartMap.get(dStr);
      item.revenue -= refund;
      // Proportionally reduce profit for that day
      if (item.revenue > 0) {
        const profitRatio = item.profit / (item.revenue + refund);
        item.profit -= refund * profitRatio;
      }
    }
  }

  const totalRevenue = grossRevenue - totalRefunds;
  const totalProfit = grossProfit - totalReturnProfit;

  // Profit by item and Tax by slab
  const itemProfitMap = new Map();
  const taxBySlab = new Map<number, number>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const prodName = item.Batch.Product.name;
      const rate = item.Batch.Product.taxRate;
      const itemRevenue = item.unitPrice * item.quantity;
      const itemProfit = (item.unitPrice - item.unitPurchasePrice) * item.quantity;
      
      // Item Profit Map
      if (!itemProfitMap.has(prodName)) itemProfitMap.set(prodName, { name: prodName, qtySold: 0, revenue: 0, profit: 0 });
      const pItem = itemProfitMap.get(prodName);
      pItem.qtySold += item.quantity;
      pItem.revenue += itemRevenue;
      pItem.profit += itemProfit;

      // Tax Slab Map
      const tax = itemRevenue - (itemRevenue / (1 + (rate / 100)));
      taxBySlab.set(rate, (taxBySlab.get(rate) || 0) + tax);
    }
  }

  // Subtract returns from item profit and tax slab maps
  for (const ret of returns) {
    if (ret.sale && ret.sale.totalAmount > 0) {
      const refundRatio = ret.refundAmount / ret.sale.totalAmount;
      
      for (const si of ret.sale.saleitem) {
        const prodName = si.batch.product.name;
        const rate = si.batch.product.taxRate;
        const siRevenue = si.unitPrice * si.quantity;
        const siProfit = (si.unitPrice - si.unitPurchasePrice) * si.quantity;

        // Proportional reductions
        const revenueReduction = siRevenue * refundRatio;
        const profitReduction = siProfit * refundRatio;
        const qtyReduction = si.quantity * refundRatio;
        const taxReduction = revenueReduction - (revenueReduction / (1 + (rate / 100)));

        if (!itemProfitMap.has(prodName)) {
           // If the sale was outside the period, we still track the negative impact
           itemProfitMap.set(prodName, { name: prodName, qtySold: 0, revenue: 0, profit: 0 });
        }
        const pItem = itemProfitMap.get(prodName);
        pItem.qtySold -= qtyReduction;
        pItem.revenue -= revenueReduction;
        pItem.profit -= profitReduction;

        taxBySlab.set(rate, (taxBySlab.get(rate) || 0) - taxReduction);
      }
    }
  }

  // Day Book: All Journal Entries for this FY — correct relation name: journalline, ledger
  const rawJournalEntries = await prisma.journalentry.findMany({
     where: { financialYearId: activeFY?.id },
     include: { journalline: { include: { ledger: true } } },
     orderBy: { date: 'desc' }
  });

  // Remap journalEntries for client
  const journalEntries = rawJournalEntries.map(je => ({
    ...je,
    lines: je.journalline.map(jl => ({
      ...jl,
      Ledger: jl.ledger
    }))
  }));

  // Trial Balance: Current balances of all ledgers in this FY
  const rawLedgers = await prisma.ledger.findMany({
     where: { financialYearId: activeFY?.id },
     include: { accountgroup: true },
     orderBy: [{ accountgroup: { name: 'asc' } }]
  });

  // Remap ledgers for client
  const ledgers = rawLedgers.map(l => ({
    ...l,
    Group: l.accountgroup
  }));

  // H1 Register
  const h1Sales = sales.filter(sale => 
    sale.items.some(item => item.Batch.Product.scheduleH1)
  );

  // Inventory Health data for stock tab
  const rawStockProducts = await prisma.product.findMany({
    include: {
      batch: {
        orderBy: { expiryDate: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  });

  const stockProducts = rawStockProducts.map(p => ({
    ...p,
    batches: p.batch,
  }));

  return (
    <ReportsClient 
      period={period}
      totalRevenue={totalRevenue}
      totalProfit={totalProfit}
      totalTax={totalTax}
      grossRevenue={grossRevenue}
      totalRefunds={totalRefunds}
      chartData={Array.from(chartMap.values())}
      profitByItem={Array.from(itemProfitMap.values()).sort((a, b) => b.profit - a.profit)}
      h1Sales={h1Sales}
      journalEntries={journalEntries}
      ledgers={ledgers}
      taxBySlab={Object.fromEntries(taxBySlab)}
      stockProducts={stockProducts}
    />
  );
}

