// pages/login.tsx
import React from 'react';
import Head from 'next/head';
import LoginRegisterForm from '@/components/LoginRegisterForm';
// import { cn } from "@/lib/utils"; // Removido se não for usado diretamente aqui

export default function LoginPage() {
  return (
    // Aplicando o fundo escuro e centralizando o conteúdo
    <div className="flex items-center justify-center min-h-screen bg-gray-900 px-4 py-8 pattern-dots pattern-blue-500 pattern-bg-gray-900 pattern-size-4 pattern-opacity-10"> 
      {/* 
        Você pode usar um fundo simples como bg-gray-900 ou bg-black.
        O exemplo acima usa 'tailwindcss-bg-patterns' para um padrão sutil. 
        Se não tiver, use apenas: className="flex items-center justify-center min-h-screen bg-gray-900 px-4 py-8"
        Ou defina um gradiente/imagem em globals.css para o body.
      */}
       <Head>
         <title>Acesso Restrito - USBMKT</title>
         <meta name="description" content="Entre ou crie sua conta para acessar o painel USBMKT." />
         <meta name="viewport" content="width=device-width, initial-scale=1" />
         <link rel="icon" href="/favicon.ico" /> {/* Certifique-se que tem um favicon */}
      </Head>
      <LoginRegisterForm />
    </div>
  );
}
