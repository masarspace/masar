import {
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  FieldValue,
  deleteField,
} from 'firebase/firestore';
import type { Material, Drink, Order, PurchaseCategory, PurchaseOrder, PurchaseOrderItem, AuditLogEntry, DrinkRecipeItem } from './types';

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
    // Ensure recipe items are plain objects
    data.recipe = data.recipe.map(item => ({...item}));
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
      recipe: data.recipe.map((item: any) => ({
        materialId: item.materialId,
        quantity: item.quantity,
        unit: item.unit,
      })),
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

export const purchaseCategoryConverter: FirestoreDataConverter<PurchaseCategory> = {
  toFirestore(category: PurchaseCategory): DocumentData {
    const { id, ...data } = category;
    return data;
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): PurchaseCategory {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      name: data.name,
      description: data.description,
    };
  },
};

export const purchaseOrderConverter: FirestoreDataConverter<PurchaseOrder> = {
  toFirestore(purchaseOrder: Omit<PurchaseOrder, 'id'> | PurchaseOrder): DocumentData {
    // We don't want to write the id field to the document
    const { id, ...data } = purchaseOrder as PurchaseOrder;

    const dataToSave: any = { ...data };

    // Sanitize items: ensure notes are strings and not undefined
    dataToSave.items = dataToSave.items.map((item: PurchaseOrderItem) => ({
        ...item,
        note: item.note || '',
    }));
    
    // Handle the case where receivedAt is explicitly set to undefined,
    // which happens when we use deleteField().
    if ('receivedAt' in dataToSave && dataToSave.receivedAt === undefined) {
      delete dataToSave.receivedAt;
    }
    
    return dataToSave;
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions
  ): PurchaseOrder {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      items: data.items.map((item: any) => ({
        ...item,
        note: item.note || '',
      })),
      status: data.status,
      category: data.category,
      location: data.location,
      createdAt: data.createdAt,
      receivedAt: data.receivedAt,
      receiptImageUrl: data.receiptImageUrl,
    };
  },
};


export const auditLogConverter: FirestoreDataConverter<AuditLogEntry> = {
    toFirestore(log: AuditLogEntry | Omit<AuditLogEntry, 'id'>): DocumentData {
        if ('id' in log) {
            const { id, ...data } = log;
            return data;
        }
        return log;
    },
    fromFirestore(
        snapshot: QueryDocumentSnapshot,
        options: SnapshotOptions
    ): AuditLogEntry {
        const data = snapshot.data(options);
        return {
            id: snapshot.id,
            materialId: data.materialId,
            materialName: data.materialName,
            change: data.change,
            type: data.type,
            relatedId: data.relatedId,
            createdAt: data.createdAt,
        };
    },
};
