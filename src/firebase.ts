import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB2lBexCJba0Tp02aiZmw8o0IYAnxsoCf8",
  authDomain: "cashflow-e8354.firebaseapp.com",
  databaseURL: "https://cashflow-e8354-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "cashflow-e8354",
  storageBucket: "cashflow-e8354.firebasestorage.app",
  messagingSenderId: "9681774230",
  appId: "1:9681774230:web:bf9e69286047f5f8d744b7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
export const database = getDatabase(app);
