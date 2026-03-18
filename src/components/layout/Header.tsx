import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function Header() {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 transition-all">
            <div className="container mx-auto px-6 max-w-6xl h-20 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    {/* Logo Ponte */}
                    <span className="font-heading font-bold text-2xl tracking-tight text-slate-900">
                        Ponte.
                    </span>
                </Link>
                <nav className="hidden md:flex items-center gap-8">
                    <Link href="/#inicio" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Início</Link>
                    <Link href="/#servicos" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Serviços</Link>
                    <Link href="/#metodo" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Como trabalhamos</Link>
                    <Link href="/#experiencia" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Experiência e setores</Link>
                    <Link href="/finep-subvencao" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">FINEP Subvenção</Link>
                </nav>
                <div className="flex items-center gap-4">
                    <Link href="#diagnostico">
                        <Button size="sm">Diagnóstico</Button>
                    </Link>
                </div>
            </div>
        </header>
    );
}
