/**
 * Leitura do radar de propostas no Supabase — só servidor, só chave de serviço.
 *
 * As tabelas e funções da `oport_7` não aceitam `anon` nem `authenticated`. Quem
 * decide se a pessoa pode ver é a página, com `ehAdministrador`; daqui para
 * baixo, a leitura é da chave de serviço.
 */
import { authConfigurada, clienteServidor } from "@/lib/supabase-auth";
import { ehEsquemaAusente } from "./esquema";
import type { Categoria, Dias, ParametrosRadar } from "./radar";

export interface ExecucaoRadar {
  id: number;
  dado_ate: string;
  referencia: string;
  concluida_em: string;
  arquivos: Record<string, string | null>;
  contagens: { janelas_abertas_municipio_pb?: number; [k: string]: unknown };
}

export interface LinhaPlacar {
  categoria: Categoria;
  dias: Dias;
  atual: number;
  anterior: number;
}

export interface LinhaRecorte {
  chave: string | null;
  rotulo: string | null;
  atual: number;
  anterior: number;
  valor_atual: number;
  inferidos: number;
}

export interface LinhaDisputa {
  cod_programa: string;
  programa: string;
  orgao: string;
  canal: string;
  abre: string | null;
  fecha: string | null;
  dias_restantes: number | null;
  ufs: number;
  novas_desde_abertura: number;
  novas_30d: number;
  valor_pedido: number;
}

export interface EnvioPB {
  categoria: Categoria;
  ocorrido_em: string;
  proponente: string | null;
  municipio: string | null;
  tipo_agente: string | null;
  programa: string | null;
  canal: string | null;
  valor_repasse: number | null;
}

export interface MunicipioPB {
  cod_ibge: string;
  municipio: string;
  novas_30d: number;
  em_revisao_30d: number;
  revisadas_30d: number;
  ultimo_envio: string | null;
}

export type LeituraRadar =
  | { estado: "nao_ativado" }
  | { estado: "sem_execucao" }
  | { estado: "erro"; mensagem: string }
  | {
      estado: "ok";
      execucao: ExecucaoRadar;
      placar: LinhaPlacar[];
      porCanal: LinhaRecorte[];
      porTipo: LinhaRecorte[];
      porPrograma: LinhaRecorte[];
      disputa: LinhaDisputa[];
      enviaramPB: EnvioPB[];
      municipiosPB: MunicipioPB[];
    };

const LIMITE_PROGRAMAS = 25;
const LIMITE_DISPUTA = 25;
const LIMITE_ENVIOS_PB = 200;

export async function lerRadar(p: ParametrosRadar): Promise<LeituraRadar> {
  if (!authConfigurada()) return { estado: "nao_ativado" };
  const db = clienteServidor();

  const ultima = await db.rpc("radar_ultima_execucao");
  if (ultima.error) {
    if (ehEsquemaAusente(ultima.error.code)) return { estado: "nao_ativado" };
    console.error("lerRadar:", ultima.error.message);
    return { estado: "erro", mensagem: ultima.error.message };
  }
  const execucao = (ultima.data as ExecucaoRadar[] | null)?.[0];
  if (!execucao) return { estado: "sem_execucao" };

  // A lista "quem enviou na PB" usa a mesma janela escolhida na tela. O corte é
  // calculado a partir de `dado_ate`, e não de agora, pelo mesmo motivo das
  // funções SQL: o arquivo é de ontem.
  const desde = new Date(Date.parse(execucao.dado_ate) - p.dias * 24 * 60 * 60 * 1000).toISOString();

  const [placar, canal, tipo, programa, disputa, envios, municipios] = await Promise.all([
    db.rpc("radar_placar", { p_uf: p.uf }),
    db.rpc("radar_recorte", { p_uf: p.uf, p_dimensao: "canal", p_dias: p.dias, p_categoria: p.categoria }),
    db.rpc("radar_recorte", { p_uf: p.uf, p_dimensao: "tipo_agente", p_dias: p.dias, p_categoria: p.categoria }),
    db.rpc("radar_recorte", { p_uf: p.uf, p_dimensao: "programa", p_dias: p.dias, p_categoria: p.categoria }),
    db.rpc("radar_disputa", { p_uf: p.uf, p_limite: LIMITE_DISPUTA }),
    db
      .from("radar_evento")
      .select("categoria, ocorrido_em, proponente, municipio, tipo_agente, programa, canal, valor_repasse")
      .eq("execucao_id", execucao.id)
      .eq("uf", "PB")
      .gt("ocorrido_em", desde)
      .order("ocorrido_em", { ascending: false })
      .limit(LIMITE_ENVIOS_PB),
    db
      .from("radar_municipio_pb")
      .select("cod_ibge, municipio, novas_30d, em_revisao_30d, revisadas_30d, ultimo_envio")
      .eq("execucao_id", execucao.id)
      .order("municipio"),
  ]);

  const erro = [placar, canal, tipo, programa, disputa, envios, municipios].find((r) => r.error)?.error;
  if (erro) {
    console.error("lerRadar:", erro.message);
    return { estado: "erro", mensagem: erro.message };
  }

  return {
    estado: "ok",
    execucao,
    placar: (placar.data ?? []) as LinhaPlacar[],
    porCanal: (canal.data ?? []) as LinhaRecorte[],
    porTipo: (tipo.data ?? []) as LinhaRecorte[],
    porPrograma: ((programa.data ?? []) as LinhaRecorte[]).slice(0, LIMITE_PROGRAMAS),
    disputa: (disputa.data ?? []) as LinhaDisputa[],
    enviaramPB: (envios.data ?? []) as EnvioPB[],
    municipiosPB: (municipios.data ?? []) as MunicipioPB[],
  };
}
