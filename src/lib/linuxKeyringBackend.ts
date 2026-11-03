import { execFileSync } from 'node:child_process';

const KEYRING_BACKENDS = [
  { id: 'gnome-libsecret', dbusName: 'org.freedesktop.secrets' },
  { id: 'kwallet6', dbusName: 'org.kde.kwalletd6' },
  { id: 'kwallet5', dbusName: 'org.kde.kwalletd5' },
  { id: 'kwallet', dbusName: 'org.kde.kwalletd' },
];

export function getAvailableKeyringBackend(): string | null {
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
