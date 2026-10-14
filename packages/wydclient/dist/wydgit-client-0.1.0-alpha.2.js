/* WydClient 0.1.0-alpha.2; WydSUB 0.1; MPL-2.0 */
(() => {
  // wydgine/object-model/validation.js
  var WydgitError = class extends Error {
    constructor(code, message, details = {}) {
      super(message);
      this.code = code;
      this.details = details;
    }
    toJSON() {
      return { ok: false, code: this.code, message: this.message, details: this.details };
    }
  };
  function requireThat(ok, code, message) {
    if (!ok) throw new WydgitError(code, message);
  }
  var record = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  function freeze(x) {
    if (x && typeof x === "object") {
      Object.values(x).forEach(freeze);
      Object.freeze(x);
    }
    return x;
  }
  function jsonKeys(value) {
    requireThat(value && typeof value === "object", "INPUT.JSON", "Expected JSON container");
    const array = Array.isArray(value);
    requireThat(array ? Object.getPrototypeOf(value) === Array.prototype : [Object.prototype, null].includes(Object.getPrototypeOf(value)), "INPUT.JSON", "Expected plain JSON data");
    const keys = Reflect.ownKeys(value).filter((k) => !(array && k === "length"));
    requireThat(keys.every((k) => typeof k === "string"), "INPUT.JSON", "Symbol keys are not JSON");
    requireThat(!array || keys.length === value.length && keys.every((k, i) => k === String(i)), "INPUT.JSON", "Expected dense JSON array");
    requireThat(keys.every((k) => {
      const d = Object.getOwnPropertyDescriptor(value, k);
      return d.enumerable && Object.hasOwn(d, "value");
    }), "INPUT.JSON", "Expected enumerable JSON data");
    return keys;
  }
  function clean(value, active = /* @__PURE__ */ new Set(), depth = 0) {
    requireThat(depth <= 128, "INPUT.LIMIT", "JSON nesting limit exceeded");
    if (value === null || ["string", "boolean"].includes(typeof value)) return value;
    if (typeof value === "number") {
      requireThat(Number.isFinite(value), "INPUT.JSON", "Non-finite number");
      return Object.is(value, -0) ? 0 : value;
    }
    requireThat(value && typeof value === "object", "INPUT.JSON", "Expected JSON data");
    requireThat(!active.has(value), "OBJECT.CYCLE", "Cyclic input");
    jsonKeys(value);
    active.add(value);
    const out = Array.isArray(value) ? [] : /* @__PURE__ */ Object.create(null);
    const keys = Object.keys(value);
    if (!Array.isArray(value)) keys.sort();
    for (const key of keys) {
      requireThat(!["__proto__", "constructor", "prototype"].includes(key), "INPUT.DANGEROUS_KEY", `Reserved key: ${key}`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      requireThat(Object.hasOwn(descriptor, "value"), "INPUT.JSON", "Accessors are not JSON");
      out[key] = clean(descriptor.value, active, depth + 1);
    }
    active.delete(value);
    return out;
  }

  // wydgine/object-model/schema.js
  var SCHEMA = "wydgit/0.2";
  var envelopeFields = Object.freeze(["schema", "id", "prototype", "properties", "slots", "provenance"]);
  function resolveProperties(input, definition, { incomplete = false } = {}) {
    const properties = clean(input);
    for (const key of Object.keys(properties)) requireThat(Object.hasOwn(definition.properties, key), "OBJECT.PROPERTY", "Unknown property");
    for (const [key, rule] of Object.entries(definition.properties)) {
      if (!Object.hasOwn(properties, key) && Object.hasOwn(rule, "default")) properties[key] = clean(rule.default);
      if (!Object.hasOwn(properties, key)) {
        requireThat(incomplete || !rule.required, "OBJECT.PROPERTY", "Missing required property");
        continue;
      }
      const v = properties[key], type = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
      requireThat((Array.isArray(rule.type) ? rule.type : [rule.type]).includes(type) && (!rule.enum || rule.enum.includes(v)), "OBJECT.PROPERTY", "Invalid property value");
    }
    if ((definition.id === "wydgit.core/select" || definition.ancestors?.includes("wydgit.core/select")) && properties.multiple && !Object.hasOwn(input, "value") && definition.properties.value.default === null) properties.value = [];
    return properties;
  }

  // packages/wydclient/src/data.js
  var LIMITS = Object.freeze({ bytes: 262144, depth: 32, nodes: 16384, prototypes: 128, packages: 16, timeout: 1e4 });
  function parseJSON(bytes) {
    requireThat(bytes.byteLength <= LIMITS.bytes, "MANIFEST.LIMIT", "Manifest limit exceeded");
    let value;
    try {
      value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      requireThat(false, "MANIFEST.JSON", "Invalid manifest JSON");
    }
    let nodes = 0;
    const walk = (v, depth = 0) => {
      requireThat(depth <= LIMITS.depth && ++nodes <= LIMITS.nodes, "MANIFEST.LIMIT", "Manifest limit exceeded");
      if (v && typeof v === "object") for (const [key, child] of Object.entries(v)) {
        requireThat(!["__proto__", "constructor", "prototype"].includes(key), "MANIFEST.KEY", "Unsafe manifest key");
        walk(child, depth + 1);
      }
    };
    walk(value);
    return clean(value);
  }
  function shape(value, allowed, required = []) {
    requireThat(record(value) && Object.keys(value).every((k) => allowed.includes(k)) && required.every((k) => Object.hasOwn(value, k)), "MANIFEST.SHAPE", "Invalid manifest declaration");
  }
  function decode64(value, length) {
    requireThat(typeof value === "string" && /^[A-Za-z0-9+/]*={0,2}$/.test(value), "PACKAGE.ENCODING", "Invalid cryptographic encoding");
    let bytes;
    try {
      bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    } catch {
      requireThat(false, "PACKAGE.ENCODING", "Invalid cryptographic encoding");
    }
    requireThat(bytes.length === length && btoa(String.fromCharCode(...bytes)) === value, "PACKAGE.ENCODING", "Invalid cryptographic encoding");
    return bytes;
  }

  // packages/wydclient/src/network.js
  async function download(href, host, policy, signal) {
    let url;
    try {
      url = new URL(href, host.location.href);
    } catch {
      requireThat(false, "NETWORK.URL", "Invalid manifest URL");
    }
    requireThat(
      ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.hash,
      "NETWORK.ORIGIN",
      "Manifest origin denied"
    );
    requireThat(url.origin === host.location.origin || policy.allowedOrigins.includes(url.origin), "NETWORK.ORIGIN", "Manifest origin denied");
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(), LIMITS.timeout);
    let reader;
    try {
      const response = await host.fetch(url.href, { credentials: "omit", redirect: "error", mode: "cors", signal: controller.signal });
      requireThat(response.ok && !response.redirected && response.url === url.href, "NETWORK.RESPONSE", "Manifest request failed");
      requireThat(/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get("content-type") ?? ""), "NETWORK.TYPE", "Expected JSON response");
      const length = response.headers.get("content-length");
      requireThat(length === null || /^\d+$/.test(length) && Number(length) <= LIMITS.bytes, "MANIFEST.LIMIT", "Manifest limit exceeded");
      requireThat(response.body?.getReader, "NETWORK.RESPONSE", "Manifest request failed");
      reader = response.body.getReader();
      let size = 0;
      const chunks = [];
      for (; ; ) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        requireThat(size <= LIMITS.bytes, "MANIFEST.LIMIT", "Manifest limit exceeded");
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes;
    } catch (error) {
      const code = typeof error?.code === "string" ? error.code : "";
      if (code === "MANIFEST.LIMIT" || code.startsWith("NETWORK.")) throw error;
      requireThat(false, "NETWORK.FAILED", "Manifest request failed");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (reader) {
        try {
          await reader.cancel();
        } catch {
        }
      }
    }
  }

  // packages/wydclient/src/packages.js
  var publisherPattern = /^[a-z][a-z0-9.-]*$/;
  var identityPattern = /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/;
  var versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  function signedPayload(ref) {
    return new TextEncoder().encode(JSON.stringify(["wydgit.prototype-signature/0.1", ref.publisher, ref.id, ref.version, ref.integrity, ref.algorithm, ref.keyId]));
  }
  async function loadPackage(ref, host, policy, signal) {
    shape(ref, ["id", "publisher", "version", "url", "integrity", "algorithm", "keyId", "signature"], ["id", "publisher", "version", "url", "integrity", "algorithm", "keyId", "signature"]);
    requireThat(identityPattern.test(ref.id) && ref.publisher === ref.id.split("/")[0] && ref.publisher !== "wydgit.core" && versionPattern.test(ref.version), "PACKAGE.IDENTITY", "Invalid package identity");
    requireThat(typeof ref.url === "string" && typeof ref.keyId === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(ref.keyId), "PACKAGE.IDENTITY", "Invalid package identity");
    requireThat(ref.algorithm === "Ed25519" && typeof ref.integrity === "string" && ref.integrity.startsWith("sha256-"), "PACKAGE.ALGORITHM", "Unsupported package algorithm");
    const expected = decode64(ref.integrity.slice(7), 32), signature = decode64(ref.signature, 64);
    const binding = policy.trustedKeys.find((k) => k.publisher === ref.publisher && k.keyId === ref.keyId && k.status === "active");
    requireThat(binding, "PACKAGE.UNTRUSTED_KEY", "Publisher key is not trusted");
    requireThat(host.crypto?.subtle, "PACKAGE.CRYPTO", "Package verification unavailable");
    const bytes = await download(ref.url, host, policy, signal);
    let digest, key, valid;
    try {
      digest = new Uint8Array(await host.crypto.subtle.digest("SHA-256", bytes));
      requireThat(digest.every((b, i) => b === expected[i]), "PACKAGE.INTEGRITY", "Package integrity mismatch");
      key = await host.crypto.subtle.importKey("raw", decode64(binding.publicKey, 32), { name: "Ed25519" }, false, ["verify"]);
      valid = await host.crypto.subtle.verify("Ed25519", key, signature, signedPayload(ref));
    } catch (error) {
      if (error.code === "PACKAGE.INTEGRITY") throw error;
      requireThat(false, "PACKAGE.CRYPTO", "Package verification unavailable");
    }
    requireThat(valid, "PACKAGE.SIGNATURE", "Invalid publisher signature");
    const pkg = parseJSON(bytes);
    shape(pkg, ["schema", "id", "publisher", "version", "prototypes"], ["schema", "id", "publisher", "version", "prototypes"]);
    requireThat(pkg.schema === "wydgit.prototype-package/0.1" && pkg.id === ref.id && pkg.publisher === ref.publisher && pkg.version === ref.version && Array.isArray(pkg.prototypes), "PACKAGE.CONTENT", "Package declaration mismatch");
    requireThat(pkg.prototypes.every((d) => d.publisher === ref.publisher && identityPattern.test(d.id) && d.id.split("/")[0] === ref.publisher), "PACKAGE.CONTENT", "Package namespace mismatch");
    return pkg.prototypes;
  }

  // wydgine/sewn/schema.js
  var SCHEMA2 = "sewn/0.1";
  var MAXIMA = Object.freeze({ steps: 1e4, expressionDepth: 32, nesting: 16, iterations: 1e3, variables: 64, valueNodes: 4096, string: 16384, serviceCalls: 32, procedureCalls: 256, procedureDepth: 16, parameters: 16, drafts: 64, draftDepth: 32, draftNodes: 256, constructionOperations: 512, constructionSize: 65536, regexPattern: 256, regexInput: 4096, regexCaptures: 8, regexMatches: 128, regexOutput: 16384, regexDepth: 16, regexRepeat: 32, regexAtoms: 128, regexInstructions: 512, regexWork: 1e6, timeMs: 1e3, programNodes: 8192, programSize: 65536 });
  var statements = Object.freeze({ declare: ["name", "value"], set: ["name", "value"], if: ["condition", "then", "else?"], forEach: ["name", "items", "body"], call: ["target", "method", "args", "into?"], service: ["library", "method", "input", "into?"], return: ["value"], stop: ["value?"] });
  var expressions = Object.freeze({ array: ["items"], object: ["fields"], literal: ["value"], variable: ["name"], context: ["name"], read: ["target", "key"], invoke: ["target", "method", "args"], binary: ["operator", "left", "right"], not: ["value"] });
  var operators = ["=", "!=", "<", "<=", ">", ">=", "AND", "OR", "+", "-", "*", "/", "concat"];
  var contextNames = ["ME", "EVENT", "REQUEST", "RESPONSE", "SESSION", "PAGE", "SERVER", "CLIENT"];
  var safeKey = (k) => typeof k === "string" && !["__proto__", "constructor", "prototype"].includes(k);
  var PROCEDURE_SCHEMA = "sewn/0.2";
  var sourceTypes = Object.freeze(["String", "Number", "Boolean", "Null", "Array", "Object", "Wydgit"]);
  var procedureStatements = Object.freeze({ ...statements, procedureCall: ["name", "args"], return: ["value?"] });
  var procedureExpressions = Object.freeze({ ...expressions, functionCall: ["name", "args"], serviceCall: ["library", "method", "input"] });
  var reservedNames = Object.freeze([...contextNames, "SERVICES", "NEWID", "DIM", "AS", "SET", "IF", "THEN", "ELSE", "ELSEIF", "END", "FOR", "EACH", "IN", "NEXT", "RETURN", "STOP", "TRUE", "FALSE", "NULL", "AND", "OR", "NOT", "SUB", "FUNCTION", "CALL", "EVENT", "MODULE", "ASYNC", "AWAIT", "GOTO", "REM", "DO", "LOOP", "WHILE", "SELECT", "TRY", "CATCH", "THROW", "ON", "CLASS", "NEW", "IMPORT", "BYREF", "OPTIONAL", "PARAMARRAY", "PROCESS", "GLOBALTHIS", "WINDOW", "DOCUMENT", "REQUIRE", "EVAL", "FS", "CHILD_PROCESS"]);
  var OBJECT_SCHEMA = "sewn/0.3";
  var objectStatements = Object.freeze({ ...procedureStatements, methodCall: ["target", "name", "args"] });
  var objectExpressions = Object.freeze({ ...procedureExpressions, methodValue: ["target", "name", "args"], construct: ["type", "id"], newId: [] });
  var SERVICE_SCHEMA = "sewn/0.4";
  var serviceStatements = Object.freeze({ ...objectStatements, canonicalService: ["library", "apiVersion", "method", "input", "into?"] });
  var serviceExpressions = Object.freeze({ ...objectExpressions, canonicalServiceCall: ["library", "apiVersion", "method", "input"] });
  var MEMBER_SCHEMA = "sewn/0.5";
  var memberStatements = Object.freeze({ ...serviceStatements, memberSet: ["target", "name", "value", "exact"], methodCall: ["target", "name", "args", "exact?"] });
  var memberExpressions = Object.freeze({ ...serviceExpressions, memberRead: ["target", "name", "exact"], methodValue: ["target", "name", "args", "exact?"] });
  var CONTROL_SCHEMA = "sewn/0.6";
  var controlStatements = Object.freeze({ ...memberStatements, exitFor: [] });
  var controlExpressions = Object.freeze({ ...memberExpressions, isNull: ["value", "negate"] });
  var controlReservedNames = Object.freeze([...reservedNames, "IS", "EXIT"]);
  var CONVERSION_SCHEMA = "sewn/0.7";
  var conversionExpressions = Object.freeze({ ...controlExpressions, convert: ["type", "value"] });
  var conversionReservedNames = Object.freeze([...controlReservedNames, "CSTR", "VAL"]);
  var EXCEPTION_SCHEMA = "sewn/0.8";
  var exceptionStatements = Object.freeze({ ...controlStatements, try: ["body", "catch?", "finally?"] });
  var exceptionReservedNames = Object.freeze([...conversionReservedNames, "FINALLY"]);
  var SELECTION_SCHEMA = "sewn/0.9";
  var selectionStatements = Object.freeze({ ...exceptionStatements, select: ["value", "cases", "else?"] });
  var selectionExpressions = Object.freeze({ ...conversionExpressions, identity: ["left", "right", "negate"] });
  var selectionReservedNames = Object.freeze([...exceptionReservedNames]);
  var NUMERIC_SCHEMA = "sewn/0.10";
  var numericTypes = Object.freeze([...sourceTypes, "Integer", "Float"]);
  var numericExpressions = Object.freeze({ ...selectionExpressions, numeric: ["operator", "left", "right", "type"], numericCheck: ["type", "value"], numericPredicate: ["predicate", "value"], xor: ["left", "right"] });
  var numericReservedNames = Object.freeze([...selectionReservedNames, "ISINTEGER", "ISSAFEINTEGER"]);
  var CONTRACT_SCHEMA = "sewn/0.11";
  var contractTypes = Object.freeze([...numericTypes, "Scalar", "DataType", "DateTime"]);
  var contractExpressions = Object.freeze({ ...numericExpressions, typeLiteral: ["type"], typeOf: ["value"], dateTime: ["value"], typeCheck: ["type", "value"] });
  var contractReservedNames = Object.freeze([...numericReservedNames, "SCALAR", "DATATYPE", "DATETIME", "TYPEOF"]);
  var OPERATION_SCHEMA = "sewn/0.12";
  var operationSignatures = Object.freeze({
    Length: ["String"],
    Substring: ["String", "Integer", "Integer"],
    IndexOf: ["String", "String"],
    LastIndexOf: ["String", "String"],
    StartsWith: ["String", "String"],
    EndsWith: ["String", "String"],
    Contains: ["String", "String"],
    ToUpper: ["String"],
    ToLower: ["String"],
    Trim: ["String"],
    TrimStart: ["String"],
    TrimEnd: ["String"],
    Replace: ["String", "String", "String"],
    Repeat: ["String", "Integer"],
    Abs: ["Number"],
    Floor: ["Number"],
    Ceiling: ["Number"],
    Truncate: ["Number"],
    Round: ["Number", "Integer"],
    Min: ["Number", "Number"],
    Max: ["Number", "Number"],
    Power: ["Number", "Number"],
    Sqrt: ["Number"],
    Sign: ["Number"]
  });
  var conversionTargets = Object.freeze(["String", "Integer", "Float", "Number", "Boolean", "DateTime"]);
  var operationExpressions = Object.freeze({ ...contractExpressions, convert: ["type", "value", "mode?"], operation: ["name", "args"] });
  var operationReservedNames = Object.freeze([...contractReservedNames, "CONVERT", ...Object.keys(operationSignatures).map((x) => x.toUpperCase())]);
  var COLLECTION_SCHEMA = "sewn/0.13";
  var collectionSignatures = Object.freeze({
    ...operationSignatures,
    Length: ["Collection"],
    Contains: ["Collection", "Value"],
    IndexOf: ["Collection", "Value"],
    Slice: ["Array", "Integer", "Integer"],
    Join: ["Array", "String"],
    Split: ["String", "String"]
  });
  var constantTypes = Object.freeze(["String", "Number", "Integer", "Float", "Boolean", "Null", "Scalar", "DateTime", "DataType"]);
  var collectionExpressions = Object.freeze({ ...operationExpressions, index: ["target", "index"] });
  var collectionStatements = Object.freeze({ ...selectionStatements, constant: ["name", "type", "value"], forNumeric: ["name", "start", "end", "step", "body"] });
  var collectionReservedNames = Object.freeze([...operationReservedNames, "SLICE", "JOIN", "SPLIT", "CONST", "TO", "STEP"]);
  var STATIC_SCHEMA = "sewn/0.14";
  var REGEX_SCHEMA = "sewn/0.15";
  var regexSignatures = Object.freeze({ RegexTest: ["String", "String", "String"], RegexMatch: ["String", "String", "String"], RegexMatches: ["String", "String", "String"], RegexReplace: ["String", "String", "String", "String"], RegexSplit: ["String", "String", "String"] });
  var regexOperationSignatures = Object.freeze({ ...collectionSignatures, ...regexSignatures });
  var regexReservedNames = Object.freeze([...collectionReservedNames, ...Object.keys(regexSignatures).map((x) => x.toUpperCase())]);
  var DO_SCHEMA = "sewn/0.16";
  var doStatements = Object.freeze({ ...collectionStatements, do: ["mode", "condition", "body"], exitDo: [] });
  var doReservedNames = Object.freeze([...regexReservedNames, "UNTIL"]);
  var INTERFACE_SCHEMA = "sewn/0.17";
  var interfaceExpressions = Object.freeze({ ...collectionExpressions, implements: ["value", "type"], cast: ["value", "type"] });
  var interfaceStatements = Object.freeze({ ...doStatements, declare: ["name", "value", "type?"], set: ["name", "value", "type?"] });
  var interfaceReservedNames = Object.freeze([...doReservedNames, "INTERFACE", "IMPLEMENTS", "CAST"]);

  // wydgine/object-model/interfaces.js
  var interfaceType = (t) => typeof t === "string" && /^interface:[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(t);
  var interfaceKey = (d) => `interface:${d.id}@${d.version}`;
  function validateInterface(input) {
    const d = clean(input), allowed = ["id", "publisher", "interface", "alias", "version", "signatures"];
    requireThat(record(d) && Object.keys(d).every((k) => allowed.includes(k)) && d.interface === true, "INTERFACE.DEFINITION", "Expected a declaration-only interface");
    requireThat(typeof d.id === "string" && /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(d.id) && d.publisher === d.id.split("/")[0] && interfaceType(interfaceKey(d)), "INTERFACE.IDENTITY", "Invalid exact interface identity");
    requireThat(typeof d.alias === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.alias) && !contractTypes.some((t) => t.toLowerCase() === d.alias.toLowerCase()) && !doReservedNames.includes(d.alias.toUpperCase()) && !["CAST", "IMPLEMENTS", "INTERFACE"].includes(d.alias.toUpperCase()), "INTERFACE.IDENTITY", "Invalid interface alias");
    requireThat(record(d.signatures) && Object.keys(d.signatures).length > 0 && Object.keys(d.signatures).length <= 64, "INTERFACE.DEFINITION", "Expected method signatures");
    for (const [name2, s] of Object.entries(d.signatures)) {
      requireThat(/^[a-z][a-z0-9_]{0,63}$/.test(name2) && !doReservedNames.includes(name2.toUpperCase()) && record(s) && ["function", "sub"].includes(s.kind) && Object.keys(s).every((k) => ["kind", "params", ...s.kind === "function" ? ["returns"] : []].includes(k)), "INTERFACE.SIGNATURE", "Invalid method signature");
      requireThat(Array.isArray(s.params) && s.params.length <= MAXIMA.parameters && s.params.every((t) => contractTypes.includes(t)) && (s.kind !== "function" || contractTypes.includes(s.returns)), "INTERFACE.SIGNATURE", "Unsupported method contract");
    }
    return freeze(d);
  }
  function sameSignature(signature, procedure) {
    return signature.kind === procedure.kind && signature.params.length === procedure.params.length && signature.params.every((t, i) => t === procedure.params[i].type) && signature.returns === procedure.returns;
  }
  function interfaceTypes(program) {
    const found = /* @__PURE__ */ new Set();
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      if (["cast", "implements", "declare", "set"].includes(n.op) && interfaceType(n.type)) found.add(n.type);
      if (["function", "sub"].includes(n.kind) && Array.isArray(n.params)) {
        for (const p of n.params) if (interfaceType(p.type)) found.add(p.type);
        if (interfaceType(n.returns)) found.add(n.returns);
      }
      if (n.op === "literal") return;
      Object.values(n).forEach(walk);
    };
    walk(program);
    return found;
  }

  // wydgine/seam/capabilities.js
  var isCapability = (value) => typeof value === "string" && /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(value);

  // wydgine/seam/context.js
  var contexts = /* @__PURE__ */ new WeakSet();
  function checkContext(context) {
    requireThat(contexts.has(context), "SEAM.CONTEXT", "Expected host-issued execution context");
  }

  // wydgine/object-model/members.js
  var accessOf = (rule) => rule.access ?? "public";
  var discoverable = (rule) => rule.hidden !== true;
  function validateMember(rule) {
    requireThat(record(rule), "PROTOTYPE.ACCESS", "Invalid member rule");
    requireThat(["public", "private", "protected", "friend"].includes(accessOf(rule)), "PROTOTYPE.ACCESS", "Invalid member access");
    requireThat(rule.requires === void 0 || Array.isArray(rule.requires) && rule.requires.every(isCapability), "PROTOTYPE.ACCESS", "Invalid member capability requirements");
    requireThat(rule.hidden === void 0 || typeof rule.hidden === "boolean", "PROTOTYPE.ACCESS", "Invalid member visibility");
  }
  function resolveMember(definition, kind, name2, exact = true) {
    const table = kind === "property" ? definition.properties : definition.methods;
    const rules = kind === "property" ? definition.properties : definition.methodRules;
    const names = exact ? Object.keys(table).filter((k) => k === name2) : Object.keys(table).filter((k) => k.toLowerCase() === name2.toLowerCase() && discoverable(rules[k] ?? {}));
    requireThat(names.length === 1, names.length > 1 ? "OBJECT.AMBIGUOUS_MEMBER" : kind === "property" ? "OBJECT.PROPERTY" : "PROTOTYPE.METHOD", names.length > 1 ? "Ambiguous member; use exact lookup" : "Unknown member");
    const key = names[0], rule = rules[key] ?? {};
    return { name: key, rule, owner: kind === "property" ? definition.propertyOwners[key] : table[key].owner };
  }
  function checkMemberCapabilities(rule, context) {
    if (rule.requires?.length) {
      checkContext(context);
      for (const capability of rule.requires) context.require(capability);
    }
  }
  function authorizeMember(registry, member, caller = null, context = null) {
    checkMemberCapabilities(member.rule, context);
    const access = accessOf(member.rule), owner = member.owner;
    if (access === "public") return;
    requireThat(caller && (caller === owner || access === "protected" && registry.isA(caller, owner) || access === "friend" && registry.verifiedPublisher(caller) === registry.get(caller).publisher && registry.verifiedPublisher(owner) === registry.get(owner).publisher && registry.get(owner).friends.some((pattern) => pattern === caller || pattern === registry.get(caller).publisher + "/*")), "OBJECT.ACCESS", "Member access denied");
  }

  // wydgine/http/policy.js
  var HTTP_DEFAULTS = Object.freeze({ headerBytes: 8192, headerCount: 64, requestMs: 12e4 });
  var HTTP_CEILINGS = Object.freeze({ headerBytes: 16384, headerCount: 128, requestMs: 3e5 });

  // wydgine/presentation-policy.js
  var PRESENTATION_DEFAULTS = Object.freeze({ componentRequests: 4 });

  // wydgine/components.js
  var blocked = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
  var tags = /* @__PURE__ */ new Set(["section", "div", "p", "span", "h2", "h3", "form", "label", "input", "button", "ol", "ul", "li", "a", "nav", "strong", "audio", "video", "source", "img"]);
  var attributes = /* @__PURE__ */ new Set(["id", "class", "role", "method", "action", "for", "name", "type", "value", "placeholder", "href", "title", "aria-label", "src", "alt", "controls", "preload", "enctype", "accept", "required", "autocomplete", "maxlength"]);
  var ops = /* @__PURE__ */ new Set(["concat", "eq", "not", "and", "or", "if", "length", "add", "subtract", "min", "max", "lt", "gt", "query", "queryValid", "integer", "parameter", "url", "trim"]);
  function validatePresentation(input) {
    const spec = clean(input);
    let nodes = 0;
    const walk = (value, depth = 0) => {
      requireThat(++nodes <= 1024 && depth <= 32, "COMPONENT.INVALID", "Presentation complexity exceeded");
      if (value && typeof value === "object") {
        if (value.op !== void 0) requireThat(ops.has(value.op), "COMPONENT.INVALID", "Unsupported expression");
        if (value.get !== void 0) requireThat(typeof value.get === "string" && value.get.length <= 256 && value.get.split(".").length <= 16 && value.get.split(".").every((p) => !blocked.has(p)), "COMPONENT.INVALID", "Invalid value path");
        if (value.tag !== void 0) {
          requireThat(tags.has(value.tag), "COMPONENT.INVALID", "Unsupported element");
          requireThat(Object.keys(value.attrs ?? {}).every((a) => attributes.has(a)), "COMPONENT.INVALID", "Unsupported attribute");
        }
        Object.values(value).forEach((v) => walk(v, depth + 1));
      }
    };
    requireThat(spec.schema === "wydgit.presentation/0.1" && spec.template, "COMPONENT.INVALID", "Invalid presentation");
    requireThat(Object.keys(spec).every((k) => ["schema", "template", "request", "when", "valid", "submission", "delivery"].includes(k)), "COMPONENT.INVALID", "Unknown presentation field");
    for (const binding of [spec.request, spec.submission, spec.delivery].filter(Boolean)) requireThat(Object.keys(binding).every((k) => ["library", "apiVersion", "operation", "input"].includes(k)) && ["library", "apiVersion", "operation"].every((k) => typeof binding[k] === "string"), "COMPONENT.INVALID", "Invalid service binding");
    walk(spec);
    return spec;
  }

  // wydgine/sewn/validate.js
  var fail = (code) => {
    throw new WydgitError(`SEWN.${code}`, "SEWN execution failed");
  };
  var ensure = (v, code = "INVALID") => {
    if (!v) fail(code);
  };
  var name = (n) => ensure(safeKey(n) && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n));
  function validate(document) {
    let count = 0, characters = 0;
    const seen = /* @__PURE__ */ new Set();
    const preflight = (v, d = 0) => {
      ensure(d <= 64 && ++count <= MAXIMA.programNodes, "LIMIT");
      if (typeof v === "string") {
        characters += v.length;
        ensure(characters <= MAXIMA.programSize, "LIMIT");
      }
      if (v && typeof v === "object") {
        ensure(!seen.has(v));
        seen.add(v);
        let keys;
        try {
          keys = jsonKeys(v);
        } catch {
          fail("INVALID");
        }
        for (const key of keys) {
          ensure(safeKey(key));
          characters += key.length;
          ensure(characters <= MAXIMA.programSize, "LIMIT");
          preflight(Object.getOwnPropertyDescriptor(v, key).value, d + 1);
        }
        seen.delete(v);
      }
    };
    preflight(document);
    let p;
    try {
      p = clean(document);
    } catch {
      fail("INVALID");
    }
    let nodes = 0;
    const size = (v, d = 0) => {
      ensure(d <= 64, "LIMIT");
      ensure(++nodes <= MAXIMA.programNodes, "LIMIT");
      if (v && typeof v === "object") Object.values(v).forEach((x) => size(x, d + 1));
    };
    size(p);
    ensure(JSON.stringify(p).length <= MAXIMA.programSize, "LIMIT");
    const shape2 = (n, fields) => {
      ensure(n && typeof n === "object" && !Array.isArray(n));
      ensure(Object.keys(n).every((k) => k === "op" || fields.some((f) => f.replace("?", "") === k)));
      for (const f of fields) if (!f.endsWith("?")) ensure(Object.hasOwn(n, f));
    };
    const interfaces = p?.schema === INTERFACE_SCHEMA, conditional = interfaces || p?.schema === DO_SCHEMA, regex = conditional || p?.schema === REGEX_SCHEMA, staticLinked = regex || p?.schema === STATIC_SCHEMA, collections = staticLinked || p?.schema === COLLECTION_SCHEMA, operations = collections || p?.schema === OPERATION_SCHEMA, contracts = operations || p?.schema === CONTRACT_SCHEMA, numeric = contracts || p?.schema === NUMERIC_SCHEMA, types = contracts ? contractTypes : numeric ? numericTypes : sourceTypes;
    const selection = numeric || p?.schema === SELECTION_SCHEMA, exceptions = selection || p?.schema === EXCEPTION_SCHEMA, conversion = exceptions || p?.schema === CONVERSION_SCHEMA, control = conversion || p?.schema === CONTROL_SCHEMA, reserved = interfaces ? interfaceReservedNames : conditional ? doReservedNames : regex ? regexReservedNames : collections ? collectionReservedNames : operations ? operationReservedNames : contracts ? contractReservedNames : numeric ? numericReservedNames : selection ? selectionReservedNames : exceptions ? exceptionReservedNames : conversion ? conversionReservedNames : control ? controlReservedNames : reservedNames;
    const members = control || p?.schema === MEMBER_SCHEMA;
    const versioned = members || p?.schema === SERVICE_SCHEMA, objects = versioned || p?.schema === OBJECT_SCHEMA, modern = objects || p?.schema === PROCEDURE_SCHEMA;
    const statementGrammar = interfaces ? interfaceStatements : conditional ? doStatements : collections ? collectionStatements : selection ? selectionStatements : exceptions ? exceptionStatements : control ? controlStatements : members ? memberStatements : versioned ? serviceStatements : objects ? objectStatements : modern ? procedureStatements : statements, expressionGrammar = interfaces ? interfaceExpressions : collections ? collectionExpressions : operations ? operationExpressions : contracts ? contractExpressions : numeric ? numericExpressions : selection ? selectionExpressions : conversion ? conversionExpressions : control ? controlExpressions : members ? memberExpressions : versioned ? serviceExpressions : objects ? objectExpressions : modern ? procedureExpressions : expressions;
    ensure(p && [SCHEMA2, PROCEDURE_SCHEMA, OBJECT_SCHEMA, SERVICE_SCHEMA, MEMBER_SCHEMA, CONTROL_SCHEMA, CONVERSION_SCHEMA, EXCEPTION_SCHEMA, SELECTION_SCHEMA, NUMERIC_SCHEMA, CONTRACT_SCHEMA, OPERATION_SCHEMA, COLLECTION_SCHEMA, STATIC_SCHEMA, REGEX_SCHEMA, DO_SCHEMA, INTERFACE_SCHEMA].includes(p.schema) && Object.keys(p).every((k) => (modern ? ["schema", "body", "procedures", ...staticLinked ? ["libraries"] : []] : ["schema", "body"]).includes(k)));
    const validType = (t) => types.includes(t) || interfaces && interfaceType(t);
    const procedures = modern ? p.procedures : {};
    ensure(procedures && typeof procedures === "object" && !Array.isArray(procedures));
    const owners = /* @__PURE__ */ new Map();
    if (staticLinked) {
      ensure(regex && p.libraries === void 0 || Array.isArray(p.libraries));
      const linkedLibraries = p.libraries ?? [];
      ensure(Array.isArray(linkedLibraries) && linkedLibraries.length <= 64);
      const ids = /* @__PURE__ */ new Set();
      for (const lib of linkedLibraries) {
        shape2(lib, ["id", "version", "alias", "methods"]);
        ensure(!Object.hasOwn(lib, "op") && typeof lib.id === "string" && /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(lib.id) && !ids.has(lib.id));
        ids.add(lib.id);
        ensure(typeof lib.version === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(lib.version));
        name(lib.alias);
        ensure(lib.methods && typeof lib.methods === "object" && !Array.isArray(lib.methods));
        for (const [id, m] of Object.entries(lib.methods)) {
          name(id);
          shape2(m, ["name", "access", "requires"]);
          ensure(!Object.hasOwn(m, "op"));
          name(m.name);
          ensure(["public", "private"].includes(m.access) && Array.isArray(m.requires) && new Set(m.requires).size === m.requires.length && m.requires.every((x) => typeof x === "string" && /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(x)));
          ensure(Object.hasOwn(procedures, id) && !owners.has(id));
          owners.set(id, { library: lib.id, ...m });
        }
      }
    }
    const graph = /* @__PURE__ */ new Map();
    let current = null;
    const procedureName = (n) => {
      name(n);
      ensure((members || n === n.toLowerCase()) && (!reserved.includes(n.toUpperCase()) || staticLinked && ["CSTR", "VAL"].includes(n.toUpperCase())));
    };
    const procedureCall = (n, kind, d) => {
      procedureName(n.name);
      ensure(Object.hasOwn(procedures, n.name));
      const owner = owners.get(n.name);
      ensure(!owner || owner.access === "public" || owners.get(current)?.library === owner.library);
      const proc = procedures[n.name];
      ensure(proc.kind === kind && Array.isArray(n.args) && n.args.length === proc.params.length);
      if (current) graph.get(current).add(n.name);
      n.args.forEach((x) => expr(x, d + 1));
    };
    const service = (n) => {
      ensure(safeKey(n.library) && safeKey(n.method));
      if (n.op.startsWith("canonical")) ensure(typeof n.apiVersion === "string" && /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(n.apiVersion));
    };
    const expr = (n, d = 0) => {
      ensure(d <= MAXIMA.expressionDepth, "LIMIT");
      ensure(n && Object.hasOwn(expressionGrammar, n.op));
      shape2(n, expressionGrammar[n.op]);
      if (["implements", "cast"].includes(n.op)) {
        ensure(interfaceType(n.type));
        expr(n.value, d + 1);
      }
      if (n.op === "typeLiteral") ensure(contractTypes.includes(n.type));
      if (["typeOf", "dateTime", "typeCheck"].includes(n.op)) {
        if (n.op === "typeCheck") ensure((collections ? contractTypes.filter((t) => t !== "Wydgit") : ["Scalar", "DataType", "DateTime"]).includes(n.type));
        expr(n.value, d + 1);
      }
      if (n.op === "numericCheck") {
        ensure(["Integer", "Float"].includes(n.type));
        expr(n.value, d + 1);
      }
      if (n.op === "numericPredicate") {
        ensure(["IsInteger", "IsSafeInteger"].includes(n.predicate));
        expr(n.value, d + 1);
      }
      if (n.op === "numeric" || n.op === "xor") {
        if (n.op === "numeric") ensure(["+", "-", "*", "/", "MOD", "\\", "^"].includes(n.operator) && ["Integer", "Float", "Auto"].includes(n.type));
        expr(n.left, d + 1);
        expr(n.right, d + 1);
      }
      if (n.op === "identity") {
        ensure(typeof n.negate === "boolean");
        expr(n.left, d + 1);
        expr(n.right, d + 1);
      }
      if (n.op === "convert") {
        ensure(n.mode === void 0 ? ["String", "Number"].includes(n.type) : operations && n.mode === "canonical" && conversionTargets.includes(n.type));
        expr(n.value, d + 1);
      }
      if (n.op === "operation") {
        const signatures = regex ? regexOperationSignatures : collections ? collectionSignatures : operationSignatures;
        ensure(Object.hasOwn(signatures, n.name) && Array.isArray(n.args) && n.args.length === signatures[n.name].length);
        n.args.forEach((x) => expr(x, d + 1));
      }
      if (n.op === "index") {
        expr(n.target, d + 1);
        expr(n.index, d + 1);
      }
      if (n.op === "isNull") {
        ensure(typeof n.negate === "boolean");
        expr(n.value, d + 1);
      }
      if (n.op === "array") {
        ensure(Array.isArray(n.items));
        n.items.forEach((x) => expr(x, d + 1));
      }
      if (n.op === "object") {
        ensure(n.fields && typeof n.fields === "object" && !Array.isArray(n.fields));
        Object.values(n.fields).forEach((x) => expr(x, d + 1));
      }
      if (n.op === "construct") {
        ensure(typeof n.type === "string" && /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(n.type));
        expr(n.id, d + 1);
      }
      if (n.op === "memberRead") {
        ensure(safeKey(n.name) && typeof n.exact === "boolean");
        expr(n.target, d + 1);
      }
      if (n.op === "methodValue") {
        if (n.exact !== void 0) ensure(typeof n.exact === "boolean");
        procedureName(n.name);
        expr(n.target, d + 1);
        ensure(Array.isArray(n.args) && n.args.length <= MAXIMA.parameters);
        n.args.forEach((x) => expr(x, d + 1));
      }
      if (n.op === "functionCall") procedureCall(n, "function", d);
      if (n.op === "serviceCall" || n.op === "canonicalServiceCall") {
        service(n);
        expr(n.input, d + 1);
      }
      if (n.op === "variable") name(n.name);
      if (n.op === "context") ensure(contextNames.includes(n.name) && !(owners.has(current) && n.name === "ME"));
      if (n.op === "read") {
        ensure(safeKey(n.key) || Number.isSafeInteger(n.key) && n.key >= 0);
        expr(n.target, d + 1);
      }
      if (n.op === "invoke") {
        ensure(safeKey(n.method));
        expr(n.target, d + 1);
        ensure(Array.isArray(n.args));
        n.args.forEach((x) => expr(x, d + 1));
      }
      if (n.op === "binary") {
        ensure(operators.includes(n.operator));
        expr(n.left, d + 1);
        expr(n.right, d + 1);
      }
      if (n.op === "not") expr(n.value, d + 1);
    };
    const body = (b, d = 0, loops = 0, dos = 0) => {
      ensure(d <= MAXIMA.nesting, "LIMIT");
      ensure(Array.isArray(b));
      for (const n of b) {
        ensure(n && Object.hasOwn(statementGrammar, n.op));
        shape2(n, statementGrammar[n.op]);
        if (["declare", "constant", "set", "forEach", "forNumeric"].includes(n.op)) name(n.name);
        if (Object.hasOwn(n, "into")) name(n.into);
        if (["declare", "set"].includes(n.op) && n.type !== void 0) ensure(interfaces && validType(n.type));
        if (n.op === "constant") {
          ensure(constantTypes.includes(n.type));
          expr(n.value);
        }
        if (n.op === "forNumeric") {
          expr(n.start);
          expr(n.end);
          expr(n.step);
          body(n.body, d + 1, loops + 1, dos);
        }
        if (n.op === "memberSet") {
          ensure(safeKey(n.name) && typeof n.exact === "boolean");
          expr(n.target);
          expr(n.value);
        }
        if (n.op === "methodCall") {
          if (n.exact !== void 0) ensure(typeof n.exact === "boolean");
          procedureName(n.name);
          expr(n.target);
          ensure(Array.isArray(n.args) && n.args.length <= MAXIMA.parameters);
          n.args.forEach((x) => expr(x));
        }
        if (n.op === "procedureCall") procedureCall(n, "sub", 0);
        if (n.op === "return") {
          ensure(current ? procedures[current].kind === "sub" ? !Object.hasOwn(n, "value") : Object.hasOwn(n, "value") : Object.hasOwn(n, "value"));
        }
        if (n.op === "select") {
          expr(n.value);
          ensure(Array.isArray(n.cases) && (n.cases.length > 0 || Object.hasOwn(n, "else")));
          for (const branch of n.cases) {
            shape2(branch, ["tests", "body"]);
            ensure(!Object.hasOwn(branch, "op") && Array.isArray(branch.tests) && branch.tests.length > 0);
            for (const test of branch.tests) {
              shape2(test, ["operator", "value"]);
              ensure(!Object.hasOwn(test, "op") && ["=", "!=", "<", "<=", ">", ">=", "IS", "IS NOT"].includes(test.operator));
              expr(test.value);
            }
            body(branch.body, d + 1, loops, dos);
          }
          if (Object.hasOwn(n, "else")) body(n.else, d + 1, loops, dos);
        }
        if (n.op === "try") {
          ensure(Object.hasOwn(n, "catch") || Object.hasOwn(n, "finally"));
          body(n.body, d + 1, loops, dos);
          if (Object.hasOwn(n, "catch")) {
            shape2(n.catch, ["name", "body"]);
            ensure(!Object.hasOwn(n.catch, "op"));
            name(n.catch.name);
            ensure(!reserved.includes(n.catch.name.toUpperCase()));
            body(n.catch.body, d + 1, loops, dos);
          }
          if (Object.hasOwn(n, "finally")) body(n.finally, d + 1, loops, dos);
        }
        if (n.op === "do") {
          ensure(["while", "until"].includes(n.mode));
          expr(n.condition);
          body(n.body, d + 1, loops, dos + 1);
        }
        if (n.op === "exitDo") ensure(dos > 0);
        if (n.op === "exitFor") ensure(loops > 0);
        if (n.op === "stop") ensure(!current);
        if (["declare", "set"].includes(n.op) || n.op === "return" && Object.hasOwn(n, "value") || n.op === "stop" && Object.hasOwn(n, "value")) expr(n.value);
        if (n.op === "if") {
          expr(n.condition);
          body(n.then, d + 1, loops, dos);
          if (n.else !== void 0) body(n.else, d + 1, loops, dos);
        }
        if (n.op === "forEach") {
          expr(n.items);
          body(n.body, d + 1, loops + 1, dos);
        }
        if (n.op === "call") {
          expr(n.target);
          ensure(safeKey(n.method) && Array.isArray(n.args));
          n.args.forEach((x) => expr(x));
        }
        if (n.op === "service" || n.op === "canonicalService") {
          service(n);
          expr(n.input);
        }
      }
    };
    for (const [id, proc] of Object.entries(procedures)) {
      procedureName(id);
      shape2(proc, proc?.kind === "function" ? ["kind", "params", "returns", "body"] : ["kind", "params", "body"]);
      ensure(!Object.hasOwn(proc, "op"));
      ensure(["function", "sub"].includes(proc.kind) && Array.isArray(proc.params));
      ensure(proc.params.length <= MAXIMA.parameters, "LIMIT");
      if (proc.kind === "function") ensure(validType(proc.returns));
      const names = /* @__PURE__ */ new Set();
      for (const param of proc.params) {
        shape2(param, ["name", "type"]);
        ensure(!Object.hasOwn(param, "op"));
        name(param.name);
        ensure(!reserved.includes(param.name.toUpperCase()) && !names.has(param.name) && validType(param.type));
        names.add(param.name);
      }
      graph.set(id, /* @__PURE__ */ new Set());
    }
    for (const [id, proc] of Object.entries(procedures)) {
      current = id;
      body(proc.body);
    }
    current = null;
    body(p.body);
    const visited = /* @__PURE__ */ new Set(), active = /* @__PURE__ */ new Set();
    const visit = (id) => {
      ensure(!active.has(id));
      if (visited.has(id)) return;
      active.add(id);
      for (const next of graph.get(id)) visit(next);
      active.delete(id);
      visited.add(id);
    };
    if (!staticLinked) for (const id of graph.keys()) visit(id);
    return freeze(p);
  }

  // wydgine/sewn/bindings.js
  var methods = { handle: { FormState: [1, 2], related: [1, 2], Set: [2, 2], Insert: [3, 3], Remove: [0, 0], Replace: [1, 1], Move: [3, 3] }, EVENT: { Cancel: [0, 0], Raise: [2, 3] }, map: { Get: [1, 1], GetAll: [1, 1] }, cookieRead: { Get: [1, 1] }, RESPONSE: { WriteMarkdown: [1, 1] }, headers: { Set: [2, 2], Remove: [1, 1] }, cookieWrite: { Set: [2, 3], Delete: [1, 1] } };

  // wydgine/object-model/prototypes.js
  var identity = /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/;
  var PrototypeRegistry = class {
    #definitions = /* @__PURE__ */ new Map();
    #verified = /* @__PURE__ */ new Map();
    #interfaces = /* @__PURE__ */ new Map();
    constructor(definitions, { officialPublishers = ["wydgit.core"], verifiedPrototypes = {}, caseCollisionCompatibility = {} } = {}) {
      for (const [id, publisher] of Object.entries(verifiedPrototypes)) {
        requireThat(identity.test(id) && id.split("/")[0] === publisher, "PROTOTYPE.PUBLISHER", "Invalid trusted publisher binding");
        this.#verified.set(id, publisher);
      }
      const raw = /* @__PURE__ */ new Map();
      for (const input of definitions) {
        const d = clean(input);
        requireThat(identity.test(d.id) && d.publisher === d.id.split("/")[0], "PROTOTYPE.IDENTITY", "Invalid prototype identity or publisher");
        requireThat(!raw.has(d.id), "PROTOTYPE.DUPLICATE", "Duplicate prototype");
        raw.set(d.id, d);
      }
      for (const [id, d] of raw) if (d.interface === true) {
        const contract = validateInterface(d);
        requireThat(this.#verified.get(id) === d.publisher, "INTERFACE.PUBLISHER", "Interface requires verified publisher ownership");
        this.#interfaces.set(interfaceKey(contract), contract);
      }
      requireThat(this.#interfaces.size <= 64, "INTERFACE.LIMIT", "Interface catalog limit");
      const visiting = /* @__PURE__ */ new Set();
      const resolve = (id) => {
        if (this.#definitions.has(id)) return this.#definitions.get(id);
        const d = raw.get(id);
        requireThat(d, "PROTOTYPE.UNKNOWN", `Unknown prototype: ${id}`);
        requireThat(!visiting.has(id), "PROTOTYPE.CYCLE", "Inheritance cycle");
        visiting.add(id);
        if (d.interface === true) {
          const result2 = freeze({ ...this.#interfaces.get(interfaceKey(d)), abstract: true, properties: {}, slots: {}, methods: {}, methodRules: {}, ancestors: [] });
          visiting.delete(id);
          this.#definitions.set(id, result2);
          return result2;
        }
        requireThat(d.interface === void 0, "INTERFACE.DEFINITION", "Invalid interface flag");
        let base;
        if (d.extends !== void 0) {
          requireThat(typeof d.extends === "string", "PROTOTYPE.INHERITANCE", "Single inheritance requires one prototype ID");
          base = resolve(d.extends);
          requireThat(!base.interface, "INTERFACE.DEFINITION", "Concrete prototypes cannot inherit interfaces");
          requireThat(base.publisher === d.publisher || officialPublishers.includes(base.publisher) && base.public === true, "PROTOTYPE.PUBLISHER", "Cross-publisher inheritance denied");
        }
        requireThat(d.static === void 0 || typeof d.static === "boolean", "PROTOTYPE.STATIC", "Invalid static flag");
        if (d.static) {
          requireThat(Object.keys(d).every((k) => ["id", "publisher", "public", "abstract", "static", "alias", "version", "dependencies", "properties", "slots", "methodRules", "behavior"].includes(k)), "PROTOTYPE.STATIC", "Unsupported static prototype metadata");
          requireThat(record(d.dependencies ?? {}) && Object.entries(d.dependencies ?? {}).every(([id2, v]) => identity.test(id2) && typeof v === "string"), "PROTOTYPE.STATIC", "Invalid static dependencies");
          requireThat(d.extends === void 0 && !d.abstract && !d.friends?.length && !d.overrides?.length && !d.presentation && !d.actions && Object.keys(d.properties ?? {}).length === 0 && Object.keys(d.slots ?? {}).length === 0, "PROTOTYPE.STATIC", "Dedicated static prototypes cannot contain instance state or inheritance");
          requireThat(typeof d.alias === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.alias) && typeof d.version === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(d.version), "PROTOTYPE.STATIC", "Static prototypes need an alias and exact version");
        } else requireThat(!base?.static && d.alias === void 0 && d.version === void 0, "PROTOTYPE.STATIC", "Static metadata requires a dedicated static prototype");
        requireThat(d.abstract === void 0 || typeof d.abstract === "boolean", "PROTOTYPE.DEFINITION", "Invalid abstract flag");
        requireThat(d.public === void 0 || typeof d.public === "boolean", "PROTOTYPE.DEFINITION", "Invalid public flag");
        requireThat(record(d.properties ?? {}) && record(d.slots ?? {}), "PROTOTYPE.DEFINITION", "Invalid definitions");
        const friends = d.friends ?? [];
        requireThat(Array.isArray(friends) && new Set(friends).size === friends.length && friends.every((x) => typeof x === "string" && (identity.test(x) || /^[a-z][a-z0-9.-]*\/\*$/.test(x)) && x.split("/")[0] === d.publisher), "PROTOTYPE.FRIEND", "Invalid or cross-publisher friendship");
        if (friends.length) requireThat(this.#verified.get(id) === d.publisher, "PROTOTYPE.FRIEND", "Friend grants require a verified publisher binding");
        const methodRules = { ...base?.methodRules };
        requireThat(record(d.methodRules ?? {}) && Object.keys(d.methodRules ?? {}).every((name2) => Object.hasOwn(d.behavior?.procedures ?? {}, name2)), "PROTOTYPE.METHOD", "Method rules require locally declared methods");
        const inheritedMethods = base?.methods ?? {}, methods2 = { ...inheritedMethods };
        requireThat(d.overrides === void 0 || Array.isArray(d.overrides) && d.overrides.every((x) => typeof x === "string"), "PROTOTYPE.METHOD", "Invalid override declarations");
        let behavior = null;
        if (d.behavior !== void 0) {
          try {
            behavior = validate(d.behavior);
          } catch {
            requireThat(false, "PROTOTYPE.METHOD", "Invalid portable method behavior");
          }
        }
        requireThat(d.methods === void 0 && d.behaviorSource === void 0, "PROTOTYPE.METHOD", "Behavior must be compiled by trusted setup");
        requireThat(new Set(d.overrides ?? []).size === (d.overrides ?? []).length, "PROTOTYPE.METHOD", "Duplicate overrides");
        requireThat(!behavior || ["sewn/0.3", "sewn/0.4", "sewn/0.5", "sewn/0.6", "sewn/0.7", "sewn/0.8", "sewn/0.9", "sewn/0.10", "sewn/0.11", "sewn/0.12", "sewn/0.13", "sewn/0.14", "sewn/0.15", "sewn/0.16", "sewn/0.17"].includes(behavior.schema) && behavior.body.length === 0, "PROTOTYPE.METHOD", "Expected portable prototype behavior");
        for (const [name2, proc] of Object.entries(behavior?.procedures ?? {})) {
          requireThat(!Object.keys(methods.handle).some((x) => x.toLowerCase() === name2.toLowerCase()), "PROTOTYPE.METHOD", "Method conflicts with kernel facade");
          const old = inheritedMethods[name2];
          requireThat(Boolean(old) === (d.overrides ?? []).includes(name2), "PROTOTYPE.METHOD", "Inherited methods require explicit overrides");
          if (old) {
            requireThat(accessOf(base.methodRules[name2]) !== "private", "PROTOTYPE.ACCESS", "Private methods cannot be overridden");
            const previous = old.behavior.procedures[name2];
            requireThat(previous.kind === proc.kind && previous.params.length === proc.params.length && previous.params.every((x, i) => x.type === proc.params[i].type) && previous.returns === proc.returns, "PROTOTYPE.METHOD", "Incompatible override signature");
          }
          const rule = d.methodRules?.[name2] ?? {};
          validateMember(rule);
          if (d.static) requireThat(["public", "private"].includes(accessOf(rule)) && !rule.hidden, "PROTOTYPE.STATIC", "Static methods support public/private visibility");
          if (old) requireThat(accessOf(rule) === accessOf(base.methodRules[name2]) && (base.methodRules[name2].requires ?? []).every((cap) => (rule.requires ?? []).includes(cap)) && (!base.methodRules[name2].hidden || rule.hidden === true), "PROTOTYPE.ACCESS", "Override cannot change inherited access or expose hidden members");
          methodRules[name2] = rule;
          methods2[name2] = { owner: id, behavior };
        }
        requireThat((d.overrides ?? []).every((name2) => Object.hasOwn(behavior?.procedures ?? {}, name2)), "PROTOTYPE.METHOD", "Override must declare a method");
        const properties = { ...base?.properties, ...d.properties }, slots = { ...base?.slots, ...d.slots };
        const propertyOwners = { ...base?.propertyOwners };
        for (const [name2, rule] of Object.entries(d.properties ?? {})) {
          validateMember(rule);
          const old = base?.properties[name2];
          if (old) requireThat(accessOf(old) !== "private" && (JSON.stringify(rule.type) === JSON.stringify(old.type) || name2 === "value" && ["wydgit.core/checkbox", "wydgit.core/radio-group", "wydgit.core/checkbox-group", "wydgit.core/select"].includes(id)) && accessOf(rule) === accessOf(old) && (old.requires ?? []).every((cap) => (rule.requires ?? []).includes(cap)) && (!old.required || rule.required === true || Object.hasOwn(rule, "default")) && (!old.hidden || rule.hidden === true) && (!old.enum || rule.enum && rule.enum.every((v) => old.enum.includes(v))), "PROTOTYPE.ACCESS", "Incompatible property override");
          propertyOwners[name2] = old ? base.propertyOwners[name2] : id;
        }
        const names = [...Object.keys(properties), ...Object.keys(methods2)], groups = /* @__PURE__ */ new Map();
        for (const name2 of names) {
          const key = name2.toLowerCase();
          groups.set(key, [...groups.get(key) ?? [], name2]);
        }
        for (const group of groups.values()) if (group.length > 1) {
          const allowed = caseCollisionCompatibility[id];
          requireThat(Array.isArray(allowed) && new Set(group).size === group.length && group.every((name2) => allowed.includes(name2)), "PROTOTYPE.CASE_COLLISION", "Case-equivalent member declarations denied");
        }
        for (const rule of Object.values(properties)) {
          validateMember(rule);
          requireThat(record(rule) && (!Array.isArray(rule.type) || rule.type.length > 0) && (Array.isArray(rule.type) ? rule.type : [rule.type]).every((type) => ["string", "number", "boolean", "object", "array", "null"].includes(type)), "PROTOTYPE.DEFINITION", "Invalid property rule");
          requireThat(rule.enum === void 0 || Array.isArray(rule.enum), "PROTOTYPE.DEFINITION", "Invalid enum");
        }
        for (const rule of Object.values(slots)) {
          requireThat(record(rule) && Array.isArray(rule.accepts) && rule.accepts.length > 0 && rule.accepts.every((x) => typeof x === "string"), "PROTOTYPE.SLOT", "Slot needs accepted prototypes");
          requireThat(rule.ordered === true && Number.isInteger(rule.min ?? 0) && (rule.min ?? 0) >= 0 && (rule.max === void 0 || Number.isInteger(rule.max) && rule.max >= (rule.min ?? 0)), "PROTOTYPE.SLOT", "Invalid ordered slot cardinality");
        }
        const actions = { ...base?.actions };
        requireThat(record(d.actions ?? {}) && Object.keys(d.actions ?? {}).every((name2) => name2 === "Submit"), "PROTOTYPE.ACTION", "Only Submit delegation is supported");
        for (const [name2, rule] of Object.entries(d.actions ?? {})) {
          requireThat(record(rule) && Object.keys(rule).length === 1 && isCapability(rule.capability), "PROTOTYPE.ACTION", "Invalid action declaration");
          requireThat(!actions[name2] || actions[name2].capability === rule.capability, "PROTOTYPE.ACTION", "Inherited action capability cannot change");
          requireThat(d.id === "wydgit.core/form" || base && (base.id === "wydgit.core/form" || base.ancestors.includes("wydgit.core/form")), "PROTOTYPE.ACTION", "Submit delegation requires Form");
          actions[name2] = rule;
        }
        const presentation = d.presentation === void 0 ? base?.presentation : validatePresentation(d.presentation);
        requireThat(record(d.implements ?? {}) && Object.keys(d.implements ?? {}).length <= 16 && (!d.static || d.implements === void 0), "INTERFACE.IMPLEMENTATION", "Invalid implementation metadata");
        if (Object.keys(d.implements ?? {}).length) requireThat(this.#verified.get(id) === d.publisher, "INTERFACE.PUBLISHER", "Implementation requires verified publisher ownership");
        const implementations = { ...base?.implements, ...d.implements };
        if (Object.keys(implementations).length) requireThat(this.#verified.get(id) === d.publisher, "INTERFACE.PUBLISHER", "Inherited implementation requires verified publisher ownership");
        for (const [contractId, version] of Object.entries(implementations)) {
          const contract = this.interface(`interface:${contractId}@${version}`);
          for (const [name2, signature] of Object.entries(contract.signatures)) {
            const member = resolveMember({ methods: methods2, methodRules }, "method", name2, false), method = methods2[member.name];
            requireThat(accessOf(member.rule) === "public" && !member.rule.hidden && sameSignature(signature, method.behavior.procedures[member.name]), "INTERFACE.CONFORMANCE", "Required public instance signature does not match");
          }
        }
        const result = freeze({ ...d, implements: implementations, ...presentation ? { presentation } : {}, abstract: d.abstract ?? false, properties, propertyOwners, slots, methods: methods2, methodRules, friends, actions, ancestors: base ? [base.id, ...base.ancestors] : [] });
        visiting.delete(id);
        this.#definitions.set(id, result);
        return result;
      };
      for (const id of raw.keys()) resolve(id);
      for (const d of this.#definitions.values()) for (const slot of Object.values(d.slots)) for (const id of slot.accepts) this.get(id);
      for (const d of this.#definitions.values()) {
        if (d.interface) continue;
        if (d.behavior) for (const type of interfaceTypes(d.behavior)) this.interface(type);
        if (d.static) {
          requireThat(["sewn/0.14", "sewn/0.15", "sewn/0.16", "sewn/0.17"].includes(d.behavior?.schema), "PROTOTYPE.STATIC", "Static behavior requires sewn/0.14, sewn/0.15 or sewn/0.16");
          const walk2 = (v) => {
            if (!v || typeof v !== "object") return;
            requireThat(!(v.op === "context" && v.name === "ME"), "PROTOTYPE.STATIC", "Static methods have no Me");
            Object.values(v).forEach(walk2);
          };
          walk2(d.behavior);
          for (const lib of d.behavior.libraries ?? []) requireThat(d.dependencies?.[lib.id] === lib.version && lib.id !== d.id, "PROTOTYPE.STATIC", "Linked dependency must be declared");
          continue;
        }
        const graph = /* @__PURE__ */ new Map();
        const walk = (v, edges, behavior) => {
          if (!v || typeof v !== "object") return;
          if (["procedureCall", "functionCall"].includes(v.op)) edges.add(behavior + ":" + v.name);
          if (["methodCall", "methodValue"].includes(v.op) && v.target.op === "context" && v.target.name === "ME") {
            const lookup = resolveMember(d, "method", v.name, v.exact ?? false), m = d.methods[lookup.name];
            requireThat(m, "PROTOTYPE.METHOD", "Unknown receiver method");
            edges.add(m.owner + ":" + lookup.name);
          }
          Object.values(v).forEach((x) => walk(x, edges, behavior));
        };
        for (const m of Object.values(d.methods)) for (const [name2, proc] of Object.entries(m.behavior.procedures)) {
          const edges = /* @__PURE__ */ new Set();
          walk(proc.body, edges, m.owner);
          graph.set(m.owner + ":" + name2, edges);
        }
        const active = /* @__PURE__ */ new Set(), done = /* @__PURE__ */ new Set();
        const visit = (key) => {
          requireThat(!active.has(key), "PROTOTYPE.METHOD", "Recursive method cycle");
          if (done.has(key)) return;
          active.add(key);
          for (const next of graph.get(key) ?? []) visit(next);
          active.delete(key);
          done.add(key);
        };
        for (const key of graph.keys()) visit(key);
      }
      Object.freeze(this);
    }
    get(id) {
      const d = this.#definitions.get(id);
      requireThat(d, "PROTOTYPE.UNKNOWN", `Unknown prototype: ${id}`);
      return d;
    }
    method(id, name2, caller = null, exact = true, context = null) {
      const definition = this.get(id);
      requireThat(!definition.static, "PROTOTYPE.STATIC", "Static methods require compile-time linking");
      requireThat(Object.hasOwn(definition.methods, name2) || !exact, "PROTOTYPE.METHOD", "Unknown prototype method");
      const member = resolveMember(definition, "method", name2, exact);
      if (accessOf(member.rule) === "protected" && caller && this.isA(member.owner, caller) && Object.hasOwn(this.get(caller).methods, member.name)) {
        authorizeMember(this, { ...member, owner: this.get(caller).methods[member.name].owner }, caller, context);
      } else authorizeMember(this, member, caller, context);
      return { ...definition.methods[member.name], name: member.name };
    }
    interface(type) {
      const d = this.#interfaces.get(type);
      requireThat(d, "INTERFACE.UNKNOWN", "Unknown or unsupported interface version");
      return d;
    }
    resolveInterface(alias, dependencies) {
      const matches = [...this.#interfaces.values()].filter((d) => (d.alias.toLowerCase() === alias.toLowerCase() || d.id === alias) && dependencies?.[d.id] === d.version);
      requireThat(matches.length === 1, "INTERFACE.RESOLUTION", "Missing or ambiguous approved interface");
      return matches[0];
    }
    implements(id, type) {
      const contract = this.interface(type), d = this.get(id);
      return !d.interface && !d.static && d.implements?.[contract.id] === contract.version;
    }
    verifiedPublisher(id) {
      return this.#verified.get(id) ?? null;
    }
    isA(id, base) {
      const d = this.get(id);
      return id === base || d.ancestors.includes(base);
    }
  };

  // prototypes/objects.json
  var objects_default = [{ id: "wydgit.core/object", publisher: "wydgit.core", public: true, abstract: true, properties: { order: { type: "number", default: 0 }, position: { type: "string", default: "main", enum: ["header", "main", "aside", "footer"] }, format: { type: "object", default: {} } }, slots: {} }, { id: "wydgit.core/page", publisher: "wydgit.core", public: true, properties: { title: { type: "string", required: true }, slug: { type: "string", required: true }, description: { type: "string", default: "" }, skin: { type: "string", description: "Optional skin ID. Its tokens override inherited site/page/section tokens; omitted tokens keep the parent values." }, searchable: { type: "boolean", default: false }, published: { type: "boolean", default: true } }, slots: { sections: { accepts: ["wydgit.core/section"], ordered: true }, navigation: { accepts: ["wydgit.core/navigation"], ordered: true, max: 1 } }, extends: "wydgit.core/object" }, { id: "wydgit.core/section", publisher: "wydgit.core", public: true, properties: { skin: { type: "string", description: "Optional skin ID. Its tokens override inherited site/page/section tokens; omitted tokens keep the parent values." } }, slots: { blocks: { accepts: ["wydgit.core/block", "wydgit.core/section", "wydgit.core/field"], ordered: true } }, extends: "wydgit.core/object" }, { id: "wydgit.core/block", publisher: "wydgit.core", public: true, properties: { anchors: { type: "array", default: [] }, content: { type: "object", required: true, "supported-types": ["markdown"] }, skin: { type: "string", description: "Optional skin ID. Its tokens override inherited site/page/section tokens; omitted tokens keep the parent values." }, linkToPage: { type: "string", description: "Page ID, resolved like navigation.items[].page. Required for whole-card-link; optional for card (adds a separate page link)." } }, slots: { children: { accepts: ["wydgit.core/block", "wydgit.core/section", "wydgit.core/field"], ordered: true } }, extends: "wydgit.core/object" }, { id: "wydgit.core/navigation", publisher: "wydgit.core", public: true, properties: { label: { type: "string", default: "Navigation" }, items: { type: "array", required: true } }, slots: {}, extends: "wydgit.core/object" }, { id: "wydgit.core/field", publisher: "wydgit.core", public: true, extends: "wydgit.core/object", properties: { name: { type: "string", required: true }, label: { type: "string", default: "" }, value: { type: "string", default: "" }, required: { type: "boolean", default: false }, valid: { type: "boolean", default: true }, errors: { type: "array", default: [] }, warnings: { type: "array", default: [] }, enabled: { type: "boolean", default: true }, visible: { type: "boolean", default: true }, validationMessage: { type: "string", default: "" } }, slots: {} }];

  // packages/wydclient/src/registry.js
  var coreIds = ["object", "page", "section", "block", "field", "navigation"].map((x) => "wydgit.core/" + x);
  var coreDefinitions = objects_default.filter((d) => coreIds.includes(d.id));
  function approveRegistry(declarations, verifiedPrototypes) {
    requireThat(declarations.length <= LIMITS.prototypes, "MANIFEST.LIMIT", "Prototype limit exceeded");
    for (const d of declarations) {
      requireThat(record(d) && typeof d.id === "string" && d.publisher !== "wydgit.core", "PROTOTYPE.IDENTITY", "Invalid prototype identity");
      requireThat(Object.keys(d).every((k) => ["id", "publisher", "public", "abstract", "extends", "properties", "slots", "friends", "methodRules", "overrides", "behavior", "interface", "alias", "version", "signatures", "implements"].includes(k)), "PROTOTYPE.DEFINITION", "Unsupported client prototype field");
      if (d.behavior) requireThat(Array.isArray(d.behavior.body) && d.behavior.body.length === 0 && record(d.behavior.procedures) && Object.values(d.behavior.procedures).every((p) => Array.isArray(p.body) && p.body.length === 0), "PROTOTYPE.METHOD", "Executable behavior is deferred");
    }
    const registry = new PrototypeRegistry([...coreDefinitions, ...declarations], { verifiedPrototypes });
    for (const d of declarations) resolveProperties({}, registry.get(d.id), { incomplete: true });
    return registry;
  }

  // packages/wydclient/src/runtime.js
  var VERSION = "0.1.0-alpha.2";
  var PROTOCOL = Object.freeze({ name: "WydSUB", version: "0.1" });
  var runtimes = /* @__PURE__ */ new WeakMap();
  var messages = Object.freeze({
    manifest: "Page manifest validation failed.",
    network: "Page manifest request failed.",
    package: "Publisher package verification failed.",
    page: "Page prototype resolution failed.",
    bootstrap: "Page initialization failed."
  });
  function policyFrom(input = {}) {
    const config = clean(input);
    shape(config, ["allowedOrigins", "trustedKeys", "verifiedPrototypes"]);
    const origins = config.allowedOrigins ?? [], keys = config.trustedKeys ?? [], bindings = config.verifiedPrototypes ?? {};
    requireThat(Array.isArray(origins) && origins.length <= 16 && origins.every((x) => typeof x === "string" && new URL(x).origin === x && /^https?:/.test(x)), "BOOTSTRAP.CONFIG", "Invalid trusted origin policy");
    requireThat(Array.isArray(keys) && keys.length <= 64 && record(bindings) && Object.keys(bindings).length <= LIMITS.prototypes, "BOOTSTRAP.CONFIG", "Invalid trusted publisher policy");
    const seen = /* @__PURE__ */ new Set();
    for (const key of keys) {
      shape(key, ["publisher", "keyId", "publicKey", "status"], ["publisher", "keyId", "publicKey", "status"]);
      requireThat(publisherPattern.test(key.publisher) && key.publisher !== "wydgit.core" && typeof key.keyId === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(key.keyId) && ["active", "revoked"].includes(key.status), "BOOTSTRAP.CONFIG", "Invalid trusted key binding");
      decode64(key.publicKey, 32);
      const id = key.publisher + "/" + key.keyId;
      requireThat(!seen.has(id), "BOOTSTRAP.CONFIG", "Duplicate trusted key binding");
      seen.add(id);
    }
    for (const [id, publisher] of Object.entries(bindings)) requireThat(identityPattern.test(id) && id.split("/")[0] === publisher && publisher !== "wydgit.core", "BOOTSTRAP.CONFIG", "Invalid trusted publisher binding");
    return freeze({ allowedOrigins: origins, trustedKeys: keys, verifiedPrototypes: bindings });
  }
  function createRuntime(host, configuration = {}) {
    const owners = /* @__PURE__ */ new WeakMap(), regions = /* @__PURE__ */ new WeakSet();
    let sequence = 0;
    const isBoundary = (element) => element.hasAttribute("data-wydgit-root") || owners.has(element);
    function mount(options) {
      requireThat(record(options) && Object.keys(options).every((k) => ["root", "policy", "page", "properties"].includes(k)), "MOUNT.CONFIG", "Invalid mount configuration");
      const root = options.root, doc = host.document;
      requireThat(
        root instanceof doc.defaultView.HTMLElement && root.ownerDocument === doc && root !== doc.body && doc.body?.contains(root) && !root.matches("head,script,style,link,meta,title,template,textarea,select,option,area,base,br,col,embed,hr,img,input,param,source,track,wbr"),
        "MOUNT.ROOT",
        "Expected a container in this document body"
      );
      for (let element = root; element; element = element.parentElement) requireThat(!regions.has(element), "MOUNT.ROOT", "Runtime regions cannot be mounting roots");
      if (owners.has(root)) return owners.get(root);
      const scope = {
        root,
        id: `WydClientPage-${++sequence}`,
        page: options.page,
        properties: options.properties ?? {},
        isBoundary,
        regions,
        onDispose: () => owners.delete(root)
      };
      const handle = createContext(host, options.policy ?? {}, scope);
      owners.set(root, handle);
      void handle.ready();
      return handle;
    }
    return createContext(host, configuration, { id: "WydClientPage", isBoundary, regions, mount });
  }
  function createContext(host, configuration, scope) {
    let promise, state = "idle", result;
    const embedded = Boolean(scope.root), controller = new AbortController();
    let snapshotError, properties, regions = null;
    try {
      configuration = clean(configuration);
      properties = clean(scope.properties ?? {});
    } catch (error) {
      snapshotError = error;
    }
    scope.properties = null;
    let resolveDisposal;
    const disposal = new Promise((resolve) => {
      resolveDisposal = resolve;
    });
    const api = Object.freeze(embedded ? { ready, get state() {
      return state;
    }, unmount } : { version: VERSION, protocol: PROTOCOL, ready, get state() {
      return state;
    }, mount: scope.mount });
    const active = () => requireThat(state !== "disposed", "BOOTSTRAP.DISPOSED", "Page environment disposed");
    function unmount() {
      if (state === "disposed") return result;
      state = "disposed";
      controller.abort();
      if (regions) for (const region of Object.values(regions)) {
        while (region.firstChild && region.parentNode) region.parentNode.insertBefore(region.firstChild, region);
        region.remove();
      }
      scope.onDispose();
      scope.onDispose = null;
      scope.root = scope.page = snapshotError = null;
      configuration = properties = regions = null;
      runtimes.delete(api);
      result = freeze({ ok: false, state, page: null, SUB: null, registry: { approved: false }, diagnostics: [{ code: "BOOTSTRAP.DISPOSED", message: "Page environment disposed." }] });
      resolveDisposal(result);
      return result;
    }
    function ready() {
      if (state === "disposed") return disposal;
      if (!promise) {
        state = "initializing";
        promise = embedded ? Promise.race([initialize(), disposal]) : initialize();
      }
      return promise;
    }
    async function initialize() {
      const doc = host.document;
      if (doc.readyState === "loading") await new Promise((resolve) => {
        const done = () => {
          doc.removeEventListener("DOMContentLoaded", done);
          controller.signal.removeEventListener("abort", done);
          resolve();
        };
        doc.addEventListener("DOMContentLoaded", done, { once: true });
        controller.signal.addEventListener("abort", done, { once: true });
      });
      if (state === "disposed") return result;
      let registry, page, error = null;
      try {
        if (snapshotError) throw snapshotError;
        const policy = policyFrom(configuration);
        const belongsToDocument = (element) => {
          for (let parent = element; parent; parent = parent.parentElement) if (scope.isBoundary(parent)) return false;
          return true;
        };
        const inline = embedded ? [...scope.root.children].filter((e) => !scope.isBoundary(e) && e.hasAttribute("data-wydgit-manifest")) : [...doc.querySelectorAll('[id="wydgit-manifest"]')].filter(belongsToDocument);
        const external = embedded ? [...scope.root.children].filter((e) => !scope.isBoundary(e) && e.matches('link[rel~="wydgit-manifest"]')) : [...doc.querySelectorAll('link[rel~="wydgit-manifest"]')].filter(belongsToDocument);
        requireThat(inline.length + external.length <= 1, "MANIFEST.DUPLICATE", "Multiple authoritative manifests");
        let manifest = { schema: "wydgit.registry/0.1", protocol: "0.1", prototypes: [] };
        if (inline.length) {
          requireThat(inline[0].tagName === "SCRIPT" && inline[0].getAttribute("type") === "application/json", "MANIFEST.TYPE", "Expected JSON manifest");
          requireThat(inline[0].textContent.length <= LIMITS.bytes, "MANIFEST.LIMIT", "Manifest limit exceeded");
          manifest = parseJSON(new TextEncoder().encode(inline[0].textContent));
        } else if (external.length) {
          requireThat(external[0].hasAttribute("href") && external[0].getAttribute("href").length > 0, "NETWORK.URL", "Missing manifest URL");
          manifest = parseJSON(await download(external[0].getAttribute("href"), host, policy, controller.signal));
          active();
        }
        shape(manifest, ["schema", "protocol", "prototypes", "packages"], ["schema", "prototypes"]);
        requireThat(manifest.schema === "wydgit.registry/0.1" && (manifest.protocol ?? "0.1") === PROTOCOL.version, "MANIFEST.VERSION", "Unsupported manifest version");
        requireThat(Array.isArray(manifest.prototypes) && Array.isArray(manifest.packages ?? []) && (manifest.packages ?? []).length <= LIMITS.packages, "MANIFEST.SHAPE", "Invalid manifest declarations");
        const declarations = [...manifest.prototypes], verified = { ...policy.verifiedPrototypes };
        requireThat(declarations.length <= LIMITS.prototypes, "MANIFEST.LIMIT", "Prototype limit exceeded");
        const packages = /* @__PURE__ */ new Set();
        for (const ref of manifest.packages ?? []) {
          requireThat(!packages.has(ref.id), "PACKAGE.DUPLICATE", "Duplicate package reference");
          packages.add(ref.id);
          const definitions = await loadPackage(ref, host, policy, controller.signal);
          active();
          requireThat(declarations.length + definitions.length <= LIMITS.prototypes, "MANIFEST.LIMIT", "Prototype limit exceeded");
          declarations.push(...definitions);
          for (const d of definitions) verified[d.id] = ref.publisher;
        }
        registry = approveRegistry(declarations, verified);
        const selected = embedded ? scope.page ?? scope.root.getAttribute("data-wydgit-page") ?? "wydgit.core/page" : doc.documentElement.getAttribute("data-wydgit-page") ?? "wydgit.core/page";
        let definition;
        try {
          definition = registry.get(selected);
          requireThat(registry.isA(selected, "wydgit.core/page") && !definition.abstract, "PAGE.PROTOTYPE", "Expected concrete Page prototype");
          requireThat(![...Object.keys(definition.properties), ...Object.keys(definition.slots), ...Object.keys(definition.methods)].some((k) => ["top", "bottom", "sub"].includes(k.toLowerCase())), "PAGE.MOUNT", "Reserved Page destination");
          const values = resolveProperties(embedded ? {
            title: scope.root.getAttribute("data-wydgit-title") ?? "",
            slug: scope.root.getAttribute("data-wydgit-slug") ?? host.location.pathname,
            ...properties
          } : { title: String(doc.title), slug: host.location.pathname }, definition);
          const slots = Object.fromEntries(Object.entries(definition.slots).map(([k, rule]) => {
            requireThat((rule.min ?? 0) === 0, "PAGE.SLOT", "Static Page requires empty slots");
            return [k, []];
          }));
          page = freeze({ schema: SCHEMA, id: scope.id, prototype: selected, properties: values, slots, provenance: {} });
        } catch {
          requireThat(false, "PAGE.PROTOTYPE", "Page prototype resolution failed");
        }
      } catch (failure) {
        if (state === "disposed") return result;
        const code = typeof failure.code === "string" && /^(MANIFEST|NETWORK|PACKAGE|PROTOTYPE|OBJECT|INPUT|PAGE|BOOTSTRAP)\.[A-Z_]+$/.test(failure.code) ? failure.code : "BOOTSTRAP.FAILED";
        error = freeze({ code, message: code.startsWith("NETWORK.") ? messages.network : code.startsWith("PACKAGE.") ? messages.package : code.startsWith("PAGE.") ? messages.page : code.startsWith("BOOTSTRAP.") ? messages.bootstrap : messages.manifest });
        registry = approveRegistry([], {});
        const definition = registry.get("wydgit.core/page");
        page = freeze({ schema: SCHEMA, id: scope.id, prototype: definition.id, properties: resolveProperties({ title: embedded ? "" : String(doc.title), slug: host.location.pathname }, definition), slots: { sections: [], navigation: [] }, provenance: {} });
      }
      const destinations = freeze({ Page: { default: "SUB.Page.Bottom", Top: { destination: "SUB.Page.Top", ...embedded ? { context: scope.id } : {} }, Bottom: { destination: "SUB.Page.Bottom", ...embedded ? { context: scope.id } : {} } } });
      try {
        active();
        const root = embedded ? scope.root : doc.body;
        requireThat(root && root.ownerDocument === doc && doc.body?.contains(root), "BOOTSTRAP.BODY", "Page root unavailable");
        const top = doc.createElement("div"), bottom = doc.createElement("div");
        top.setAttribute("data-wydclient-region", "top");
        bottom.setAttribute("data-wydclient-region", "bottom");
        root.prepend(top);
        root.append(bottom);
        scope.regions.add(top);
        scope.regions.add(bottom);
        regions = Object.freeze({ top, bottom });
      } catch {
        error = freeze({ code: "BOOTSTRAP.BODY", message: messages.bootstrap });
      }
      state = error ? "failed" : "ready";
      runtimes.set(api, Object.freeze({ registry, page, destinations, regions, approved: !error }));
      const publicProperties = Object.fromEntries(Object.entries(page.properties).filter(([key]) => {
        const rule = registry.get(page.prototype).properties[key];
        return (rule.access ?? "public") === "public" && !rule.hidden && !rule.requires?.length;
      }));
      result = freeze({ ok: !error, state, page: { ...page, properties: publicProperties }, SUB: destinations, registry: { approved: !error }, diagnostics: error ? [error] : [] });
      return result;
    }
    return api;
  }

  // packages/wydclient/src/browser.js
  if (!Object.hasOwn(globalThis, "WydClient")) {
    const api = createRuntime(globalThis, globalThis.WydClientConfig ?? {});
    Object.defineProperty(globalThis, "WydClient", { value: api, writable: false, configurable: false });
    void api.ready();
  }
})();
