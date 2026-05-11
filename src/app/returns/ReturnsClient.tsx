"use client";

import { useState } from "react";
import { salesreturn, sale, customer, saleitem, batch, product } from "@prisma/client";
import { processSalesReturn } from "./actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { RotateCcw, Search, Trash2, Calendar, FileText, User, ShoppingCart, Info, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

type SalesReturnWithDetails = salesreturn & {
  Sale: sale & {
    Customer: customer | null,
    items: (saleitem & { Batch: batch & { Product: product } })[]
  }
};

type SaleDetailed = sale & {
  Customer: customer | null,
  items: (saleitem & { Batch: batch & { Product: product } })[]
};

export function ReturnsClient({ salesReturns, allSales }: { 
  salesReturns: SalesReturnWithDetails[], 
  allSales: SaleDetailed[] 
}) {
  const [activeTab, setActiveTab] = useState<"list" | "new">("list");
  const [loading, setLoading] = useState(false);
  const [searchInvoice, setSearchInvoice] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleDetailed | null>(null);
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState(0);

  // Compute how much has already been refunded for the selected sale
  const alreadyRefunded = selectedSale
    ? salesReturns
        .filter(r => r.Sale.id === selectedSale.id)
        .reduce((sum, r) => sum + r.refundAmount, 0)
    : 0;
  const maxRefund = selectedSale ? Math.max(0, selectedSale.totalAmount - alreadyRefunded) : 0;

  const handleSearch = () => {
    const found = allSales.find(s => s.invoiceNumber.toLowerCase() === searchInvoice.toLowerCase());
    if (found) {
      setSelectedSale(found);
      // Compute already-refunded for this sale and set default to remaining balance
      const refunded = salesReturns
        .filter(r => r.Sale.id === found.id)
        .reduce((sum, r) => sum + r.refundAmount, 0);
      const remaining = Math.max(0, found.totalAmount - refunded);
      if (remaining <= 0) {
        alert(`Invoice ${found.invoiceNumber} has already been fully refunded.`);
        return;
      }
      setRefundAmount(remaining);
    } else {
      alert("Invoice not found!");
    }
  };

  const handleProcessReturn = async () => {
    if (!selectedSale || !reason) {
      alert("Please select a sale and provide a reason");
      return;
    }
    if (refundAmount <= 0) {
      alert("Refund amount must be greater than zero.");
      return;
    }
    if (refundAmount > maxRefund + 0.01) {
      alert(`Refund amount cannot exceed the remaining balance of ₹${maxRefund.toFixed(2)}.`);
      return;
    }
    setLoading(true);
    try {
      await processSalesReturn(selectedSale.id, refundAmount, reason);
      alert("Return processed successfully. Items added back to stock!");
      setActiveTab("list");
      setSelectedSale(null);
      setReason("");
      setSearchInvoice("");
    } catch {
      alert("Error processing return");

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit border shadow-sm">
        <button onClick={() => setActiveTab("list")} className={cn("px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2", activeTab === "list" ? "bg-white text-orange-600 shadow-md" : "text-slate-500 hover:text-slate-900")}>
          <RotateCcw className="w-4 h-4"/> Return History
        </button>
        <button onClick={() => setActiveTab("new")} className={cn("px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2", activeTab === "new" ? "bg-white text-orange-600 shadow-md" : "text-slate-500 hover:text-slate-900")}>
          <Plus className="w-4 h-4"/> New Refund Request
        </button>
      </div>

      {activeTab === "list" && (
        <div className="grid gap-6">
           {salesReturns.map(r => (
             <div key={r.id} className="bg-white rounded-3xl border shadow-sm p-6 space-y-4 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start">
                   <div className="flex items-center gap-4">
                      <div className="bg-orange-100 p-3 rounded-2xl text-orange-600">
                         <RotateCcw className="w-6 h-6" />
                      </div>
                      <div>
                         <h3 className="font-extrabold text-slate-800 text-lg">INV: {r.Sale.invoiceNumber}</h3>
                         <div className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                           <Calendar className="w-3 h-3" /> {new Date(r.date).toLocaleDateString()}
                         </div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-xs text-slate-400 font-bold uppercase mb-1">Refund Issued</div>
                      <div className="text-xl font-black text-orange-600">₹{r.refundAmount.toFixed(2)}</div>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-50">
                   <div className="space-y-3">
                      <div className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Returned Items</div>
                      <div className="space-y-2">
                        {r.Sale.items.map(item => (
                          <div key={item.id} className="bg-slate-50/50 p-2 rounded-lg border flex justify-between text-sm">
                             <div className="font-medium">{item.Batch.Product.name}</div>
                             <div className="font-bold text-slate-700">x{item.quantity}</div>
                          </div>
                        ))}
                      </div>
                   </div>
                   <div className="space-y-3">
                      <div className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Reason for Return</div>
                      <div className="bg-white p-4 rounded-2xl border flex items-start gap-3">
                         <Info className="w-4 h-4 text-slate-400 mt-1" />
                         <p className="text-sm text-slate-600 font-medium italic">&quot;{r.reason}&quot;</p>

                      </div>
                      <div className="text-xs text-slate-400 font-bold flex items-center gap-1 mt-2">
                         <User className="w-3 h-3" /> {r.Sale.Customer?.name || 'Walk-in Customer'}
                      </div>
                   </div>
                </div>
             </div>
           ))}
           {salesReturns.length === 0 && (
             <div className="text-center py-24 bg-white rounded-3xl border border-dashed text-slate-400">
                No processed returns in history.
             </div>
           )}
        </div>
      )}

      {activeTab === "new" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
           
           <div className="space-y-6">
              <div className="bg-white rounded-3xl border shadow-xl p-8 space-y-6">
                <h3 className="text-2xl font-black text-slate-800">Lookup Invoice</h3>
                <div className="flex gap-4">
                   <Input 
                    placeholder="INV-XXXXXX"
                    value={searchInvoice}
                    onChange={e => setSearchInvoice(e.target.value)}
                    className="h-14 font-mono text-xl tracking-wider rounded-2xl border-slate-300 shadow-inner"
                   />
                   <Button onClick={handleSearch} className="h-14 w-20 rounded-2xl bg-slate-900 shadow-xl self-center"><Search className="w-6 h-6"/></Button>
                </div>
                {selectedSale && (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 animate-in slide-in-from-top-4 space-y-4">
                     <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase">Selected Sale Details</span>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedSale(null)} className="text-red-500 hover:bg-red-50 h-7"><Trash2 className="w-4 h-4"/></Button>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <Label className="text-[10px] text-slate-400 font-bold">INVOICE</Label>
                           <p className="font-mono font-bold text-slate-700">{selectedSale.invoiceNumber}</p>
                        </div>
                        <div>
                           <Label className="text-[10px] text-slate-400 font-bold">DATE</Label>
                           <p className="font-bold text-slate-700">{new Date(selectedSale.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                           <Label className="text-[10px] text-slate-400 font-bold">CUSTOMER</Label>
                           <p className="font-bold text-slate-700">{selectedSale.Customer?.name || 'Walk-in'}</p>
                        </div>
                        <div>
                           <Label className="text-[10px] text-slate-400 font-bold">BILL VALUE</Label>
                           <p className="font-bold text-emerald-600 text-lg">₹{selectedSale.totalAmount.toFixed(2)}</p>
                        </div>
                     </div>
                  </div>
                )}
              </div>

              {selectedSale && (
                <div className="bg-white rounded-3xl border shadow-xl p-8 space-y-6 animate-in fade-in">
                   <h3 className="text-2xl font-black text-slate-800">Return Details</h3>
                   <div className="space-y-4">
                      <div className="space-y-2">
                         <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Refund Amount (₹)</Label>
                         <Input 
                            type="number"
                            value={refundAmount}
                            min={0.01}
                            max={maxRefund}
                            onChange={e => setRefundAmount(Math.min(maxRefund, Math.max(0, parseFloat(e.target.value) || 0)))}
                            className="h-14 text-3xl font-black text-orange-600 rounded-2xl border-orange-100 bg-orange-50/20"
                         />
                         <div className="flex justify-between text-[10px] font-bold pl-1">
                           <span className="text-slate-400">ORIGINAL: ₹{selectedSale.totalAmount.toFixed(2)}</span>
                           {alreadyRefunded > 0 && <span className="text-amber-500">PREV REFUND: -₹{alreadyRefunded.toFixed(2)}</span>}
                           <span className={refundAmount > maxRefund ? "text-red-500" : "text-emerald-600"}>MAX: ₹{maxRefund.toFixed(2)}</span>
                         </div>
                      </div>
                      <div className="space-y-2">
                         <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Reason for Return</Label>
                         <Input 
                            placeholder="e.g. Expired on shelf, Customer preference..."
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="h-14 rounded-2xl border-slate-300"
                         />
                      </div>
                   </div>
                   <Button 
                    onClick={handleProcessReturn} 
                    disabled={loading || !reason} 
                    className="w-full h-16 bg-orange-600 hover:bg-orange-700 text-white text-xl font-black rounded-3xl shadow-xl hover:shadow-2xl transition-all"
                   >
                     {loading ? "Processing Return..." : "Commit Return & Adjust Stock"}
                   </Button>
                </div>
              )}
           </div>

           <div>
              {selectedSale ? (
                <div className="bg-white rounded-3xl border shadow-xl overflow-hidden animate-in zoom-in-95">
                   <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
                     <h3 className="font-extrabold flex items-center gap-2 tracking-tight"><ShoppingCart className="w-5 h-5 text-orange-400"/> Original Bill Items</h3>
                     <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">{selectedSale.items.length} Items</span>
                   </div>
                   <div className="p-4">
                      <Table>
                        <TableHeader>
                           <TableRow className="border-slate-100 h-10">
                              <TableHead className="font-bold text-slate-500 text-xs">Product Details</TableHead>
                              <TableHead className="font-bold text-slate-500 text-xs text-center">Qty</TableHead>
                              <TableHead className="font-bold text-slate-500 text-xs text-right pr-6">Price</TableHead>
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {selectedSale.items.map(item => (
                             <TableRow key={item.id} className="h-16 hover:bg-slate-50 border-slate-50">
                                <TableCell>
                                   <div className="font-extrabold text-slate-800">{item.Batch.Product.name}</div>
                                   <div className="text-[10px] text-slate-400 font-bold">Batch: {item.Batch.batchNumber}</div>
                                </TableCell>
                                <TableCell className="text-center">
                                   <span className="bg-slate-100 px-2 py-1 rounded font-black text-slate-600">x{item.quantity}</span>
                                </TableCell>
                                <TableCell className="text-right pr-6 font-bold text-slate-500">
                                   ₹{(item.unitPrice * item.quantity).toFixed(2)}
                                </TableCell>
                             </TableRow>
                           ))}
                        </TableBody>
                      </Table>
                   </div>
                   <div className="p-6 bg-slate-50 border-t flex justify-between items-center">
                      <span className="text-slate-400 text-xs font-bold uppercase">Original Grand Total</span>
                      <span className="text-2xl font-black text-slate-900">₹{selectedSale.totalAmount.toFixed(2)}</span>
                   </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                   <div className="bg-white p-6 rounded-full shadow-lg text-slate-200 mb-6 group-hover:scale-110 transition-all">
                      <FileText className="w-20 h-20" />
                   </div>
                   <p className="text-slate-400 font-bold text-lg">Search for an invoice to view items</p>
                   <p className="text-slate-300 text-sm">Returns will automatically credit items back to their batches.</p>
                </div>
              )}
           </div>

        </div>
      )}
    </div>
  );
}



