import { createContext, useContext, useEffect, useRef, useState } from "react";
import { collection, onSnapshot, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../services/firebase";

const WarehouseContext = createContext({
  warehouses: [],
  currentWarehouse: null,
  setCurrentWarehouse: () => {},
  addWarehouse: async () => {}
});

export function WarehouseProvider({ children }) {
  const [warehouses, setWarehouses] = useState([]);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
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
    const unsubscribe = onSnapshot(collection(db, "warehouses"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setWarehouses(data);
      // Promote the first warehouse only when none is selected. Reading
      // the ref (not state) keeps the snapshot handler stable.
      if (data.length > 0 && !currentRef.current) {
        setCurrentWarehouse(data[0]);
      }
    });
    return () => unsubscribe();
  }, []);

  const addWarehouse = async (name, location = "") => {
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
