"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, ShieldCheck, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateBusinessSettings } from "@/app/settings/business-actions";
import { useSettings, BusinessSettings } from "./SettingsProvider";
import { Edit2 } from "lucide-react";

export interface FinancialYear {
  id: string;
  name: string;
  isActive: boolean;
}

export function Header({ 
  financialYears, 
  user,
  initialSettings 
}: { 
  financialYears: FinancialYear[], 
  user?: { name: string, role: string },
  initialSettings: BusinessSettings
}) {
  const router = useRouter();
  const [selectedFY, setSelectedFY] = useState<string>("");
  const { settings, updateSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(initialSettings);
  const [isDialogOpen, setIsDialogOpen] = useState(false);


  useEffect(() => {
    setLocalSettings(initialSettings);

    const getActiveFYFromCookie = () => {
      const match = document.cookie.match(/(^| )activeFinancialYearId=([^;]+)/);
      return match ? match[2] : null;
    };

    const cookieFY = getActiveFYFromCookie();
    // ✅ Validate: only trust the cookie if the ID actually exists in the DB list
    const cookieIsValid = cookieFY && financialYears.some(f => f.id === cookieFY);

    if (cookieIsValid) {
      setSelectedFY(cookieFY!);
    } else {
      // Cookie is stale/missing — replace with the active FY
      const active = financialYears.find(f => f.isActive) || financialYears[0];
      if (active) {
        setSelectedFY(active.id);
        // Overwrite the stale cookie with the real current ID
        document.cookie = `activeFinancialYearId=${active.id}; path=/; max-age=31536000`;
        console.info(`[FY Cookie] Stale/missing cookie replaced → ${active.name} (${active.id})`);
      }
    }
  }, [financialYears, initialSettings]);

  const handleFYChange = (id: string) => {
    setSelectedFY(id);
    document.cookie = `activeFinancialYearId=${id}; path=/; max-age=31536000`;
    router.refresh();
  };

  const handleSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBusinessSettings(localSettings);
    setIsDialogOpen(false);
    router.refresh();
  };

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-8 sticky top-0 z-10 shadow-sm print:hidden">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger>
          <div className="flex items-center gap-3 cursor-pointer group hover:bg-slate-50 p-2 rounded-xl transition-all relative pr-8">
            <div className="bg-primary/10 p-2 rounded-lg text-primary group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-black text-slate-800 tracking-tight leading-none uppercase">{settings.pharmacyName}</h2>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Automated ERP & Accounting</span>
            </div>
            <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
              <Edit2 className="w-3.5 h-3.5" />
            </div>
          </div>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-6 text-white flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Business Settings</DialogTitle>
              <p className="text-primary-foreground/70 text-xs font-bold uppercase tracking-widest">General Profile & Compliance</p>
            </div>
          </div>
          <form onSubmit={handleSettingsUpdate} className="p-8 space-y-6">
            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">Pharmacy Name</Label>
                <Input 
                   value={localSettings.pharmacyName} 
                   onChange={e => {
                     const newSet = {...localSettings, pharmacyName: e.target.value};
                     setLocalSettings(newSet);
                     updateSettings(newSet); // Instant update for Sidebar
                   }} 
                   className="h-12 border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-primary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">DL Number</Label>
                  <Input 
                  value={localSettings.dlNumber} 
                  onChange={e => setLocalSettings({...localSettings, dlNumber: e.target.value})} 
                  className="h-12 border-slate-200 rounded-xl font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">GSTIN</Label>
                <Input 
                  value={localSettings.gstin} 
                  onChange={e => setLocalSettings({...localSettings, gstin: e.target.value})} 
                  className="h-12 border-slate-200 rounded-xl font-mono text-sm uppercase"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">Contact Information</Label>
              <Input 
                value={localSettings.contactInfo} 
                onChange={e => setLocalSettings({...localSettings, contactInfo: e.target.value})} 
                className="h-12 border-slate-200 rounded-xl font-bold text-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">Personal Info/Owner Details</Label>
              <Input 
                value={localSettings.ownerDetails} 
                onChange={e => setLocalSettings({...localSettings, ownerDetails: e.target.value})} 
                className="h-12 border-slate-200 rounded-xl font-bold text-slate-800"
              />
            </div>
            </div>
            <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-primary/20">
              Save Profile Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex flex-col text-right">
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Current Session</span>
           <span className="text-xs font-black text-slate-600">{new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>

        <div className="flex items-center gap-3 px-5 py-2 bg-slate-100/50 border border-slate-200 rounded-full hover:bg-white transition-all group shadow-inner h-12">
          <CalendarDays className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
          <div className="flex flex-col justify-center">
             <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Accounting Period</span>
             <Select value={selectedFY} onValueChange={(v) => handleFYChange(v || "")}>
                <SelectTrigger className="border-none bg-transparent h-auto p-0 shadow-none focus:ring-0 text-sm font-black text-slate-800 min-w-[120px] hover:text-primary transition-colors flex items-center gap-1">
                  <SelectValue>
                    {financialYears.find(f => f.id === selectedFY)?.name ? `FY ${financialYears.find(f => f.id === selectedFY)?.name}` : "Select Period"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200 shadow-2xl p-2">
                  {financialYears.length === 0 && <div className="p-4 text-xs font-bold text-slate-400">Initialize FY in Settings</div>}
                  {financialYears.map((fy) => (
                    <SelectItem key={fy.id} value={fy.id} className="font-bold text-slate-700 rounded-lg hover:bg-slate-50">
                      FY {fy.name} {fy.isActive ? " (Active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
             </Select>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-4 pl-6 border-l border-slate-200">
             <div className="flex flex-col text-right">
                <span className="text-sm font-black text-slate-800">{user.name}</span>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{user.role}</span>
             </div>
          </div>
        )}
      </div>
    </header>
  );
}

