"use client";

import { useState } from "react";
import { accountgroup, ledger, financialyear } from "@prisma/client";
import { addAccountGroup, addLedger } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FolderTree, BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";


export function MastersClient({ 
  groups, 
  ledgers, 
  financialYears, 
  activeFYId 
}: { 
  groups: accountgroup[], 
  ledgers: (ledger & { Group: accountgroup })[],
  financialYears: financialyear[],
  activeFYId: string
}) {
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupNature, setGroupNature] = useState("Asset");

  const [ledgerName, setLedgerName] = useState("");
  const [ledgerGroupId, setLedgerGroupId] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [balanceType, setBalanceType] = useState<"Dr" | "Cr">("Dr");

  const handleAddGroup = async () => {
    if (!groupName) return;
    setLoading(true);
    try {
      await addAccountGroup({ name: groupName, nature: groupNature });
      setGroupName("");
    } catch {
      alert("Error adding group");

    } finally {
      setLoading(false);
    }
  };

  const handleAddLedger = async () => {
    if (!ledgerName || !ledgerGroupId || !activeFYId) {
       alert("Please fill all fields and ensure a Financial Year is selected.");
       return;
    }
    setLoading(true);
    try {
      await addLedger({
        name: ledgerName,
        groupId: ledgerGroupId,
        financialYearId: activeFYId,
        openingBalance,
        balanceType
      });
      setLedgerName("");
      setOpeningBalance(0);
    } catch {
      alert("Error adding ledger");

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Accounting Masters</h1>
          <p className="text-slate-500 font-bold">Manage your chart of accounts and ledgers</p>
        </div>
      </div>

      <Tabs defaultValue="ledgers" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-2xl mb-6">
          <TabsTrigger value="ledgers" className="rounded-xl px-6 font-black data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <BookOpen className="w-4 h-4 mr-2" /> Ledgers
          </TabsTrigger>
          <TabsTrigger value="groups" className="rounded-xl px-6 font-black data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <FolderTree className="w-4 h-4 mr-2" /> Account Groups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ledgers" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Create Ledger Form */}
            <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden self-start sticky top-24">
              <CardHeader className="bg-slate-900 text-white p-6">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" /> Create New Ledger
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ledger Name</label>
                  <Input 
                    placeholder="e.g. Shop Rent, HDFC Bank" 
                    className="h-12 rounded-xl border-slate-200 font-bold"
                    value={ledgerName}
                    onChange={e => setLedgerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Group</label>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Select value={ledgerGroupId} onValueChange={(v: any) => setLedgerGroupId(v)}>


                    <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
                      <SelectValue placeholder="Select Group" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {groups.map(g => (
                        <SelectItem key={g.id} value={g.id} className="font-bold">{g.name} ({g.nature})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Bal</label>
                    <Input 
                      type="number"
                      placeholder="0.00" 
                      className="h-12 rounded-xl border-slate-200 font-bold"
                      value={openingBalance || ''}
                      onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Select value={balanceType} onValueChange={(v: any) => setBalanceType(v)}>




                      <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Dr" className="font-bold">Debit (Dr)</SelectItem>
                        <SelectItem value="Cr" className="font-bold">Credit (Cr)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  className="w-full h-12 rounded-xl font-black text-lg bg-primary hover:bg-primary/90 mt-4 shadow-xl"
                  onClick={handleAddLedger}
                  disabled={loading}
                >
                  {loading ? "Adding..." : "Add Ledger"}
                </Button>
              </CardContent>
            </Card>

            {/* Ledger List */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
                 <div className="p-6 bg-white border-b flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-800">Existing Ledgers</h3>
                    <div className="text-xs font-black px-3 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-tighter">
                       FY {financialYears.find(fy => fy.id === activeFYId)?.name || 'N/A'}
                    </div>
                 </div>
                 <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-400">Ledger Name</TableHead>
                          <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-400">Group</TableHead>
                          <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-400 text-right">Current Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgers.map(l => (
                          <TableRow key={l.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-black text-slate-700">{l.name}</TableCell>
                            <TableCell className="font-bold text-slate-400">{l.Group.name}</TableCell>
                            <TableCell className="text-right">
                               <div className="flex flex-col items-end">
                                  <span className={cn("text-lg font-black", l.currentBalance < 0 ? "text-red-500" : "text-emerald-600")}>
                                    ₹{Math.abs(l.currentBalance).toFixed(2)}
                                  </span>
                                  <span className="text-[10px] font-black uppercase text-slate-400">
                                    {l.currentBalance >= 0 ? "Debit" : "Credit"}
                                  </span>
                               </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {ledgers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-20 text-slate-400 italic">No ledgers found in the selected period.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                 </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="groups" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden self-start">
               <CardHeader className="bg-slate-900 text-white p-6">
                  <CardTitle className="text-lg font-black flex items-center gap-2">
                    <FolderTree className="w-5 h-5 text-primary" /> Create Group
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Group Name</label>
                    <Input 
                      placeholder="e.g. Indirect Expenses" 
                      className="h-12 rounded-xl border-slate-200 font-bold"
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nature</label>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Select value={groupNature} onValueChange={(v: any) => setGroupNature(v)}>

                      <SelectTrigger className="h-12 rounded-xl border-slate-200 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Asset" className="font-bold">Asset</SelectItem>
                        <SelectItem value="Liability" className="font-bold">Liability</SelectItem>
                        <SelectItem value="Income" className="font-bold">Income</SelectItem>
                        <SelectItem value="Expense" className="font-bold">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full h-12 rounded-xl font-black text-lg mt-4"
                    onClick={handleAddGroup}
                    disabled={loading}
                  >
                    Add Group
                  </Button>
                </CardContent>
             </Card>

             <Card className="lg:col-span-2 shadow-xl border-0 rounded-3xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-400">Group Name</TableHead>
                      <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-400">Nature</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="font-black text-slate-700">{g.name}</TableCell>
                        <TableCell>
                           <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest", 
                              g.nature === 'Asset' ? "bg-emerald-100 text-emerald-600" :
                              g.nature === 'Liability' ? "bg-red-100 text-red-600" :
                              g.nature === 'Income' ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                           )}>
                              {g.nature}
                           </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
