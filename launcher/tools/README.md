# Launcher Tools

Place `7za.exe` in this folder before building the installer if 7z package extraction must work on clean machines.

The installer script copies `7za.exe` beside `Launcher.exe`. At runtime the launcher first checks its own install directory, then falls back to `PATH`.
