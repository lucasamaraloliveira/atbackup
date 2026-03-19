
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';

/**
 * Common logic to find the rclone binary on Windows.
 * This checks standard locations before falling back to PATH.
 */
export const getRcloneBinary = (): string => {
    // 1. Try local winget path (often used by developers)
    const localAppData = process.env.LOCALAPPDATA || `C:\\Users\\${process.env.USERNAME}\\AppData\\Local`;
    console.log('[RCLONE CHECK] localAppData:', localAppData);
    const wingetBase = `${localAppData}\\Microsoft\\WinGet\\Packages`;
    
    // Check if rclone-path.txt exists in root - potentially a user-defined override
    // Note: in Next.js API, process.cwd() is project root
    const overrideFile = 'rclone_path.txt';
    if (existsSync(overrideFile)) {
        try {
            const content = readFileSync(overrideFile, 'utf8').trim();
            const exists = existsSync(content);
            console.log(`[RCLONE CHECK] override ${overrideFile} -> ${content} (exists: ${exists})`);
            if (content && exists) return content;
        } catch (e) {}
    }

    const projectBin = `${process.cwd()}\\bin\\rclone\\rclone.exe`;
    
    const commonPaths = [
        projectBin,
        `${wingetBase}\\Rclone.Rclone_Microsoft.Winget.Source_8wekyb3d8bbwe\\rclone-v1.73.2-windows-amd64\\rclone.exe`,
        'C:\\Program Files\\rclone\\rclone.exe',
        'C:\\rclone\\rclone.exe'
    ];

    console.log('[RCLONE CHECK] Checking paths...');
    for (const path of commonPaths) {
        const exists = existsSync(path);
        console.log(`[RCLONE CHECK] ${path} -> ${exists}`);
        if (exists) return path;
    }

    console.log('[RCLONE CHECK] Fallback to "rclone"');
    return 'rclone'; // Last resort, assume it's in PATH
};

/**
 * Safely verify if rclone is available.
 */
export const isRcloneInstalled = async (): Promise<boolean> => {
    return new Promise((resolve) => {
        try {
             const bin = getRcloneBinary();
             console.log(`[RCLONE CHECK] Testing execution of: ${bin}`);
             const test = spawn(bin, ['--version']);
             test.on('error', (err) => {
                 console.log(`[RCLONE CHECK] Execution error: ${err.message}`);
                 resolve(false);
             });
             test.on('close', (code) => {
                 console.log(`[RCLONE CHECK] Execution exit code: ${code}`);
                 resolve(code === 0);
             });
        } catch (e) {
            resolve(false);
        }
    });
};
