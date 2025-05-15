// lib/auth.ts
import jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';

// Interface consistente com AuthContext.tsx
interface DecodedToken extends JwtPayload {
  userId: number;
  username: string; // Usando username
  // Adicione outros campos se houver (iat, exp são padrão de JwtPayload)
}

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verifica a validade de um token JWT.
 *
 * @param token O token JWT a ser verificado.
 * @returns O payload decodificado se o token for válido, caso contrário null.
 */
export function verifyToken(token: string): DecodedToken | null {
  if (!JWT_SECRET) {
    console.error('ERRO FATAL: JWT_SECRET não está definido nas variáveis de ambiente!');
    return null;
  }
  if (!token) {
      return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;

    // Validação da estrutura esperada
    if (typeof decoded === 'object' && decoded !== null && decoded.userId && decoded.username) { // Verifica username
        return decoded;
    } else {
        console.warn('Token decodificado mas não contém a estrutura esperada (userId, username). Payload:', decoded);
        return null;
    }
  } catch (error: any) {
    console.error('Falha na verificação do token:', error.name, error.message);
    return null;
  }
}
