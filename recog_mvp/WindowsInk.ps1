#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$File,
    [switch]$Headless,
    [string]$RecognizerName,
    [switch]$ListRecognizers,
    [switch]$SmokeTest
)

$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSEdition -ne 'Desktop') {
    throw 'Use Windows PowerShell 5.1 (powershell.exe), not PowerShell 7 (pwsh).'
}
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -Path (Join-Path ([System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'System.Numerics.Vectors.dll')
Add-Type -AssemblyName PresentationFramework
$null = [Windows.UI.Input.Inking.InkRecognizerContainer, Windows.UI.Input.Inking, ContentType=WindowsRuntime]
$null = [Windows.UI.Input.Inking.InkStrokeBuilder, Windows.UI.Input.Inking, ContentType=WindowsRuntime]
$null = [Windows.UI.Input.Inking.InkStrokeContainer, Windows.UI.Input.Inking, ContentType=WindowsRuntime]
$null = [Windows.UI.Input.Inking.InkPoint, Windows.UI.Input.Inking, ContentType=WindowsRuntime]
$null = [Windows.UI.Input.Inking.InkRecognitionResult, Windows.UI.Input.Inking, ContentType=WindowsRuntime]
$null = [Windows.UI.Input.Inking.InkRecognitionTarget, Windows.UI.Input.Inking, ContentType=WindowsRuntime]

$script:engine = [Windows.UI.Input.Inking.InkRecognizerContainer]::new()
$script:recognizers = @($script:engine.GetRecognizers())
$script:asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and
    $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1

function Read-InkFile([string]$Path) {
    if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 24 or newer to validate ink JSON.' }
    $major = [int]((& node --version).TrimStart('v').Split('.')[0])
    if ($major -lt 24) { throw 'Node.js 24 or newer is required.' }
    $resolved = (Resolve-Path -LiteralPath $Path).Path
    # Capture validation errors without losing stderr to PowerShell's native error handling.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & node (Join-Path $PSScriptRoot 'prepare.ts') $resolved 2>&1
        $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previous }
    if ($exitCode -ne 0) { throw ($output -join "`n") }
    return (($output -join "`n") | ConvertFrom-Json)
}

function Wait-InkOperation($Operation, [switch]$PumpUI) {
    $resultType = [System.Collections.Generic.IReadOnlyList[Windows.UI.Input.Inking.InkRecognitionResult]]
    $task = $script:asTask.MakeGenericMethod($resultType).Invoke($null, @($Operation))
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    while (!$task.IsCompleted) {
        if ([DateTime]::UtcNow -gt $deadline) {
            $Operation.Cancel()
            throw 'Windows Ink timed out after 60 seconds on this line. Try a smaller sample.'
        }
        if ($PumpUI) {
            $frame = [System.Windows.Threading.DispatcherFrame]::new()
            $timer = [System.Windows.Threading.DispatcherTimer]::new()
            $timer.Interval = [TimeSpan]::FromMilliseconds(30)
            $tick = { $frame.Continue = $false }.GetNewClosure()
            $timer.Add_Tick($tick)
            $timer.Start()
            try { [System.Windows.Threading.Dispatcher]::PushFrame($frame) }
            finally { $timer.Stop(); $timer.Remove_Tick($tick) }
        } else { Start-Sleep -Milliseconds 30 }
    }
    return $task.GetAwaiter().GetResult()
}

function Invoke-InkLine($Line, [switch]$PumpUI) {
    if ($Line.blockType -eq 'drawing') {
        return [pscustomobject]@{ Line = $Line.lineId; Status = 'Skipped drawing'; Text = ''; Alternatives = '' }
    }
    if (@($Line.strokes).Count -eq 0) {
        return [pscustomobject]@{ Line = $Line.lineId; Status = 'No remaining ink'; Text = ''; Alternatives = '' }
    }
    $container = [Windows.UI.Input.Inking.InkStrokeContainer]::new()
    $builder = [Windows.UI.Input.Inking.InkStrokeBuilder]::new()
    # Translate the whole line together; do not destroy the spacing between strokes.
    $allPoints = @($Line.strokes | ForEach-Object { $_.points })
    $minX = ($allPoints | Measure-Object -Property x -Minimum).Minimum
    $minY = ($allPoints | Measure-Object -Property y -Minimum).Minimum
    foreach ($stroke in $Line.strokes) {
        $points = [System.Collections.Generic.List[Windows.UI.Input.Inking.InkPoint]]::new()
        foreach ($point in $stroke.points) {
            $position = [Windows.Foundation.Point]::new(($point.x - $minX), ($point.y - $minY))
            $pressure = if ($null -ne $point.p) { [single]$point.p } else { [single]0.5 }
            $points.Add([Windows.UI.Input.Inking.InkPoint]::new($position, $pressure))
        }
        $nativeStroke = $builder.CreateStrokeFromInkPoints($points, [System.Numerics.Matrix3x2]::Identity)
        Write-Verbose "Stroke $($stroke.strokeId): $($points.Count) points, native bounds $($nativeStroke.BoundingRect)"
        $container.AddStroke($nativeStroke)
    }
    $operation = $script:engine.RecognizeAsync($container, [Windows.UI.Input.Inking.InkRecognitionTarget]::All)
    $words = @(Wait-InkOperation $operation -PumpUI:$PumpUI)
    # This MVP targets left-to-right prose, matching the shared layout heuristics.
    $ordered = @($words | Sort-Object { $_.BoundingRect.X })
    $best = @(); $alternatives = @()
    foreach ($word in $ordered) {
        $candidates = @($word.GetTextCandidates())
        if ($candidates.Count -gt 0) {
            $best += $candidates[0]
            $alternatives += ($candidates -join ' | ')
        }
    }
    return [pscustomobject]@{
        Line = $Line.lineId
        Status = $(if ($best.Count) { 'Recognized' } else { 'No candidates' })
        Text = ($best -join ' ')
        Alternatives = ($alternatives -join ' ; ')
    }
}

if ($ListRecognizers) { $script:recognizers | Select-Object -ExpandProperty Name; exit }
if ($Headless) {
    if (!$File) { throw '-Headless requires -File <ink.json>.' }
    if (!$RecognizerName) { throw 'Specify -RecognizerName exactly as shown by -ListRecognizers.' }
    $selected = $script:recognizers | Where-Object { $_.Name -ceq $RecognizerName } | Select-Object -First 1
    if (!$selected) { throw "Recognizer not installed: $RecognizerName. Install Handwriting under Windows language options." }
    $doc = Read-InkFile $File
    $script:engine.SetDefaultRecognizer($selected)
    $rows = @($doc.lines | ForEach-Object { Invoke-InkLine $_ })
    [pscustomobject]@{ language = $doc.language; recognizer = $selected.Name; lines = $rows } | ConvertTo-Json -Depth 8
    exit
}

[xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        Title="OpenRecog - Windows Ink" Width="1050" Height="720" MinWidth="760" MinHeight="520"
        WindowStartupLocation="CenterScreen" Background="#F5F7FB">
  <Grid Margin="24">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>
      <RowDefinition Height="*"/><RowDefinition Height="Auto"/><RowDefinition Height="140"/>
      <RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>
    <StackPanel Grid.Row="0" Margin="0,0,0,18">
      <TextBlock Text="Handwriting to text" FontSize="28" FontWeight="SemiBold"/>
      <TextBlock Text="Open an Excalidraw ink v1 JSON export and recognize it locally with Windows Ink." Margin="0,6,0,0"/>
    </StackPanel>
    <DockPanel Grid.Row="1" Margin="0,0,0,12">
      <Button Name="Open" Content="Open JSON..." Padding="16,8" Margin="0,0,12,0"/>
      <TextBlock Name="FileLabel" Text="No file loaded" VerticalAlignment="Center" TextTrimming="CharacterEllipsis"/>
    </DockPanel>
    <StackPanel Grid.Row="2" Margin="0,0,0,14">
      <TextBlock Name="LanguageLabel" Text="Choose the installed recognizer matching your writing language." Margin="0,0,0,6"/>
      <DockPanel>
        <Button Name="Recognize" DockPanel.Dock="Right" Content="Recognize lines" Padding="16,8" Margin="12,0,0,0" IsEnabled="False"/>
        <ComboBox Name="Engines" DisplayMemberPath="Name" MinHeight="34" VerticalContentAlignment="Center"/>
      </DockPanel>
    </StackPanel>
    <DataGrid Name="Results" Grid.Row="3" AutoGenerateColumns="False" IsReadOnly="True"
              CanUserAddRows="False" CanUserSortColumns="False" HeadersVisibility="Column" RowHeaderWidth="0">
      <DataGrid.Columns>
        <DataGridTextColumn Header="Line" Binding="{Binding Line}" Width="75"/>
        <DataGridTextColumn Header="Status" Binding="{Binding Status}" Width="125"/>
        <DataGridTextColumn Header="Recognized text" Binding="{Binding Text}" Width="*"/>
        <DataGridTextColumn Header="Word alternatives" Binding="{Binding Alternatives}" Width="2*"/>
      </DataGrid.Columns>
    </DataGrid>
    <DockPanel Grid.Row="4" Margin="0,14,0,8">
      <Button Name="Copy" DockPanel.Dock="Right" Content="Copy text" Padding="12,5" IsEnabled="False"/>
      <TextBlock Text="Transcript" FontSize="16" FontWeight="SemiBold" VerticalAlignment="Center"/>
    </DockPanel>
    <TextBox Name="Transcript" Grid.Row="5" IsReadOnly="True" TextWrapping="Wrap" AcceptsReturn="True"
             VerticalScrollBarVisibility="Auto" Padding="10" FontSize="16"/>
    <TextBlock Name="Status" Grid.Row="6" Margin="0,12,0,0" TextWrapping="Wrap" Text="Your source file is never modified."/>
  </Grid>
</Window>
'@
$script:window = [Windows.Markup.XamlReader]::Load([System.Xml.XmlNodeReader]::new($xaml))
foreach ($name in 'Open','FileLabel','LanguageLabel','Recognize','Engines','Results','Copy','Transcript','Status') {
    Set-Variable -Scope Script -Name $name -Value $script:window.FindName($name)
}
$script:document = $null
$script:busy = $false
$script:Engines.ItemsSource = $script:recognizers
# Deliberately require an explicit choice; recognizer names are localized, not BCP-47 IDs.
$script:Engines.SelectedIndex = -1
if (!$script:recognizers.Count) {
    $script:Status.Text = 'No Windows handwriting recognizers installed. Open Settings > Time & language > Language options, install Handwriting, then restart this app.'
}

function Open-InkDocument([string]$Path) {
    $loaded = Read-InkFile $Path
    $script:document = $loaded
    $script:FileLabel.Text = $Path
    $script:LanguageLabel.Text = "Document language: $($loaded.language). Select the matching installed recognizer."
    $script:Results.ItemsSource = $null
    $script:Transcript.Text = ''
    $script:Copy.IsEnabled = $false
    $script:Recognize.IsEnabled = $script:Engines.SelectedIndex -ge 0 -and @($loaded.lines).Count -gt 0
    $script:Status.Text = "Loaded $(@($loaded.lines).Count) line(s). Drawing blocks are skipped; existing delete gestures are respected."
}
$script:Open.Add_Click({
    $picker = [Microsoft.Win32.OpenFileDialog]::new()
    $picker.Filter = 'Ink JSON (*.json)|*.json'
    if ($picker.ShowDialog($script:window)) {
        try { Open-InkDocument $picker.FileName }
        catch { $script:Status.Text = "Could not open file: $($_.Exception.Message)" }
    }
})
$script:Engines.Add_SelectionChanged({
    $script:Recognize.IsEnabled = !$script:busy -and $null -ne $script:document -and
        @($script:document.lines).Count -gt 0 -and $script:Engines.SelectedIndex -ge 0
    $script:Results.ItemsSource = $null
    $script:Transcript.Text = ''
    $script:Copy.IsEnabled = $false
})
$script:Copy.Add_Click({
    try { [Windows.Clipboard]::SetText($script:Transcript.Text); $script:Status.Text = 'Transcript copied.' }
    catch { $script:Status.Text = "Could not copy: $($_.Exception.Message)" }
})
$script:window.Add_Closing({ param($sender, $eventArgs)
    if ($script:busy) { $eventArgs.Cancel = $true; $script:Status.Text = 'Please wait for recognition to finish before closing.' }
})
$script:Recognize.Add_Click({
    $script:busy = $true
    $script:Open.IsEnabled = $false; $script:Recognize.IsEnabled = $false
    $script:Engines.IsEnabled = $false; $script:Copy.IsEnabled = $false
    $script:Transcript.Text = ''
    $rows = [System.Collections.ObjectModel.ObservableCollection[object]]::new()
    $script:Results.ItemsSource = $rows
    try {
        $script:engine.SetDefaultRecognizer($script:Engines.SelectedItem)
        $index = 0
        foreach ($line in $script:document.lines) {
            $index++
            $script:Status.Text = "Recognizing line $index of $(@($script:document.lines).Count)..."
            try { $rows.Add((Invoke-InkLine $line -PumpUI)) }
            catch { $rows.Add([pscustomobject]@{ Line=$line.lineId; Status='Failed'; Text=''; Alternatives=$_.Exception.Message }) }
        }
        $script:Transcript.Text = (@($rows | Where-Object { $_.Status -eq 'Recognized' } | ForEach-Object { $_.Text }) -join "`r`n")
        $failed = @($rows | Where-Object { $_.Status -eq 'Failed' }).Count
        $recognized = @($rows | Where-Object { $_.Status -eq 'Recognized' }).Count
        $script:Status.Text = "Finished: $recognized recognized, $failed failed, $($rows.Count - $recognized - $failed) skipped or empty. Source file unchanged."
    } catch { $script:Status.Text = "Recognition failed: $($_.Exception.Message)" }
    finally {
        $script:busy = $false
        $script:Open.IsEnabled = $true; $script:Engines.IsEnabled = $true; $script:Recognize.IsEnabled = $true
        $script:Copy.IsEnabled = $script:Transcript.Text.Length -gt 0
    }
})
if ($File) {
    try { Open-InkDocument $File }
    catch { $script:Status.Text = "Could not open file: $($_.Exception.Message)" }
}
if ($SmokeTest) {
    if (!$script:document) { throw 'UI smoke test requires a valid -File.' }
    $match = @($script:recognizers | Where-Object { $_.Name -ceq $RecognizerName })
    if (!$match.Count) { throw 'UI smoke test requires an installed -RecognizerName.' }
    $script:Engines.SelectedItem = $match[0]
    if (!$script:Recognize.IsEnabled) { throw 'Recognize button is unexpectedly disabled.' }
    $script:Recognize.RaiseEvent([System.Windows.RoutedEventArgs]::new([System.Windows.Controls.Button]::ClickEvent))
    if (@($script:Results.ItemsSource).Count -ne @($script:document.lines).Count) { throw 'UI did not display every line.' }
    if (@($script:Results.ItemsSource | Where-Object { $_.Status -eq 'Failed' }).Count) { throw 'A UI recognition call failed.' }
    if ($script:busy -or !$script:Open.IsEnabled -or !$script:Engines.IsEnabled) { throw 'UI did not recover from recognition.' }
    $expectedText = @($script:Results.ItemsSource | Where-Object { $_.Status -eq 'Recognized' } | ForEach-Object { $_.Text }) -join "`r`n"
    if ($script:Transcript.Text -cne $expectedText) { throw 'Transcript does not match the displayed line results.' }
    if ($script:Copy.IsEnabled -ne ($expectedText.Length -gt 0)) { throw 'Copy button state does not match transcript.' }
    Write-Output $script:Status.Text
    $script:Engines.SelectedIndex = -1
    if ($script:Recognize.IsEnabled -or $script:Copy.IsEnabled -or $script:Transcript.Text) { throw 'Changing the recognizer left stale results enabled.' }
    exit
}
$null = $script:window.ShowDialog()
