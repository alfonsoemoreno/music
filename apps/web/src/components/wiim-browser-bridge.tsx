"use client";

import { useState } from "react";

interface Enrollment { code: string; expiresAt: string; serverUrl: string }

/** Web-side onboarding for the Android bridge. The browser never talks to the WiiM. */
export const WiiMBrowserBridge = (): React.JSX.Element => {
  const [open, setOpen] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment>();
  const [message, setMessage] = useState("");

  const createEnrollment = async (): Promise<void> => {
    setMessage("Creando código seguro…");
    const session = await fetch("/api/browser/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: accessCode }) });
    if (!session.ok) { setMessage(session.status === 503 ? "El acceso de la web aún no está configurado." : "El código de acceso no es válido."); return; }
    const response = await fetch("/api/bridges/enrollments", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (!response.ok) { setMessage("No fue posible crear el código. Comprueba Neon e inténtalo nuevamente."); return; }
    setEnrollment(await response.json() as Enrollment);
    setMessage("");
  };

  if (!open) return <section className="local-wiim-bridge"><button type="button" onClick={() => setOpen(true)}>Conectar Android</button></section>;
  if (enrollment) return <section className="local-wiim-bridge bridge-enrollment"><p><strong>Music Bridge</strong><br />En Android, instala la app e ingresa estos datos antes de {new Date(enrollment.expiresAt).toLocaleTimeString()}.</p><code>{enrollment.serverUrl}</code><code>{enrollment.code}</code><button type="button" onClick={() => { setEnrollment(undefined); setOpen(false); }}>Listo</button></section>;
  return <section className="local-wiim-bridge bridge-setup"><p>Usa un Android conectado a la misma red del WiiM. El teléfono hará el descubrimiento local; esta web no necesita IP.</p><div className="bridge-controls"><input aria-label="Código de acceso a Music" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Código de acceso Music" type="password" /><button type="button" onClick={() => void createEnrollment()}>Generar código Android</button><button type="button" onClick={() => setOpen(false)}>Cancelar</button></div>{message ? <p>{message}</p> : null}</section>;
};
