# Music Bridge para macOS

App nativa para Mac que se queda en la red local, descubre un WiiM y publica sólo los cambios de reproducción en Music. Es el equivalente macOS del puente Android.

## Compilar

Requiere macOS 14 o posterior y Xcode 16+ (la instalación gratuita desde App Store basta; no se necesita cuenta Apple Developer).

```zsh
cd apps/macos-bridge
chmod +x scripts/package-unsigned.sh
scripts/package-unsigned.sh
```

El instalador queda en `dist/Music-Bridge-unsigned.dmg`.

## Compartir sin pagar a Apple

No está firmado ni notarizado. Al recibirlo, la otra persona debe mover la app a Aplicaciones, hacer **clic secundario → Abrir** y confirmar **Abrir** una sola vez. Gatekeeper mostrará este aviso inicial por ser una app de un desarrollador no identificado; no hace falta desactivar la protección del Mac.

Al abrirla, introduce el PIN de seis dígitos que aparece en Music, deja el Mac conectado a la misma red que el WiiM y la app seguirá sincronizando mientras esté abierta.
