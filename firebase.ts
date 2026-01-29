
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCEfWJS7xMWPvD68KDe67DXAeTxRZTl6Gw",
  authDomain: "bizchat-b9e50.firebaseapp.com",
  projectId: "bizchat-b9e50",
  storageBucket: "bizchat-b9e50.firebasestorage.app",
  messagingSenderId: "21416762266",
  appId: "1:21416762266:web:dd6f617e531c9b3b46f823",
  measurementId: "G-GZ3HQF53F2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// Analytics is optional and only works in certain environments
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.log("Analytics not supported");
}

export { analytics };
