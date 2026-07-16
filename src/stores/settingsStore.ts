import { create } from 'zustand'
import type Settings from '@/interfaces/Settings'


const useSettingsStore = create((set) => ({
  settings: null,
}))

export default useSettingsStore
