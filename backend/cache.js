const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 36000 }); // 10h por defecto
module.exports = cache;
