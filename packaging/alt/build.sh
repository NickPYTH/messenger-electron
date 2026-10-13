#!/bin/sh
# Сборка RPM на Альт Linux. Запускать из любой папки, от обычного пользователя.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
cd "$ROOT"

if [ "$(uname -m)" != "x86_64" ]; then
    echo "Нужна система x86_64. Electron 44 не публикует 32-битный Linux." >&2
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "Нет node. Сначала: apt-get install nodejs npm" >&2
    exit 1
fi

if ! command -v rpmbuild >/dev/null 2>&1; then
    echo "Нет rpmbuild. Сначала: apt-get install rpm-build" >&2
    exit 1
fi

node -e 'const major = Number(process.versions.node.split(".")[0]); if (major < 18) { console.error("Нужен Node.js 18 или новее, сейчас " + process.versions.node); process.exit(1); }'

echo "Ставлю зависимости npm и бинарник Electron для Linux..."
npm install

echo "Собираю каталог приложения..."
npx electron-builder --linux dir --x64

if [ ! -x "$ROOT/dist/linux-unpacked/messenger-electron" ]; then
    echo "Не найден dist/linux-unpacked/messenger-electron" >&2
    ls -la "$ROOT/dist/linux-unpacked" >&2 || true
    exit 1
fi

rm -rf "$ROOT/packaging/alt/rpmbuild"
mkdir -p "$ROOT/packaging/alt/rpmbuild"

rpmbuild -bb "$ROOT/packaging/alt/messenger-electron.spec" \
    --define "_topdir $ROOT/packaging/alt/rpmbuild" \
    --define "unpacked_dir $ROOT/dist/linux-unpacked" \
    --define "desktop_file $ROOT/packaging/alt/messenger-electron.desktop" \
    --define "icon_file $ROOT/assets/tray-icon.png"

echo
echo "Готовый пакет:"
find "$ROOT/packaging/alt/rpmbuild/RPMS" -type f -name '*.rpm'
