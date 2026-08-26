export type ShipmentStatus = 'Booked' | 'In transit' | 'On hold' | 'Delivered' | 'Cancelled';

export interface Shipment {
  id: string;              // "SHP-10234"
  customer: string;
  origin: string;
  destination: string;
  status: ShipmentStatus;
  price: number;           // EUR, integer
  eta: string;             // "2026-09-14"
  customsHold: boolean;
  priority: boolean;
  version: number;
}

export interface AppState {
  shipments: Record<string, Shipment>;
}
