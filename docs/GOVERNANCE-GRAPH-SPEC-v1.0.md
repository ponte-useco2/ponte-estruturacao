# ESPECIFICAÇÃO DE DOMÍNIO & CONTRATO DE BACKEND: GOVERNANCE GRAPH v1.0
## Sistema de Suporte à Decisão, Ledger Imutável e Rastreabilidade Documental
**Autor:** PONTE — Estruturação de Projetos & Inovação Territorial  
**Contexto:** HUB de Inovação e Desenvolvimento Territorial — Bananeiras / Brejo Paraibano  
**Versão:** 1.0 (Definitive Architecture Specification)  
**Data:** 19 de Agosto de 2026  

---

## 1. Visão Geral da Arquitetura

O **Governance Graph** é uma infraestrutura de persistência, auditoria e proveniência causal projetada para rastrear a evolução institucional de uma entidade desde sua concepção pré-constitutiva até o registro cartorário e operação permanente.

Diferente de um repositório documental passivo ou de um formulário transacional CRUD, o sistema opera sob o paradigma de **Event Sourcing Append-Only**, onde o estado atual de qualquer deliberação, cláusula ou documento é derivado da soma ordenada de seus eventos históricos imutáveis.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           INSTITUTION (Tenant)                          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
       [ DECISION STREAM ]                      [ DOCUMENT STREAM ]
   ┌───────────────────────────┐           ┌───────────────────────────┐
   │ DEC-001 (Poder Executivo) │           │ DOC-ESTATUTO (Estatuto)   │
   │  ├── EVT-001 (R1 Delib.)  │           │  ├── M1 (Minuta 1)        │
   │  ├── EVT-002 (R2 Proposta)│           │  ├── M2 (Minuta 2)        │
   │  └── EVT-003 (R2 Delib.)  │           │  └── M3 (Aprovada/Reg.)   │
   └─────────────┬─────────────┘           └─────────────▲─────────────┘
                 │                                       │
                 │         [ GOVERNANCE GRAPH EDGES ]    │
                 └───────────────► CLAUSE ───────────────┘
                              (Art. 14, § 2º)
                                     │
                                     ▼
                            [ PONTE AUDIT REVIEW ]
                           (CONFORME / RESSALVA)
