import React from 'react';
import Link from 'next/link';

export const revalidate = 3600;

interface Oportunidade {
  id: string;
  codigo_programa: string;
  nome: string;
  orgao: string;
  status: string;
  carteira: 'Regularização Fundiária' | 'ATHIS / Habitação' | 'Socioassistencial (MROSC)' | 'Cultura' | 'Inovação' | 'Multisetorial / Geral';
  publico_alvo: string;
  prazo_fim: string;
  dias_restantes: number;
  link_transferegov: string;
}

interface DadosRadar {
  metadata: {
    ultima_atualizacao: string;
    data_formatada: string;
    uf: string;
    total_programas_abertos: number;
    total_urgentes: number;
    novos_nesta_execucao: number;
  };
  programas: Oportunidade[];
}

async function getOportunidades(): Promise<DadosRadar> {
  const URL_DADOS = 'https://raw.githubusercontent.com/diretoriajnconsulting-dotcom/jn-portal-oportunidades/main/public/data/oportunidades.json';

  try {
    const res = await fetch(URL_DADOS, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error('Falha ao obter base de dados');
    return await res.json();
  } catch (error) {
    console.error('Erro ao carregar oportunidades:', error);
    return {
      metadata: {
        ultima_atualizacao: new Date().toISOString(),
        data_formatada: 'Base local',
        uf: 'PB',
        total_programas_abertos: 0,
        total_urgentes: 0,
        novos_nesta_execucao: 0
      },
      programas: []
    };
  }
}

export default async function OportunidadesPage() {
  const dados = await getOportunidades();
  const oportunidades = dados.programas;
  const urgentes = oportunidades.filter((op) => op.dias_restantes <= 15);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Cabeçalho */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-3">
                Radar de Fomento Público • Paraíba ({dados.metadata.uf})
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Oportunidades & Editais Abertos
              </h1>
              <p className="mt-2 text-slate-600 max-w-2xl text-sm">
                Monitoramento contínuo de transferências da União no TransfereGov para regularização fundiária, habitação de interesse social (ATHIS), cultura, inovação e rede socioassistencial (MROSC).
              </p>
            </div>
            <div className="text-left md:text-right">
              <span className="text-xs text-slate-400 block">Sincronização Diária</span>
              <span className="text-sm font-semibold text-slate-700">Atualizado em: {dados.metadata.data_formatada}</span>
            </div>
          </div>
        </div>

        {/* Alertas Urgentes (≤ 15 dias) */}
        {urgentes.length > 0 && (
          <section className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-2xl shadow-xs">
            <h2 className="text-base font-bold text-amber-900 flex items-center gap-2">
              🚨 Janelas com Encerramento Próximo (≤ 15 dias)
            </h2>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {urgentes.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      Resta {item.dias_restantes} {item.dias_restantes === 1 ? 'dia' : 'dias'}
                    </span>
                    <span className="text-xs font-medium text-slate-500">Prazo: {item.prazo_fim}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">{item.nome}</h3>
                  <p className="text-xs text-slate-600"><strong>Órgão:</strong> {item.orgao}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Listagem de Oportunidades */}
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Programas Mapeados</h2>
              <p className="text-xs text-slate-500 mt-0.5">Programas ativos com recebimento de propostas ou emendas abertos</p>
            </div>
            <span className="text-sm font-medium px-3 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {oportunidades.length} programas abertos
            </span>
          </div>

          {oportunidades.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p className="text-base font-medium">Nenhum programa ativo registrado na extração atual.</p>
              <p className="text-xs text-slate-400 mt-1">A base é atualizada automaticamente todas as manhãs.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Programa / Objeto</th>
                    <th className="p-4">Eixo / Carteira</th>
                    <th className="p-4">Órgão Concedente</th>
                    <th className="p-4">Prazo Final</th>
                    <th className="p-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {oportunidades.map((op) => (
                    <tr key={op.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-900 max-w-sm">{op.nome}</div>
                        <span className="text-xs text-slate-400">Cód: {op.codigo_programa}</span>
                      </td>
                      <td className="p-4">
                        <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                          {op.carteira}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 text-xs max-w-xs">{op.orgao}</td>
                      <td className="p-4">
                        <span className="font-medium text-slate-800">{op.prazo_fim}</span>
                        {op.dias_restantes <= 15 && (
                          <span className="block text-xs font-semibold text-amber-600 mt-0.5">
                            ({op.dias_restantes}d restantes)
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <a
                          href={op.link_transferegov}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                        >
                          Ver no TransfereGov
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* CTA de Conversão da Ponte */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-8 text-center space-y-4 shadow-md">
          <h2 className="text-2xl font-bold">Identificou uma oportunidade para o seu município ou OSC?</h2>
          <p className="text-slate-300 max-w-xl mx-auto text-sm">
            A Ponte apoia na análise de viabilidade, enquadramento regulatório, estruturação da proposta e elaboração do plano de trabalho no TransfereGov.
          </p>
          <div className="pt-2">
            <Link
              href="/#contato"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition shadow-sm"
            >
              Solicitar Diagnóstico Preliminar
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
