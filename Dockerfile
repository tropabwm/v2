# Dockerfile (Exemplo para Next.js com Pages Router)

# 1. Base Image (ATUALIZADO para Node.js 20+)
FROM node:20-slim 

# Instalação do ffmpeg (necessário para fluent-ffmpeg)
USER root
RUN apt-get update && \
    apt-get install -y ffmpeg --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*
USER node

# 2. Set working directory
WORKDIR /app

# 3. Variáveis de ambiente
ENV NODE_ENV=production

# 4. Copiar package.json e package-lock.json (ou yarn.lock)
COPY --chown=node:node package*.json ./

# 5. Instalar Dependências
# A flag --legacy-peer-deps pode ajudar com conflitos de dependência
RUN npm install --legacy-peer-deps

# 6. Configurar o PATH para incluir node_modules/.bin
ENV PATH="/app/node_modules/.bin:$PATH"

# 7. Copiar o resto do código da aplicação
COPY --chown=node:node . .

# 8. Construir a Aplicação
RUN rm -rf .next/cache && npm run build

# 9. Comando para iniciar a aplicação
EXPOSE 3000
CMD ["npm", "start"]
