import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

async function compress(directory) {
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    const path=join(directory,entry.name);
    if (entry.isDirectory()) {await compress(path);continue;}
    if (!/\.(html|js|css|svg)$/.test(path)) continue;
    const data=await readFile(path);
    if(data.length<1024)continue;
    await Promise.all([writeFile(path+'.br',brotliCompressSync(data)),writeFile(path+'.gz',gzipSync(data,{level:9}))]);
  }
}
await compress('apps/client/dist');
