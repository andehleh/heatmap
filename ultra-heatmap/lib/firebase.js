// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDr6O1zSOLXK83EfpykWLhie0Ia0Bdg2Ig",
  authDomain: "heat-map-76125.firebaseapp.com",
  databaseURL: "https://heat-map-76125-default-rtdb.firebaseio.com",
  projectId: "heat-map-76125",
  storageBucket: "heat-map-76125.firebasestorage.app",
  messagingSenderId: "358564471566",
  appId: "1:358564471566:web:fd418d6a9ce1c6b8f3ad5f",
  measurementId: "G-1Z808C9QP6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);