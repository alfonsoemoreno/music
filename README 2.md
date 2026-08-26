# Music — Digital Album Companion

Una compañía visual para el álbum que se está reproduciendo en un WiiM. No reproduce, descarga ni captura audio.

## Estado del MVP

El repositorio contiene una única aplicación Next.js. Mientras la pestaña está abierta, el navegador consulta el WiiM de su propia red local, publica sólo cambios relevantes y la web consulta `GET /api/playback/now` cada dos segundos. La interfaz está deliberadamente centrada en la portada y el álbum, no en controles de reproducción.

Cuando existe `DATABASE_URL`, `now playing` se persiste en Neon y funciona entre invocaciones Vercel. Sin esa variable, el desarrollo local usa una memoria global de un único proceso Next.js; no es persistente ni adecuada para despliegue.

## WiiM: hallazgo técnico validado

WiiM publica una [API HTTP oficial](https://www.wiimhome.com/pdf/HTTP%20API%20for%20WiiM%20Products.pdf): `getStatusEx` entrega identidad y firmware, mientras `getPlayerStatus` garantiza estado, modo/fuente, posición y duración. WiiM también declara HTTP y UPnP como interfaces de integración en su [página de soporte](https://www.wiimhome.com/support/index). El manual actual del Ultra documenta mDNS y UPnP/DLNA en LAN.

Limitación importante: la respuesta HTTP publicada no garantiza campos de artista, álbum, track o artwork. Por ello el normalizador acepta los campos que algunos firmwares exponen, pero el siguiente hito debe capturar una respuesta real del Ultra con Qobuz/TIDAL y añadir el adaptador UPnP `AVTransport` para la metadata que exista. No se presupone que todos los proveedores expongan los mismos campos.

Validación real: WiiM Ultra con firmware `Linkplay.5.2.826052` entrega Qobuz en `vendor` y los campos `Title`, `Artist` y `Album` como texto hexadecimal UTF-8. La web los decodifica antes de enviarlos al cloud.

## Enriquecimiento MusicBrainz

Al recibir una nueva canción, la web guarda primero el estado de reproducción y después intenta resolver artista/álbum/release/tracklist con MusicBrainz. Sólo acepta resultados con una confianza mínima de 75/100, guarda MBIDs y reutiliza los registros existentes en Neon. Las consultas se serializan a una por 1,1 segundos para respetar el límite público de MusicBrainz. La portada principal se referencia desde Cover Art Archive usando el MBID del release group; si no existe, la aplicación sigue mostrando la metadata sin portada.

## Discogs

Agrega `DISCOGS_TOKEN` a `apps/web/.env.local` y valida un token personal con `pnpm --filter @music/web discogs:verify`. Discogs es opcional: un error o ausencia de token no interrumpe MusicBrainz ni la vista principal. Para cada álbum se conservan hasta tres ediciones físicas candidatas; Booklet y Credits muestran únicamente el material asociado a la edición elegida, ya que una edición de streaming no identifica de forma fiable un prensado físico concreto.

## Wikipedia y Wikidata

No requieren token. Tras identificar un álbum con MusicBrainz, la nube busca una introducción breve y atribuida para el álbum y para el artista. Se conserva el enlace a Wikipedia y el identificador de Wikidata cuando está disponible; no se almacenan artículos completos. Si la fuente no responde o el resultado no es suficientemente claro, la ficha continúa funcionando sin ese bloque editorial.

La ficha muestra el estado persistente de MusicBrainz, Discogs y Wikipedia (`ready`, `loading`, `failed` o `not configured`). Los errores se conservan únicamente como diagnóstico técnico; no se muestran secretos.

## Fanart.tv y Last.fm

Ambas integraciones son opcionales. `FANARTTV_API_KEY` añade imágenes suplementarias asociadas al MBID del artista/release group y sólo se usa como material secundario de Booklet: la portada recibida desde Qobuz/TIDAL permanece prioritaria. `LASTFM_API_KEY` guarda hasta seis tags comunitarios del álbum, separados de los géneros canónicos de MusicBrainz. Las claves se configuran exclusivamente en `apps/web/.env.local` y nunca llegan al navegador.

## Notas de escucha con OpenAI

La integración con OpenAI es opcional y se activa sólo al pulsar **Crear nota de escucha** dentro de un álbum. Envía un contexto reducido ya almacenado (título, artista, géneros, tags, resumen editorial, tracklist y créditos) y devuelve una breve síntesis en español con hasta tres claves de escucha. No recibe el `rawMetadata` del WiiM, direcciones IP, tokens ni historial de escucha.

Configura `OPENAI_API_KEY` y, si se desea, `OPENAI_MODEL` en `apps/web/.env.local`. El valor por defecto es `gpt-4.1-mini`. La respuesta se guarda en Neon por álbum, de modo que abrir o volver a reproducir ese disco no genera nuevas llamadas. La nota no sustituye ni amplía las fuentes: se le instruye a ordenar únicamente los datos entregados y la interfaz lo identifica como síntesis editorial de OpenAI.

## Puesta en marcha

Requiere Node.js 24.x (la versión queda fijada en `.node-version` y `.nvmrc`) y pnpm 10 o superior. Con nvm: `nvm install 24 && nvm use 24`.

```sh
pnpm install
pnpm web:dev
```

Configura `BROWSER_ACCESS_CODE` y `BROWSER_SESSION_SECRET` en `apps/web/.env.local`. Abre `http://localhost:3000` y usa **Conectar WiiM** para el primer emparejamiento.

Comandos: `pnpm web:dev`, `pnpm test`, `pnpm build`, `pnpm lint`.

## Producción y datos

- Vercel aloja la aplicación web completa.
- Neon es PostgreSQL de producción. `pnpm db:generate` genera migraciones y `pnpm db:migrate` las aplica una vez configurado `DATABASE_URL`.
- La aplicación usa HTTP serverless de Neon; la CLI de migraciones usa `pg` con TLS, por lo que no depende de WebSocket.
### WiiM desde el navegador

La web sincroniza directamente con el WiiM de la misma red local mientras la pestaña se mantiene abierta. Es útil para un iPad o para amigos que no desean dejar un computador encendido. En Vercel define `BROWSER_ACCESS_CODE` (un código compartido para tu grupo) y `BROWSER_SESSION_SECRET` (un secreto aleatorio, por ejemplo generado con `openssl rand -base64 32`).

Al abrir la aplicación, usa **Conectar WiiM**, ingresa el código y deja vacío el host para intentar `wiim.local` / `wiim-ultra.local`. Si el router no publica esos nombres, ingresa la IP local una sola vez: queda guardada únicamente en ese navegador. La pestaña consulta `getStatusEx` y `getPlayerStatus` cada cuatro segundos y publica sólo cambios de pista, álbum, fuente o estado; no registra progreso de reproducción.

Esta modalidad depende de que Safari/Chrome permita al sitio HTTPS acceder a la API HTTP local del WiiM. Es una restricción de seguridad del navegador y de los encabezados CORS del firmware, no una capacidad de Vercel. Por eso debe probarse en el iPad/red reales.

## Siguiente hito crítico

Con el Ultra encendido, la web intenta `wiim.local` y `wiim-ultra.local`. Los navegadores no permiten enviar discovery SSDP/UPnP multicast, así que si esos nombres no existen en la red hay que indicar la IP local una única vez; se guarda sólo en ese navegador. Se necesita confirmar la compatibilidad de Safari/iPad con la API local del firmware antes de considerar este flujo definitivo.