```

---

## 2. Modelo de Entidades e Grafo de Domínio (As 6 Entidades Nucleares)

### 2.1. `Institution` (Tenant / Entidade Originária)
Representa a pessoa jurídica em formação ou consolidada.
* **Campos:**
  * `id`: UUID (ex.: `inst_bananeiras_2026`)
  * `legal_name`: String (ex.: `"Associação Hub de Inovação e Desenvolvimento Territorial de Bananeiras"`)
  * `trade_name`: String (ex.: `"HUB Bananeiras"`)
  * `territory_scope`: Enum (`MUNICIPAL`, `REGIONAL_BREJO`, `ESTADUAL_PB`, `NACIONAL`)
  * `foundation_cycle_status`: Enum (`PRE_CONSTITUTIONAL`, `COMMITTEE_DELIBERATING`, `DRAFTING`, `ASSEMBLY_APPROVED`, `REGISTERED_ACTIVE`)
  * `created_at`: Timestamp UTC

---

### 2.2. `Decision` (Matéria Constitucional / Tensão de Poder)
Representa uma tensão de poder ou eixo de governança que exige deliberação soberana dos instituidores.
* **Campos:**
  * `id`: String canônica (ex.: `DEC-001`, `DEC-002`, `DEC-003`, `DEC-004`, `DEC-005`)
  * `institution_id`: Foreign Key (`Institution.id`)
  * `category`: Enum (`EXECUTIVE_POWER`, `CAPITAL_GOVERNANCE`, `COMMUNITY_VOICE`, `MEMBERSHIP_VOTE`, `TERRITORIAL_ANCHOR`)
  * `title`: String
  * `question`: String (A pergunta estruturante)
  * `structural_tension`: String (A tensão entre agilidade e controle)
  * `ponte_recommendation`: String (A orientação técnica formal da PONTE)
  * `current_revision`: Integer (Derivado: 0 se pendente, 1, 2, 3...)
  * `active_decision_event_id`: Foreign Key (`DecisionEvent.id` da revisão vigente)

---

### 2.3. `DecisionEvent` (Evento Imutável no Decision Ledger)
Cada evento gravado em uma decisão é estritamente append-only, tamper-evident e encadeado criptograficamente.
* **Campos:**
  * `event_id`: String (ex.: `EVT-DEC001-001`, `EVT-DEC001-002`)
  * `decision_id`: Foreign Key (`Decision.id`)
  * `event_seq`: Integer (1, 2, 3... sequencial rigoroso por stream)
  * `event_type`: Enum (`PROPOSAL_CREATED`, `DECISION_DELIBERATED`, `PROPOSAL_WITHDRAWN`)
  * `decision_state`: Enum (`RASCUNHO`, `PROPOSTA`, `DELIBERADA`)
  * `decision_revision`: Integer nullable (Preenchido com R1, R2... **apenas** quando `decision_state == 'DELIBERADA'`)
  * `target_revision`: Integer nullable (Preenchido quando `decision_state == 'PROPOSTA'`)
  * `selected_option`: String
  * `custom_formulation`: String nullable (Obrigatório se opção for `Terceira Via`)
  * `institutional_rationale`: String (Justificativa estratégica obrigatória)
  * `caveats_conditions`: String nullable (Ressalvas e diretrizes para a redação da minuta)
  * `revision_motive`: String nullable (Obrigatório se `event_seq > 1`)
  * `deliberating_body`: Enum (`FOUNDING_COMMITTEE`, `GENERAL_ASSEMBLY`, `PROVISIONAL_BOARD`)
  * `recorded_by_user_id`: Foreign Key (`User.id` autenticado pelo servidor)
  * `previous_event_id`: Foreign Key (`DecisionEvent.id` do evento cronológico anterior)
  * `supersedes_decision_event_id`: Foreign Key (`DecisionEvent.id` da deliberação que esta substitui formalmente)
  * `previous_hash`: String (SHA-256 do evento anterior ou `"GENESIS_ROOT"`)
  * `content_hash`: String (SHA-256 do payload canônico do evento)
  * `created_at`: Timestamp UTC

---

### 2.4. `Document` (Artefato Jurídico Institucional)
Representa um instrumento normativo da instituição (Estatuto Social, Regimento Interno, Resolução de Governança).
* **Campos:**
  * `id`: String (ex.: `DOC-ESTATUTO`, `DOC-REGIMENTO-LABS`)
  * `institution_id`: Foreign Key (`Institution.id`)
  * `doc_type`: Enum (`ESTATUTO_SOCIAL`, `REGIMENTO_INTERNO`, `RESOLUCAO_COMITE`, `CODIGO_CONDUTA`)
  * `title`: String
  * `current_revision_id`: Foreign Key (`DocumentRevision.id`)

---

### 2.5. `DocumentRevision` (Minuta Documental Versionada)
Representa uma versão consolidada do documento (Minuta M1, M2, Minuta Final de Assembleia, Ato Registrado).
* **Campos:**
  * `id`: String (ex.: `DOC-ESTATUTO-M1`, `DOC-ESTATUTO-M2`, `DOC-ESTATUTO-M3`)
  * `document_id`: Foreign Key (`Document.id`)
  * `revision_label`: String (ex.: `"Minuta M1"`, `"Minuta M2"`, `"Minuta Final"`)
  * `status`: Enum (`DRAFTING`, `READY_FOR_AUDIT`, `AUDITED_BY_PONTE`, `ASSEMBLY_APPROVED`, `REGISTERED_RCPJ`)
  * `created_at`: Timestamp UTC
  * `created_by_user_id`: Foreign Key (`User.id`)

---

### 2.6. `Clause` (Nó de Cláusula Jurídica / Artigo)
Representa a redação textual ou artigo formal que codifica uma ou mais decisões em uma revisão documental.
* **Campos:**
  * `id`: String (ex.: `CLS-001`, `CLS-014`)
  * `document_revision_id`: Foreign Key (`DocumentRevision.id`)
  * `clause_reference`: String (ex.: `"Art. 14, § 2º"`, `"Art. 18, caput"`)
  * `clause_heading`: String (ex.: `"Da Política de Alçadas da Diretoria"`)
  * `clause_text`: Text (O conteúdo redigido da cláusula)
  * `text_hash`: String (SHA-256 do texto da cláusula)
  * `created_at`: Timestamp UTC

---

## 3. Grafo de Relações e Arestas Causais (Edge Contracts)

O grafo conecta o fluxo de decisões ao fluxo documental por meio de 5 arestas fundamentais:

```
[ DecisionEvent (DELIBERATED R1) ]
                 │
                 │ 1. IMPLEMENTED_BY (DecisionClauseEdge)
                 ▼
             [ Clause ] ────── 2. CONTAINED_IN ──────► [ DocumentRevision (M1) ]
                 │                                               │
                 │ 3. REVIEWS (PonteAuditReview)                 │ 4. APPROVES (AssemblyResolution)
                 ▼                                               ▼
          [ PonteAuditReview ]                        [ AssemblyResolution ]
         (CONFORME / RESSALVA)                                   │
                                                                 │ 5. REGISTERS (RegistryAct)
                                                                 ▼
                                                           [ RegistryAct ]
                                                        (Cartório RCPJ + CNPJ)
