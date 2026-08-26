# Music — Digital Album Companion

Una compañía visual para el álbum que se reproduce mediante WiiM. Music no reproduce, descarga ni captura audio: muestra portada, libreto, contexto, créditos y ediciones mientras la música sigue en Qobuz, Tidal, Spotify, USB o radio.

## Arquitectura actual

```text
WiiM Ultra ── LAN/HTTP ──> Android Music Bridge ── HTTPS firmado ──> Music (Vercel + Neon)
                                                                     │
                                                               iPad / navegador
```

La web alojada en Vercel no puede consultar de forma fiable una API HTTP de una IP privada desde un navegador HTTPS. En cambio, un teléfono Android que permanece en casa consulta el WiiM localmente, lo descubre por SSDP y publica sólo los cambios relevantes. No se abre ningún puerto del router ni se conserva una IP del WiiM en la nube.

## Requisitos

- Node.js 24.x y pnpm 10+ para la web.
- Neon PostgreSQL para producción.
- Un teléfono Android conectado a la misma Wi-Fi que el WiiM para el puente local. Es recomendable dejarlo cargando.
- Android Studio Panda 3 (2025.3.3 Patch 1) o posterior, con Android SDK 37, para compilar la app `Music Bridge`.

## Ejecutar la web

```sh
nvm use 24
pnpm install
pnpm web:dev
```

Configura `apps/web/.env.local` a partir de `.env.example`. Para producción, define las mismas variables en Vercel. Se necesitan al menos:

```dotenv
DATABASE_URL=
```

Luego aplica las migraciones, incluida la del puente Android:

```sh
pnpm db:migrate
```

## Emparejar Music Bridge

1. En la web de Music, usa **Conectar Android**.
2. La página muestra de inmediato un PIN numérico de seis dígitos, temporal y de un solo uso.
3. Abre `apps/android-bridge` en Android Studio, instala la app en el teléfono y pega sólo el PIN. La app Android está fijada a `https://musicwiim.vercel.app`.
4. Toca **Emparejar y comenzar**. Android crea una clave privada local en Keystore y entrega a Music únicamente su clave pública.
5. Deja visible la notificación `Music Bridge activo`. El teléfono descubre el WiiM sin IP manual y envía cambios de pista, álbum, fuente, pausa o reproducción.

El código de emparejamiento expira en diez minutos. Cada publicación posterior incluye una firma ECDSA, fecha y nonce de uso único; la nube rechaza eventos no firmados o repetidos.

Consulta [la guía del proyecto Android](apps/android-bridge/README.md) para compilar el APK de depuración durante este MVP.

## Metadatos y experiencia editorial

MusicBrainz identifica artista/álbum/release/tracklist y guarda MBIDs. Cover Art Archive se usa como respaldo de portada; las portadas expuestas por la fuente de reproducción se priorizan cuando WiiM las entrega. Discogs aporta ediciones físicas, créditos e imágenes; Fanart.tv añade arte suplementario separado; Wikipedia/Wikidata aportan contexto; Last.fm aporta tags opcionales. Las llamadas se almacenan en Neon y se ejecutan progresivamente, sin impedir que el cambio de álbum aparezca primero.

La nota de escucha de OpenAI es opcional y se genera bajo demanda usando sólo el contexto editorial ya guardado. Configura `OPENAI_API_KEY` (y opcionalmente `OPENAI_MODEL`) para habilitarla.

## Comandos de calidad

```sh
pnpm lint
pnpm test
pnpm build:verify
```

## Límites conocidos

- La API LAN de WiiM no garantiza exactamente los mismos metadatos en Qobuz, Tidal, Spotify, USB y radio. El puente normaliza lo que el firmware expone y el cloud resuelve el resto sin inventar datos.
- Android puede limitar aplicaciones en segundo plano: Music Bridge se ejecuta como servicio visible y necesita que el teléfono permanezca encendido y conectado a Wi-Fi.
- La comunicación local hacia WiiM usa HTTP porque es la interfaz LAN que ofrece el dispositivo. El tráfico del teléfono a Music es HTTPS.
