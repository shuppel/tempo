// Simple utility to clear session storage

const SESSION_PREFIX = 'session-';

function clearSessions() {
  try {
    console.log("Searching for session data in localStorage...");
    
    // Get all keys from localStorage
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SESSION_PREFIX)) {
        keys.push(key);
      }
    }
    
    if (keys.length === 0) {
      console.log("No session data found in localStorage.");
      return;
    }
    
    console.log(`Found ${keys.length} session items in localStorage:`);
    keys.forEach(key => console.log(`- ${key}`));
    
    // Remove all session keys
    keys.forEach(key => localStorage.removeItem(key));
    console.log(`✅ Successfully cleared ${keys.length} session items from localStorage.`);
  } catch (error) {
    console.error('Failed to clear sessions:', error);
  }
}

// Run the function to clear sessions
clearSessions();

console.log("\nTo use this utility:");
console.log("1. Open your browser's developer tools (F12 or Ctrl+Shift+I)");
console.log("2. Go to the Console tab");
console.log("3. Copy and paste this entire script and press Enter");
console.log("\nOr simply run: localStorage.clear() to clear all browser storage for this site."); 