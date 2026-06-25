#define AppName "VIZZIO Launcher"
#define AppVersion GetEnv("VIZZIO_LAUNCHER_VERSION")
#if AppVersion == ""
  #define AppVersion "0.1.0"
#endif
#define RepoRoot AddBackslash(SourcePath) + ".."
#define PublishDir RepoRoot + "\launcher\bin\publish\win-x64"
#define OutputDir RepoRoot + "\installer\artifacts"

[Setup]
AppId={{A0D02F98-5E44-4AC3-991C-97B1B7814C95}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=VIZZIO
DefaultDirName={autopf}\VIZZIO Launcher
DefaultGroupName=VIZZIO Launcher
OutputDir={#OutputDir}
OutputBaseFilename=VIZZIO-Launcher-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\Launcher.exe

[Files]
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#RepoRoot}\launcher\tools\7za.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{autoprograms}\VIZZIO Launcher"; Filename: "{app}\Launcher.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\VIZZIO Launcher"; Filename: "{app}\Launcher.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Run]
Filename: "{app}\Launcher.exe"; Description: "Launch VIZZIO Launcher"; Flags: nowait postinstall skipifsilent
