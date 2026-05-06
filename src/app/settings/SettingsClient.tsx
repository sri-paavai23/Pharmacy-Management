"use client";

import { useState } from "react";
import { vendor, doctor, user, financialyear } from "@prisma/client";

import { addVendor, deleteVendor, addDoctor, deleteDoctor, addUser, deleteUser, addFinancialYear, toggleFinancialYearStatus } from "./actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Key, Stethoscope, Trash2, Users, CalendarDays, Lock, Unlock, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";


export function SettingsClient({ initialVendors, initialDoctors, initialUsers, initialFYs }: { 
  initialVendors: vendor[], 
  initialDoctors: doctor[], 
  initialUsers: user[],
  initialFYs: financialyear[]
}) {
  const [activeTab, setActiveTab] = useState<"vendors" | "doctors" | "users" | "fy">("vendors");

  const [loading, setLoading] = useState(false);

  // Forms State
  const [vendorForm, setVendorForm] = useState({ companyName: "", contactPerson: "", phone: "", gstin: "" });
  const [doctorForm, setDoctorForm] = useState({ name: "", registrationNumber: "", phone: "" });
  const [userForm, setUserForm] = useState({ name: "", pinCode: "", role: "CASHIER" });
  const [fyForm, setFyForm] = useState({ name: "", startDate: "", endDate: "" });

  const handleAddFY = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addFinancialYear(fyForm);
      setFyForm({ name: "", startDate: "", endDate: "" });
    } catch { alert("Error adding FY"); }
    finally { setLoading(false); }
  };

  const handleToggleFY = async (id: string, field: 'isActive' | 'isClosed', value: boolean) => {
     setLoading(true);
     try {
       await toggleFinancialYearStatus(id, field, value);
     } catch { alert("Error updating status"); }
     finally { setLoading(false); }
  };

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addVendor(vendorForm);
      setVendorForm({ companyName: "", contactPerson: "", phone: "", gstin: "" });
    } catch { alert("Error adding vendor"); }

    finally { setLoading(false); }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoctor(doctorForm);
      setDoctorForm({ name: "", registrationNumber: "", phone: "" });
    } catch { alert("Error adding doctor"); }

    finally { setLoading(false); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userForm.pinCode.length !== 4) { alert("PIN must be 4 digits"); setLoading(false); return; }
    setLoading(true);
    try {
      await addUser(userForm);
      setUserForm({ name: "", pinCode: "", role: "CASHIER" });
    } catch { alert("Error adding user"); }

    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-1 bg-slate-100 p-1.5 rounded-2xl w-fit border shadow-sm">
        <button onClick={() => setActiveTab("vendors")} className={cn("px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2", activeTab === "vendors" ? "bg-white text-primary shadow-md" : "text-slate-500 hover:text-slate-900")}>
          <Building2 className="w-4 h-4"/> Vendors
        </button>
        <button onClick={() => setActiveTab("doctors")} className={cn("px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2", activeTab === "doctors" ? "bg-white text-primary shadow-md" : "text-slate-500 hover:text-slate-900")}>
          <Stethoscope className="w-4 h-4"/> Doctors
        </button>
        <button onClick={() => setActiveTab("users")} className={cn("px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2", activeTab === "users" ? "bg-white text-primary shadow-md" : "text-slate-500 hover:text-slate-900")}>
          <Users className="w-4 h-4"/> Staff Access
        </button>
        <button onClick={() => setActiveTab("fy")} className={cn("px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2", activeTab === "fy" ? "bg-white text-primary shadow-md" : "text-slate-500 hover:text-slate-900")}>
          <CalendarDays className="w-4 h-4"/> Financial Systems
        </button>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Management Form */}
        <div className="lg:col-span-1 bg-white p-8 rounded-3xl border shadow-xl h-fit sticky top-8">
          {activeTab === "vendors" && (
            <form onSubmit={handleAddVendor} className="space-y-6">
               <h3 className="text-xl font-extrabold text-slate-800 border-b pb-4">Add New Vendor</h3>
               <div className="space-y-4">
                  <div className="space-y-2"><Label>Company Name</Label><Input required value={vendorForm.companyName} onChange={e => setVendorForm({...vendorForm, companyName: e.target.value})} /></div>
                  <div className="space-y-2"><Label>GSTIN</Label><Input required placeholder="22AAAAA0000A1Z5" className="font-mono uppercase" value={vendorForm.gstin} onChange={e => setVendorForm({...vendorForm, gstin: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Contact Person</Label><Input required value={vendorForm.contactPerson} onChange={e => setVendorForm({...vendorForm, contactPerson: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input required type="tel" value={vendorForm.phone} onChange={e => setVendorForm({...vendorForm, phone: e.target.value})} /></div>
               </div>
               <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-bold rounded-xl mt-4 shadow-lg shadow-primary/20">Register Vendor</Button>
            </form>
          )}

          {activeTab === "doctors" && (
            <form onSubmit={handleAddDoctor} className="space-y-6">
               <h3 className="text-xl font-extrabold text-slate-800 border-b pb-4">Add Registrar Doctor</h3>
               <div className="space-y-4">
                  <div className="space-y-2"><Label>Doctor Name</Label><Input required placeholder="Dr. " value={doctorForm.name} onChange={e => setDoctorForm({...doctorForm, name: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Reg. Number</Label><Input required placeholder="MC-12345" className="font-mono" value={doctorForm.registrationNumber} onChange={e => setDoctorForm({...doctorForm, registrationNumber: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Phone (Optional)</Label><Input type="tel" value={doctorForm.phone} onChange={e => setDoctorForm({...doctorForm, phone: e.target.value})} /></div>
               </div>
               <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-bold rounded-xl mt-4 shadow-lg shadow-primary/20">Add to Medical Registry</Button>
            </form>
          )}

          {activeTab === "users" && (
            <form onSubmit={handleAddUser} className="space-y-6">
               <h3 className="text-xl font-extrabold text-slate-800 border-b pb-4">Create Staff PIN</h3>
               <div className="space-y-4">
                  <div className="space-y-2"><Label>Staff Name</Label><Input required value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} /></div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={userForm.role} onValueChange={(v) => setUserForm({...userForm, role: v || "CASHIER"})}>

                      <SelectTrigger className="h-12 border-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Administrator (Full Access)</SelectItem>
                        <SelectItem value="CASHIER">Cashier (POS & Sales Only)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-500" /> Security PIN (4 Digits)
                    </Label>
                    <Input required maxLength={4} placeholder="0000" className="h-12 text-center text-3xl font-black tracking-widest border-slate-300" value={userForm.pinCode} onChange={e => setUserForm({...userForm, pinCode: e.target.value})} />
                  </div>
               </div>
               <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-bold rounded-xl mt-4 shadow-lg shadow-primary/20">Activate Staff Account</Button>
            </form>
          )}
          {activeTab === "fy" && (
            <form onSubmit={handleAddFY} className="space-y-6">
               <h3 className="text-xl font-extrabold text-slate-800 border-b pb-4 text-primary flex items-center gap-2 italic uppercase">
                 <Lock className="w-5 h-5"/> Initialize Year
               </h3>
               <div className="space-y-4">
                  <div className="space-y-2"><Label>Period Name</Label><Input required placeholder="2026-2027" value={fyForm.name} onChange={e => setFyForm({...fyForm, name: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Start Date</Label><Input required type="date" value={fyForm.startDate} onChange={e => setFyForm({...fyForm, startDate: e.target.value})} /></div>
                  <div className="space-y-2"><Label>End Date</Label><Input required type="date" value={fyForm.endDate} onChange={e => setFyForm({...fyForm, endDate: e.target.value})} /></div>
               </div>
               <Button type="submit" disabled={loading} className="w-full h-12 text-lg font-bold rounded-xl mt-4 bg-primary">Create Financial Period</Button>
            </form>
          )}
        </div>

        {/* List View */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
             <Table>
               <TableHeader className="bg-slate-50/50 h-14">
                 <TableRow>
                   {activeTab === 'fy' ? (
                      <>
                        <TableHead className="pl-8 font-bold text-slate-800">Financial Period</TableHead>
                        <TableHead className="font-bold text-slate-800">Status</TableHead>
                        <TableHead className="text-right pr-8">Operations</TableHead>
                      </>
                   ) : activeTab === 'users' ? (

                     <>
                       <TableHead className="pl-8 font-bold text-slate-800">Staff Identity</TableHead>
                       <TableHead className="font-bold text-slate-800">Role</TableHead>
                       <TableHead className="text-right pr-8">Actions</TableHead>
                     </>
                   ) : activeTab === 'doctors' ? (
                     <>
                       <TableHead className="pl-8 font-bold text-slate-800">Doctor Profile</TableHead>
                       <TableHead className="font-bold text-slate-800">Medical Reg No.</TableHead>
                       <TableHead className="text-right pr-8">Actions</TableHead>
                     </>
                   ) : (
                     <>
                       <TableHead className="pl-8 font-bold text-slate-800">Company / Entity</TableHead>
                       <TableHead className="font-bold text-slate-800">GSTIN</TableHead>
                       <TableHead className="text-right pr-8">Actions</TableHead>
                     </>
                   )}
                 </TableRow>
               </TableHeader>
               <TableBody>
                  {activeTab === 'fy' && initialFYs.map(fy => (
                    <TableRow key={fy.id} className="h-20 hover:bg-slate-50 transition-colors">
                      <TableCell className="pl-8">
                        <div className="font-extrabold text-slate-900">{fy.name}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">{new Date(fy.startDate).toLocaleDateString()} to {new Date(fy.endDate).toLocaleDateString()}</div>
                      </TableCell>
                      <TableCell>
                         <div className="flex gap-2">
                            {fy.isActive ? (
                               <Badge className="bg-emerald-500 text-white border-0"><Check className="w-3 h-3 mr-1"/> ACTIVE</Badge>
                            ) : (
                               <Badge variant="outline" className="cursor-pointer hover:bg-emerald-50" onClick={() => handleToggleFY(fy.id, 'isActive', true)}>SET ACTIVE</Badge>
                            )}
                            {fy.isClosed && <Badge variant="destructive" className="bg-slate-900"><Lock className="w-3 h-3 mr-1"/> CLOSED</Badge>}
                         </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        {!fy.isClosed ? (
                           <Button variant="outline" size="sm" className="text-red-600 border-red-100 hover:bg-red-50 font-bold" onClick={() => handleToggleFY(fy.id, 'isClosed', true)}>
                              <Lock className="w-4 h-4 mr-2"/> CLOSE YEAR
                           </Button>
                        ) : (
                           <Button variant="ghost" size="sm" className="text-slate-400 font-bold" onClick={() => handleToggleFY(fy.id, 'isClosed', false)}>
                              <Unlock className="w-4 h-4 mr-2"/> REOPEN
                           </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                 {activeTab === 'vendors' && initialVendors.map(v => (
                   <TableRow key={v.id} className="h-20 hover:bg-slate-50 transition-colors">
                     <TableCell className="pl-8">
                       <div className="font-extrabold text-slate-900">{v.companyName}</div>
                       <div className="text-xs text-slate-500 font-medium">{v.contactPerson} • {v.phone}</div>
                     </TableCell>
                     <TableCell className="font-mono font-bold text-primary">{v.gstin}</TableCell>
                     <TableCell className="text-right pr-8">
                       <Button variant="ghost" size="icon" className="text-slate-300 hover:text-red-500" onClick={() => deleteVendor(v.id)}><Trash2 className="w-5 h-5"/></Button>
                     </TableCell>
                   </TableRow>
                 ))}

                 {activeTab === 'doctors' && initialDoctors.map(d => (
                   <TableRow key={d.id} className="h-20 hover:bg-slate-50 transition-colors">
                     <TableCell className="pl-8">
                       <div className="font-extrabold text-slate-900">{d.name}</div>
                       <div className="text-xs text-slate-500 font-medium">{d.phone || 'No phone provided'}</div>
                     </TableCell>
                     <TableCell className="font-mono font-bold text-primary">{d.registrationNumber}</TableCell>
                     <TableCell className="text-right pr-8">
                       <Button variant="ghost" size="icon" className="text-slate-300 hover:text-red-500" onClick={() => deleteDoctor(d.id)}><Trash2 className="w-5 h-5"/></Button>
                     </TableCell>
                   </TableRow>
                 ))}

                 {activeTab === 'users' && initialUsers.map(u => (
                   <TableRow key={u.id} className="h-20 hover:bg-slate-50 transition-colors">
                     <TableCell className="pl-8">
                       <div className="font-extrabold text-slate-900">{u.name}</div>
                       <div className="flex items-center gap-1.5 mt-1">
                          <div className={cn("w-2 h-2 rounded-full", u.isActive ? "bg-emerald-500" : "bg-red-500")} />
                          <span className="text-[10px] uppercase font-bold text-slate-400">System PIN: ****</span>
                       </div>
                     </TableCell>
                     <TableCell>
                        <Badge variant="outline" className={cn("font-bold text-[10px]", u.role === 'ADMIN' ? 'bg-primary/5 text-primary border-primary/20' : 'bg-slate-50 text-slate-600')}>{u.role}</Badge>
                     </TableCell>
                     <TableCell className="text-right pr-8">
                       <Button variant="ghost" size="icon" className="text-slate-300 hover:text-red-500" onClick={() => deleteUser(u.id)}><Trash2 className="w-5 h-5"/></Button>
                     </TableCell>
                   </TableRow>
                 ))}

                 {((activeTab === 'vendors' && initialVendors.length === 0) || (activeTab === 'doctors' && initialDoctors.length === 0) || (activeTab === 'users' && initialUsers.length === 0)) && (
                   <TableRow>
                     <TableCell colSpan={3} className="text-center py-20 text-slate-400 border-none">
                       Registry is currently empty.
                     </TableCell>
                   </TableRow>
                 )}
               </TableBody>
             </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
