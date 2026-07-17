import Settings from '@/interfaces/Settings'

export default interface SettingsState {
    settings: Settings | null;
    setSettings: (settings: Settings) => void;
}
