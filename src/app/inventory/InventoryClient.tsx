"use client";

import { useState } from "react";
import { product, batch } from "@prisma/client";
import { adjustStock } from "./actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, PenLine, AlertTriangle, CheckCircle2 } from "lucide-react";

type ProductWithBatches = product & { batches: batch[] };

export function InventoryClient({ products }: { products: ProductWithBatches[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<batch | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<product | null>(null);
  
  const [quantity, setQuantity] = useState("1");
  const [type, setType] = useState<"Addition" | "Reduction">("Reduction");
  const [reason, setReason] = useState("Damage");
  const [loading, setLoading] = useState(false);

  const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));


  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    const qtyParsed = parseInt(quantity);
    if (!quantity || isNaN(qtyParsed) || qtyParsed <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }
    setLoading(true);
    try {
      await adjustStock(selectedBatch.id, parseInt(quantity), type, reason);
      setOpenModal(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to adjust stock");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (stock: number, expiry: Date) => {

    const now = new Date();
    const expiryDate = new Date(expiry);
    const monthsToExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsToExpiry < 0) {
      return <Badge variant="destructive" className="flex gap-1 items-center bg-red-500 hover:bg-red-600"><AlertTriangle className="w-3 h-3"/> Expired</Badge>;
    }
    if (stock <= 0) {
      return <Badge variant="destructive" className="flex gap-1 items-center bg-red-500 hover:bg-red-600"><AlertTriangle className="w-3 h-3"/> Out of Stock</Badge>;
    }
    if (stock < 20) {
      return <Badge variant="outline" className="flex gap-1 items-center border-amber-500 text-amber-600"><AlertTriangle className="w-3 h-3"/> Low Stock</Badge>;
    }
    return <Badge variant="default" className="flex gap-1 items-center bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="w-3 h-3"/> Good</Badge>;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 animate-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input 
            placeholder="Search products..." 
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
              <TableHead>Product Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Batch Info</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(product => (
              <TableRow key={product.id} className="bg-slate-50/50 hover:bg-slate-50/80 group">
                <TableCell className="font-semibold" colSpan={6}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                       {product.name} 
                       {product.scheduleH1 && <Badge variant="outline" className="text-[10px] uppercase font-bold text-red-500 border-red-200 bg-red-50 px-1">H1</Badge>}
                       <span className="text-slate-400 text-sm font-normal ml-2">{product.category}</span>
                       <Badge variant="secondary" className="ml-4 bg-primary/5 text-primary border border-primary/10 font-black text-sm px-3 py-1 uppercase tracking-tight">Pack: {product.packSize}</Badge>


                    </div>
                  </div>
                  <div className="mt-2 pl-4 border-l-2 border-primary/20 space-y-2">
                    {product.batches.map(batch => (
                      <div key={batch.id} className="flex justify-between items-center bg-white p-2 rounded-md border shadow-sm">
                        <div className="text-sm">
                          <span className="font-medium mr-4">#{batch.batchNumber}</span>
                          <span className="text-xs text-slate-500">Exp: {new Date(batch.expiryDate).toLocaleDateString()} • MRP: ₹{batch.mrp}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="font-medium text-right w-12">{batch.currentStock}</div>
                          <div className="w-28 flex justify-center">{getStatusBadge(batch.currentStock, batch.expiryDate)}</div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary hover:text-primary hover:bg-primary/10 h-8"
                            onClick={() => {
                              setSelectedProduct(product);
                              setSelectedBatch(batch);
                              setOpenModal(true);
                            }}
                          >
                            <PenLine className="w-4 h-4 mr-1" /> Adjust
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  No products found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>


      {/* Adjust Modal */}

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdjust} className="space-y-4">
            {selectedProduct && selectedBatch && (
              <div className="p-3 bg-slate-50 rounded-md border text-sm mb-4">
                <strong>{selectedProduct.name}</strong> • Batch #{selectedBatch.batchNumber}
                <br/>
                Current Stock: {selectedBatch.currentStock}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Adjustment Type</Label>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Select value={type} onValueChange={(v: any) => setType(v)}>


                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Addition">Addition</SelectItem>
                    <SelectItem value="Reduction">Reduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input 
                  type="number" 
                  min="1" 
                  required 
                  value={quantity} 
                  onChange={e => setQuantity(e.target.value)} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Select value={reason} onValueChange={(v: any) => setReason(v)}>

                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Damage">Damage</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                  <SelectItem value="Correction">Correction</SelectItem>
                  <SelectItem value="New Purchase">New Purchase</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-white">
                {loading ? "Saving..." : "Save Adjustment"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
