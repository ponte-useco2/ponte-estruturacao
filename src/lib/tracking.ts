/**
 * Sistema simples de tracking de afiliados via query string `?ref=<id>`.
 *
 * Funcionamento:
 *   1. Visitante chega via link com `?ref=marcio` (ou utm_source=marcio)
 *   2. Client lê e salva em sessionStorage com TTL de 24h
 *   3. Form da landing E checkout injetam como hidden input
 *   4. Server actions extraem e gravam em `demanda_resumo` no formato `Ref: marcio`
 *
 * Uso (client):
 *   - useTrackingRef() ou getTrackingRefFromUrlAndStore() na inicialização
 *
 * Uso (server):
 *   - extractRefFromForm(formData) retorna o valor sanitizado ou null
 *
 * Query pra contar leads/checkouts por afiliado:
 *   SELECT * FROM leads WHERE demanda_resumo ILIKE '%Ref: marcio%';
 */

const STORAGE_KEY = "ponte_ref";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_LEN = 40;

/**
 * Sanitiza valor de ref: minúsculas, só letras/números/-/_, max 40 chars.
 * Previne XSS e injection — o ref vai parar no demanda_resumo (texto livre).
 */
function sanitizeRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, MAX_LEN);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * (CLIENT) Lê `?ref=` ou `?utm_source=` da URL atual e salva em sessionStorage.
 * Retorna o ref atual (recém-capturado ou previamente armazenado).
 *
 * Chamar dentro de useEffect na montagem do componente.
 */
export function getTrackingRefFromUrlAndStore(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = sanitizeRef(
      params.get("ref") || params.get("utm_source")
    );

    if (fromUrl) {
      // Atualiza storage com novo ref + timestamp
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ref: fromUrl, ts: Date.now() })
      );
      return fromUrl;
    }

    // Sem ref na URL — tenta resgatar do storage
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as { ref?: string; ts?: number };
    if (!parsed.ref || !parsed.ts) return null;

    // TTL expirado?
    if (Date.now() - parsed.ts > STORAGE_TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return sanitizeRef(parsed.ref);
  } catch {
    return null;
  }
}

/**
 * (SERVER) Extrai e sanitiza o campo `ref` enviado pelo formulário.
 * Retorna null se ausente ou inválido.
 */
export function extractRefFromForm(formData: FormData): string | null {
  const raw = formData.get("ref");
  if (typeof raw !== "string") return null;
  return sanitizeRef(raw);
}
