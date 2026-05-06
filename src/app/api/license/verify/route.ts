import { NextResponse } from 'next/server';


// Simulation of a database of valid licenses
const MOCK_LICENSES: Record<string, { deviceId: string; status: 'ACTIVE' | 'REVOKED'; ownerEmail: string }> = {
    'VALID-KEY-123': {
        deviceId: '', // Empty means 'not yet bound' in this simulation
        status: 'ACTIVE',
        ownerEmail: 'admin@vellammal.com'
    }
};

export async function POST(req: Request) {
    try {
        const { licenseKey, deviceId } = await req.json();

        const license = MOCK_LICENSES[licenseKey];

        if (!license) {
            return NextResponse.json({ error: 'Invalid license key' }, { status: 404 });
        }

        if (license.deviceId !== deviceId && license.deviceId !== '') {
            return NextResponse.json({ error: 'License bound to another device' }, { status: 403 });
        }

        return NextResponse.json({
            licenseKey,
            deviceId,
            ownerEmail: license.ownerEmail,
            status: license.status,
            issuedAt: Date.now()
        });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
