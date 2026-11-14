// Runs the API against a throwaway in-memory MongoDB with demo data.
// Handy when MongoDB is not installed locally. Data is lost on restart.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { start } from '../index.js';
import { seed } from './seed.js';

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri('teamflow');
console.log('[db] in-memory MongoDB started (data resets on restart)');
await start(uri);
await seed();

const stop = async () => {
  await mongod.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
