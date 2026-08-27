"use client";

import { useEffect, useState } from "react";

interface Enrollment { code: string; expiresAt: string }

/** The first screen: pairing is deliberately the only action before Music has a live album. */
export const WiiMBrowserBridge = (): React.JSX.Element => {
  const [enrollment, setEnrollment] = useState<Enrollment>();
  const [message, setMessage] = useState("Preparando un código seguro…");

  const createEnrollment = async (): Promise<void> => {
    setMessage("Preparando un código seguro…");
    try {
      const response = await fetch("/api/bridges/enrollments", { method: "POST" });
      if (!response.ok) throw new Error("No fue posible generar el PIN.");
      setEnrollment(await response.json() as Enrollment);
      setMessage("");
    } catch { setMessage("No pudimos generar el PIN. Comprueba la conexión e inténtalo nuevamente."); }
  };

  useEffect(() => { void createEnrollment(); }, []);

  return <section className="pairing-card" aria-live="polite">
    <div className="pairing-mark" aria-hidden="true">M</div>
    <p className="kicker">Tu sala de escucha</p>
    <h1>Conecta tu música<br /><em>con el álbum.</em></h1>
    <p className="pairing-intro">Music no reproduce audio. El teléfono Android observa tu WiiM en casa y trae a esta pantalla el disco que estás escuchando.</p>
    <ol className="pairing-steps">
      <li><span>1</span><div><strong>Abre Music Bridge en Android</strong><small>Conéctalo a la misma Wi‑Fi que tu WiiM.</small></div></li>
      <li><span>2</span><div><strong>Introduce este PIN</strong><small>Es personal, de un solo uso y dura diez minutos.</small></div></li>
      <li><span>3</span><div><strong>Reproduce un álbum</strong><small>La portada y el libreto aparecerán aquí automáticamente.</small></div></li>
    </ol>
    <div className="pairing-code-area">{enrollment ? <><code>{enrollment.code}</code><p>Válido hasta las {new Date(enrollment.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></> : <p className="pairing-message">{message}</p>}</div>
    <button type="button" className="pairing-refresh" onClick={() => void createEnrollment()}>Generar otro código</button>
    <p className="pairing-note">No necesitas indicar la IP del WiiM. Music Bridge lo descubre dentro de tu red local.</p>
  </section>;
};
