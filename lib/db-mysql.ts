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
        connectionLimit: 15, 
        queueLimit: 0,
        connectTimeout: 30000, 
        charset: 'utf8mb4_unicode_ci'
      });
      console.log("MySQL: Pool de conexão criado com sucesso.");
    } catch (error) {
      console.error("MySQL: CRITICAL ERROR AO CRIAR POOL DE CONEXÃO!", error);
      pool = null; 
      throw error; 
    }
  }
  return pool as mysql.Pool; 
}

async function executeQueryWithLogging(
    connection: mysql.PoolConnection | mysql.Pool, 
    query: string, 
    params: any[] = [], 
    successMessage?: string,
    errorMessagePrefix: string = "Erro genérico de query"
) {
    try {
        console.debug(`MySQL Executing: ${query.substring(0,300)}... Params: ${JSON.stringify(params).substring(0,200)}`);
        const [results] = await connection.query(query, params);
        if (successMessage) console.log(`MySQL: ${successMessage}`);
        return results; 
    } catch (error: any) {
        const ignorableErrorCodes = [
            'ER_DUP_FIELDNAME', 'ER_FK_DUP_NAME', 'ER_DUP_KEYNAME', 
            'ER_TABLE_EXISTS_ERROR', 'ER_COLUMN_EXISTS', 
            'ER_CANNOT_ADD_FOREIGN', 'ER_CONSTRAINT_EXISTS'
        ];
        const ignorableErrorMessagesFragments = [
            "Duplicate column name", "already exists", "Can't create table",
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
            throw error; 
        } else {
            console.debug(`MySQL Info: ${errorMessagePrefix} - Operação idempotente (item já existe ou não aplicável). Query: "${query.substring(0,100)}...", Código: ${error.code}.`);
        }
        return null; 
    }
}

async function addColumnIfNotExists(connection: mysql.PoolConnection | mysql.Pool, tableName: string, columnName: string, columnDefinition: string) {
    try {
        const checkQuery = `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`;
        const [rows] = await connection.query<mysql.RowDataPacket[]>(checkQuery, [tableName, columnName]);
        
        if (rows.length === 0) {
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
        console.error(`MySQL: Falha crítica ao verificar/adicionar coluna ${tableName}.${columnName}. Erro:`, error.message);
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
            user_id INT NULL,
            name VARCHAR(255) NOT NULL,
            client_name VARCHAR(255) NULL,
            product_name VARCHAR(255) NULL,
            objective JSON NULL,
            target_audience TEXT NULL,
            budget DECIMAL(15, 2) DEFAULT 0.00,
            start_date DATE NULL,
            end_date DATE NULL,
            status ENUM('active', 'paused', 'completed', 'draft', 'archived') DEFAULT 'draft',
            cost_traffic DECIMAL(15, 2) DEFAULT 0.00,
            cost_creative DECIMAL(15, 2) DEFAULT 0.00,
            cost_operational DECIMAL(15, 2) DEFAULT 0.00,
            industry VARCHAR(255) NULL,
            platform JSON NULL,
            daily_budget DECIMAL(15, 2) NULL,
            segmentation TEXT NULL,
            adFormat JSON NULL,
            duration INT NULL,
            avgTicket DECIMAL(15, 2) NULL,
            purchaseFrequency DECIMAL(10, 2) NULL,
            customerLifespan INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);
    await addColumnIfNotExists(db, tableName, 'user_id', 'INT NULL'); 
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
            type ENUM('image', 'video', 'text', 'carousel', 'other') DEFAULT 'other',
            file_url VARCHAR(1024) NULL,
            content TEXT NULL,
            metrics JSON NULL,
            status ENUM('active', 'inactive', 'draft', 'archived') DEFAULT 'draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);
    await addColumnIfNotExists(db, tableName, 'user_id', 'INT NULL');
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
    console.log(`MySQL: Schema da tabela ${tableName} verificado/atualizado.`);
}

export async function initializeDailyMetricsTable(db: mysql.Pool) {
    const tableName = 'daily_metrics';
    await executeQueryWithLogging(db, `
        CREATE TABLE IF NOT EXISTS ${db.escapeId(tableName)} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            campaign_id VARCHAR(36) NOT NULL,
            metric_date DATE NOT NULL,
            clicks INT DEFAULT 0,
            impressions INT DEFAULT 0,
            conversions INT DEFAULT 0,
            cost DECIMAL(15, 2) DEFAULT 0.00,
            revenue DECIMAL(15, 2) DEFAULT 0.00,
            leads INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_dm_campaign_date (campaign_id, metric_date),
            INDEX idx_dm_metric_date (metric_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `, [], `Tabela ${tableName} (CREATE IF NOT EXISTS) OK.`);
    await addColumnIfNotExists(db, tableName, 'metric_date', 'DATE NOT NULL');
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
            name VARCHAR(255) NULL,
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
            history LONGTEXT NOT NULL, 
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
    const currentPool = getDbPool(); 

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
        
        await addForeignKeyIfNotExists(currentPool, 'campaigns', 'fk_campaigns_user_id', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'creatives', 'fk_creatives_campaign_id', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'creatives', 'fk_creatives_user_id', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'flows', 'fk_flows_campaign_id', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'flows', 'fk_flows_user_id', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'copies', 'fk_copies_campaign_id', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'copies', 'fk_copies_creative_id', 'FOREIGN KEY (creative_id) REFERENCES creatives(id) ON DELETE SET NULL'); 
        await addForeignKeyIfNotExists(currentPool, 'copies', 'fk_copies_user_id', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'alerts', 'fk_alerts_campaign_id', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'alerts', 'fk_alerts_user_id','FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
        await addForeignKeyIfNotExists(currentPool, 'daily_metrics', 'fk_dm_campaign_id', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE');
        await addForeignKeyIfNotExists(currentPool, 'mcp_conversation_history', 'fk_mcp_hist_user_id','FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL');
        await addForeignKeyIfNotExists(currentPool, 'mcp_saved_conversations', 'fk_mcp_saved_user_id','FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');

        tablesInitialized = true;
        console.log("MySQL: Inicialização/verificação de TODAS as tabelas e FKs principais concluída com sucesso.");
    } catch (error) {
         console.error("MySQL: ERRO GRAVE durante a inicialização das tabelas ou FKs! Algumas APIs podem falhar.", error);
         tablesInitialized = false; 
    }
}

if (process.env.NODE_ENV === 'development' && !tablesInitialized) {
    console.log("MySQL: Chamando initializeAllTables() no startup do módulo db-mysql.ts (DEV)...");
    initializeAllTables().catch(e => {
        console.error("MySQL: Falha crítica ao auto-inicializar tabelas no startup do módulo db-mysql.ts (DEV):", e);
    });
} else if (!tablesInitialized && ['true', '1'].includes(process.env.FORCE_DB_INIT_ON_STARTUP?.toLowerCase() || '')) {
    console.log("MySQL: Forçando initializeAllTables() no startup devido a FORCE_DB_INIT_ON_STARTUP...");
    initializeAllTables().catch(e => {
        console.error("MySQL: Falha crítica ao FORÇAR auto-inicialização de tabelas no startup:", e);
    });
}
