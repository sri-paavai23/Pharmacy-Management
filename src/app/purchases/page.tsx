import prisma from "@/lib/db";
import { PurchasesClient } from "./PurchasesClient";

export const dynamic = 'force-dynamic';

export default async function PurchasesPage() {
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' }
  });

  const vendors = await prisma.vendor.findMany({
    orderBy: { companyName: 'asc' }
  });

  // Use correct Prisma relation names (lowercase)
  const rawPurchases = await prisma.purchase.findMany({
    include: {
      vendor: true,
      purchaseitem: {
        include: {
          batch: {
            include: { product: true }
          }
        }
      }
    },
    orderBy: { date: 'desc' }
  });

  // Remap for the client which uses uppercase relation names
  const purchases = rawPurchases.map(p => ({
    ...p,
    Vendor: p.vendor,
    items: p.purchaseitem.map(pi => ({
      ...pi,
      Batch: {
        ...pi.batch,
        Product: pi.batch.product,
      }
    }))
  }));

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-primary pl-4 rounded-sm">
            Purchases & Inward
          </h1>
          <p className="text-slate-500 mt-1 pl-5">Manage incoming stock and vendor invoices.</p>
        </div>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <PurchasesClient products={products} vendors={vendors} purchases={purchases as any} />
    </div>
  );
}

