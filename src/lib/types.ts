export type Material = {
  id: string;
  name: string;
  stock: number;
  unit: 'kg' | 'g' | 'l' | 'ml' | 'piece';
  lowStockThreshold: number;
};

export type DrinkRecipeItem = {
  materialId: string;
  quantity: number;
  unit: Material['unit'];
};

export type Drink = {
  id: string;
  name: string;
  price: number;
  recipe: DrinkRecipeItem[];
};

export type OrderItem = {
  drinkId: string;
  quantity: number;
};

export type Order = {
  id:string;
  items: OrderItem[];
  status: 'Pending' | 'Completed' | 'Cancelled';
  createdAt: string; // ISO string
};

export type PurchaseCategory = {
  id: string;
  name: string;
  description: string;
};

export type PurchaseOrderItem = {
  materialId: string;
  quantity: number;
  unit: Material['unit'];
  price: number; // Price per unit
  note?: string;
};

export type PurchaseOrder = {
  id: string;
  items: PurchaseOrderItem[];
  status: 'Pending' | 'Approved' | 'Completed' | 'Cancelled';
  category: {
    id: string;
    name: string;
  };
  location: string;
  createdAt: string; // ISO string
  receivedAt?: string; // ISO string
  receiptImageUrl?: string;
};

export type AuditLogEntry = {
    id: string;
    materialId: string;
    materialName: string;
    change: number;
    type: 'purchase' | 'sale' | 'adjustment';
    relatedId: string; // POS Order ID or Purchase Order ID
    createdAt: string; // ISO string
};

export type InventoryCountItem = {
    materialId: string;
    materialName: string;
    unit: Material['unit'];
    countedStock: number;
    systemStock: number;
    wastage: number;
};

export type InventoryCount = {
    id: string;
    date: string; // ISO string
    items: InventoryCountItem[];
};

export type Client = {
    id: string;
    name: string;
    phoneNumber?: string;
};

export type Location = {
    id: string;
    name: string;
};

export type Room = {
    id: string;
    name: string;
    price: number;
    discount?: number;
    locationId: string;
    locationName: string;
};

export type Contract = {
    id: string;
    name: string;
    type: 'short' | 'long';
    period: 3 | 6 | 12;
};

export type Reservation = {
    id: string;
    clientId: string;
    clientName: string;
    roomId: string;
    roomName: string;
    roomPrice: number;
    roomDiscount: number;
    startAt: string; // ISO string
    endAt: string | null; // ISO string
    status: 'Active' | 'Completed';
    totalCost: number | null;
};