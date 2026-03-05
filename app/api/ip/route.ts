import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

export async function GET() {
  const os = await import('os');
  const interfaces = os.networkInterfaces();
  let ip = '127.0.0.1';

  // Try to find a suitable IP address
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      // Skip internal (i.e. 127.0.0.1) and non-ipv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        // Prefer 192.168.x.x addresses as they are common for local networks
        if (iface.address.startsWith('192.168.')) {
            return NextResponse.json({ ip: iface.address });
        }
        // Keep the first external IPv4 found if no 192.168.x.x is found yet
        if (ip === '127.0.0.1') {
            ip = iface.address;
        }
      }
    }
  }

  return NextResponse.json({ ip });
}
