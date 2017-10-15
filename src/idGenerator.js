const monk = require('monk');

exports.generate = () => {
  return monk.id().toHexString();
};
