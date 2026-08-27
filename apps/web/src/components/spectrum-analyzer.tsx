"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ThemeName = "studio" | "neon" | "vintage";
type VisualizerName = "led" | "scope" | "mirror" | "matrix" | "cascade" | "skyline" | "pulse" | "glow" | "wave" | "rainbow" | "nowPlaying" | "prism" | "mountain" | "steps" | "symmetric";
type MarqueeColor = "violet" | "amber" | "ice" | "lime";
type MarqueeSpeed = "relaxed" | "fast" | "turbo";
const themes: Record<ThemeName, { label: string; background: string; grid: string; bars: string[]; glow: string }> = {
  studio: { label: "Estudio", background: "#071008", grid: "#153e1b", bars: ["#12ef38", "#b6ef16", "#ffcb13", "#ff3131"], glow: "#10ff38" },
  neon: { label: "Neón", background: "#080510", grid: "#2b1745", bars: ["#00d8ff", "#7c4dff", "#f02bda", "#ffb000"], glow: "#e838ff" },
  vintage: { label: "Radio", background: "#1b120d", grid: "#59321e", bars: ["#f3aa3c", "#ed6c41", "#d94f78", "#b74f8e"], glow: "#ff9c43" },
};
const visualizers: Record<VisualizerName, string> = { led: "Barras", scope: "Oscilo", mirror: "Espejo", matrix: "Matriz", cascade: "Cascada", skyline: "Skyline", pulse: "Pulso", glow: "Neón", wave: "Onda", rainbow: "Arcoíris", nowPlaying: "Now playing", prism: "Prisma LED", mountain: "Montaña LED", steps: "Pasos LED", symmetric: "Simetría LED" };
const marqueeColors: Record<MarqueeColor, { label: string; value: string }> = { violet: { label: "Lila", value: "#b768ff" }, amber: { label: "Ámbar", value: "#ffc14d" }, ice: { label: "Hielo", value: "#fffdf5" }, lime: { label: "Lima", value: "#c8ff59" } };
const marqueeSpeeds: Record<MarqueeSpeed, { label: string; divisor: number }> = { relaxed: { label: "1×", divisor: 45 }, fast: { label: "2×", divisor: 24 }, turbo: { label: "3×", divisor: 15 } };
const ledGlyphs: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"], B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"], C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"], D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"], E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"], F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"], G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"], H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"], I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"], J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"], K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"], L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"], M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"], N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"], O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"], P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"], Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"], R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"], S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"], T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"], U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"], V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"], W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"], X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"], Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"], Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"], "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"], "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"], "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"], "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"], "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"], "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"], "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"], "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"], "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"], "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"], " ": ["000", "000", "000", "000", "000", "000", "000"]
};
const ledText = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[—·]/g, "-").toUpperCase();

const WaveIcon = (): React.JSX.Element => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h2l2.1-6 3.2 12L13 3l2.1 15L17 9l1.3 3H21" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>;
const FullscreenIcon = (): React.JSX.Element => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>;

