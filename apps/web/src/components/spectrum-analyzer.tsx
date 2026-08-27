"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ThemeName = "studio" | "neon" | "vintage";
type VisualizerName = "led" | "scope" | "mirror" | "radial" | "matrix" | "cascade" | "vu";
const themes: Record<ThemeName, { label: string; background: string; grid: string; bars: string[]; glow: string }> = {
  studio: { label: "Estudio", background: "#071008", grid: "#153e1b", bars: ["#12ef38", "#b6ef16", "#ffcb13", "#ff3131"], glow: "#10ff38" },
  neon: { label: "Neón", background: "#080510", grid: "#2b1745", bars: ["#00d8ff", "#7c4dff", "#f02bda", "#ffb000"], glow: "#e838ff" },
  vintage: { label: "Radio", background: "#1b120d", grid: "#59321e", bars: ["#f3aa3c", "#ed6c41", "#d94f78", "#b74f8e"], glow: "#ff9c43" },
};
const visualizers: Record<VisualizerName, string> = { led: "Barras", scope: "Oscilo", mirror: "Espejo", radial: "Radial", matrix: "Matriz", cascade: "Cascada", vu: "VU" };

const WaveIcon = (): React.JSX.Element => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h2l2.1-6 3.2 12L13 3l2.1 15L17 9l1.3 3H21" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>;

export const SpectrumAnalyzer = (): React.JSX.Element => {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("studio");
  const [visualizer, setVisualizer] = useState<VisualizerName>("led");
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
    const bins = new Uint8Array(1024); const waveform = new Uint8Array(2048);
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
      if (analyser.current) analyser.current.getByteTimeDomainData(waveform);
      const level = (index: number, count = barCount): number => analyser.current ? bins[Math.min(bins.length - 1, Math.floor(Math.pow(index / count, 1.8) * bins.length))] / 255 : .04;
      const color = (amount: number): string => activeTheme.bars[Math.min(activeTheme.bars.length - 1, Math.floor(amount * activeTheme.bars.length))];
      context.shadowBlur = 14; context.shadowColor = activeTheme.glow;
      if (visualizer === "scope") {
        context.beginPath(); context.lineWidth = 3; context.strokeStyle = activeTheme.bars[0];
        waveform.forEach((sample, index) => { const x = index / (waveform.length - 1) * width; const y = (sample / 255) * height; index ? context.lineTo(x, y) : context.moveTo(x, y); }); context.stroke();
      } else if (visualizer === "radial") {
        const centerX = width / 2; const centerY = height / 2; const radius = Math.min(width, height) * .17;
        for (let index = 0; index < barCount; index += 1) { const amount = level(index); const angle = index / barCount * Math.PI * 2 - Math.PI / 2; const length = 9 + amount * Math.min(width, height) * .29; context.strokeStyle = color(amount); context.lineWidth = Math.max(2, barWidth * .55); context.beginPath(); context.moveTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius); context.lineTo(centerX + Math.cos(angle) * (radius + length), centerY + Math.sin(angle) * (radius + length)); context.stroke(); }
      } else if (visualizer === "vu") {
        const left = bins.slice(0, 110).reduce((total, value) => total + value, 0) / (110 * 255); const right = bins.slice(110, 400).reduce((total, value) => total + value, 0) / (290 * 255);
        [left, right].forEach((amount, index) => { const x = width * (.23 + index * .42); const meterHeight = height * .7; const segments = 22; for (let segment = 0; segment < segments; segment += 1) { const y = height * .85 - (segment + 1) * meterHeight / segments; context.fillStyle = segment / segments < amount ? color(segment / segments) : activeTheme.grid; context.fillRect(x, y, width * .15, meterHeight / segments - 4); } });
      } else {
        for (let index = 0; index < barCount; index += 1) {
          const amount = level(index); const total = Math.max(8, amount * (height - 34)); const segments = Math.max(1, Math.ceil(total / 13));
          if (visualizer === "matrix" || visualizer === "cascade") {
            const rows = visualizer === "matrix" ? 18 : 26; const activeRows = Math.max(1, Math.ceil(amount * rows));
            for (let row = 0; row < activeRows; row += 1) { const y = visualizer === "cascade" ? (row / rows * (height - 24)) : height - 14 - (row + 1) * (height - 28) / rows; context.fillStyle = color(row / rows); context.beginPath(); context.arc(index * (barWidth + gap) + barWidth / 2, y, Math.min(barWidth * .34, 5), 0, Math.PI * 2); context.fill(); }
          } else {
            for (let segment = 0; segment < segments; segment += 1) { const y = height - 14 - (segment + 1) * 13; context.fillStyle = color(segment / Math.max(segments - 1, 1)); context.fillRect(index * (barWidth + gap), y, barWidth, 9); if (visualizer === "mirror") context.fillRect(index * (barWidth + gap), height - y - 9, barWidth, 9); }
          }
        }
      }
      context.shadowBlur = 0;
      animation.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { observer.disconnect(); if (animation.current) cancelAnimationFrame(animation.current); };
  }, [open, theme, visualizer]);

  return <><button className="spectrum-trigger" type="button" aria-label="Abrir analizador de espectro" onClick={() => void start()}><WaveIcon /></button>{open ? <section className={`spectrum-overlay ${theme}`} aria-label="Analizador de espectro"><header><div className="spectrum-actions"><div className="theme-picker" aria-label="Color del analizador">{(Object.keys(themes) as ThemeName[]).map((name) => <button className={name === theme ? "selected" : ""} key={name} onClick={() => setTheme(name)}>{themes[name].label}</button>)}</div><div className="visualizer-picker" aria-label="Tipo de analizador">{(Object.keys(visualizers) as VisualizerName[]).map((name) => <button className={name === visualizer ? "selected" : ""} key={name} onClick={() => setVisualizer(name)}>{visualizers[name]}</button>)}</div><button className="spectrum-close" type="button" onClick={close}>Cerrar</button></div></header><div className="spectrum-stage"><canvas ref={canvas} /><div className="spectrum-scale"><span>40 Hz</span><span>160 Hz</span><span>630 Hz</span><span>2.5 kHz</span><span>10 kHz</span><span>16 kHz</span></div></div><footer><span className="spectrum-led" />{message}</footer></section> : null}</>;
};
