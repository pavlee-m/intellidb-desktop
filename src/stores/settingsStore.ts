import SettingsState from '@/interfaces/SettingsState'
import { create } from 'zustand'

const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  setSettings: (settings) => set({ settings: settings }),
}))

export default useSettingsStore
