/**
 * Um e-mail com cara de e-mail (Sonar S8786, 12/11/2026): o que era `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` na action do
 * lead e na rota do formulário. A parte do domínio tinha o ponto dentro da classe e de novo fora dela, e isso volta atrás
 * em texto longo. Aqui o domínio é rótulos separados por ponto, sem ponto repetido, e o último rótulo tem ao menos dois
 * caracteres, como antes.
 */
const FORMA = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function emailValido(email: string): boolean {
  if (!FORMA.test(email)) return false;
  return email.length - email.lastIndexOf(".") > 2;
}
