import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBlLhk5NyeFjmdyHXOjLXw7SIl1KLUOQxo",
  authDomain: "sujith-chem.firebaseapp.com",
  projectId: "sujith-chem",
  storageBucket: "sujith-chem.firebasestorage.app",
  messagingSenderId: "254929740526",
  appId: "1:254929740526:web:6579267be190117a5d49ff",
  measurementId: "G-4B47KL8SHY"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
