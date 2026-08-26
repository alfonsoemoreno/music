"use client";

import { useState } from "react";

interface Enrollment { code: string; expiresAt: string; serverUrl: string }

/** Creates a phone pairing PIN immediately; the browser never talks to WiiM. */
export const WiiMBrowserBridge = (): React.JSX.Element => {
  const [enrollment, setEnrollment] = useState<Enrollment>();
  const [message, setMessage] = useState("");

  const createEnrollment = async (): Promise<void> => {
    setMessage("Generando PIN…");
    const response = await fetch("/api/bridges/enrollments", { method: "POST" });
    if (!response.ok) { setMessage("No fue posible generar el PIN. Comprueba Neon e inténtalo nuevamente."); return; }
    setEnrollment(await response.json() as Enrollment);
    setMessage("");
  };

  if (enrollment) return <section className="local-wiim-bridge bridge-enrollment"><p><strong>Music Bridge</strong><br />En Android, ingresa esta dirección y el PIN de seis dígitos antes de {new Date(enrollment.expiresAt).toLocaleTimeString()}.</p><code>{enrollment.serverUrl}</code><code>{enrollment.code}</code><button type="button" onClick={() => { setEnrollment(undefined); void createEnrollment(); }}>Generar otro PIN</button></section>;
  return <section className="local-wiim-bridge"><button type="button" onClick={() => void createEnrollment()}>Conectar Android</button>{message ? <p>{message}</p> : null}</section>;
};
