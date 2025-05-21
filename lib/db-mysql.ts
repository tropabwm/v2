// lib/db-mysql.ts
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;
let tablesInitialized = false;

export function getDbPool(): mysql.Pool {
  if (!pool) {
    console.log("MySQL: Criando novo pool de conexão...");
    const requiredEnvVars: string[] = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_PORT'];
    const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

    if (missingEnvVars.length > 0) {
        const errorMessage = `MySQL: CRITICAL ERROR - As seguintes variáveis de ambiente do banco de dados estão faltando: ${missingEnvVars.join(', ')}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    try {
      pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT!, 10),
        waitForConnections: true,
        connectionLimit: 15, // Ajuste conforme necessidade e plano do Railway
        queueLimit: 0,
        connectTimeout: 30000, // Aumentado para Railway
        charset: 'utf8mb4_unicode_ci'
      });
      console.log("MySQL: Pool de conexão criado com sucesso.");
    } catch (error) {
      console.error("MySQL: CRITICAL ERROR AO CRIAR POOL DE CONEXÃO!", error);
      pool = null; // Garante que não tentaremos usar um pool defeituoso
      throw error; // Re-throw para que a aplicação saiba que falhou
    }
  }
  return pool as mysql.Pool; // Type assertion após a lógica de criação
}

async function executeQueryWithLogging(
    connection: mysql.PoolConnection | mysql.Pool,
    query: string,
    params: any[] = [],
    successMessage?: string,
    errorMessagePrefix: string = "Erro genérico de query"
) {
    try {
        // Limitar o log de parâmetros para evitar exposição excessiva ou logs muito longos
        const paramsLog = params.length > 0 ? JSON.stringify(params).substring(0, 200) + (JSON.stringify(params).length > 200 ? "..." : "") : "[]";
        console.debug(`MySQL Executing: ${query.substring(0,300)}... Params: ${paramsLog}`);
        const [results] = await connection.query(query, params);
        if (successMessage) console.log(`MySQL: ${successMessage}`);
        return results;
    } catch (error: any) {
        // Códigos de erro comuns que podem ser ignorados se a intenção é "CREATE/ALTER IF NOT EXISTS"
        const ignorableErrorCodes = [
            'ER_DUP_FIELDNAME', 'ER_FK_DUP_NAME', 'ER_DUP_KEYNAME', // Duplicates
            'ER_TABLE_EXISTS_ERROR', // Table already exists
            'ER_COLUMN_EXISTS', // Column already exists in ALTER TABLE ADD COLUMN
            'ER_CANNOT_ADD_FOREIGN', // FK issues, pode ser mais complexo
            'ER_CONSTRAINT_EXISTS', // Constraint (like UNIQUE, PRIMARY KEY) already exists
            // Adicionar outros códigos conforme a necessidade
        ];
        // Fragmentos de mensagens de erro que também podem indicar operações idempotentes
        const ignorableErrorMessagesFragments = [
            "Duplicate column name", "already exists", "Can't create table", // CREATE TABLE IF NOT EXISTS pode dar 'Table already exists'
            "Duplicate key name", "Foreign key constraint", "Constraint already exists"
        ];

        let isIgnorable = ignorableErrorCodes.includes(error.code);
        if (!isIgnorable && error.message) {
            for (const msgFragment of ignorableErrorMessagesFragments) {
                if (error.message.includes(msgFragment)) {
                    isIgnorable = true;
                    break;
                }
            }
        }
        
        if (!isIgnorable) {
            console.error(`MySQL: ${errorMessagePrefix} (Código: ${error.code || 'N/A'}) ao executar query "${query.substring(0, 100)}...":`, error.message, error.sqlMessage ? `SQL Error: ${error.sqlMessage}` : '');
            throw error; // Re-throw para que a chamada saiba da falha
        } else {
            // Para operações idempotentes, apenas logar como debug
            console.debug(`MySQL Info: ${errorMessagePrefix} - Operação idempotente (item já existe ou não aplicável). Query: "${query.substring(0,100)}...", Código: ${error.code}.`);
        }
        return null; // Retornar null para operações ignoradas pode ser útil para a lógica de chamada
    }
}


async function addColumnIfNotExists(connection: mysql.PoolConnection | mysql.Pool, tableName: string, columnName: string, columnDefinition: string) {
    try {
        // Usar INFORMATION_SCHEMA para verificar a existência da coluna de forma mais precisa
        const checkQuery = `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`;
        const [rows] = await connection.query<mysql.RowDataPacket[]>(checkQuery, [tableName, columnName]);
        
        if (rows.length === 0) {
            // Usar escapeId para nomes de tabela e coluna para segurança
            const alterQuery = `ALTER TABLE ${connection.escapeId(tableName)} ADD COLUMN ${connection.escapeId(columnName)} ${columnDefinition}`;
            await executeQueryWithLogging(
                connection,
                alterQuery,
                [],
                `Coluna ${tableName}.${columnName} adicionada.`,
                `Erro ao adicionar coluna ${tableName}.${columnName}`
            );
        } else {
            console.debug(`MySQL Info: Coluna ${tableName}.${columnName} já existe.`);
        }
    } catch (error: any) {
        // Logar erro, mas não necessariamente parar toda a inicialização por causa de uma coluna
        console.error(`MySQL: Falha crítica ao verificar/adicionar coluna ${tableName}.${columnName}. Erro:`, error.message);
        // Não re-lançar aqui para permitir que outras inicializações continuem, a menos que seja um erro fatal de conexão
    }
}

async function addForeignKeyIfNotExists(
    connection: mysql.PoolConnection | mysql.Pool,
    tableName: string,
    constraintName: string,
    fkDefinition: string
) {
    try {
        const checkQuery = `SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY' LIMIT 1`;
        const [rows] = await connection.query<mysql.RowDataPacket[]>(checkQuery, [tableName, constraintName]);

        if (rows.length === 0) {
            const alterQuery = `ALTER TABLE ${connection.escapeId(tableName)} ADD CONSTRAINT ${connection.escapeId(constraintName)} ${fkDefinition}`;
            await executeQueryWithLogging(
                connection,
                alterQuery,
                [],
                `Chave estrangeira '${constraintName}' para '${tableName}' adicionada.`,
                `Erro ao adicionar FK '${constraintName}' em '${tableName}'`
            );
        } else {
            console.debug(`MySQL Info: FK ${constraintName} em ${tableName} já existe.`);
        }
    } catch (error: any) {
        console.error(`MySQL: Falha crítica ao verificar/adicionar FK ${constraintName} em ${tableName}. Erro:`, error.message);
    }
}


export async function initializeUsersTable(db: mysql.Pool) {
    const tableName = 'users';
    await executeQueryWithLogging(db, `
        CREATE TABLE IF NOT EXISTS ${db.escapeId(tableName)} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);
    await addColumnIfNotExists(db, tableName, 'login_count', 'INT DEFAULT 0');
    await addColumnIfNotExists(db, tableName, 'last_login_at', 'TIMESTAMP NULL DEFAULT NULL');
    console.log(`MySQL: Schema da tabela ${tableName} verificado/atualizado.`);
}

export async function initializeCampaignsTable(db: mysql.Pool) {
    const tableName = 'campaigns';
    await executeQueryWithLogging(db, `
        CREATE TABLE IF NOT EXISTS ${db.escapeId(tableName)} (
            id VARCHAR(36) PRIMARY KEY,
            user_id INT NULL,                            -- Ligado ao usuário/agência do USB MKT PRO
            name VARCHAR(255) NOT NULL,
            status ENUM('active', 'paused', 'completed', 'draft', 'archived') DEFAULT 'draft',
            
            selected_client_account_id VARCHAR(255) NULL, -- ID interno para a conta de cliente vinculada (gerenciado pelo seu app)
            external_platform_account_id VARCHAR(255) NULL, -- ID da conta na plataforma externa (ex: Google Customer ID, Meta Ad Account ID)
            platform_source VARCHAR(50) NULL,            -- 'google', 'meta', 'tiktok', 'manual', etc.
            external_campaign_id VARCHAR(255) NULL,      -- ID da campanha na plataforma externa

            platforms JSON NULL,                         -- Plataformas onde a campanha roda (ex: ['google', 'facebook'])
            objectives JSON NULL,                        -- Objetivos da campanha (ex: ['vendas', 'leads'])
            ad_formats JSON NULL,                        -- Formatos de anúncio (ex: ['video', 'imagem'])
            
            budget DECIMAL(15, 2) NULL,                  -- Orçamento total
            daily_budget DECIMAL(15, 2) NULL,            -- Orçamento diário
            start_date DATE NULL,
            end_date DATE NULL,
            
            target_audience_description TEXT NULL,       -- Descrição do público-alvo
            industry VARCHAR(255) NULL,                  -- Indústria/Nicho
            segmentation_notes TEXT NULL,                -- Notas de segmentação
            avg_ticket DECIMAL(15, 2) NULL,              -- Ticket médio
            
            -- Manter campos originais se ainda relevantes ou para dados legados
            client_name VARCHAR(255) NULL,               -- Pode ser redundante se usar selected_client_account_id
            product_name VARCHAR(255) NULL,
            cost_traffic DECIMAL(15, 2) DEFAULT 0.00,    -- Custos adicionais
            cost_creative DECIMAL(15, 2) DEFAULT 0.00,
            cost_operational DECIMAL(15, 2) DEFAULT 0.00,
            duration INT NULL,                           -- Duração em dias (pode ser calculado)
            purchase_frequency DECIMAL(10, 2) NULL,
            customer_lifespan INT NULL,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);

    // Garantir que todas as colunas do formulário e API existam
    await addColumnIfNotExists(db, tableName, 'user_id', 'INT NULL');
    await addColumnIfNotExists(db, tableName, 'status', "ENUM('active', 'paused', 'completed', 'draft', 'archived') DEFAULT 'draft'");
    
    await addColumnIfNotExists(db, tableName, 'selected_client_account_id', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(db, tableName, 'external_platform_account_id', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(db, tableName, 'platform_source', 'VARCHAR(50) NULL');
    await addColumnIfNotExists(db, tableName, 'external_campaign_id', 'VARCHAR(255) NULL');

    await addColumnIfNotExists(db, tableName, 'platforms', 'JSON NULL');
    await addColumnIfNotExists(db, tableName, 'objectives', 'JSON NULL');
    await addColumnIfNotExists(db, tableName, 'ad_formats', 'JSON NULL');

    await addColumnIfNotExists(db, tableName, 'budget', 'DECIMAL(15, 2) NULL'); // Permite NULL se não definido
    await addColumnIfNotExists(db, tableName, 'daily_budget', 'DECIMAL(15, 2) NULL');
    await addColumnIfNotExists(db, tableName, 'start_date', 'DATE NULL');
    await addColumnIfNotExists(db, tableName, 'end_date', 'DATE NULL');
    
    await addColumnIfNotExists(db, tableName, 'target_audience_description', 'TEXT NULL');
    await addColumnIfNotExists(db, tableName, 'industry', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(db, tableName, 'segmentation_notes', 'TEXT NULL');
    await addColumnIfNotExists(db, tableName, 'avg_ticket', 'DECIMAL(15, 2) NULL');
    
    // Manter verificações para colunas antigas se ainda fizerem parte do seu modelo de dados
    await addColumnIfNotExists(db, tableName, 'client_name', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(db, tableName, 'product_name', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(db, tableName, 'cost_traffic', 'DECIMAL(15, 2) DEFAULT 0.00');
    await addColumnIfNotExists(db, tableName, 'cost_creative', 'DECIMAL(15, 2) DEFAULT 0.00');
    await addColumnIfNotExists(db, tableName, 'cost_operational', 'DECIMAL(15, 2) DEFAULT 0.00');
    await addColumnIfNotExists(db, tableName, 'duration', 'INT NULL');
    await addColumnIfNotExists(db, tableName, 'purchase_frequency', 'DECIMAL(10, 2) NULL');
    await addColumnIfNotExists(db, tableName, 'customer_lifespan', 'INT NULL');
    
    console.log(`MySQL: Schema da tabela ${tableName} verificado/atualizado.`);
}

export async function initializeCreativesTable(db: mysql.Pool) {
    const tableName = 'creatives';
    await executeQueryWithLogging(db, `
        CREATE TABLE IF NOT EXISTS ${db.escapeId(tableName)} (
            id VARCHAR(36) PRIMARY KEY,
            campaign_id VARCHAR(36) NULL,
            user_id INT NULL,
            name VARCHAR(255) NOT NULL,
            type ENUM('image', 'video', 'text', 'carousel', 'headline', 'body', 'cta', 'other') DEFAULT 'other',
            file_url VARCHAR(1024) NULL,        -- Para arquivos no S3 ou similar, ou caminho local se servido pelo app
            content TEXT NULL,                   -- Para criativos de texto, ou URL externa de imagem/video
            metrics JSON NULL,                   -- Métricas específicas do criativo
            status ENUM('active', 'inactive', 'draft', 'archived', 'review') DEFAULT 'draft', -- Adicionado 'review'
            platform JSON NULL,                  -- Plataformas onde o criativo é usado (ex: ['google', 'meta'])
            format VARCHAR(255) NULL,            -- Formato específico (ex: '1080x1080', 'Reels')
            publish_date TIMESTAMP NULL,
            originalFilename VARCHAR(255) NULL,  -- Nome original do arquivo upado
            comments TEXT NULL,                  -- Comentários internos
            thumbnail_url VARCHAR(1024) NULL,    -- URL da thumbnail (para vídeos)
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);

    await addColumnIfNotExists(db, tableName, 'campaign_id', 'VARCHAR(36) NULL');
    await addColumnIfNotExists(db, tableName, 'user_id', 'INT NULL');
    // 'name' já está no CREATE
    await addColumnIfNotExists(db, tableName, 'type', "ENUM('image', 'video', 'text', 'carousel', 'headline', 'body', 'cta', 'other') DEFAULT 'other'");
    await addColumnIfNotExists(db, tableName, 'file_url', 'VARCHAR(1024) NULL');
    await addColumnIfNotExists(db, tableName, 'content', 'TEXT NULL'); // Já estava, mas confirmando
    await addColumnIfNotExists(db, tableName, 'metrics', 'JSON NULL');
    await addColumnIfNotExists(db, tableName, 'status', "ENUM('active', 'inactive', 'draft', 'archived', 'review') DEFAULT 'draft'");
    await addColumnIfNotExists(db, tableName, 'platform', 'JSON NULL');
    await addColumnIfNotExists(db, tableName, 'format', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(db, tableName, 'publish_date', 'TIMESTAMP NULL');
    await addColumnIfNotExists(db, tableName, 'originalFilename', 'VARCHAR(255) NULL');
    await addColumnIfNotExists(db, tableName, 'comments', 'TEXT NULL');
    await addColumnIfNotExists(db, tableName, 'thumbnail_url', 'VARCHAR(1024) NULL'); // Adicionando thumbnail_url
    
    console.log(`MySQL: Schema da tabela ${tableName} verificado/atualizado.`);
}

export async function initializeFlowsTable(db: mysql.Pool) {
    const tableName = 'flows';
    await executeQueryWithLogging(db, `
        CREATE TABLE IF NOT EXISTS ${db.escapeId(tableName)} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            user_id INT NULL,
            campaign_id VARCHAR(36) DEFAULT NULL,
            elements JSON DEFAULT NULL,
            status ENUM('active', 'inactive', 'draft') DEFAULT 'draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_flows_user_id (user_id),
            INDEX idx_flows_campaign_id (campaign_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);
    await addColumnIfNotExists(db, tableName, 'user_id', 'INT NULL');
    await addColumnIfNotExists(db, tableName, 'campaign_id', 'VARCHAR(36) DEFAULT NULL');
    await addColumnIfNotExists(db, tableName, 'elements', 'JSON DEFAULT NULL');
    console.log(`MySQL: Schema da tabela ${tableName} verificado/atualizado.`);
}

export async function initializeCopiesTable(db: mysql.Pool) {
    const tableName = 'copies';
    await executeQueryWithLogging(db, `
        CREATE TABLE IF NOT EXISTS ${db.escapeId(tableName)} (
            id VARCHAR(36) PRIMARY KEY,
            campaign_id VARCHAR(36) NULL,
            creative_id VARCHAR(36) NULL,
            user_id INT NULL,
            title VARCHAR(255) NOT NULL,
            content_body TEXT NULL,
            caption TEXT NULL,
            cta VARCHAR(255) NULL,
            target_audience TEXT NULL,
            copy_type ENUM('headline', 'body', 'cta', 'description', 'ad_copy', 'email_subject', 'social_post', 'other') DEFAULT 'other',
            status ENUM('active', 'inactive', 'draft', 'archived', 'approved', 'rejected') DEFAULT 'draft',
            clicks INT DEFAULT 0,
            impressions INT DEFAULT 0,
            conversions INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);
    
    await addColumnIfNotExists(db, tableName, 'user_id', 'INT NULL');
    await addColumnIfNotExists(db, tableName, 'campaign_id', 'VARCHAR(36) NULL');
    await addColumnIfNotExists(db, tableName, 'creative_id', 'VARCHAR(36) NULL');
    await addColumnIfNotExists(db, tableName, 'content_body', 'TEXT NULL');
    await addColumnIfNotExists(db, tableName, 'caption', 'TEXT NULL');
    await addColumnIfNotExists(db, tableName, 'copy_type', "ENUM('headline', 'body', 'cta', 'description', 'ad_copy', 'email_subject', 'social_post', 'other') DEFAULT 'other'");

    console.log(`MySQL: Schema da tabela ${tableName} verificado/atualizado.`);
}

export async function initializeAlertsTable(db: mysql.Pool) {
    const tableName = 'alerts';
    await executeQueryWithLogging(db, `
        CREATE TABLE IF NOT EXISTS ${db.escapeId(tableName)} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            campaign_id VARCHAR(36) NULL,
            user_id INT NULL,
            type VARCHAR(100) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);
    await addColumnIfNotExists(db, tableName, 'user_id', 'INT NULL');
    await addColumnIfNotExists(db, tableName, 'campaign_id', 'VARCHAR(36) NULL');
    console.log(`MySQL: Schema da tabela ${tableName} verificado/atualizado.`);
}

export async function initializeDailyMetricsTable(db: mysql.Pool) {
    const tableName = 'daily_metrics';
    await executeQueryWithLogging(db, `
        CREATE TABLE IF NOT EXISTS ${db.escapeId(tableName)} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            campaign_id VARCHAR(36) NOT NULL,
            user_id INT NULL,
            metric_date DATE NOT NULL,
            clicks INT DEFAULT 0,
            impressions INT DEFAULT 0,
            conversions INT DEFAULT 0,
            cost DECIMAL(15, 2) DEFAULT 0.00,
            revenue DECIMAL(15, 2) DEFAULT 0.00,
            leads INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_dm_campaign_user_date (campaign_id, user_id, metric_date),
            INDEX idx_dm_metric_date (metric_date),
            INDEX idx_dm_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);
    
    await addColumnIfNotExists(db, tableName, 'campaign_id', 'VARCHAR(36) NOT NULL');
    await addColumnIfNotExists(db, tableName, 'user_id', 'INT NULL');
    await addColumnIfNotExists(db, tableName, 'metric_date', 'DATE NOT NULL');
    await addColumnIfNotExists(db, tableName, 'clicks', 'INT DEFAULT 0');
    await addColumnIfNotExists(db, tableName, 'impressions', 'INT DEFAULT 0');
    await addColumnIfNotExists(db, tableName, 'conversions', 'INT DEFAULT 0');
    await addColumnIfNotExists(db, tableName, 'cost', 'DECIMAL(15, 2) DEFAULT 0.00');
    await addColumnIfNotExists(db, tableName, 'revenue', 'DECIMAL(15, 2) DEFAULT 0.00');
    await addColumnIfNotExists(db, tableName, 'leads', 'INT DEFAULT 0');
    
    console.log(`MySQL: Schema da tabela ${tableName} verificado/atualizado.`);
}

export async function initializeMcpHistoryTable(db: mysql.Pool) {
    const tableName = 'mcp_conversation_history';
    await executeQueryWithLogging(db, `
        CREATE TABLE IF NOT EXISTS ${db.escapeId(tableName)} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            session_id VARCHAR(255) NOT NULL,
            user_id INT NULL,
            message_order BIGINT NOT NULL,
            role ENUM('system', 'user', 'assistant', 'tool', 'function', 'model') NOT NULL,
            content LONGTEXT,
            tool_call_id VARCHAR(255) NULL,
            name VARCHAR(255) NULL, -- Para role 'tool' ou 'function'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_processed BOOLEAN DEFAULT FALSE,
            INDEX idx_mcp_history_session_user_order (session_id, user_id, message_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);
    await addColumnIfNotExists(db, tableName, 'user_id', 'INT NULL');
    await addColumnIfNotExists(db, tableName, 'is_processed', 'BOOLEAN DEFAULT FALSE');
    console.log(`MySQL: Schema da tabela ${tableName} verificado/atualizado.`);
}

export async function initializeMcpSavedConversationsTable(db: mysql.Pool) {
    const tableName = 'mcp_saved_conversations';
    await executeQueryWithLogging(db, `
        CREATE TABLE IF NOT EXISTS ${db.escapeId(tableName)} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_id VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            history LONGTEXT NOT NULL, -- Armazena o array de mensagens como JSON string
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_mcp_saved_user_session (user_id, session_id),
            UNIQUE KEY unique_mcp_saved_user_name (user_id, name),
            INDEX idx_mcp_saved_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);
    console.log(`MySQL: Schema da tabela ${tableName} verificado/atualizado.`);
}


export async function initializeAllTables() {
    if (tablesInitialized && process.env.NODE_ENV !== 'development' && !['true', '1'].includes(process.env.FORCE_DB_INIT_ON_STARTUP?.toLowerCase() || '')) {
        console.log("MySQL: Verificação de tabelas já realizada e não forçada em produção.");
        return;
    }
    console.log("MySQL: Iniciando verificação/inicialização de TODAS as tabelas principais...");
    const currentPool = getDbPool(); // Garante que o pool seja obtido/criado

    try {
        await initializeUsersTable(currentPool);
        await initializeCampaignsTable(currentPool);
        await initializeCreativesTable(currentPool);
        await initializeFlowsTable(currentPool);
        await initializeCopiesTable(currentPool);
        await initializeAlertsTable(currentPool);
        await initializeDailyMetricsTable(currentPool);
        await initializeMcpHistoryTable(currentPool);
        await initializeMcpSavedConversationsTable(currentPool);

        console.log("MySQL: Adicionando/Verificando chaves estrangeiras...");
        
        // FKs para 'campaigns'
        await addForeignKeyIfNotExists(currentPool, 'campaigns', 'fk_campaigns_user_id', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        
        // FKs para 'creatives'
        await addForeignKeyIfNotExists(currentPool, 'creatives', 'fk_creatives_campaign_id', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL'); // Ou CASCADE se preferir
        await addForeignKeyIfNotExists(currentPool, 'creatives', 'fk_creatives_user_id', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        
        // FKs para 'flows'
        await addForeignKeyIfNotExists(currentPool, 'flows', 'fk_flows_campaign_id', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'flows', 'fk_flows_user_id', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        
        // FKs para 'copies'
        await addForeignKeyIfNotExists(currentPool, 'copies', 'fk_copies_campaign_id', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'copies', 'fk_copies_creative_id', 'FOREIGN KEY (creative_id) REFERENCES creatives(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'copies', 'fk_copies_user_id', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        
        // FKs para 'alerts'
        await addForeignKeyIfNotExists(currentPool, 'alerts', 'fk_alerts_campaign_id', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL'); // Ou CASCADE
        await addForeignKeyIfNotExists(currentPool, 'alerts', 'fk_alerts_user_id','FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'); // CASCADE se alertas devem sumir com usuário
        
        // FKs para 'daily_metrics'
        await addForeignKeyIfNotExists(currentPool, 'daily_metrics', 'fk_dm_campaign_id', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE'); // CASCADE faz sentido aqui
        await addForeignKeyIfNotExists(currentPool, 'daily_metrics', 'fk_dm_user_id', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL'); // Ou CASCADE
        
        // FKs para 'mcp_conversation_history'
        await addForeignKeyIfNotExists(currentPool, 'mcp_conversation_history', 'fk_mcp_hist_user_id','FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL'); // Ou CASCADE
        
        // FKs para 'mcp_saved_conversations'
        await addForeignKeyIfNotExists(currentPool, 'mcp_saved_conversations', 'fk_mcp_saved_user_id','FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');

        tablesInitialized = true;
        console.log("MySQL: Inicialização/verificação de TODAS as tabelas e FKs principais concluída com sucesso.");
    } catch (error) {
         console.error("MySQL: ERRO GRAVE durante a inicialização das tabelas ou FKs! Algumas APIs podem falhar.", error);
         tablesInitialized = false; // Marcar como não inicializado para tentar novamente na próxima vez (em dev)
    }
}

// Auto-inicialização em desenvolvimento ou quando forçado
if (process.env.NODE_ENV === 'development' && !tablesInitialized) {
    console.log("MySQL: Chamando initializeAllTables() no startup do módulo db-mysql.ts (DEV)...");
    initializeAllTables().catch(e => {
        // Não travar a importação do módulo, apenas logar o erro. A aplicação pode tentar de novo.
        console.error("MySQL: Falha crítica ao auto-inicializar tabelas no startup do módulo db-mysql.ts (DEV):", e);
    });
} else if (!tablesInitialized && ['true', '1'].includes(process.env.FORCE_DB_INIT_ON_STARTUP?.toLowerCase() || '')) {
    console.log("MySQL: Forçando initializeAllTables() no startup devido a FORCE_DB_INIT_ON_STARTUP...");
    initializeAllTables().catch(e => {
        console.error("MySQL: Falha crítica ao FORÇAR auto-inicialização de tabelas no startup:", e);
    });
}
