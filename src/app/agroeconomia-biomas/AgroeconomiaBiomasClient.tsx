"use client";

/**
 * Programa Agroeconomia Biomas (ex-Paraíba Produtiva) — narrativa da proposta, em página longa de rolagem.
 *
 * Implementa o protótipo `Paraiba Produtiva.dc.html` — renomeado para
 * Programa Agroeconomia Biomas a pedido, em 03/09/2026 — (Claude Design). O JSX
 * abaixo é a conversão direta do HTML do protótipo — estilos inline, texto
 * verbatim, mesma ordem dos 19 blocos. O comportamento (reveal por rolagem,
 * diagramas que se desenham, contadores, índice lateral, barra de progresso,
 * parallax e o herói em canvas) é o script do protótipo portado para um
 * `useEffect`, sem biblioteca: era vanilla lá, continua vanilla aqui.
 *
 * Contrato de movimento: com `prefers-reduced-motion: reduce`, tudo entra em
 * estado final, sem transição, e o canvas do herói nem é desenhado. Nenhum
 * conteúdo depende de animação para existir.
 *
 * O texto é a redução editorial aprovada no protótipo. Não reescrever aqui —
 * mudança de conteúdo é no design, depois reconverte.
 */

import { useEffect, useRef, useState } from "react";

const ACCENT = "oklch(0.78 0.13 150)";
/** Deslocamento do reveal, em px. "cinematográfico" no protótipo. */
const DIST = 34;

