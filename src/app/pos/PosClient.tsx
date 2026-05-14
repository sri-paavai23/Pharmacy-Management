"use client";

import { useState, useRef, useEffect, useCallback } from "react";

import { product, batch, customer, doctor } from "@prisma/client";
import { processSale } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ScanLine, Trash2, QrCode, Stethoscope, AlertCircle, BadgeCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";


type ProductWithBatches = product & { batches: batch[] };

interface CartItem {
  id: string; // unique cart item id
  product: product;
  batch: batch;
  quantity: number | '';
}

export function PosClient({ products, customers, doctors }: { products: ProductWithBatches[], customers: customer[], doctors: doctor[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walk-in");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [newDoctor, setNewDoctor] = useState({ name: '', registrationNumber: '' });

  // Search logic
  const filteredProducts = products.filter(p => {
    if (!searchTerm) return false;
    const term = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.batches.some(b => b.batchNumber.toLowerCase().includes(term));
  }).slice(0, 10); // show max 10

  const searchSuggestions = filteredProducts.flatMap(p => p.batches.map(b => ({ product: p, batch: b })));

  // Compliance Logic
  const requiresDoctor = cart.some(item => item.product.scheduleH1);
  const getQty = useCallback((item: CartItem) => typeof item.quantity === 'number' ? item.quantity : 0, []);


  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.batch.mrp * (getQty(item) / Math.max(1, item.product.packSize))), 0);
  const totalTax = cart.reduce((acc, item) => {
    const itemTotal = item.batch.mrp * (getQty(item) / Math.max(1, item.product.packSize));
    const taxValue = itemTotal - (itemTotal / (1 + (item.product.taxRate / 100)));
    return acc + taxValue; // Calculate inclusive tax
  }, 0);
  
  // Calculate final amounts (assuming MRP is inclusive of tax for simplify POS)
  const totalAmount = subtotal - discount;
  const roundedTotal = Math.round(totalAmount);
  const roundOff = roundedTotal - totalAmount;


  const handleCompleteSale = useCallback(async (shouldPrint: boolean = true) => {
    if (cart.length === 0) return;

    // Get Active FY from cookie
    const getActiveFYFromCookie = () => {
      const match = document.cookie.match(/(^| )activeFinancialYearId=([^;]+)/);
      return match ? match[2] : null;
    };
    const fyId = getActiveFYFromCookie();
    if (!fyId) {
      alert("No active Financial Year selected. Please select one in the header.");
      return;
    }

    setLoading(true);
    
    const validItems = cart.filter(item => getQty(item) > 0);
    if (validItems.length === 0) {
      setLoading(false);
      return;
    }
    
    try {
      const payload = {
        customerId: selectedCustomerId === "walk-in" ? undefined : selectedCustomerId,
        doctorId: selectedDoctorId || undefined,
        financialYearId: fyId,
        newCustomer: newCustomer.name ? newCustomer : undefined,
        newDoctor: newDoctor.name ? newDoctor : undefined,
        items: validItems.map(item => ({
          batchId: item.batch.id,
          quantity: Math.max(1, Math.round(getQty(item) / Math.max(1, item.product.packSize))),
          unitPrice: item.batch.mrp,
          unitPurchasePrice: item.batch.purchasePrice,
        })),
        totalAmount,
        totalTax,
        roundOff,
        paymentMode: paymentMethod.toUpperCase(),
        source: "POS",
      };

      await processSale(payload);
      if (shouldPrint) window.print();
      setCart([]);
      setDiscount(0);
      setSearchTerm("");
      setNewCustomer({ name: '', phone: '' });
      setNewDoctor({ name: '', registrationNumber: '' });
      setSelectedCustomerId("walk-in");
      setSelectedDoctorId("");
      
    } catch (e) {
      alert("Error: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setLoading(false);
      searchInputRef.current?.focus();
    }
  }, [cart, selectedCustomerId, selectedDoctorId, newCustomer, newDoctor, totalAmount, totalTax, roundOff, paymentMethod, getQty]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleCompleteSale(true);
      }
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleCompleteSale(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCompleteSale]);


  const addToCart = (product: product, batch: batch) => {
    setCart(prev => {
      const existing = prev.find(item => item.batch.id === batch.id);
      const packsToAdd = Math.max(1, Math.round(1 / Math.max(1, product.packSize))); // 1 tablet entered
      if (existing) {
        if (typeof existing.quantity === 'number' && Math.round(existing.quantity / Math.max(1, product.packSize)) + packsToAdd > batch.currentStock) return prev; // Limit stock
        return prev.map(item => item.batch.id === batch.id ? { ...item, quantity: (typeof item.quantity === 'number' ? item.quantity + 1 : 1) } : item);
      }
      return [...prev, { id: Math.random().toString(), product, batch, quantity: 1 }];
    });
    setSearchTerm("");
    setSelectedIndex(0);
    setTimeout(() => {
      const qtyInput = document.getElementById(`pos-qty-${batch.id}`);
      if (qtyInput) {
        qtyInput.focus();
        (qtyInput as HTMLInputElement).select();
      }
    }, 50);
  };


  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, val: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        if (val === '') return { ...item, quantity: '' as unknown as number };
        const parsed = parseInt(val);
        if (isNaN(parsed)) return item;
        return { ...item, quantity: Math.min(parsed, item.batch.currentStock) };
      }
      return item;
    }));
  };






  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden print:h-auto print:bg-white print:block">
      <div className="flex-1 flex flex-col p-4 print:p-0">

        {/* Search Bar */}
        <div className="relative mb-4 print:hidden">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
          <div
            onKeyDown={e => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(prev => {
                  const next = Math.min(prev + 1, Math.max(0, searchSuggestions.length - 1));
                  document.getElementById(`pos-suggestion-${next}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                  return next;
                });
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(prev => {
                  const next = Math.max(prev - 1, 0);
                  document.getElementById(`pos-suggestion-${next}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                  return next;
                });
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (searchSuggestions.length > 0) {
                  const selected = searchSuggestions[selectedIndex] || searchSuggestions[0];
                  addToCart(selected.product, selected.batch);
                }
              } else if (e.key === "Escape") {
                setSearchTerm("");
              }
            }}
          >
            <Input 
              autoFocus
              ref={searchInputRef}
              className="pl-12 h-14 text-lg shadow-sm border-slate-300 rounded-xl"
              placeholder="Search by Product Name or Batch (Press Esc to clear)..." 
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setSelectedIndex(0);
              }}
            />
          </div>
          {searchTerm && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border z-50 max-h-96 overflow-y-auto">
              <Table>
                <TableBody>
                  {searchSuggestions.map((suggestion, index) => {
                    const p = suggestion.product;
                    const b = suggestion.batch;
                    const isSelected = index === selectedIndex;
                    return (
                      <TableRow 
                        id={`pos-suggestion-${index}`}
                        key={`${p.id}-${b.id}`} 
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-primary/5'}`}
                        onClick={() => addToCart(p, b)}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg">{p.name}</span>
                            {p.scheduleH1 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-200">H1</span>}
                            {isSelected && <span className="ml-2 text-[10px] bg-primary text-white px-2 py-0.5 rounded font-bold uppercase shadow-sm animate-pulse flex items-center gap-1">Enter ↵</span>}
                          </div>
                          <div className="text-sm text-slate-500 font-medium">{p.manufacturer} • <span className="text-primary font-black text-base bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">Pack: {p.packSize}</span></div>
                          <div className="text-[10px] text-slate-400 font-mono mt-1">Batch #{b.batchNumber}</div>


                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold text-lg text-emerald-600">₹{b.mrp.toFixed(2)}</div>
                          <div className="text-xs text-slate-400">Stock: {b.currentStock * p.packSize} tablets</div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {searchSuggestions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-slate-500">No products found for &quot;{searchTerm}&quot;</TableCell>

                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Cart Table */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col print:border-none print:shadow-none">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center print:bg-white">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <ScanLine className="w-5 h-5"/> Current Items
            </h2>
            <div className="text-sm text-slate-500">Items: {cart.length}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Pack</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="w-24 text-center">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {item.product.name}
                        {item.product.scheduleH1 && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-black text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">{item.product.packSize}</span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">#{item.batch.batchNumber}</TableCell>
                    <TableCell className="text-center">
                      <Input 
                        id={`pos-qty-${item.batch.id}`}
                        type="number" 
                        min="1" 
                        value={item.quantity} 
                        onChange={e => updateQuantity(item.id, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            searchInputRef.current?.focus();
                          }
                        }}
                        className="w-16 h-8 text-center mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right">₹{item.batch.mrp.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold text-slate-700">₹{(item.batch.mrp * (getQty(item) / Math.max(1, item.product.packSize))).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeFromCart(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 pt-20">
                <ScanLine className="w-16 h-16 opacity-20" />
                <p>Cart is empty. Search products to add.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right pane: Payment & Summary */}
      <div className="w-96 bg-white border-l shadow-xl flex flex-col print:w-full print:shadow-none print:border-t mt-4">
        <div className="p-6 border-b flex-1 flex flex-col gap-6 overflow-y-auto print:hidden">
          {/* Customer Selection */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Select Existing</label>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Select value={selectedCustomerId} onValueChange={(val: any) => {

                setSelectedCustomerId(val);
                if (val !== 'walk-in') setNewCustomer({name: '', phone: ''});
              }}>
                <SelectTrigger className="h-12 border-slate-300 mt-1">
                  <SelectValue placeholder="Select Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 opacity-60">
               <hr className="flex-1 border-slate-300"/> <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Or Add New</span> <hr className="flex-1 border-slate-300"/>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Name & Contact Number</label>
              <div className="flex flex-col gap-2">
                <Input 
                  placeholder="Enter Name" 
                  value={newCustomer.name} 
                  onChange={e => {
                    setNewCustomer(prev => ({...prev, name: e.target.value}));
                    if (selectedCustomerId !== "walk-in") setSelectedCustomerId("walk-in");
                  }} 
                  className="border-slate-300 h-10"
                />
                <Input 
                  type="tel"
                  placeholder="Enter Contact Number" 
                  value={newCustomer.phone} 
                  onChange={e => {
                    const onlyNumbers = e.target.value.replace(/\D/g, '');
                    setNewCustomer(prev => ({...prev, phone: onlyNumbers}));
                  }} 
                  className="border-slate-300 h-10"
                />
              </div>
            </div>

            {/* Doctor Selection (Mandatory for H1) */}
            <div className={cn("pt-4 border-t space-y-3", requiresDoctor && "p-4 bg-red-50/50 rounded-2xl border-red-100 border shadow-inner transition-all")}>
              <div className="flex items-center justify-between">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary" /> Prescribing Doctor
                 </label>
                 {requiresDoctor && <BadgeCheck className="w-4 h-4 text-red-500" />}
              </div>
              
              <div className="relative">
                <Input 
                  placeholder={requiresDoctor ? "Type Doctor Name (Mandatory)..." : "Type Doctor Name..."}
                  className={cn("h-12 rounded-xl border-slate-300 shadow-sm", requiresDoctor && !selectedDoctorId && !newDoctor.name && "border-red-400 ring-4 ring-red-100")}
                  value={newDoctor.name || (doctors.find(d => d.id === selectedDoctorId)?.name || "")}
                  onChange={e => {
                    const val = e.target.value;
                    const found = doctors.find(d => d.name.toLowerCase() === val.toLowerCase());
                    if (found) {
                      setSelectedDoctorId(found.id);
                      setNewDoctor({ name: '', registrationNumber: '' });
                    } else {
                      setSelectedDoctorId("");
                      setNewDoctor(p => ({ ...p, name: val }));
                    }
                  }}
                />
                {!selectedDoctorId && newDoctor.name && (
                  <div className="mt-2 space-y-2 animate-in slide-in-from-top-2">
                    <Label className="text-[10px] font-bold text-red-600 uppercase">New Doctor Detected - Enter Reg No.</Label>
                    <Input 
                      placeholder="Medical Reg. Number"
                      className="h-10 text-xs border-red-200 bg-white"
                      value={newDoctor.registrationNumber}
                      onChange={e => setNewDoctor(p => ({ ...p, registrationNumber: e.target.value }))}
                    />
                  </div>
                )}
                
                {/* Search Suggestion Dropdown can be added here if needed, but 'typing' behavior is achieved */}
              </div>
            </div>

          </div>

          {/* Discount */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Discount (₹)</label>
            <Input 
              type="number" 
              min="0"
              className="h-12 border-slate-300 text-lg"
              value={discount === 0 ? '' : discount} 
              onChange={e => setDiscount(parseFloat(e.target.value) || 0)} 
              placeholder="0.00"
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {['Cash', 'UPI', 'Card'].map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-3 rounded-lg border font-medium transition-all ${paymentMethod === method ? 'bg-primary text-white border-primary shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* UPI Generation Stub */}
          {paymentMethod === 'UPI' && (
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <QrCode className="w-20 h-20 text-slate-400 mb-2" />
              <p className="text-sm text-slate-500 font-medium">UPI QR Code</p>
              <p className="text-xs text-slate-400">Scan to pay ₹{totalAmount.toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="p-6 bg-slate-50 space-y-4 shrink-0 print:bg-white">
          <div className="space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Includes GST</span>
              <span>₹{totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-red-500">
              <span>Discount</span>
              <span>-₹{discount.toFixed(2)}</span>
            </div>
            {roundOff !== 0 && (
              <div className="flex justify-between text-slate-500 italic text-xs">
                <span>Round Off</span>
                <span>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
              </div>
            )}
          </div>
          
          <div className="pt-4 border-t border-slate-200">
            <div className="flex justify-between items-end mb-4">
              <span className="text-lg font-bold text-slate-800">Total</span>
              <span className="text-4xl font-extrabold text-primary tracking-tight">₹{Math.max(0, roundedTotal).toFixed(2)}</span>
            </div>

            
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="flex-1 h-16 text-lg font-bold rounded-xl border-2 border-primary/20 text-primary hover:bg-primary/5 transition-all print:hidden"
                onClick={() => handleCompleteSale(false)}
                disabled={loading || cart.length === 0}
              >
                {loading ? "..." : "Save"}
              </Button>
              <Button 
                className="flex-[2] h-16 text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all print:hidden"
                onClick={() => handleCompleteSale(true)}
                disabled={loading || cart.length === 0}
              >
                {loading ? "Processing..." : "Print"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}