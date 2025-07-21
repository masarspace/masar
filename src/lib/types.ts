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
  id: string;
  items: OrderItem[];
  status: 'Pending' | 'Completed' | 'Cancelled';
  createdAt: string; // ISO string
};
