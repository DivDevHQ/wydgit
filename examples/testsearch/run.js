import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSearchExample } from './setup.js';
import { createApp } from '../../app.js';
// Disposable local acceptance demo; existing site files are never rewritten.
const root=await fs.mkdtemp(path.join(os.tmpdir(),'wydgit-search-demo-'));
const {libraries}=await createSearchExample(root,process.env.WYDSEARCH_ADAPTER??'json');
const app=createApp({root,libraries});
app.listen(Number(process.env.PORT??3001),'127.0.0.1',()=>console.log('Search demo: http://127.0.0.1:'+(process.env.PORT??3001)+'/search/?q=Wydgit'));
