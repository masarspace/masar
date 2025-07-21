import type { Material, Drink, Order } from './types';

export const materials: Material[] = [
  { id: 'mat-1', name: 'Coffee Beans', stock: 10, unit: 'kg', lowStockThreshold: 2 },
  { id: 'mat-2', name: 'Milk', stock: 20, unit: 'l', lowStockThreshold: 5 },
  { id: 'mat-3', name: 'Sugar', stock: 5, unit: 'kg', lowStockThreshold: 1 },
  { id: 'mat-4', name: 'Oranges', stock: 50, unit: 'piece', lowStockThreshold: 10 },
  { id: 'mat-5', name: 'Lemons', stock: 30, unit: 'piece', lowStockThreshold: 10 },
  { id: 'mat-6', name: 'Mint Leaves', stock: 1, unit: 'kg', lowStockThreshold: 0.2 },
  { id: 'mat-7', name: 'Water', stock: 100, unit: 'l', lowStockThreshold: 20 },
  { id: 'mat-8', name: 'Chocolate Syrup', stock: 3, unit: 'l', lowStockThreshold: 1 },
];

export const drinks: Drink[] = [
  {
    id: 'drink-1',
    name: 'Espresso',
    price: 2.5,
    recipe: [
      { materialId: 'mat-1', quantity: 0.02 }, // 20g
    ],
  },
  {
    id: 'drink-2',
    name: 'Latte',
    price: 3.5,
    recipe: [
      { materialId: 'mat-1', quantity: 0.02 },
      { materialId: 'mat-2', quantity: 0.25 }, // 250ml
    ],
  },
  {
    id: 'drink-3',
    name: 'Orange Juice',
    price: 4.0,
    recipe: [{ materialId: 'mat-4', quantity: 3 }],
  },
  {
    id: 'drink-4',
    name: 'Lemonade',
    price: 3.0,
    recipe: [
      { materialId: 'mat-5', quantity: 1 },
      { materialId: 'mat-3', quantity: 0.02 },
      { materialId: 'mat-7', quantity: 0.3 },
    ],
  },
];

export const orders: Order[] = [
  {
    id: 'order-1',
    items: [{ drinkId: 'drink-2', quantity: 2 }, { drinkId: 'drink-3', quantity: 1 }],
    status: 'Completed',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'order-2',
    items: [{ drinkId: 'drink-1', quantity: 1 }],
    status: 'Completed',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'order-3',
    items: [{ drinkId: 'drink-4', quantity: 3 }],
    status: 'Pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'order-4',
    items: [{ drinkId: 'drink-2', quantity: 1 }, { drinkId: 'drink-1', quantity: 1 }],
    status: 'Pending',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'order-5',
    items: [{ drinkId: 'drink-3', quantity: 2 }],
    status: 'Cancelled',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
