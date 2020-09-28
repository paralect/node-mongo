const monk = require('monk');

module.exports = () => monk.id().toHexString();
