import { NextResponse } from 'next/server';
import { saveLicenseLocally } from '@/lib/security/license';

export async function POST(req: Request) {
    try {
        const licenseData = await req.json();
        
        // Save to hidden local storage
        saveLicenseLocally(licenseData);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save license locally:', error);
        return NextResponse.json({ error: 'Failed to persist license' }, { status: 500 });
    }
}