export function AgroeconomiaBiomasClient() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Slider α/β do bloco Território: única peça com estado no protótipo.
  const [alphaRaw, setAlphaRaw] = useState(60);
  const alpha = (alphaRaw / 100).toFixed(2);
  const beta = (1 - alphaRaw / 100).toFixed(2);
  const onAlpha = (e: React.ChangeEvent<HTMLInputElement>) => setAlphaRaw(Number(e.target.value));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const limpezas: Array<() => void> = [];

    // ---- scroll reveal
    const reveals = Array.from(root.querySelectorAll<HTMLElement>("[data-r]"));
    if (!reduce) {
      reveals.forEach((el) => {
        const kind = el.getAttribute("data-r");
        el.style.willChange = "opacity, transform";
        el.style.transition =
          "opacity .9s cubic-bezier(.16,.8,.3,1), transform 1s cubic-bezier(.16,.8,.3,1)";
        if (kind === "rule") {
          el.style.transition = "transform 1.2s cubic-bezier(.16,.8,.3,1)";
          return;
        }
        el.style.opacity = "0";
        el.style.transform =
          kind === "row"
            ? `translateY(${DIST * 0.5}px)`
            : kind === "fade"
              ? "none"
              : `translateY(${DIST}px)`;
      });
    }

    const show = (el: HTMLElement) => {
      if (el.getAttribute("data-r") === "rule") {
        el.style.transform = "scaleX(1)";
        return;
      }
      el.style.opacity = "1";
      el.style.transform = "none";
    };

    // Irmãos com data-r entram em cascata: 90 ms por índice, teto de 6.
    const stagger = (el: HTMLElement) => {
      const p = el.parentElement;
      if (!p) return 0;
      const sibs = Array.from(p.children).filter((c) => c.hasAttribute("data-r"));
      const i = sibs.indexOf(el);
      return i > 0 ? Math.min(i, 6) * 90 : 0;
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target as HTMLElement;
          setTimeout(() => show(el), reduce ? 0 : stagger(el));
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    reveals.forEach((el) => io.observe(el));
    limpezas.push(() => io.disconnect());

    // ---- diagramas que se desenham ao entrar na tela
    const drawIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const wrap = en.target as HTMLElement;
          wrap.querySelectorAll<HTMLElement>("[data-bar]").forEach((b) => {
            b.style.width = b.getAttribute("data-bar") + "%";
          });
          Array.from(wrap.querySelectorAll<HTMLElement>("[data-step]")).forEach((s, i) => {
            s.style.transition = "opacity .55s ease, transform .6s cubic-bezier(.16,.8,.3,1)";
            s.style.opacity = "0";
            s.style.transform = "translateY(10px)";
            setTimeout(
              () => {
                s.style.opacity = "1";
                s.style.transform = "none";
              },
              reduce ? 0 : 60 + i * 55,
            );
          });
          drawIo.unobserve(wrap);
        });
      },
      { threshold: 0.25 },
    );
    root.querySelectorAll("[data-draw]").forEach((el) => drawIo.observe(el));
    limpezas.push(() => drawIo.disconnect());

    // ---- contadores
    const fmt = (n: number) => (n >= 1000 ? n.toLocaleString("pt-BR") : String(n));
    const cIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target as HTMLElement;
          const target = Number(el.getAttribute("data-count"));
          const label = el.textContent ?? "";
          cIo.unobserve(el);
          if (reduce || target > 500000) return;
          const suffix = label.indexOf("mil") > -1 ? " mil" : "";
          const shown = suffix ? Math.round(target / 1000) : target;
          const t0 = performance.now();
          const tick = (t: number) => {
            const k = Math.min(1, (t - t0) / 1300);
            const e = 1 - Math.pow(1 - k, 3);
            el.textContent = fmt(Math.round(shown * e)) + suffix;
            if (k < 1) requestAnimationFrame(tick);
            else el.textContent = label;
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.5 },
    );
    root.querySelectorAll("[data-count]").forEach((el) => cIo.observe(el));
    limpezas.push(() => cIo.disconnect());

    // ---- índice de capítulos + barra de progresso + parallax
    const nav = root.querySelector<HTMLElement>('[data-pp="index"]');
    const bar = root.querySelector<HTMLElement>('[data-pp="progress"]');
    const chapters = Array.from(root.querySelectorAll<HTMLElement>('[data-pp="chapter"]'));
    const dots: { a: HTMLAnchorElement; dot: HTMLElement; lbl: HTMLElement; sec: HTMLElement }[] = [];
    if (nav && !nav.childElementCount) {
      chapters.forEach((sec) => {
        const a = document.createElement("a");
        a.href = "#";
        a.setAttribute("aria-label", sec.getAttribute("data-pp-label") || "");
        a.style.cssText =
          "display:flex;align-items:center;gap:10px;text-decoration:none;border:0;cursor:pointer";
        const dot = document.createElement("span");
        dot.style.cssText =
          "width:6px;height:6px;border-radius:50%;background:oklch(0.45 0.01 110);transition:background .35s,transform .35s,box-shadow .35s;flex:none";
        const lbl = document.createElement("span");
        lbl.textContent = sec.getAttribute("data-pp-label") || "";
        lbl.style.cssText =
          "font-family:var(--pp-mono),monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:oklch(0.7 0.008 100);opacity:0;transform:translateX(-6px);transition:opacity .3s,transform .3s;white-space:nowrap";
        a.appendChild(dot);
        a.appendChild(lbl);
        a.onmouseenter = () => {
          lbl.style.opacity = "1";
          lbl.style.transform = "none";
        };
        a.onmouseleave = () => {
          if (!a.dataset.active) {
            lbl.style.opacity = "0";
            lbl.style.transform = "translateX(-6px)";
          }
        };
        a.onclick = (ev) => {
          ev.preventDefault();
          window.scrollTo({ top: sec.offsetTop, behavior: reduce ? "auto" : "smooth" });
        };
        nav.appendChild(a);
        dots.push({ a, dot, lbl, sec });
      });
      limpezas.push(() => {
        nav.replaceChildren();
      });
    }

    const parEls = Array.from(root.querySelectorAll<HTMLElement>("[data-par]"));
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = document.documentElement.scrollHeight - window.innerHeight;
        const y = window.scrollY;
        if (bar) bar.style.width = (h > 0 ? (y / h) * 100 : 0).toFixed(2) + "%";
        if (!reduce) {
          parEls.forEach((el) => {
            const r = el.getBoundingClientRect();
            const k = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
            const amt = -k * parseFloat(el.getAttribute("data-par") || "0") * 140;
            el.style.translate = "0 " + amt.toFixed(1) + "px";
          });
        }
        let active = 0;
        dots.forEach((d, i) => {
          if (d.sec.offsetTop - window.innerHeight * 0.35 <= y) active = i;
        });
        dots.forEach((d, i) => {
          const on = i === active;
          d.dot.style.background = on ? ACCENT : "oklch(0.45 0.01 110)";
          d.dot.style.transform = on ? "scale(1.7)" : "scale(1)";
          d.dot.style.boxShadow = on ? "0 0 0 4px oklch(0.62 0.14 150 / 0.14)" : "none";
          if (on) {
            d.a.dataset.active = "1";
            d.lbl.style.opacity = "1";
            d.lbl.style.transform = "none";
          } else {
            delete d.a.dataset.active;
            d.lbl.style.opacity = "0";
            d.lbl.style.transform = "translateX(-6px)";
          }
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    limpezas.push(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    });

    // ---- herói: retícula 3D de células comparáveis, reage ao cursor
    const cv = root.querySelector<HTMLCanvasElement>('[data-pp="field"]');
    const ctx = cv && !reduce ? cv.getContext("2d") : null;
    if (cv && ctx) {
      const pts: { x: number; y: number; z: number; s: number }[] = [];
      const N = 240;
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) {
        const yy = 1 - (i / (N - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - yy * yy));
        const th = golden * i;
        pts.push({ x: Math.cos(th) * r, y: yy, z: Math.sin(th) * r, s: 0.6 + Math.random() * 0.9 });
      }
      let W = 0;
      let H = 0;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const fit = () => {
        W = cv.clientWidth;
        H = cv.clientHeight;
        cv.width = W * dpr;
        cv.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      fit();
      window.addEventListener("resize", fit);

      let mx = 0;
      let my = 0;
      let tx = 0;
      let ty = 0;
      let t = 0;
      let alive = true;
      let heroRaf = 0;
      const onPointer = (e: PointerEvent) => {
        tx = (e.clientX / window.innerWidth - 0.5) * 2;
        ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      const loop = () => {
        if (!alive) return;
        t += 0.0022;
        mx += (tx - mx) * 0.05;
        my += (ty - my) * 0.05;
        const cy = Math.cos(t + mx * 0.7);
        const sy = Math.sin(t + mx * 0.7);
        const cx = Math.cos(my * 0.5);
        const sx = Math.sin(my * 0.5);
        const R = Math.min(W, H) * 0.42;
        const ox = W * 0.5;
        const oy = H * 0.46;
        ctx.clearRect(0, 0, W, H);
        const proj = pts.map((p) => {
          const x = p.x * cy - p.z * sy;
          let z = p.x * sy + p.z * cy;
          const y = p.y * cx - z * sx;
          z = p.y * sx + z * cx;
          const persp = 2.6 / (2.6 + z);
          return { X: ox + x * R * persp, Y: oy + y * R * persp, d: persp, s: p.s };
        });
        for (let i = 0; i < proj.length; i++) {
          for (let j = i + 1; j < proj.length; j++) {
            const dx = proj[i].X - proj[j].X;
            const dy = proj[i].Y - proj[j].Y;
            const dd = dx * dx + dy * dy;
            if (dd < 5200) {
              const a = (1 - dd / 5200) * 0.3 * proj[i].d;
              ctx.strokeStyle = "oklch(0.72 0.13 150 / " + a.toFixed(3) + ")";
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              ctx.moveTo(proj[i].X, proj[i].Y);
              ctx.lineTo(proj[j].X, proj[j].Y);
              ctx.stroke();
            }
          }
        }
        proj.forEach((p) => {
          ctx.fillStyle = "oklch(0.85 0.1 150 / " + (0.16 + (p.d - 0.7) * 0.85).toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(p.X, p.Y, p.s * p.d * 1.5, 0, 6.2832);
          ctx.fill();
        });
        heroRaf = requestAnimationFrame(loop);
      };

      // Pausa o desenho quando o herói sai da tela: não vale gastar GPU num
      // canvas que ninguém vê.
      const heroIo = new IntersectionObserver(
        (en) => {
          alive = en[0].isIntersecting;
          if (alive) heroRaf = requestAnimationFrame(loop);
        },
        { threshold: 0.02 },
      );
      heroIo.observe(cv);
      heroRaf = requestAnimationFrame(loop);

      limpezas.push(() => {
        alive = false;
        if (heroRaf) cancelAnimationFrame(heroRaf);
        heroIo.disconnect();
        window.removeEventListener("resize", fit);
        window.removeEventListener("pointermove", onPointer);
      });
    } else if (cv) {
      cv.style.display = "none";
    }

    return () => limpezas.forEach((fn) => fn());
  }, []);

  return (
    <div ref={rootRef} className="pp-root">
      <div style={{ position: "fixed", top: "0", left: "0", right: "0", height: "2px", zIndex: "90", background: "oklch(0.24 0.01 110)" }}>
        <div data-pp="progress" style={{ height: "100%", width: "0%", background: "linear-gradient(90deg, oklch(0.62 0.14 150), oklch(0.86 0.10 150))" }}></div>
      </div>

      <nav data-pp="index" style={{ position: "fixed", left: "22px", top: "50%", transform: "translateY(-50%)", zIndex: "80", display: "flex", flexDirection: "column", gap: "12px" }}></nav>

      <main style={{ position: "relative", width: "100%" }}>

        <section data-pp="chapter" data-pp-label="Abertura" style={{ position: "relative", minHeight: "100vh", display: "grid", gridTemplateRows: "1fr auto", overflow: "hidden" }}>
          <canvas data-pp="field" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" }}></canvas>
          <div style={{ position: "absolute", inset: "0", background: "radial-gradient(115% 85% at 55% 8%, transparent 26%, oklch(0.17 0.008 110 / 0.9) 74%)" }}></div>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", gap: "32px", padding: "120px clamp(28px, 8vw, 170px) 40px" }}>
            <div data-r="fade" data-par="0.05" style={{ display: "flex", alignItems: "center", gap: "14px", fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.22em", textTransform: "uppercase", color: "oklch(0.78 0.13 150)" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "oklch(0.78 0.13 150)", animation: "pp-pulse 2.6s ease-in-out infinite" }}></span>
              <span>Programa de desenvolvimento produtivo territorial</span>
            </div>
            <h1 data-r="up" data-par="0.12" style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(58px, 12vw, 186px)", lineHeight: "0.86", letterSpacing: "-0.035em" }}> Agroeconomia<br /><em style={{ fontStyle: "italic", color: "oklch(0.78 0.13 150)" }}>Biomas</em>
            </h1>
            <p data-r="up" data-par="0.2" style={{ margin: "0", maxWidth: "720px", fontSize: "clamp(19px, 2.1vw, 27px)", lineHeight: "1.45", color: "oklch(0.88 0.006 100)", textWrap: "pretty" }}> Inteligência empresarial para transformar problemas individuais em prosperidade territorial. </p>
            <div data-r="up" style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "6px" }}>
              <a href="#tese" style={{ padding: "15px 26px", borderRadius: "999px", background: "oklch(0.78 0.13 150)", color: "oklch(0.2 0.03 150)", fontSize: "15px", fontWeight: "600", transition: "transform .3s cubic-bezier(.2,.8,.2,1), background .3s" }} className="pp-hv-1">Ler a tese</a>
              <a href="#decisoes" style={{ padding: "15px 26px", borderRadius: "999px", border: "1px solid oklch(0.4 0.01 110)", color: "oklch(0.9 0.006 100)", fontSize: "15px", fontWeight: "500", transition: "transform .3s cubic-bezier(.2,.8,.2,1), border-color .3s, color .3s" }} className="pp-hv-2">Decisões de arquitetura v1.0</a>
            </div>
          </div>
          <div style={{ position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "20px", padding: "0 clamp(28px, 8vw, 170px) 44px", fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.1em", color: "oklch(0.66 0.008 100)" }}>
            <span data-r="fade">USECO₂ é a infraestrutura. Não é o programa.</span>
            <span data-r="fade" style={{ display: "flex", alignItems: "center", gap: "10px" }}>role para começar <span style={{ animation: "pp-blink 1.8s steps(1) infinite" }}>▼</span></span>
          </div>
        </section>

        <section id="tese" data-pp="chapter" data-pp-label="Tese central" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)" }}>
          <div data-r="rule" style={{ height: "1px", background: "oklch(0.62 0.14 150)", transform: "scaleX(0)", transformOrigin: "left", marginBottom: "60px" }}></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(36px, 6vw, 90px)", alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>01 — Tese central</span>
              <p data-r="up" style={{ margin: "0", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.72 0.008 100)", maxWidth: "380px", textWrap: "pretty" }}>A USECO₂ é a infraestrutura tecnológica e metodológica subjacente. Não é o programa. O que ela traz é a expertise construída no bioma da Caatinga — inventário de emissões, eficiência em energia, água e resíduos, leitura territorial com GIS — posta a serviço de uma pergunta que nenhum pequeno negócio responde sozinho: como o seu território produz, e onde ele trava.</p>
            </div>
            <blockquote data-r="up" style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(27px, 3.5vw, 50px)", lineHeight: "1.16", letterSpacing: "-0.02em", textWrap: "pretty" }}> O Agroeconomia Biomas é um programa de desenvolvimento produtivo territorial que oferece ao pequeno negócio uma <em style={{ color: "oklch(0.78 0.13 150)" }}>referência que ele não possui sozinho</em>, transforma milhares dessas referências em inteligência para o Sebrae e converte gargalos recorrentes em ações empresariais e projetos coletivos mensuráveis. </blockquote>
          </div>
        </section>

        <section data-pp="chapter" data-pp-label="A pergunta" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)", background: "oklch(0.135 0.008 110)" }}>
          <div style={{ maxWidth: "1040px", display: "flex", flexDirection: "column", gap: "44px" }}>
            <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>02 — A entrada institucional</span>
            <p data-r="up" style={{ margin: "0", fontSize: "clamp(23px, 2.9vw, 39px)", lineHeight: "1.3", letterSpacing: "-0.02em", textWrap: "pretty" }}> “O Sebrae/PB consegue hoje identificar, de maneira contínua e comparável, quando dezenas de problemas de pequenas empresas constituem um mesmo gargalo territorial que justificaria uma intervenção coletiva — e medir se essa intervenção produziu mais resultado por real investido que o atendimento individual?” </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px" }}>
              <div data-r="up" style={{ padding: "26px", border: "1px solid oklch(0.28 0.01 110)", borderRadius: "14px", transition: "transform .35s cubic-bezier(.2,.8,.2,1), border-color .35s" }} className="pp-hv-3">
                <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11.5px", letterSpacing: "0.12em", color: "oklch(0.78 0.13 150)", marginBottom: "10px" }}>SE “JÁ FAZEMOS”</div>
                <div style={{ fontSize: "17px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}>A proposta perde razão de existir.</div>
              </div>
              <div data-r="up" style={{ padding: "26px", border: "1px solid oklch(0.28 0.01 110)", borderRadius: "14px", transition: "transform .35s cubic-bezier(.2,.8,.2,1), border-color .35s" }} className="pp-hv-3">
                <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11.5px", letterSpacing: "0.12em", color: "oklch(0.78 0.13 150)", marginBottom: "10px" }}>SE “EM PARTE”</div>
                <div style={{ fontSize: "17px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}>Começamos a mapear a lacuna.</div>
              </div>
              <div data-r="up" style={{ padding: "26px", border: "1px solid oklch(0.55 0.1 150)", borderRadius: "14px", background: "oklch(0.62 0.14 150 / 0.1)", transition: "transform .35s cubic-bezier(.2,.8,.2,1), border-color .35s" }} className="pp-hv-4">
                <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11.5px", letterSpacing: "0.12em", color: "oklch(0.82 0.12 150)", marginBottom: "10px" }}>SE “NÃO”</div>
                <div style={{ fontSize: "17px", lineHeight: "1.5", color: "oklch(0.92 0.006 100)" }}>Temos o problema.</div>
              </div>
            </div>
          </div>
        </section>

        <section data-pp="chapter" data-pp-label="Três dores" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)" }}>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>03 — O problema institucional</span>
          <h2 data-r="up" style={{ margin: "20px 0 56px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(36px, 5.6vw, 78px)", lineHeight: "1.02", letterSpacing: "-0.03em", maxWidth: "880px", textWrap: "balance" }}>Três lacunas que o programa existe para fechar</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "1px", background: "oklch(0.26 0.01 110)" }}>
            <article data-r="up" style={{ padding: "clamp(28px, 3vw, 44px)", background: "oklch(0.17 0.008 110)", display: "flex", flexDirection: "column", gap: "14px", minHeight: "290px", transition: "background .4s" }} className="pp-hv-5">
              <span style={{ fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "60px", lineHeight: "1", color: "oklch(0.62 0.14 150)" }}>1</span>
              <h3 style={{ margin: "0", fontSize: "23px", fontWeight: "500", letterSpacing: "-0.01em" }}>Informação fragmentada</h3>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.6", color: "oklch(0.76 0.008 100)", textWrap: "pretty" }}>Cada atendimento produz valor individual, mas nem sempre aumenta proporcionalmente a inteligência disponível para a próxima decisão territorial.</p>
            </article>
            <article data-r="up" style={{ padding: "clamp(28px, 3vw, 44px)", background: "oklch(0.17 0.008 110)", display: "flex", flexDirection: "column", gap: "14px", minHeight: "290px", transition: "background .4s" }} className="pp-hv-5">
              <span style={{ fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "60px", lineHeight: "1", color: "oklch(0.62 0.14 150)" }}>2</span>
              <h3 style={{ margin: "0", fontSize: "23px", fontWeight: "500", letterSpacing: "-0.01em" }}>Intervenção unitária em problema coletivo</h3>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.6", color: "oklch(0.76 0.008 100)", textWrap: "pretty" }}>Se 80 empresas têm o mesmo gargalo, 80 atendimentos separados podem ser economicamente inferiores a uma intervenção coletiva.</p>
            </article>
            <article data-r="up" style={{ padding: "clamp(28px, 3vw, 44px)", background: "oklch(0.17 0.008 110)", display: "flex", flexDirection: "column", gap: "14px", minHeight: "290px", transition: "background .4s" }} className="pp-hv-5">
              <span style={{ fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "60px", lineHeight: "1", color: "oklch(0.62 0.14 150)" }}>3</span>
              <h3 style={{ margin: "0", fontSize: "23px", fontWeight: "500", letterSpacing: "-0.01em" }}>Mensuração</h3>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.6", color: "oklch(0.76 0.008 100)", textWrap: "pretty" }}>É fácil medir número de atendimentos. É muito mais difícil conectar atendimento → ação → resultado → mudança territorial.</p>
            </article>
          </div>
        </section>

        <section id="espelho" data-pp="chapter" data-pp-label="Espelho do Negócio" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)", background: "oklch(0.135 0.008 110)", overflow: "hidden" }}>
          <div data-r="fade" data-par="0.08" style={{ position: "absolute", right: "-6vw", top: "8%", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(140px, 24vw, 380px)", lineHeight: "1", color: "oklch(0.2 0.012 130)", pointerEvents: "none", userSelect: "none" }}>01</div>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "18px", maxWidth: "900px" }}>
            <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>04 — A porta universal</span>
            <h2 data-r="up" style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(38px, 6vw, 86px)", lineHeight: "1", letterSpacing: "-0.03em" }}>Espelho do Negócio</h2>
            <p data-r="up" style={{ margin: "6px 0 0", fontSize: "clamp(19px, 2.1vw, 26px)", lineHeight: "1.45", color: "oklch(0.9 0.006 100)", textWrap: "pretty" }}>“Compartilhe alguns números do seu negócio e veja como você está em relação a uma referência que importa.”</p>
            <p data-r="up" style={{ margin: "0", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.72 0.008 100)", maxWidth: "640px", textWrap: "pretty" }}>O empresário não responde um Radar. Ele recebe uma régua. A recomendação vem depois da evidência: <strong style={{ fontWeight: "500", color: "oklch(0.9 0.006 100)" }}>comparação precede recomendação.</strong></p>
          </div>

          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginTop: "56px" }}>
            <div data-r="up" style={{ padding: "clamp(26px, 3vw, 40px)", border: "1px solid oklch(0.28 0.01 110)", borderRadius: "18px", background: "oklch(0.17 0.008 110)", display: "flex", flexDirection: "column", gap: "20px", transition: "border-color .4s, transform .4s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-6">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}>
                <h3 style={{ margin: "0", fontSize: "25px", fontWeight: "500", letterSpacing: "-0.015em" }}>Espelho de Pares</h3>
                <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.12em", color: "oklch(0.78 0.13 150)" }}>A</span>
              </div>
              <p style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "22px", lineHeight: "1.3", color: "oklch(0.88 0.006 100)" }}>“Como estou em relação a negócios semelhantes?”</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "15px", color: "oklch(0.74 0.008 100)" }}>
                <div><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.14em", color: "oklch(0.6 0.008 100)", display: "block", marginBottom: "6px" }}>MERCADINHO</span>energia · taxa de cartão · produtividade · vendas digitais · custos relevantes</div>
                <div><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.14em", color: "oklch(0.6 0.008 100)", display: "block", marginBottom: "6px" }}>MEI</span>preço · receita/faixa · canais · capacidade · enquadramento</div>
              </div>
            </div>
            <div data-r="up" style={{ padding: "clamp(26px, 3vw, 40px)", border: "1px solid oklch(0.28 0.01 110)", borderRadius: "18px", background: "oklch(0.17 0.008 110)", display: "flex", flexDirection: "column", gap: "20px", transition: "border-color .4s, transform .4s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-6">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}>
                <h3 style={{ margin: "0", fontSize: "25px", fontWeight: "500", letterSpacing: "-0.015em" }}>Espelho de Oportunidade</h3>
                <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.12em", color: "oklch(0.78 0.13 150)" }}>B</span>
              </div>
              <p style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "22px", lineHeight: "1.3", color: "oklch(0.88 0.006 100)" }}>“Quão distante estou de algo que quero acessar?”</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "15px", color: "oklch(0.74 0.008 100)" }}>
                <div><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.14em", color: "oklch(0.6 0.008 100)", display: "block", marginBottom: "6px" }}>AGROINDÚSTRIA</span>rede varejista · PNAE · compras públicas · cliente âncora · crédito · certificação</div>
              </div>
            </div>
          </div>

          <div data-r="up" style={{ position: "relative", marginTop: "40px", padding: "30px clamp(22px, 3vw, 38px)", borderRadius: "18px", background: "oklch(0.17 0.008 110)", border: "1px dashed oklch(0.32 0.02 130)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "clamp(12px, 2vw, 28px)", fontFamily: "var(--pp-mono), monospace", fontSize: "clamp(12px, 1.3vw, 15px)", letterSpacing: "0.06em", color: "oklch(0.86 0.006 100)" }}>
            <span>Estado atual</span><span style={{ color: "oklch(0.78 0.13 150)" }}>→</span><span>Referência</span><span style={{ color: "oklch(0.78 0.13 150)" }}>→</span><span>Gap</span><span style={{ color: "oklch(0.78 0.13 150)" }}>→</span><span>Próximo passo</span>
          </div>
        </section>

        <section data-pp="chapter" data-pp-label="Contrapartida" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)" }}>
          <div data-r="rule" style={{ height: "1px", background: "oklch(0.62 0.14 150)", transform: "scaleX(0)", transformOrigin: "left", marginBottom: "56px" }}></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(36px, 6vw, 80px)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>05 — A contrapartida</span>
              <h2 data-r="up" style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(32px, 4.4vw, 62px)", lineHeight: "1.05", letterSpacing: "-0.03em" }}>Não é “ganhe um diagnóstico gratuito”</h2>
              <p data-r="up" style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontStyle: "italic", fontSize: "clamp(22px, 2.6vw, 34px)", lineHeight: "1.25", color: "oklch(0.78 0.13 150)" }}>“Descubra aquilo que seu próprio número não consegue mostrar.”</p>
              <p data-r="up" style={{ margin: "0", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.72 0.008 100)", maxWidth: "420px", textWrap: "pretty" }}>O empresário não fornece dados para alimentar uma política pública. Fornece dados porque recebe uma régua que sozinho não possui.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div data-r="up" style={{ padding: "24px 26px", borderRadius: "16px", background: "oklch(0.135 0.008 110)", borderLeft: "2px solid oklch(0.62 0.14 150)", fontSize: "17px", lineHeight: "1.5", transition: "transform .35s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-7">“Seu consumo energético relativo está no quartil superior do grupo comparável.”</div>
              <div data-r="up" style={{ padding: "24px 26px", borderRadius: "16px", background: "oklch(0.135 0.008 110)", borderLeft: "2px solid oklch(0.62 0.14 150)", fontSize: "17px", lineHeight: "1.5", transition: "transform .35s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-7">“Você cumpre 6 dos 9 requisitos identificados para esta oportunidade; estes três ainda faltam.”</div>
              <div data-r="up" style={{ padding: "24px 26px", borderRadius: "16px", background: "oklch(0.135 0.008 110)", borderLeft: "2px solid oklch(0.62 0.14 150)", fontSize: "17px", lineHeight: "1.5", transition: "transform .35s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-7">“Seu preço está abaixo da faixa mediana observada entre negócios comparáveis da sua região.”</div>
            </div>
          </div>
        </section>

        <section data-pp="chapter" data-pp-label="Três réguas" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)", background: "oklch(0.135 0.008 110)" }}>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>06 — Cold start</span>
          <h2 data-r="up" style={{ margin: "20px 0 18px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(34px, 5vw, 70px)", lineHeight: "1.03", letterSpacing: "-0.03em", maxWidth: "860px", textWrap: "balance" }}>O benchmark começa antes de existir amostra</h2>
          <p data-r="up" style={{ margin: "0 0 52px", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.72 0.008 100)", maxWidth: "560px", textWrap: "pretty" }}>Não podemos prometer benchmark comunitário sem amostra. Três réguas resolvem a partida — e a terceira é a que cria o efeito de rede.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" }}>
            <div data-r="up" style={{ padding: "30px", borderRadius: "16px", border: "1px solid oklch(0.28 0.01 110)", display: "flex", flexDirection: "column", gap: "12px", transition: "border-color .4s, transform .4s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-8">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.16em", color: "oklch(0.78 0.13 150)" }}>TIPO A</span>
              <h3 style={{ margin: "0", fontSize: "22px", fontWeight: "500" }}>Régua normativa</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "oklch(0.74 0.008 100)" }}>requisitos legais · limites · critérios de programas · padrões objetivos</p>
            </div>
            <div data-r="up" style={{ padding: "30px", borderRadius: "16px", border: "1px solid oklch(0.28 0.01 110)", display: "flex", flexDirection: "column", gap: "12px", transition: "border-color .4s, transform .4s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-8">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.16em", color: "oklch(0.78 0.13 150)" }}>TIPO B</span>
              <h3 style={{ margin: "0", fontSize: "22px", fontWeight: "500" }}>Régua externa</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "oklch(0.74 0.008 100)" }}>bases públicas · dados setoriais · dados Sebrae autorizados · referências técnicas</p>
            </div>
            <div data-r="up" style={{ padding: "30px", borderRadius: "16px", border: "1px solid oklch(0.55 0.1 150)", background: "oklch(0.62 0.14 150 / 0.08)", display: "flex", flexDirection: "column", gap: "12px", transition: "border-color .4s, transform .4s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-4">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.16em", color: "oklch(0.84 0.12 150)" }}>TIPO C</span>
              <h3 style={{ margin: "0", fontSize: "22px", fontWeight: "500" }}>Régua comunitária</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "oklch(0.8 0.02 130)" }}>participantes · agregada · anonimizada · estratificada</p>
            </div>
          </div>
          <div data-r="up" style={{ marginTop: "40px", padding: "34px clamp(22px, 3vw, 40px)", borderRadius: "18px", background: "oklch(0.17 0.008 110)" }}>
            <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.18em", color: "oklch(0.66 0.008 100)", marginBottom: "22px" }}>EFEITO DE REDE</div>
            <div data-draw="loop" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px", fontSize: "clamp(13px, 1.4vw, 16px)", color: "oklch(0.86 0.006 100)" }}>
              <span data-step="" style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid oklch(0.32 0.02 130)" }}>normativa + externa</span>
              <span style={{ color: "oklch(0.78 0.13 150)" }}>→</span>
              <span data-step="" style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid oklch(0.32 0.02 130)" }}>primeiros participantes</span>
              <span style={{ color: "oklch(0.78 0.13 150)" }}>→</span>
              <span data-step="" style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid oklch(0.32 0.02 130)" }}>massa comparável</span>
              <span style={{ color: "oklch(0.78 0.13 150)" }}>→</span>
              <span data-step="" style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid oklch(0.32 0.02 130)" }}>benchmark comunitário</span>
              <span style={{ color: "oklch(0.78 0.13 150)" }}>→</span>
              <span data-step="" style={{ padding: "8px 14px", borderRadius: "999px", border: "1px solid oklch(0.55 0.1 150)", background: "oklch(0.62 0.14 150 / 0.12)" }}>mais adesão</span>
              <span style={{ color: "oklch(0.78 0.13 150)" }}>↻</span>
            </div>
          </div>
        </section>

        <section data-pp="chapter" data-pp-label="Célula comparável" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(36px, 6vw, 80px)", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>07 — A unidade fundamental</span>
              <h2 data-r="up" style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(32px, 4.6vw, 64px)", lineHeight: "1.04", letterSpacing: "-0.03em" }}>A unidade não é “usuário”. É <em style={{ color: "oklch(0.78 0.13 150)" }}>célula comparável</em>.</h2>
              <p data-r="up" style={{ margin: "0", fontSize: "17px", lineHeight: "1.6", color: "oklch(0.78 0.008 100)", maxWidth: "460px", textWrap: "pretty" }}>Cinco mil empresas heterogêneas podem produzir pouca informação comparativa. Cem empresas homogêneas podem produzir muito.</p>
              <div data-r="up" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "14px", lineHeight: "2", color: "oklch(0.8 0.008 100)", padding: "24px", borderRadius: "14px", background: "oklch(0.135 0.008 110)" }}> atividade<br />+ porte<br />+ região<br />+ estrutura operacional<br />+ variável normalizada<br /><span style={{ color: "oklch(0.78 0.13 150)" }}>= célula comparável</span>
              </div>
            </div>
            <div data-r="up" style={{ padding: "clamp(28px, 3.5vw, 52px)", borderRadius: "20px", border: "1px solid oklch(0.28 0.01 110)", display: "flex", flexDirection: "column", gap: "22px" }}>
              <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.18em", color: "oklch(0.66 0.008 100)" }}>MÉTRICA CENTRAL</div>
              <h3 style={{ margin: "0", fontSize: "clamp(24px, 2.6vw, 34px)", fontWeight: "500", letterSpacing: "-0.02em" }}>Cobertura de Benchmark Útil</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "18px", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(22px, 2.4vw, 30px)" }}>
                <span style={{ color: "oklch(0.78 0.13 150)" }}>CBU =</span>
                <span style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ paddingBottom: "8px", borderBottom: "1px solid oklch(0.45 0.02 120)", fontSize: "clamp(16px, 1.7vw, 21px)", fontFamily: "var(--pp-sans), sans-serif" }}>empresas com referência comparável confiável</span>
                  <span style={{ fontSize: "clamp(16px, 1.7vw, 21px)", fontFamily: "var(--pp-sans), sans-serif" }}>empresas participantes</span>
                </span>
              </div>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "oklch(0.72 0.008 100)" }}>Muito mais sofisticado que “10 mil cadastros”.</p>
            </div>
          </div>
        </section>

        <section id="irg" data-pp="chapter" data-pp-label="IRG e IOC" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)", background: "oklch(0.135 0.008 110)" }}>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>08 — O coração institucional</span>
          <h2 data-r="up" style={{ margin: "20px 0 16px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(34px, 5.2vw, 74px)", lineHeight: "1.02", letterSpacing: "-0.03em", maxWidth: "900px", textWrap: "balance" }}>O Espelho conquista o empresário. O IRG conquista o Sebrae.</h2>
          <p data-r="up" style={{ margin: "0 0 54px", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.72 0.008 100)", maxWidth: "580px" }}>Índice de Recorrência de Gargalo, por gargalo, território e setor.</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            <div data-r="up" style={{ padding: "clamp(28px, 3.2vw, 46px)", borderRadius: "20px", background: "oklch(0.17 0.008 110)", display: "flex", flexDirection: "column", gap: "26px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "18px", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(22px, 2.4vw, 30px)" }}>
                <span style={{ color: "oklch(0.78 0.13 150)" }}>IRG =</span>
                <span style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ paddingBottom: "8px", borderBottom: "1px solid oklch(0.45 0.02 120)", fontSize: "clamp(15px, 1.6vw, 20px)", fontFamily: "var(--pp-sans), sans-serif" }}>MPEs afetadas pelo gargalo g</span>
                  <span style={{ fontSize: "clamp(15px, 1.6vw, 20px)", fontFamily: "var(--pp-sans), sans-serif" }}>MPEs comparáveis observadas</span>
                </span>
              </div>
              <div data-draw="bars" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "oklch(0.8 0.008 100)" }}><span>energia</span><span data-bar-val="" style={{ fontFamily: "var(--pp-mono), monospace", color: "oklch(0.78 0.13 150)" }}>37%</span></div>
                  <div style={{ height: "7px", borderRadius: "99px", background: "oklch(0.24 0.01 110)", overflow: "hidden" }}><div data-bar="37" style={{ height: "100%", width: "0%", borderRadius: "99px", background: "oklch(0.7 0.14 150)", transition: "width 1.1s cubic-bezier(.2,.8,.2,1)" }}></div></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "oklch(0.8 0.008 100)" }}><span>equipamento</span><span data-bar-val="" style={{ fontFamily: "var(--pp-mono), monospace", color: "oklch(0.78 0.13 150)" }}>31%</span></div>
                  <div style={{ height: "7px", borderRadius: "99px", background: "oklch(0.24 0.01 110)", overflow: "hidden" }}><div data-bar="31" style={{ height: "100%", width: "0%", borderRadius: "99px", background: "oklch(0.7 0.14 150)", transition: "width 1.1s cubic-bezier(.2,.8,.2,1)", transitionDelay: ".12s" }}></div></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "oklch(0.8 0.008 100)" }}><span>capacidade</span><span data-bar-val="" style={{ fontFamily: "var(--pp-mono), monospace", color: "oklch(0.78 0.13 150)" }}>28%</span></div>
                  <div style={{ height: "7px", borderRadius: "99px", background: "oklch(0.24 0.01 110)", overflow: "hidden" }}><div data-bar="28" style={{ height: "100%", width: "0%", borderRadius: "99px", background: "oklch(0.7 0.14 150)", transition: "width 1.1s cubic-bezier(.2,.8,.2,1)", transitionDelay: ".24s" }}></div></div>
                </div>
              </div>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "oklch(0.72 0.008 100)", textWrap: "pretty" }}>Leitura ilustrativa: “37% das pequenas agroindústrias observadas no território apresentam simultaneamente gargalo de energia, equipamento e capacidade.”</p>
            </div>

            <div data-r="up" style={{ padding: "clamp(28px, 3.2vw, 46px)", borderRadius: "20px", background: "oklch(0.17 0.008 110)", display: "flex", flexDirection: "column", gap: "26px" }}>
              <div>
                <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.18em", color: "oklch(0.66 0.008 100)", marginBottom: "14px" }}>ÍNDICE DE OPORTUNIDADE COLETIVA</div>
                <div style={{ fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(20px, 2.1vw, 27px)", lineHeight: "1.4" }}><span style={{ color: "oklch(0.78 0.13 150)" }}>IOC = f(</span>recorrência, severidade, empresas afetadas, impacto, viabilidade, custo<span style={{ color: "oklch(0.78 0.13 150)" }}>)</span></div>
              </div>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.6", color: "oklch(0.78 0.008 100)" }}>Nem todo problema frequente merece projeto.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div style={{ padding: "22px", borderRadius: "14px", border: "1px solid oklch(0.28 0.01 110)" }}>
                  <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.14em", color: "oklch(0.66 0.008 100)", marginBottom: "8px" }}>IOC BAIXO</div>
                  <div style={{ fontSize: "17px" }}>atendimento individual</div>
                </div>
                <div style={{ padding: "22px", borderRadius: "14px", border: "1px solid oklch(0.55 0.1 150)", background: "oklch(0.62 0.14 150 / 0.1)" }}>
                  <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.14em", color: "oklch(0.84 0.12 150)", marginBottom: "8px" }}>IOC ALTO</div>
                  <div style={{ fontSize: "17px" }}>estudar intervenção coletiva</div>
                </div>
              </div>
              <p style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(19px, 2vw, 25px)", lineHeight: "1.3", color: "oklch(0.9 0.006 100)", textWrap: "pretty" }}>“Quando deixamos de atender 80 empresas individualmente e começamos a resolver um problema de 80 empresas?”</p>
            </div>
          </div>
        </section>

        <section id="niveis" data-pp="chapter" data-pp-label="Quatro níveis" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)" }}>
          <div data-r="rule" style={{ height: "1px", background: "oklch(0.62 0.14 150)", transform: "scaleX(0)", transformOrigin: "left", marginBottom: "56px" }}></div>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>09 — O programa completo</span>
          <h2 data-r="up" style={{ margin: "20px 0 56px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(34px, 5.2vw, 74px)", lineHeight: "1.02", letterSpacing: "-0.03em" }}>Quatro níveis</h2>
          <div data-draw="levels" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "1px", background: "oklch(0.26 0.01 110)", borderTop: "1px solid oklch(0.26 0.01 110)", borderBottom: "1px solid oklch(0.26 0.01 110)" }}>
            <article data-r="up" style={{ background: "oklch(0.17 0.008 110)", padding: "clamp(26px, 3vw, 40px)", display: "flex", flexDirection: "column", gap: "16px", minHeight: "340px", transition: "background .4s" }} className="pp-hv-5">
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>N0</span><h3 style={{ margin: "0", fontSize: "24px", fontWeight: "500", letterSpacing: "-0.01em" }}>Espelho</h3></div>
              <p style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "24px", color: "oklch(0.9 0.006 100)" }}>Como estou?</p>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.65", color: "oklch(0.74 0.008 100)" }}>universal · digital-first · baixa intensidade · valor imediato</p>
            </article>
            <article data-r="up" style={{ background: "oklch(0.17 0.008 110)", padding: "clamp(26px, 3vw, 40px)", display: "flex", flexDirection: "column", gap: "16px", minHeight: "340px", transition: "background .4s" }} className="pp-hv-5">
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>N1</span><h3 style={{ margin: "0", fontSize: "24px", fontWeight: "500", letterSpacing: "-0.01em" }}>Raio-X</h3></div>
              <p style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "24px", color: "oklch(0.9 0.006 100)" }}>Por que estou assim?</p>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.65", color: "oklch(0.74 0.008 100)" }}>eficiência · energia · água · resíduos · processos · dados · readiness · sustentabilidade · GEE quando relevante</p>
            </article>
            <article data-r="up" style={{ background: "oklch(0.17 0.008 110)", padding: "clamp(26px, 3vw, 40px)", display: "flex", flexDirection: "column", gap: "16px", minHeight: "340px", transition: "background .4s" }} className="pp-hv-5">
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>N2</span><h3 style={{ margin: "0", fontSize: "24px", fontWeight: "500", letterSpacing: "-0.01em" }}>Rota</h3></div>
              <p style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "24px", color: "oklch(0.9 0.006 100)" }}>O que faço agora?</p>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.65", color: "oklch(0.74 0.008 100)" }}>ALI · Sebrae · mercado · crédito · SENAI · universidade · fornecedor · tecnologia · capacitação</p>
              <p style={{ margin: "0", fontSize: "14px", color: "oklch(0.66 0.008 100)", fontStyle: "italic" }}>A USECO₂ não monopoliza a resposta.</p>
            </article>
            <article data-r="up" style={{ background: "oklch(0.17 0.008 110)", padding: "clamp(26px, 3vw, 40px)", display: "flex", flexDirection: "column", gap: "16px", minHeight: "340px", transition: "background .4s" }} className="pp-hv-5">
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>N3</span><h3 style={{ margin: "0", fontSize: "24px", fontWeight: "500", letterSpacing: "-0.01em" }}>Projeto</h3></div>
              <p style={{ margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "24px", color: "oklch(0.9 0.006 100)" }}>O que resolvemos coletivamente?</p>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.65", color: "oklch(0.74 0.008 100)" }}>PMO · MRV · cronograma · riscos · parceiros · indicadores · financiabilidade · accountability</p>
            </article>
          </div>

          <details data-r="up" style={{ marginTop: "28px", borderRadius: "16px", background: "oklch(0.135 0.008 110)", overflow: "hidden" }}>
            <summary style={{ padding: "24px clamp(22px, 3vw, 36px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", fontSize: "17px", fontWeight: "500" }}>
              <span>Como cada capacidade original da USECO₂ é reaproveitada</span>
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>12 itens · abrir</span>
            </summary>
            <div style={{ padding: "0 clamp(22px, 3vw, 36px) 30px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1px 28px", fontSize: "15px", color: "oklch(0.78 0.008 100)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>Inventário GEE</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>indicador de eficiência/transição</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>energia/água/resíduos</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>benchmarks e projetos de eficiência</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>readiness</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>Espelho de Oportunidade</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>inteligência territorial</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>IRG / IOC</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>GIS</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>visualização territorial</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>trilha de evidência</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>auditabilidade</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>PMO</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>execução das intervenções coletivas</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>MRV</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>mensuração</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>APIs</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>integração</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>taxonomias</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>comparabilidade</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>motor de recomendação</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>Rota</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", padding: "13px 0", borderTop: "1px solid oklch(0.24 0.01 110)" }}><span>data quality/proveniência</span><span style={{ color: "oklch(0.8 0.05 150)", textAlign: "right" }}>confiança do benchmark</span></div>
              <p style={{ margin: "22px 0 0", gridColumn: "1 / -1", fontSize: "16px", lineHeight: "1.6", color: "oklch(0.86 0.006 100)" }}>A USECO₂ não abandona carbono. Ela deixa de exigir que carbono seja a porta de entrada.</p>
            </div>
          </details>
        </section>

        <section id="territorio" data-pp="chapter" data-pp-label="Território" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)", background: "oklch(0.135 0.008 110)" }}>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>10 — Cobertura territorial</span>
          <h2 data-r="up" style={{ margin: "20px 0 46px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(34px, 5.2vw, 74px)", lineHeight: "1.02", letterSpacing: "-0.03em", maxWidth: "900px", textWrap: "balance" }}>Universalidade sem desperdício</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1px", background: "oklch(0.26 0.01 110)", marginBottom: "40px" }}>
            <div data-r="up" style={{ background: "oklch(0.135 0.008 110)", padding: "32px 28px" }}>
              <div data-count="410511" style={{ fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(38px, 5vw, 66px)", lineHeight: "1", letterSpacing: "-0.02em", color: "oklch(0.78 0.13 150)" }}>410.511</div>
              <div style={{ marginTop: "12px", fontSize: "15px", lineHeight: "1.5", color: "oklch(0.74 0.008 100)" }}>pequenos negócios registrados no estado</div>
            </div>
            <div data-r="up" style={{ background: "oklch(0.135 0.008 110)", padding: "32px 28px" }}>
              <div data-count="240000" style={{ fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(38px, 5vw, 66px)", lineHeight: "1", letterSpacing: "-0.02em", color: "oklch(0.78 0.13 150)" }}>~240 mil</div>
              <div style={{ marginTop: "12px", fontSize: "15px", lineHeight: "1.5", color: "oklch(0.74 0.008 100)" }}>são MEIs (levantamento Sebrae/PB, jul. 2026)</div>
            </div>
            <div data-r="up" style={{ background: "oklch(0.135 0.008 110)", padding: "32px 28px" }}>
              <div style={{ fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(38px, 5vw, 66px)", lineHeight: "1", letterSpacing: "-0.02em", color: "oklch(0.78 0.13 150)" }}>95,7%</div>
              <div style={{ marginTop: "12px", fontSize: "15px", lineHeight: "1.5", color: "oklch(0.74 0.008 100)" }}>das empresas ativas da Paraíba</div>
            </div>
            <div data-r="up" style={{ background: "oklch(0.135 0.008 110)", padding: "32px 28px" }}>
              <div data-count="223" style={{ fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(38px, 5vw, 66px)", lineHeight: "1", letterSpacing: "-0.02em", color: "oklch(0.78 0.13 150)" }}>223</div>
              <div style={{ marginTop: "12px", fontSize: "15px", lineHeight: "1.5", color: "oklch(0.74 0.008 100)" }}>municípios com acesso ao nível Espelho</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            <div data-r="up" style={{ padding: "clamp(26px, 3vw, 42px)", borderRadius: "18px", border: "1px solid oklch(0.28 0.01 110)", display: "flex", flexDirection: "column", gap: "14px" }}>
              <h3 style={{ margin: "0", fontSize: "23px", fontWeight: "500" }}>Cobertura universal</h3>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.6", color: "oklch(0.76 0.008 100)" }}>Os 223 municípios podem acessar o nível Espelho.</p>
            </div>
            <div data-r="up" style={{ padding: "clamp(26px, 3vw, 42px)", borderRadius: "18px", border: "1px solid oklch(0.28 0.01 110)", display: "flex", flexDirection: "column", gap: "14px" }}>
              <h3 style={{ margin: "0", fontSize: "23px", fontWeight: "500" }}>Profundidade seletiva</h3>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.6", color: "oklch(0.76 0.008 100)" }}>Raio-X, Rota e Projeto seguem evidência.</p>
            </div>
          </div>
          <p data-r="up" style={{ margin: "34px 0 0", fontFamily: "var(--pp-mono), monospace", fontSize: "clamp(13px, 1.5vw, 17px)", color: "oklch(0.84 0.12 150)" }}>universalidade ≠ atendimento intensivo universal</p>

          <div data-r="up" style={{ marginTop: "46px", padding: "clamp(26px, 3vw, 42px)", borderRadius: "18px", background: "oklch(0.17 0.008 110)", display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.18em", color: "oklch(0.66 0.008 100)", marginBottom: "12px" }}>REGRA DE DUPLA SELEÇÃO</div>
                <div style={{ fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(22px, 2.4vw, 32px)" }}>Prioridade = α(impacto) + β(equidade)</div>
              </div>
              <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "13px", color: "oklch(0.78 0.13 150)" }}>α {alpha} · β {beta}</div>
            </div>
            <input type="range" min="0" max="100" step="5" value={alphaRaw} onChange={onAlpha} style={{ width: "100%", height: "4px", cursor: "grab" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "22px", fontSize: "15px", color: "oklch(0.76 0.008 100)" }}>
              <div><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.14em", color: "oklch(0.66 0.008 100)", display: "block", marginBottom: "8px" }}>CRITÉRIO 1 — IMPACTO ECONÔMICO</span>recorrência · população empresarial · oportunidade · custo-benefício</div>
              <div><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.14em", color: "oklch(0.66 0.008 100)", display: "block", marginBottom: "8px" }}>CRITÉRIO 2 — EQUIDADE TERRITORIAL</span>baixa densidade · vulnerabilidade · ausência recorrente de atendimento · importância territorial · diversificação</div>
            </div>
            <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "oklch(0.7 0.008 100)", fontStyle: "italic" }}>Os pesos α e β não devem ser inventados nesta versão. Devem ser pactuados pelo programa. Essa transparência é crucial.</p>
          </div>
        </section>

        <section data-pp="chapter" data-pp-label="Quatro rotas" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)" }}>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>11 — Demonstração</span>
          <h2 data-r="up" style={{ margin: "20px 0 18px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(34px, 5.2vw, 74px)", lineHeight: "1.02", letterSpacing: "-0.03em" }}>Quatro rotas demonstrativas</h2>
          <p data-r="up" style={{ margin: "0 0 50px", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.72 0.008 100)", maxWidth: "540px" }}>Não são departamentos rígidos. São os primeiros casos de demonstração — e testam quase todas as capacidades relevantes.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
            <div data-r="up" style={{ padding: "32px 28px", borderRadius: "18px", background: "oklch(0.135 0.008 110)", display: "flex", flexDirection: "column", gap: "14px", transition: "transform .4s cubic-bezier(.2,.8,.2,1), background .4s" }} className="pp-hv-9">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.16em", color: "oklch(0.78 0.13 150)" }}>ROTA I</span>
              <h3 style={{ margin: "0", fontSize: "22px", fontWeight: "500" }}>Negócios Urbanos</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.65", color: "oklch(0.74 0.008 100)" }}>comércio · serviços · energia · cartão · vendas · digitalização · margem</p>
            </div>
            <div data-r="up" style={{ padding: "32px 28px", borderRadius: "18px", background: "oklch(0.135 0.008 110)", display: "flex", flexDirection: "column", gap: "14px", transition: "transform .4s cubic-bezier(.2,.8,.2,1), background .4s" }} className="pp-hv-9">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.16em", color: "oklch(0.78 0.13 150)" }}>ROTA II</span>
              <h3 style={{ margin: "0", fontSize: "22px", fontWeight: "500" }}>Semiárido Produtivo</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.65", color: "oklch(0.74 0.008 100)" }}>agroindústria · água · energia · processamento · mercado · logística · compras públicas</p>
            </div>
            <div data-r="up" style={{ padding: "32px 28px", borderRadius: "18px", background: "oklch(0.135 0.008 110)", display: "flex", flexDirection: "column", gap: "14px", transition: "transform .4s cubic-bezier(.2,.8,.2,1), background .4s" }} className="pp-hv-9">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.16em", color: "oklch(0.78 0.13 150)" }}>ROTA III</span>
              <h3 style={{ margin: "0", fontSize: "22px", fontWeight: "500" }}>Destinos Produtivos</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.65", color: "oklch(0.74 0.008 100)" }}>turismo · gastronomia · economia criativa · fornecedores · presença digital · eficiência</p>
            </div>
            <div data-r="up" style={{ padding: "32px 28px", borderRadius: "18px", background: "oklch(0.135 0.008 110)", display: "flex", flexDirection: "column", gap: "14px", transition: "transform .4s cubic-bezier(.2,.8,.2,1), background .4s" }} className="pp-hv-9">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.16em", color: "oklch(0.78 0.13 150)" }}>ROTA IV</span>
              <h3 style={{ margin: "0", fontSize: "22px", fontWeight: "500" }}>Fornecedor Local</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.65", color: "oklch(0.74 0.008 100)" }}>infraestrutura · compras · grandes empresas · setor público · requisitos · qualificação · capacidade produtiva</p>
            </div>
          </div>
        </section>

        <section id="nash" data-pp="chapter" data-pp-label="Equilíbrio" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)", background: "oklch(0.135 0.008 110)" }}>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>12 — Arquitetura incentive-compatible</span>
          <h2 data-r="up" style={{ margin: "20px 0 18px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(34px, 5.2vw, 74px)", lineHeight: "1.02", letterSpacing: "-0.03em", maxWidth: "880px", textWrap: "balance" }}>Cada parte recebe o que mais valoriza ao aceitar a restrição necessária</h2>
          <p data-r="up" style={{ margin: "0 0 50px", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.72 0.008 100)", maxWidth: "600px", textWrap: "pretty" }}>Não é possível provar matematicamente um equilíbrio de Nash sem estimar funções de utilidade e payoffs reais. Mas a arquitetura é incentive-compatible.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "oklch(0.26 0.01 110)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1.2fr 1.3fr", gap: "20px", padding: "16px 4px", background: "oklch(0.135 0.008 110)", fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.14em", color: "oklch(0.62 0.008 100)" }}>
              <span>PREMISSA</span><span>RECEBE</span><span>CEDE</span><span>RAZÃO PARA PERMANECER</span>
            </div>
            <div data-r="row" style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1.2fr 1.3fr", gap: "20px", padding: "22px 4px", background: "oklch(0.135 0.008 110)", fontSize: "15.5px", lineHeight: "1.5", transition: "background .35s" }} className="pp-hv-10">
              <span style={{ fontWeight: "500" }}>Sebrae/PB</span><span style={{ color: "oklch(0.8 0.008 100)" }}>inteligência, escala, ROI, território</span><span style={{ color: "oklch(0.72 0.008 100)" }}>não internaliza toda a tecnologia</span><span style={{ color: "oklch(0.8 0.05 150)" }}>menor custo/risco</span>
            </div>
            <div data-r="row" style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1.2fr 1.3fr", gap: "20px", padding: "22px 4px", background: "oklch(0.135 0.008 110)", fontSize: "15.5px", lineHeight: "1.5", transition: "background .35s" }} className="pp-hv-10">
              <span style={{ fontWeight: "500" }}>MPE</span><span style={{ color: "oklch(0.8 0.008 100)" }}>benchmark e oportunidade</span><span style={{ color: "oklch(0.72 0.008 100)" }}>poucos dados</span><span style={{ color: "oklch(0.8 0.05 150)" }}>ganho individual imediato</span>
            </div>
            <div data-r="row" style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1.2fr 1.3fr", gap: "20px", padding: "22px 4px", background: "oklch(0.135 0.008 110)", fontSize: "15.5px", lineHeight: "1.5", transition: "background .35s" }} className="pp-hv-10">
              <span style={{ fontWeight: "500" }}>USECO₂</span><span style={{ color: "oklch(0.8 0.008 100)" }}>contrato, validação, PI replicável, escala</span><span style={{ color: "oklch(0.72 0.008 100)" }}>dados identificáveis</span><span style={{ color: "oklch(0.8 0.05 150)" }}>maior adoção e replicabilidade</span>
            </div>
            <div data-r="row" style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1.2fr 1.3fr", gap: "20px", padding: "22px 4px", background: "oklch(0.135 0.008 110)", fontSize: "15.5px", lineHeight: "1.5", transition: "background .35s" }} className="pp-hv-10">
              <span style={{ fontWeight: "500" }}>Território</span><span style={{ color: "oklch(0.8 0.008 100)" }}>universalidade, emprego, projetos</span><span style={{ color: "oklch(0.72 0.008 100)" }}>não controla ranking</span><span style={{ color: "oklch(0.8 0.05 150)" }}>legitimidade + resultado</span>
            </div>
            <div data-r="row" style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1.2fr 1.3fr", gap: "20px", padding: "22px 4px", background: "oklch(0.135 0.008 110)", fontSize: "15.5px", lineHeight: "1.5", transition: "background .35s" }} className="pp-hv-10">
              <span style={{ fontWeight: "500" }}>Governança</span><span style={{ color: "oklch(0.8 0.008 100)" }}>auditabilidade e reversibilidade</span><span style={{ color: "oklch(0.72 0.008 100)" }}>—</span><span style={{ color: "oklch(0.8 0.05 150)" }}>condição de existência</span>
            </div>
          </div>
          <p data-r="up" style={{ margin: "40px 0 0", fontFamily: "var(--pp-mono), monospace", fontSize: "clamp(13px, 1.5vw, 18px)", color: "oklch(0.84 0.12 150)" }}>Eficiência + Universalidade + Evidência + Autonomia</p>
        </section>

        <section id="governanca" data-pp="chapter" data-pp-label="Governança" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)" }}>
          <div data-r="rule" style={{ height: "1px", background: "oklch(0.62 0.14 150)", transform: "scaleX(0)", transformOrigin: "left", marginBottom: "56px" }}></div>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>13 — Decisão arquitetural</span>
          <h2 data-r="up" style={{ margin: "20px 0 46px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(36px, 5.6vw, 82px)", lineHeight: "1", letterSpacing: "-0.03em" }}>Tecnologia federável;<br /><em style={{ color: "oklch(0.78 0.13 150)" }}>dados soberanos</em></h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px" }}>
            <div data-r="up" style={{ padding: "30px", borderRadius: "16px", border: "1px solid oklch(0.28 0.01 110)", display: "flex", flexDirection: "column", gap: "12px", transition: "border-color .4s" }} className="pp-hv-11">
              <h3 style={{ margin: "0", fontSize: "21px", fontWeight: "500" }}>Sebrae</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "oklch(0.74 0.008 100)" }}>controla seus dados institucionais conforme enquadramento jurídico validado</p>
            </div>
            <div data-r="up" style={{ padding: "30px", borderRadius: "16px", border: "1px solid oklch(0.28 0.01 110)", display: "flex", flexDirection: "column", gap: "12px", transition: "border-color .4s" }} className="pp-hv-11">
              <h3 style={{ margin: "0", fontSize: "21px", fontWeight: "500" }}>MPE</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "oklch(0.74 0.008 100)" }}>mantém direitos aplicáveis aos seus dados</p>
            </div>
            <div data-r="up" style={{ padding: "30px", borderRadius: "16px", border: "1px solid oklch(0.28 0.01 110)", display: "flex", flexDirection: "column", gap: "12px", transition: "border-color .4s" }} className="pp-hv-11">
              <h3 style={{ margin: "0", fontSize: "21px", fontWeight: "500" }}>USECO₂</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "oklch(0.74 0.008 100)" }}>software · arquitetura · motores · taxonomias genéricas · componentes preexistentes · know-how</p>
            </div>
            <div data-r="up" style={{ padding: "30px", borderRadius: "16px", border: "1px solid oklch(0.55 0.1 150)", background: "oklch(0.62 0.14 150 / 0.08)", display: "flex", flexDirection: "column", gap: "12px" }}>
              <h3 style={{ margin: "0", fontSize: "21px", fontWeight: "500" }}>Portabilidade obrigatória</h3>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.6", color: "oklch(0.8 0.02 130)" }}>o Sebrae sai com dados, histórico, decisões, evidências e exportações documentadas</p>
            </div>
          </div>

          <details data-r="up" style={{ marginTop: "24px", borderRadius: "16px", background: "oklch(0.135 0.008 110)", overflow: "hidden" }}>
            <summary style={{ padding: "24px clamp(22px, 3vw, 36px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", fontSize: "17px", fontWeight: "500" }}>
              <span>Privacidade como parte do produto</span>
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>abrir</span>
            </summary>
            <div style={{ padding: "0 clamp(22px, 3vw, 36px) 32px", display: "flex", flexDirection: "column", gap: "18px", maxWidth: "760px" }}>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.78 0.008 100)" }}>Uma célula benchmark só aparece se possuir tamanho mínimo, qualidade suficiente e impossibilidade razoável de inferência individual. Dados identificáveis não transitam entre estados nem viram ativo comercial. Benchmarks interestaduais somente com agregação, anonimização, regras de grupo mínimo, autorização e governança contratual.</p>
              <p style={{ margin: "0", padding: "20px 24px", borderRadius: "12px", borderLeft: "2px solid oklch(0.62 0.14 150)", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "21px", lineHeight: "1.35", color: "oklch(0.9 0.006 100)" }}>“Não há amostra suficiente para comparação neste município; estamos exibindo referência regional.” — isto vale mais que uma precisão falsa.</p>
            </div>
          </details>
        </section>

        <section id="piloto" data-pp="chapter" data-pp-label="Piloto" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)", background: "oklch(0.135 0.008 110)" }}>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>14 — Contrato de aprendizagem</span>
          <h2 data-r="up" style={{ margin: "20px 0 50px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(34px, 5.2vw, 74px)", lineHeight: "1.02", letterSpacing: "-0.03em" }}>Seis hipóteses e seis gates</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1px", background: "oklch(0.26 0.01 110)" }}>
            <div data-r="up" style={{ background: "oklch(0.135 0.008 110)", padding: "28px", display: "flex", flexDirection: "column", gap: "12px", transition: "background .35s" }} className="pp-hv-10">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>H1 · ADESÃO</span>
              <p style={{ margin: "0", fontSize: "16.5px", lineHeight: "1.5" }}>O Espelho cria valor suficiente para a empresa participar?</p>
              <p style={{ margin: "0", fontSize: "14px", color: "oklch(0.66 0.008 100)" }}>falha → redesenhar contrapartida/canal</p>
            </div>
            <div data-r="up" style={{ background: "oklch(0.135 0.008 110)", padding: "28px", display: "flex", flexDirection: "column", gap: "12px", transition: "background .35s" }} className="pp-hv-10">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>H2 · VALIDADE</span>
              <p style={{ margin: "0", fontSize: "16.5px", lineHeight: "1.5" }}>A classificação é consistente com avaliação humana mais profunda?</p>
              <p style={{ margin: "0", fontSize: "14px", color: "oklch(0.66 0.008 100)" }}>falha → redesenhar taxonomia/perguntas</p>
            </div>
            <div data-r="up" style={{ background: "oklch(0.135 0.008 110)", padding: "28px", display: "flex", flexDirection: "column", gap: "12px", transition: "background .35s" }} className="pp-hv-10">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>H3 · ECONOMIA</span>
              <p style={{ margin: "0", fontSize: "16.5px", lineHeight: "1.5" }}>O modelo reduz horas e custo institucional?</p>
              <p style={{ margin: "0", fontSize: "14px", color: "oklch(0.66 0.008 100)" }}>falha → tese de escala rejeitada</p>
            </div>
            <div data-r="up" style={{ background: "oklch(0.135 0.008 110)", padding: "28px", display: "flex", flexDirection: "column", gap: "12px", transition: "background .35s" }} className="pp-hv-10">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>H4 · AÇÃO</span>
              <p style={{ margin: "0", fontSize: "16.5px", lineHeight: "1.5" }}>O Espelho/Raio-X gera mudança verificável?</p>
              <p style={{ margin: "0", fontSize: "14px", color: "oklch(0.66 0.008 100)" }}>falha → programa virou formulário</p>
            </div>
            <div data-r="up" style={{ background: "oklch(0.135 0.008 110)", padding: "28px", display: "flex", flexDirection: "column", gap: "12px", transition: "background .35s" }} className="pp-hv-10">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>H5 · UTILIDADE DECISÓRIA</span>
              <p style={{ margin: "0", fontSize: "16.5px", lineHeight: "1.5" }}>Os dados agregados mudam uma decisão real do Sebrae?</p>
              <p style={{ margin: "0", fontSize: "14px", color: "oklch(0.66 0.008 100)" }}>falha → não existe business case institucional</p>
            </div>
            <div data-r="up" style={{ background: "oklch(0.135 0.008 110)", padding: "28px", display: "flex", flexDirection: "column", gap: "12px", transition: "background .35s" }} className="pp-hv-10">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.84 0.12 150)" }}>H6 · EFEITO DE REDE</span>
              <p style={{ margin: "0", fontSize: "16.5px", lineHeight: "1.5" }}>A utilidade percebida e a qualidade dos benchmarks aumentam conforme cresce a densidade das células comparáveis?</p>
              <p style={{ margin: "0", fontSize: "14px", color: "oklch(0.66 0.008 100)" }}>falha → benchmark não produz moat</p>
            </div>
          </div>

          <details data-r="up" style={{ marginTop: "24px", borderRadius: "16px", background: "oklch(0.17 0.008 110)", overflow: "hidden" }}>
            <summary style={{ padding: "24px clamp(22px, 3vw, 36px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", fontSize: "17px", fontWeight: "500" }}>
              <span>Emprego e renda: medimos, não inferimos</span>
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>abrir</span>
            </summary>
            <div style={{ padding: "0 clamp(22px, 3vw, 36px) 32px", display: "flex", flexDirection: "column", gap: "18px", maxWidth: "800px" }}>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.78 0.008 100)" }}>Não usaremos multiplicadores cosméticos. Em T0 e T1/T2 medimos as mesmas variáveis: empregados, faturamento/faixa, custos, investimento, produção/capacidade. Assim é possível relatar empregos mantidos e criados, investimento, redução de custo, novo mercado e receita — sem fabricar causalidade.</p>
              <p style={{ margin: "0", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.72 0.008 100)" }}>Dados divulgados pelo Sebrae/PB apontaram que as MPEs responderam por mais de seis em cada dez vagas geradas na Paraíba em abril de 2026.</p>
              <p style={{ margin: "0", fontFamily: "var(--pp-mono), monospace", fontSize: "13px", color: "oklch(0.84 0.12 150)" }}>TTFV = t(primeiro benefício) − t(Espelho concluído) → mesma sessão</p>
            </div>
          </details>
        </section>

        <section data-pp="chapter" data-pp-label="Entregáveis" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)" }}>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>15 — O que o Sebrae recebe</span>
          <h2 data-r="up" style={{ margin: "20px 0 18px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(34px, 5.2vw, 74px)", lineHeight: "1.02", letterSpacing: "-0.03em" }}>Cinco capacidades decisórias</h2>
          <p data-r="up" style={{ margin: "0 0 50px", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.72 0.008 100)", maxWidth: "480px" }}>O Sebrae não recebe apenas dashboard.</p>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div data-r="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 32px", padding: "30px 0", borderTop: "1px solid oklch(0.26 0.01 110)", transition: "padding-left .35s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-12">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", minWidth: "34px" }}>01</span>
              <h3 style={{ margin: "0", fontSize: "clamp(24px, 3vw, 40px)", fontWeight: "400", fontFamily: "var(--pp-serif), Georgia, serif", letterSpacing: "-0.02em", flex: "1 1 260px" }}>Radar de recorrência</h3>
              <p style={{ margin: "0", fontSize: "16px", color: "oklch(0.74 0.008 100)", flex: "1 1 240px" }}>onde um problema está se acumulando</p>
            </div>
            <div data-r="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 32px", padding: "30px 0", borderTop: "1px solid oklch(0.26 0.01 110)", transition: "padding-left .35s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-12">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", minWidth: "34px" }}>02</span>
              <h3 style={{ margin: "0", fontSize: "clamp(24px, 3vw, 40px)", fontWeight: "400", fontFamily: "var(--pp-serif), Georgia, serif", letterSpacing: "-0.02em", flex: "1 1 260px" }}>Mapa de oportunidades</h3>
              <p style={{ margin: "0", fontSize: "16px", color: "oklch(0.74 0.008 100)", flex: "1 1 240px" }}>onde existem gaps coletivos</p>
            </div>
            <div data-r="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 32px", padding: "30px 0", borderTop: "1px solid oklch(0.26 0.01 110)", transition: "padding-left .35s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-12">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", minWidth: "34px" }}>03</span>
              <h3 style={{ margin: "0", fontSize: "clamp(24px, 3vw, 40px)", fontWeight: "400", fontFamily: "var(--pp-serif), Georgia, serif", letterSpacing: "-0.02em", flex: "1 1 260px" }}>Roteador institucional</h3>
              <p style={{ margin: "0", fontSize: "16px", color: "oklch(0.74 0.008 100)", flex: "1 1 240px" }}>qual solução existente deveria absorver cada perfil</p>
            </div>
            <div data-r="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 32px", padding: "30px 0", borderTop: "1px solid oklch(0.26 0.01 110)", transition: "padding-left .35s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-12">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", minWidth: "34px" }}>04</span>
              <h3 style={{ margin: "0", fontSize: "clamp(24px, 3vw, 40px)", fontWeight: "400", fontFamily: "var(--pp-serif), Georgia, serif", letterSpacing: "-0.02em", flex: "1 1 260px" }}>Carteira de intervenções</h3>
              <p style={{ margin: "0", fontSize: "16px", color: "oklch(0.74 0.008 100)", flex: "1 1 240px" }}>quais problemas justificam ação coletiva</p>
            </div>
            <div data-r="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 32px", padding: "30px 0", borderTop: "1px solid oklch(0.26 0.01 110)", borderBottom: "1px solid oklch(0.26 0.01 110)", transition: "padding-left .35s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-12">
              <span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", minWidth: "34px" }}>05</span>
              <h3 style={{ margin: "0", fontSize: "clamp(24px, 3vw, 40px)", fontWeight: "400", fontFamily: "var(--pp-serif), Georgia, serif", letterSpacing: "-0.02em", flex: "1 1 260px" }}>Evidência longitudinal</h3>
              <p style={{ margin: "0", fontSize: "16px", color: "oklch(0.74 0.008 100)", flex: "1 1 240px" }}>o que efetivamente mudou</p>
            </div>
          </div>
          <p data-r="up" style={{ margin: "44px 0 0", fontSize: "17px", lineHeight: "1.6", color: "oklch(0.8 0.008 100)", maxWidth: "640px", textWrap: "pretty" }}>A relação com o ALI fica delimitada: <strong style={{ fontWeight: "500" }}>o ALI transforma a empresa; o Agroeconomia Biomas aprende entre empresas</strong> e ajuda o Sebrae a decidir quando uma resposta individual deve virar resposta coletiva. Não compete. Orquestra.</p>
        </section>

        <section data-pp="chapter" data-pp-label="Contratação" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)", background: "oklch(0.135 0.008 110)" }}>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>16 — Arquitetura de contratação</span>
          <h2 data-r="up" style={{ margin: "20px 0 18px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(34px, 5.2vw, 74px)", lineHeight: "1.02", letterSpacing: "-0.03em", maxWidth: "900px", textWrap: "balance" }}>Começa pelo problema, não pelo fornecedor</h2>
          <p data-r="up" style={{ margin: "0 0 50px", fontSize: "16px", lineHeight: "1.65", color: "oklch(0.72 0.008 100)", maxWidth: "640px", textWrap: "pretty" }}>A Resolução CDN 493/2024 prevê Desafio de Inovação, Diálogo Competitivo e Encomenda Tecnológica, além de julgamento por melhor solução inovadora — e, na fase preparatória, Pedido de Informações, Reunião Participativa e Consulta Pública. A ausência do Sebraetec não encerra a conversa.</p>
          <div data-draw="steps" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div data-step="" style={{ display: "flex", alignItems: "center", gap: "20px", padding: "22px 26px", background: "oklch(0.17 0.008 110)", borderRadius: "12px", transition: "transform .4s cubic-bezier(.2,.8,.2,1), background .4s" }} className="pp-hv-13"><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>01</span><span style={{ fontSize: "17px" }}>problema institucional</span></div>
            <div data-step="" style={{ display: "flex", alignItems: "center", gap: "20px", padding: "22px 26px", background: "oklch(0.17 0.008 110)", borderRadius: "12px", transition: "transform .4s cubic-bezier(.2,.8,.2,1), background .4s" }} className="pp-hv-13"><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>02</span><span style={{ fontSize: "17px" }}>interação formal com mercado — RFI / reunião participativa</span></div>
            <div data-step="" style={{ display: "flex", alignItems: "center", gap: "20px", padding: "22px 26px", background: "oklch(0.17 0.008 110)", borderRadius: "12px", transition: "transform .4s cubic-bezier(.2,.8,.2,1), background .4s" }} className="pp-hv-13"><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>03</span><span style={{ fontSize: "17px" }}>Sebrae confirma lacuna</span></div>
            <div data-step="" style={{ display: "flex", alignItems: "center", gap: "20px", padding: "22px 26px", background: "oklch(0.17 0.008 110)", borderRadius: "12px", transition: "transform .4s cubic-bezier(.2,.8,.2,1), background .4s" }} className="pp-hv-13"><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>04</span><span style={{ fontSize: "17px" }}>jurídico/compras classifica objeto</span></div>
            <div data-step="" style={{ display: "flex", alignItems: "center", gap: "20px", padding: "22px 26px", background: "oklch(0.17 0.008 110)", borderRadius: "12px", transition: "transform .4s cubic-bezier(.2,.8,.2,1), background .4s" }} className="pp-hv-13"><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)" }}>05</span><span style={{ fontSize: "17px" }}>modalidade adequada</span></div>
            <div data-step="" style={{ display: "flex", alignItems: "center", gap: "20px", padding: "22px 26px", background: "oklch(0.62 0.14 150 / 0.1)", border: "1px solid oklch(0.55 0.1 150)", borderRadius: "12px", transition: "transform .4s cubic-bezier(.2,.8,.2,1)" }} className="pp-hv-14"><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.84 0.12 150)" }}>06</span><span style={{ fontSize: "17px" }}>piloto competitivo ou contratação cabível</span></div>
          </div>
          <p data-r="up" style={{ margin: "40px 0 0", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(21px, 2.3vw, 30px)", lineHeight: "1.3", maxWidth: "780px", textWrap: "pretty" }}>Não pedimos “contratação direta da USECO₂”. Apresentamos <em style={{ color: "oklch(0.78 0.13 150)" }}>um problema suficientemente bom para o Sebrae querer resolvê-lo de forma institucionalmente correta.</em></p>
        </section>

        <section id="decisoes" data-pp="chapter" data-pp-label="Decisões v1.0" style={{ position: "relative", padding: "clamp(110px, 15vh, 190px) clamp(28px, 8vw, 170px)" }}>
          <div data-r="rule" style={{ height: "1px", background: "oklch(0.62 0.14 150)", transform: "scaleX(0)", transformOrigin: "left", marginBottom: "56px" }}></div>
          <span data-r="fade" style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>17 — O que está fechado</span>
          <h2 data-r="up" style={{ margin: "20px 0 50px", fontFamily: "var(--pp-serif), Georgia, serif", fontWeight: "400", fontSize: "clamp(34px, 5.2vw, 74px)", lineHeight: "1.02", letterSpacing: "-0.03em" }}>Decisões de arquitetura v1.0</h2>
          <ol data-draw="decisions" style={{ margin: "0", padding: "0", listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1px 30px", counterReset: "d" }}>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>01</span>É programa; não plataforma.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>02</span>Pequeno negócio é beneficiário primário.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>03</span>Sebrae é comprador institucional da inteligência, não comprador de “ESG”.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>04</span>Espelho é a porta universal.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>05</span>Comparação precede recomendação.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>06</span>223 significa acesso universal, não consultoria universal.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>07</span>Profundidade é seletiva.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>08</span>Seleção equilibra impacto e equidade territorial.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>09</span>ALI e outros instrumentos são destinos, não concorrentes.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>10</span>IRG identifica recorrência.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>11</span>IOC decide quando estudar intervenção coletiva.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>12</span>USECO₂ mantém PI tecnológica.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>13</span>Dados permanecem soberanos ao ambiente institucional correspondente.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>14</span>Portabilidade obrigatória.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>15</span>Ranking não pode ser politicamente manipulado.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>16</span>Emprego/renda são medidos, não presumidos.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>17</span>Sustentabilidade entra por competitividade e eficiência.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>18</span>Contratação começa pelo problema, não pelo fornecedor.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>19</span>Piloto testa H1–H6.</li>
            <li data-step="" style={{ padding: "15px 0", borderTop: "1px solid oklch(0.26 0.01 110)", borderBottom: "1px solid oklch(0.26 0.01 110)", display: "flex", gap: "14px", fontSize: "16px", lineHeight: "1.5", color: "oklch(0.86 0.006 100)" }}><span style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "12px", color: "oklch(0.78 0.13 150)", paddingTop: "3px" }}>20</span>Nenhuma expansão é automática após o piloto.</li>
          </ol>
        </section>

        <section data-pp="chapter" data-pp-label="Uma frase" style={{ position: "relative", minHeight: "92vh", display: "flex", flexDirection: "column", justifyContent: "center", gap: "44px", padding: "clamp(110px, 14vh, 180px) clamp(28px, 8vw, 170px)", background: "oklch(0.135 0.008 110)", overflow: "hidden" }}>
          <div data-r="fade" data-par="0.06" style={{ position: "absolute", inset: "0", background: "radial-gradient(70% 60% at 20% 100%, oklch(0.62 0.14 150 / 0.12), transparent 70%)", pointerEvents: "none" }}></div>
          <span data-r="fade" style={{ position: "relative", fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", color: "oklch(0.66 0.008 100)" }}>18 — A proposta de valor em uma frase</span>
          <p data-r="up" style={{ position: "relative", margin: "0", fontFamily: "var(--pp-serif), Georgia, serif", fontSize: "clamp(28px, 4.2vw, 62px)", lineHeight: "1.14", letterSpacing: "-0.025em", maxWidth: "1180px", textWrap: "pretty" }}> O Agroeconomia Biomas transforma cada interação com um pequeno negócio em duas coisas ao mesmo tempo: uma informação <em style={{ color: "oklch(0.78 0.13 150)" }}>imediatamente útil para o empresário</em> e uma peça de inteligência que ajuda o Sebrae a descobrir quando um problema individual se tornou um problema territorial — e, então, decidir se vale mais atendê-lo empresa por empresa ou resolvê-lo coletivamente. </p>
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginTop: "10px" }}>
            <div data-r="up" style={{ padding: "26px 28px", borderRadius: "16px", border: "1px solid oklch(0.28 0.01 110)" }}>
              <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.16em", color: "oklch(0.66 0.008 100)", marginBottom: "12px" }}>PARA O EMPRESÁRIO</div>
              <p style={{ margin: "0", fontSize: "18px", lineHeight: "1.45" }}>“Me dê alguns números do seu negócio e eu devolvo uma régua que você normalmente não consegue enxergar sozinho.”</p>
            </div>
            <div data-r="up" style={{ padding: "26px 28px", borderRadius: "16px", border: "1px solid oklch(0.28 0.01 110)" }}>
              <div style={{ fontFamily: "var(--pp-mono), monospace", fontSize: "11px", letterSpacing: "0.16em", color: "oklch(0.66 0.008 100)", marginBottom: "12px" }}>PARA UMA LIDERANÇA TERRITORIAL</div>
              <p style={{ margin: "0", fontSize: "18px", lineHeight: "1.45" }}>“Passamos a enxergar em quais negócios os problemas acontecem, onde se concentram, quanto limitam o crescimento e quando existe massa crítica para uma solução coletiva.”</p>
            </div>
          </div>
        </section>

        <footer style={{ padding: "60px clamp(28px, 8vw, 170px) 70px", display: "flex", flexWrap: "wrap", gap: "24px", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid oklch(0.24 0.01 110)", fontFamily: "var(--pp-mono), monospace", fontSize: "12px", letterSpacing: "0.1em", color: "oklch(0.6 0.008 100)" }}>
          <span>PROGRAMA AGROECONOMIA BIOMAS · USECO₂ · v1.0</span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: "22px" }}>
            <a href="#tese">Tese</a>
            <a href="#decisoes">Decisões v1.0</a>
          </span>
        </footer>
      </main>
    </div>
  );
}