```

### 3.1. Aresta `IMPLEMENTED_BY` (`DecisionClauseEdge`)
* **Origem:** `DecisionEvent` (onde `decision_state == 'DELIBERADA'`)
* **Destino:** `Clause`
* **Cardinalidade:** $N:M$ (Uma decisão pode ser implementada por múltiplos artigos; um artigo pode implementar múltiplas decisões correlatas).
* **Campos:**
  * `decision_event_id`: UUID
  * `clause_id`: UUID
  * `implementation_type`: Enum (`DIRECT_CODIFICATION`, `PARTIAL_DISPOSITION`, `TRANSITIONAL_RULE`)

---

### 3.2. Aresta `REVIEWS` (`PonteAuditReview`)
* **Origem:** Consultoria PONTE (Auditor Responsável)
* **Destino:** `Clause`
* **Cardinalidade:** $1:N$ por versão da cláusula.
* **Campos:**
  * `id`: UUID
  * `subject_clause_id`: Foreign Key (`Clause.id`)
  * `subject_decision_event_id`: Foreign Key (`DecisionEvent.id`)
  * `review_result`: Enum (`CONFORME`, `CONFORME_COM_RESSALVAS`, `DIVERGENTE`)
  * `technical_notes`: Text (Parecer da auditoria de coerência institucional)
  * `audited_by_user_id`: Foreign Key (`User.id` - Equipe Técnica PONTE)
  * `audited_at`: Timestamp UTC
  * `audit_hash`: String SHA-256

---

### 3.3. Aresta `APPROVES` (`AssemblyResolution`)
* **Origem:** Assembleia Geral de Fundação
* **Destino:** `DocumentRevision`
* **Campos:**
  * `id`: UUID
  * `subject_document_revision_id`: Foreign Key (`DocumentRevision.id`)
  * `assembly_date`: Date
  * `minute_protocol`: String (ex.: `"Ata nº 01/2026"`)
  * `quorum_present`: String (ex.: `"100% dos Sócios Instituidores"`)
  * `voting_result`: Enum (`UNANIMOUS_APPROVAL`, `QUALIFIED_MAJORITY_APPROVAL`)
  * `known_divergences_override`: Boolean (Se aprovado com divergência técnica assumida)
  * `override_justification`: Text nullable

---

### 3.4. Aresta `REGISTERS` (`RegistryAct`)
* **Origem:** Cartório de Registro Civil de Pessoas Jurídicas (RCPJ) & Receita Federal
* **Destino:** `DocumentRevision`
* **Campos:**
  * `id`: UUID
  * `subject_assembly_resolution_id`: Foreign Key (`AssemblyResolution.id`)
  * `subject_document_revision_id`: Foreign Key (`DocumentRevision.id`)
  * `registry_office`: String (ex.: `"Cartório de Registro Civil de Pessoas Jurídicas da Comarca de Bananeiras/PB"`)
  * `registry_number`: String (Número do livro/folha/registro)
  * `registration_date`: Date
  * `cnpj`: String (14 dígitos formatados)
  * `certified_document_hash`: String (SHA-256 do PDF final carimbado)

---

## 4. Invariantes de Transição e Regras de Integridade do Sistema

1. **Invariante de Sucessão Normativa:**
   * Uma deliberação vigente $D_n$ (`DELIBERADA`) **nunca** é revogada por um evento $P_{n+1}$ (`PROPOSTA`).
   * $D_n$ permanece `VIGENTE` e rege a conformidade até que um evento $D_{n+1}$ (`DELIBERADA`) seja aprovado pelo órgão competente.
2. **Invariante de Proveniência Causal:**
   * Toda `Clause` deve apontar para uma `DocumentRevision` e possuir ao menos uma aresta `IMPLEMENTED_BY` para um `DecisionEvent` com estado `DELIBERADA`.
   * Não é permitida a vinculação de cláusulas a eventos em estado `PROPOSTA` ou `RASCUNHO`.
3. **Invariante de Auditoria PONTE:**
   * O parecer `PonteAuditReview` só pode ser emitido sobre uma `Clause` existente no grafo.
   * Se a decisão sofrer nova revisão ($R_2$), as cláusulas de $R_1$ não transferem conformidade automática para $R_2$. A nova revisão requer novo ciclo de codificação e auditoria.
4. **Invariante Registral:**
   * O evento `REGISTRY_CONFIRMED` só pode ser gravado se houver uma `AssemblyResolution` aprovando a mesma `DocumentRevision`.
5. **Invariante de Imutabilidade e Integridade da Cadeia:**
   * Todo evento possui `previous_hash` apontando para o `content_hash` do evento cronologicamente anterior no stream.
   * A tentativa de persistir um evento em stream com cadeia rompida é rejeitada com erro `409 Conflict (Ledger Integrity Compromised)`.

---

## 5. Controle de Concorrência Otimista & Transacionalidade

No backend PostgreSQL / Graph DB, a gravação de eventos adota controle de concorrência estrito:

```sql
-- Exemplo de inserção segura com verificação de concorrência
BEGIN TRANSACTION;

