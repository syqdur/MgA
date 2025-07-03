// Test der Media Migration für die Galerie mauros-jga
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAnA6MbC7MfrzG2IHZ-RgNJmamBHLBaNPA",
  authDomain: "wedding-gallery-a7065.firebaseapp.com",
  projectId: "wedding-gallery-a7065",
  storageBucket: "wedding-gallery-a7065.firebasestorage.app",
  messagingSenderId: "102674733624",
  appId: "1:102674733624:web:df04e9c0e99f90a98db7fb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testMigrationAnalysis() {
  try {
    console.log('🔍 Testing migration analysis for gallery FtAE7tK233ny9vpbdOpS...');
    
    // Load media items
    const mediaQuery = query(collection(db, 'galleries', 'FtAE7tK233ny9vpbdOpS', 'media'));
    const mediaSnapshot = await getDocs(mediaQuery);
    
    let totalItems = 0;
    let base64Items = 0;
    let totalSize = 0;
    
    mediaSnapshot.forEach((doc) => {
      const data = doc.data();
      totalItems++;
      
      if (data.media && data.media.startsWith('data:')) {
        base64Items++;
        // Estimate size from base64 string
        const base64Size = data.media.length * 0.75; // Base64 is ~133% of original
        totalSize += base64Size;
        console.log(`📊 Base64 item found: ${doc.id} (${(base64Size / 1024 / 1024).toFixed(2)} MB)`);
      } else if (data.media) {
        console.log(`✅ Storage item: ${doc.id} (${data.media.substring(0, 50)}...)`);
      }
    });
    
    console.log(`\n📈 Migration Analysis Results:`);
    console.log(`📸 Total media items: ${totalItems}`);
    console.log(`💾 Base64 items: ${base64Items}`);
    console.log(`📊 Total Base64 size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`💡 Migration recommended: ${base64Items > 0 ? 'YES' : 'NO'}`);
    
    if (base64Items > 0) {
      const estimatedSavings = totalSize * 0.33; // ~33% savings
      console.log(`💰 Estimated savings: ${(estimatedSavings / 1024 / 1024).toFixed(2)} MB`);
    }
    
  } catch (error) {
    console.error('❌ Migration analysis failed:', error);
  }
}

testMigrationAnalysis();