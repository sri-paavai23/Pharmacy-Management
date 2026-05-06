import prisma from "@/lib/db";
import { InventoryClient } from "./InventoryClient";

export default async function InventoryPage() {
  const rawProducts = await prisma.product.findMany({
    include: {
      batch: {
        orderBy: {
          expiryDate: 'asc'
        }
      }
    },
    orderBy: {
      name: 'asc'
    }
  });

  // Remap batch → batches for the client component
  const products = rawProducts.map(p => ({
    ...p,
    batches: p.batch,
  }));

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-primary pl-4 rounded-sm">
            Inventory Management
          </h1>
          <p className="text-slate-500 mt-1 pl-5">View and adjust product stocks.</p>
        </div>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <InventoryClient products={products as any} />
    </div>
  );
}
