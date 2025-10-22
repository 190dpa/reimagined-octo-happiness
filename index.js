const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Compatibilidade fetch no Node.js
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Estoque inicial
let stock = [
  { id: "TOMATRIO", name: "TOMATRIO", emoji: "🍅", quantity: 0, price: 0.50, max: 300 },
  { id: "MANGO", name: "MANGO", emoji: "🥭", quantity: 0, price: 0.70, max: 300 },
  { id: "MR_CARROT", name: "MR CARROT", emoji: "🥕", quantity: 0, price: 0.40, max: 150 },
  { id: "PLANTA", name: "PLANTA (100k ~ 500k DPS)", emoji: "🌱", quantity: 0, price: 5.00, max: 20 }
];

// Carregar stock salvo no arquivo
if(fs.existsSync('stock.json')) {
  const savedStock = JSON.parse(fs.readFileSync('stock.json'));
  stock = stock.map(item => {
    const savedItem = savedStock.find(s => s.id === item.id);
    return savedItem ? { ...item, quantity: savedItem.quantity, price: savedItem.price } : item;
  });
}

// Webhook do Discord
const webhookURL = 'https://discord.com/api/webhooks/1430367755839868938/tM2Vrs_oi4_Ed4V_bOfEJQmpZPngVcYmvodDaGXWva4aIlkehnoiORkN7KITE6_A5jqM';
let messageId = '1430373050779697288';

// --- ROTAS --- //

// Rota para pegar stock atual (JSON)
app.get('/get-stock', (req, res) => {
  res.json(stock);
});

// Atualiza stock e preço via painel
app.post('/update-stock', async (req, res) => {
  const newStock = req.body;

  stock = stock.map(item => {
    const quantityKey = `${item.id}_quantity`;
    const priceKey = `${item.id}_price`;
    return {
      ...item,
      quantity: newStock[quantityKey] !== undefined ? Number(newStock[quantityKey]) : item.quantity,
      price: newStock[priceKey] !== undefined ? Number(newStock[priceKey]) : item.price
    };
  });

  fs.writeFileSync('stock.json', JSON.stringify(stock, null, 2));
  await updateEmbed();
  res.json({ status:'success', stock });
});

// Define a mensagem a ser editada
app.post('/set-message-id', async (req, res) => {
  const { id } = req.body;
  if(!id) return res.status(400).json({ status:'error', message:'ID não enviado' });
  messageId = id;
  await fetchSelectedMessage();
  res.json({ status:'success', message:`Agora editando mensagem ${messageId}`, stock });
});

// Serve arquivos estáticos
app.use(express.static('public'));

// Serve index.html
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public/index.html')));

// --- FUNÇÕES --- //

// Gera embed
function generateEmbed() {
  return {
    username: "DOLLYA VS BRAINROTS [PREÇOS]",
    avatar_url: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fd/c8/4a/fdc84a19-2df7-4205-a233-7e3d794688d6/1963623074713_cover.png/600x600bf-60.jpg",
    embeds: [
      {
        title: "🧠 DOLLYA STORE | TABELA DE PREÇOS — PLANTS VS BRAINROTS 🧃",
        color: 16753920,
        thumbnail: { url: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fd/c8/4a/fdc84a19-2df7-4205-a233-7e3d794688d6/1963623074713_cover.png/600x600bf-60.jpg" },
        fields: stock.map(item => ({
          name: `${item.emoji} ${item.name}`,
          value: `**Preço:** R$${item.price.toFixed(2)}\n**Estoque:** ${item.quantity > 0 ? item.quantity : 'ESGOTADO'}`,
          inline: true
        })),
        footer: { text: "🛒 dolly store — Domine o plants vs brainrots!" }
      }
    ]
  };
}

// Atualiza embed no Discord
async function updateEmbed() {
  if(!messageId) return console.log('Nenhum messageId definido.');
  try {
    await fetch(`${webhookURL}/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateEmbed())
    });
    console.log('Embed atualizado com sucesso!');
  } catch (err) {
    console.error('Erro ao atualizar embed:', err);
  }
}

// Lê embed da mensagem selecionada
async function fetchSelectedMessage() {
  if(!messageId) return console.log('Nenhum messageId definido.');
  try {
    const res = await fetch(`${webhookURL}/messages/${messageId}`);
    const data = await res.json();

    if(data.embeds && data.embeds.length > 0) {
      const fields = data.embeds[0].fields;

      stock = stock.map(item => {
        const field = fields.find(f => f.name.includes(item.name));
        if(field){
          const cleanedValue = field.value.replace(/\*\*/g, ''); 
          const matchQty = cleanedValue.match(/Estoque:\s*(\d+|ESGOTADO)/i);
          const matchPrice = cleanedValue.match(/Preço:\s*R\$([\d,.]+)/i);

          return {
            ...item,
            quantity: matchQty ? (matchQty[1].toUpperCase() === 'ESGOTADO' ? 0 : parseInt(matchQty[1])) : item.quantity,
            price: matchPrice ? parseFloat(matchPrice[1].replace(',', '.')) : item.price
          };
        }
        return item;
      });

      fs.writeFileSync('stock.json', JSON.stringify(stock, null, 2));
      console.log('Stock atualizado da mensagem selecionada.');
    }
  } catch(err) {
    console.error('Erro ao ler embed da mensagem:', err);
  }
}

// --- INICIALIZAÇÃO --- //
const PORT = process.env.PORT || 3000;
app.listen(PORT, async ()=>{
  console.log(`Servidor rodando na porta ${PORT}`);
  if(messageId) await fetchSelectedMessage();
});
