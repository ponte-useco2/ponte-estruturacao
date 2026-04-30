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
                <nav className="hidden lg:flex items-center gap-6">
                    <Link href="/#servicos" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Serviços</Link>
                    <Link href="/#metodo" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Método</Link>
                    <div className="flex items-center gap-4 pl-4 border-l border-slate-200">
                        <Link href="/consultoria-finep" className="text-sm font-bold text-emerald-600 hover:text-emerald-800 transition-colors">FINEP</Link>
                        <Link href="/finep-subvencao" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors">Subvenção</Link>
                        <Link href="/reurb" className="text-sm font-bold text-teal-600 hover:text-teal-800 transition-colors">REURB</Link>
                        <Link href="/centelha-3-pb" className="text-sm font-bold text-amber-600 hover:text-amber-800 transition-colors">Centelha 3 PB</Link>
                    </div>
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
