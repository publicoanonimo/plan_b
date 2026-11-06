import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;

// Firebase web configuration is public. Vercel variables can override these values.
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyB0lUiQVW1iATVVIpZ78DORgx3AoAFe-40',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'bdplan-b.firebaseapp.com',
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || 'https://bdplan-b-default-rtdb.firebaseio.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'bdplan-b',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'bdplan-b.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '497076950409',
  appId: env.VITE_FIREBASE_APP_ID || '1:497076950409:web:9462dcbae869f9653cbd58',
};

// Local storage is available only when explicitly requested for development.
export const cloudEnabled = env.VITE_STORAGE_MODE !== 'local';
export const app = cloudEnabled ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
export const db = app ? getFirestore(app) : null;
