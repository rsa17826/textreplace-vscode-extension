cd $HOME\Desktop
if (Test-Path build_temp) { rm -Recurse -Force build_temp 
if (Test-Path build_temp) { rm -rf build_temp }}

mkdir build_temp; cd build_temp
git clone https://github.com/rsa17826/fixed-line-actions-vscode-extension.git .

$nodeDir = "$HOME\Desktop\node-v22.0.0-win-x64"
if (-not (Test-Path $nodeDir)) {
  Write-Host "Downloading Portable Node v22..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.0.0/node-v22.0.0-win-x64.zip" -OutFile "node.zip"
  Expand-Archive node.zip -DestinationPath $HOME\Desktop
  rm node.zip
}

node -v

npm install
echo y|npx @vscode/vsce package --allow-missing-repository --no-git-tag-version

mv *.vsix ..
cd ..
if (Test-Path build_temp) { rm -Recurse -Force build_temp 
if (Test-Path build_temp) { rm -rf build_temp }}
