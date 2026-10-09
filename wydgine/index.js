import { renderField } from './form-renderer.js';
import { marked, Renderer } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { loadRepository } from './repository.js';
import { skinAttribute, renderSkinCss } from './skins.js';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const validId = value => typeof value === 'string' && /^[a-zA-Z][\w-]*$/.test(value);
const ordered = nodes => [...nodes].sort((a,b) => (Number.isFinite(a?.order) ? a.order : 0) - (Number.isFinite(b?.order) ? b.order : 0));
const safeExternal = url => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new Error('External links require an http(s) URL');
  return new URL(url).href;
};

const markdownRenderer=new Renderer();markdownRenderer.html=()=>'';
export function renderMarkdown(value) {
  if (typeof value !== 'string') throw new Error('Markdown content must be a string');
  return sanitizeHtml(marked.parse(value, { async: false, gfm: true, renderer: markdownRenderer }), {
    allowedTags: ['p','br','hr','h1','h2','h3','h4','h5','h6','strong','em','del','s','blockquote','ul','ol','li','pre','code','a','table','thead','tbody','tr','th','td','caption','sup','sub','dl','dt','dd'],
    allowedAttributes: { a: ['href','title'], ol: ['start'], th: ['align'], td: ['align'] },
    allowedSchemes: ['http','https','mailto'], allowProtocolRelative: false
  });
}

function resolve(instance, expected, model) {
  if (!instance || typeof instance !== 'object' || Array.isArray(instance)) throw new Error(`Invalid ${expected} instance`);
  const definition = model.prototypes.get(instance.prototype);
  if (!definition) throw new Error(`Unknown prototype: ${instance.prototype}`);
  if (instance.prototype !== expected) throw new Error(`Expected ${expected}, received ${instance.prototype}`);
  const node = { ...instance };
  for (const [name, rule] of Object.entries(definition.properties)) {
    if (node[name] === undefined && Object.hasOwn(rule, 'default')) node[name] = structuredClone(rule.default);
    if (node[name] === undefined) { if (rule.required) throw new Error(`Missing ${expected}.${name}`); continue; }
    const value = node[name];
    const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    if (type !== rule.type || (type === 'number' && !Number.isFinite(value))) throw new Error(`Invalid ${expected}.${name}`);
    if (rule.enum && !rule.enum.includes(value)) throw new Error(`Unsupported ${expected}.${name}: ${value}`);
  }
  if (!validId(node.id)) throw new Error(`Invalid ${expected} id`);
  for (const [key, value] of Object.entries(node.format)) {
    if (!definition.format[key]?.includes(value)) throw new Error(`Unsupported format ${key}: ${value}`);
  }
  return node;
}
const classes = node => Object.entries(node.format).map(([key,value]) => `wyd-${key}-${value}`).concat(`wyd-position-${node.position}`).join(' ');
const attrs = node => `id="${escapeHtml(node.id)}" class="${classes(node)}"`;
const placeholder = () => '<p class="wyd-error" role="status">This content is temporarily unavailable.</p>';

export function pagePath(page, site) { return page.id === site.home ? '/' : `/${page.slug}/`; }

function anchorsOnPage(page) {
  return new Set((page.sections || []).flatMap(s => [s.id, ...(s.blocks || []).flatMap(b => [b.id, ...(b.anchors || [])])]));
}
export function resolveLink(item, currentPage, model) {
  if (Object.hasOwn(item, 'url')) return safeExternal(item.url);
  const page = item.page ? model.pages.get(item.page) : currentPage;
  if (!page || !model.site.pages.includes(page.id)) throw new Error(`Unknown navigation page: ${item.page}`);
  if (item.section && !anchorsOnPage(page).has(item.section)) throw new Error(`Unknown section: ${item.section}`);
  if (!item.page && !item.section) throw new Error('Navigation needs a page, section, or URL');
  if (item.section && page.id === currentPage?.id) return `#${encodeURIComponent(item.section)}`;
  return pagePath(page, model.site) + (item.section ? `#${encodeURIComponent(item.section)}` : '');
}

