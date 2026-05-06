"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export function ChartFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = searchParams.get("range") || "week";
  
  const [start, setStart] = useState(searchParams.get("start") || "");
  const [end, setEnd] = useState(searchParams.get("end") || "");

  const setRange = (range: string) => {
    if (range === 'custom') {
       if (start && end) {
         router.push(`?range=custom&start=${start}&end=${end}`, { scroll: false });
       } else {
         router.push(`?range=custom`, { scroll: false });
       }
    } else {
      router.push(`?range=${range}`, { scroll: false });
    }
  };

  const handleCustomApply = () => {
    if (start && end) {
      router.push(`?range=custom&start=${start}&end=${end}`, { scroll: false });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {currentRange === 'custom' && (
        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl animate-in slide-in-from-right-4 duration-300">
          <Input 
            type="date" 
            value={start} 
            onChange={(e) => setStart(e.target.value)}
            className="h-7 text-xs px-2 w-32 bg-slate-700 text-white border-none focus-visible:ring-1 focus-visible:ring-primary"
          />
          <span className="text-slate-400 text-[10px] uppercase font-bold">to</span>
          <Input 
            type="date" 
            value={end} 
            onChange={(e) => setEnd(e.target.value)}
            className="h-7 text-xs px-2 w-32 bg-slate-700 text-white border-none focus-visible:ring-1 focus-visible:ring-primary"
          />
          <Button size="sm" onClick={handleCustomApply} className="h-7 text-xs px-3 bg-primary hover:bg-primary/90 text-white rounded-lg">Apply</Button>
        </div>
      )}
      <div className="flex bg-slate-800 rounded-xl p-1">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setRange('day')}
          className={`text-xs h-7 px-3 ${currentRange === 'day' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
        >
          Day
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setRange('week')}
          className={`text-xs h-7 px-3 ${currentRange === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
        >
          Week
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setRange('month')}
          className={`text-xs h-7 px-3 ${currentRange === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
        >
          Month
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setRange('custom')}
          className={`text-xs h-7 px-3 ${currentRange === 'custom' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
        >
          Custom
        </Button>
      </div>
    </div>
  );
}
