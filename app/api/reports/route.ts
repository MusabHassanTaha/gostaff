import { NextResponse } from 'next/server';
import { readData } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const query = searchParams.get('query') || '';

    if (!view) {
      return NextResponse.json({ success: false, error: 'View parameter is required' }, { status: 400 });
    }

    const data = readData();
    let result: any = {};

    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date(8640000000000000);
    if (endDate) end.setHours(23, 59, 59, 999);

    switch (view) {
      case 'projects':
        // Return all workers for project report, ignoring date filter (which was filtering by hireDate incorrectly)
        // The user wants to see current project status, not just new hires.
        result.workers = (data.workers || []);
        result.sites = data.sites || [];
        break;

      case 'leave':
        // Filter workers who have leave history within range
        result.workers = (data.workers || []).map((w: any) => {
          const filteredLeave = (w.leaveHistory || []).filter((l: any) => {
            if (!startDate && !endDate) return true;
            const lStart = new Date(l.startDate);
            const lEnd = new Date(l.endDate);
            // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
            return lStart <= end && lEnd >= start;
          });
          
          // Also check absence history
          const filteredAbsence = (w.absenceHistory || []).filter((a: any) => {
             if (!startDate && !endDate) return true;
             const aDate = new Date(a.date);
             return aDate >= start && aDate <= end;
          });

          if (filteredLeave.length > 0 || filteredAbsence.length > 0) {
            return { ...w, leaveHistory: filteredLeave, absenceHistory: filteredAbsence };
          }
          return null;
        }).filter(Boolean);
        break;

      case 'drivers':
        // Filter drivers (workers) and vehicles by maintenance date
        // Return ALL drivers if no date filter, otherwise filter by maintenance
        
        // 1. Get all drivers
        const allDrivers = (data.workers || []).filter((w: any) => w.skill === 'Driver' || w.skill === 'سائق');
        
        if (!startDate && !endDate) {
             result.workers = allDrivers;
             result.vehicles = data.vehicles || [];
             result.sites = data.sites || [];
        } else {
            // 2. Filter vehicles that have maintenance OR violations in range
            const relevantVehicles = (data.vehicles || []).map((v: any) => {
                const filteredMaintenance = (v.maintenanceHistory || []).filter((m: any) => {
                    const mDate = new Date(m.date);
                    return mDate >= start && mDate <= end;
                });

                const filteredViolations = (v.violations || []).filter((vio: any) => {
                    const vDate = new Date(vio.date);
                    return vDate >= start && vDate <= end;
                });

                if (filteredMaintenance.length > 0 || filteredViolations.length > 0) {
                    return { 
                        ...v, 
                        maintenanceHistory: filteredMaintenance,
                        violations: filteredViolations 
                    };
                }
                
                // If we strictly want only vehicles with activity in this range:
                return null;
            }).filter(Boolean);

            // 3. Filter drivers who drive these vehicles
            const relevantPlateNumbers = new Set(relevantVehicles.map((v: any) => v.plateNumber));
            result.workers = allDrivers.filter((d: any) => relevantPlateNumbers.has(d.driverCarPlate));
            result.vehicles = relevantVehicles;
            result.sites = data.sites || []; // Sites are needed for stats
        }
        break;

      case 'vehicles':
         // Similar to drivers but focused on vehicles
         if (!startDate && !endDate) {
            result.vehicles = data.vehicles || [];
         } else {
            result.vehicles = (data.vehicles || []).map((v: any) => {
                const filteredMaintenance = (v.maintenanceHistory || []).filter((m: any) => {
                    const mDate = new Date(m.date);
                    return mDate >= start && mDate <= end;
                });
                // Also check trips/usage if applicable?
                // For now just maintenance as per previous pattern
                if (filteredMaintenance.length > 0) {
                    return { ...v, maintenanceHistory: filteredMaintenance };
                }
                return null;
            }).filter(Boolean);
         }
         break;

       case 'violations':
          // Filter violations on vehicles
          result.vehicles = (data.vehicles || []).map((v: any) => {
              if (!v.violations || v.violations.length === 0) return null;
              const filtered = v.violations.filter((vio: any) => {
                  const vDate = new Date(vio.date);
                  return vDate >= start && vDate <= end;
              });
              if (filtered.length > 0) return { ...v, violations: filtered };
              return null; // or return vehicle with empty violations if we want to show it? usually report shows only violations.
          }).filter(Boolean);
          break;

       case 'maintenance':
           // Specific maintenance view if exists
            result.vehicles = (data.vehicles || []).map((v: any) => {
                const filteredMaintenance = (v.maintenanceHistory || []).filter((m: any) => {
                    const mDate = new Date(m.date);
                    return mDate >= start && mDate <= end;
                });
                if (filteredMaintenance.length > 0) {
                    return { ...v, maintenanceHistory: filteredMaintenance };
                }
                return null;
            }).filter(Boolean);
           break;
           
      default:
        // Default to returning everything if view not recognized (or handle error)
        // Better to return empty to avoid massive payload
        break;
    }

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error('Reports API error:', e);
    return NextResponse.json({ success: false, error: 'Reports fetch failed' }, { status: 500 });
  }
}
