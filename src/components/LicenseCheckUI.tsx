"use client";

import { useState } from "react";
import { ShieldAlert, Key, UserCheck, Loader2, Server, Smartphone } from "lucide-react";


interface Props {
    reason: string;
    deviceId: string;
}

export function LicenseCheckUI({ reason, deviceId }: Props) {
    const [step, setStep] = useState<'INITIAL' | 'VERIFYING_OWNER' | 'OTP' | 'SUCCESS'>('INITIAL');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [licenseKey, setLicenseKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleVerifyOwner = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/license/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, licenseKey, newDeviceId: deviceId }),
            });

            const data = await res.json();

            if (res.ok) {
                // Simulation: In a real app, send OTP to email/mobile
                console.log("OTP Sent to owner email");
                setStep('OTP');
            } else {
                setError(data.error || 'Verification failed');
            }
        } catch {
            setError('System error. Please contact support.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (otp !== '123456') { // Mock OTP
            setError('Invalid security code');
            setLoading(false);
            return;
        }

        try {
            // Finalize registration
            const res = await fetch('/api/license/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, licenseKey, newDeviceId: deviceId }),
            });
            
            const data = await res.json();
            
            if (res.ok) {
                await fetch('/api/license/save-local', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data.licenseData),
                });
                setStep('SUCCESS');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                setError(data.error || 'Finalization failed');
            }
        } catch {
            setError('Verification failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-6 overflow-hidden font-sans">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-red-600 rounded-full blur-[120px]" />
                <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-lg relative z-10">
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-3xl p-8 md:p-12 space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    
                    {step === 'INITIAL' && (
                        <div className="text-center space-y-6">
                            <div className="inline-flex p-5 rounded-3xl bg-red-500/20 ring-1 ring-red-500/30">
                                <ShieldAlert className="w-12 h-12 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black text-white uppercase tracking-tight italic">System Locked</h2>
                                <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">
                                    {reason === 'DEVICE_MISMATCH' ? 'Unauthorized Device Detected' : 
                                     reason === 'NO_LICENSE' ? 'License Verification Required' : 
                                     'Security Integrity Compromised'}
                                </p>
                            </div>
                            
                            <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 text-left space-y-2">
                                <div className="flex items-center gap-3 text-slate-300 text-xs font-bold uppercase">
                                    <Smartphone className="w-4 h-4 text-primary" />
                                    <span>Device ID: <span className="text-slate-500 ml-1 font-mono">{deviceId.slice(0, 16)}...</span></span>
                                </div>
                                <p className="text-slate-500 text-[10px] leading-relaxed">
                                    This terminal is not authorized to run Vellammal Pharmacy ERP. 
                                    Software uninstallation or hardware changes require owner verification.
                                </p>
                            </div>

                            <button 
                                onClick={() => setStep('VERIFYING_OWNER')}
                                className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-95"
                            >
                                Authenticate as Owner
                            </button>
                        </div>
                    )}

                    {step === 'VERIFYING_OWNER' && (
                        <form onSubmit={handleVerifyOwner} className="space-y-6">
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-black text-white uppercase italic">Owner Verification</h3>
                                <p className="text-slate-500 text-[10px] uppercase tracking-widest">Provide master credentials to unlock</p>
                            </div>

                            <div className="space-y-4">
                                <div className="relative group">
                                    <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                                    <input 
                                        type="email" 
                                        placeholder="OWNER EMAIL" 
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value.toLowerCase())}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm font-bold tracking-widest placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                    />
                                </div>
                                <div className="relative group">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                                    <input 
                                        type="password" 
                                        placeholder="MASTER PASSWORD" 
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm font-bold tracking-widest placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                    />
                                </div>
                                <div className="relative group">
                                    <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                                    <input 
                                        type="text" 
                                        placeholder="LICENSE KEY" 
                                        required
                                        value={licenseKey}
                                        onChange={e => setLicenseKey(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm font-bold tracking-widest placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-black text-center uppercase tracking-widest">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button 
                                    type="button"
                                    onClick={() => setStep('INITIAL')}
                                    className="flex-1 py-4 bg-white/5 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
                                >
                                    Back
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request Code'}
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 'OTP' && (
                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-black text-white uppercase italic">Security Code</h3>
                                <p className="text-slate-500 text-[10px] uppercase tracking-widest">Enter the 6-digit code sent to your device</p>
                            </div>

                            <div className="space-y-4">
                                <div className="relative group">
                                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                                    <input 
                                        type="text" 
                                        placeholder="VERIFICATION CODE (123456)" 
                                        required
                                        maxLength={6}
                                        value={otp}
                                        onChange={e => setOtp(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 text-center text-2xl font-black tracking-[0.5em] text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-black text-center uppercase tracking-widest">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button 
                                    type="button"
                                    onClick={() => setStep('VERIFYING_OWNER')}
                                    className="flex-1 py-4 bg-white/5 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm & Unlock'}
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 'SUCCESS' && (
                        <div className="text-center space-y-6 py-8">
                            <div className="inline-flex p-5 rounded-full bg-green-500/20 ring-1 ring-green-500/30 animate-bounce">
                                <ShieldAlert className="w-12 h-12 text-green-500" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black text-white uppercase italic">Verification Successful</h2>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">System Initializing...</p>
                            </div>
                        </div>
                    )}

                </div>
                
                <p className="mt-8 text-center text-slate-600 text-[9px] font-bold uppercase tracking-[0.2em] leading-relaxed">
                    Secure Licensing Subsystem • Managed by Hardware ID Protection<br/>
                    © 2024 Shree Velammal Pharmacy ERP • All Rights Reserved
                </p>
            </div>
        </div>
    );
}
