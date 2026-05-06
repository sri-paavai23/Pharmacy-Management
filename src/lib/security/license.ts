import os from 'os';
import fs from 'fs';
import path from 'path';
import { encrypt, decrypt, hash } from './crypto';
import { execSync } from 'child_process';

// Hidden path in user directory to survive app uninstalls (usually)
const HIDDEN_DIR = path.join(os.homedir(), '.vellammal-pharmacy');
const LICENSE_FILE = path.join(HIDDEN_DIR, 'license.dat');

export interface LicenseData {
    licenseKey: string;
    deviceId: string;
    ownerEmail: string;
    issuedAt: number;
    expiresAt?: number;
    status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

export async function getDeviceId(): Promise<string> {
    const interfaces = os.networkInterfaces();
    let mac = '';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
            if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
                mac = iface.mac;
                break;
            }
        }
        if (mac) break;
    }
    
    const hostInfo = `${os.hostname()}-${os.platform()}-${os.arch()}-${mac}`;
    return hash(hostInfo);
}

export function saveLicenseLocally(data: LicenseData) {
    if (!fs.existsSync(HIDDEN_DIR)) {
        fs.mkdirSync(HIDDEN_DIR, { recursive: true });
    }
    const encrypted = encrypt(JSON.stringify(data));
    fs.writeFileSync(LICENSE_FILE, encrypted);
    
    // Also try to set file as hidden on Windows
    if (os.platform() === 'win32') {
        try {
            execSync(`attrib +h "${LICENSE_FILE}"`);
        } catch {
            // Ignore error if attrib fails
        }
    }
}

export function getLocalLicense(): LicenseData | null {
    if (!fs.existsSync(LICENSE_FILE)) return null;
    try {
        const encrypted = fs.readFileSync(LICENSE_FILE, 'utf8');
        const decrypted = decrypt(encrypted);
        return JSON.parse(decrypted);
    } catch (e) {
        console.error('Failed to read local license:', e);
        return null;
    }
}

export async function verifyWithServer(licenseKey: string, deviceId: string): Promise<LicenseData | null> {
    // In a real app, this would be a call to a remote server
    // For this implementation, we'll simulate it with a fetch to our own API
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/license/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseKey, deviceId }),
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.error('Server verification failed:', e);
    }
    return null;
}

export async function checkSystemIntegrity(): Promise<{ valid: boolean; reason?: string }> {
    const currentDeviceId = await getDeviceId();
    const localLicense = getLocalLicense();
    
    if (process.env.NODE_ENV === 'development') {
        return { valid: true };
    }

    if (!localLicense) {
        return { valid: false, reason: 'NO_LICENSE' };
    }
    
    if (localLicense.deviceId !== currentDeviceId) {
        return { valid: false, reason: 'DEVICE_MISMATCH' };
    }
    
    // Check server for source of truth
    const serverLicense = await verifyWithServer(localLicense.licenseKey, currentDeviceId);
    
    if (!serverLicense) {
        // Server offline or verification failed
        // For offline grace period, we could allow local validation, 
        // but requirements say "Do NOT allow direct access" if mismatch or missing traces.
        return { valid: false, reason: 'SERVER_VERIFICATION_FAILED' };
    }
    
    if (serverLicense.status !== 'ACTIVE') {
        return { valid: false, reason: 'LICENSE_REVOKED' };
    }
    
    return { valid: true };
}
