import prisma from "@/lib/db";
import { ReturnsClient } from "./ReturnsClient";

export const dynamic = 'force-dynamic';

export default async function ReturnsPage() {
  // Fetch with correct Prisma relation names (lowercase)
  const rawSalesReturns = await prisma.salesreturn.findMany({
    include: {
      sale: {
        include: {
          customer: true,
          saleitem: {
            include: {
              batch: {
                include: { product: true }
              }
            }
          }
        }
      }
    },
    orderBy: { date: 'desc' }
  });

  // Remap for the client which uses uppercase relation names
  const salesReturns = rawSalesReturns.map(r => ({
    ...r,
    Sale: {
      ...r.sale,
      Customer: r.sale.customer,
      items: r.sale.saleitem.map(si => ({
        ...si,
        Batch: {
          ...si.batch,
          Product: si.batch.product,
        }
      }))
    }
  }));

  const rawAllSales = await prisma.sale.findMany({
    include: {
      customer: true,
      saleitem: {
        include: {
          batch: { include: { product: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Remap for the client 
  const allSales = rawAllSales.map(s => ({
    ...s,
    Customer: s.customer,
    items: s.saleitem.map(si => ({
      ...si,
      Batch: {
        ...si.batch,
        Product: si.batch.product,
      }
    }))
  }));

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-orange-500 pl-4 rounded-sm">
            Returns & Refunds
          </h1>
          <p className="text-slate-500 mt-1 pl-5">Process customer returns and manage stock reconciliation.</p>
        </div>
      </div>
      <ReturnsClient salesReturns={salesReturns} allSales={allSales} />
    </div>
  );
}

