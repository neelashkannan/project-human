import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDAHx3VVWU7mNS4ewB3vLxhK2uG8TjW4E8",
  authDomain: "protocrafts.firebaseapp.com",
  databaseURL: "https://protocrafts-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "protocrafts",
  storageBucket: "protocrafts.appspot.com",
  messagingSenderId: "290776297328",
  appId: "1:290776297328:web:79ae1c373847ccfa0469b5",
  measurementId: "G-0VLR0C753N",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
