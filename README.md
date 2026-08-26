# Music — Digital Album Companion

Una compañía visual para el álbum que se está reproduciendo en un WiiM. No reproduce, descarga ni captura audio.

## Estado del MVP

El repositorio contiene el primer vertical: el agente consulta un WiiM, normaliza estado, evita eventos por cambios de progreso, los envía por HTTPS a `POST /api/agent/playback` y la web consulta `GET /api/playback/now` cada dos segundos. La interfaz está deliberadamente centrada en la portada y el álbum, no en controles de reproducción.

Cuando existe `DATABASE_URL`, `now playing` se persiste en Neon y funciona entre invocaciones Vercel. Sin esa variable, el desarrollo local usa una memoria global de un único proceso Next.js; no es persistente ni adecuada para despliegue.

## WiiM: hallazgo técnico validado

WiiM publica una [API HTTP oficial](https://www.wiimhome.com/pdf/HTTP%20API%20for%20WiiM%20Products.pdf): `getStatusEx` entrega identidad y firmware, mientras `getPlayerStatus` garantiza estado, modo/fuente, posición y duración. WiiM también declara HTTP y UPnP como interfaces de integración en su [página de soporte](https://www.wiimhome.com/support/index). El manual actual del Ultra documenta mDNS y UPnP/DLNA en LAN.

Limitación importante: la respuesta HTTP publicada no garantiza campos de artista, álbum, track o artwork. Por ello el normalizador acepta los campos que algunos firmwares exponen, pero el siguiente hito debe capturar una respuesta real del Ultra con Qobuz/TIDAL y añadir el adaptador UPnP `AVTransport` para la metadata que exista. No se presupone que todos los proveedores expongan los mismos campos.

Validación real: WiiM Ultra con firmware `Linkplay.5.2.826052` entrega Qobuz en `vendor` y los campos `Title`, `Artist` y `Album` como texto hexadecimal UTF-8. El agente los decodifica; este comportamiento se cubre con un test de regresión.

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
cp .env.example apps/wiim-agent/.env
# Completa AGENT_TOKEN. WIIM_HOST es opcional: el agente descubre WiiM automáticamente.
pnpm install
pnpm dev
```

En `apps/web/.env.local`, configura el mismo `AGENT_TOKEN` para desarrollo. Abre `http://localhost:3000`; el estado del agente aparece en `http://localhost:3847`.

Para que un iPad/tablet cargue inmediatamente carátulas de USB, el agente detecta automáticamente la interfaz LAN que comparte subred con el WiiM y publica sólo `/artwork/current` dentro de esa LAN. `/debug` sigue restringido a localhost; no abre ni configura puertos en el router. `LOCAL_ARTWORK_BASE_URL` es únicamente un override para Docker o redes inusuales.

Para inspeccionar exactamente qué expone el firmware del WiiM, abre `http://localhost:3847/debug`. No incluye el token; comparte sólo `rawMetadata` si se necesita soporte técnico.

Comandos: `pnpm web:dev`, `pnpm agent:dev`, `pnpm test`, `pnpm build`, `pnpm lint`.

## Producción y datos

- Vercel aloja únicamente `apps/web`; el agente siempre inicia conexiones salientes HTTPS.
- Neon es PostgreSQL de producción. `pnpm db:generate` genera migraciones y `pnpm db:migrate` las aplica una vez configurado `DATABASE_URL`.
- La aplicación usa HTTP serverless de Neon; la CLI de migraciones usa `pg` con TLS, por lo que no depende de WebSocket.
- Para producción, los tokens de agentes deben aprovisionarse como hashes en `agents.tokenHash`; el secreto compartido de `.env` sólo es el bootstrap de desarrollo y no debe usarse para varios amigos.
- `apps/wiim-agent/install-macos.sh` instala el agente como `~/Library/LaunchAgents/com.digitalalbum.agent.plist`.

### WiiM desde el navegador (sin agente mientras la pestaña esté abierta)

Además del agente, la web puede sincronizar directamente con el WiiM de la misma red local mientras la pestaña se mantiene abierta. Es útil para un iPad o para amigos que no desean dejar un computador encendido. En Vercel define `BROWSER_ACCESS_CODE` (un código compartido para tu grupo) y `BROWSER_SESSION_SECRET` (un secreto aleatorio, por ejemplo generado con `openssl rand -base64 32`). No uses ni expongas `AGENT_TOKEN` en el navegador.

Al abrir la aplicación, usa **Conectar WiiM**, ingresa el código y deja vacío el host para intentar `wiim.local` / `wiim-ultra.local`. Si el router no publica esos nombres, ingresa la IP local una sola vez: queda guardada únicamente en ese navegador. La pestaña consulta `getStatusEx` y `getPlayerStatus` cada cuatro segundos y publica sólo cambios de pista, álbum, fuente o estado; no registra progreso de reproducción.

Esta modalidad depende de que Safari/Chrome permita al sitio HTTPS acceder a la API HTTP local del WiiM. Es una restricción de seguridad del navegador y de los encabezados CORS del firmware, no una capacidad de Vercel. Por eso debe probarse en el iPad/red reales; si se bloquea, el agente sigue siendo la opción que funciona de forma continua y sin depender de la pestaña.

## Siguiente hito crítico

Con el Ultra encendido, el agente usa SSDP para descubrirlo y vuelve a intentarlo periódicamente si está apagado o cambia de IP DHCP. `WIIM_HOST` existe sólo como fallback para redes que bloquean multicast. Se necesita guardar de forma segura (sin token) la salida de `getStatusEx`, `getPlayerStatus` y el `description.xml` UPnP para confirmar exactamente qué metadata entrega el firmware. Sólo entonces se conecta el adaptador de metadata definitivo y se habilita MusicBrainz/CAA.
