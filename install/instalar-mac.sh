#!/usr/bin/env bash
# Instalador del kit de Claude de TPP para Mac.
# Instala lo que falte (Homebrew, Git, Node, GitHub CLI, Claude Code), conecta el kit y sus candados.
# Pregunta antes de cada instalación y revisa que cada paso haya funcionado. No pide ni guarda contraseñas
# de servicios: los logins se hacen en el navegador. Se puede correr las veces que haga falta.

set -uo pipefail

KIT_REPO="tpp-kit/tpp-claude-kit"
MARKETPLACE="tpp-claude-kit"
PERFIL_SHELL="$HOME/.zprofile"

paso() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok() { printf '  ✓ %s\n' "$1"; }
falla() { printf '\n  ✗ %s\n\n' "$1" >&2; exit 1; }
pregunta() {
  local r
  read -r -p "  $1 (escribí s y Enter para sí) " r </dev/tty || r=""
  r="$(printf '%s' "$r" | tr '[:upper:]' '[:lower:]')"
  [[ "$r" =~ ^(s|si|sí|y|yes)$ ]]
}
tiene() { command -v "$1" >/dev/null 2>&1; }
# Deja una línea en ~/.zprofile para que la próxima terminal también encuentre el programa.
persistir() {
  local linea="$1"
  grep -qsF "$linea" "$PERFIL_SHELL" || printf '\n%s\n' "$linea" >> "$PERFIL_SHELL"
}

if [[ "$KIT_REPO" == PENDIENTE-* ]]; then
  falla "Este instalador está incompleto (no es tu culpa). Escribile a Guie y decile que el instalador del kit viene sin configurar."
fi

paso "Kit de Claude de TPP · instalador para Mac"
echo "  Voy a revisar qué tenés y preguntarte antes de instalar cada cosa."
echo "  Vas a ver textos largos corriendo: es normal. Algunos pasos tardan varios minutos."

paso "1. Homebrew (instalador de programas)"
if tiene brew; then ok "Homebrew ya está"; else
  echo "  Homebrew no está. Es el instalador estándar de programas para Mac."
  echo "  Te va a pedir la contraseña con la que abrís tu Mac. Al escribirla NO se ve nada: es normal. Escribila y apretá Enter."
  if pregunta "¿Lo instalo?"; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || falla "No se pudo instalar Homebrew. Mandale a Guie una foto de lo que se ve arriba."
  else
    falla "Sin Homebrew no puedo instalar lo demás. Volvé a correr esto cuando quieras."
  fi
fi
for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  if [[ -x "$b" ]]; then eval "$("$b" shellenv)"; persistir "eval \"\$($b shellenv)\""; break; fi
done
tiene brew || falla "Instalé Homebrew pero no lo encuentro. Cerrá esta ventana, abrí otra Terminal y volvé a correr el instalador."

for programa in git node; do
  case "$programa" in
    git) nombre="Git" ;;
    node) nombre="Node.js" ;;
  esac
  paso "Instalar $nombre"
  if tiene "$programa"; then ok "$nombre ya está"; else
    if pregunta "¿Instalo $nombre? Puede tardar unos minutos."; then
      brew install "$programa" || falla "No se pudo instalar $nombre. Mandale a Guie una foto de lo que se ve arriba."
      ok "$nombre instalado"
    else
      falla "$nombre es necesario para el kit. Volvé a correr esto cuando quieras."
    fi
  fi
done

paso "Acceso al kit"
# Si el repo del kit es público, se lee sin cuenta: no hace falta GitHub, invitación ni login.
if GIT_TERMINAL_PROMPT=0 git ls-remote "https://github.com/$KIT_REPO" HEAD >/dev/null 2>&1; then
  ok "el kit es público: no necesitás cuenta de GitHub"
