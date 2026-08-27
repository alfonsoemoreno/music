"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ThemeName = "studio" | "neon" | "vintage";
const themes: Record<ThemeName, { label: string; background: string; grid: string; bars: string[]; glow: string }> = {
  studio: { label: "Estudio", background: "#071008", grid: "#153e1b", bars: ["#12ef38", "#b6ef16", "#ffcb13", "#ff3131"], glow: "#10ff38" },
  neon: { label: "Neón", background: "#080510", grid: "#2b1745", bars: ["#00d8ff", "#7c4dff", "#f02bda", "#ffb000"], glow: "#e838ff" },
  vintage: { label: "Radio", background: "#1b120d", grid: "#59321e", bars: ["#f3aa3c", "#ed6c41", "#d94f78", "#b74f8e"], glow: "#ff9c43" },
};

const WaveIcon = (): React.JSX.Element => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h2l2.1-6 3.2 12L13 3l2.1 15L17 9l1.3 3H21" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>;

export const SpectrumAnalyzer = (): React.JSX.Element => {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("studio");
  const [message, setMessage] = useState("El analizador escucha el ambiente de esta habitación.");
  const canvas = useRef<HTMLCanvasElement>(null);
  const analyser = useRef<AnalyserNode | undefined>(undefined);
  const audioContext = useRef<AudioContext | undefined>(undefined);
  const stream = useRef<MediaStream | undefined>(undefined);
  const animation = useRef<number | undefined>(undefined);

  const stop = useCallback((): void => {
    if (animation.current) cancelAnimationFrame(animation.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = undefined;
    analyser.current = undefined;
    void audioContext.current?.close();
    audioContext.current = undefined;
  }, []);

  const close = useCallback((): void => {
    stop();
    setOpen(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [stop]);

  const start = async (): Promise<void> => {
    setOpen(true);
    setMessage("Solicitando acceso al micrófono…");
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false } });
      const context = new AudioContext();
      const node = context.createAnalyser();
      node.fftSize = 2048;
      node.smoothingTimeConstant = .78;
      context.createMediaStreamSource(input).connect(node);
      stream.current = input;
      audioContext.current = context;
      analyser.current = node;
      setMessage("Micrófono activo · audio procesado solo en este dispositivo");
    } catch {
      setMessage("No se pudo acceder al micrófono. Autorízalo en el navegador y vuelve a intentarlo.");
    }
  };

  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    const onFullscreen = (): void => { if (!document.fullscreenElement && open) { stop(); setOpen(false); } };
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, [open, stop]);

  useEffect(() => {
    if (!open) return;
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;
    const bins = new Uint8Array(1024);
    const resize = (): void => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      element.width = element.clientWidth * ratio;
      element.height = element.clientHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const draw = (): void => {
      const activeTheme = themes[theme];
      const width = element.clientWidth; const height = element.clientHeight;
      context.fillStyle = activeTheme.background; context.fillRect(0, 0, width, height);
      context.strokeStyle = activeTheme.grid; context.lineWidth = 1;
      for (let y = 0; y < height; y += Math.max(26, height / 12)) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
      const barCount = Math.min(64, Math.max(28, Math.floor(width / 18)));
      const gap = Math.max(3, width / barCount * .23); const barWidth = (width - gap * (barCount - 1)) / barCount;
      if (analyser.current) analyser.current.getByteFrequencyData(bins);
      context.shadowBlur = 14; context.shadowColor = activeTheme.glow;
      for (let index = 0; index < barCount; index += 1) {
        const bin = Math.min(bins.length - 1, Math.floor(Math.pow(index / barCount, 1.8) * bins.length));
        const value = analyser.current ? bins[bin] / 255 : .04;
        const total = Math.max(8, value * (height - 34)); const segments = Math.max(1, Math.ceil(total / 13));
        for (let segment = 0; segment < segments; segment += 1) {
          const level = segment / Math.max(segments - 1, 1);
          context.fillStyle = activeTheme.bars[Math.min(activeTheme.bars.length - 1, Math.floor(level * activeTheme.bars.length))];
          const y = height - 14 - (segment + 1) * 13;
          context.fillRect(index * (barWidth + gap), y, barWidth, 9);
        }
      }
      context.shadowBlur = 0;
      animation.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { observer.disconnect(); if (animation.current) cancelAnimationFrame(animation.current); };
  }, [open, theme]);

  return <><button className="spectrum-trigger" type="button" aria-label="Abrir analizador de espectro" onClick={() => void start()}><WaveIcon /></button>{open ? <section className={`spectrum-overlay ${theme}`} aria-label="Analizador de espectro"><header><div className="spectrum-actions"><div className="theme-picker" aria-label="Diseño del analizador">{(Object.keys(themes) as ThemeName[]).map((name) => <button className={name === theme ? "selected" : ""} key={name} onClick={() => setTheme(name)}>{themes[name].label}</button>)}</div><button className="spectrum-close" type="button" onClick={close}>Cerrar</button></div></header><div className="spectrum-stage"><canvas ref={canvas} /><div className="spectrum-scale"><span>40 Hz</span><span>160 Hz</span><span>630 Hz</span><span>2.5 kHz</span><span>10 kHz</span><span>16 kHz</span></div></div><footer><span className="spectrum-led" />{message}</footer></section> : null}</>;
};
