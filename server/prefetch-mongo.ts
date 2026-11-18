import { MongoBinary } from 'mongodb-memory-server';

async function main() {
  if (process.env.MONGODB_URI?.trim()) {
    console.log('External MONGODB_URI configured; skipping embedded MongoDB binary prefetch.');
    return;
  }

  try {
    const binPath = await MongoBinary.getPath();
    console.log('Embedded MongoDB binary ready:', binPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Embedded MongoDB binary prefetch skipped:', msg);
  }
}

main();
