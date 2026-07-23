import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'

// TODO: replace with your Firebase project config
// Firebase console → Project settings → General → Your apps → Web
// Make sure `databaseURL` is present — it's the field people miss.
const firebaseConfig = {
  apiKey: "AIzaSyCvqPbc-qYguSxzxsxJd4rK0qY6tjZmPOE",
  authDomain: "taco-fall.firebaseapp.com",
  databaseURL: "https://taco-fall-default-rtdb.firebaseio.com",
  projectId: "taco-fall",
  storageBucket: "taco-fall.firebasestorage.app",
  messagingSenderId: "262382009559",
  appId: "1:262382009559:web:ed3b168b2309da2d208492"
};

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
export const storage = getStorage(app)
