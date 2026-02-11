
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// Log incoming requests for easier debugging
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  if (req.path.startsWith('/api/')) {
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
  }
  next();
});

// Coinbase Credentials
const API_KEY_NAME = process.env.COINBASE_KEY_NAME || "organizations/d90bac52-0e8a-4999-b156-7491091ffb5e/apiKeys/4d47d3ab-fd33-464e-8081-e464b1ef9f8e";
const API_KEY_SECRET = (process.env.COINBASE_PRIVATE_KEY || "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIORQVYEalCopdxdRRC2vJmPj9tPdFpmCk+EMpviOS+AvoAoGCCqGSM49\nAwEHoUQDQgAE6+0uPUC3/2PBlMKS9KSBdHTeWJRE5ZV4tGaOcny2Ru9VqFfchyby\nmuvu1NmHueYqY+qAoqrEOM5ALj8pfT8OZg==\n-----END EC PRIVATE KEY-----").replace(/\\n/g, '\n');

/**
 * Generate Coinbase JWT for Authentication
 */
function generateCoinbaseToken(method, path) {
  const algorithm = 'ES256';
  const uri = `any:${method} coinbase.com${path}`;
  
  const token = jwt.sign(
    {
      iss: 'coinbase-cloud',
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120,
      sub: API_KEY_NAME,
      uri: uri,
    },
    API_KEY_SECRET,
    { 
      algorithm, 
      header: { 
        kid: API_KEY_NAME, 
        nonce: crypto.randomBytes(16).toString('hex') 
      } 
    }
  );
  
  return token;
}

// --- API Endpoints ---

app.get('/api/portfolio', async (req, res) => {
  try {
    const apiPath = '/api/v3/brokerage/accounts';
    const token = generateCoinbaseToken('GET', apiPath);
    
    const response = await axios.get(`https://api.coinbase.com${apiPath}`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (!response.data || !response.data.accounts) {
        throw new Error("Invalid response from Coinbase API");
    }

    const accounts = response.data.accounts
      .filter(a => parseFloat(a.available_balance.value) > 0)
      .map(a => ({
        currency: a.currency,
        balance: a.available_balance.value,
        hold: a.hold.value
      }));

    res.json({ success: true, accounts });
  } catch (error) {
    const msg = error.response?.data?.message || error.message || 'Failed to fetch portfolio';
    console.error(`[API ERROR] Portfolio: ${msg}`);
    res.status(500).json({ success: false, error: msg });
  }
});

app.post('/api/trade', async (req, res) => {
  const { symbol, side, amount, product_id } = req.body;
  try {
    const apiPath = '/api/v3/brokerage/orders';
    const token = generateCoinbaseToken('POST', apiPath);
    
    const orderData = {
      client_order_id: crypto.randomBytes(16).toString('hex'),
      product_id: product_id || `${symbol}-USDT`,
      side: side, // BUY or SELL
      order_configuration: {
        market_market_ioc: {
          quote_size: side === 'BUY' ? amount : undefined,
          base_size: side === 'SELL' ? amount : undefined,
        }
      }
    };

    const response = await axios.post(`https://api.coinbase.com${apiPath}`, orderData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ success: true, order: response.data });
  } catch (error) {
    const msg = error.response?.data || error.message;
    console.error(`[API ERROR] Trade:`, msg);
    res.status(500).json({ success: false, error: msg });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime() });
});

// --- Static File Serving ---

// Configure MIME types for TS/TSX files
express.static.mime.define({'application/javascript': ['ts', 'tsx']});

const rootPath = path.resolve(__dirname);
app.use(express.static(rootPath));

// Final Catch-All: Handle SPA routing or return API 404s
app.get('*', (req, res) => {
  // Check if it's an API call that missed its route
  if (req.path.startsWith('/api/')) {
    console.warn(`[404] Missing API Endpoint: ${req.path}`);
    return res.status(404).json({ 
      success: false, 
      error: `API Route Not Found: ${req.path}. Check your server.js route definitions.` 
    });
  }
  
  // Serve index.html for all other requests (SPA support)
  const indexPath = path.join(rootPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error(`[FATAL] index.html not found at ${indexPath}`);
      res.status(404).send("Front-end entry point (index.html) was not found on the server. Please ensure it is in the same directory as server.js.");
    }
  });
});

// Port Handling
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 NOVATRADE ENGINE: ACTIVE`);
    console.log(`🔗 Local Terminal: http://localhost:${PORT}`);
    console.log(`📡 Deployment: Ready for Railway/Cloud\n`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ ERROR: Port ${PORT} is already in use by another process.`);
      process.exit(1);
    } else {
      console.error(`[CRITICAL ERROR]`, err);
    }
});
