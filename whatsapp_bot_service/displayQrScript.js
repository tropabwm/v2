// lib/displayQrScript.js (Conteúdo MOVido para whatsapp_bot_service/displayQrScript.js)
// Este script simples recebe o QR code como argumento da linha de comando e o exibe no terminal.
// Útil quando o bot está rodando sem um terminal interativo direto (ex: em contêiner).

const qrcode = require('qrcode-terminal');

const qrCodeString = process.argv[2]; // O QR code é o 3º argumento (índice 2)

if (!qrCodeString) {
    console.error("Uso: node displayQrScript.js <qrCodeString>");
    process.exit(1);
}

// Exibe o QR code no terminal
qrcode.generate(qrCodeString, { small: true });

console.log("\nEscaneie o QR Code acima com o aplicativo WhatsApp no seu celular.");

// Opcional: Mantenha o processo rodando por um tempo se necessário, ou deixe-o terminar
// process.exit(0);