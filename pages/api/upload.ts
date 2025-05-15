// pages/api/upload.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File as FormidableFile } from 'formidable'; // Renomeado para evitar conflito
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg'; // ADICIONADO

export const config = {
    api: {
        bodyParser: false,
    },
};

const UPLOAD_LIMIT_MB = 50;
const MAX_FILE_SIZE_BYTES = UPLOAD_LIMIT_MB * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

async function ensureUploadDirExists() {
    try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        console.log(`[API Upload] Diretório de upload verificado/criado: ${UPLOAD_DIR}`);
    } catch (error) {
        console.error(`[API Upload] ERRO CRÍTICO ao criar diretório de upload ${UPLOAD_DIR}:`, error);
        throw new Error('Falha ao configurar o diretório de upload.');
    }
}

// Função para gerar thumbnail
function generateThumbnail(videoPath: string, thumbnailPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        console.log(`[API Upload] Gerando thumbnail para ${videoPath} em ${thumbnailPath}`);
        ffmpeg(videoPath)
            .on('end', () => {
                console.log(`[API Upload] Thumbnail gerada com sucesso: ${thumbnailPath}`);
                resolve(thumbnailPath);
            })
            .on('error', (err) => {
                console.error(`[API Upload] Erro ao gerar thumbnail: ${err.message}`);
                reject(err);
            })
            .screenshots({
                timestamps: ['1%'], // Pega um frame a 1% do vídeo
                filename: path.basename(thumbnailPath), // Apenas o nome do arquivo da thumbnail
                folder: path.dirname(thumbnailPath),    // A pasta onde salvar
                size: '320x240', // Tamanho da thumbnail (ajuste conforme necessário)
            });
    });
}


const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    try {
        await ensureUploadDirExists();

        const form = formidable({
            uploadDir: UPLOAD_DIR,
            keepExtensions: true,
            maxFileSize: MAX_FILE_SIZE_BYTES,
            filter: ({ mimetype }) => {
                const allowed = mimetype?.includes('image') || mimetype?.includes('video') || false;
                console.log(`[API Upload] Filtrando tipo: ${mimetype}, Permitido: ${allowed}`);
                return allowed;
            },
            filename: (name, ext, part, form) => {
                const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
                const cleanOriginalName = (part.originalFilename || name || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_');
                const newFilename = `creative-${uniqueSuffix}${ext}`;
                console.log(`[API Upload] Gerando filename: ${newFilename} (Original: ${part.originalFilename || 'N/A'})`);
                return newFilename;
            }
        });

        const parseForm = (): Promise<{ fields: formidable.Fields<string>; files: formidable.Files<string> }> => {
            return new Promise((resolve, reject) => {
                form.parse(req, (err, fields, files) => {
                    if (err) {
                        console.error('[API Upload] Erro durante o parse do formidable:', err);
                        const isSizeError = err.message?.includes('maxFileSize exceeded') || (err as any).code === 1009;
                        if (isSizeError) {
                            const limitMB = UPLOAD_LIMIT_MB;
                            console.error(`[API Upload] ERRO 413 (Parse): Arquivo excede o limite de ${limitMB}MB.`);
                            const sizeError = new Error(`Arquivo excede o limite de ${limitMB}MB.`);
                            (sizeError as any).statusCode = 413;
                            return reject(sizeError);
                        }
                         const parseError = new Error(`Erro ao processar upload: ${err.message}`);
                         (parseError as any).statusCode = 500;
                         return reject(parseError);
                    }
                    console.log('[API Upload] Parse concluído.'); // Fields e Files podem ser muito verbosos
                    resolve({ fields, files });
                });
            });
        };

        const { fields, files } = await parseForm();
        const uploadedFileArray = files.file || files.creativeFile;
        const uploadedFile = Array.isArray(uploadedFileArray) ? uploadedFileArray[0] : uploadedFileArray;

        if (!uploadedFile) {
            console.error('[API Upload] Nenhum arquivo recebido no campo esperado ("file" ou "creativeFile").');
            return res.status(400).json({ message: 'Nenhum arquivo válido enviado.' });
        }

         try {
            await fs.access(uploadedFile.filepath);
            console.log(`[API Upload] Arquivo confirmado em: ${uploadedFile.filepath}`);
         } catch (accessError) {
             console.error(`[API Upload] ERRO: Arquivo não encontrado em ${uploadedFile.filepath} após parse.`, accessError);
             throw new Error("Falha ao salvar o arquivo no servidor.");
         }

        console.log('[API Upload] Arquivo recebido:', uploadedFile.newFilename);
        const relativeFilePath = `/uploads/${uploadedFile.newFilename}`;
        let thumbnailUrl: string | null = null;

        // Gerar thumbnail se for vídeo
        if (uploadedFile.mimetype?.startsWith('video/')) {
            const thumbnailFilename = `${path.parse(uploadedFile.newFilename).name}-thumb.jpg`;
            const thumbnailAbsolutePath = path.join(UPLOAD_DIR, thumbnailFilename);
            try {
                await generateThumbnail(uploadedFile.filepath, thumbnailAbsolutePath);
                thumbnailUrl = `/uploads/${thumbnailFilename}`;
                console.log(`[API Upload] Thumbnail URL: ${thumbnailUrl}`);
            } catch (thumbError) {
                console.error(`[API Upload] Não foi possível gerar thumbnail para ${uploadedFile.newFilename}, mas o vídeo foi salvo.`);
                // Continuar mesmo se a thumbnail falhar, mas logar o erro.
            }
        }

        return res.status(201).json({
            message: 'Upload bem-sucedido!',
            fileUrl: relativeFilePath,
            thumbnailUrl: thumbnailUrl, // Adiciona a URL da thumbnail à resposta
            success: true,
            filePath: relativeFilePath,
            originalName: uploadedFile.originalFilename
        });

    } catch (error: any) {
        console.error('[API Upload] Erro GERAL no handler:', error);
        const statusCode = error.statusCode || 500;
        const message = error.message || 'Erro interno do servidor ao fazer upload.';
        return res.status(statusCode).json({ message: message, error: error.message });
    }
};

export default handler;