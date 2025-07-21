import {
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from 'firebase/firestore';
import type { Material, Drink, Order } from './types';

export const materialConverter: FirestoreDataConverter<Material> = {
  toFirestore(material: Material): DocumentData {
    // Omit 'id' as it's the document ID
    const { id, ...data } = material;
    return data;
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): Material {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      name: data.name,
      stock: data.stock,
      unit: data.unit,
      lowStockThreshold: data.lowStockThreshold,
    };
  },
};

export const drinkConverter: FirestoreDataConverter<Drink> = {
  toFirestore(drink: Drink): DocumentData {
    const { id, ...data } = drink;
    return data;
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): Drink {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      name: data.name,
      price: data.price,
      recipe: data.recipe,
    };
  },
};

export const orderConverter: FirestoreDataConverter<Order> = {
  toFirestore(order: Order | Omit<Order, 'id'>): DocumentData {
    if ('id' in order) {
        const { id, ...data } = order;
        return data;
    }
    return order;
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): Order {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      items: data.items,
      status: data.status,
      createdAt: data.createdAt,
    };
  },
};
