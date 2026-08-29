import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { collection, onSnapshot, addDoc, Timestamp, type DocumentData } from "firebase/firestore";
import { db } from "../services/firebase";
import { firestoreOnError } from "../hooks/useFirestoreSubscription";

type Warehouse = { id: string } & Record<string, unknown>;

type WarehouseValue = {
  warehouses: Warehouse[];
  currentWarehouse: Warehouse | null;
  setCurrentWarehouse: Dispatch<SetStateAction<Warehouse | null>>;
  addWarehouse: (name: string, location?: string) => Promise<string>;
};

const WarehouseContext = createContext<WarehouseValue>({
  warehouses: [],
  currentWarehouse: null,
  setCurrentWarehouse: () => {},
  addWarehouse: async () => ""
});

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [currentWarehouse, setCurrentWarehouse] = useState<Warehouse | null>(null);
  // Mirror the current value into a ref so the subscription callback
  // can read the latest without re-subscribing on every change. The
  // mirror lives in an effect (rather than inline during render) to
  // satisfy the `react-hooks/refs` rule that forbids ref access
  // during render.
  const currentRef = useRef(currentWarehouse);
  useEffect(() => {
    currentRef.current = currentWarehouse;
  }, [currentWarehouse]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "warehouses"),
      (snapshot) => {
        const data: Warehouse[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }));
        setWarehouses(data);
        // Promote the first warehouse only when none is selected. Reading
        // the ref (not state) keeps the snapshot handler stable.
        if (data.length > 0 && !currentRef.current) {
          setCurrentWarehouse(data[0]);
        }
      },
      (err) => firestoreOnError('WarehouseContext', err)
    );
    return () => { unsubscribe(); };
  }, []);

  const addWarehouse = async (name: string, location = "") => {
    const docRef = await addDoc(collection(db, "warehouses"), {
      name,
      location,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  };

  return (
    <WarehouseContext.Provider value={{ warehouses, currentWarehouse, setCurrentWarehouse, addWarehouse }}>
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  return useContext(WarehouseContext);
}
