import prisma from "@/lib/db";
import { SeniorCareClient } from "./SeniorCareClient";

export const dynamic = 'force-dynamic';

export default async function SeniorCarePage() {
  // Use correct Prisma relation names (lowercase)
  const rawSubscriptions = await prisma.subscription.findMany({
    include: {
      customer: true,
    },
    orderBy: {
      nextDeliveryDate: 'asc'
    }
  });

  // Remap for client which expects uppercase 'Customer'
  const subscriptions = rawSubscriptions.map(s => ({
    ...s,
    Customer: s.customer,
  }));

  const products = await prisma.product.findMany({
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

  // Remap batch → batches for client
  const productsWithBatches = products.map(p => ({
    ...p,
    batches: p.batch,
  }));

  return (
    <div className="p-8 h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-primary pl-4 rounded-sm">
          Courier Process
        </h1>
        <p className="text-slate-500 mt-1 pl-5">Manage monthly medicine deliveries</p>
      </div>
      
      <SeniorCareClient subscriptions={subscriptions} products={productsWithBatches} />
    </div>
  );
}

