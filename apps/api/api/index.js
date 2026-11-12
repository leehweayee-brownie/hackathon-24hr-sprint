// Vercel Function: every path is rewritten here (vercel.json). The compiled Nest app lives in dist/.
module.exports = require('../dist/serverless.js').default;
