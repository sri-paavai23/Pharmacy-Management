import prisma from "@/lib/db";
import { CounterSaleClient } from "./CounterSaleClient";

export const dynamic = 'force-dynamic';

export default async function CounterSalePage() {
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

  // Remap batch → batches for CounterSaleClient
  const products = rawProducts.map(p => ({
    ...p,
    batches: p.batch,
  }));

  return (
    <div className="h-full">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <CounterSaleClient products={products as any} />
    </div>
  );
}

