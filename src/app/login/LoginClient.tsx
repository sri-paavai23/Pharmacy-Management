"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithPin } from "./actions";
import { ShieldCheck, Loader2, Delete } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoginClient() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        handleAutoLogin(newPin);
      }
    }
  };

  const handleAutoLogin = async (finalPin: string) => {
    setLoading(true);
    setError("");
    try {
      await loginWithPin(finalPin);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid PIN");

      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const clearPin = () => setPin("");
  const backspace = () => setPin(pin.slice(0, -1));

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
         <div className="absolute top-10 left-10 w-96 h-96 bg-primary rounded-full blur-[100px]" />
         <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-sm space-y-8 relative z-10 animate-in fade-in zoom-in-95 duration-700">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-primary/20 p-5 rounded-[2.5rem] shadow-2xl shadow-primary/20 ring-1 ring-primary/30">
              <ShieldCheck className="w-12 h-12 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Vellammal Pharmacy</h1>
            <p className="text-slate-400 font-bold text-[10px] tracking-[0.3em] uppercase mt-2">Professional ERP System</p>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 shadow-3xl space-y-8">
          <div className="flex justify-center gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i}
                className={cn(
                  "w-4 h-4 rounded-full border-2 transition-all duration-300",
                  pin.length > i 
                    ? "bg-primary border-primary scale-125 shadow-lg shadow-primary/40" 
                    : "border-white/20"
                )}
              />
            ))}
          </div>

          {error && <p className="text-red-400 text-center text-xs font-black uppercase tracking-widest animate-bounce">{error}</p>}

          <div className="grid grid-cols-3 gap-4">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                onClick={() => handleKeyPress(num)}
                disabled={loading}
                className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-2xl font-black transition-all active:scale-90 flex items-center justify-center ring-1 ring-white/5"
              >
                {num}
              </button>
            ))}
            <button
              onClick={clearPin}
              disabled={loading}
              className="h-16 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-black uppercase transition-all flex items-center justify-center ring-1 ring-red-500/20"
            >
              Clear
            </button>
            <button
              onClick={() => handleKeyPress("0")}
              disabled={loading}
              className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-2xl font-black transition-all active:scale-90 flex items-center justify-center ring-1 ring-white/5"
            >
              0
            </button>
            <button
              onClick={backspace}
              disabled={loading}
              className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-2xl font-black transition-all active:scale-90 flex items-center justify-center"
            >
              <Delete className="w-6 h-6 opacity-60" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center gap-3 text-primary text-xs font-black uppercase tracking-[0.2em]">
            <Loader2 className="w-4 h-4 animate-spin" /> Verifying Credentials...
          </div>
        )}

        <div className="text-center">
           <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest leading-relaxed">
             Authorized Access Only • Internal ERP Security Gate<br/>Locked Session Active
           </p>
        </div>
      </div>
    </div>
  );
}
