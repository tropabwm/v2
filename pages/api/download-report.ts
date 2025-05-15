// pages/api/download-report.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import { format as formatDateFn, parseISO, isValid, startOfDay, endOfDay } from 'date-fns'; // Import parseISO, isValid, startOfDay, endOfDay
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

// Função auxiliar para escapar valores CSV
function escapeCsvValue(value: any): string {
    if (value === null || value === undefined) { return ''; }
    let str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        str = str.replace(/"/g, '""');
        str = `"${str}"`;
    }
    return str;
}

// Função para converter array de objetos em string CSV
function convertToCsv(data: any[], headers: string[]): string {
   // Include headers even if data is empty
   if (!data || data.length === 0) { return headers.map(escapeCsvValue).join(',') + '\n'; }
   const headerRow = headers.map(escapeCsvValue).join(',');
   const dataRows = data.map(row => headers.map(header => escapeCsvValue(row[header])).join(','));
   return [headerRow, ...dataRows].join('\n');
}

// Função para gerar buffer de PDF
async function generatePdfBuffer(data: any[], headers: string[], title: string, params: { [key: string]: any }): Promise<Buffer> {
    // Use a default orientation, landscape is wide, portrait is tall
    const doc = new jsPDF({ orientation: 'portrait' }); // Changed to portrait as default, adjust if needed

    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    let infoTextY = 22;
    const infoTextLines: string[] = [];
    infoTextLines.push(`Gerado em: ${formatDateFn(new Date(), 'dd/MM/yyyy HH:mm:ss')}`);
    if (params.cid) infoTextLines.push(`Campanha ID: ${params.cid}`);
    if (params.start || params.end) {
        // Format dates nicely for the report info text
        const formattedStart = params.start && isValid(parseISO(params.start)) ? formatDateFn(parseISO(params.start), 'dd/MM/yyyy') : 'Início';
        const formattedEnd = params.end && isValid(parseISO(params.end)) ? formatDateFn(parseISO(params.end), 'dd/MM/yyyy') : 'Fim';
        infoTextLines.push(`Período: ${formattedStart} até ${formattedEnd}`);
    }
    infoTextLines.forEach(line => {
        doc.text(line, 14, infoTextY);
        infoTextY += 5;
    });

    // Prepare table data
    const tableHeaders = [headers.map(h => h.toUpperCase())];
    const tableBody = data.map(row => headers.map(header => {
        let value = row[header];
        // Format common metric/currency columns
        if (typeof value === 'number') {
            if (['cost', 'revenue', 'budget_total', 'budget_daily', 'total_cost_actual', 'total_revenue_actual', 'profit_actual'].includes(header)) {
                value = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else if (['ctr', 'cpc', 'cpa', 'roi', 'budget_usage_percent', 'profit_margin_percent'].includes(header)) {
                 // Percentage or metrics with decimals
                value = typeof value === 'number' && isFinite(value) ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (value === null || value === undefined ? '' : String(value));
                 if (['ctr', 'budget_usage_percent', 'profit_margin_percent'].includes(header) && typeof value === 'string' && value !== '') {
                      value += '%'; // Add percent sign
                 }
            }
             else if (Number.isInteger(value)) {
                 value = value.toLocaleString('pt-BR'); // Integer formatting
            }
            else {
                 value = typeof value === 'number' && isFinite(value) ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (value === null || value === undefined ? '' : String(value)); // Default number formatting
            }
        } else if (value instanceof Date) {
             // Check if it's a valid Date object before formatting
            value = isValid(value) ? formatDateFn(value, 'dd/MM/yyyy') : '';
        } else if (value !== null && value !== undefined) {
             value = String(value); // Convert other non-null/undefined values to string
        } else {
             value = ''; // Treat null or undefined as empty string
        }
        return value;
    }));

    // AutoTable options
    const autoTableOptions: any = {
        head: tableHeaders,
        body: tableBody,
        startY: infoTextY + 5,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { }, // Define specific column styles if needed (e.g., width, alignment)
        didDrawPage: (data: any) => { // Using 'any' for data object as jspdf-autotable typings might vary
            doc.setFontSize(8);
            // CORREÇÃO: Use data.pageNumber para o número da página atual
            doc.text('Página ' + data.pageNumber, data.settings.margin.left, doc.internal.pageSize.height - 10); // Use data.pageNumber
        }
    };

     // Add column styles dynamically for date, numbers, currency
     autoTableOptions.columnStyles = headers.reduce((styles: any, header: string, index: number) => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader === 'date') {
               styles[index] = { cellWidth: 20 }; // Fixed width for dates
          } else if (['clicks', 'impressions', 'conversions'].includes(lowerHeader)) {
              styles[index] = { cellWidth: 15, halign: 'right' }; // Right align for counts
          } else if (['cost', 'revenue', 'budget_total', 'budget_daily', 'total_cost_actual', 'total_revenue_actual', 'profit_actual', 'cpc', 'cpa'].includes(lowerHeader)) {
              styles[index] = { halign: 'right' }; // Right align for currency/cost metrics
          } else if (['ctr', 'roi', 'budget_usage_percent', 'profit_margin_percent'].includes(lowerHeader)) {
               styles[index] = { halign: 'right' }; // Right align for percentage/ratio metrics
          } else if (lowerHeader === 'campaign_id') {
               styles[index] = { cellWidth: 30 }; // Fixed width for ID
          }
          return styles;
     }, {});


    autoTable(doc, autoTableOptions);


    // Output as ArrayBuffer and convert to Buffer
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    return pdfBuffer;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const {
        type,
        format: requestedFormat = 'pdf',
        cid, // campaign ID
        start, // start date YYYY-MM-DD
        end // end date YYYY-MM-DD
    } = req.query;

    console.log('[API Download Report] Received params:', req.query);

    if (!type || typeof type !== 'string') {
        return res.status(400).json({ error: 'Parâmetro "type" (tipo de relatório) é obrigatório.' });
    }
    const validFormats = ['csv', 'pdf'];
    const format = requestedFormat && typeof requestedFormat === 'string' && validFormats.includes(requestedFormat.toLowerCase())
        ? requestedFormat.toLowerCase()
        : 'pdf'; // Default to pdf if format is invalid

    let reportData: any[] = [];
    let reportHeaders: string[] = [];
    let reportTitle = `Relatório ${type.replace(/_/g, ' ')}`;
    let fileName = `report_${type}_${formatDateFn(new Date(), 'yyyyMMddHHmmss')}.${format}`;

    let connection: mysql.PoolConnection | null = null;
    try {
        const dbPool = getDbPool();
        connection = await dbPool.getConnection(); // Use getConnection from pool

        // Validate dates if provided
        let startDateSql: string | null = null;
        let endDateSql: string | null = null;
        if (start && typeof start === 'string') {
            const parsedStart = parseISO(start);
            if (isValid(parsedStart)) { startDateSql = formatDateFn(startOfDay(parsedStart), 'yyyy-MM-dd HH:mm:ss'); }
            else { console.warn('[API Download Report] Invalid start date format:', start); /* Log and skip filter or return error? Skipping filter.*/ }
        }
         if (end && typeof end === 'string') {
             const parsedEnd = parseISO(end);
             if (isValid(parsedEnd)) { endDateSql = formatDateFn(endOfDay(parsedEnd), 'yyyy-MM-dd HH:mm:ss'); }
             else { console.warn('[API Download Report] Invalid end date format:', end); /* Log and skip filter or return error? Skipping filter.*/ }
         }
        // Optional: Ensure end >= start if both are valid, otherwise adjust or error
        // if (startDateSql && endDateSql) {
        //     if (parseISO(startDateSql) > parseISO(endDateSql)) {
        //         console.warn('[API Download Report] startDate is after endDate. Proceeding but data might be empty.');
        //          // Depending on desired behavior, could swap dates, error, or just let the query return nothing
        //     }
        // }


        switch (type) {
            case 'campaign_performance':
                reportTitle = 'Relatório de Performance de Campanha';
                // Usando 'date' na query SQL, alinhado com daily-metrics.ts e dashboard.ts
                reportHeaders = [
                    'date', 'campaign_id', 'campaign_name', 'clicks', 'impressions',
                    'conversions', 'cost', 'revenue', 'ctr', 'cpc', 'cpa', 'roi'
                ];
                let perfSql = `
                    SELECT
                        dm.date, -- Usando 'date'
                        dm.campaign_id,
                        c.name AS campaign_name,
                        dm.clicks,
                        dm.impressions,
                        dm.conversions,
                        dm.cost,
                        dm.revenue,
                        IF(dm.impressions > 0, ROUND((dm.clicks / dm.impressions) * 100, 2), 0) AS ctr,
                        IF(dm.clicks > 0, ROUND(dm.cost / dm.clicks, 2), 0) AS cpc,
                        IF(dm.conversions > 0, ROUND(dm.cost / dm.conversions, 2), 0) AS cpa,
                        IF(dm.cost > 0, ROUND(((dm.revenue - dm.cost) / dm.cost) * 100, 2), 0) AS roi
                    FROM daily_metrics dm
                    LEFT JOIN campaigns c ON dm.campaign_id = c.id
                    WHERE 1=1
                `;
                const perfParams: (string | number)[] = [];
                if (cid && typeof cid === 'string') {
                    perfSql += ' AND dm.campaign_id = ?'; perfParams.push(cid);
                    fileName = `report_${type}_${cid}_${formatDateFn(new Date(), 'yyyyMMddHHmmss')}.${format}`;
                    reportTitle += ` (Campanha: ${cid})`;
                }
                 // Usar as variáveis de data SQL formatadas
                if (startDateSql) { perfSql += ' AND dm.date >= ?'; perfParams.push(startDateSql); } // Use dm.date
                if (endDateSql) { perfSql += ' AND dm.date <= ?'; perfParams.push(endDateSql); } // Use dm.date

                perfSql += ' ORDER BY dm.date ASC, c.name ASC'; // Order by 'date'
                console.log("[API Download Report] Perf SQL:", connection.format(perfSql, perfParams));
                const [perfRows] = await connection.query<mysql.RowDataPacket[]>(perfSql, perfParams);

                 // Ensure numerical types are converted from MySQL RowDataPacket for accurate formatting in PDF/CSV
                 reportData = perfRows.map(row => ({
                     ...row,
                     // Convert potential string/decimal types from DB to Number
                     clicks: Number(row.clicks),
                     impressions: Number(row.impressions),
                     conversions: Number(row.conversions),
                     cost: Number(row.cost),
                     revenue: Number(row.revenue),
                     // Derived metrics might already be numbers from SQL, but re-cast for safety
                     ctr: Number(row.ctr),
                     cpc: Number(row.cpc),
                     cpa: Number(row.cpa),
                     roi: Number(row.roi),
                 }));

                break;

            case 'budget_summary':
                 reportTitle = 'Relatório Resumo de Orçamento';
                 // Usando 'date' para filtros em daily_metrics dentro do JOIN
                 reportHeaders = [
                     'campaign_id', 'campaign_name', 'status', 'budget_total', 'budget_daily',
                     'cost_traffic_planned', 'cost_creative_planned', 'cost_operational_planned',
                     'total_cost_actual', 'total_revenue_actual', 'profit_actual', 'budget_usage_percent', 'profit_margin_percent'
                 ];
                 let budgetSql = `
                    SELECT
                        c.id AS campaign_id,
                        c.name AS campaign_name,
                        c.status,
                        c.budget AS budget_total,
                        c.daily_budget AS budget_daily,
                        c.cost_traffic AS cost_traffic_planned,
                        c.cost_creative AS cost_creative_planned,
                        c.cost_operational AS cost_operational_planned,
                        COALESCE(SUM(dm.cost), 0) AS total_cost_actual,
                        COALESCE(SUM(dm.revenue), 0) AS total_revenue_actual,
                        COALESCE(SUM(dm.revenue), 0) - COALESCE(SUM(dm.cost), 0) AS profit_actual,
                        IF(c.budget > 0, ROUND((COALESCE(SUM(dm.cost), 0) / c.budget) * 100, 2), 0) AS budget_usage_percent,
                        IF(COALESCE(SUM(dm.revenue), 0) > 0, ROUND(((COALESCE(SUM(dm.revenue), 0) - COALESCE(SUM(dm.cost), 0)) / COALESCE(SUM(dm.revenue), 0)) * 100, 2), 0) AS profit_margin_percent
                    FROM campaigns c
                    LEFT JOIN daily_metrics dm ON c.id = dm.campaign_id
                 `;
                 const budgetParams: (string | number)[] = [];
                 const budgetWhereClauses: string[] = [];
                 const budgetJoinConditions: string[] = []; // Use for JOIN filters

                 if (cid && typeof cid === 'string') {
                     budgetWhereClauses.push('c.id = ?'); budgetParams.push(cid);
                     fileName = `report_${type}_${cid}_${formatDateFn(new Date(), 'yyyyMMddHHmmss')}.${format}`;
                     reportTitle += ` (Campanha: ${cid})`;
                 }
                 // Add date filters to the JOIN condition for daily_metrics
                 if (startDateSql) { budgetJoinConditions.push('dm.date >= ?'); budgetParams.push(startDateSql); } // Use dm.date
                 if (endDateSql) { budgetJoinConditions.push('dm.date <= ?'); budgetParams.push(endDateSql); } // Use dm.date

                 // Add JOIN conditions if they exist
                 if(budgetJoinConditions.length > 0) {
                      const onClause = `c.id = dm.campaign_id AND ${budgetJoinConditions.join(' AND ')}`;
                      // Replace the existing ON clause
                      budgetSql = budgetSql.replace('LEFT JOIN daily_metrics dm ON c.id = dm.campaign_id', `LEFT JOIN daily_metrics dm ON (${onClause})`);
                 }

                 if (budgetWhereClauses.length > 0) { budgetSql += ` WHERE ${budgetWhereClauses.join(' AND ')}`; }
                 budgetSql += ` GROUP BY c.id ORDER BY c.name ASC`;

                 console.log("[API Download Report] Budget SQL:", connection.format(budgetSql, budgetParams));
                 const [budgetRows] = await connection.query<mysql.RowDataPacket[]>(budgetSql, budgetParams);

                 // Ensure numerical types are converted from MySQL RowDataPacket for accurate formatting
                 reportData = budgetRows.map(row => ({
                     ...row,
                     budget_total: Number(row.budget_total),
                     budget_daily: Number(row.daily_budget), // Corrected name from DB
                     cost_traffic_planned: Number(row.cost_traffic_planned),
                     cost_creative_planned: Number(row.cost_creative_planned),
                     cost_operational_planned: Number(row.cost_operational_planned),
                     total_cost_actual: Number(row.total_cost_actual),
                     total_revenue_actual: Number(row.total_revenue_actual),
                     profit_actual: Number(row.profit_actual),
                     budget_usage_percent: Number(row.budget_usage_percent),
                     profit_margin_percent: Number(row.profit_margin_percent),
                 }));

                 break;

            default:
                console.warn(`[API Download Report] Tipo de relatório não suportado: ${type}`);
                return res.status(400).json({ error: `Tipo de relatório "${type}" não suportado.` });
        }

        if (format === 'pdf') {
            console.log(`[API Download Report] Generating PDF buffer for ${fileName}...`);
            // Pass query parameters (like cid, start, end) to PDF generator for info text
            const pdfBuffer = await generatePdfBuffer(reportData, reportHeaders, reportTitle, req.query);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            console.log(`[API Download Report] Sending PDF data for ${fileName}`);
            res.status(200).send(pdfBuffer);

        } else { // format === 'csv'
             console.log(`[API Download Report] Generating CSV data for ${fileName}...`);
            const csvData = convertToCsv(reportData, reportHeaders);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            console.log(`[API Download Report] Sending CSV data for ${fileName}`);
            res.status(200).send(csvData);
        }

    } catch (error: any) {
        console.error('[API Download Report] Erro ao gerar relatório:', error);
        // Ensure JSON response on error
        res.setHeader('Content-Type', 'application/json');
        // Remove Content-Disposition header on error to avoid issues
        res.removeHeader('Content-Disposition');
        // Include SQL details if available from mysql2 error
        res.status(500).json({ error: 'Erro interno do servidor ao gerar relatório.', details: error.message, code: error.code, sqlState: error.sqlState, sqlMessage: error.sqlMessage, sql: error.sql });
    } finally {
        if (connection) connection.release();
    }
}