else
  echo "  El kit es privado: para recibirlo necesitás una cuenta de GitHub (es gratis)."
  if ! tiene gh; then
    pregunta "¿Instalo GitHub CLI (para recibir las actualizaciones del kit)?" || falla "Sin GitHub CLI no puedo traer el kit privado."
    brew install gh || falla "No se pudo instalar GitHub CLI. Mandale a Guie una foto de lo que se ve arriba."
  fi
  if ! pregunta "¿Ya tenés cuenta en GitHub?"; then
    echo "  Te abro la página para crearla. Usá tu correo de trabajo, elegí un usuario y una contraseña"
    echo "  (la contraseña la escribís solo en esa página, nunca acá ni en Claude)."
    open "https://github.com/signup" 2>/dev/null || echo "  Abrí en el navegador: https://github.com/signup"
    read -r -p "  Cuando termines de crearla, apretá Enter para seguir. " _ </dev/tty || true
  fi
  echo "  Ahora mandale tu USUARIO de GitHub a Guie. Él te invita y te llega un correo de GitHub."
  pregunta "¿Ya aceptaste la invitación de GitHub?" || falla "Sin eso no puedo seguir. Aceptá la invitación (buscá un correo de GitHub) y volvé a correr el instalador."
  if gh auth status >/dev/null 2>&1; then ok "ya tenés sesión en GitHub"; else
    echo "  Ahora se abre el navegador para que entres con tu cuenta de GitHub. Seguí los pasos y volvé acá."
    gh auth login --web --git-protocol https || falla "No se completó el login de GitHub. Volvé a correr el instalador."
  fi
  gh auth setup-git || falla "No pude conectar git con tu sesión de GitHub. Mandale a Guie una foto de lo que se ve arriba."
  ok "git usa tu sesión de GitHub para las actualizaciones"
fi

paso "Claude Code"
if tiene claude; then ok "Claude Code ya está"; else
  if pregunta "¿Instalo Claude Code con el instalador oficial? Puede tardar unos minutos."; then
    curl -fsSL https://claude.ai/install.sh | bash || falla "No se pudo instalar Claude Code. Mandale a Guie una foto de lo que se ve arriba."
  else
    falla "Sin Claude Code no hay kit. Volvé a correr esto cuando quieras."
  fi
fi
if ! tiene claude && [[ -x "$HOME/.local/bin/claude" ]]; then
  export PATH="$HOME/.local/bin:$PATH"
  persistir 'export PATH="$HOME/.local/bin:$PATH"'
fi
tiene claude || falla "Instalé Claude Code pero no lo encuentro. Cerrá esta ventana, abrí otra Terminal y volvé a correr el instalador."

paso "Conectar el kit"
if claude plugin marketplace list 2>/dev/null | grep -q "$MARKETPLACE"; then ok "el kit ya está conectado"; else
  claude plugin marketplace add "$KIT_REPO" \
    || falla "No pude conectar el kit. Casi seguro falta aceptar la invitación de GitHub. Aceptala y corré el instalador de nuevo."
fi
# El kit tiene que venir del repo oficial: un fork con el mismo nombre no se acepta.
origen="$(node -e 'try{const s=require(require("os").homedir()+"/.claude/plugins/known_marketplaces.json")["tpp-claude-kit"].source;process.stdout.write(String(s.repo||s.url||s.path||""))}catch(e){}')"
normalizado="$(printf '%s' "$origen" | tr '[:upper:]' '[:lower:]' | sed -e 's#^https://github.com/##' -e 's#[.]git$##' -e 's#/*$##')"
[[ "$normalizado" == "$(printf '%s' "$KIT_REPO" | tr '[:upper:]' '[:lower:]')" ]] \
  || falla "Ya hay un kit con el mismo nombre que NO viene del repo oficial (${origen:-desconocido}). No lo uses: mandale esto a Guie."
ok "el kit viene del repo oficial ($KIT_REPO)"
for plugin in tpp tpp-guardrails; do
  claude plugin install "$plugin@$MARKETPLACE" || falla "No pude instalar $plugin. Mandale a Guie una foto de lo que se ve arriba."
done
lista="$(claude plugin list 2>/dev/null || true)"
for plugin in tpp tpp-guardrails; do
  grep -q "$plugin@$MARKETPLACE" <<<"$lista" || falla "No veo $plugin instalado. Mandale a Guie una foto de lo que se ve arriba."
done
ok "el kit y sus candados están instalados"

paso "Listo"
echo "  En esta misma ventana escribí claude y apretá Enter."
echo "  La primera vez te pide entrar con tu cuenta de Claude en el navegador."
echo "  Cuando estés adentro, escribí:"
echo ""
echo "      /tpp:bienvenida"
echo ""
echo "  El asistente termina de configurar todo según tu equipo."
