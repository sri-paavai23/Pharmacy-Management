"use client";

import { useState } from "react";
import { subscription, customer, product, batch } from "@prisma/client";
import { generateDeliveryInvoice, advanceDeliveryStatus } from "./actions";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, Truck, CheckCircle, Clock } from "lucide-react";

type SubWithCustomer = subscription & { Customer: customer };
type ProductWithBatches = product & { batches: batch[] };

export function SeniorCareClient({ subscriptions, products }: { subscriptions: SubWithCustomer[], products: ProductWithBatches[] }) {
  const [loading, setLoading] = useState<string | null>(null);

  const pending = subscriptions.filter(s => s.deliveryStatus === "Pending");
  const dispatched = subscriptions.filter(s => s.deliveryStatus === "Dispatched");
  const delivered = subscriptions.filter(s => s.deliveryStatus === "Delivered");

  const handleGenerateInvoice = async (id: string) => {
    setLoading(id);
    try {
      await generateDeliveryInvoice(id);
      alert("Invoice generated and stock deducted!");
    } catch (e) {
      alert("Error: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setLoading(null);
    }
  };

  const handleStatusChange = async (id: string, current: string) => {
    setLoading(id);
    try {
      await advanceDeliveryStatus(id, current);
    } catch (e) {
      alert("Error: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setLoading(null);
    }
  };

  const getMedicinesText = (jsonStr: string) => {
    try {
      const arr = JSON.parse(jsonStr) as Array<{productId: string, quantity: number}>;
      return arr.map(m => {
        const p = products.find(prod => prod.id === m.productId);
        return p ? `${p.name} (x${m.quantity})` : 'Unknown Item';
      }).join(', ');
    } catch {
      return "Invalid prescription data";
    }
  };

  const renderCard = (sub: SubWithCustomer) => (
    <Card key={sub.id} className="mb-4 shadow-sm border opacity-90 hover:opacity-100 transition-opacity">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base flex justify-between items-start">
          <span>{sub.Customer.name}</span>
          {sub.Customer.isSeniorCitizen && <Badge variant="secondary" className="text-xs">Senior</Badge>}
        </CardTitle>
        <div className="text-sm text-slate-500 font-medium">#{sub.Customer.phone}</div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-sm text-slate-600 mb-2 mt-2 break-words">
          <strong>Items:</strong> {getMedicinesText(sub.medicines)}
        </div>
        <div className="text-xs text-slate-400">
          Due: {new Date(sub.nextDeliveryDate).toLocaleDateString()}
        </div>
        <div className="text-xs text-slate-400 mt-1 truncate">
          Address: {sub.Customer.address || "No address provided"}

        </div>
      </CardContent>
      <CardFooter className="p-2 bg-slate-50 border-t flex gap-2">
        {sub.deliveryStatus === "Pending" && (
          <Button 
            size="sm" 
            className="w-full bg-primary hover:bg-primary/90" 
            onClick={() => handleGenerateInvoice(sub.id)}
            disabled={loading === sub.id}
          >
            {loading === sub.id ? "Processing..." : <><Receipt className="w-4 h-4 mr-1"/> Generate Invoice</>}
          </Button>
        )}
        {sub.deliveryStatus === "Dispatched" && (
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            onClick={() => handleStatusChange(sub.id, "Dispatched")}
            disabled={loading === sub.id}
          >
            {loading === sub.id ? "Processing..." : <><CheckCircle className="w-4 h-4 mr-1"/> Mark Delivered</>}
          </Button>
        )}
        {sub.deliveryStatus === "Delivered" && (
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full"
            onClick={() => handleStatusChange(sub.id, "Delivered")}
            disabled={loading === sub.id}
          >
            Revert Status
          </Button>
        )}
      </CardFooter>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
      {/* Pending Column */}
      <div className="bg-slate-100/50 rounded-xl p-4 flex flex-col border">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-amber-500" /> Pending ({pending.length})
        </h2>
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {pending.map(renderCard)}
          {pending.length === 0 && <p className="text-center text-slate-400 text-sm mt-10">No pending deliveries</p>}
        </div>
      </div>

      {/* Dispatched Column */}
      <div className="bg-slate-100/50 rounded-xl p-4 flex flex-col border">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-blue-500" /> Dispatched ({dispatched.length})
        </h2>
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {dispatched.map(renderCard)}
          {dispatched.length === 0 && <p className="text-center text-slate-400 text-sm mt-10">No dispatched deliveries</p>}
        </div>
      </div>

      {/* Delivered Column */}
      <div className="bg-slate-100/50 rounded-xl p-4 flex flex-col border">
        <h2 className="font-semibold text-slate-700 flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-emerald-500" /> Delivered ({delivered.length})
        </h2>
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {delivered.map(renderCard)}
          {delivered.length === 0 && <p className="text-center text-slate-400 text-sm mt-10">No recent deliveries</p>}
        </div>
      </div>
    </div>
  );
}
