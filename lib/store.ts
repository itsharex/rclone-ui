import { LazyStore } from '@tauri-apps/plugin-store'
import { shared } from 'use-broadcast-ts'
import { create } from 'zustand'
import { type StateStorage, createJSONStorage, persist } from 'zustand/middleware'

// const { LazyStore } = window.__TAURI__.store
const store = new LazyStore('store.json')

export interface RemoteConfig {
    hideTray?: boolean

    disabledActions?: ('mount' | 'browse' | 'remove')[]

    defaultRemotePath?: string
    defaultMountPoint?: string
    mountOnStart?: boolean

    mountDefaults?: Record<string, any>
    vfsDefaults?: Record<string, any>
    filterDefaults?: Record<string, any>
    copyDefaults?: Record<string, any>
    syncDefaults?: Record<string, any>
}

interface State {
    firstWindow: boolean

    rcloneLoaded: boolean
    rcloneAuth: string
    rcloneAuthHeader: string

    mountedRemotes: Record<string, string>

    serveList: { pid: number; protocol: string; remote: string }[]
    setServeList: (serve: { pid: number; protocol: string; remote: string }) => void
    removeServeList: (pid: number) => void

    remotes: string[]
    setRemotes: (remotes: string[]) => void
    addRemote: (remote: string) => void
    removeRemote: (remote: string) => void
}

interface PersistedState {
    remoteConfigList: Record<string, RemoteConfig>
    setRemoteConfig: (remote: string, config: RemoteConfig) => void
    mergeRemoteConfig: (remote: string, config: RemoteConfig) => void

    disabledActions: ('mount' | 'sync' | 'copy' | 'serve')[]
}

const getStorage = (store: LazyStore): StateStorage => ({
    getItem: async (name: string): Promise<string | null> => {
        console.log('getItem', { name })
        return (await store.get(name)) || null
    },
    setItem: async (name: string, value: string): Promise<void> => {
        console.log('setItem', { name, value })
        await store.set(name, value)
        await store.save()
    },
    removeItem: async (name: string): Promise<void> => {
        console.log('removeItem', { name })
        await store.delete(name)
        await store.save()
    },
})

export const useStore = create<State>()(
    shared(
        (set) => ({
            firstWindow: true,

            rcloneLoaded: false,
            rcloneAuth: '',
            rcloneAuthHeader: '',

            mountedRemotes: {},

            serveList: [],
            setServeList: (serve: { pid: number; protocol: string; remote: string }) =>
                set((state) => ({ serveList: [...state.serveList, serve] })),
            removeServeList: (pid: number) =>
                set((state) => ({ serveList: state.serveList.filter((s) => s.pid !== pid) })),

            remotes: [],
            setRemotes: (remotes: string[]) => set((_) => ({ remotes })),
            addRemote: (remote: string) =>
                set((state) => ({ remotes: [...state.remotes, remote] })),
            removeRemote: (remote: string) =>
                set((state) => ({ remotes: state.remotes.filter((r) => r !== remote) })),
        }),
        { name: 'shared-store' }
    )
)

export const usePersistedStore = create<PersistedState>()(
    persist(
        (set) => ({
            remoteConfigList: {},
            setRemoteConfig: (remote: string, config: Record<string, any>) =>
                set((state) => ({
                    remoteConfigList: { ...state.remoteConfigList, [remote]: config },
                })),
            mergeRemoteConfig: (remote: string, config: Record<string, any>) =>
                set((state) => ({
                    remoteConfigList: {
                        ...state.remoteConfigList,
                        [remote]: { ...state.remoteConfigList[remote], ...config },
                    },
                })),

            disabledActions: [],
        }),
        {
            name: 'store',
            storage: createJSONStorage(() => getStorage(store)),
        }
    )
)

// useStore.persist.onFinishHydration(() => {
//     console.log('onFinishHydration')
// })

store.onKeyChange('store', async (_) => {
    await usePersistedStore.persist.rehydrate()
})
