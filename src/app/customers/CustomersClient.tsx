"use client";

import { useState } from "react";
import { customer, subscription } from "@prisma/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

import { Search, UserPlus, Phone } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type CustomerWithRelations = customer & { 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sales: any[], 
  subscriptions: subscription[] 
};

export function CustomersClient({ initialCustomers }: { initialCustomers: CustomerWithRelations[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithRelations | null>(null);

  const filtered = initialCustomers.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term));
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 animate-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex justify-between items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input 
            placeholder="Search by name or phone..." 
            className="pl-9 bg-slate-50 border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Customer Name</TableHead>
              <TableHead>Contact Number</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Total Purchases</TableHead>
              <TableHead className="text-right">Total Spend</TableHead>
              <TableHead className="text-right">Subscribed?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => {
              const totalSpend = c.sales.reduce((acc, sale) => acc + sale.totalAmount, 0);
              
              return (
                <TableRow 
                  key={c.id} 
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => setSelectedCustomer(c)}
                >
                  <TableCell className="font-semibold text-slate-800">{c.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center text-slate-600 gap-2">
                      <Phone className="w-3 h-3" />
                      {c.phone || "N/A"}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {c.isSeniorCitizen && (
                       <Badge variant="secondary" className="bg-blue-50 text-blue-600 border border-blue-200 font-normal">
                         Senior Citizen
                       </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{c.sales.length} orders</TableCell>
                  <TableCell className="text-right font-bold text-slate-700">₹{totalSpend.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {c.subscriptions.length > 0 ? (
                      <span className="text-emerald-600 font-medium">Yes</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <UserPlus className="w-8 h-8 text-slate-300" />
                    <p>No customers found.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-slate-500 mt-4 text-center">New customers are automatically added directly through the POS billing terminal.</p>

      {/* Purchase History Modal */}
      <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Purchase History: {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {selectedCustomer?.sales && selectedCustomer.sales.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedCustomer.sales.flatMap((sale) => 
                    (sale as { saleitem: { id: string; quantity: number; unitPrice: number; batch: { product: { name: string } } }[] }).saleitem.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-slate-800">{item.batch.product.name} <span className="text-xs text-slate-500">(x{item.quantity})</span></TableCell>
                        <TableCell className="text-slate-600">{new Date(sale.createdAt).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell className="text-right font-bold text-slate-700">₹{(item.unitPrice * item.quantity).toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-slate-500 py-8">No purchase history found for this customer.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
