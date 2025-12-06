// Man-in-the-Middle algorithm implementation

// Import necessary modules
import * as crypto from 'crypto';

// Define the function for the Man-in-the-Middle attack
function manInTheMiddleAttack() {
    // Implement the Man-in-the-Middle logic here
    // For demonstration purposes, a simple example is provided
    const originalMessage = 'Hello, World!';
    const attackerMessage = 'You are being attacked!';
    const encryptedMessage = crypto.createHash('sha256').update(originalMessage).digest('hex');
    console.log(`Original Message: ${originalMessage}`);
    console.log(`Attacker's Message: ${attackerMessage}`);
    console.log(`Encrypted Message: ${encryptedMessage}`);
}

// Call the function to demonstrate the attack
manInTheMiddleAttack();