# Сборка RPM для Альт Linux 10 и 11

Эта инструкция для ноутбука с Альт Linux, куда скопирован этот репозиторий. На выходе получается RPM в формате Альт (`Release: alt1`). Его можно поставить локально или положить в свой apt-репозиторий.

Пакет не предназначен для официального Сизифа: туда пакеты сдают через gear и hasher. Здесь сборка проще: `npm` собирает каталог Electron, `rpmbuild` упаковывает его.

Нужна система **x86_64**. Electron 44 не выпускает 32-битный Linux.

Не копируйте с Windows папку `node_modules`. Бинарник Electron там windows-овский. На Альте его скачает `npm install`. Для этого ноутбуку нужен интернет, в том числе доступ к GitHub (оттуда берётся Electron).

## 1. Пакеты для сборки

Команды с `apt-get` выполняются от root.

```bash
apt-get update
apt-get install nodejs npm rpm-build git zip
node -v
```

Нужен Node.js 18 или новее. Если `node -v` показывает 16 или меньше, репозиторного Node на этой ветке мало, и `npm install` дальше не пройдёт.

Имена пакетов ниже — из веток p10 и p11. Если `apt-get` напишет, что пакета нет, имя на этой ветке другое: ищите его через `apt-cache search` и ставьте найденное.

Библиотеки, без которых окно Electron не откроется:

```bash
apt-get install libgtk+3 nss nspr libalsa libcups \
  libX11 libXcomposite libXdamage libXext libXfixes libXrandr libXScrnSaver libXtst \
  libdrm libgbm libpango libatk gdk-pixbuf libnotify \
  ca-certificates xdg-utils fonts-ttf-liberation
```

Значок в трее KDE. Electron подгружает одну из этих библиотек. Поставьте ту, которая есть в ветке:

```bash
apt-cache search appindicator
apt-get install libayatana-appindicator-gtk3
```

Если такого пакета нет, поставьте пакет из вывода `apt-cache search`, в имени которого есть `appindicator` и `gtk3`.

## 2. Сборка

От обычного пользователя, в корне скопированного репозитория:

```bash
chmod +x packaging/alt/build.sh
./packaging/alt/build.sh
```

Скрипт делает три вещи:

1. `npm install` — зависимости и Electron для Linux.
2. `npx electron-builder --linux dir --x64` — каталог `dist/linux-unpacked/`.
3. `rpmbuild -bb packaging/alt/messenger-electron.spec` — RPM.

Готовый файл:

```text
packaging/alt/rpmbuild/RPMS/x86_64/messenger-electron-1.0.0-alt1.x86_64.rpm
```

Если GitHub не отдаёт архив Electron, перед скриптом можно указать зеркало и запустить сборку ещё раз:

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
./packaging/alt/build.sh
```

Версия в пакете записана в `packaging/alt/messenger-electron.spec` (`Version` и `Release`). При следующем выпуске поднимите `Version` вместе с `package.json`. Новая пересборка той же версии — это `alt2`, `alt3` и дальше.

## 3. Установка на эту же машину

От root, путь подставьте свой:

```bash
apt-get install /полный/путь/messenger-electron-1.0.0-alt1.x86_64.rpm
```

Либо, если apt откажется от файла:

```bash
rpm -Uvh /полный/путь/messenger-electron-1.0.0-alt1.x86_64.rpm
```

Запуск: пункт меню «Чатики» или команда `messenger-electron`.

Проверка песочницы. Файл должен принадлежать root и иметь бит setuid:

```bash
ls -l /opt/messenger-electron/chrome-sandbox
```

Ожидается `-rwsr-xr-x`. Если бита `s` нет, Electron напишет, что sandbox helper настроен неверно. Тогда от root:

```bash
chown root:root /opt/messenger-electron/chrome-sandbox
chmod 4755 /opt/messenger-electron/chrome-sandbox
```

Файл меню называется `messenger-electron.desktop`. Приложение ищет именно это имя, чтобы KDE мог показать счётчик на панели. Цифра на значке трея от этого файла не зависит: она нарисована на иконке.

## 4. Свой репозиторий

Так пакет ставится на другие машины Альт той же ветки (p10 или p11) и той же архитектуры. Репозиторий, собранный на p10, не подмешивайте к p11.

Пакет `apt-repo-tools` даёт команду `genbasedir`.

```bash
apt-get install apt-repo-tools

mkdir -p "$HOME/repo/x86_64/RPMS.classic"
cp packaging/alt/rpmbuild/RPMS/x86_64/messenger-electron-1.0.0-alt1.x86_64.rpm \
  "$HOME/repo/x86_64/RPMS.classic/"

cd "$HOME/repo"
genbasedir --create --progress --topdir=. x86_64 classic
```

Появится каталог `x86_64/base` с индексами. На машине, где репозиторий будет использоваться, от root добавьте строку в `/etc/apt/sources.list`:

```text
rpm-dir file:///home/пользователь/repo x86_64 classic
```

Если репозиторий лежит на другом компьютере и раздаётся по HTTP, строка такая:

```text
rpm http://адрес-сервера/путь-до-repo x86_64 classic
```

Дальше:

```bash
apt-get update
apt-get install messenger-electron
```

Повторная публикация: положите новый RPM в `RPMS.classic`, удалите старый файл той же версии, если он больше не нужен, и снова выполните `genbasedir` из каталога репозитория.

## Если сборка остановилась

`unknown group` в spec — на этой ветке нет группы `Networking/Instant messaging`. В `packaging/alt/messenger-electron.spec` замените строку `Group:` на `Group: Other` и запустите скрипт снова.

`Не найден dist/linux-unpacked/messenger-electron` — посмотрите список файлов в `dist/linux-unpacked/`. Исполняемый файл должен называться `messenger-electron`, это задано в `package.json` полем `build.linux.executableName`.

Окно стартует и сразу падает с ошибкой библиотеки — доставьте пакет, в котором лежит названная `.so`:

```bash
apt-file search имя-библиотеки.so
```

Пакет `apt-file` ставится отдельно, после установки нужен `apt-file update`.

Трей пустой при живом окне — не встала библиотека appindicator из первого раздела. Значок KDE рисуется через неё.
