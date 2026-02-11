
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// Coinbase Credentials from Environment Variables
const API_KEY_NAME = process.env.COINBASE_KEY_NAME;
const API_KEY_SECRET = (process.env.COINBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n');

/**
 * Generate JWT for Coinbase Advanced Trade API
 */
function generateCoinbaseToken(method, path) {
  if (!API_KEY_NAME || !API_KEY_SECRET) return null;
  
  const algorithm = 'ES256';
  const uri = `any:${method} coinbase.com${path}`;
  
  return jwt.sign({
      iss: 'coinbase-cloud',
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120,
      sub: API_KEY_NAME,
      uri: uri,
    }, API_KEY_SECRET, { 
      algorithm, 
      header: { kid: API_KEY_NAME, nonce: crypto.randomBytes(16).toString('hex') } 
    }
  );
}

// Get Portfolio/Accounts
app.get('/api/portfolio', async (req, res) => {
  try {
    const apiPath = '/api/v3/brokerage/accounts';
    const token = generateCoinbaseToken('GET', apiPath);
    
    if (!token) throw new Error("Coinbase API credentials missing on server");

    const response = await axios.get(`https://api.coinbase.com${apiPath}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const accounts = response.data.accounts
      .filter(a => parseFloat(a.available_balance.value) > 0)
      .map(a => ({ 
        currency: a.currency, 
        balance: a.available_balance.value,
        name: a.name 
      }));
      
    res.json({ success: true, accounts });
  } catch (error) {
    console.error("Portfolio Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute Trade (Market Order)
app.post('/api/trade', async (req, res) => {
  const { symbol, side, amount } = req.body;
  try {
    const apiPath = '/api/v3/brokerage/orders';
    const token = generateCoinbaseToken('POST', apiPath);
    
    const product_id = `${symbol}-USDT`;
    const client_order_id = crypto.randomBytes(16).toString('hex');
    
    const orderConfig = side === 'BUY' 
      ? { market_market_ioc: { quote_size: amount } }
      : { market_market_ioc: { base_size: amount } };

    const response = await axios.post(`https://api.coinbase.com${apiPath}`, {
      client_order_id,
      product_id,
      side,
      order_configuration: orderConfig
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    res.json({ success: true, order: response.data });
  } catch (error) {
    console.error("Trade Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', engine: 'NovaTrade-AI' }));

// Static Serving - این بخش برای لود شدن فرانت‌ند ضروری است
const rootPath = path.resolve(__dirname);
app.use(express.static(rootPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.join(rootPath, 'index.html'));
});

// Railway و Localhost هر دو از این پورت استفاده می‌کنند
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NOVATRADE AI SERVER RUNNING ON PORT ${PORT}`);
});
