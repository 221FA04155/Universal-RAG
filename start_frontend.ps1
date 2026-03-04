$psi = New-Object System.Diagnostics.ProcessStartInfo;
$psi.FileName = "C:\Program Files\nodejs\node.exe";
$psi.Arguments = "c:\Users\Manikanta\Desktop\Dynamic-AI-Assistant\Dynamic-AI-Assistant-FD-main\node_modules\vite\bin\vite.js --port 3000 --host 0.0.0.0";
$psi.WorkingDirectory = "c:\Users\Manikanta\Desktop\Dynamic-AI-Assistant\Dynamic-AI-Assistant-FD-main";
$psi.UseShellExecute = $false;
$psi.CreateNoWindow = $true;
$proc = [System.Diagnostics.Process]::Start($psi);
Write-Output "Started Frontend PID: $($proc.Id)";
