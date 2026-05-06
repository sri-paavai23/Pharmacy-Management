import prisma from "@/lib/db";
import { MastersClient } from "./MastersClient";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function MastersPage() {
  const fyId = cookies().get("activeFinancialYearId")?.value;
  
  const groups = await prisma.accountgroup.findMany({
    orderBy: { name: 'asc' }
  });

  const activeFY = await prisma.financialyear.findFirst({
    where: fyId ? { id: fyId } : { isActive: true }
  });

  const rawLedgers = await prisma.ledger.findMany({
    where: { financialYearId: activeFY?.id },
    include: { accountgroup: true },
    orderBy: { name: 'asc' }
  });

  // Remap accountgroup → Group for client
  const ledgers = rawLedgers.map(l => ({ ...l, Group: l.accountgroup }));

  const financialYears = await prisma.financialyear.findMany({
    where: { isClosed: false }
  });

  return (
    <div className="p-8">
      <MastersClient 
        groups={groups} 
        ledgers={ledgers} 
        financialYears={financialYears}
        activeFYId={activeFY?.id || ""} 
      />
    </div>
  );
}
