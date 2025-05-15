// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

const SALT_ROUNDS = 10;

interface RegisteredUser {
    id: number | string;
    username: string;
    email: string;
    created_at?: string;
}

type RegisterResponse = {
    message: string;
    error?: string;
    user?: RegisteredUser;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RegisterResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Método ${req.method} não permitido` });
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Usuário, email e senha são obrigatórios.' });
  }
  if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Tipo inválido para usuário, email ou senha.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Senha deve ter pelo menos 6 caracteres.' });
  }
  if (username.length < 3) {
    return res.status(400).json({ message: 'Usuário deve ter pelo menos 3 caracteres.' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ message: 'Nome de usuário pode conter apenas letras, números e underscore (_).' });
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    return res.status(400).json({ message: 'Formato de email inválido.' });
  }

  let dbPool: mysql.Pool | null = null;

  try {
    dbPool = getDbPool();
    if (!dbPool) {
        console.error("[API Register] Falha crítica: Pool de conexão MySQL não disponível.");
        throw new Error("Falha ao obter pool de conexão MySQL.");
    }

    // await initializeAllTables(); // Considere remover ou otimizar esta chamada em produção
    console.log("[API Register] Tabelas inicializadas/verificadas (se a lógica em db-mysql permitir).");

    console.log(`[API Register] Verificando existência de username: ${username} ou email: ${email}`);
    const [existingUserRows] = await dbPool.query<mysql.RowDataPacket[]>(
      'SELECT username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );

    if (existingUserRows.length > 0) {
      const duplicateInfo = existingUserRows[0];
      console.warn(`[API Register] Tentativa de registrar usuário já existente. Encontrado: username='${duplicateInfo.username}', email='${duplicateInfo.email}'`);
      if (duplicateInfo.username.toLowerCase() === username.toLowerCase() && duplicateInfo.email.toLowerCase() === email.toLowerCase()) {
        return res.status(409).json({ message: 'Nome de usuário e email já existem.' });
      } else if (duplicateInfo.username.toLowerCase() === username.toLowerCase()) {
        return res.status(409).json({ message: 'Nome de usuário já existe.' });
      } else if (duplicateInfo.email.toLowerCase() === email.toLowerCase()) {
        return res.status(409).json({ message: 'Email já existe.' });
      }
    }

    console.log(`[API Register] Gerando hash para senha do usuário: ${username}`);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    console.log(`[API Register] Inserindo usuário: ${username}, email: ${email}`);
    const [insertResult] = await dbPool.query<mysql.ResultSetHeader>(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email.toLowerCase(), passwordHash] 
    );

    const newUserId = insertResult.insertId;
    if (!newUserId) {
        console.error("[API Register] Falha ao obter ID do usuário após inserção.");
        throw new Error("Não foi possível obter o ID do usuário recém-criado.");
    }
    console.log(`[API Register] Usuário '${username}' (email: ${email}) criado com ID: ${newUserId}`);

    const [newUserRows] = await dbPool.query<mysql.RowDataPacket[]>(
        'SELECT id, username, email, created_at FROM users WHERE id = ?',
        [newUserId]
    );

    if (newUserRows.length === 0) {
        console.error(`[API Register] Falha ao buscar usuário recém-criado com ID: ${newUserId}`);
        throw new Error("Não foi possível encontrar o usuário recém-criado.");
    }
    
    const createdUser: RegisteredUser = {
        id: newUserRows[0].id,
        username: newUserRows[0].username,
        email: newUserRows[0].email,
        created_at: newUserRows[0].created_at ? new Date(newUserRows[0].created_at).toISOString() : undefined
    };

    console.log("[API Register] Registro bem-sucedido. Retornando usuário:", createdUser);
    return res.status(201).json({ message: 'Usuário criado com sucesso!', user: createdUser });

  } catch (error: any) {
    console.error('[API Register] Erro no processamento:', error);
    const isDuplicateError = error.code === 'ER_DUP_ENTRY' || (error.message && error.message.toLowerCase().includes('duplicate entry'));
    
    let clientMessage = 'Erro interno ao registrar usuário.';
    if (isDuplicateError) {
        if (error.message && error.message.includes(`for key 'users.username'`)) {
            clientMessage = 'Nome de usuário já cadastrado.';
        } else if (error.message && error.message.includes(`for key 'users.email'`)) {
            clientMessage = 'Email já cadastrado.';
        } else {
            clientMessage = 'Nome de usuário ou email já cadastrado.';
        }
    }
    
    return res.status(isDuplicateError ? 409 : 500).json({ 
        message: clientMessage, 
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
