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
};
