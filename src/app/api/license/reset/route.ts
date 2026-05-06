import { NextResponse } from 'next/server';
import { hash } from '@/lib/security/crypto';

// In a real system, these would be stored in a secure DB
const MASTER_EMAIL = 'admin@vellammal.com';
const MASTER_PASSWORD_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'; // 'admin123' hashed

export async function POST(req: Request) {
    try {
        const { email, password, licenseKey, newDeviceId } = await req.json();

        // Verify master credentials
        if (email !== MASTER_EMAIL || hash(password) !== MASTER_PASSWORD_HASH) {
            return NextResponse.json({ error: 'Unauthorized: Invalid master credentials' }, { status: 401 });
        }

        // Logic to re-bind license to new device would go here
        // For simulation, we just return success
        
        return NextResponse.json({ 
            success: true, 
            message: 'License reset and bound to new device successfully',
            licenseData: {
                licenseKey,
                deviceId: newDeviceId,
                ownerEmail: email,
                status: 'ACTIVE',
                issuedAt: Date.now()
            }
        });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
