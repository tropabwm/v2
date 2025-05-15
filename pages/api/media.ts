// pages/api/upload/media.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
    api: {
        bodyParser: false,
    },
};

type UploadResponse = {
    url?: string;
    message?: string;
    error?: string;
    details?: string; // <<< ADICIONADO 'details' AQUI
};

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'mcp-flows');

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<UploadResponse>
) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Método ${req.method} não permitido` });
    }

    try {
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
            console.log(`[API Upload] Diretório de upload criado: ${UPLOAD_DIR}`);
        }

        const form = formidable({
            uploadDir: UPLOAD_DIR,
            keepExtensions: true,
            maxFileSize: 25 * 1024 * 1024, 
            filename: (name, ext, part, form) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                return `${part.name || 'file'}-${uniqueSuffix}${ext || '.unknown'}`;
            }
        });

        const [fields, files] = await form.parse(req);
        
        const uploadedFile = files.mediaFile?.[0] as File | undefined;

        if (!uploadedFile) {
            return res.status(400).json({ error: 'Nenhum arquivo recebido ou nome de campo inválido.' });
        }

        const fileName = uploadedFile.newFilename;
        const publicUrl = `/uploads/mcp-flows/${fileName}`; 

        console.log(`[API Upload] Arquivo salvo em: ${uploadedFile.filepath}`);
        console.log(`[API Upload] URL pública gerada: ${publicUrl}`);
        
        res.status(200).json({ url: publicUrl, message: 'Upload bem-sucedido!' });

    } catch (error: any) {
        console.error("[API Upload] Erro durante o upload:", error);
        let errorMessage = 'Erro interno do servidor durante o upload.';
        if (error.message.includes('maxFileSize exceeded')) {
            errorMessage = 'Arquivo excede o tamanho máximo permitido.';
            return res.status(413).json({ error: errorMessage, details: error.message }); // Adicionado details aqui também
        }
        // Resposta de erro corrigida para incluir 'details'
        res.status(500).json({ error: errorMessage, details: error.message });
    }
}
