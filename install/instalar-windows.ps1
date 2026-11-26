# Instalador del kit de Claude de TPP para Windows.
# Instala lo que falte (Git, Node, GitHub CLI, Claude Code), conecta el kit y sus candados.
# Pregunta antes de cada instalación y revisa que cada paso haya funcionado. No pide ni guarda contraseñas
# de servicios: los logins se hacen en el navegador. Se puede correr las veces que haga falta.
#
# La forma fácil de correrlo es hacer doble clic en instalar-windows.bat (en la misma carpeta).

$KitRepo = "tpp-kit/tpp-claude-kit"
$Marketplace = "tpp-claude-kit"

function Paso($t) { Write-Host ""; Write-Host $t -ForegroundColor Cyan }
function Ok($t) { Write-Host "  OK  $t" -ForegroundColor Green }
function Falla($t) {
  Write-Host ""
  Write-Host "  ERROR  $t" -ForegroundColor Red
  Write-Host ""
  Read-Host "  Apretá Enter para cerrar"
  exit 1
}
function Pregunta($t) {
  $r = (Read-Host "  $t (escribí s y Enter para sí)").Trim().ToLower()
  return @("s", "si", "sí", "y", "yes") -contains $r
}
function Tiene($c) { return [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function RefrescarPath {
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
              [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" +
              (Join-Path $env:USERPROFILE ".local\bin")
}
# Los programas externos no cortan el script cuando fallan: hay que mirar $LASTEXITCODE después de cada uno.
function Revisar($mensaje) { if ($LASTEXITCODE -ne 0) { Falla $mensaje } }

if ($KitRepo -like "PENDIENTE-*") {
  Falla "Este instalador está incompleto (no es tu culpa). Escribile a Guie y decile que el instalador del kit viene sin configurar."
}

Paso "Kit de Claude de TPP - instalador para Windows"
Write-Host "  Voy a revisar qué tenés y preguntarte antes de instalar cada cosa."
Write-Host "  Vas a ver textos largos corriendo: es normal. Algunos pasos tardan varios minutos."
Write-Host "  Si aparece una ventana de Windows pidiendo permiso para hacer cambios, aceptala."

if (-not (Tiene "winget")) {
  Falla "Falta 'App Installer' de Microsoft. Instalalo desde Microsoft Store y volvé a correr esto."
}

$programas = @(
  @{ Cmd = "git";  Id = "Git.Git";           Nombre = "Git" },
  @{ Cmd = "node"; Id = "OpenJS.NodeJS.LTS"; Nombre = "Node.js" }
)
foreach ($p in $programas) {
  Paso "Instalar $($p.Nombre)"
  if (Tiene $p.Cmd) { Ok "$($p.Nombre) ya está"; continue }
  if (-not (Pregunta "¿Instalo $($p.Nombre)? Puede tardar unos minutos.")) {
    Falla "$($p.Nombre) es necesario para el kit. Volvé a correr esto cuando quieras."
  }
  winget install --id $p.Id -e --accept-source-agreements --accept-package-agreements
  Revisar "No se pudo instalar $($p.Nombre). Mandale a Guie una captura de esta ventana."
  RefrescarPath
  if (-not (Tiene $p.Cmd)) { Falla "Instalé $($p.Nombre) pero no lo encuentro. Cerrá esta ventana y volvé a hacer doble clic en el instalador." }
  Ok "$($p.Nombre) instalado"
}

Paso "Acceso al kit"
# Si el repo del kit es público, se lee sin cuenta: no hace falta GitHub, invitación ni login.
$env:GIT_TERMINAL_PROMPT = "0"
git ls-remote "https://github.com/$KitRepo" HEAD *> $null
if ($LASTEXITCODE -eq 0) { Ok "el kit es público: no necesitás cuenta de GitHub" }
else {
  Write-Host "  El kit es privado: para recibirlo necesitás una cuenta de GitHub (es gratis)."
  if (-not (Tiene "gh")) {
    if (-not (Pregunta "¿Instalo GitHub CLI (para recibir las actualizaciones del kit)?")) { Falla "Sin GitHub CLI no puedo traer el kit privado." }
    winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
    Revisar "No se pudo instalar GitHub CLI. Mandale a Guie una captura de esta ventana."
    RefrescarPath
  }
  if (-not (Pregunta "¿Ya tenés cuenta en GitHub?")) {
    Write-Host "  Te abro la página para crearla. Usá tu correo de trabajo, elegí un usuario y una contraseña"
    Write-Host "  (la contraseña la escribís solo en esa página, nunca acá ni en Claude)."
    Start-Process "https://github.com/signup"
    Read-Host "  Cuando termines de crearla, apretá Enter para seguir" | Out-Null
  }
  Write-Host "  Ahora mandale tu USUARIO de GitHub a Guie. Él te invita y te llega un correo de GitHub."
  if (-not (Pregunta "¿Ya aceptaste la invitación de GitHub?")) {
    Falla "Sin eso no puedo seguir. Aceptá la invitación (buscá un correo de GitHub) y volvé a correr el instalador."
  }
  gh auth status *> $null
  if ($LASTEXITCODE -eq 0) { Ok "ya tenés sesión en GitHub" }
  else {
    Write-Host "  Ahora se abre el navegador para que entres con tu cuenta de GitHub. Seguí los pasos y volvé acá."
    gh auth login --web --git-protocol https
    Revisar "No se completó el login de GitHub. Volvé a correr el instalador."
  }
  gh auth setup-git
  Revisar "No pude conectar git con tu sesión de GitHub. Mandale a Guie una captura de esta ventana."
  Ok "git usa tu sesión de GitHub para las actualizaciones"
}

Paso "Claude Code"
if (Tiene "claude") { Ok "Claude Code ya está" }
else {
  if (-not (Pregunta "¿Instalo Claude Code con el instalador oficial? Puede tardar unos minutos.")) {
    Falla "Sin Claude Code no hay kit. Volvé a correr esto cuando quieras."
  }
  try { Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression }
  catch { Falla "No se pudo instalar Claude Code. Mandale a Guie una captura de esta ventana." }
  RefrescarPath
  if (-not (Tiene "claude")) { Falla "Instalé Claude Code pero no lo encuentro. Cerrá esta ventana y volvé a hacer doble clic en el instalador." }
}

Paso "Conectar el kit"
$lista = (claude plugin marketplace list 2>$null | Out-String)
if ($lista -match [regex]::Escape($Marketplace)) { Ok "el kit ya está conectado" }
else {
  claude plugin marketplace add $KitRepo
  Revisar "No pude conectar el kit. Casi seguro falta aceptar la invitación de GitHub. Aceptala y corré el instalador de nuevo."
}
# El kit tiene que venir del repo oficial: un fork con el mismo nombre no se acepta.
$origen = ""
try {
  $conocidos = Get-Content (Join-Path $env:USERPROFILE ".claude\plugins\known_marketplaces.json") -Raw | ConvertFrom-Json
  $src = $conocidos.$Marketplace.source
  $origen = "$($src.repo)$($src.url)$($src.path)"
} catch { }
$normalizado = ($origen.ToLower() -replace '^https://github.com/', '' -replace '\.git$', '').TrimEnd('/')
if ($normalizado -ne $KitRepo.ToLower()) { Falla "Ya hay un kit con el mismo nombre que NO viene del repo oficial ($origen). No lo uses: mandale esto a Guie." }
Ok "el kit viene del repo oficial ($KitRepo)"
foreach ($plugin in @("tpp", "tpp-guardrails")) {
  claude plugin install "$plugin@$Marketplace"
  Revisar "No pude instalar $plugin. Mandale a Guie una captura de esta ventana."
}
$instalados = (claude plugin list 2>$null | Out-String)
foreach ($plugin in @("tpp", "tpp-guardrails")) {
  if ($instalados -notmatch [regex]::Escape("$plugin@$Marketplace")) { Falla "No veo $plugin instalado. Mandale a Guie una captura de esta ventana." }
}
Ok "el kit y sus candados están instalados"

Paso "Listo"
Write-Host "  Abrí PowerShell (tecla Windows, escribí PowerShell, Enter), escribí claude y apretá Enter."
Write-Host "  La primera vez te pide entrar con tu cuenta de Claude en el navegador."
Write-Host "  Cuando estés adentro, escribí:"
Write-Host ""
Write-Host "      /tpp:bienvenida"
Write-Host ""
Write-Host "  El asistente termina de configurar todo según tu equipo."
Read-Host "  Apretá Enter para cerrar esta ventana"
