"use client";

import { useCallback, useEffect, useRef } from "react";
import { registrarEvento, type TipoEvento } from "./eventos";

/**
 * Registro de uso, do lado do cliente.
 *
 * Dois cuidados que fazem diferença:
 *
 * 1. AGRUPAMENTO POR TEMPO. Digitar "regularização fundiária" na busca dispara
 *    24 mudanças de estado. Registrar as 24 encheria a tabela de ruído e
 *    tornaria a leitura pior, não melhor. Eventos do mesmo tipo esperam
 *    1,2 s e só o último é gravado.
 *
 * 2. NÃO DERRUBAR A NAVEGAÇÃO. Falha de registro é engolida: o painel tem que
 *    funcionar mesmo com o banco fora do ar. Auditoria que quebra a página
 *    que audita não serve.
 */
const ESPERA_MS = 1200;

export function useRegistro() {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const atuais = timers.current;
    return () => {
      atuais.forEach((t) => clearTimeout(t));
      atuais.clear();
    };
  }, []);

  return useCallback(
    (tipo: TipoEvento, detalhe: Record<string, unknown> = {}, agrupar = true) => {
      const enviar = () => {
        registrarEvento(tipo, detalhe).catch(() => {
          /* registro é secundário: nunca interrompe quem está usando */
        });
      };

      if (!agrupar) {
        enviar();
        return;
      }

      const anterior = timers.current.get(tipo);
      if (anterior) clearTimeout(anterior);
      timers.current.set(
        tipo,
        setTimeout(() => {
          timers.current.delete(tipo);
          enviar();
        }, ESPERA_MS)
      );
    },
    []
  );
}
