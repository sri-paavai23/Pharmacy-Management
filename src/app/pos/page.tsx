import prisma from "@/lib/db";
import { PosClient } from "./PosClient";

export const dynamic = 'force-dynamic';

export default async function PosPage() {
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

  // Remap batch → batches for PosClient
  const products = rawProducts.map(p => ({
    ...p,
    batches: p.batch,
  }));

  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
  const doctors = await prisma.doctor.findMany({ orderBy: { name: 'asc' } });

  return (
    <div className="h-full">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <PosClient products={products as any} customers={customers} doctors={doctors} />
    </div>
  );
}

