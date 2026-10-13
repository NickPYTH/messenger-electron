Name: messenger-electron
Version: 1.0.0
Release: alt1
Summary: Desktop wrapper for the SGP messenger
License: ISC
Group: Networking/Instant messaging
Url: https://github.com/NickPYTH/messenger-electron
ExclusiveArch: x86_64

# Готовый бинарник Electron. Его внутренние .so нельзя отдать автопоиску
# зависимостей: rpm начнёт требовать библиотеки, которых в репозитории Альт нет.
AutoReqProv: no
%global __os_install_post %{nil}
%global debug_package %{nil}

Requires: libgtk+3
Requires: nss
Requires: nspr
Requires: libalsa
Requires: libcups
Requires: libX11
Requires: libXcomposite
Requires: libXdamage
Requires: libXext
Requires: libXfixes
Requires: libXrandr
Requires: libXScrnSaver
Requires: libXtst
Requires: libdrm
Requires: libgbm
Requires: libpango
Requires: libatk
Requires: gdk-pixbuf
Requires: libnotify
Requires: ca-certificates
Requires: xdg-utils
Requires: fonts-ttf-liberation

%description
Окно мессенджера SGP, значок в трее и локальный HTTP-сервер на порту 3737.
Счётчик непрочитанных рисуется на значке. Для KDE файл меню называется
messenger-electron.desktop — это же имя ждёт приложение.

%prep
%build

%install
rm -rf %{buildroot}
test -x %{unpacked_dir}/messenger-electron

mkdir -p %{buildroot}/opt/messenger-electron
cp -a %{unpacked_dir}/. %{buildroot}/opt/messenger-electron/
chmod 755 %{buildroot}/opt/messenger-electron/messenger-electron
chmod 4755 %{buildroot}/opt/messenger-electron/chrome-sandbox

mkdir -p %{buildroot}%{_bindir}
cat > %{buildroot}%{_bindir}/messenger-electron << 'END'
#!/bin/sh
exec /opt/messenger-electron/messenger-electron "$@"
END
chmod 755 %{buildroot}%{_bindir}/messenger-electron

mkdir -p %{buildroot}%{_datadir}/applications
install -m 644 %{desktop_file} %{buildroot}%{_datadir}/applications/messenger-electron.desktop

mkdir -p %{buildroot}%{_datadir}/icons/hicolor/256x256/apps
install -m 644 %{icon_file} %{buildroot}%{_datadir}/icons/hicolor/256x256/apps/messenger-electron.png

%files
%defattr(-,root,root,-)
/opt/messenger-electron
%{_bindir}/messenger-electron
%{_datadir}/applications/messenger-electron.desktop
%{_datadir}/icons/hicolor/256x256/apps/messenger-electron.png
