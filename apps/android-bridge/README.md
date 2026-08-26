# Music Bridge para Android

`Music Bridge` convierte un teléfono Android que permanece en casa en el enlace local entre WiiM y la aplicación web desplegada en Vercel. No reproduce audio, no expone puertos de la red doméstica y sólo envía cambios relevantes de reproducción mediante HTTPS firmado.

## Uso

1. En Music, abre **WiiM local → Conectar Android** e introduce el código de acceso de la web.
2. Copia en el teléfono sólo el PIN numérico de seis dígitos que aparece en pantalla. Music Bridge ya está configurado para `https://musicwiim.vercel.app`. El PIN caduca a los diez minutos y sólo sirve una vez.
3. Instala y abre `Music Bridge`, introduce ambos datos y toca **Emparejar y comenzar**.
4. Deja el teléfono conectado al cargador y a la misma Wi-Fi que el WiiM. La notificación persistente confirma que el puente está activo.

La app usa SSDP para descubrir automáticamente un WiiM. Si el equipo cambia de IP o deja de responder, vuelve a descubrirlo después de tres consultas fallidas. No hay un campo de IP manual: el teléfono no debe requerir mantenimiento habitual.

## Compilar e instalar durante el MVP

Este repositorio contiene el proyecto Android nativo; necesita Android Studio Panda 3 (2025.3.3 Patch 1) o posterior, Android Gradle Plugin 9.1.1 y Android SDK 37 para generar el APK. El proyecto usa el Kotlin integrado de AGP 9; no agregues el plugin `org.jetbrains.kotlin.android`.

1. Abre esta carpeta (`apps/android-bridge`) en Android Studio.
2. Permite que Android Studio instale Gradle 9.3.1 y Android SDK Platform 37 cuando lo solicite.
3. Ejecuta la aplicación en el teléfono por USB o genera un APK de depuración desde **Build → Build APK(s)**.

La comunicación local con WiiM usa HTTP porque ésa es la interfaz LAN disponible del dispositivo. El tráfico hacia Music usa exclusivamente HTTPS. La clave de firma se genera dentro de Android Keystore y no se envía al servidor: el servidor sólo recibe la clave pública al emparejar.

## Limitaciones intencionales

- Android puede retrasar servicios en segundo plano; por eso el puente es un foreground service y muestra una notificación persistente.
- El teléfono debe permanecer encendido, en la Wi-Fi local y preferiblemente cargando para detectar cambios sin depender de un computador.
- En Android 17 / API 37, concede **Dispositivos cercanos**: Android bloquea por defecto SSDP y las conexiones LAN hasta que se aprueba `ACCESS_LOCAL_NETWORK`.
