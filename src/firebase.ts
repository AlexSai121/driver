// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase only if config is provided
const isConfigured = !!firebaseConfig.apiKey;
const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const auth = isConfigured && app ? getAuth(app) : null;
export const db = isConfigured && app ? getFirestore(app) : null;

// Helper to warn user if missing config
if (!isConfigured) {
      console.warn("Firebase is not configured. Falling back to local state. Please add your credentials to .env.local");
}
