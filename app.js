// Importar pacotes
const express = require('express');
const axios = require('axios'); // Importar o axios

// Criar o app Express
const app = express();

// Middleware para ler o corpo JSON das requisições
app.use(express.json());

// Definir porta e token de verificação a partir das variáveis de ambiente
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN; // Você define este token no seu ambiente

// Rota para verificação do webhook (GET)
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  // Verifica o modo e o token para validar o webhook
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    // Responde com 'Forbidden' se os tokens não baterem
    res.sendStatus(403);
  }
});

// Rota para receber os webhooks (POST) e encaminhar
app.post('/', (req, res) => {
  const webhookPayload = req.body;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

  console.log(`\n\nWebhook recebido ${timestamp}\n`);
  console.log(JSON.stringify(webhookPayload, null, 2));

  // Lê as URLs de destino a partir de uma variável de ambiente
  // Exemplo: "https://dev-A.ngrok.io/webhook,https://dev-B.ngrok.io/webhook"
  const forwardUrls = process.env.FORWARD_URLS ? process.env.FORWARD_URLS.split(',') : [];

  if (forwardUrls.length > 0) {
    console.log(`Encaminhando para: ${forwardUrls.join(', ')}`);

    // Cria uma promessa de encaminhamento para cada URL
    const promises = forwardUrls.map(url => {
      // Usamos o axios para fazer um POST com o mesmo payload que recebemos
      return axios.post(url, webhookPayload).catch(err => {
        // Apenas logamos o erro para não quebrar o fluxo principal
        console.error(`Erro ao encaminhar para ${url}:`, err.message);
      });
    });

    // Executa todas as promessas de encaminhamento
    Promise.all(promises);
  } else {
    console.log('Nenhuma URL de encaminhamento configurada na variável FORWARD_URLS.');
  }

  // Responde imediatamente para a Meta com 200 OK para evitar timeouts
  res.sendStatus(200);
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`\nServidor intermediário escutando na porta ${port}\n`);
});
