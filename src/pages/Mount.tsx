import { Accordion, AccordionItem, Avatar, Button } from '@nextui-org/react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { message } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { platform } from '@tauri-apps/plugin-os'
import {
    AlertOctagonIcon,
    FoldersIcon,
    HardDriveIcon,
    PlayIcon,
    WavesLadderIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isDirectoryEmpty } from '../../lib/fs'
import { getGlobalFlags, getMountFlags, getVfsFlags, mountRemote } from '../../lib/rclone/api'
import { usePersistedStore } from '../../lib/store'
import OptionsSection from '../components/OptionsSection'
import PathFinder from '../components/PathFinder'

export default function Mount() {
    const [searchParams] = useSearchParams()

    const [source, setSource] = useState<string | undefined>(
        searchParams.get('initialSource') || undefined
    )
    const [dest, setDest] = useState<string | undefined>(undefined)

    const [isMounted, setIsMounted] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [jsonError, setJsonError] = useState<'mount' | 'vfs' | null>(null)

    const [mountOptions, setMountOptions] = useState<Record<string, string>>({})
    const [mountOptionsJson, setMountOptionsJson] = useState<string>('{}')

    const [vfsOptions, setVfsOptions] = useState<Record<string, string>>({})
    const [vfsOptionsJson, setVfsOptionsJson] = useState<string>('{}')

    const [globalOptions, setGlobalOptions] = useState<any[]>([])

    useEffect(() => {
        const storeData = usePersistedStore.getState()

        const remote = source?.split(':')[0]

        if (!remote) return

        if (!(remote in storeData.remoteConfigList)) return

        if (
            storeData.remoteConfigList[remote].mountDefaults &&
            Object.keys(storeData.remoteConfigList[remote].mountDefaults).length > 0
        ) {
            setMountOptionsJson(
                JSON.stringify(storeData.remoteConfigList[remote].mountDefaults, null, 2)
            )
        }

        if (
            storeData.remoteConfigList[remote].vfsDefaults &&
            Object.keys(storeData.remoteConfigList[remote].vfsDefaults).length > 0
        ) {
            setVfsOptionsJson(
                JSON.stringify(storeData.remoteConfigList[remote].vfsDefaults, null, 2)
            )
        }
    }, [source])

    useEffect(() => {
        getGlobalFlags().then((flags) => setGlobalOptions(flags))
    }, [])

    useEffect(() => {
        let step: 'mount' | 'vfs' = 'mount'
        try {
            setMountOptions(JSON.parse(mountOptionsJson))

            step = 'vfs'
            setVfsOptions(JSON.parse(vfsOptionsJson))

            setJsonError(null)
        } catch (error) {
            setJsonError(step)
            console.error(`Error parsing ${step} options:`, error)
        }
    }, [mountOptionsJson, vfsOptionsJson])

    const handleStartMount = useCallback(async () => {
        setIsLoading(true)

        try {
            const _mountOptions = { ...mountOptions }

            if (!('VolumeName' in _mountOptions) && ['windows', 'macos'].includes(platform())) {
                _mountOptions.VolumeName = source!.split('/').pop()!
            }

            // Check if directory is empty
            const isEmpty = await isDirectoryEmpty(dest!)
            if (!isEmpty) {
                // await resetMainWindow()

                await message('The selected directory must be empty to mount a remote.', {
                    title: 'Mount Error',
                    kind: 'error',
                })

                return
            }

            await mountRemote({
                remotePath: source!,
                mountPoint: dest!,
                mountOptions: _mountOptions,
                vfsOptions,
            })

            setIsMounted(true)
        } catch (err) {
            console.error('Failed to start mount:', err)
            const errorMessage =
                err instanceof Error ? err.message : 'Failed to start mount operation'
            await message(errorMessage, {
                title: 'Error',
                kind: 'error',
            })
        } finally {
            setIsLoading(false)
        }
    }, [source, dest, mountOptions, vfsOptions])

    const buttonText = useMemo(() => {
        if (isLoading) return 'MOUNTING...'
        if (isMounted) return 'MOUNTED'
        if (!source) return 'Please select a source path'
        if (!dest) return 'Please select a destination path'
        if (source === dest) return 'Source and destination cannot be the same'
        if (jsonError) return 'Invalid JSON for ' + jsonError.toUpperCase() + ' options'
        return 'START MOUNT'
    }, [isLoading, jsonError, source, dest, isMounted])

    const buttonIcon = useMemo(() => {
        if (isLoading || isMounted) return
        if (!source || !dest || source === dest) return <FoldersIcon className="w-5 h-5" />
        if (jsonError) return <AlertOctagonIcon className="w-5 h-5" />
        return <PlayIcon className="w-5 h-5" />
    }, [isLoading, jsonError, source, dest, isMounted])

    return (
        <div className="flex flex-col min-h-screen gap-10 pt-10">
            {/* Main Content */}
            <div className="flex flex-col flex-1 w-full max-w-xl gap-6 mx-auto">
                {/* Paths Display */}
                <PathFinder
                    sourcePath={source}
                    setSourcePath={setSource}
                    destPath={dest}
                    setDestPath={setDest}
                    switchable={false}
                    sourceOptions={{
                        label: 'Remote Path',
                        folderPicker: false,
                        placeholder: 'Root path inside the remote',
                        remoteSuggestions: true,
                        clearable: true,
                    }}
                    destOptions={{
                        label: 'Mount Point',
                        folderPicker: true,
                        placeholder: 'The local path to mount the remote to',
                        remoteSuggestions: false,
                        clearable: false,
                    }}
                />

                <Accordion>
                    <AccordionItem
                        key="mount"
                        startContent={
                            <Avatar color="secondary" radius="lg" fallback={<HardDriveIcon />} />
                        }
                        indicator={<HardDriveIcon />}
                        subtitle="Tap to see Mount options for the current operation"
                        title="Mount"
                    >
                        <OptionsSection
                            optionsJson={mountOptionsJson}
                            setOptionsJson={setMountOptionsJson}
                            globalOptions={globalOptions['mount' as keyof typeof globalOptions]}
                            optionsFetcher={getMountFlags}
                            rows={5}
                        />
                    </AccordionItem>
                    <AccordionItem
                        key="vfs"
                        startContent={
                            <Avatar color="warning" radius="lg" fallback={<WavesLadderIcon />} />
                        }
                        indicator={<WavesLadderIcon />}
                        subtitle="Tap to see VFS options for the current operation"
                        title="VFS"
                    >
                        <OptionsSection
                            optionsJson={vfsOptionsJson}
                            setOptionsJson={setVfsOptionsJson}
                            globalOptions={globalOptions['vfs' as keyof typeof globalOptions]}
                            optionsFetcher={getVfsFlags}
                            rows={10}
                        />
                    </AccordionItem>
                </Accordion>
            </div>

            <div className="sticky bottom-0 z-50 flex items-center justify-center flex-none gap-5 p-4 border-t border-neutral-500/20 bg-neutral-900/50 backdrop-blur-lg">
                {isMounted ? (
                    <>
                        <Button
                            fullWidth={true}
                            size="lg"
                            onPress={() => {
                                setDest(undefined)
                                setIsMounted(false)
                            }}
                            data-focus-visible="false"
                        >
                            New Mount
                        </Button>

                        <Button
                            fullWidth={true}
                            size="lg"
                            color="primary"
                            onPress={async () => {
                                await revealItemInDir(dest!)
                                await getCurrentWindow().destroy()
                            }}
                            data-focus-visible="false"
                        >
                            Open
                        </Button>
                    </>
                ) : (
                    <Button
                        onPress={handleStartMount}
                        size="lg"
                        fullWidth={true}
                        color="primary"
                        isDisabled={
                            isLoading ||
                            !!jsonError ||
                            !source ||
                            !dest ||
                            source === dest ||
                            isMounted
                        }
                        isLoading={isLoading}
                        endContent={buttonIcon}
                        className="max-w-2xl"
                        data-focus-visible="false"
                    >
                        {buttonText}
                    </Button>
                )}
            </div>
        </div>
    )
}