-- 1. Verifica sequência atual
SELECT event_seq, content_hash 
FROM decision_events 
WHERE decision_id = 'DEC-001' 
ORDER BY event_seq DESC 
LIMIT 1 
FOR UPDATE;

-- 2. Valida se o client passou expected_previous_event_id e previous_hash
-- Se divergente, ROLLBACK e retorna HTTP 409 (Optimistic Concurrency Conflict)

-- 3. Insere novo evento append-only
INSERT INTO decision_events (
  event_id, decision_id, event_seq, event_type, decision_state,
  decision_revision, target_revision, selected_option, custom_formulation,
  institutional_rationale, caveats_conditions, revision_motive,
  deliberating_body, recorded_by_user_id, previous_event_id,
  supersedes_decision_event_id, previous_hash, content_hash, created_at
) VALUES (...);

COMMIT;
```

---

## 6. Matriz de Permissões e Perfis de Acesso (RBAC)

| Papel | Propor Alteração (`PROPOSTA`) | Deliberar Decisão (`DELIBERADA`) | Redigir Cláusula (`Clause`) | Emitir Parecer (`PonteAuditReview`) | Aprovar Minuta (`AssemblyResolution`) | Registrar RCPJ (`RegistryAct`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Instituidor Proponente** | Sim | Não | Não | Não | Não | Não |
| **Comitê Instituidor (Colegiado)** | Sim | Sim | Não | Não | Não | Não |
| **Assessor Jurídico do Cliente** | Não | Não | Sim | Não | Não | Não |
| **Auditor de Coerência PONTE** | Não | Não | Não | Sim | Não | Não |
| **Assembleia Geral de Fundação** | Não | Sim | Não | Não | Sim | Não |
| **Administrador do Sistema** | Read-Only | Read-Only | Read-Only | Read-Only | Read-Only | Sim |

---

## 7. Contrato de API (REST & Graph Endpoints)

### 7.1. Decision Stream
* `POST /api/v1/institutions/:id/decisions/:decisionId/events`
  * Grava um novo evento deliberativo (`PROPOSAL_CREATED` ou `DECISION_DELIBERATED`).
* `GET /api/v1/institutions/:id/decisions/:decisionId/ledger`
  * Retorna o stream integral de eventos com hashes encadeados.
* `GET /api/v1/institutions/:id/decisions/:decisionId/graph`
  * Retorna o nó da decisão, revisão vigente, proposta aberta e cláusulas vinculadas.

### 7.2. Document Stream & Grafo
* `POST /api/v1/institutions/:id/documents/:docId/revisions`
  * Inicia nova revisão de minuta (`M1` $	o$ `M2`).
* `POST /api/v1/institutions/:id/clauses`
  * Cria e vincula uma cláusula jurídica à revisão da minuta e à decisão deliberada (`IMPLEMENTED_BY`).
* `POST /api/v1/institutions/:id/clauses/:clauseId/reviews`
  * Emite parecer técnico de auditoria PONTE (`CONFORME`, `CONFORME_COM_RESSALVAS`, `DIVERGENTE`).
* `POST /api/v1/institutions/:id/documents/:docId/revisions/:revId/assembly-approval`
  * Registra aprovação formal pela Assembleia Geral.
* `POST /api/v1/institutions/:id/documents/:docId/revisions/:revId/registry-confirmation`
  * Registra o ato cartorário do RCPJ e o CNPJ emitido.

### 7.3. Auditoria e Exportação
* `GET /api/v1/institutions/:id/governance/dossier`
  * Gera o Caderno Consolidado de Deliberações e o Grafo de Proveniência em formato `.json` ou `.txt` assinado digitalmente.
* `GET /api/v1/institutions/:id/governance/verify-chain`
  * Executa a auditoria criptográfica completa de todos os streams e arestas do tenant.

---

## 8. Conclusão e Próximos Passos de Engenharia

Esta especificação encerra a fase de prototipagem e estabelece o contrato formal de engenharia para o backend do **Governance Graph**. O modelo transforma a atuação da consultoria em uma **plataforma probatória de conformidade institucional**, capaz de auditar e comprovar a aderência entre a vontade originária dos fundadores, o texto estatutário registrado e a operação cotidiana do ecossistema.
