# Dockerfile (Exemplo para Next.js com Pages Router)

# 1. Base Image (Use uma versão LTS ou a que você usa localmente)
FROM node:18-slim

# 2. Set working directory
WORKDIR /app

# 3. Variáveis de ambiente (Opcional, mas bom ter)
ENV NODE_ENV=production

# 4. Copiar package.json e package-lock.json PRIMEIRO
# Isso aproveita o cache do Docker se esses arquivos não mudarem
COPY package*.json ./

# 5. Instalar Dependências
# Removemos a flag --omit=dev para instalar devDependencies (necessárias para o build step)
# A flag --legacy-peer-deps pode ajudar com conflitos de dependência mais antigos
RUN npm install --legacy-peer-deps

# 6. Configurar o PATH para incluir node_modules/.bin
# Garante que executáveis como 'tsc' e 'next' sejam encontrados durante o build.
ENV PATH="/app/node_modules/.bin:$PATH"

# 7. Copiar o resto do código da aplicação
COPY . .

# 8. Construir a Aplicação
# Adicionamos rm -rf .next/cache de volta APENAS para tentar mitigar qualquer cache persistente do Next.js no ambiente de build
RUN rm -rf .next/cache && npm run build

# 9. Comando para iniciar a aplicação
# Porta padrão do Next.js
EXPOSE 3000
CMD ["npm", "start"]
