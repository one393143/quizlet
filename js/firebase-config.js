// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCaTjSkPpHhUFUU_Nawr4JvDtD3q8UvlYw",
  authDomain: "quizlet-6f5b1.firebaseapp.com",
  projectId: "quizlet-6f5b1",
  storageBucket: "quizlet-6f5b1.firebasestorage.app",
  messagingSenderId: "144777459408",
  appId: "1:144777459408:web:0f2ac396baed6960b050d5",
  measurementId: "G-F58Z8TC5PQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
