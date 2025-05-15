// context/AuthContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/router';
import { jwtDecode } from 'jwt-decode';
import axios, { AxiosError } from 'axios';

interface DecodedToken {
  userId: number; 
  username: string;
  email?: string;
  iat: number;
  exp: number;
}
export interface User {
  id: number;
  username: string;
  email?: string;
}
export interface AuthContextProps {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (token: string) => void; 
  logout: () => void;
  register: (username: string, email: string, password: string) => Promise<any>;
  apiLogin: (emailOrUsername: string, password: string) => Promise<{ token: string; user: User }>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const useAuth = (): AuthContextProps => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

interface AuthProviderProps { children: ReactNode; }

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://v2-production-cc95.up.railway.app/';

  const processAndSetToken = useCallback((token: string | null): boolean => {
    if (token) {
        try {
            const decoded: DecodedToken = jwtDecode(token);
            const nowInSeconds = Date.now() / 1000;

            if (decoded.exp > nowInSeconds) {
                console.log(`[AuthContext] Token válido para ${decoded.username}. Autenticando.`);
                setUser({ id: decoded.userId, username: decoded.username, email: decoded.email });
                setIsAuthenticated(true);
                setAuthToken(token);
                return true;
            } else {
                console.warn('[AuthContext] Token expirado encontrado. Removendo.');
                if (typeof window !== 'undefined') localStorage.removeItem('authToken');
                return false;
            }
        } catch (error) {
            console.error('[AuthContext] Erro ao decodificar token:', error);
            if (typeof window !== 'undefined') localStorage.removeItem('authToken');
            return false;
        }
    }
    return false;
  }, []);


  useEffect(() => {
    if (typeof window !== 'undefined') {
        console.log('[AuthContext Effect] Verificando token no localStorage...');
        const storedToken = localStorage.getItem('authToken');
        if (!processAndSetToken(storedToken)) {
            setIsAuthenticated(false);
            setUser(null);
            setAuthToken(null);
        }
        console.log('[AuthContext Effect] Verificação inicial concluída.');
        setIsLoading(false);
    } else {
        setIsLoading(false);
    }
  }, [processAndSetToken]);

  const loginInternalSetter = useCallback((token: string) => {
    console.log('[AuthContext loginInternalSetter] Processando token recebido.');
    if (typeof window !== 'undefined') {
        localStorage.setItem('authToken', token);
    }
    if (!processAndSetToken(token)) {
        if (typeof window !== 'undefined') localStorage.removeItem('authToken');
        setUser(null);
        setIsAuthenticated(false);
        setAuthToken(null);
        console.error("[AuthContext loginInternalSetter] Token fornecido é inválido ou expirado.");
        throw new Error("Token fornecido para loginInternalSetter é inválido ou expirado.");
    }
  }, [processAndSetToken]);

  const apiLogin = useCallback(async (emailOrUsername: string, password: string): Promise<{ token: string; user: User }> => {
    console.log('[AuthContext apiLogin] Tentando login via API...');
    setIsLoading(true);
    try {
        // CORRIGIDO: Removido /auth/ da URL
        const response = await axios.post(`${API_URL}/api/login`, {
            email: emailOrUsername,
            password,
        });
        const { token: newToken, user: userData } = response.data;
        if (!newToken || !userData) {
            throw new Error("Resposta da API de login inválida.");
        }
        loginInternalSetter(newToken); 
        setIsLoading(false);
        return { token: newToken, user: userData }; 
    } catch (error) {
        setIsLoading(false);
        console.error("[AuthContext apiLogin] Erro:", error);
        throw error; 
    }
  }, [API_URL, loginInternalSetter]);


  const logout = useCallback(() => {
    console.log('[AuthContext] Logout acionado.');
    if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
    }
    setUser(null);
    setIsAuthenticated(false);
    setAuthToken(null);
    router.push('/login');
  }, [router]);

  const register = useCallback(async (username: string, email: string, password: string): Promise<any> => {
    console.log('[AuthContext register] Tentando registrar...');
    setIsLoading(true);
    try {
        // CORRIGIDO: Removido /auth/ da URL
        const response = await axios.post(`${API_URL}/api/register`, {
            username,
            email,
            password,
        });
        console.log("AuthContext: Usuário registrado:", response.data);
        setIsLoading(false);
        return response.data; 
    } catch (error: any) {
        setIsLoading(false);
        console.error("AuthContext: Erro no registro:", error.response?.data || error.message);
        if (error.response) throw error.response; 
        throw error; 
    }
  }, [API_URL]);

  const value: AuthContextProps = { 
      user, 
      isAuthenticated, 
      isLoading, 
      login: loginInternalSetter, 
      logout, 
      token: authToken, 
      register, 
      apiLogin 
    };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
