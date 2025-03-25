// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_apiKey,
  authDomain: "returngame-bc1f8.firebaseapp.com",
  projectId: "returngame-bc1f8",
  storageBucket: "returngame-bc1f8.firebasestorage.app",
  messagingSenderId: "775439158642",
  appId: "1:775439158642:web:e95fd1a903f5ed4951a1eb",
  measurementId: "G-CX35H1PTH3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);