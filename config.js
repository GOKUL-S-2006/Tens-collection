// ============================================
// CONFIG — this is the only file you usually need to touch
// ============================================

// Your Firebase project (already filled in from what you shared)
const firebaseConfig = {
  apiKey: "AIzaSyDNFnFXfHnNCnkXMxvaDGaaoaJUo2VXWyU",
  authDomain: "ten-collection.firebaseapp.com",
  projectId: "ten-collection",
  storageBucket: "ten-collection.firebasestorage.app",
  messagingSenderId: "244626345368",
  appId: "1:244626345368:web:da6eb2c2420f498d462fed",
  measurementId: "G-Q5LEGSJZ1M"
};

// -------------------------------------------------
// CLOUDINARY — you MUST fill these two in, or image
// uploads on the "Sell" page will fail.
//
// 1. Go to cloudinary.com -> Dashboard -> copy your "Cloud name"
// 2. Go to Settings -> Upload -> "Upload presets" -> Add upload preset
//      - Signing mode: UNSIGNED
//      - Name it anything, e.g. "ten_collection_unsigned"
// 3. Paste both values below
// -------------------------------------------------
const CLOUDINARY_CLOUD_NAME = "uyabqwxi";
const CLOUDINARY_UPLOAD_PRESET = "ten_collection";