export const SpectrumAnalyzer = ({ track, album, artist }: { track: string; album: string; artist: string }): React.JSX.Element => {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeName>("studio");
  const [visualizer, setVisualizer] = useState<VisualizerName>("led");
  const [marqueeColor, setMarqueeColor] = useState<MarqueeColor>("violet");
  const [marqueeSpeed, setMarqueeSpeed] = useState<MarqueeSpeed>("fast");
  const [message, setMessage] = useState("El analizador escucha el ambiente de esta habitación.");
  const canvas = useRef<HTMLCanvasElement>(null);
  const panel = useRef<HTMLElement>(null);
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
    if (document.fullscreenElement === panel.current) void document.exitFullscreen().catch(() => undefined);
  }, [stop]);

  const start = async (): Promise<void> => {
    setOpen(true);
    setMessage("Solicitando acceso al micrófono…");
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
      setMessage("");
    } catch {
      setMessage("No se pudo acceder al micrófono. Autorízalo en el navegador y vuelve a intentarlo.");
    }
  };

  useEffect(() => () => stop(), [stop]);
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
      context.fillStyle = "#000"; context.fillRect(0, 0, width, height);
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
      } else if (visualizer === "nowPlaying") {
        const text = ledText(`NOW PLAYING — ${track} · ${album} · ${artist}`); const cell = Math.max(5, Math.min(72, height * .74 / 7)); const cellGap = Math.max(1, cell * .16); const messageWidth = Array.from(text).reduce((total, character) => total + ((ledGlyphs[character] ?? ledGlyphs["?"])[0].length + 1) * cell, 0); const gap = height * .42; const offset = performance.now() / marqueeSpeeds[marqueeSpeed].divisor % (messageWidth + gap); const start = width - offset; const top = (height - cell * 7) / 2;
        context.fillStyle = marqueeColors[marqueeColor].value; context.shadowBlur = cell * .16; context.shadowColor = marqueeColors[marqueeColor].value;
        const drawMessage = (left: number): void => { let x = left; for (const character of text) { const glyph = ledGlyphs[character] ?? ledGlyphs["?"]; glyph.forEach((row, rowIndex) => Array.from(row).forEach((bit, columnIndex) => { if (bit === "1") context.fillRect(x + columnIndex * cell, top + rowIndex * cell, cell - cellGap, cell - cellGap); })); x += (glyph[0].length + 1) * cell; } };
        drawMessage(start); drawMessage(start + messageWidth + gap);
      } else if (visualizer === "skyline") {
        const baseline = height * .58; const skylineCount = Math.min(42, Math.max(22, Math.floor(width / 12))); const skylineGap = Math.max(2, width / skylineCount * .2); const skylineWidth = (width - skylineGap * (skylineCount - 1)) / skylineCount;
        context.shadowBlur = 12;
        for (let index = 0; index < skylineCount; index += 1) { const amount = level(index, skylineCount); const cells = Math.max(1, Math.ceil(amount * 18)); for (let cell = 0; cell < cells; cell += 1) { const y = baseline - (cell + 1) * 7; context.fillStyle = color(cell / 18); context.fillRect(index * (skylineWidth + skylineGap), y, skylineWidth, 4.5); context.globalAlpha = .18 * (1 - cell / Math.max(cells, 1)); context.fillRect(index * (skylineWidth + skylineGap), baseline + cell * 7, skylineWidth, 4.5); context.globalAlpha = 1; } }
        context.fillStyle = activeTheme.bars[0]; context.fillRect(0, baseline, width, 2);
      } else if (visualizer === "pulse") {
        const middle = height / 2; const pulseCount = Math.min(34, Math.max(18, Math.floor(width / 16))); const pulseGap = Math.max(3, width / pulseCount * .35); const pulseWidth = (width - pulseGap * (pulseCount - 1)) / pulseCount;
        for (let index = 0; index < pulseCount; index += 1) { const amount = level(index, pulseCount); const cells = Math.max(1, Math.ceil(amount * 13)); const shade = color(amount); context.fillStyle = shade; for (let cell = 0; cell < cells; cell += 1) { const y = middle - (cell + 1) * 8; context.fillRect(index * (pulseWidth + pulseGap), y, pulseWidth, 5); context.fillRect(index * (pulseWidth + pulseGap), middle + cell * 8 - 5, pulseWidth, 5); } }
      } else if (visualizer === "glow") {
        const glowCount = Math.min(26, Math.max(14, Math.floor(width / 20))); const glowGap = Math.max(3, width / glowCount * .23); const glowWidth = (width - glowGap * (glowCount - 1)) / glowCount; const rows = 16;
        context.shadowBlur = 18; context.shadowColor = activeTheme.glow;
        for (let index = 0; index < glowCount; index += 1) { const amount = level(index, glowCount); const cells = Math.max(1, Math.ceil(amount * rows)); for (let cell = 0; cell < cells; cell += 1) { const y = height - 10 - (cell + 1) * (height - 20) / rows; context.fillStyle = cell / rows < .32 ? activeTheme.bars[0] : color(cell / rows); context.fillRect(index * (glowWidth + glowGap), y, glowWidth, Math.max(3, height / rows - 4)); } }
      } else if (visualizer === "wave") {
        const middle = height / 2; const points = Math.min(96, Math.max(42, Math.floor(width / 7)));
        context.beginPath(); context.moveTo(0, middle); for (let index = 0; index < points; index += 1) { const x = index / (points - 1) * width; const value = analyser.current ? Math.abs(waveform[Math.min(waveform.length - 1, Math.floor(index / points * waveform.length))] - 128) / 128 : .04; context.lineTo(x, middle - Math.max(3, value * height * .46)); } context.lineTo(width, middle); context.closePath(); const topGradient = context.createLinearGradient(0, 0, width, 0); topGradient.addColorStop(0, activeTheme.bars[0]); topGradient.addColorStop(.55, activeTheme.bars[1]); topGradient.addColorStop(1, activeTheme.bars[3]); context.fillStyle = topGradient; context.globalAlpha = .8; context.fill(); context.globalAlpha = 1;
        context.beginPath(); context.moveTo(0, middle); for (let index = 0; index < points; index += 1) { const x = index / (points - 1) * width; const value = analyser.current ? Math.abs(waveform[Math.min(waveform.length - 1, Math.floor(index / points * waveform.length))] - 128) / 128 : .04; context.lineTo(x, middle + Math.max(3, value * height * .46)); } context.lineTo(width, middle); context.closePath(); context.fillStyle = topGradient; context.globalAlpha = .65; context.fill(); context.globalAlpha = 1; context.strokeStyle = "#efffff"; context.lineWidth = 1; context.beginPath(); context.moveTo(0, middle); context.lineTo(width, middle); context.stroke();
      } else if (visualizer === "rainbow") {
        const rainbowCount = Math.min(30, Math.max(16, Math.floor(width / 17))); const rainbowGap = Math.max(3, width / rainbowCount * .25); const rainbowWidth = (width - rainbowGap * (rainbowCount - 1)) / rainbowCount; const baseline = height * .64;
        for (let index = 0; index < rainbowCount; index += 1) { const amount = level(index, rainbowCount); const cells = Math.max(1, Math.ceil(amount * 14)); const hue = 42 + index / Math.max(rainbowCount - 1, 1) * 260; for (let cell = 0; cell < cells; cell += 1) { const y = baseline - (cell + 1) * 9; context.fillStyle = `hsl(${hue} 86% ${Math.max(43, 68 - cell * 1.2)}%)`; context.fillRect(index * (rainbowWidth + rainbowGap), y, rainbowWidth, 6); context.globalAlpha = .16 * (1 - cell / Math.max(cells, 1)); context.fillRect(index * (rainbowWidth + rainbowGap), baseline + cell * 9, rainbowWidth, 6); context.globalAlpha = 1; } }
      } else if (visualizer === "prism") {
        const columns = Math.min(27, Math.max(14, Math.floor(width / 18))); const gap = Math.max(3, width / columns * .28); const cellWidth = (width - gap * (columns - 1)) / columns; const rows = 11;
        context.shadowBlur = 10; context.shadowColor = "#0b6cff";
        for (let index = 0; index < columns; index += 1) { const cells = Math.max(1, Math.ceil(level(index, columns) * rows)); const hue = index / Math.max(columns - 1, 1) * 270; for (let row = 0; row < cells; row += 1) { const y = height - 9 - (row + 1) * (height - 18) / rows; context.fillStyle = `hsl(${hue} 90% ${Math.max(48, 68 - row * 2)}%)`; context.fillRect(index * (cellWidth + gap), y, cellWidth, Math.max(3, height / rows - 4)); } }
      } else if (visualizer === "mountain") {
        const columns = Math.min(28, Math.max(15, Math.floor(width / 17))); const gap = Math.max(3, width / columns * .25); const cellWidth = (width - gap * (columns - 1)) / columns; const rows = 12;
        context.shadowBlur = 11; context.shadowColor = "#0088ff";
        for (let index = 0; index < columns; index += 1) { const source = Math.abs(index / Math.max(columns - 1, 1) - .5) * 2; const shaped = Math.max(level(index, columns), .17 + (1 - source) * .35); const cells = Math.min(rows, Math.ceil(shaped * rows)); for (let row = 0; row < cells; row += 1) { const y = height - 9 - (row + 1) * (height - 18) / rows; context.fillStyle = row > cells - 3 ? "#477dff" : "#08a7ff"; context.fillRect(index * (cellWidth + gap), y, cellWidth, Math.max(3, height / rows - 4)); } }
      } else if (visualizer === "steps") {
        const columns = Math.min(34, Math.max(18, Math.floor(width / 14))); const gap = Math.max(2, width / columns * .22); const cellWidth = (width - gap * (columns - 1)) / columns; const rows = 8;
        context.shadowBlur = 9; context.shadowColor = "#176cff";
        for (let index = 0; index < columns; index += 1) { const cells = Math.max(1, Math.ceil(level(index, columns) * rows)); for (let row = 0; row < cells; row += 1) { const y = height - 8 - (row + 1) * (height - 16) / rows; context.fillStyle = row === cells - 1 ? "#91b5ff" : "#1268ef"; context.fillRect(index * (cellWidth + gap), y, cellWidth, Math.max(3, height / rows - 4)); } }
      } else if (visualizer === "symmetric") {
        const columns = Math.min(25, Math.max(14, Math.floor(width / 19))); const gap = Math.max(3, width / columns * .28); const cellWidth = (width - gap * (columns - 1)) / columns; const middle = height / 2; const rows = 7;
        context.shadowBlur = 12; context.shadowColor = "#ff42dc";
        for (let index = 0; index < columns; index += 1) { const cells = Math.max(1, Math.ceil(level(index, columns) * rows)); const hue = 200 + index / Math.max(columns - 1, 1) * 150; for (let row = 0; row < cells; row += 1) { context.fillStyle = `hsl(${hue} 92% ${Math.max(48, 70 - row * 3)}%)`; const y = middle - (row + 1) * 9; context.fillRect(index * (cellWidth + gap), y, cellWidth, 6); context.fillRect(index * (cellWidth + gap), middle + row * 9 - 6, cellWidth, 6); } }
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
  }, [open, theme, visualizer, marqueeColor, marqueeSpeed]);

  const toggleFullscreen = async (): Promise<void> => {
    if (document.fullscreenElement === panel.current) await document.exitFullscreen();
    else await panel.current?.requestFullscreen();
  };
  return <div className="spectrum-container">{!open ? <button className="spectrum-trigger" type="button" aria-label="Abrir analizador de espectro" onClick={() => void start()}><WaveIcon /><span>Analizador</span></button> : <section ref={panel} className={`spectrum-panel ${theme}`} aria-label="Analizador de espectro"><header><div className="spectrum-actions">{visualizer === "nowPlaying" ? <div className="marquee-controls"><div className="marquee-picker" aria-label="Color del cartel LED">{(Object.keys(marqueeColors) as MarqueeColor[]).map((name) => <button className={name === marqueeColor ? "selected" : ""} key={name} onClick={() => setMarqueeColor(name)}>{marqueeColors[name].label}</button>)}</div><div className="marquee-picker marquee-speed" aria-label="Velocidad del cartel LED">{(Object.keys(marqueeSpeeds) as MarqueeSpeed[]).map((name) => <button className={name === marqueeSpeed ? "selected" : ""} key={name} onClick={() => setMarqueeSpeed(name)}>{marqueeSpeeds[name].label}</button>)}</div></div> : null}<button className="spectrum-fullscreen" type="button" aria-label="Mostrar el analizador a pantalla completa" title="Pantalla completa" onClick={() => void toggleFullscreen().catch(() => undefined)}><FullscreenIcon /></button><button className="spectrum-close" type="button" onClick={close}>Cerrar</button></div></header><div className="spectrum-stage"><canvas ref={canvas} /></div>{message ? <footer><span className="spectrum-led" />{message}</footer> : null}<div className="visualizer-picker" aria-label="Tipo de analizador">{(Object.keys(visualizers) as VisualizerName[]).map((name) => <button className={name === visualizer ? "selected" : ""} key={name} onClick={() => setVisualizer(name)}>{visualizers[name]}</button>)}</div></section>}</div>;
};
