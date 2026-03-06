import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDr6O1zSOLXK83EfpykWLhie0Ia0Bdg2Ig",
  authDomain: "heat-map-76125.firebaseapp.com",
  databaseURL: "https://heat-map-76125-default-rtdb.firebaseio.com",
  projectId: "heat-map-76125",
  storageBucket: "heat-map-76125.firebasestorage.app",
  messagingSenderId: "358564471566",
  appId: "1:358564471566:web:fd418d6a9ce1c6b8f3ad5f",
  measurementId: "G-1Z808C9QP6",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);