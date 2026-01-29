
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

/**
 * إعدادات Firebase.
 * ملاحظة: يفضل استخدام مفاتيح البيئة لحماية البيانات.
 */
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCEfWJS7xMWPvD68KDe67DXAeTxRZTl6Gw",
  authDomain: "bizchat-b9e50.firebaseapp.com",
  projectId: "bizchat-b9e50",
  storageBucket: "bizchat-b9e50.firebasestorage.app",
  messagingSenderId: "21416762266",
  appId: "1:21416762266:web:dd6f617e531c9b3b46f823",
  measurementId: "G-GZ3HQF53F2"
};

// تهيئة التطبيق مع معالجة الأخطاء
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

export const db = app ? getFirestore(app) : null;

// التحقق من دعم Analytics قبل التهيئة لتجنب أخطاء API Key في بعض البيئات
let analytics = null;
if (app) {
  isSupported().then(supported => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (e) {
        console.warn("Analytics initialization failed:", e);
      }
    }
  });
}

export { analytics };
