import * as fs from 'mz/fs'
import slug from 'slug'

import { Injectable } from '@angular/core'
import { HostAppService, Platform } from 'terminus-core'

import { ShellProvider } from '../api/shellProvider'
import { Shell } from '../api/interfaces'
import { isWindowsBuild, WIN_BUILD_WSL_EXE_DISTRO_FLAG } from '../utils'

/* eslint-disable block-scoped-var */

try {
    var wnr = require('windows-native-registry') // eslint-disable-line @typescript-eslint/no-var-requires
} catch { }

// WSL Distribution List
// https://docs.microsoft.com/en-us/windows/wsl/install-win10#install-your-linux-distribution-of-choice
var wslIconMap: { [key: string]: string } = {
    'Alpine': 'alpine.svg',
    'Debian': 'debian.svg',
    'kali-linux': 'linux.svg',
    'SLES-12': 'suse.svg',
    'openSUSE-Leap-15-1': 'suse.svg',
    'Ubuntu-18.04': 'ubuntu.svg',
    'Ubuntu': 'ubuntu.svg',
    'Linux': 'linux.svg',
}

/** @hidden */
@Injectable()
export class WSLShellProvider extends ShellProvider {
    constructor (
        private hostApp: HostAppService,
    ) {
        super()
    }

    async provide (): Promise<Shell[]> {
        if (this.hostApp.platform !== Platform.Windows) {
            return []
        }

        const bashPath = `${process.env.windir}\\system32\\bash.exe`
        const wslPath = `${process.env.windir}\\system32\\wsl.exe`

        const lxssPath = 'Software\\Microsoft\\Windows\\CurrentVersion\\Lxss'
        const lxss = wnr.getRegistryKey(wnr.HK.CU, lxssPath)
        const shells: Shell[] = []

        if (null != lxss && null != lxss.DefaultDistribution) {
            const defaultDistKey = wnr.getRegistryKey(wnr.HK.CU, lxssPath + '\\' + String(lxss.DefaultDistribution.value))
            if (defaultDistKey.DistributionName) {
                const shell: Shell = {
                    id: 'wsl',
                    name: 'WSL / Default distro',
                    command: wslPath,
                    env: {
                        TERM: 'xterm-color',
                        COLORTERM: 'truecolor',
                    },
                }
                if (wslIconMap.hasOwnProperty(defaultDistKey.DistributionName.value)) {
                    shell['icon'] = require(`../icons/${wslIconMap[defaultDistKey.DistributionName.value]}`)
                }
                shells.push(shell)
            }
        }

        if (!lxss || !lxss.DefaultDistribution || !isWindowsBuild(WIN_BUILD_WSL_EXE_DISTRO_FLAG)) {
            if (await fs.exists(bashPath)) {
                return [{
                    id: 'wsl',
                    name: 'WSL / Bash on Windows',
                    icon: require(`../icons/${wslIconMap['linux']}`),
                    command: bashPath,
                    env: {
                        TERM: 'xterm-color',
                        COLORTERM: 'truecolor',
                    },
                }]
            } else {
                return []
            }
        }
        for (const child of wnr.listRegistrySubkeys(wnr.HK.CU, lxssPath) as string[]) {
            const childKey = wnr.getRegistryKey(wnr.HK.CU, lxssPath + '\\' + child)
            if (!childKey.DistributionName) {
                continue
            }
            const name = childKey.DistributionName.value
            const shell: Shell = {
                id: `wsl-${slug(name)}`,
                name: `WSL / ${name}`,
                command: wslPath,
                args: ['-d', name],
                fsBase: childKey.BasePath.value as string + '\\rootfs',
                env: {
                    TERM: 'xterm-color',
                    COLORTERM: 'truecolor',
                },
            }
            if (wslIconMap.hasOwnProperty(name)) {
                shell['icon'] = require(`../icons/${wslIconMap[name]}`)
            }
            shells.push(shell)
        }

        return shells
    }
}
