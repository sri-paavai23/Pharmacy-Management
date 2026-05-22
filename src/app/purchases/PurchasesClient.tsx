"use client";

import { useState } from "react";
import { product, vendor, purchase, purchaseitem, batch } from "@prisma/client";
import { processPurchaseInvoice, deletePurchaseInvoice } from "@/app/inventory/actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ShoppingBag, Truck, Calendar, Search, Edit3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type PurchaseWithDetails = purchase & {
  Vendor: vendor,
  items: (purchaseitem & { Batch: batch & { Product: product } })[]
};

export function PurchasesClient({ products, vendors, purchases }: {
  products: product[],
  vendors: vendor[],
  purchases: PurchaseWithDetails[]
}) {
  const [activeTab, setActiveTab] = useState<"list" | "new" | "manage">("list");
  const [loading, setLoading] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [vendorSearchText, setVendorSearchText] = useState("");
  const [manageSearchText, setManageSearchText] = useState("");

  const [invoiceMetadata, setInvoiceMetadata] = useState({
    vendorId: "",
    invoiceNumber: "",
    totalAmount: 0,
    roundOff: 0,
    date: new Date().toISOString().split('T')[0]
  });

  const emptyItem = () => ({
    isExistingProduct: "yes",
    productId: "",
    name: "",
    manufacturer: "Generic",
    category: "General",
    form: "TABLET",
    hsnCode: "30049099",
    taxRate: 12,
    isPrescriptionRequired: false,
    scheduleH1: false,
    batchNumber: "",
    expiryDate: "",
    mrp: 0,
    purchasePrice: 0,
    sellingPrice: 0,
    currentStock: 1,
    packSize: 10,
    locationRack: "A1",
    discount: 0
  });

  const handleEdit = (p: PurchaseWithDetails) => {
    setEditingPurchaseId(p.id);
    setInvoiceMetadata({
      vendorId: p.vendorId,
      invoiceNumber: p.invoiceNumber,
      totalAmount: p.totalAmount,
      roundOff: 0,
      date: new Date(p.date).toISOString().split('T')[0]
    });
    setInvoiceItems(p.items.map(item => ({
      isExistingProduct: "yes",
      productId: item.Batch.productId,
      name: item.Batch.Product.name,
      manufacturer: item.Batch.Product.manufacturer,
      category: item.Batch.Product.category,
      form: item.Batch.Product.form || "TABLET",
      hsnCode: item.Batch.Product.hsnCode,
      taxRate: item.Batch.Product.taxRate,
      isPrescriptionRequired: item.Batch.Product.isPrescriptionRequired,
      scheduleH1: item.Batch.Product.scheduleH1,
      batchNumber: item.Batch.batchNumber,
      expiryDate: new Date(item.Batch.expiryDate).toISOString().split('T')[0],
      mrp: item.Batch.mrp,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.Batch.sellingPrice,
      currentStock: item.quantity * Math.max(1, item.Batch.Product.packSize), // Loose tablets input
      packSize: item.Batch.Product.packSize,
      locationRack: item.Batch.locationRack || "",
      discount: 0
    })));
    setVendorSearchText(p.Vendor.companyName);
    setActiveTab("new");
  };

  const [invoiceItems, setInvoiceItems] = useState([emptyItem()]);

  const subTotal = invoiceItems.reduce((acc, item) => {
    const packs = Math.max(1, Math.round((item.currentStock || 0) / Math.max(1, item.packSize || 1)));
    const t = item.purchasePrice * packs;
    const discounted = t * (1 - (item.discount || 0) / 100);
    const withTax = discounted * (1 + (item.taxRate || 0) / 100);
    return acc + withTax;
  }, 0);

  const computedTotal = subTotal + (invoiceMetadata.roundOff || 0);
  const diff = Math.abs(computedTotal - (invoiceMetadata.totalAmount || 0));
  const isValid = invoiceMetadata.vendorId && invoiceMetadata.invoiceNumber && invoiceMetadata.totalAmount > 0 && diff < 0.1;

  const handleSave = async () => {
    if (!isValid) { alert("Ensure vendor is selected and totals match."); return; }
    const match = document.cookie.match(/(^| )activeFinancialYearId=([^;]+)/);
    const fyId = match ? match[2] : null;
    if (!fyId) { alert("No active Financial Year. Please select one in the header."); return; }
    setLoading(true);
    try {
      if (editingPurchaseId) {
        const delRes = await deletePurchaseInvoice(editingPurchaseId);
        if (delRes?.error) throw new Error(delRes.error);
      }
      const res = await processPurchaseInvoice({
        vendorId: invoiceMetadata.vendorId,
        financialYearId: fyId,
        invoiceNumber: invoiceMetadata.invoiceNumber,
        totalAmount: invoiceMetadata.totalAmount,
        roundOff: invoiceMetadata.roundOff,
        invoiceDate: invoiceMetadata.date,
        items: invoiceItems.map(item => ({
          ...item,
          currentStock: Math.max(1, Math.round((item.currentStock || 0) / Math.max(1, item.packSize || 1))),
          productId: item.isExistingProduct === "yes" ? item.productId : undefined
        }))
      });
      if (res?.error) throw new Error(res.error);
      alert(editingPurchaseId ? "Purchase updated successfully!" : "Stock added successfully!");
      setEditingPurchaseId(null);
      setInvoiceMetadata({ vendorId: "", invoiceNumber: "", totalAmount: 0, roundOff: 0, date: new Date().toISOString().split('T')[0] });
      setInvoiceItems([emptyItem()]);
      setActiveTab("list");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error saving purchase");
    } finally {
      setLoading(false);
    }
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this purchase? This will revert stock and accounting entries.")) return;
    setLoading(true);
    try {
      const res = await deletePurchaseInvoice(id);
      if (res?.error) throw new Error(res.error);
      alert("Purchase deleted successfully");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error deleting purchase");
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = purchases.filter(p => 
    p.Vendor.companyName.toLowerCase().includes(manageSearchText.toLowerCase()) || 
    p.invoiceNumber.toLowerCase().includes(manageSearchText.toLowerCase())
  );

  // shared select style
  const sel = "h-8 w-full border border-slate-200 bg-white px-1.5 text-[11px] font-semibold uppercase rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer";
  const inp = "h-8 border-slate-200 bg-white text-[11px] rounded-lg shadow-sm px-2 focus:ring-2 focus:ring-primary/20";

  const handleKeyDown = (e: React.KeyboardEvent, idx: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If we are in the header, move to next header field or first row
      if (idx === -1) {
        const headerInputs = ['vendor-input', 'date-input', 'invoice-input', 'total-input'];
        const currentIdx = headerInputs.indexOf(field);
        if (currentIdx !== -1 && currentIdx < headerInputs.length - 1) {
          document.getElementById(headerInputs[currentIdx + 1])?.focus();
        } else {
          // Move to first row, first focusable element (Type select)
          const firstRow = document.querySelector('tbody tr');
          if (firstRow) {
            (firstRow.querySelector('select, input') as HTMLElement)?.focus();
          }
        }
        return;
      }

      const row = e.currentTarget.closest('tr');
      if (row) {
        const inputs = Array.from(row.querySelectorAll('input, select')) as HTMLElement[];
        const currentIndex = inputs.indexOf(e.currentTarget as HTMLElement);
        if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
          inputs[currentIndex + 1].focus();
        } else if (idx < invoiceItems.length - 1) {
          // Move to first input of next row
          const nextRow = row.nextElementSibling;
          if (nextRow) {
            const nextInputs = Array.from(nextRow.querySelectorAll('input, select')) as HTMLElement[];
            if (nextInputs.length > 0) nextInputs[0].focus();
          }
        }
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex justify-between items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
        <div className="flex space-x-1">
          <button onClick={() => { setActiveTab("list"); setEditingPurchaseId(null); setInvoiceMetadata({ vendorId: "", invoiceNumber: "", totalAmount: 0, roundOff: 0, date: new Date().toISOString().split('T')[0] }); setInvoiceItems([emptyItem()]); }} className={cn("px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", activeTab === "list" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800")}>
            <ShoppingBag className="w-3.5 h-3.5" /> Purchase History
          </button>
          <button onClick={() => { setActiveTab("manage"); setEditingPurchaseId(null); }} className={cn("px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", activeTab === "manage" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800")}>
            <FileText className="w-3.5 h-3.5" /> Manage Invoices
          </button>
          <button onClick={() => { setActiveTab("new"); setEditingPurchaseId(null); setInvoiceMetadata({ vendorId: "", invoiceNumber: "", totalAmount: 0, roundOff: 0, date: new Date().toISOString().split('T')[0] }); setInvoiceItems([emptyItem()]); }} className={cn("px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", activeTab === "new" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-800")}>
            <Plus className="w-3.5 h-3.5" /> {editingPurchaseId ? 'Edit Purchase Invoice' : 'Log New Purchase'}
          </button>
        </div>
      </div>

      {/* ────────── HISTORY LIST ────────── */}
      {activeTab === "list" && (
        <div className="grid gap-4">
          {purchases.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all">
              <div className="px-5 py-3 bg-slate-50 border-b flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-1.5 rounded-lg"><Truck className="w-4 h-4 text-primary" /></div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{p.Vendor.companyName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Invoice: {p.invoiceNumber}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">₹{p.totalAmount.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-end"><Calendar className="w-3 h-3" />{new Date(p.date).toLocaleDateString('en-GB')}</p>
                </div>
              </div>
            </div>
          ))}
          {purchases.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed text-slate-400 text-xs font-bold uppercase tracking-widest">
              No purchases yet. Log your first invoice.
            </div>
          )}
        </div>
      )}

      {/* ────────── MANAGE INVOICES ────────── */}
      {activeTab === "manage" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input 
              className="pl-10 h-12 rounded-xl bg-white border-slate-200 shadow-sm"
              placeholder="Search by Vendor or Invoice Number..." 
              value={manageSearchText}
              onChange={e => setManageSearchText(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="pl-6">Invoice Info</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map(p => (
                  <TableRow key={p.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="pl-6 py-4">
                      <div className="font-bold text-slate-800">{p.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-500">{new Date(p.date).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-700">{p.Vendor.companyName}</div>
                      <div className="text-[10px] text-slate-400 uppercase">{p.Vendor.gstin}</div>
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-900">
                      ₹{p.totalAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(p)} className="h-8 text-primary border-primary/20 hover:bg-primary/5">
                          <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="h-8 text-red-500 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPurchases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-slate-400 italic">
                      No matching invoices found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ────────── NEW PURCHASE FORM ────────── */}
      {activeTab === "new" && (
        <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">

          {/* Header fields — compact 5-col grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Vendor</Label>
              <div className="relative">
                <Input id="vendor-input" list="vendor-list" className={cn(inp, "h-9 font-semibold")} placeholder="Search vendor..."
                  value={vendorSearchText}
                  onKeyDown={e => handleKeyDown(e, -1, 'vendor-input')}
                  onChange={e => { 
                    setVendorSearchText(e.target.value);
                    const v = vendors.find(x => x.companyName === e.target.value); 
                    if (v) setInvoiceMetadata(p => ({ ...p, vendorId: v.id })); 
                  }}
                />
                <datalist id="vendor-list">{vendors.map(v => <option key={v.id} value={v.companyName}>{v.gstin}</option>)}</datalist>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Invoice Date</Label>
              <Input id="date-input" type="date" className={cn(inp, "h-9")} value={invoiceMetadata.date} 
                onKeyDown={e => handleKeyDown(e, -1, 'date-input')}
                onChange={e => setInvoiceMetadata(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Invoice No.</Label>
              <Input id="invoice-input" className={cn(inp, "h-9 font-mono font-bold uppercase")} placeholder="V-XXXXX" value={invoiceMetadata.invoiceNumber} 
                onKeyDown={e => handleKeyDown(e, -1, 'invoice-input')}
                onChange={e => setInvoiceMetadata(p => ({ ...p, invoiceNumber: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bill Total (₹)</Label>
              <Input id="total-input" type="number" className={cn(inp, "h-9 font-bold")} placeholder="0.00" value={invoiceMetadata.totalAmount || ''} 
                onKeyDown={e => handleKeyDown(e, -1, 'total-input')}
                onChange={e => setInvoiceMetadata(p => ({ ...p, totalAmount: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>

          {/* Items table */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                <Plus className="w-3 h-3" /> Item Rows
              </p>
              <Button size="sm" onClick={() => setInvoiceItems([...invoiceItems, emptyItem()])}
                className="h-7 text-[10px] font-black uppercase px-3 rounded-lg bg-primary hover:bg-emerald-500 shadow-sm">
                + Add Row
              </Button>
            </div>

            <div className="border border-slate-100 rounded-xl overflow-x-auto">
              <Table className="min-w-[1600px]">
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-b border-slate-100">
                    {["#","Type","Product / Drug Name","Pack","Sch.","FORM","HSN","Batch#","Expiry","Qty","Rate ₹","MRP ₹","GST%","Disc%","Total",""].map((h, i) => (
                      <TableHead key={i} className={cn("py-2 text-[9px] font-black uppercase tracking-widest text-slate-400", i >= 9 && i <= 14 ? "text-right" : "text-center")}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceItems.map((item, idx) => (
                    <TableRow key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">

                      {/* # */}
                      <TableCell className="text-center text-[10px] font-bold text-slate-400 w-8">{idx + 1}</TableCell>

                      {/* Type */}
                      <TableCell className="w-28">
                        <select value={item.isExistingProduct} 
                          onKeyDown={e => handleKeyDown(e, idx, 'type')}
                          onChange={e => {
                          const v = e.target.value; const next = [...invoiceItems];
                          next[idx].isExistingProduct = v;
                          if (v === 'no') { next[idx].productId = ""; next[idx].name = ""; }
                          setInvoiceItems(next);
                        }} className={sel}>
                          <option value="yes">Existing</option>
                          <option value="no">New Drug</option>
                        </select>
                      </TableCell>

                      {/* Product */}
                      <TableCell className="min-w-[250px]">
                        <datalist id={`pl-${idx}`}>{products.map(p => <option key={p.id} value={p.name}>{p.manufacturer}</option>)}</datalist>
                        {item.isExistingProduct === 'yes' ? (
                          <Input list={`pl-${idx}`} placeholder="Search…" className={cn(inp, "font-semibold")}
                            value={item.name}
                            onKeyDown={e => handleKeyDown(e, idx, 'name')}
                            onChange={e => {
                              const prod = products.find(p => p.name === e.target.value);
                              const next = [...invoiceItems]; next[idx].name = e.target.value;
                              if (prod) { 
                                next[idx].productId = prod.id; 
                                next[idx].manufacturer = prod.manufacturer; 
                                next[idx].taxRate = prod.taxRate; 
                                next[idx].packSize = prod.packSize;
                                next[idx].form = prod.form || "TABLET";
                                next[idx].hsnCode = prod.hsnCode;
                              }
                              setInvoiceItems(next);
                            }} />
                        ) : (
                          <Input placeholder="New drug name…" className={cn(inp, "font-semibold text-emerald-700 border-emerald-200 bg-emerald-50/40")}
                            value={item.name} 
                            onKeyDown={e => handleKeyDown(e, idx, 'name')}
                            onChange={e => { const next = [...invoiceItems]; next[idx].name = e.target.value; setInvoiceItems(next); }} />
                        )}
                      </TableCell>

                      {/* Pack */}
                      <TableCell className="w-20">
                        <Input type="number" className={cn(inp, "text-center font-bold")}
                          onKeyDown={e => handleKeyDown(e, idx, 'pack')}
                          value={item.packSize || ''} onChange={e => { const next = [...invoiceItems]; next[idx].packSize = parseInt(e.target.value) || 1; setInvoiceItems(next); }} />
                      </TableCell>

                      {/* Schedule */}
                      <TableCell className="w-24">
                        <select value={item.scheduleH1 ? 'H1' : (item.isPrescriptionRequired ? 'H' : (item.category === 'NRX' ? 'NRX' : 'NONE'))}
                          onKeyDown={e => handleKeyDown(e, idx, 'sch')}
                          onChange={e => {
                            const v = e.target.value; const next = [...invoiceItems];
                            next[idx].scheduleH1 = v === 'H1';
                            next[idx].isPrescriptionRequired = v === 'H' || v === 'H1' || v === 'NRX';
                            next[idx].category = v; setInvoiceItems(next);
                          }} className={sel}>
                          <option value="NONE">Normal</option>
                          <option value="H">Sch-H</option>
                          <option value="H1">Sch-H1</option>
                          <option value="NRX">NRX</option>
                          <option value="OTC">OTC</option>
                        </select>
                      </TableCell>

                      {/* FORM */}
                      <TableCell className="w-28">
                        <Input list="form-list" value={item.form} 
                          className={cn(inp, "text-center font-bold uppercase")}
                          onKeyDown={e => handleKeyDown(e, idx, 'form')}
                          onChange={e => { const next = [...invoiceItems]; next[idx].form = e.target.value.toUpperCase(); setInvoiceItems(next); }} />
                        <datalist id="form-list">
                          <option value="TABLET">Tablet</option>
                          <option value="SYRUP">Syrup</option>
                          <option value="INJECTION">Injection</option>
                          <option value="CAPSULE">Capsule</option>
                          <option value="CREAM">Cream</option>
                          <option value="GEL">Gel</option>
                          <option value="OINTMENT">Ointment</option>
                          <option value="DROPS">Drops</option>
                          <option value="INHALER">Inhaler</option>
                          <option value="PATCH">Patch</option>
                          <option value="SPRAY">Spray</option>
                          <option value="POWDER">Powder</option>
                          <option value="COSMETICS">Cosmetics</option>
                        </datalist>
                      </TableCell>

                      {/* HSN */}
                      <TableCell className="w-28">
                        <Input placeholder="HSN" className={cn(inp, "text-center font-mono")}
                          onKeyDown={e => handleKeyDown(e, idx, 'hsn')}
                          value={item.hsnCode} onChange={e => { const next = [...invoiceItems]; next[idx].hsnCode = e.target.value; setInvoiceItems(next); }} />
                      </TableCell>

                      {/* Batch# */}
                      <TableCell className="w-28">
                        <Input placeholder="Batch" className={cn(inp, "font-mono text-center")}
                          onKeyDown={e => handleKeyDown(e, idx, 'batch')}
                          value={item.batchNumber} onChange={e => { const next = [...invoiceItems]; next[idx].batchNumber = e.target.value; setInvoiceItems(next); }} />
                      </TableCell>

                      {/* Expiry */}
                      <TableCell className="w-32">
                        <Input type="date" className={inp}
                          onKeyDown={e => handleKeyDown(e, idx, 'expiry')}
                          value={item.expiryDate} onChange={e => { const next = [...invoiceItems]; next[idx].expiryDate = e.target.value; setInvoiceItems(next); }} />
                      </TableCell>

                      {/* Qty */}
                      <TableCell className="w-20">
                        <Input type="number" className={cn(inp, "text-center font-black text-primary")}
                          onKeyDown={e => handleKeyDown(e, idx, 'qty')}
                          value={item.currentStock || ''} onChange={e => { const next = [...invoiceItems]; next[idx].currentStock = parseInt(e.target.value) || 0; setInvoiceItems(next); }} />
                      </TableCell>

                      {/* Rate */}
                      <TableCell className="w-24">
                        <Input type="number" step="0.01" className={cn(inp, "text-right font-semibold")}
                          onKeyDown={e => handleKeyDown(e, idx, 'rate')}
                          value={item.purchasePrice || ''} onChange={e => { const next = [...invoiceItems]; next[idx].purchasePrice = parseFloat(e.target.value) || 0; setInvoiceItems(next); }} />
                      </TableCell>


                      {/* MRP */}
                      <TableCell className="w-24">
                        <Input type="number" step="0.01" className={cn(inp, "text-right font-semibold text-slate-500")}
                          onKeyDown={e => handleKeyDown(e, idx, 'mrp')}
                          value={item.mrp || ''} onChange={e => { const next = [...invoiceItems]; next[idx].mrp = parseFloat(e.target.value) || 0; setInvoiceItems(next); }} />
                      </TableCell>

                      {/* GST% */}
                      <TableCell className="w-20">
                        <Input type="number" className={cn(inp, "text-right font-semibold text-teal-600")}
                          onKeyDown={e => handleKeyDown(e, idx, 'gst')}
                          value={item.taxRate ?? 12} onChange={e => { const next = [...invoiceItems]; next[idx].taxRate = parseFloat(e.target.value) || 0; setInvoiceItems(next); }} />
                      </TableCell>

                      {/* Disc% */}
                      <TableCell className="w-20">
                        <Input type="number" placeholder="0" className={cn(inp, "text-right font-semibold text-blue-600")}
                          onKeyDown={e => handleKeyDown(e, idx, 'disc')}
                          value={item.discount || ''} onChange={e => { const next = [...invoiceItems]; next[idx].discount = parseFloat(e.target.value) || 0; setInvoiceItems(next); }} />
                      </TableCell>

                      {/* Total */}
                      <TableCell className="text-right font-black text-slate-800 text-xs w-24">
                        ₹{(((item.purchasePrice * Math.max(1, Math.round((item.currentStock || 0) / Math.max(1, item.packSize || 1)))) * (1 - (item.discount || 0) / 100)) * (1 + (item.taxRate || 0) / 100)).toFixed(2)}
                      </TableCell>

                      {/* Delete */}
                      <TableCell className="w-8">
                        <button onClick={() => setInvoiceItems(invoiceItems.filter((_, i) => i !== idx))} disabled={invoiceItems.length === 1}
                          className="text-slate-200 hover:text-red-500 transition-colors disabled:opacity-30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Footer: summary + commit */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-1 border-t border-slate-100">
            {/* Summary chips */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Items</p>
                <p className="text-lg font-black text-slate-800">{invoiceItems.length}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Calc. Total</p>
                <p className="text-lg font-black text-slate-800">₹{computedTotal.toFixed(2)}</p>
              </div>
              <div className={cn("border rounded-xl px-4 py-2", diff < 0.1 ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100")}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Diff</p>
                <p className={cn("text-lg font-black", diff < 0.1 ? "text-emerald-600" : "text-amber-600")}>
                  {diff < 0.1 ? "✓ Matched" : `₹${diff.toFixed(2)}`}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Round Off</p>
                <Input type="number" step="0.01" placeholder="0.00"
                  className="h-7 w-20 border-0 bg-transparent p-0 text-sm font-black text-amber-600 focus:ring-0"
                  value={invoiceMetadata.roundOff || ''}
                  onChange={e => setInvoiceMetadata(p => ({ ...p, roundOff: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>

            {/* Commit button */}
            <Button onClick={handleSave} disabled={loading || !isValid}
              className="h-11 px-8 rounded-xl font-black uppercase text-sm tracking-wider bg-primary hover:bg-emerald-500 shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-40">
              <Truck className="w-4 h-4" />
              {loading ? "Saving…" : (editingPurchaseId ? "Update Stock Inward" : "Commit Stock Inward")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
