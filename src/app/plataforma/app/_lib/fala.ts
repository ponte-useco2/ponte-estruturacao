"use client";

/**
 * Leitura em voz alta pela Web Speech API do próprio navegador.
 *
 * É a única síntese de voz possível sem servidor — e é real: não depende de
 * serviço externo, não envia texto pra lugar nenhum. Onde a API não existe
 * (parte dos navegadores móveis, modo restrito), `disponivel` volta false e a
 * UI mostra o texto em vez de prometer áudio.
 *
 * `useSyncExternalStore` em vez de `useEffect` + `setState`: a disponibilidade
 * é um fato do ambiente, não um estado que a gente sincroniza depois da
 * renderização. O snapshot de servidor é `false` para a hidratação bater.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const semInscricao = () => () => {};
const temFala = () => typeof window !== "undefined" && "speechSynthesis" in window;
const noServidor = () => false;

export function useFala() {
  const disponivel = useSyncExternalStore(semInscricao, temFala, noServidor);
  const [falando, setFalando] = useState(false);

  // Sair da tela no meio de uma leitura não deixa a voz tocando sozinha.
  useEffect(
    () => () => {
      if (temFala()) window.speechSynthesis.cancel();
    },
    [],
  );

  const parar = useCallback(() => {
    if (!temFala()) return;
    window.speechSynthesis.cancel();
    setFalando(false);
  }, []);

  const falar = useCallback((texto: string) => {
    if (!temFala()) return;
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    fala.rate = 1;
    fala.onend = () => setFalando(false);
    fala.onerror = () => setFalando(false);
    setFalando(true);
    window.speechSynthesis.speak(fala);
  }, []);

  return { disponivel, falando, falar, parar };
}
