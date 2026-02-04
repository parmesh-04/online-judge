require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ROOT ROUTE
app.get('/', (req, res) => {
  res.send('compiler service running');
});

// ROUTES


module.exports = app;

if (require.main === module) {
  app.listen(8000, () => console.log(`Compiler running on 8000`));
}