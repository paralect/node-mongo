import { ObjectID } from 'mongodb';

const generateId = () => {
  const objectId = new ObjectID();
  return objectId.toHexString();
};

export { generateId };
