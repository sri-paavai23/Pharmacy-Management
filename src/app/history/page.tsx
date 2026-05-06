import prisma from "@/lib/db";
import { HistoryClient } from "./HistoryClient";

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const rawAllSales = await prisma.sale.findMany({
    include: {
      customer: true,
      doctor: true,
      saleitem: {
        include: {
          batch: { include: { product: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Remap for the client which uses uppercase relation names
  const allSales = rawAllSales.map(s => ({
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

  const rawProducts = await prisma.product.findMany({
    include: {
      batch: {
        where: {
          currentStock: { gt: 0 }
        },
        orderBy: {
          expiryDate: 'asc'
        }
      }
    }
  });

  const products = rawProducts.map(p => ({
    ...p,
    batches: p.batch,
  }));

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-slate-500 pl-4 rounded-sm">
            Sales History
          </h1>
          <p className="text-slate-500 mt-1 pl-5">View past sales, filter by date, and inspect invoiced items.</p>
        </div>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <HistoryClient allSales={allSales as any} products={products as any} />
    </div>
  );
}

