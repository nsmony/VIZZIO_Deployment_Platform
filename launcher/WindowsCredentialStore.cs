using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace Launcher
{
    // Stores the launcher session token in Windows Credential Manager.
    internal static class WindowsCredentialStore
    {
        private const string TargetName = "VIZZIO Launcher JWT";
        private const int CredentialTypeGeneric = 1;
        private const int CredentialPersistenceLocalMachine = 2;

        public static string? ReadToken()
        {
            // Return null when no saved session exists.
            if (!CredRead(TargetName, CredentialTypeGeneric, 0, out var credentialPtr))
            {
                return null;
            }

            try
            {
                var credential = Marshal.PtrToStructure<Credential>(credentialPtr);
                if (credential.CredentialBlobSize <= 0 || credential.CredentialBlob == IntPtr.Zero)
                {
                    return null;
                }

                var bytes = new byte[credential.CredentialBlobSize];
                Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
                return Encoding.UTF8.GetString(bytes);
            }
            finally
            {
                CredFree(credentialPtr);
            }
        }

        public static void SaveToken(string token)
        {
            // Windows owns the encrypted storage after CredWrite succeeds.
            var bytes = Encoding.UTF8.GetBytes(token);
            var credential = new Credential
            {
                Type = CredentialTypeGeneric,
                TargetName = TargetName,
                CredentialBlobSize = bytes.Length,
                CredentialBlob = Marshal.AllocCoTaskMem(bytes.Length),
                Persist = CredentialPersistenceLocalMachine,
                UserName = Environment.UserName,
            };

            try
            {
                Marshal.Copy(bytes, 0, credential.CredentialBlob, bytes.Length);
                if (!CredWrite(ref credential, 0))
                {
                    throw new Win32Exception(Marshal.GetLastWin32Error(), "Could not save the session token.");
                }
            }
            finally
            {
                Marshal.FreeCoTaskMem(credential.CredentialBlob);
            }
        }

        public static void ClearToken()
        {
            // Ignore missing credentials; signing out should always continue.
            CredDelete(TargetName, CredentialTypeGeneric, 0);
        }

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool CredWrite(ref Credential userCredential, int flags);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool CredDelete(string target, int type, int flags);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern void CredFree(IntPtr buffer);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct Credential
        {
            public int Flags;
            public int Type;
            public string TargetName;
            public string? Comment;
            public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
            public int CredentialBlobSize;
            public IntPtr CredentialBlob;
            public int Persist;
            public int AttributeCount;
            public IntPtr Attributes;
            public string? TargetAlias;
            public string UserName;
        }
    }
}
