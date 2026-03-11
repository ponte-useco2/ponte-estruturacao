import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function Footer() {
    return (
        <footer className="bg-slate-900 py-16 text-slate-400">
            <div className="container mx-auto px-6 max-w-6xl">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="md:col-span-2">
                        <span className="font-heading font-bold text-2xl tracking-tight text-white block mb-4">
                            Ponte.
                        </span>
                        <p className="max-w-xs text-sm leading-relaxed text-slate-400">
                            Transformamos projetos complexos em propostas financiáveis, aprováveis e executáveis.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-heading font-semibold text-white mb-6">Navegação</h4>
                        <ul className="space-y-4 text-sm">
                            <li><Link href="#servicos" className="hover:text-white transition-colors">Serviços</Link></li>
                            <li><Link href="#metodo" className="hover:text-white transition-colors">Como trabalhamos</Link></li>
                            <li><Link href="#experiencia" className="hover:text-white transition-colors">Experiência e setores</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-heading font-semibold text-white mb-6">Contato</h4>
                        <ul className="space-y-4 text-sm">
                            <li>
                                <Link href="#diagnostico" className="hover:text-white transition-colors flex items-center gap-1 group">
                                    Solicitar Diagnóstico
                                    <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
                                </Link>
                            </li>
                            <li>
                                <a href="mailto:diretoria.ponte.projetos@gmail.com" className="hover:text-white transition-colors">
                                    diretoria.ponte.projetos@gmail.com
                                </a>
                            </li>
                            <li>
                                <a href="https://wa.me/5583996428315?text=Ol%C3%A1%2C%20gostaria%20de%20solicitar%20um%20diagn%C3%B3stico%20inicial%20para%20o%20meu%20projeto." target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                                    WhatsApp
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-xs">
                    <p>© {new Date().getFullYear()} Ponte Estruturação de Projetos. Todos os direitos reservados.</p>
                    <div className="flex gap-4 mt-4 md:mt-0">
                        <Link href="#" className="hover:text-white transition-colors">Política de Privacidade</Link>
                        <Link href="#" className="hover:text-white transition-colors">Termos de Uso</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
