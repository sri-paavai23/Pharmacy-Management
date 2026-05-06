"use client";

import { useState, useEffect } from "react";
import { sale, customer, saleitem, batch, product, doctor } from "@prisma/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Calendar, FileText, ShoppingCart, User, Stethoscope, Edit, Trash2, Check, X } from "lucide-react";
import { updateSale } from "./actions";

type SaleDetailed = sale & {
  Customer: customer | null,
  Doctor: doctor | null,
  items: (saleitem & { Batch: batch & { Product: product } })[]
};

type ProductWithBatches = product & { batches: batch[] };

export function HistoryClient({ allSales, products }: { allSales: SaleDetailed[], products: ProductWithBatches[] }) {
  const [dateFilter, setDateFilter] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [selectedSale, setSelectedSale] = useState<SaleDetailed | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<{ batchId: string; quantity: number; unitPrice: number; unitPurchasePrice: number; Product?: product; Batch: batch & { Product?: product }; id: string }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [editTotal, setEditTotal] = useState(0);

  // Watch for selectedSale changes
  useEffect(() => {
    setIsEditing(false);
    if (selectedSale) {
      setEditItems(selectedSale.items.map(i => ({
        id: i.id,
        batchId: i.batchId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        unitPurchasePrice: i.unitPurchasePrice,
        Product: i.Batch.Product,
        Batch: i.Batch
      })));
      setEditTotal(selectedSale.totalAmount);
    }
  }, [selectedSale]);

  const filteredSales = allSales.filter(s => {
    if (dateFilter) {
      const saleDate = new Date(s.createdAt).toISOString().split('T')[0];
      if (saleDate !== dateFilter) return false;
    }
    if (searchInvoice) {
      if (!s.invoiceNumber.toLowerCase().includes(searchInvoice.toLowerCase())) return false;
    }
    return true;
  });

  const filteredProducts = products ? products.filter(p => {
    if (!productSearch) return false;
    const term = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.batches.some(b => b.batchNumber.toLowerCase().includes(term));
  }).slice(0, 5) : [];

  const handleUpdateQuantity = (id: string, qty: string) => {
    setEditItems(prev => prev.map(item => {
      if (item.id === id) {
        if (qty === '') return { ...item, quantity: '' as unknown as number };
        const parsed = parseInt(qty);
        if (isNaN(parsed)) return item;
        const availableStock = item.Batch.currentStock + (selectedSale?.items.find(i => i.id === id)?.quantity || 0);
        return { ...item, quantity: Math.min(parsed, availableStock) };
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setEditItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddProduct = (p: product, b: batch) => {
    setEditItems(prev => {
      const existing = prev.find(item => item.batchId === b.id);
      if (existing) {
        return prev.map(item => item.batchId === b.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        id: Math.random().toString(),
        batchId: b.id,
        quantity: 1,
        unitPrice: b.mrp,
        unitPurchasePrice: b.purchasePrice,
        Product: p,
        Batch: b
      }];
    });
    setProductSearch("");
  };

  const handleSave = async () => {
    if (!selectedSale) return;
    if (editItems.length === 0) {
      alert("Cannot save an empty invoice. Void it instead.");
      return;
    }

    setSaving(true);
    try {
      const validItems = editItems.filter(i => typeof i.quantity === 'number' && i.quantity > 0);
      // Calculate base subtotal and tax
      const autoSubtotal = validItems.reduce((acc, item) => acc + (item.unitPrice * (item.quantity as number)), 0);
      const totalTax = validItems.reduce((acc, item) => {
        const itemTotal = item.unitPrice * (item.quantity as number);
        const taxRate = item.Product?.taxRate || item.Batch?.Product?.taxRate || 0;
        return acc + (itemTotal - (itemTotal / (1 + (taxRate / 100))));
      }, 0);

      // Manual grand total from state, or auto if not touched
      const finalGrandTotal = editTotal === 0 ? autoSubtotal : editTotal;
      const roundOff = finalGrandTotal - autoSubtotal;

      await updateSale({
        saleId: selectedSale.id,
        items: validItems.map(i => ({
          batchId: i.batchId,
          quantity: i.quantity as number,
          unitPrice: i.unitPrice,
          unitPurchasePrice: i.unitPurchasePrice
        })),
        totalAmount: autoSubtotal, // This will be stored as base, and updateSale logic (hopefully) handles the rest
        totalTax,
        roundOff
      });
      setIsEditing(false);
      // Wait for server to refresh data
      window.location.reload();
    } catch (e: unknown) {
      alert("Error updating sale: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const currentTotal = isEditing
    ? editItems.reduce((acc, item) => acc + (item.unitPrice * (typeof item.quantity === 'number' ? item.quantity : 0)), 0)
    : selectedSale?.totalAmount || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left panel: List of Sales */}
      <div className="lg:col-span-1 bg-white rounded-2xl border shadow-sm flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
        <div className="p-4 border-b space-y-3 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search Invoice #..."
              value={searchInvoice}
              onChange={e => setSearchInvoice(e.target.value)}
              className="pl-9 h-10 border-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <Input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="h-10 border-slate-200"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter("")} className="text-xs text-slate-500 hover:text-red-500 font-bold px-2">Clear</button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filteredSales.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSale(s)}
              className={`w-full text-left p-4 rounded-xl transition-all border ${selectedSale?.id === s.id ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold font-mono tracking-tight">{s.invoiceNumber}</span>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs font-black px-2 py-0.5 rounded ${selectedSale?.id === s.id ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
                    ₹{s.totalAmount.toFixed(2)}
                  </span>
                  {s.source && (
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${s.source === 'COUNTER' ? 'bg-amber-100 text-amber-700' :
                      s.source === 'SENIOR_CARE' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                      {s.source}
                    </span>
                  )}
                </div>
              </div>
              <div className={`text-xs flex items-center justify-between ${selectedSale?.id === s.id ? 'text-slate-300' : 'text-slate-400'}`}>
                <span className="truncate flex items-center gap-1"><User className="w-3 h-3" /> {s.Customer?.name || 'Walk-in'}</span>
                <span>{new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </button>
          ))}
          {filteredSales.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm font-bold">
              No sales found.
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Details */}
      <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm overflow-hidden h-[calc(100vh-12rem)] flex flex-col">
        {selectedSale ? (
          <>
            <div className="bg-slate-50 p-6 border-b flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">{selectedSale.invoiceNumber}</h2>
                  {selectedSale.source && (
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${selectedSale.source === 'COUNTER' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                      selectedSale.source === 'SENIOR_CARE' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                        'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                      {selectedSale.source} BILL
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500 mt-1 font-medium">{new Date(selectedSale.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Grand Total</div>
                  <div className="text-3xl font-black text-emerald-600">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span>₹</span>
                        <Input
                          type="number"
                          value={editTotal === 0 ? "" : editTotal}
                          onChange={(e) => setEditTotal(parseFloat(e.target.value) || 0)}
                          className="text-2xl font-black w-32 h-10 border-emerald-200 bg-emerald-50 focus:ring-emerald-500"
                        />
                      </div>
                    ) : (
                      `₹${currentTotal.toFixed(2)}`
                    )}
                  </div>
                </div>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/5 font-bold h-9 px-4 flex items-center gap-2 shadow-sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit className="w-4 h-4" /> Edit Invoice
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => { setIsEditing(false); setEditItems(selectedSale.items.map(i => ({ ...i, Product: i.Batch.Product, Batch: i.Batch })) as unknown as typeof editItems); }} disabled={saving}>
                      <X className="w-4 h-4 mr-2" /> Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white">
                      <Check className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-b flex gap-6 bg-white">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</p>
                <p className="font-bold flex items-center gap-1.5 mt-1"><User className="w-4 h-4 text-slate-400" /> {selectedSale.Customer?.name || 'Walk-in Customer'}</p>
              </div>
              {selectedSale.Doctor && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Doctor</p>
                  <p className="font-bold flex items-center gap-1.5 mt-1"><Stethoscope className="w-4 h-4 text-slate-400" /> {selectedSale.Doctor.name}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items</p>
                <p className="font-bold flex items-center gap-1.5 mt-1"><ShoppingCart className="w-4 h-4 text-slate-400" /> {isEditing ? editItems.length : selectedSale.items.length}</p>
              </div>
            </div>

            {isEditing && (
              <div className="p-4 border-b bg-slate-50 relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search product to add..."
                    className="pl-9"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                </div>
                {productSearch && (
                  <div className="absolute top-full left-4 right-4 mt-1 bg-white rounded-lg shadow-xl border z-50 max-h-64 overflow-y-auto">
                    {filteredProducts.map(p => (
                      p.batches.map(b => (
                        <div key={b.id} className="p-3 border-b hover:bg-slate-50 cursor-pointer flex justify-between items-center" onClick={() => handleAddProduct(p, b)}>
                          <div>
                            <div className="font-bold">{p.name}</div>
                            <div className="text-xs text-slate-500">Batch #{b.batchNumber} | Stock: {b.currentStock}</div>
                          </div>
                          <div className="font-bold text-emerald-600">₹{b.mrp.toFixed(2)}</div>
                        </div>
                      ))
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="p-4 text-center text-slate-500 text-sm">No products found.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product / Drug</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {isEditing && <TableHead className="w-12"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(isEditing ? editItems : selectedSale.items).map(item => {
                    const pName = ('Product' in item && item.Product) ? item.Product.name : item.Batch?.Product?.name;
                    return (
                    <TableRow key={item.id}>
                      <TableCell className="font-bold text-slate-700">{pName}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{item.Batch?.batchNumber}</TableCell>
                      <TableCell className="text-center font-bold">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => handleUpdateQuantity(item.id, e.target.value)}
                            className="w-20 mx-auto text-center h-8"
                          />
                        ) : (
                          `x${item.quantity}`
                        )}
                      </TableCell>
                      <TableCell className="text-right text-slate-600">₹{item.unitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-black text-slate-800">₹{(item.unitPrice * (typeof item.quantity === 'number' ? item.quantity : 0)).toFixed(2)}</TableCell>
                      {isEditing && (
                        <TableCell>
                          <Button variant="ghost" size="icon" className="text-red-500 h-8 w-8 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveItem(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-slate-400 text-center">
            <div className="bg-slate-50 p-6 rounded-full mb-4 shadow-inner">
              <FileText className="w-16 h-16 text-slate-300" />
            </div>
            <p className="text-xl font-bold text-slate-500">Select an Invoice</p>
            <p className="text-sm mt-2 max-w-sm">Choose an invoice from the list on the left to view detailed billing items, doctor references, and exact totals.</p>
          </div>
        )}
      </div>
    </div>
  );
}
