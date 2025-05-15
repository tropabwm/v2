// components/LoginRegisterForm.tsx
import React, { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const NEON_BLUE_PRIMARY = '#00CFDE';
const NEON_BLUE_SECONDARY = '#00A3FF'; 

const LoginRegisterForm: React.FC = () => {
    const [isLoginView, setIsLoginView] = useState(true); 
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false); 
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const { apiLogin, register, isLoading: authIsLoading } = useAuth(); 
    const router = useRouter();
    const { toast } = useToast();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (!isLoginView && password !== confirmPassword) {
            toast({ title: "Erro de Validação", description: "As senhas não coincidem.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        
        try {
            if (isLoginView) {
                const { user } = await apiLogin(email, password); 
                toast({ title: "Login Bem-Sucedido!", description: `Bem-vindo de volta, ${user.username}!` });
                router.push('/'); 
            } else {
                const response = await register(username, email, password); 
                toast({ title: "Registro Concluído!", description: response.message || "Conta criada com sucesso. Por favor, faça o login." });
                setIsLoginView(true); 
                setEmail(email); 
                setUsername(''); 
                setPassword('');
                setConfirmPassword('');
            }
        } catch (error: any) {
            const errorMessage = error.data?.message || error.message || (isLoginView ? "Falha no login." : "Falha no registro.");
            toast({ title: "Operação Falhou", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formCardStyle = cn(
        "w-full max-w-md p-8 md:p-10 space-y-6 rounded-2xl",
        "bg-black/50 backdrop-blur-xl", 
        "border border-blue-500/30",
        "shadow-[0_0_25px_rgba(0,207,222,0.2),0_0_40px_rgba(0,207,222,0.1)]"
    );

    const inputGroupStyle = "relative";

    const inputStyle = cn(
        "w-full h-12 px-4 text-sm rounded-lg ",
        "bg-black/30 border-blue-500/50 placeholder-gray-400 text-gray-100 ",
        "focus:ring-2 focus:ring-offset-0 focus:ring-offset-transparent focus:ring-NEON_BLUE_PRIMARY focus:border-NEON_BLUE_PRIMARY transition-all",
        "shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
    );

    const labelStyle = "block text-xs font-medium text-blue-300 mb-1.5 ml-1";

    const buttonBaseStyle = "w-full h-12 text-sm font-semibold rounded-lg transition-all duration-300 ease-in-out active:scale-[0.97] flex items-center justify-center";
    
    const primaryButtonStyle = cn(
        buttonBaseStyle,
        `bg-gradient-to-r from-[${NEON_BLUE_PRIMARY}] to-[${NEON_BLUE_SECONDARY}] hover:from-[${NEON_BLUE_SECONDARY}] hover:to-[${NEON_BLUE_PRIMARY}]`,
        "text-white shadow-md hover:shadow-lg",
        `hover:shadow-[0_0_15px_${NEON_BLUE_PRIMARY}90,0_0_25px_${NEON_BLUE_PRIMARY}70]`
    );

    return (
        <div className={formCardStyle}>
            <div className="flex justify-center mb-6">
                <Image
                    src="/logo.png" 
                    alt="USBMKT Logo"
                    width={100} 
                    height={100} 
                    priority
                    style={{ filter: `drop-shadow(0 0 8px ${NEON_BLUE_PRIMARY}A0)` }}
                />
            </div>

            <h2 
                className="text-center text-2xl md:text-3xl font-bold text-white"
                style={{ textShadow: `0 0 6px ${NEON_BLUE_PRIMARY}, 0 0 10px ${NEON_BLUE_PRIMARY}A0`}}
            >
                {isLoginView ? 'Bem-vindo de Volta!' : 'Crie sua Conta'}
            </h2>
            <p className="text-center text-sm text-gray-400 mb-8">
                {isLoginView ? 'Acesse sua conta para continuar.' : 'Preencha os campos para se registrar.'}
            </p>

            <div className="flex mb-6 rounded-lg p-1 bg-black/20 border border-blue-500/30 max-w-xs mx-auto">
                <button
                    type="button"
                    onClick={() => setIsLoginView(true)}
                    disabled={authIsLoading || isSubmitting}
                    className={cn(
                        "flex-1 py-2.5 px-4 text-xs font-medium rounded-md transition-all",
                        isLoginView ? `bg-[${NEON_BLUE_PRIMARY}] text-black shadow-[0_0_10px_${NEON_BLUE_PRIMARY}70]` : "text-gray-400 hover:text-white"
                    )}
                >
                    Login
                </button>
                <button
                    type="button"
                    onClick={() => setIsLoginView(false)}
                    disabled={authIsLoading || isSubmitting}
                    className={cn(
                        "flex-1 py-2.5 px-4 text-xs font-medium rounded-md transition-all",
                        !isLoginView ? `bg-[${NEON_BLUE_PRIMARY}] text-black shadow-[0_0_10px_${NEON_BLUE_PRIMARY}70]` : "text-gray-400 hover:text-white"
                    )}
                >
                    Registrar
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {!isLoginView && (
                    <div className={inputGroupStyle}>
                        <Label htmlFor="username" className={labelStyle}>Nome de Usuário</Label>
                        <Input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Seu nome de usuário"
                            required={!isLoginView}
                            className={inputStyle}
                            disabled={authIsLoading || isSubmitting}
                        />
                    </div>
                )}
                <div className={inputGroupStyle}>
                    <Label htmlFor="email" className={labelStyle}>Email</Label>
                    <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seuemail@example.com"
                        required
                        className={inputStyle}
                        disabled={authIsLoading || isSubmitting}
                    />
                </div>
                <div className={inputGroupStyle}>
                    <Label htmlFor="password" className={labelStyle}>Senha</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="********"
                            required
                            className={cn(inputStyle, "pr-10")}
                            disabled={authIsLoading || isSubmitting}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-blue-300 disabled:opacity-50"
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                            disabled={authIsLoading || isSubmitting}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                {!isLoginView && (
                    <div className={inputGroupStyle}>
                        <Label htmlFor="confirmPassword" className={labelStyle}>Confirmar Senha</Label>
                         <div className="relative">
                            <Input
                                id="confirmPassword"
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="********"
                                required={!isLoginView}
                                className={cn(inputStyle, "pr-10")}
                                disabled={authIsLoading || isSubmitting}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-blue-300 disabled:opacity-50"
                                aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                                disabled={authIsLoading || isSubmitting}
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                )}
                <Button type="submit" disabled={authIsLoading || isSubmitting} className={primaryButtonStyle}>
                    {(authIsLoading || isSubmitting) ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (isLoginView ? <LogIn className="mr-2 h-5 w-5" /> : <UserPlus className="mr-2 h-5 w-5" />)}
                    {(authIsLoading || isSubmitting) ? 'Processando...' : (isLoginView ? 'Entrar' : 'Criar Conta')}
                </Button>
            </form>

            {isLoginView && (
                <div className="text-center mt-6">
                    <button 
                        onClick={() => toast({title: "Em Breve!", description: "Funcionalidade de recuperação de senha ainda não implementada.", duration: 3000})}
                        className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                    >
                        Esqueceu sua senha?
                    </button>
                </div>
            )}
        </div>
    );
};

export default LoginRegisterForm;
