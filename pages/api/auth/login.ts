// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDbPool } from '@/lib/db-mysql'; 
import mysql from 'mysql2/promise';

type LoginResponse = {
    token: string;
    message: string;
    user?: {
        id: number;
        username: string;
        email?: string;
    };
} | {
    message: string;
    error?: string;
    code?: string;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("\nFATAL ERROR: JWT_SECRET is not defined in environment variables.\n");
    if (process.env.NODE_ENV === 'production') {
        process.exit(1); // Em produção, é crítico.
    } else {
        console.warn("JWT_SECRET não definido. Usando um segredo padrão APENAS PARA DESENVOLVIMENTO. NÃO USE EM PRODUÇÃO.");
        // Em desenvolvimento, você poderia ter um fallback, mas é melhor definir no .env.local
        // process.env.JWT_SECRET = "fallback_dev_secret_ بسیار_ناامن"; // Exemplo de fallback ruim
    }
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Método ${req.method} não permitido` });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Tipo inválido para email ou senha.' });
  }

  // Bypass de desenvolvimento (MANTIDO, mas com aviso se JWT_SECRET não estiver definido)
  if (email === 'adm@example.com' && password === '123456' && process.env.FORCE_AUTH_BYPASS === 'true') {
      if (!JWT_SECRET) return res.status(500).json({ message: "Configuração crítica do servidor ausente (JWT_SECRET) para bypass."});
      console.log("[BYPASS DEV] Login temporário concedido para 'adm@example.com'");
      const bypassPayload = { userId: 1, username: 'adm_bypass' }; 
      const bypassToken = jwt.sign(bypassPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      return res.status(200).json({
          token: bypassToken,
          message: 'Login bem-sucedido (Bypass de Desenvolvimento)',
          user: { id: bypassPayload.userId, username: bypassPayload.username, email: email }
      });
  } else if (process.env.FORCE_AUTH_BYPASS === 'true') {
       console.warn("[BYPASS DEV] Tentativa de login com credenciais não-bypass enquanto FORCE_AUTH_BYPASS=true. Procedendo com login normal.");
  }


  if (!JWT_SECRET) { // Checagem final se não for bypass e JWT_SECRET ainda não estiver definido
    console.error("[API Login] ERRO CRÍTICO: JWT_SECRET não está configurado no ambiente.");
    return res.status(500).json({ message: "Erro de configuração do servidor (JWT)." });
  }

  let dbPool: mysql.Pool | null = null; 

  try {
    console.log("[API Login] Tentando obter pool MySQL...");
    dbPool = getDbPool();
    if (!dbPool) {
        console.error("[API Login] Falha crítica ao obter pool de conexão MySQL do getDbPool.");
        return res.status(503).json({ message: "Serviço de banco de dados indisponível (pool error)." });
    }
    console.log("[API Login] Pool obtido. Buscando usuário por email...");

    const [userRows] = await dbPool.query<mysql.RowDataPacket[]>(
      'SELECT id, username, password_hash, email FROM users WHERE email = ? LIMIT 1',
      [email.toLowerCase()] 
    );

    if (userRows.length === 0) {
      console.warn(`[API Login] Usuário não encontrado para email: ${email.toLowerCase()}`);
      return res.status(401).json({ message: 'Email ou senha inválidos.' });
    }

    const user = userRows[0];
    if (!user.password_hash) {
        console.error(`[API Login] Usuário ${user.username} (email: ${user.email}) não possui password_hash no banco. Impossível verificar senha.`);
        return res.status(500).json({ message: 'Erro de configuração da conta de usuário (sem hash).' });
    }

    console.log(`[API Login] Verificando senha (bcrypt) para usuário: ${user.username} (email: ${user.email})`);
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      console.warn(`[API Login] Senha inválida para email: ${email.toLowerCase()}`);
      return res.status(401).json({ message: 'Email ou senha inválidos.' });
    }

    console.log(`[API Login] Senha válida para ${user.username} (email: ${user.email}). Atualizando info de login (async)...`);
    dbPool.query(
        'UPDATE users SET login_count = COALESCE(login_count, 0) + 1, last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
    ).catch(updateError => {
        console.error(`[API Login] Falha assíncrona ao atualizar info de login para user ID ${user.id}:`, updateError);
    });

    const payload = { userId: user.id, username: user.username, email: user.email }; // Adicionando email ao payload do JWT
    console.log(`[API Login] Gerando token JWT para usuário: ${user.username} (ID: ${user.id}) com expiração em ${JWT_EXPIRES_IN}`);
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    console.log(`[API Login] Usuário '${user.username}' (ID: ${user.id}) autenticado com sucesso.`);
    return res.status(200).json({
        token: token,
        message: 'Login bem-sucedido!',
        user: { id: user.id, username: user.username, email: user.email }
    });

  } catch (error: any) {
    console.error('[API Login] Erro:', error);
    // Se o erro for 'ER_BAD_FIELD_ERROR' e incluir 'password_hash', é provável que a coluna não exista.
    if (error.code === 'ER_BAD_FIELD_ERROR' && error.sqlMessage && error.sqlMessage.includes('password_hash')) {
        console.error("[API Login] ERRO CRÍTICO DE SCHEMA: A coluna 'password_hash' não foi encontrada na tabela 'users'. Verifique lib/db-mysql.ts e o schema do banco.");
        return res.status(500).json({
            message: 'Erro de configuração do banco de dados (schema). Contate o administrador.',
            code: error.code,
            error: 'Schema Mismatch'
        });
    }
    return res.status(500).json({
        message: 'Erro interno durante o login.',
        code: error.code || 'UNKNOWN_LOGIN_ERROR',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}