function documentHtml(title, description, body, bodyAttributes = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="stylesheet" href="/css/site.css"><link rel="stylesheet" href="/css/skins.css"></head><body${bodyAttributes}>${body}</body></html>`;
}
export function errorDocument(status = 500) {
  const title = status === 404 ? 'Page not found' : 'Page temporarily unavailable';
  return documentHtml(title, '', `<main class="error-page"><h1>${title}</h1><p>${status === 404 ? 'We could not find that page.' : 'Please try again later.'}</p><a href="/">Return to home</a></main>`);
}

// Pure rendering API: accepts an in-memory model, knows nothing about the host adapter or HTTP.
export function renderSite(model, requestPath = '/', {csrf=''} = {}) {
  const diagnostics = [...(model.diagnostics || [])];
  const guard = fn => { try { return fn(); } catch (error) { diagnostics.push(error.message); return placeholder(); } };
  try {
    const site = resolve(model.site, 'site', model);
    const siteSkin = skinAttribute(site, model);
    if (!Array.isArray(model.navigation)) throw new Error('Navigation must be an array');
    if (!model.pages.has(site.home)) throw new Error('Home page not found');
    const pageRoutes = new Map();
    for (const id of site.pages) {
      const page = model.pages.get(id);
      if (!page) throw new Error(`Missing page: ${id}`);
      if (typeof page.slug !== 'string' || (page.slug && !/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(page.slug))) throw new Error(`Invalid page slug: ${id}`);
      const route = pagePath(page, site).replace(/\/$/, '') || '/';
      if (pageRoutes.has(route)) throw new Error(`Duplicate page route: ${route}`);
      pageRoutes.set(route, page);
    }
    const rawPage = pageRoutes.get(requestPath.replace(/\/$/, '') || '/');
    if (!rawPage) return { status: 404, html: errorDocument(404), diagnostics };
    const page = resolve(rawPage, 'page', model);
    const pageSkin = skinAttribute(page, model);
    const usedIds = new Set(['main']);
    const claim = id => { if (usedIds.has(id)) throw new Error(`Duplicate anchor: ${id}`); usedIds.add(id); };
    function navigation(raw) {
      return guard(() => {
        const nav = resolve(raw, 'navigation', model);
        const list = items => `<ul>${items.map(item => guard(() => {
          const href = resolveLink(item, page, model);
          const current = item.page === page.id && !item.section ? ' aria-current="page"' : '';
          const link = `<a href="${escapeHtml(href)}"${current}>${escapeHtml(item.label)}</a>`;
          return `<li>${link}${item.items?.length ? `<details><summary aria-label="More ${escapeHtml(item.label)}"><span aria-hidden="true">⌄</span></summary>${list(item.items)}</details>` : ''}</li>`;
        })).join('')}</ul>`;
        return `<nav aria-label="${escapeHtml(nav.label)}" class="${classes(nav)}">${nav.position === 'aside' ? `<h2>${escapeHtml(nav.label)}</h2>` : ''}${list(nav.items)}</nav>`;
      });
    }
    function block(raw) {
      if(raw.prototype==='field')return renderField(raw,escapeHtml,claim);
      if(raw.prototype==='section')return nestedSection(raw);
      if(raw.prototype==='form'){const presentation=resolve({...raw,prototype:'section'},'section',model);claim(raw.id);return `<form class="${classes(presentation)}"${skinAttribute(presentation,model)} id="${escapeHtml(raw.id)}" method="post" data-wydgit="${escapeHtml(raw.id)}"><input type="hidden" name="_target" value="${escapeHtml(raw.id)}"><input type="hidden" name="_action" value="Submit"><input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">${raw.content?.value?renderMarkdown(raw.content.value):''}${sectionContent(presentation)}${(raw.fields??[]).map(block).join('')}<button type="submit">${escapeHtml(raw.label)}</button></form>`;}
      return guard(() => {
        const node = resolve(raw, 'block', model);
        const allowed = model.prototypes.get('block').properties.content['supported-types'];
        if (!allowed.includes(node.content.type) || node.content.type !== 'markdown') throw new Error(`Unknown content type: ${node.content.type}`);
        let markup = renderMarkdown(node.content.value);
        const skin = skinAttribute(node, model);
        const presentation = node.format.presentation;
        let href;
        if (node.linkToPage !== undefined) {
          if (!['card', 'whole-card-link'].includes(presentation)) throw new Error('linkToPage requires card or whole-card-link');
          if (!node.linkToPage) throw new Error('linkToPage requires a page ID');
          href = resolveLink({ page: node.linkToPage }, page, model);
        }
        if (presentation === 'whole-card-link') {
          if (!href) throw new Error('whole-card-link requires linkToPage');
          // Preserve linked text while removing inner links: an anchor cannot contain anchors.
          markup = sanitizeHtml(markup, { allowedTags: sanitizeHtml.defaults.allowedTags.filter(tag => tag !== 'a'), allowedAttributes: {} });
        }
        const ids = [node.id, ...node.anchors];
        if (ids.some(id => !validId(id) || usedIds.has(id)) || new Set(ids).size !== ids.length) throw new Error(`Invalid or duplicate block anchors: ${node.id}`);
        ids.forEach(claim);
        const tag = presentation === 'whole-card-link' ? 'a' : node.position === 'aside' ? 'aside' : node.position === 'header' ? 'header' : node.position === 'footer' ? 'footer' : 'div';
        return `<${tag} ${attrs(node)}${skin}${tag === 'a' ? ` href="${escapeHtml(href)}"` : ''}>${node.anchors.map(id => `<span id="${escapeHtml(id)}" class="anchor"></span>`).join('')}${markup}${(raw.children??[]).map(block).join('')}${presentation === 'whole-card-link' ? '<span class="card-arrow" aria-hidden="true">↗</span>' : href ? `<a class="card-page-link" href="${escapeHtml(href)}">Explore ${escapeHtml(model.pages.get(node.linkToPage).title)} <span aria-hidden="true">↗</span></a>` : ''}</${tag}>`;
      });
    }
    function sectionContent(raw) {
      const children=model.prototypes.get('section').children;if(children.prototype!=='block')throw new Error('Unsupported section child prototype');
      const blocks=ordered(raw[children.property]??[]);
      if(raw.format?.layout==='columns'&&blocks.some(b=>b?.format?.column)){
        const groups=[];
        for(const child of blocks){const column=child?.format?.column||'left';if(!['left','right','full'].includes(column))throw new Error(`Unsupported column: ${column}`);if(groups.at(-1)?.column!==column)groups.push({column,blocks:[]});groups.at(-1).blocks.push(child);}
        return groups.map(group=>`<div class="wyd-column-${group.column}">${group.blocks.map(block).join('')}</div>`).join('');
      }
      return blocks.map(block).join('');
    }
    function nestedSection(raw){return guard(()=>{const node=resolve(raw,'section',model);claim(node.id);return `<section ${attrs(node)}${skinAttribute(node,model)}>${sectionContent(node)}</section>`;});}
    const pageChildren=model.prototypes.get('page').children;
    if(pageChildren.prototype!=='section')throw new Error('Unsupported page child prototype');
    const orderedSections=ordered(page[pageChildren.property]);
    const renderedSections=orderedSections.map(raw=>raw.prototype==='form'?block(raw):nestedSection(raw));
    const headerCount = orderedSections.findIndex(section => section.position !== 'header');
    const introCount = headerCount === -1 ? orderedSections.length : headerCount;
    const introduction = renderedSections.slice(0, introCount).join('');
    const sections = renderedSections.slice(introCount).join('');
    const navs = site.navigation.map(id => model.navigation.find(n => n.id === id) || { id, prototype: 'missing' });
    const headerNav = navs.filter(n => !['footer','aside'].includes(n.position)).map(navigation).join('');
    const footerNav = navs.filter(n => n.position === 'footer').map(navigation).join('');
    const asideNav = navs.filter(n => n.position === 'aside').map(navigation).join('');
    const toc = page.navigation ? navigation(page.navigation) : '';
    const html = documentHtml(`${page.title} — ${site.title}`, page.description,
      `<a class="skip" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="/">${site.logoText ? `<span class="brand-mark" aria-hidden="true">${escapeHtml(site.logoText)}</span>` : ''}${escapeHtml(site.title)}</a><span class="tagline">${escapeHtml(site.tagline)}</span>${headerNav ? `<div class="desktop-navigation">${headerNav}</div><details class="mobile-navigation"><summary>Menu</summary>${headerNav}</details>` : ''}</header><main id="main"${pageSkin} class="${classes(page)}"><article>${introduction}${toc || asideNav ? `<div class="reading-layout"><aside class="toc">${toc}${asideNav}</aside><div class="reading-content">${sections}</div></div>` : sections}</article></main><footer class="site-footer"><a class="brand" href="/">${escapeHtml(site.title)}</a><p>${escapeHtml(site.tagline)}</p>${footerNav}<p>${escapeHtml(site.footer)}</p><small>${escapeHtml(site.revision)}</small></footer>`, siteSkin);
    return { status: 200, html, diagnostics };
  } catch (error) {
    diagnostics.push(error.message);
    return { status: 500, html: errorDocument(), diagnostics };
  }
}

// Files are reread per render in this alpha: editing JSON requires no server restart.
export function createRenderer({ root }) {
  return { renderStyles() { return renderSkinCss(loadRepository(root)); }, renderPage(pathname = '/') {
    try { return renderSite(loadRepository(root), pathname); }
    catch (error) { return { status: 500, html: errorDocument(), diagnostics: [error.message] }; }
  } };
}
