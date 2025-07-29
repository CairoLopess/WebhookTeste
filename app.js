// Importar pacotes
const express = require('express');
const axios = require('axios');

// Criar o app Express
const app = express();

// Middleware para ler o corpo JSON das requisições
// IMPORTANTE: A verificação de assinatura da Meta requer o corpo da requisição em formato RAW (bruto).
// No entanto, para a simplicidade do encaminhamento, o parser JSON do Express funciona bem,
// pois o axios irá re-serializar o objeto JSON ao enviá-lo.
app.use(express.json());

// Definir porta e token de verificação a partir das variáveis de ambiente
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

// Rota para verificação do webhook (GET) - SEM MUDANÇAS AQUI
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});


// ROTA POST MODIFICADA PARA REPASSAR A ASSINATURA ORIGINAL
app.post('/', (req, res) => {
  const webhookPayload = req.body;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

  console.log(`\n\nWebhook recebido ${timestamp}\n`);
  
  // Captura o cabeçalho de assinatura original enviado pela Meta
  // Os nomes dos cabeçalhos são normalizados para minúsculas pelo Express
  const metaSignature = req.headers['x-hub-signature-256'];

  if (!metaSignature) {
    console.warn('Requisição recebida sem o cabeçalho X-Hub-Signature-256. Descartando.');
    return res.sendStatus(400); // Bad Request
  }

  const forwardUrls = process.env.FORWARD_URLS ? process.env.FORWARD_URLS.split(',') : [];

  if (forwardUrls.length > 0) {
    console.log(`Encaminhando para: ${forwardUrls.join(', ')}`);
    console.log(`Repassando a assinatura: ${metaSignature}`);

    // Define os cabeçalhos que serão encaminhados
    const config = {
      headers: {
        // Repassa o cabeçalho original da Meta para o seu serviço local
        'X-Hub-Signature-256': metaSignature,
        // É uma boa prática repassar também o Content-Type
        'Content-Type': 'application/json'
      }
    };

    const promises = forwardUrls.map(url => {
      // Envia o payload e o objeto de configuração com os cabeçalhos
      return axios.post(url, webhookPayload, config).catch(err => {
        console.error(`Erro ao encaminhar para ${url}:`, err.message);
      });
    });

    Promise.all(promises);
  } else {
    console.log('Nenhuma URL de encaminhamento configurada na variável FORWARD_URLS.');
  }

  // Responde imediatamente para a Meta com 200 OK
  res.sendStatus(200);
});


// Inicia o servidor
app.listen(port, () => {
  console.log(`\nServidor intermediário escutando na porta ${port}\n`);
});
