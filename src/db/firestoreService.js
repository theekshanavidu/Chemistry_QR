import { db } from "../config/firebase";
import {
  doc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  deleteDoc,
  addDoc
} from "firebase/firestore";

/**
 * Retrieve all classes in the purchase catalog.
 */
export const getClasses = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "classes"));
    const classes = [];
    querySnapshot.forEach((doc) => {
      classes.push({ id: doc.id, ...doc.data() });
    });
    return classes;
  } catch (error) {
    console.error("Error getting classes: ", error);
    throw error;
  }
};

/**
 * Find a student profile by their custom Student ID.
 */
export const getStudentByStudentId = async (studentId) => {
  try {
    const q = query(collection(db, "students"), where("studentId", "==", studentId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error finding student by ID:", error);
    throw error;
  }
};

/**
 * Retrieve all payments for a specific student.
 */
export const getStudentPayments = async (studentUid) => {
  try {
    const q = query(collection(db, "payments"), where("studentUid", "==", studentUid));
    const querySnapshot = await getDocs(q);
    const payments = [];
    querySnapshot.forEach((doc) => {
      payments.push({ id: doc.id, ...doc.data() });
    });
    return payments;
  } catch (error) {
    console.error("Error getting student payments: ", error);
    throw error;
  }
};

/**
 * Activate a class physically for a student.
 */
export const activateClassForStudent = async (studentUid, studentName, studentId, classId, classTitle, price) => {
  try {
    const q = query(
      collection(db, "payments"),
      where("studentUid", "==", studentUid),
      where("classId", "==", classId)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const payDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "payments", payDoc.id), {
        status: "approved",
        approvedAt: new Date().toISOString(),
        paymentType: "physical_activation"
      });
    } else {
      await addDoc(collection(db, "payments"), {
        studentUid,
        studentName,
        studentId,
        classId,
        classTitle,
        price: Number(price),
        status: "approved",
        paymentType: "physical_activation",
        submittedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        tuteRequired: true,
        deliveryStatus: "Pending"
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Error activating class for student:", error);
    throw error;
  }
};

/**
 * Deactivate a class for a student.
 */
export const deactivateClassForStudent = async (studentUid, classId) => {
  try {
    const q = query(
      collection(db, "payments"),
      where("studentUid", "==", studentUid),
      where("classId", "==", classId)
    );
    const querySnapshot = await getDocs(q);

    for (const docSnap of querySnapshot.docs) {
      await deleteDoc(doc(db, "payments", docSnap.id));
    }
    return { success: true };
  } catch (error) {
    console.error("Error deactivating class for student:", error);
    throw error;
  }
};
