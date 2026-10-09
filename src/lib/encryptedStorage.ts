import { safeStorage } from 'electron';

export function encryptSecret(plain: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available');
    }
    return safeStorage.encryptString(plain).toString('base64');
}

export function decryptSecret(encrypted: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('Encryption is not available');
    }
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
}