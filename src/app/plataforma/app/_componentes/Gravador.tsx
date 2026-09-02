"use client";

/**
 * Gravador de áudio reutilizável.
 *
 * Regra 1 do modo áudio (wireframe 1m): todo campo de texto longo do app tem
 * gravador, e o áudio vale como resposta — não como anexo secundário.
 *
 * Limite honesto deste protótipo: a gravação acontece de verdade (MediaRecorder)
 * e toca de volta no navegador, mas **não sai do dispositivo e não é transcrita**.
 * Transcrição automática exige serviço de STT no servidor, que não existe aqui.
 * A UI diz isso em vez de fingir.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { duracaoMMSS } from "../_lib/datas";

type Estado = "ocioso" | "gravando" | "gravado" | "indisponivel" | "negado";

export interface Gravacao {
  url: string;
  segundos: number;
}

interface Props {
  /** O que a pessoa deve dizer. Vira o aria-label do botão. */
  rotulo: string;
  /** `compacto` = só o botão redondo, para dentro de um campo. */
  variante?: "compacto" | "completo";
  onGravacao?: (g: Gravacao | null) => void;
}

/** 12 barras de nível, redesenhadas a cada frame enquanto grava. */
function Onda({ niveis }: { niveis: number[] }) {
  return (
    <div className="pa-onda" aria-hidden="true">
      {niveis.map((n, i) => (
        <i key={i} style={{ height: `${Math.max(4, Math.round(n * 26))}px` }} />
      ))}
    </div>
  );
}

const NIVEIS_PARADOS = [0.25, 0.5, 0.8, 0.4, 0.65, 0.3, 0.55, 0.85, 0.35, 0.6, 0.25, 0.45];

export function Gravador({ rotulo, variante = "completo", onGravacao }: Props) {
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [segundos, setSegundos] = useState(0);
  const [niveis, setNiveis] = useState<number[]>(() => new Array(12).fill(0.06));
  const [url, setUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlRef = useRef<string | null>(null);
  const segundosRef = useRef(0);

  const encerrarCaptura = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  // Solta stream, timer e object URL se o componente sair da tela gravando.
  useEffect(
    () => () => {
      encerrarCaptura();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [encerrarCaptura],
  );

  const iniciar = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setEstado("indisponivel");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setEstado("indisponivel");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      const pedacos: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) pedacos.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(pedacos, { type: rec.mimeType || "audio/webm" });
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const nova = URL.createObjectURL(blob);
        urlRef.current = nova;
        setUrl(nova);
        setEstado("gravado");
        setNiveis(NIVEIS_PARADOS);
        onGravacao?.({ url: nova, segundos: segundosRef.current });
        encerrarCaptura();
      };
      rec.start();

      // Nível em tempo real. Só visual: nada é enviado a lugar nenhum.
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const dados = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(dados);
          const proximos = Array.from({ length: 12 }, (_, i) => {
            const inicio = Math.floor((i * dados.length) / 12);
            const fim = Math.floor(((i + 1) * dados.length) / 12);
            let soma = 0;
            for (let k = inicio; k < fim; k += 1) soma += dados[k];
            return Math.min(1, soma / Math.max(1, fim - inicio) / 160);
          });
          setNiveis(proximos);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }

      setSegundos(0);
      segundosRef.current = 0;
      timerRef.current = setInterval(() => {
        segundosRef.current += 1;
        setSegundos(segundosRef.current);
      }, 1000);
      setEstado("gravando");
    } catch {
      setEstado("negado");
      encerrarCaptura();
    }
  }, [encerrarCaptura, onGravacao]);

  const parar = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const descartar = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrl(null);
    setSegundos(0);
    segundosRef.current = 0;
    setEstado("ocioso");
    setNiveis(new Array(12).fill(0.06));
    onGravacao?.(null);
  }, [onGravacao]);

  const botaoVoz = (
    <button
      type="button"
      className={`pa-voz-botao${estado === "gravando" ? " pa-gravando" : ""}`}
      onClick={estado === "gravando" ? parar : iniciar}
      aria-label={estado === "gravando" ? `Parar gravação: ${rotulo}` : `Gravar áudio: ${rotulo}`}
    >
      {estado === "gravando" ? "■" : "voz"}
    </button>
  );

  if (variante === "compacto" && estado === "ocioso") return botaoVoz;

  return (
    <div className="pa-gravador">
      {botaoVoz}

      {estado === "gravando" && (
        <>
          <Onda niveis={niveis} />
          <span className="pa-mono">{duracaoMMSS(segundos)}</span>
          <span className="pa-mono pa-gravador-dica">Gravando · toque no ■ para encerrar</span>
        </>
      )}

      {estado === "gravado" && url && (
        <>
          <audio className="pa-audio" src={url} controls preload="metadata" />
          <span className="pa-mono">{duracaoMMSS(segundos)}</span>
          <button type="button" className="pa-btn pa-btn-pequeno" onClick={descartar}>
            Descartar
          </button>
          <span className="pa-mono pa-gravador-dica">
            Áudio guardado só neste navegador · transcrição automática não disponível no protótipo
          </span>
        </>
      )}

      {estado === "ocioso" && (
        <span className="pa-mono pa-gravador-dica">Responda por áudio se preferir</span>
      )}

      {estado === "negado" && (
        <span className="pa-mono pa-gravador-dica">
          Permissão de microfone negada · use o campo de texto
        </span>
      )}

      {estado === "indisponivel" && (
        <span className="pa-mono pa-gravador-dica">
          Este navegador não grava áudio · use o campo de texto
        </span>
      )}
    </div>
  );
}
