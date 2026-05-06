import prisma from "@/lib/db";
import { CustomersClient } from "./CustomersClient";

export default async function CustomersPage() {
  const rawCustomers = await prisma.customer.findMany({
    include: {
      sale: {
        include: {
          saleitem: {
            include: {
              batch: {
                include: {
                  product: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      },
      subscription: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  // Remap Prisma relation names to what the client component expects
  const customers = rawCustomers.map(c => ({
    ...c,
    sales: c.sale,
    subscriptions: c.subscription,
  }));

  return (
    <div className="p-8 h-full bg-slate-50">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 border-l-4 border-primary pl-4 rounded-sm">
          Customer Database
        </h1>
        <p className="text-slate-500 mt-1 pl-5">Manage our pharmacy customer details</p>
      </div>
      
      <CustomersClient initialCustomers={customers} />
    </div>
  );
}
