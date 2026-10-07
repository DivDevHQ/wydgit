import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadLibraries } from '../wydgine/libraries/index.js';
import { ExecutionContext } from '../wydgine/seam/context.js';
import { createStores } from '@wydgit/store/client';
import platform from '../package.json' with {type:'json'};
export const project = path.resolve(import.meta.dirname,'..');
export const caps = ['read','create','write','delete'].map(a=>`store.records.${a}`);
export const context = (extra={}) => new ExecutionContext({publisher:'acme',package:'acme/demo',app:'appA',self:'card',capabilities:caps,scopes:{wydstore:[{store:'main',collection:'users'}]},...extra});
export const reject = (fn,code) => assert.rejects(fn,e=>e.code===code,code);
export const definition = (root,provider='json') => ({id:'main',app:'appA',publisher:'acme',package:'acme/demo',provider,root,collections:[{id:'users',fields:{name:{type:'string',required:true},active:{type:'boolean',default:true},score:{type:'number'},info:{type:'object'},tags:{type:'array'},nothing:{type:'null'}}}]});
export const config = store => ({schema:'wydgit.host/0.1',libraries:[{id:'wydstore',package:'@wydgit/store',enabled:true,version:'^0.1.0-alpha.2',publisher:'wydgit.core',trust:'canonical',options:{stores:Array.isArray(store)?store:[store]}}]});
export const load = store => loadLibraries({config:config(store),root:project,platformVersion:platform.version});
export async function temp(t) { const root=await fs.mkdtemp(path.join(os.tmpdir(),'wydstore-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root; }
export async function fixture(t,provider='json') { const root=await temp(t),store=definition(root,provider),registry=await load(store),ctx=context();return {root,store,registry,ctx,collection:createStores(registry.bind(ctx)).get('main').collection('users')}; }
export async function file(root,extension='.json') { return path.join(root,(await fs.readdir(root)).find(n=>n.endsWith(extension))); }

