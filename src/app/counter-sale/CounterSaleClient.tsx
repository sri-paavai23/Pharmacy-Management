"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { product, batch } from "@prisma/client";
import { processSale } from "../pos/actions"; // Reusing the same logic for simplicity
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ScanLine, Trash2, AlertCircle, ArrowRightLeft, Mic, MicOff, Volume2 } from "lucide-react";


import { cn } from "@/lib/utils";
import { voiceSearch } from "./voice-actions";

type ProductWithBatches = product & { batches: batch[] };

interface CartItem {
  id: string;
  product: product;
  batch: batch;
  quantity: number | '';
}

export function CounterSaleClient({ products }: { products: ProductWithBatches[] }) {
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

  // New requirements: Manual Grand Total
  const [manualGrandTotal, setManualGrandTotal] = useState<number | "">("");

  // Voice Search States
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [showNotFound, setShowNotFound] = useState(false); // New state for feedback
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const filteredProducts = products.filter(p => {
    if (!searchTerm) return false;
    const term = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.batches.some(b => b.batchNumber.toLowerCase().includes(term));
  }).slice(0, 10);

  const searchSuggestions = filteredProducts.flatMap(p => p.batches.map(b => ({ product: p, batch: b })));

  const getQty = useCallback((item: CartItem) => typeof item.quantity === 'number' ? item.quantity : 0, []);

  // Automatic Calculation
  const subtotal = cart.reduce((acc, item) => acc + (item.batch.mrp * (getQty(item) / Math.max(1, item.product.packSize))), 0);
  const totalTax = cart.reduce((acc, item) => {
    const itemTotal = item.batch.mrp * (getQty(item) / Math.max(1, item.product.packSize));
    const taxValue = itemTotal - (itemTotal / (1 + (item.product.taxRate / 100)));
    return acc + taxValue;
  }, 0);

  const autoTotal = subtotal - discount;
  const hasH1Drug = cart.some(item => item.product.scheduleH1);

  // Swap logic
  const handleSwap = () => {
    setManualGrandTotal(autoTotal);
  };

  const actualGrandTotal = manualGrandTotal === "" ? autoTotal : manualGrandTotal;
  const roundOff = actualGrandTotal - autoTotal;

  const handleCompleteSale = useCallback(async () => {
    if (cart.length === 0) return;

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

    if (hasH1Drug && (!newDoctor.name || !newDoctor.registrationNumber)) {
      alert("Doctor Name and Registration Number are mandatory because the cart contains Schedule H1 drugs.");
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
          quantity: Math.max(1, Math.round(getQty(item) / Math.max(1, item.product.packSize))), // Convert tablets to packs for DB
          unitPrice: item.batch.mrp,
          unitPurchasePrice: item.batch.purchasePrice,
        })),
        totalAmount: autoTotal, // Base amount
        totalTax,
        roundOff, // Manual adjustment passed as roundOff
        paymentMode: paymentMethod.toUpperCase(),
        source: "COUNTER",
      };

      await processSale(payload);
      window.print();
      setCart([]);
      setDiscount(0);
      setSearchTerm("");
      setNewCustomer({ name: '', phone: '' });
      setNewDoctor({ name: '', registrationNumber: '' });
      setSelectedCustomerId("walk-in");
      setSelectedDoctorId("");
      setManualGrandTotal("");

    } catch (e) {
      alert("Error: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setLoading(false);
      searchInputRef.current?.focus();
    }
  }, [cart, selectedCustomerId, selectedDoctorId, newCustomer, newDoctor, autoTotal, totalTax, roundOff, paymentMethod, getQty, hasH1Drug]);
  const addToCart = useCallback((product: product, batch: batch, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.batch.id === batch.id);
      const packsToAdd = Math.max(1, Math.round(quantity / Math.max(1, product.packSize)));
      if (existing) {
        if (typeof existing.quantity === 'number' && Math.round(existing.quantity / Math.max(1, product.packSize)) + packsToAdd > batch.currentStock) return prev;
        return prev.map(item => item.batch.id === batch.id ? { ...item, quantity: (typeof item.quantity === 'number' ? item.quantity + quantity : quantity) } : item);
      }
      return [...prev, { id: Math.random().toString(), product, batch, quantity: quantity }];
    });
    setSearchTerm("");
    setSelectedIndex(0);
    setTimeout(() => {
      const qtyInput = document.getElementById(`qty-${batch.id}`);
      if (qtyInput) {
        qtyInput.focus();
        (qtyInput as HTMLInputElement).select();
      }
    }, 50);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleVoiceResult = useCallback((result: { items?: any[]; transcription?: string; error?: string }) => {
    if (result.items && result.items.length > 0) {
      result.items.forEach((item) => {
        addToCart(item.product, item.batch, item.requestedQty);
      });
      setSearchTerm("");
      setShowNotFound(false);
    } else if (result.transcription) {
      // Instead of the whole sentence, just show the transcription briefly as feedback
      // and keep the search bar clean unless it was a single word
      const words = result.transcription.trim().split(/\s+/);
      if (words.length <= 2) {
        setSearchTerm(result.transcription);
      }
      setShowNotFound(true);
      setTimeout(() => setShowNotFound(false), 3000);
    }
  }, [addToCart]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        setIsProcessingVoice(true);
        try {
          const result = await voiceSearch(formData);
          handleVoiceResult(result);
        } catch (err) {
          console.error("Voice search failed", err);
        } finally {
          setIsProcessingVoice(false);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
    }
  }, [handleVoiceResult]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, stopRecording, startRecording]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        handleCompleteSale();
      }
      if (e.key === "m" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleRecording();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCompleteSale, isRecording, toggleRecording]);



  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, val: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        if (val === '') return { ...item, quantity: '' };
        const parsed = parseInt(val);
        if (isNaN(parsed)) return item;
        if (parsed > item.batch.currentStock) return item;
        return { ...item, quantity: parsed };
      }
      return item;
    }));
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden print:h-auto print:bg-white print:block">
      {/* Left pane: Cart & Search */}
      <div className="flex-1 flex flex-col p-4 print:p-0">
        <div className="relative mb-4 print:hidden">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
          <Input
            autoFocus
            ref={searchInputRef}
            className="pl-12 h-14 text-lg shadow-sm border-slate-300 rounded-xl"
            placeholder="Search Products for Counter Sale..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setSelectedIndex(0);
              if (showNotFound) setShowNotFound(false);
            }}
            onKeyDown={e => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(prev => {
                  const next = Math.min(prev + 1, Math.max(0, searchSuggestions.length - 1));
                  document.getElementById(`suggestion-${next}`)?.scrollIntoView({ block: 'nearest' });
                  return next;
                });
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(prev => {
                  const next = Math.max(prev - 1, 0);
                  document.getElementById(`suggestion-${next}`)?.scrollIntoView({ block: 'nearest' });
                  return next;
                });
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (searchSuggestions.length > 0) {
                  const selected = searchSuggestions[selectedIndex] || searchSuggestions[0];
                  const parts = searchTerm.trim().split(/\s+/);
                  const lastPart = parts[parts.length - 1];
                  const possibleQty = parseInt(lastPart);
                  if (!isNaN(possibleQty) && possibleQty > 0 && parts.length > 1) {
                    addToCart(selected.product, selected.batch, possibleQty);
                  } else {
                    addToCart(selected.product, selected.batch, 1);
                  }
                  setShowNotFound(false);
                } else {
                  setShowNotFound(true);
                  setTimeout(() => setShowNotFound(false), 3000);
                }
              } else if (e.key === "Escape") {
                setSearchTerm("");
              }
            }}
          />
          {showNotFound && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-200 animate-in fade-in zoom-in duration-200">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-tight">Product not found</span>
            </div>
          )}
          {searchTerm && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border z-50 max-h-96 overflow-y-auto">
              <Table>
                <TableBody>
                  {searchSuggestions.length > 0 ? (
                    searchSuggestions.map((suggestion, index) => {
                      const p = suggestion.product;
                      const b = suggestion.batch;
                      const isSelected = index === selectedIndex;
                      return (
                        <TableRow
                          id={`suggestion-${index}`}
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
                            <div className="text-sm text-slate-500 font-medium">{p.manufacturer} • Pack: {p.packSize}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-1">Batch #{b.batchNumber}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-bold text-lg text-emerald-600">₹{b.mrp.toFixed(2)}</div>
                            <div className="text-xs text-slate-400">Stock: {b.currentStock}</div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={2} className="py-8 text-center text-slate-400 italic">
                        No products found matching &quot;{searchTerm}&quot;
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex-1 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col print:border-none print:shadow-none">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center print:bg-white">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2 underline decoration-primary decoration-4 underline-offset-4">
              <ScanLine className="w-5 h-5 text-primary" /> Counter Sale Counter
            </h2>
            <div className="text-sm text-slate-500 font-bold">Total Items: {cart.length}</div>
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
                        id={`qty-${item.batch.id}`}
                        type="number"
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
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => removeFromCart(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Right pane: Payment & Summary */}
      <div className="w-96 bg-white border-l shadow-xl flex flex-col print:w-full print:shadow-none">
        <div className="p-6 border-b flex-1 flex flex-col gap-6 overflow-y-auto print:hidden">
          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider text-center block">Select Payment Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {['Cash', 'UPI', 'Card'].map(method => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-3 rounded-xl border font-bold transition-all ${paymentMethod === method ? 'bg-primary text-white border-primary shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Search Feedback */}
          {isProcessingVoice && (
            <div className="mt-4 p-4 bg-primary/10 rounded-xl border border-primary/20 flex items-center gap-3 animate-pulse">
              <Volume2 className="w-5 h-5 text-primary animate-bounce" />
              <span className="text-sm font-bold text-primary uppercase tracking-widest">Processing Voice Command...</span>
            </div>
          )}

          {/* Doctor Info Area */}
          <div className="mt-auto space-y-4">
             <div className={`bg-slate-50 border rounded-xl p-4 flex flex-col gap-3 shadow-sm transition-colors duration-300 ${hasH1Drug ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase tracking-wider ${hasH1Drug ? 'text-red-600' : 'text-slate-500'}`}>Prescribing Doctor</span>
                  {hasH1Drug && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-200">Required (H1)</span>}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={`text-[10px] font-bold uppercase ${hasH1Drug && !newDoctor.name ? 'text-red-500' : 'text-slate-500'}`}>Doctor Name</label>
                    <Input 
                      placeholder="Dr. Name" 
                      className={`h-8 text-sm ${hasH1Drug && !newDoctor.name ? 'border-red-300 focus-visible:ring-red-400 bg-white' : 'bg-white'}`}
                      value={newDoctor.name}
                      onChange={e => setNewDoctor(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] font-bold uppercase ${hasH1Drug && !newDoctor.registrationNumber ? 'text-red-500' : 'text-slate-500'}`}>Registration No.</label>
                    <Input 
                      placeholder="Reg No." 
                      className={`h-8 text-sm ${hasH1Drug && !newDoctor.registrationNumber ? 'border-red-300 focus-visible:ring-red-400 bg-white' : 'bg-white'}`}
                      value={newDoctor.registrationNumber}
                      onChange={e => setNewDoctor(prev => ({ ...prev, registrationNumber: e.target.value }))}
                    />
                  </div>
                </div>
             </div>
          </div>
        </div>

        {/* Floating Voice Control */}
        <div className="fixed bottom-8 right-[420px] z-50">
          <Button
            onClick={toggleRecording}
            className={cn(
              "w-16 h-16 rounded-full shadow-2xl transition-all duration-300",
              isRecording ? "bg-red-500 hover:bg-red-600 scale-110" : "bg-primary hover:bg-primary/90"
            )}
          >
            {isRecording ? (
              <div className="relative">
                <MicOff className="w-8 h-8 text-white" />
                <div className="absolute inset-0 rounded-full border-4 border-white/50 animate-ping" />
              </div>
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </Button>
          <div className="text-[10px] font-black uppercase text-slate-400 mt-2 text-center tracking-tighter">
            Ctrl + M
          </div>
        </div>

        {/* Totals Section - COMPACT & HIGH-TECH */}
        <div className="p-6 bg-slate-900 text-white space-y-6 shrink-0 print:bg-white print:text-black">
          <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4">

            {/* Computed Total */}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Automatic Total</span>
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                <span className="text-xl font-black text-emerald-400">₹{autoTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Swap Button */}
            <Button
              onClick={handleSwap}
              variant="ghost"
              size="icon"
              className="rounded-full bg-primary/20 hover:bg-primary/40 text-primary mt-4 transition-transform active:scale-90"
              title="Copy to Grand Total"
            >
              <ArrowRightLeft className="w-5 h-5" />
            </Button>

            {/* Manual Grand Total */}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Manual Grand Total</span>
              <Input
                type="number"
                className="bg-slate-800 border-slate-700 h-10 text-xl font-black text-primary focus:ring-primary/50 text-center rounded-xl p-0"
                value={manualGrandTotal}
                onChange={e => setManualGrandTotal(e.target.value === "" ? "" : parseFloat(e.target.value))}
                placeholder="0.00"
              />
            </div>

          </div>


          <div className="pt-4">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-bold text-slate-400">Profit (Adjustment)</span>
              <span className={`text-xl font-bold ${actualGrandTotal > autoTotal ? 'text-emerald-400' : actualGrandTotal < autoTotal ? 'text-red-400' : 'text-slate-400'}`}>
                {actualGrandTotal > autoTotal ? '+' : actualGrandTotal < autoTotal ? '-' : ''}₹{Math.abs(actualGrandTotal - autoTotal).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-end mb-4">
              <span className="text-lg font-bold text-slate-400">Final Bill</span>
              <span className="text-4xl font-extrabold text-white tracking-tighter">₹{actualGrandTotal.toFixed(2)}</span>
            </div>

            <Button
              className="w-full h-16 text-xl font-black rounded-2xl shadow-2xl hover:shadow-primary/30 transition-all print:hidden"
              onClick={handleCompleteSale}
              disabled={loading || cart.length === 0}
            >
              {loading ? "Processing..." : "Complete Counter Sale (F12)"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
