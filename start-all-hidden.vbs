' 静默一键启动(无窗口):等价于双击 start-all.bat,适合放开机自启
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("Wscript.Shell").Run """" & dir & "\start-all.bat"" --no-pause", 0, False
