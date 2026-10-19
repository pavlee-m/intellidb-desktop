import { execFileSync } from 'node:child_process';

export type KeyringBackendId = 'gnome-libsecret' | 'kwallet6' | 'kwallet5' | 'kwallet';

interface KeyringBackend {
  id: KeyringBackendId;
  dbusName: string;
}

const KEYRING_BACKENDS: readonly KeyringBackend[] = [
  { id: 'gnome-libsecret', dbusName: 'org.freedesktop.secrets' },
  { id: 'kwallet6', dbusName: 'org.kde.kwalletd6' },
  { id: 'kwallet5', dbusName: 'org.kde.kwalletd5' },
  { id: 'kwallet', dbusName: 'org.kde.kwalletd' },
];

export function getAvailableKeyringBackend(): KeyringBackendId | null {
  try {
    const stdout = execFileSync(
      'dbus-send',
      [
        '--session',
        '--print-reply',
        '--dest=org.freedesktop.DBus',
        '/',
        'org.freedesktop.DBus.ListNames',
      ],
      { encoding: 'utf8' },
    );

    for (const backend of KEYRING_BACKENDS) {
      if (stdout.includes(backend.dbusName)) {
        return backend.id;
      }
    }

    return null;
  } catch {
    return null;
  }
}
