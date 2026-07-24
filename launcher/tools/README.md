# Launcher Tools

Place `7z.exe` or `7za.exe` in this folder before building the installer when
7z package extraction must work on clean user machines.

The installer build script also auto-detects `C:\Program Files\7-Zip\7z.exe` or
an extractor on `PATH` when this folder is empty. It copies the extractor beside
`Launcher.exe`; at runtime the launcher checks its own install directory first,
then falls back to `PATH`.
