// C:\Users\ADM\Desktop\v13-main\displayQrScript.js
const qrcode = require('qrcode-terminal');
const qrData = process.argv[2];

if (qrData) {
    qrcode.generate(qrData, { small: true }, (qrVisual) => {
        if (qrVisual) {
            console.log('\nEscaneie o QR Code abaixo no seu WhatsApp:');
            console.log(qrVisual);
            console.log('\nPressione Ctrl+C para fechar esta janela APÓS escanear.');
        } else {
            console.error('Erro: Não foi possível gerar a representação visual do QR Code.');
        }
    });
} else {
    console.error('Erro: Dados do QR Code não recebidos via argumento de linha de comando.');
    console.log('Uso: node displayQrScript.js <string_do_qr_code>');
}

// Para manter a janela aberta (opcional, pode ser removido se não desejado)
// process.stdin.resume();
// process.on('SIGINT', () => {
//   console.log('Fechando...');
//   process.exit();
// });
