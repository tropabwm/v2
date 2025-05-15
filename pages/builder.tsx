// pages/builder.tsx
import React, { useEffect } from 'react';
import Head from 'next/head';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import BuilderLayout from '@/components/layout-builder';
import { LeftSidebarProvider } from '@/context/LeftSidebarContext';
import BuilderStudio from '@/components/BuilderStudio';

const BuilderPageContent: React.FC = () => {
    return (
        <BuilderLayout>
            <BuilderStudio />
        </BuilderLayout>
    );
};

const BuilderPage: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, isLoading, router]);

    if (isLoading || !isAuthenticated) {
        return null;
    }

    return (
        <LeftSidebarProvider>
            <Head>
                <title>Builder - USBMKT</title>
                <meta name="description" content="Visual builder for marketing assets" />
            </Head>
            <BuilderPageContent />
        </LeftSidebarProvider>
    );
};

export default BuilderPage;
