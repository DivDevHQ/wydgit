/* WydClient 0.1.0-alpha.9; WydSUB 0.1; MPL-2.0 */
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name4 in all)
      __defProp(target, name4, { get: all[name4], enumerable: true });
  };

  // wydgine/object-model/validation.js
  function requireThat(ok, code, message) {
    if (!ok) throw new WydgitError(code, message);
  }
  function freeze(x2) {
    if (x2 && typeof x2 === "object") {
      Object.values(x2).forEach(freeze);
      Object.freeze(x2);
    }
    return x2;
  }
  function jsonKeys(value) {
    requireThat(value && typeof value === "object", "INPUT.JSON", "Expected JSON container");
    const array = Array.isArray(value);
    requireThat(array ? Object.getPrototypeOf(value) === Array.prototype : [Object.prototype, null].includes(Object.getPrototypeOf(value)), "INPUT.JSON", "Expected plain JSON data");
    const keys = Reflect.ownKeys(value).filter((k2) => !(array && k2 === "length"));
    requireThat(keys.every((k2) => typeof k2 === "string"), "INPUT.JSON", "Symbol keys are not JSON");
    requireThat(!array || keys.length === value.length && keys.every((k2, i) => k2 === String(i)), "INPUT.JSON", "Expected dense JSON array");
    requireThat(keys.every((k2) => {
      const d = Object.getOwnPropertyDescriptor(value, k2);
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
      const descriptor2 = Object.getOwnPropertyDescriptor(value, key);
      requireThat(Object.hasOwn(descriptor2, "value"), "INPUT.JSON", "Accessors are not JSON");
      out[key] = clean(descriptor2.value, active, depth + 1);
    }
    active.delete(value);
    return out;
  }
  function parse(text) {
    try {
      return JSON.parse(text);
    } catch {
      throw new WydgitError("INPUT.JSON", "Malformed JSON");
    }
  }
  var WydgitError, record;
  var init_validation = __esm({
    "wydgine/object-model/validation.js"() {
      WydgitError = class extends Error {
        constructor(code, message, details = {}) {
          super(message);
          this.code = code;
          this.details = details;
        }
        toJSON() {
          return { ok: false, code: this.code, message: this.message, details: this.details };
        }
      };
      record = (x2) => x2 !== null && typeof x2 === "object" && !Array.isArray(x2);
    }
  });

  // wydgine/sewn/schema.js
  var SCHEMA2, MAXIMA, statements, expressions, operators, contextNames, safeKey, PROCEDURE_SCHEMA, sourceTypes, procedureStatements, procedureExpressions, reservedNames, OBJECT_SCHEMA, objectStatements, objectExpressions, SERVICE_SCHEMA, serviceStatements, serviceExpressions, MEMBER_SCHEMA, memberStatements, memberExpressions, CONTROL_SCHEMA, controlStatements, controlExpressions, controlReservedNames, CONVERSION_SCHEMA, conversionExpressions, conversionReservedNames, EXCEPTION_SCHEMA, exceptionStatements, exceptionReservedNames, SELECTION_SCHEMA, selectionStatements, selectionExpressions, selectionReservedNames, NUMERIC_SCHEMA, numericTypes, numericExpressions, numericReservedNames, CONTRACT_SCHEMA, contractTypes, contractExpressions, contractReservedNames, OPERATION_SCHEMA, operationSignatures, conversionTargets, operationExpressions, operationReservedNames, COLLECTION_SCHEMA, collectionSignatures, constantTypes, collectionExpressions, collectionStatements, collectionReservedNames, STATIC_SCHEMA, REGEX_SCHEMA, regexSignatures, regexOperationSignatures, regexReservedNames, DO_SCHEMA, doStatements, doReservedNames, INTERFACE_SCHEMA, interfaceExpressions, interfaceStatements, interfaceReservedNames, DATE_SCHEMA, dateSignatures, dateOperationSignatures, dateReservedNames;
  var init_schema = __esm({
    "wydgine/sewn/schema.js"() {
      SCHEMA2 = "sewn/0.1";
      MAXIMA = Object.freeze({ dateInput: 40, dateFormat: 256, dateTokens: 64, dateZone: 64, dateOutput: 1024, steps: 1e4, expressionDepth: 32, nesting: 16, iterations: 1e3, variables: 64, valueNodes: 4096, string: 16384, serviceCalls: 32, procedureCalls: 256, procedureDepth: 16, parameters: 16, drafts: 64, draftDepth: 32, draftNodes: 256, constructionOperations: 512, constructionSize: 65536, regexPattern: 256, regexInput: 4096, regexCaptures: 8, regexMatches: 128, regexOutput: 16384, regexDepth: 16, regexRepeat: 32, regexAtoms: 128, regexInstructions: 512, regexWork: 1e6, timeMs: 1e3, programNodes: 8192, programSize: 65536 });
      statements = Object.freeze({ declare: ["name", "value"], set: ["name", "value"], if: ["condition", "then", "else?"], forEach: ["name", "items", "body"], call: ["target", "method", "args", "into?"], service: ["library", "method", "input", "into?"], return: ["value"], stop: ["value?"] });
      expressions = Object.freeze({ array: ["items"], object: ["fields"], literal: ["value"], variable: ["name"], context: ["name"], read: ["target", "key"], invoke: ["target", "method", "args"], binary: ["operator", "left", "right"], not: ["value"] });
      operators = ["=", "!=", "<", "<=", ">", ">=", "AND", "OR", "+", "-", "*", "/", "concat"];
      contextNames = ["ME", "EVENT", "REQUEST", "RESPONSE", "SESSION", "PAGE", "SERVER", "CLIENT"];
      safeKey = (k2) => typeof k2 === "string" && !["__proto__", "constructor", "prototype"].includes(k2);
      PROCEDURE_SCHEMA = "sewn/0.2";
      sourceTypes = Object.freeze(["String", "Number", "Boolean", "Null", "Array", "Object", "Wydgit"]);
      procedureStatements = Object.freeze({ ...statements, procedureCall: ["name", "args"], return: ["value?"] });
      procedureExpressions = Object.freeze({ ...expressions, functionCall: ["name", "args"], serviceCall: ["library", "method", "input"] });
      reservedNames = Object.freeze([...contextNames, "SERVICES", "NEWID", "DIM", "AS", "SET", "IF", "THEN", "ELSE", "ELSEIF", "END", "FOR", "EACH", "IN", "NEXT", "RETURN", "STOP", "TRUE", "FALSE", "NULL", "AND", "OR", "NOT", "SUB", "FUNCTION", "CALL", "EVENT", "MODULE", "ASYNC", "AWAIT", "GOTO", "REM", "DO", "LOOP", "WHILE", "SELECT", "TRY", "CATCH", "THROW", "ON", "CLASS", "NEW", "IMPORT", "BYREF", "OPTIONAL", "PARAMARRAY", "PROCESS", "GLOBALTHIS", "WINDOW", "DOCUMENT", "REQUIRE", "EVAL", "FS", "CHILD_PROCESS"]);
      OBJECT_SCHEMA = "sewn/0.3";
      objectStatements = Object.freeze({ ...procedureStatements, methodCall: ["target", "name", "args"] });
      objectExpressions = Object.freeze({ ...procedureExpressions, methodValue: ["target", "name", "args"], construct: ["type", "id"], newId: [] });
      SERVICE_SCHEMA = "sewn/0.4";
      serviceStatements = Object.freeze({ ...objectStatements, canonicalService: ["library", "apiVersion", "method", "input", "into?"] });
      serviceExpressions = Object.freeze({ ...objectExpressions, canonicalServiceCall: ["library", "apiVersion", "method", "input"] });
      MEMBER_SCHEMA = "sewn/0.5";
      memberStatements = Object.freeze({ ...serviceStatements, memberSet: ["target", "name", "value", "exact"], methodCall: ["target", "name", "args", "exact?"] });
      memberExpressions = Object.freeze({ ...serviceExpressions, memberRead: ["target", "name", "exact"], methodValue: ["target", "name", "args", "exact?"] });
      CONTROL_SCHEMA = "sewn/0.6";
      controlStatements = Object.freeze({ ...memberStatements, exitFor: [] });
      controlExpressions = Object.freeze({ ...memberExpressions, isNull: ["value", "negate"] });
      controlReservedNames = Object.freeze([...reservedNames, "IS", "EXIT"]);
      CONVERSION_SCHEMA = "sewn/0.7";
      conversionExpressions = Object.freeze({ ...controlExpressions, convert: ["type", "value"] });
      conversionReservedNames = Object.freeze([...controlReservedNames, "CSTR", "VAL"]);
      EXCEPTION_SCHEMA = "sewn/0.8";
      exceptionStatements = Object.freeze({ ...controlStatements, try: ["body", "catch?", "finally?"] });
      exceptionReservedNames = Object.freeze([...conversionReservedNames, "FINALLY"]);
      SELECTION_SCHEMA = "sewn/0.9";
      selectionStatements = Object.freeze({ ...exceptionStatements, select: ["value", "cases", "else?"] });
      selectionExpressions = Object.freeze({ ...conversionExpressions, identity: ["left", "right", "negate"] });
      selectionReservedNames = Object.freeze([...exceptionReservedNames]);
      NUMERIC_SCHEMA = "sewn/0.10";
      numericTypes = Object.freeze([...sourceTypes, "Integer", "Float"]);
      numericExpressions = Object.freeze({ ...selectionExpressions, numeric: ["operator", "left", "right", "type"], numericCheck: ["type", "value"], numericPredicate: ["predicate", "value"], xor: ["left", "right"] });
      numericReservedNames = Object.freeze([...selectionReservedNames, "ISINTEGER", "ISSAFEINTEGER"]);
      CONTRACT_SCHEMA = "sewn/0.11";
      contractTypes = Object.freeze([...numericTypes, "Scalar", "DataType", "DateTime"]);
      contractExpressions = Object.freeze({ ...numericExpressions, typeLiteral: ["type"], typeOf: ["value"], dateTime: ["value"], typeCheck: ["type", "value"] });
      contractReservedNames = Object.freeze([...numericReservedNames, "SCALAR", "DATATYPE", "DATETIME", "TYPEOF"]);
      OPERATION_SCHEMA = "sewn/0.12";
      operationSignatures = Object.freeze({
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
      conversionTargets = Object.freeze(["String", "Integer", "Float", "Number", "Boolean", "DateTime"]);
      operationExpressions = Object.freeze({ ...contractExpressions, convert: ["type", "value", "mode?"], operation: ["name", "args"] });
      operationReservedNames = Object.freeze([...contractReservedNames, "CONVERT", ...Object.keys(operationSignatures).map((x2) => x2.toUpperCase())]);
      COLLECTION_SCHEMA = "sewn/0.13";
      collectionSignatures = Object.freeze({
        ...operationSignatures,
        Length: ["Collection"],
        Contains: ["Collection", "Value"],
        IndexOf: ["Collection", "Value"],
        Slice: ["Array", "Integer", "Integer"],
        Join: ["Array", "String"],
        Split: ["String", "String"]
      });
      constantTypes = Object.freeze(["String", "Number", "Integer", "Float", "Boolean", "Null", "Scalar", "DateTime", "DataType"]);
      collectionExpressions = Object.freeze({ ...operationExpressions, index: ["target", "index"] });
      collectionStatements = Object.freeze({ ...selectionStatements, constant: ["name", "type", "value"], forNumeric: ["name", "start", "end", "step", "body"] });
      collectionReservedNames = Object.freeze([...operationReservedNames, "SLICE", "JOIN", "SPLIT", "CONST", "TO", "STEP"]);
      STATIC_SCHEMA = "sewn/0.14";
      REGEX_SCHEMA = "sewn/0.15";
      regexSignatures = Object.freeze({ RegexTest: ["String", "String", "String"], RegexMatch: ["String", "String", "String"], RegexMatches: ["String", "String", "String"], RegexReplace: ["String", "String", "String", "String"], RegexSplit: ["String", "String", "String"] });
      regexOperationSignatures = Object.freeze({ ...collectionSignatures, ...regexSignatures });
      regexReservedNames = Object.freeze([...collectionReservedNames, ...Object.keys(regexSignatures).map((x2) => x2.toUpperCase())]);
      DO_SCHEMA = "sewn/0.16";
      doStatements = Object.freeze({ ...collectionStatements, do: ["mode", "condition", "body"], exitDo: [] });
      doReservedNames = Object.freeze([...regexReservedNames, "UNTIL"]);
      INTERFACE_SCHEMA = "sewn/0.17";
      interfaceExpressions = Object.freeze({ ...collectionExpressions, implements: ["value", "type"], cast: ["value", "type"] });
      interfaceStatements = Object.freeze({ ...doStatements, declare: ["name", "value", "type?"], set: ["name", "value", "type?"] });
      interfaceReservedNames = Object.freeze([...doReservedNames, "INTERFACE", "IMPLEMENTS", "CAST"]);
      DATE_SCHEMA = "sewn/0.18";
      dateSignatures = Object.freeze({ DatePart: ["DateTime", "String", "String"], DateAdd: ["DateTime", "String", "Integer", "String"], DateDiff: ["DateTime", "DateTime", "String", "String"], ParseDate: ["String", "String", "String"], FormatDate: ["DateTime", "String", "String"] });
      dateOperationSignatures = Object.freeze({ ...regexOperationSignatures, ...dateSignatures });
      dateReservedNames = Object.freeze([...interfaceReservedNames, ...Object.keys(dateSignatures).map((x2) => x2.toUpperCase())]);
    }
  });

  // wydgine/object-model/interfaces.js
  function validateInterface(input) {
    const d = clean(input), allowed = ["id", "publisher", "interface", "alias", "version", "signatures"];
    requireThat(record(d) && Object.keys(d).every((k2) => allowed.includes(k2)) && d.interface === true, "INTERFACE.DEFINITION", "Expected a declaration-only interface");
    requireThat(typeof d.id === "string" && /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(d.id) && d.publisher === d.id.split("/")[0] && interfaceType(interfaceKey(d)), "INTERFACE.IDENTITY", "Invalid exact interface identity");
    requireThat(typeof d.alias === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.alias) && !contractTypes.some((t) => t.toLowerCase() === d.alias.toLowerCase()) && !doReservedNames.includes(d.alias.toUpperCase()) && !["CAST", "IMPLEMENTS", "INTERFACE"].includes(d.alias.toUpperCase()), "INTERFACE.IDENTITY", "Invalid interface alias");
    requireThat(record(d.signatures) && Object.keys(d.signatures).length > 0 && Object.keys(d.signatures).length <= 64, "INTERFACE.DEFINITION", "Expected method signatures");
    for (const [name4, s] of Object.entries(d.signatures)) {
      requireThat(/^[a-z][a-z0-9_]{0,63}$/.test(name4) && !doReservedNames.includes(name4.toUpperCase()) && record(s) && ["function", "sub"].includes(s.kind) && Object.keys(s).every((k2) => ["kind", "params", ...s.kind === "function" ? ["returns"] : []].includes(k2)), "INTERFACE.SIGNATURE", "Invalid method signature");
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
  var interfaceType, interfaceKey;
  var init_interfaces = __esm({
    "wydgine/object-model/interfaces.js"() {
      init_validation();
      init_schema();
      interfaceType = (t) => typeof t === "string" && /^interface:[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(t);
      interfaceKey = (d) => `interface:${d.id}@${d.version}`;
    }
  });

  // wydgine/sewn/validate.js
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
      if (v && typeof v === "object") Object.values(v).forEach((x2) => size(x2, d + 1));
    };
    size(p);
    ensure(JSON.stringify(p).length <= MAXIMA.programSize, "LIMIT");
    const shape5 = (n, fields2) => {
      ensure(n && typeof n === "object" && !Array.isArray(n));
      ensure(Object.keys(n).every((k2) => k2 === "op" || fields2.some((f) => f.replace("?", "") === k2)));
      for (const f of fields2) if (!f.endsWith("?")) ensure(Object.hasOwn(n, f));
    };
    const dates = p?.schema === DATE_SCHEMA, interfaces = dates || p?.schema === INTERFACE_SCHEMA, conditional = interfaces || p?.schema === DO_SCHEMA, regex = conditional || p?.schema === REGEX_SCHEMA, staticLinked = regex || p?.schema === STATIC_SCHEMA, collections = staticLinked || p?.schema === COLLECTION_SCHEMA, operations = collections || p?.schema === OPERATION_SCHEMA, contracts = operations || p?.schema === CONTRACT_SCHEMA, numeric2 = contracts || p?.schema === NUMERIC_SCHEMA, types2 = contracts ? contractTypes : numeric2 ? numericTypes : sourceTypes;
    const selection = numeric2 || p?.schema === SELECTION_SCHEMA, exceptions = selection || p?.schema === EXCEPTION_SCHEMA, conversion = exceptions || p?.schema === CONVERSION_SCHEMA, control = conversion || p?.schema === CONTROL_SCHEMA, reserved = dates ? dateReservedNames : interfaces ? interfaceReservedNames : conditional ? doReservedNames : regex ? regexReservedNames : collections ? collectionReservedNames : operations ? operationReservedNames : contracts ? contractReservedNames : numeric2 ? numericReservedNames : selection ? selectionReservedNames : exceptions ? exceptionReservedNames : conversion ? conversionReservedNames : control ? controlReservedNames : reservedNames;
    const members = control || p?.schema === MEMBER_SCHEMA;
    const versioned = members || p?.schema === SERVICE_SCHEMA, objects = versioned || p?.schema === OBJECT_SCHEMA, modern = objects || p?.schema === PROCEDURE_SCHEMA;
    const statementGrammar = interfaces ? interfaceStatements : conditional ? doStatements : collections ? collectionStatements : selection ? selectionStatements : exceptions ? exceptionStatements : control ? controlStatements : members ? memberStatements : versioned ? serviceStatements : objects ? objectStatements : modern ? procedureStatements : statements, expressionGrammar = interfaces ? interfaceExpressions : collections ? collectionExpressions : operations ? operationExpressions : contracts ? contractExpressions : numeric2 ? numericExpressions : selection ? selectionExpressions : conversion ? conversionExpressions : control ? controlExpressions : members ? memberExpressions : versioned ? serviceExpressions : objects ? objectExpressions : modern ? procedureExpressions : expressions;
    ensure(p && [SCHEMA2, PROCEDURE_SCHEMA, OBJECT_SCHEMA, SERVICE_SCHEMA, MEMBER_SCHEMA, CONTROL_SCHEMA, CONVERSION_SCHEMA, EXCEPTION_SCHEMA, SELECTION_SCHEMA, NUMERIC_SCHEMA, CONTRACT_SCHEMA, OPERATION_SCHEMA, COLLECTION_SCHEMA, STATIC_SCHEMA, REGEX_SCHEMA, DO_SCHEMA, INTERFACE_SCHEMA, DATE_SCHEMA].includes(p.schema) && Object.keys(p).every((k2) => (modern ? ["schema", "body", "procedures", ...staticLinked ? ["libraries"] : []] : ["schema", "body"]).includes(k2)));
    const validType = (t) => types2.includes(t) || interfaces && interfaceType(t);
    const procedures = modern ? p.procedures : {};
    ensure(procedures && typeof procedures === "object" && !Array.isArray(procedures));
    const owners = /* @__PURE__ */ new Map();
    if (staticLinked) {
      ensure(regex && p.libraries === void 0 || Array.isArray(p.libraries));
      const linkedLibraries = p.libraries ?? [];
      ensure(Array.isArray(linkedLibraries) && linkedLibraries.length <= 64);
      const ids = /* @__PURE__ */ new Set();
      for (const lib of linkedLibraries) {
        shape5(lib, ["id", "version", "alias", "methods"]);
        ensure(!Object.hasOwn(lib, "op") && typeof lib.id === "string" && /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/.test(lib.id) && !ids.has(lib.id));
        ids.add(lib.id);
        ensure(typeof lib.version === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(lib.version));
        name(lib.alias);
        ensure(lib.methods && typeof lib.methods === "object" && !Array.isArray(lib.methods));
        for (const [id, m2] of Object.entries(lib.methods)) {
          name(id);
          shape5(m2, ["name", "access", "requires"]);
          ensure(!Object.hasOwn(m2, "op"));
          name(m2.name);
          ensure(["public", "private"].includes(m2.access) && Array.isArray(m2.requires) && new Set(m2.requires).size === m2.requires.length && m2.requires.every((x2) => typeof x2 === "string" && /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(x2)));
          ensure(Object.hasOwn(procedures, id) && !owners.has(id));
          owners.set(id, { library: lib.id, ...m2 });
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
      n.args.forEach((x2) => expr(x2, d + 1));
    };
    const service = (n) => {
      ensure(safeKey(n.library) && safeKey(n.method));
      if (n.op.startsWith("canonical")) ensure(typeof n.apiVersion === "string" && /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(n.apiVersion));
    };
    const expr = (n, d = 0) => {
      ensure(d <= MAXIMA.expressionDepth, "LIMIT");
      ensure(n && Object.hasOwn(expressionGrammar, n.op));
      shape5(n, expressionGrammar[n.op]);
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
        const signatures = dates ? dateOperationSignatures : regex ? regexOperationSignatures : collections ? collectionSignatures : operationSignatures;
        ensure(Object.hasOwn(signatures, n.name) && Array.isArray(n.args) && n.args.length === signatures[n.name].length);
        n.args.forEach((x2) => expr(x2, d + 1));
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
        n.items.forEach((x2) => expr(x2, d + 1));
      }
      if (n.op === "object") {
        ensure(n.fields && typeof n.fields === "object" && !Array.isArray(n.fields));
        Object.values(n.fields).forEach((x2) => expr(x2, d + 1));
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
        n.args.forEach((x2) => expr(x2, d + 1));
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
        n.args.forEach((x2) => expr(x2, d + 1));
      }
      if (n.op === "binary") {
        ensure(operators.includes(n.operator));
        expr(n.left, d + 1);
        expr(n.right, d + 1);
      }
      if (n.op === "not") expr(n.value, d + 1);
    };
    const body = (b2, d = 0, loops = 0, dos = 0) => {
      ensure(d <= MAXIMA.nesting, "LIMIT");
      ensure(Array.isArray(b2));
      for (const n of b2) {
        ensure(n && Object.hasOwn(statementGrammar, n.op));
        shape5(n, statementGrammar[n.op]);
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
          n.args.forEach((x2) => expr(x2));
        }
        if (n.op === "procedureCall") procedureCall(n, "sub", 0);
        if (n.op === "return") {
          ensure(current ? procedures[current].kind === "sub" ? !Object.hasOwn(n, "value") : Object.hasOwn(n, "value") : Object.hasOwn(n, "value"));
        }
        if (n.op === "select") {
          expr(n.value);
          ensure(Array.isArray(n.cases) && (n.cases.length > 0 || Object.hasOwn(n, "else")));
          for (const branch of n.cases) {
            shape5(branch, ["tests", "body"]);
            ensure(!Object.hasOwn(branch, "op") && Array.isArray(branch.tests) && branch.tests.length > 0);
            for (const test of branch.tests) {
              shape5(test, ["operator", "value"]);
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
            shape5(n.catch, ["name", "body"]);
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
          n.args.forEach((x2) => expr(x2));
        }
        if (n.op === "service" || n.op === "canonicalService") {
          service(n);
          expr(n.input);
        }
      }
    };
    for (const [id, proc] of Object.entries(procedures)) {
      procedureName(id);
      shape5(proc, proc?.kind === "function" ? ["kind", "params", "returns", "body"] : ["kind", "params", "body"]);
      ensure(!Object.hasOwn(proc, "op"));
      ensure(["function", "sub"].includes(proc.kind) && Array.isArray(proc.params));
      ensure(proc.params.length <= MAXIMA.parameters, "LIMIT");
      if (proc.kind === "function") ensure(validType(proc.returns));
      const names = /* @__PURE__ */ new Set();
      for (const param of proc.params) {
        shape5(param, ["name", "type"]);
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
  var fail, ensure, name;
  var init_validate = __esm({
    "wydgine/sewn/validate.js"() {
      init_schema();
      init_interfaces();
      init_schema();
      init_schema();
      init_schema();
      init_schema();
      init_schema();
      init_schema();
      init_schema();
      init_schema();
      init_validation();
      init_schema();
      fail = (code) => {
        throw new WydgitError(`SEWN.${code}`, "SEWN execution failed");
      };
      ensure = (v, code = "INVALID") => {
        if (!v) fail(code);
      };
      name = (n) => ensure(safeKey(n) && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n));
    }
  });

  // wydgine/sewn/vendor/re2js.js
  var g, y, tB, oB, EB, sB, E, D, jB, YB, l, iC, nB, J, F, pB, qB, lB, uB, G, VB, z, FB, rC, V, P, aC, DC, m, eB, R, zB, M, lC, CB, OB, c, IB, ZB, GB, uC, hC, WB, oC, EC, hB, cC, gC, iB, rB, LB, fC, pC, FC, OC, IC, HB, u, AB, w, GC, U, LC, aB, CC, tC, N, NB, wB, mB, TB, RB, dB, SB, bB, PB, MB, JB, xB, kB, _B, UB, yB, KB, vB, QB, Q, HC, eC, AC, mC, NC, wC;
  var init_re2js = __esm({
    "wydgine/sewn/vendor/re2js.js"() {
      g = class Y {
        static FOLD_CASE = 1;
        static LITERAL = 2;
        static CLASS_NL = 4;
        static DOT_NL = 8;
        static ONE_LINE = 16;
        static NON_GREEDY = 32;
        static PERL_X = 64;
        static UNICODE_GROUPS = 128;
        static WAS_DOLLAR = 256;
        static LOOKBEHIND = 512;
        static MATCH_NL = Y.CLASS_NL | Y.DOT_NL;
        static PERL = Y.CLASS_NL | Y.ONE_LINE | Y.PERL_X | Y.UNICODE_GROUPS;
        static POSIX = 0;
        static UNANCHORED = 0;
        static ANCHOR_START = 1;
        static ANCHOR_BOTH = 2;
      };
      y = { CASE_INSENSITIVE: 1, DOTALL: 2, MULTILINE: 4, DISABLE_UNICODE_GROUPS: 8, LONGEST_MATCH: 16, LOOKBEHINDS: 512 };
      tB = 128;
      oB = new Int32Array(tB);
      EB = new Int32Array(tB);
      sB = 65535;
      for (let r = 0; r < tB; r++) r >= 97 && r <= 122 ? oB[r] = r - 32 : oB[r] = r, r >= 65 && r <= 90 ? EB[r] = r + 32 : EB[r] = r;
      E = class {
        static CODES = /* @__PURE__ */ new Map([["\x07", 7], ["\b", 8], ["	", 9], [`
`, 10], ["\v", 11], ["\f", 12], ["\r", 13], [" ", 32], ['"', 34], ["$", 36], ["&", 38], ["'", 39], ["(", 40], [")", 41], ["*", 42], ["+", 43], ["-", 45], [".", 46], ["0", 48], ["1", 49], ["2", 50], ["3", 51], ["4", 52], ["5", 53], ["6", 54], ["7", 55], ["8", 56], ["9", 57], [":", 58], ["<", 60], [">", 62], ["?", 63], ["A", 65], ["B", 66], ["C", 67], ["F", 70], ["P", 80], ["Q", 81], ["U", 85], ["Z", 90], ["[", 91], ["\\", 92], ["]", 93], ["^", 94], ["_", 95], ["`", 96], ["a", 97], ["b", 98], ["f", 102], ["i", 105], ["m", 109], ["n", 110], ["r", 114], ["s", 115], ["t", 116], ["v", 118], ["x", 120], ["z", 122], ["{", 123], ["|", 124], ["}", 125]]);
        static toUpperCase(r) {
          if (r < tB) return oB[r];
          let B = String.fromCodePoint(r).toUpperCase(), C = B.codePointAt(0) > sB ? 2 : 1;
          if (B.length > C) return r;
          let t = String.fromCodePoint(B.codePointAt(0)).toLowerCase(), e = t.codePointAt(0) > sB ? 2 : 1;
          return t.length > e || t.codePointAt(0) !== r ? r : B.codePointAt(0);
        }
        static toLowerCase(r) {
          if (r < tB) return EB[r];
          let B = String.fromCodePoint(r).toLowerCase(), C = B.codePointAt(0) > sB ? 2 : 1;
          if (B.length > C) return r;
          let t = String.fromCodePoint(B.codePointAt(0)).toUpperCase(), e = t.codePointAt(0) > sB ? 2 : 1;
          return t.length > e || t.codePointAt(0) !== r ? r : B.codePointAt(0);
        }
      };
      D = class {
        constructor(r, B = false) {
          this.data = r, this.isStride1 = B, this.SIZE = B ? 2 : 3;
        }
        getLo(r) {
          return this.data[r * this.SIZE];
        }
        getHi(r) {
          return this.data[r * this.SIZE + 1];
        }
        getStride(r) {
          return this.isStride1 ? 1 : this.data[r * this.SIZE + 2];
        }
        get length() {
          return this.data.length / this.SIZE;
        }
      };
      jB = new Uint8Array(256);
      for (let r = 0, B = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-"; r < 64; r++) jB[B.charCodeAt(r)] = r;
      YB = (r) => {
        let B = [], C = 0, t = 0;
        for (let e = 0; e < r.length; e++) {
          let s = jB[r.charCodeAt(e)];
          C |= (s & 31) << t, (s & 32) === 0 ? (B.push(C), C = 0, t = 0) : t += 5;
        }
        return B;
      };
      l = (r, B) => {
        let C = YB(r), t = B ? C.length / 2 : C.length / 3, e = new Uint32Array(t * 3), s = 0, n = 0;
        for (let i = 0; i < t; i++) s += C[n++], e[i * 3] = s, s += C[n++], e[i * 3 + 1] = s, e[i * 3 + 2] = B ? 1 : C[n++];
        return e;
      };
      iC = (r) => {
        let B = YB(r), C = /* @__PURE__ */ new Map(), t = 0;
        for (let e = 0; e < B.length; e += 2) {
          t += B[e];
          let s = B[e + 1], n = s >>> 1 ^ -(s & 1);
          C.set(t, t + n);
        }
        return C;
      };
      nB = class {
        constructor(r) {
          this.initializer = r, this.cache = /* @__PURE__ */ new Map();
        }
        has(r) {
          return r in this.initializer;
        }
        get(r) {
          if (this.cache.has(r)) return this.cache.get(r);
          let B = this.initializer[r], C = B ? B() : null;
          return this.cache.set(r, C), C;
        }
      };
      J = class {
        static _CASE_ORBIT = null;
        static get CASE_ORBIT() {
          return this._CASE_ORBIT || (this._CASE_ORBIT = iC("rCgCIgCY+rQI4QiCuuBLgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCCgCBgCBgCBgCBgCBgCBgCB+7OB-BB-BB-BB-BB-BBskQB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BC-BB-BB-BB-BB-BB-BB-BByHBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBDCBBBCBBBCBBCCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBCCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBxHBCBBBCBBBCBBB3SBmMBkNBCBBBCBBB8MBCBBB6MB6MBCBBC+EB0MB2MBCBBB6MB+MBiGBmNBiNBCBBBmKBikzCBmNBqNBkIBsNBCBBBCBBBCBBB0NBCBBB0NDCBBB0NBCBBByNByNBCBBBCBBB2NBCBBDCBBCwDFCBCBDBCBCBDBCBCBDBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBB9EBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBCCBCBDBCBBBhGBvDBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBjICCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBH2iVBCBBBlKBwiVB+jVB+jVBCBBBlMBqEBuEBCBBBCBBBCBBBCBBBCBBB+hVB4hVB8hVBjNB7MC5MB5MCzMC1MB+0yCE5MB20yCC9MBu2yCBwyyCBo0yCChNBlNBo0yCBu-UBi0yCDlNC6-UBpNDrNIu+UDzNCm0yCBzNE0yyCBzNBpEBxNBxNBtEG1NLqxyCBkxyCnFoFrBCBBBCBBDCBBEkIBkIBkICoHHsCCqCBqCBqCCgEC+DB+DBmkOBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCC+BBgCBgCBgCBgCBgCBgCBgCBgCBrCBpCBpCBpCBmjOB-BB8BB-BB-BBgEB-BB-BByBBqgOBsDB-BBtwBB-BB-BB-BBsBBgDBCB-BB-BB-BBeB-BB-BB61OB-BB-BB-DB9DB9DBQB7DBmCE9CBrDBPBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBrFB-EBOBnHB3FB-FCCBBBNBCBBCjIBjIBjIBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgFBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCB-BB-BB8kMB-BB6kMB-BB-BB-BB-BB-BB-BB-BB-BB-BBokMB-BB-BBkkMBkkMB-BB-BB-BB-BB-BB-BB-BB4jMB-BB-BB-BB-BB-BB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EB-EBCBBBCBoiMBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBJCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBeBCBBBCBBBCBBBCBBBCBBBCBBBCBBBdBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBCgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDL-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-C64CgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOBgmOCgmOGgmODg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FBg8FDg8FBg8FBg8FhVg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBg9rCBQBQBQBQBQBQDPBPBPBPBPBPjkC7mMB5mMBnmMBjmMBCBlmMB3lMBpiMBk8kCBCBBG-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FB-7FD-7FB-7FB-7F6FoglCEsuHRwjlCyDCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCB0DBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBG1DD97OCCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQBQBQBQBQDPBPBPBPBPBPDQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQBQBQBQBQDPBPBPBPBPBPEQCQCQCQCPCPCPCPBQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPB0EB0EBsFBsFBsFBsFBoGBoGBgIBgIBgHBgHB8HB8HDQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQBQBQBQBQBQBQBPBPBPBPBPBPBPBPBQBQCSFPBPBzEBzEBRCxnOFSFrFBrFBrFBrFBREQBQClkOFPBPBnGBnGFQBQCljOCODPBPB-GB-GBNHSF-HB-HB7HB7HBRqJ53OE9tQBrmQH4Bc3BSgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBgBBfBfBfBfBfBfBfBfBfBfBfBfBfBfBfBfECBByZ0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BB0BBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzBBzB34BgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDBgDB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CB-CBCBBBt-UBruHBt+UB1iVBviVBCBBBCBBBCBBB3hVB5-UB9hVB7hVCCBBCCBBI9jVB9jVBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBICBBBCBBECBBN-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOB-lOC-lOG-lOzoeCBBBCBBBCBBBCBBBCBBBCBl8kCBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBTCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBnECBBBCBBBCBBBCBBBCBBBCBBBCBBDCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBKCBBBCBBBnglCBCBBBCBBBCBBBCBBBCBBECBBBvyyCDCBBBCBBBgDCCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBn0yCB90yCB10yCBh0yCBn0yCCjxyCBzyyCBpxyCBg6BBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBB-CBl0yCBvjlCBCBBBCBBBt2yCBCBBBCBBBCBBBCBBBCBBBCBBBCBBBCBBBhkzCZCBB9a-5Bd-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCB-8rCm6TCBB7gBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCH-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BmlBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvChDwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCBwCFvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvCBvC1DuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCCuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCBuCCuCBuCBuCBuCBuCBuCBuCCuCBuCCtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCCtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCBtCCtCBtCBtCBtCBtCBtCBtCCtCBtCk2BgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEBgEO-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-DB-D+CgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCL-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-B74CgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BhrVgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCBgCB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BB-BhB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BB2BD1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BB1BtxekCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBkCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjCBjC")), this._CASE_ORBIT;
        }
        static _Print = null;
        static get Print() {
          return this._Print || (this._Print = new D(l("hB9CBjBLBCpWBDFBFGBCCCBSBCsMBClBBDxBBDCBC2BBJaBFFBSVBC-FBCvBBD6BBDkDBP6BBDwBBDOBCbBDCCBJBGfBIqCBCgFBCHBDBBDVBCGBCEEBCBDIBDBBDDBJFFBCCBDBDYBDCBCFBFBBDVBCGBCBBCBBCBBDCCBDBFBBDCBEIIBCBCIIBPBLCBCIBCCBCVBCGBCBBCEBDJBCCBCCBDQQBCBDLBIGBCCBCHBDBBDVBCGBCBBCEBDIBDBBDCBICBFBBCEBDRBLBBCFBECBCDBEBBCCCBEEBEEBBBELBFEBECBCDBDHHPUBGMBCCBCWBCPBDIBCCBCDBIBBCCBCBBDDBDJBIVBCCBCWBCJBCEBDIBCCBCDBIBBGCBCDBDJBCCBNMBCCBCyBBCCBCFBFPBDZBCCBCRBEXBCIBCDDBFBEFFBEBCCCBGBHJBDCBN5BBFcBmBBBCCCBDBCXBCCCBVBDEBCCCBFBCJBDDBhBnCBCjBBFmBBCjBBCOBCMBmBlGBCGGD4LBCDBDGBCCCBCBDoBBCDBDgBBCDBDGBCCCBCBDOBC4BBCDBDiCBDfBEZBH1CBDFBD-TBCbBE4CBIVBKXBKTBNMBCCBCBBN9CBDJBHJBHNBCKBH4CBIqBBGlCBLeBCLBFLBFEEBoBBDEBMrBBFZBHKBE9BBDgCBCcBDKBHJBHNBDtBBDLBVsCBClFBJ7BBEOBE9BBGqBBDKBJqBBG1QBDFBDlBBDFBDHBCGCBdBD0BBCOBCNBDFBCSBDCBCIBSXBJuBBSBBDaBCMBEhBBPgBBQrEBF5UBXKBWz4BBD9LBGsBBCGGD3BBIBBPXBKGBCGBCGBCGBCGBCGBCGBCGBC9DBjBZBC4CBN1GBbPBC+BBC1CBDmDBGqBBC9CBC1CBKvBBCszcBE2BBK7KBV3FBJ8GBV7BBEJBH3BBJlCBJLBHzDBMdBEtCBCKBFgBBC2BBKNBDJBDmDBZbBLFBDFBDFBKGBCGBC7BBF9DBDJBHj9KBNWBFwBBloItLBDpDBnBGBNEBGZBCEBCCCBCCBCCBoUBhBpBBHyBBCSBCDBFEBCmEBF9FBEFBDFBDFBDCBEGBCGBOBBDLBCZBCSBCBBCOBDNBjB6DBGCBFsBBE3CBCMBEwBwBBsBBjEcBEwBBQbBFjBBKdBGqBBGdBCkBBFNBrB9EBDJBHjBBFjBBFnBBJzBBMLBCOBCGBCBBCKBCOBCGBCBBEzBBN2JBKVBLHBZFBCpBBCIBmCFBDCCBqBBCBBEDDBVBCnCBJIBxBSBCBBGgBBEaBGaBnB3BBFTBDxBBCBBGHBCCBCcBDCBFJBIIBI-BBhBmBBFLBK1BBEcBDaBGZBIDBNGBxCoCB4ByBBOyBBItBBJJBHlBBEcBJBBxGeBCpBBCCBDBBRFBJIBiBtBBJpBBXZBnBbBVWBKtCBFjBBK9BBCEBOYBIJBH0BBCRBJmBBK-CBCTBMRBCuBB-BGBCCCBCBCOBCKBH6BBGJBHDBCHBDBBDVBCGBCBBCEBCJBDBBDCBDHHGGBDGBEEBMJBCDDClBBCJBCDDCDBCJBCBBJBBe7CBCEBfnCBJJBnF1BBDlBBjBkCBMJBHMBU5BBHJBHTBdaBDOBFWB6F7BBlDyCBNHBDDDBGBCBBCdBCBBDLBKJBnCHBDtBBDKBcnCBJyCBOoCBIJB3CHB5ChBBPJBHIBCsBBCNBLcBEfBDVBCNBqCGBCBBCrBBECCBCCBHBJJBHFBCBBCkBBCBBCFBIJBHrBBFJB3HYBIQBCoBBEcB2CQQBwBBO6cBnDuDBCEBMjGBtyCiDBOvhBBRVBL68DBGmSB61G5BBn2B4RBIeBCJBFwCBCJBHdBDFBLlCBLJBCGBCUBGSBxN5BBnG6CBGYBDYBtBqCBF4BBIQBhCEBMGBK1mHBqBfBiDyDB+vIDBCGBCBBCiJBQeeBBBDPPBCBJrMBloCqDBGMBEIBIJBDDBh7D8HBEzNBHWBQQBQtBBDWBKzDB9B1HBLmBBDpCBJvDBWlCB7DTBNTBN2CBKYBoE0CBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDjJBD9VBQEBCOBxiBeBHFB2GGBCQBDGBCBBCEBG9BBiBxDxDBrBBENBDJBFBBhKeBS5BBGxOxOBoBB3GqBBFhGhGBdBCVBJBBhHGBCDBCBBCOBCkGBDPBqBrCBFJBFBByYjCBtC8BBjGDBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQB1BBBvIrBBFjDBNOBDOBCOBCkBBLtFB5BcBOrBBFIBIBBPFB7E4eBEQBEMBE5GBHLBFQQBKBF3BBJJBHnBBJdBDLBFBBPIBoB3KBJNBDMBEKBE4BBCFFBOBDLBFJBIyEBCmDBmgB-2pBBhB9oEBDt0FBDwpHBQtTBjtC9QBjvBq6EBGppIBnkzVvHB", false))), this._Print;
        }
        static CATEGORIES = new nB({ C: () => new D(l("AfBgDgBBOrWrWBHHBCBICCVuMuMnBBBzBBBE4B4BBGBcDBHQBXhGhGxBBB8BBBmDNB8BBByBBBQddBCCMEBhBGBsCiFiFJBBDBBXIICCBFBBKBBDBBFHBCDBDGGBaaBEEHDBDBBXIIDGDBCCGDBDBBECBCGBFCCBFBSJBEKKEXXIDDGBBLIEBCCBNBFBBNGBIEEJBBDBBXIIDGGBKKBDDBEEBFBEDBDGGBTTBIBDHHBBBEFFBBBDCCDCBDCBECBNDBGCBEFFBCCBEBCNBWEBOEEYRRBKKEFFBFBDEEDBBFBBLGBXEEYLLGBBKEEFGBDEBEFFBLLELBOEE0BEEHDBRBBbEETCBZKKCBBICBCDBHCCJFBLBBELB7BDBekBBDCCGZZCYYBGGCIILBBFfBpClBlBBCBoBlBlBQOOBjBBnGCCBDBCBB6LFFBIICFFBqBqBFBBiBFFBIICFFBQQ6BFFBkCkCBhBhBBBBbFB3CBBHBB+UCB6CGBXIBZIBVLBOEEDLB-CBBLFBLFBPMMBEB6CGBsBEBnCJBgBNNBCBNDBCCBrBBBGKBtBDBbFBMCB-BBBiCeeBMMBEBLFBPBBvBBBNTBuCnFnFBGB9BCBQCB-BEBsBBBMHBsBEB3QBBHBBnBBBHBBJGCgBBB2BQQPBBHUUBEEKMMBDBbEByBPBDBBcOOBBBjBNBiBOBtEDB7UVBMUB14BBB-LEBuBCCBDBCBB5BGBDNBZIBI4BI-DhBBb6C6CBKB3GZBxC3C3CBoDoDBDBsB-C-C3CIBxBuzcuzcBBB4BIB9KTB5FHB+GTB9BCBLFB5BHBnCHBNFB1DKBfCBvCMMBCBiB4B4BBHBPBBLBBoDXBdJBHBBHBBHIBIII9BDB-DBBLFBl9KLBYDByBjoIBvLBBrDlBBILBGEBbGGCGDrUfBrBFB0BUUFDBGoEoEBCB-FCBHBBHBBHBBECBIIIBLBDBBNbbUDDQBBPhBB8DEBEDBuBCB5COOBBBCuBBvBhEBeCByBOBdDBlBIBfEBsBEBfmBmBBCBPpBB-EBBLFBlBDBlBDBpBHB1BKBNQQIDDMQQIDDBBB1BLB4JIBXJBJXBHrBrBKkCBHBBCtBtBDCBCBBYpCpCBGBKvBBUDDBDBiBCBcEBclBB5BDBVBBzBDDBDBJEEeBBEDBLGBKGBhCfBoBDBNIB3BCBeBBcEBbGBFLBIvCBqC2BB0BMB0BGBvBHBLFBnBCBeHBDvGBgBrBrBEBBDPBHHBKgBBvBHBrBVBblBBdTBYIBvCDBlBIB-BGGBLBaGBLFB2BTTBGBoBIBhDVVBJBTwBwBB8BBICCFQQMFB8BEBLFBFJJBDDBXXIDDGLLBDDBEEBCCBEBCEBIBBICBGKBLCCBCCnBLLCBBCFFLDDBGBDcB9CGGBcBpCHBLlFB3BBBnBhBBmCKBLFBOSB7BFBLFBVbBcBBQDBY4FB9BjDB0CLBJBBCBBJDDfDDBNNBHBLlCBJBBvBBBMaBpCHB0CMBqCGBL1CBJ3CBjBNBLFBKuBuBPJBeCBhBBBXPPBnCBIDDtBCBCDDKHBLFBHDDmBDDHGBLFBtBDBL1HBaGBSqBqBBBBe0CBCOBzBMB8clDBwDGGBJBlGryCBkDMBxhBPBXJB88DEBoS41GB7Bl2BB6RGBgBLLBCByCLLBEBfBBHJBnCJBLIIWEBUvNB7BlGB8CEBaBBarBBsCDB6BGBS-BBGKBIIB3mHoBBhBgDB0D8vIBFIIDkJkJBNBCcBEBBCNBFHBtMjoCBsDEBOCBKGBLBBF-6DB+HCB1NFBYOBSOBvBBBYIB1D7BB3HJBoBBBrCHBxDUBnC5DBVLBVLB4CIBamEB2CoCoCDBBCBBDBBFNNCIIiCFFBJJIddFGGCCBI1K1KBlJlJB-V-VBNBGQQBuiBBgBFBH0GBISSBIIDGGBDB-BgBBCvDBuBCBPBBLDBD-JBgBQB7BEBCvOBrB1GBsBDBC-FBgBXXBGBD-GBIFFDQQmGBBRoBBtCDBLDBDwYBlCrCB+BhGBFccDCCBCCLFFCCCBEBCDBCECEDDCBBCICDCCBFFIKFCLLSEBEGGSzBBDtIBtBDBlDLBQBBQQQmBJBvF3BBeMBtBDBKGBDNBH5EB6eCBSCBOCB7GFBNDBCOBNDB5BHBLFBpBHBfBBNDBDNBKmBB5KHBPBBOCBMCB6BCCBCBRBBNDBLGB0EoDoDBjgBBh3pBfB-oEBBv0FBBypHOBvThtCB-QhvBBs6EEBrpIlkzVBxHvw-FB", false)), Cc: () => new D(l("AfgDgB", true)), Cf: () => new D(l("tFzqBzqBBEBXhGhGyBhMhMBxCxCs5D9-B9-BBDBbEByBEBCJBw03B6H6HBBBimEQQj7IPBhjiBDBwmFHBn0rYffB+CB", false)), Cn: () => new D(l("4bBBHDBICCVuMuMnBBBzBBBE4B4BBGBcDBHKBvI9B9BBmDmDBMB8BBByBBBQddBCCMEBjBEBuHJJBDDBXXICCBBBFBBKBBDBBFHBCDBDGGBaaBEEHDBDBBXIIDGDBCCGDBDBBECBCGBFCCBFBSJBEKKEXXIDDGBBLIEBCCBNBFBBNGBIEEJBBDBBXIIDGGBKKBDDBEEBFBEDBDGGBTTBIBDHHBBBEFFBBBDCCDCBDCBECBNDBGCBEFFBCCBEBCNBWEBOEEYRRBKKEFFBFBDEEDBBFBBLGBXEEYLLGBBKEEFGBDEBEFFBLLELBOEE0BEEHDBRBBbEETCBZKKCBBICBCDBHCCJFBLBBELB7BDBekBBDCCGZZCYYBGGCIILBBFfBpClBlBBCBoBlBlBQOOBjBBnGCCBDBCBB6LFFBIICFFBqBqBFBBiBFFBIICFFBQQ6BFFBkCkCBhBhBBBBbFB3CBBHBB+UCB6CGBXIBZIBVLBOEEDLB-CBBLFBLFBbFB6CGBsBEBnCJBgBNNBCBNDBCCBrBBBGKBtBDBbFBMCB-BBBiCeeBMMBEBLFBPBBvBBBNTBuCnFnFBGB9BCBQCB-BEBsBBBMHBsBEB3QBBHBBnBBBHBBJGCgBBB2BQQPBBHUUBEEKmDmDNBBcOOBBBjBNBiBOBtEDB7UVBMUB14BBB-LEBuBCCBDBCBB5BGBDNBZIBI4BI-DhBBb6C6CBKB3GZBxC3C3CBoDoDBDBsB-C-C3CIBxBuzcuzcBBB4BIB9KTB5FHB+GTB9BCBLFB5BHBnCHBNFB1DKBfCBvCMMBCBiB4B4BBHBPBBLBBoDXBdJBHBBHBBHIBIII9BDB-DBBLFBl9KLBYDByBDBvzIBBrDlBBILBGEBbGGCGDrUfBrBFB0BUUFDBGoEoEBCC-FCBHBBHBBHBBECBIIIBIBGBBNbbUDDQBBPhBB8DEBEDBuBCB5COOBBBCuBBvBhEBeCByBOBdDBlBIBfEBsBEBfmBmBBCBPpBB-EBBLFBlBDBlBDBpBHB1BKBNQQIDDMQQIDDBBB1BLB4JIBXJBJXBHrBrBKkCBHBBCtBtBDCBCBBYpCpCBGBKvBBUDDBDBiBCBcEBclBB5BDBVBBzBDDBDBJEEeBBEDBLGBKGBhCfBoBDBNIB3BCBeBBcEBbGBFLBIvCBqC2BB0BMB0BGBvBHBLFBnBCBeHBDvGBgBrBrBEBBDPBHHBKgBBvBHBrBVBblBBdTBYIBvCDBlBIBlCJBCBBaGBLFB2BTTBGBoBIBhDVVBJBTwBwBB8BBICCFQQMFB8BEBLFBFJJBDDBXXIDDGLLBDDBEEBCCBEBCEBIBBICBGKBLCCBCCnBLLCBBCFFLDDBGBDcB9CGGBcBpCHBLlFB3BBBnBhBBmCKBLFBOSB7BFBLFBVbBcBBQDBY4FB9BjDB0CLBJBBCBBJDDfDDBNNBHBLlCBJBBvBBBMaBpCHB0CMBqCGBL1CBJ3CBjBNBLFBKuBuBPJBeCBhBBBXPPBnCBIDDtBCBCDDKHBLFBHDDmBDDHGBLFBtBDBL1HBaGBSqBqBBBBe0CBCOBzBMB8clDBwDGGBJBlGryCBkDMB3iBJB88DEBoS41GB7Bl2BB6RGBgBLLBCByCLLBEBfBBHJBnCJBLIIWEBUvNB7BlGB8CEBaBBarBBsCDB6BGBS-BBGKBIIB3mHoBBhBgDB0D8vIBFIIDkJkJBNBCcBEBBCNBFHBtMjoCBsDEBOCBKGBLBBJ76DB+HCB1NFBYOBSOBvBBBYIB1D7BB3HJBoBBBjGUBnC5DBVLBVLB4CIBamEB2CoCoCDBBCBBDBBFNNCIIiCFFBJJIddFGGCCBI1K1KBlJlJB-V-VBNBGQQBuiBBgBFBH0GBISSBIIDGGBDB-BgBBCvDBuBCBPBBLDBD-JBgBQB7BEBCvOBrB1GBsBDBC-FBgBXXBGBD-GBIFFDQQmGBBRoBBtCDBLDBDwYBlCrCB+BhGBFccDCCBCCLFFCCCBEBCDBCECEDDCBBCICDCCBFFIKFCLLSEBEGGSzBBDtIBtBDBlDLBQBBQQQmBJBvF3BBeMBtBDBKGBDNBH5EB6eCBSCBOCB7GFBNDBCOBNDB5BHBLFBpBHBfBBNDBDNBKmBB5KHBPBBOCBMCB6BCCBCBRBBNDBLGB0EoDoDBjgBBh3pBfB-oEBBv0FBBypHOBvThtCB-QhvBBs6EEBrpIm8yVBCdBhD-DBxHvw-BB---BBB---BBB", false)), Co: () => new D(l("gg4B-nGh4hc9--BD9--B", true)), Cs: () => new D(l("gg2B--B", true)), L: () => new D(l("hCZBHZBwBLLFGGBVBCeBCpOBFLBPEBICCiEEBCBBDDBCHHCCBCCCBSBCyCBCqEBJlFBClBBDHHBnBBoCaBFDBuBqBBkBBBCiDBCQQBIIBLLBBBDRRCdBe4CBMZZBfBKBBFGGBUBFKKEYYBXBIKBGXBCGBRpBB7B1BBETTIJBQPBFHBDBBDVBCGBCEEBCBERROBBCCBPBBLJJBEBFBBDVBCGBCBBCBBCBBgBDBCUUBBBRIBCCBCVBCGBCBBCEBETTQBBYMMBGBDBBDVBCGBCBBCEBEffBCCBBBQSSCFBECBCDBEBBCCCBEEBEEBBBELBX1B1BBGBCCBCWBCPBEbbBBBCBBDBBfFFBGBCCBCWBCJBCEBEffBBBCBBQBBSIBCCBCoBBDRRGCBJCBZFBGRBEXBCIBCDDBFB7BvBBCBBNGB7BBBCCCBDBCXBCCCBIBCBBKDDBDBCWWBCBhBgCgCBGBCjBBcEB0DqBBVRRBEBFDBEEEBIIBBBFMBNSSBkBBCGGDqBBCsKBCDBDGBCCCBCBDoBBCDBDgBBCDBDGBCCCBCBDOBC4BBCDBDiCBmBPBR1CBDFBErTBDQBCZBGqCBHHBIRBOSBPRBPMBCCBQzBBkBFFkC4CBIEBDhBBCGGBkCBLeByBdBDEBMrBBFZB3BWBK0BBzC+C+CBtBBSHB3BdBOBBLrBBbjBBqBCBLjBBDKBGqBBDCBqBDBCFBCBBEGGB+FBhC1IBDFBDlBBDFBDHBCGCBdBD0BBCGBCEEBBBCGBEDBDFBFMBGCBCGB1DOORMBmDFFDJBCEEBDBHGCBCBCKBDDBGEBF1B1BB8zC8zCBjHBHDBEBBNlBBCGGD3BBIRRBVBKGBCGBCGBCGBCGBCGBCGBCGBxC2O2OBrBrBBDBGBBF1CBHCBC5CBCDBGqBBC9CBSfBxBPBhQ-tGBhCs0VBkCtBBDsIBEPBLBBVuBBReBDlCByBIBDmDBDxCBVQBCCBCDBCWBezBBPxBB-BFBECCBMMBaBLWBacBIuBBdRRBDBCJBLEBCoBBYCBCHBVWBEEEBwBBCEEBDDBDBDCCZCBDKBICBNFBDFBDFBKGBCGBCqBBCNBHyDBej9KBNWBFwBBloItLBDpDBnBGBNEBGCCBIBCMBCEBCCCBCCBCCBqDBiBqLBT-BBD1BBpBLB1DEBCmEBlBZBHZBM4CBEFBDFBDFBDCBkBLBCZBCSBCBBCOBDNBjB6DBmMcBEwBBwBfBOTBCHBHlBBLdBDjBBFHBxB9EBTjBBFjBBFnBBJzBBNKBCOBCGBCBBCKBCOBCGBCBBEzBBN2JBKVBLHBZFBCpBBCIBmCFBDCCBqBBCBBEDDBVBLWBKeBiCSBCBBLVBLZBHZBnB3BBHBBhCQQBCBCCBCcBrBcBEcBkBHBCbBc1BBLVBLSBORBvDoCB4ByBBOyBBOjBBnBbBKWB7HpBBHBBRFB5BcBLJJBUBrBRBvBUBcWBN0BB6BBBDOOBrBBhBYBbjBBeDDJiBBENNBuBBPDBWCCkBRBCYBUBBgCGBCCCBCBCOBCJBIuBBnBHBDBBDVBCGBCBBCEBETTNEBfJBCDDClBBCaaCtBtBBzBBTDBVCBfvBBVBBC5F5FBtBBqBDBlBvBBV8B8BBpBBOoCoCBZBmBGB6FrBB1D-BBgBHBDDDBGBCBBCXBQCC-CHBDmBBRCCdLLBmBBIWWMtBBUTTBnCBoGgBBgBIBCkBBSyByBBcBxDGBCBBClBBWaaBEBCBBCfBPYYBqBBlISBQCCBLBChBB9DwCwCB4cBnHjGBtyCgDBQvhBBSFBa68DBGmSB61GdBj3B4RBIeBSuCBSdBTvBBRDBgBUBGSBxNsBB0G-BBhBYBDYBtBqCBGjCjCBLBhCBBCPPBNNB0mHBqBfBiDyDB+vIDBCGBCBBCiJBQeeBBBDPPBCBJrMBloCqDBGMBEIBIJBn7F0CBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDYBCYBCeBCYBCeBCYBCeBCYBCeBCYBCHB15BeBHFBmI9BBzEsBBLGBRiKiKBcBTrBBlPbBlHdBDwGwGBdBCCBCBBCGBDEBKBBhHGBCDBCBBCOBCkGB8BjCBI1lB1lBBCBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQBlqE-2pBBhB9oEBDt0FBDwpHBQtTBjtC9QBjvBq6EBGppIB", false)), LC: () => new D(l("hCZBHZB7BLLBVBCeBCiGBCDBFvGBDZBhGDBDBBECBCHHCCBCCCBSBCyCBCqEBJlFBClBBKoBB44ClBBCGGDqBBDCBhV1CBDFBjkCKBGqBBDCBhCrBBgCMBChBBmD1IBDFBDlBBDFBDHBCGCBdBD0BBCGBCEEBBBCGBEDBDFBFMBGCBCGBmIFFDJBCEEBDBHGCBCBCFBFDDBCBGEBF1B1BB8zC8zCB6DBDmDBHDBEBBNlBBCGGzoetBBTbBnEtCBCWBEDBCsCBZBBE2Z2ZBpBBGIBIvCBh6TGBNEBqgBZBHZBmlBvCBhDjBBFjBB1DKBCOBCGBCBBCKBCOBCGBCBBk2ByBBOyBB+CVBLVB74C-BBhrV-BBhBYBDYBtpZ0CBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDYBCYBCeBCYBCeBCYBCeBCYBCeBCYBCHB15BJBCTBHFB2uCjCB", false)), Ll: () => new D(l("hDZB7BqBqBBWBCHBC2BCBQCBuBCDECBBBDCCDEEBFFDEEBBBDDDCCCDCCBCCDEECDDBDDBBBHGDCOCBSCBDDCEEC4BCBFBDDDBCCFICBjCBDZBiGCCEEEBBBTccBhBBCBBECBCWCBDBCGDB0B0BBuBBCgBCK0BCDMCBgDCxBoBBo6CqBBDCB5XFBjkCIBC2D2DBqBBgCMBChBBnD0ECBHBCgDCBHBJFBLHBJHBJFBLHBJHBJNBDHBJHBJHBJEBCBBHEEBBBCBBJDBDBBJHBLCBCBBzIEEBEEcKFDBBJDBF2B2Bs1CvBBCEEBGCFCCBCCBEBGiDCBIICFFNlBBCGG0oesBCUaCoEMCBBBC+BCBGBCCCDICFCCDCCBBBCSCGGGCMCFCCDOCbEE2ZqBBGIBIvCBh6TGBNEBqhBZBumBnBBpEjBB8EKBCOBCGBCBBk4ByBB+DVB75CfBhsVfB8BYBnqZZBbGBCRBbZBbDBCCCBFBCKBbZBbZBbZBbZBbZBbZBbZBbZBbbBdYBCFBbYBCFBbYBCFBbYBCFBbYBCFBC15B15BBIBCTBHFB4vChBB", false)), Lm: () => new D(l("wVRBFLBPEBICCmEGG-OnHnHlFBBuIBBFgBgBKEEhFoFoF1mBgEgE2R72B72BsDkTkTxOFBvF+BBOjBjBBjBByVOORMBg-CBByHgGgG2OsBsBBDBGiDiDB+C+CBBB34bjnBjnBBEBvIzDzDdBB6DIBxCYYpDDBEBB2OXXqEtDtDWBBoDDBKngVngVuBBBh-BFBCpBBCIB0sBhBhB2K04D04DnrTDB9PCBpBBBnRMBhCBBCPPB9-P9-PBCBCGBCBByhM9BBqGGBud0Q0QsSAB", false)), Lo: () => new D(l("qFQQhIFFBCBxGBB7ZaBFDBuBfBCJBkBBBCiDBCZZBLLBBBDRRCdBe4CBMZZBfBWVBrBYBIKBGXBCGBRoBB8B1BBETTIJBROBFHBDBBDVBCGBCEEBCBERROBBCCBPBBLJJBEBFBBDVBCGBCBBCBBCBBgBDBCUUBBBRIBCCBCVBCGBCBBCEBETTQBBYMMBGBDBBDVBCGBCBBCEBEffBCCBBBQSSCFBECBCDBEBBCCCBEEBEEBBBELBX1B1BBGBCCBCWBCPBEbbBBBCBBDBBfFFBGBCCBCWBCJBCEBEffBBBCBBQBBSIBCCBCoBBDRRGCBJCBZFBGRBEXBCIBCDDBFB7BvBBCBBNFB8BBBCCCBDBCXBCCCBIBCBBKDDBDBYDBhBgCgCBGBCjBBcEB0DqBBVRRBEBFDBEEEBIIBBBFMBNyDyDBnKBCDBDGBCCCBCBDoBBCDBDgBBCDBDGBCCCBCBDOBC4BBCDBDiCBmBPByDrTBDQBCZBGqCBHHBIRBOSBPRBPMBCCBQzBBpBkCkCBhBBC0BBIEBDhBBCGGBkCBLeByBdBDEBMrBBFZB3BWBK0BBxFuBBSHB3BdBOBBLrBBbjBBqBCBLdByDDBCFBCBBE7hB7hBBCB4-C3BBZWBKGBCGBCGBCGBCGBCGBCGBCGBoR2B2BF1CBJCCB4CBFGGBpBBC9CBSfBxBPBhQ-tGBhC0wUBC2jBBkCnBBJrIBFPBLBBjCyByBBkCBqFoDoDEGBCCBCDBCWBezBBPxBB-BFBECCBMMBaBLWBacBIuBBuBEBDIBLEBCoBBYCBCHBVPBCFBEEEBwBBCEEBDDBDBDCCZBBEKBIPPBEBDFBDFBKGBCGByEiBBej9KBNWBFwBBloItLBDpDBkCCCBIBCMBCEBCCCBCCBCCBqDBiBqLBT-BBD1BBpBLB1DEBCmEBqDJBCsBBDeBEFBDFBDFBDCBkBLBCZBCSBCBBCOBDNBjB6DBmMcBEwBBwBfBOTBCHBHlBBLdBDjBBFHBhEtCBjDnBBJzBB9CzBBN2JBKVBLHB5EFBDCCBqBBCBBEDDBVBLWBKeBiCSBCBBLVBLZBHZBnB3BBHBBhCQQBCBCCBCcBrBcBEcBkBHBCbBc1BBLVBLSBORBvDoCB4FjBBnBDBCxJxJBoBBHBBRCBCBB5BcBLJJBUBrBRBvBUBcWBN0BB6BBBDOOBrBBhBYBbjBBeDDJiBBENNBuBBPDBWCCkBRBCYBUBBgCGBCCCBCBCOBCJBIuBBnBHBDBBDVBCGBCBBCEBETTNEBfJBCDDClBBCaaCtBtBBzBBTDBVCBfvBBVBBC5F5FBtBBqBDBlBvBBV8B8BBpBBOoCoCBZBmBGB6FrBB0GHBDDDBGBCBBCXBQCC-CHBDmBBRCCdLLBmBBIWWMtBBUTTBnCBoGgBBgBIBCkBBSyByBBcBxDGBCBBClBBWaaBEBCBBCfBPYYBnBBCBBlISBQCCBLBChBB9DwCwCB4cBnHjGBtyCgDBQvhBBSFBa68DBGmSB61GdBj3B4RBIeBSuCBSdBTvBB0BUBGSB0NnBB2MqCBGwFwFB0mHBqBfBiDyDBuwIiJBQeeBBBDPPBCBJrMBloCqDBGMBEIBIJBxzI2P2PBrBBiBiKiKBcBTrBBlPaBmHdBDwGwGBdBCCBCBBCGBDEBKiHiHBFBCDBCBBCOBCkGB8pBDBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQBlqE-2pBBhB9oEBDt0FBDwpHBQtTBjtC9QBjvBq6EBGppIB", false)), Lt: () => new D(l("lOGDnB2sH2sHBGBJHBJHBNQQwBAB", false)), Lu: () => new D(l("hCZBmDWBCGBiB2BCDOCDuBCBECEBBCCCBCCBBBDDBCBBCCBEBBCBBCECBCCDCCBCCBBBCCCBEEIJDCMCDQCDDDCCBC4BCIBBCBBDCCBCBCGCiJCCEJJHCCBBBCCCBCCBPBCIBkBDDBBBEWCGDDCBBDyBBxBgBCK2BCBMCD+CCDlBBq6ClBBCGGzW1CB0kCHHBpBBDCBhK0ECKgDCKHBJFBLHBJHBJFBMGCJHBpCDBNDBNDBNEBMDBnIFFECBDCBDEEBDBHGCBCBDDBLBBG+B+B9zCvBBxBCCBBBDGCBCBCDDJCBCgDCJCCFuqeuqeCqBCUaCoEMCE8BCLECBICFCCDCCEUCBDBCEBCOCBCBCCCBQCZs5Vs5VBYBmmBnBBpEjBB9EKBCOBCGBCBBr3ByBB+EVB75CfBhsVfBhCYBoqZZBbZBbZBbCCBGDBDDBCBCHBbZBbBBCDBDHBCGBcBBCDBCEBCEEBFBcZBbZBbZBbZBbZBbZBfYBiBYBiBYBiBYBiBYBiB2pE2pEBgBB", false)), M: () => new D(l("gYvDB0IGBoIsBBCCCBCCBCCpCKBxBUBRmDmDBFBDFBDBBCDBkBffBZB8CKB7BIBKZZBCBCIBCCBCEBsBCB8BIBrBXBCgBB3BCBCRBCGBLBBeCB5BCCBFBDBBDCBKLLBbbDCB5BCCBDBFBBDCBEffBEEMCB5BCCBGBCCBCCBVBBXFBCCB5BCCBFBDBBDCBICBLBBf8B8BBDBECBCDBKpBpBBDB4BCCBFBCCBCDBIBBMBBeCB5BCCBFBCCBCDBIBBMBBQNNBCB4BBBCGBCCBCDBKLLBeeBBBnCFFBEBCCCBGBTBB+BDDBFBNHBjDDDBHBMGBqCBBcECFBByBTBCBBGKBCjBBKlDlDBSBYDBFCBCCBDGBEDBOLBCLLBCBgWCBzdDBdCBeBBfBBhCfBKuBuBBBBC2D2DBjBjB3DLBFLB8GEB6BJBCcBDxBxBBsBBDLBVEBwBQBnBIBNCBfMB5BNBxBTB5ECBCUBFHHDCBnG-BBxWgBB--CCBuEhDhDBeBrRFBqDBB1udDBCJBhBBBxCBBxIEEFYYBDBF0C0CBzBzBBQBbRBOnBnBBGBaMBtBDBwBNBlBkCkCBMBNJJBuBuBBBBzBCCBBBDBBGBBCqBqBBDBGBBtHHBCBBx5TiXiXBOBRPBuejHjH2EEBn0BCBCBBGDBpBCBFmFmFB+R+RBCBiCEB+JBBuCFBnCKByBDB7DCB2BOBqBDDBLLBCBuBKBI+B+BBBBlBNBRBBtBNNBBBxBNBJDBCBB9CLBHDD+ELBWDB4BBBCGBDBBDCBKLLBDDBFBEEBkCIBCDDCDBCEBCPPBzCzCBQBYyCyCBSBsHGBDIBcBBzCQBrDMBmDOBhIOB2HFBCBBDDBCCCBuEuEBFBDGBEddBIBpBGBCDBJKKBJBvBPBnGHBoGHBCHBzCVBCNB7DFBECCBCCBFBCjCjCBDBCBBCEB8KDBKBBCxBxBBFBEEBYmnFmnFHOBpmLRBhuCEB8BGB5gBCCB1BBIDByCMMBslTslTBizEizEBsBBDWB-QEBEFBJHBDGBfDB1ECB89B2BBFxBBJPPXEBCOBxqBGBCQBDGBCBBCEBlDhFhFBFB4L+B+BBCB9PDB-HBB0HDDIBBG7O7OBFBuDGB29lYvHB", false)), Mc: () => new D(l("joC4B4BDCBJDBCBBzBBB7BCBHBBDBBLsBsB7BCBjC7B7BBBBJCCB2B2BB7B7BCHHBDDBLLnDBBCBBECBCCBLqBqBBBB+BDB+BBB7BCCBDBDBBCBBKBBdPPB7B7BBBBGCBCCBLrBrBBsCsCBBBHHBTBBrKBBgCsFsFBFFHDDBaaBLLBBBDGBWBBDFBDLLBBB5zBffiEIIBGBCBB7KDBDCBFBBCFBhHBB7BCCKCCBJJBEByExBxBGCCBDBCBB+BffFBBD9B9BDCBCEEBxBxBBGBJBBsFWW35EBB0-dBBD5C5CBzBzBBOBvEBBwBxBxBBFFBDDBBBvDBBDBBZuBuBCuDuDDBBGuHuHBCCBCCBCC0gZCCgEuBuBBBBFBB0DZZB8B8BxBCBKBBO+C+CBBBEBBCrFrFBBBgBBB7BBBCDBDBBDCBKLLB1C1CBBBIDDCDBCBBCmDmDBBBJBBErDrDBBBHCCBCBDuHuHBBBHDBDyDyDBBBJBBCuDuDCBBHoDoDCBBFmImIBBBK4H4HBEBCBBFDDCvEvEBBBJDBF1C1CeBB-BqGqGECCoGPPrDIID2G2GBDBFBBC-K-KBNNxBBBJBBCpvQpvQBBBlxD2BBpDBB0rYBBHFB", false)), Me: () => new D(l("okBBB1xF-wB-wBBCBCCBsshBCB", false)), Mn: () => new D(l("gYvDB0IEBqIsBBCCCBCCBCCpCKBxBUBRmDmDBFBDFBDBBCDBkBffBZB8CKB7BIBKZZBCBCIBCCBCEBsBCB8BIBrBXBCfB4BCCFHBFEEBFBLBBe7B7BFDBJVVBbbDBB6BFFBFFBDDBBBEffBEEMBB6BFFBDBCBBFVVBXXBEBC7B7BDCCBCBJIIBMMBff+BNNzBEE4BCCBBBGCBCDBIBBMBBe7B7BDHHGBBVBBdBB6BBBFDBJVVBeepCIIBBBC7C7CDGBNHBjDDDBHBMGBqCBBcEC4BNBCEBCBBGKBCjBBKnDnDBCBCFBCBBDBBaBBFCBRDBODDBHHQgWgWBBBzdCBeBBfBBfBBhCBBCGBJDDBJBKuBuBBBBC2D2DBjBjB3DCBFBBKHHBBB8GBBD7B7BCGBCCCDHBHJBDxBxBBMBCeBDLBVDBxBCCBDBCGGpBIBNBBhBDBDBBCCB5BCCBEECCB7BHBDBB5ECBCMBCGBFHHEBBnG-BBxWMBFEEBKB--CCBuEhDhDBeBrRDBsDBB1udFFBIBhBBBxCBBxIEEFaaBGG4EBBbRBOnBnBBGBaKBvBCBxBDDBCBDBBoBkCkCBEBDBBDBBNJJwB0B0BCCBDBBGBBCrBrBBJJvHDDFx5Tx5TiXPBRPBuejHjH2EEBn0BCBCBBGDBpBCBFmFmFB+R+RBCBiCEB+JBBuCFBnCKByBDB8D3B3BBNBqBDDBLLBBByBDBDBBI+B+BBBBlBEBCHB-BNNB1B1BBHBLDBDgDgDBBBDCCBHHD+E+EEHBWBB6BBBEmBmBBFBEEBnCFBOECPBB2CHBDCBCYY1CFBCFFBCCBvHvHBCBHBBCBBcBB2CHBDCCBrDrDCDDBEBCmDmDCDDBCBCEBkIIBCBBhIBBCFFxEDBDBBFhBhBBIBpBFBDDBJKKBEBDCBvBMBCBBnGCCBBBCqGqGBFBCFBCzCzCBUBDGBCBBCBB7DFBECCBCCBFBCpCpCBEEC8K8KBMMB1B1BBDBGCCYmnFmnFHOBpmLLBECBhuCEB8BGB5gBgCgCBCByC5lT5lTBizEizEBsBBDWBhRCBSHBDGBfDB1ECB89B2BBFxBBJPPXEBCOBxqBGBCQBDGBCBBCEBlDhFhFBFB4L+B+BBCB9PDB-HBB0HDDIBBG7O7OBFBuDGB29lYvHB", false)), N: () => new D(l("wBJB5DBBGDDBBBitBJBnEJBnGJB9MJB3DJBFFBtDJB3DJB3DJBDFBvDMB0DJBJGBoDJBpDGBISBuDJBhDJB3DJBnCTBtIJBnCJBwWTBybCBwHJBHJBXJBtJJBhEKBmFJBHJB3FJB3CJBnEJBHJB3gBEEBEBHJBnGyBBDEB3W7BBvCVB3TdBqrBqYqYaIBPCB4KDBrEJBfHBCOBhBJBoBOBh7cJB9FJBhKFB7EJBnBJBnGJBXJB3CJB3MJB34UJBuPsBBN4BBSBB2KaBlBDBeJJnEEBrGJBvdHBaGBoBIBsCEBXFBhFBBDPBDtBBhCIB1BBBfCBsCEBpDHBZHBqBGBrKFBxBJBHJB3IeB-EJBrBDBxDGBnEdBhEJB9BJBxEJBITB8HJB3KJB3DJB3LJBnDJBHTBtCLBlNSB+CJB3UJB3CcBkHJBnCJB3BJBnLJBnDUBshBuDBimPJBnpCJB3CJBnEJBCGBvQJBnIWB+KCB6nXJBnuBTBNTBtDYB2iBxBBhqCJBnNJB3PJB4HJBtWIBhEJB4Y6BBCCBCDBtCsBBCOBjeMBk3CJB", false)), Nd: () => new D(l("wBJnxBJnEJnGJ9MJ3DJ3DJ3DJ3DJ3DJ3DJ3DJ3DJ3DJhDJ3DJnCJ3IJnCJn6BJnBJtJJhEJnFJHJ3FJ3CJnEJHJnuiBJnVJnBJnGJXJ3CJ3MJ34UJnsBJnkCJHJ9YJhEJ9BJxEJ3IJ3KJ3DJ3LJnDJHTtCJnNJnDJ3UJ3CJ3HJnCJ3BJnLJ3uQJnpCJ3CJnEJ3QJ37XJ12CxBhqCJnNJ3PJ4HJ2aJ30EJ", true)), Nl: () => new D(l("u3FCBwzCiBBDDB-zDaaBHBPCBs1dJBxyW0BBtOJJnEEBrhIuDBm8SCB", false)), No: () => new D(l("yFBBGDDBBB2pCFB5LFB5DCBmEGB6GGBSIByNJB2hBTB0jBJBhP20B20BEFBHJBnGPBqB3W3WB6BBvCVB3TdBqrB1kB1kBBCBrEJBfHBCOBhBJBoBOBxrdFBymWsBBiCDBSBB2KaBlBDB1pBHBaGBoBIBsCEBXFBhFBBDPBDtBBhCIB1BBBfCBsCEBpDHBZHBqBGBrKFBhLeB-EJBrBDBxDGBnETB8LTBmqBBBvNIBobSB0aUBn8SGB-YWBqhZTBNTBtDYBvqFIBid6BBCCBCDBtCsBBCOBjeMB", false)), P: () => new D(l("hBCBCFBCDBLBBEBBbCBCccCkBkBGEELBBEEE-VJJzOFBqBBB0BCCDDDtBBBVBBCBBOCCBBBrCDBnDsBsBBMBqHCB3BOBgBmImIBLLtE5D5D6DnMnMNwLwL7CLLBpFpFBNBCmBmBBCBoCrCrCBDBFBBwDFBsFlTlTBHB4EuTuTtBBBvCCBoCBB+ECBCCBmBKB6JBB5GBBhEGBCFBhFBBLGBdCB9DDB8BEB-BBBhCHBM9Z9ZBWBJTBCMBCLBfBBPBB6TDBeBB+hBNBwCBBgBJB0MVBgCDBhBBB8XDBCBBxDwEwEBtBBCfBDLBkNCBFJBDLBRNNjD7C7CjgdBBuICBkDLL0DFB9LDB3CBBpBCBCyByBBwBwBiDMBRBB9DDB-DBBRBB6HzqUzqUBxGxGBIBXiBBCNBCFFCBB2ECBCFBCDBLBBEBBbCBCccCCCBFB7MCB9UxBxB-MoXoXoGgBgBxIIBnBxDxDBFBjCGB6CDByO-J-JjBlElEBDBtBDB+FGBuDBBCDB-DDBxBBBwCDBFOOCCB5CFBsDrJrJBCCBzDzDBDBLBBCpDpD7HWBqDCBdMBtCjEjEBBB9HpIpIBBB8E9C9CBGB0CCBCEB+CJB4GgDgDBDBrBBBmUBBrCMBwFxjBxjBBDB97CBB8zOBBmEiCiCBDBJpRpRBBBoJDBoK9lT9lTovHEB07C-a-aBAB", false)), Pc: () => new D(l("-Cg-Hg-HBUU-u3BBBZCBwHAB", false)), Pd: () => new D(l("tB9qB9qB0BiyDiyDmgBqgCqgCBEBiwDDDgBBBFdd-NUUwDxszBxszBBmBmBLqFqFhzD-J-J", false)), Pe: () => new D(l("pB0B0BgB+1D+1DC-6B-6BqtC4B4BQ7T7TCff-hBMCxChBhBCGC1MUChCCCiBmhBmhBCECtBGCtNICEGCDBB-ozB6G6GeOCESSCCCrF0B0BgBGD", false)), Pf: () => new D(l("7F+6H+6HEddpuDCCFDDQEE", false)), Pi: () => new D(l("rFt7Ht7HDBBDaapuDCCFDDQEE", false)), Po: () => new D(l("hBCBCCBDECBLLBEEBcclCGGPBBI-V-VJzOzOBEBqB3B3BDDDtBBBVBBCBBOCCBBBrCDBnDsBsBBMBqHCB3BOBgBmImIBLLtE5D5D6DnMnMNwLwL7CLLBpFpFBNBCxDxDrCEBFBBwDFBsFlTlTBHBmY9D9DBBBoCBB+ECBCCBmBFBCDB6JBB5GBBhEGBCFBhFBBLGBdCB9DDB8BEB-BBBhCHBMjajaBJJBGBJIBDDBDCBEKBCCCBIB7kDDBCBBxDwEwEBFFBBBDDDBHBCBBCDDBLLBDBCJBDDBCCCBLBDCBtNCB6B+F+FjgdBBuICBkDLL0DFB9LDB3CBBpBCBCyByBBwBwBiDMBRBB9DDB-DBBRBB6HlxUlxUBFBDXXVBBDDBECBCDBICBHCCB2E2EBBBCCBDECBLLBEEBcclBDDB7M7MBBB9UxBxB-MoXoXoGgBgBxIIBnBxDxDBFBjCGB6CDB0ZlElEBDBtBDB+FGBuDBBCDB-DDBxBBBwCDBFOOCCB5CFBsDrJrJBCCBzDzDBDBLBBCpDpD7HWBqDCBdMBtCjEjEBBB9HpIpIBBB8E9C9CBGB0CCBCEB+CJB4GgDgDBDBrBBBmUBBrCMBwFxjBxjBBDB97CBB8zOBBmEiCiCBDBJpRpRBBBoJDBoK9lT9lTovHEB07C-a-aBAB", false)), Ps: () => new D(l("oBzBzBgB-1D-1DC-6B-6B-rCEEnB4B4BQ7T7TCff-hBMCxChBhBCGC1MUChCCCiBmhBmhBCECaTTCECtNICEGCDipzBipzB4GeeCMCESSCCCrFzBzBgBEEDAB", false)), S: () => new D(l("kBHHRCBgBCCcCCkBEBCBBDCCBCBDEEfgBgBrODBNNBGGBCCCBPB2DPPBxDxDsErIrIBBB3DCBDDDBvGvGLUUB4H4HIBBpEqLqLBHHB2H2H-DjEjEBGBlEwGwGqBmGmGiGCBQCCBBBDFBVECmEHBCFBCBBGDBmGBBxXJB0WuLuLlL+E+EBgBBiLJBKIBhiBCCBBBMCBOCBOCBOBBmCOOoBCBOCBUhBB-BBBCDBCBBLCCBBBGFBCECFMMBFFBDBGDBC7B7BBFFB2LBFcBD+HBXKByCtCBXnTBtBwBBDeBLyMBX+BBFfBD1LBDpEBmHFBmLBBvBZBC4CBN1GBbPBFOOBNNWBBHBB8CBB0HBBFJBhBlBBKRRBdBMdBJQQBeBLmBBQ-JBhuG-BBx0V2BB6RWBKBBoDBB+EDBLDB+RCBiHPPB+9T+9TpEgBBuLPBhCBB3BHBtBDBjDCCBBBD7E7EHRRBBBgBCCcCCiEGBCGBOBB6JIB6BQBDCBCMBEwBwBBrBB7zBBBwSmWmWBiKiKBGBnjC2kC2kCBbBr6SDBG3qU3qUk7DvHBLCBEzNBHWBQQBgDzDB9B1HBLmBBD7BBGCBXBBIdBF8BBWhCBE7F7FB1CBrbaagBaagBaagBaagBaa9B-PB4BDBzBHBCNBCBBp2BwNwNttCEE+DiOiOBvIvIBqBBFjDBNOBDOBCOBCkBBYgFB5BcBOrBBFIBIBBPFB7E4eBEQBEMBE5GBHLBFQQBKBF3BBJJBHnBBJdBDLBFBBPIBoB3KBJNBDMBEKBE4BBCFFBOBDLBFJBIyEBC7CBLAB", false)), Sc: () => new D(l("kB+D+DBCBqnB8D8DzPBBzPBBI2H2HoImSmS8sClmClmCBgBB37hBkuVkuVtD7E7E8GBBEBB3-HDB-4wBxtCxtC", false)), Sk: () => new D(l("+CCCoCHHFEEqQDBNNBGGBCCCBPB2DPPBjoBjoB15FCCBBBMCBOCBOCBOBB9kEBBkzdWBKBBoDBBxePPBniUniUBPB8bCCjF4g9B4g9BBDB", false)), Sm: () => new D(l("rBRRBBB+BCCuBFFmBgBgB-XwQwQBBB8xGOOoBCBOCBsEoBoBBDBHlClCBDBGBBFGDIgBgBBDDCgBgBBqIBhBBB7CffBXBpBFB2OKK3BHBwDxKxKBDBDeBLPBhIiEBX+BBFfBDhIBxBUBDFB9+zB5Z5ZCCBlFRRBBB+BCCkEHHBCBitDBBhrwBx+Bx+BagBgBagBgBagBgBagBgBat5Ft5FB-uC-uCBHB", false)), So: () => new D(l("mFDDFCCyerIrIBgEgEBvGvGLUUB4H4HkQ2L2LjEFBClElEwGqBqBoMCBQCCBBBDFBVECmEHBCFBCBBGDBmGBBxXJB0WzWzW+EhBBiLJBKIBksBBBCDBCBBLCCBHHBEBCECFMMBPPCBBC7B7BBKKBDBDDBCBBCBBCGBCeBDBBCCCBdBtIHBFTBDGBDwCBCdBanBBHnCBXKByCtCBX2FBCIBC1BBJuDBC3HBtBrBBhC-HBhQvBBWBBHmBBDpEBmHFBmLBBvBZBC4CBN1GBbPBFOOBNNWBBHBBxKBBFJBhBlBBKRRBdBMdBJQQBeBLmBBQ-JBhuG-BBx0V2BBibDBLBBC+R+RBBBqqUPBuLPBhCBB3BHBuBCBlPEEFBBOBB6JIB6BQBDCBCMBEwBwBBrBB7zBBBwSpgBpgBBGBnjC2kC2kCBGBFQBr6SDBG3qU3qUk7DvHBLCBEzNBHWBQPBhDzDB9B1HBLmBBD7BBGCBXBBIdBF8BBWhCBE7F7FB1CBqlB-PB4BDBzBHBCNBCBBp2B96C96CiEyWyWBqBBFjDBNOBDOBCOBCkBBYgFB5BcBOrBBFIBIBBPFB7E6HBG4WBEQBEMBE5GBHLBFQQBKBF3BBJJBHnBBJdBDLBFBB-B3KBJNBDMBEKBE4BBCFFBOBDLBFJBIyEBC7CBLAB", false)), Z: () => new D(l("gBgEgEgvFgsCgsCBJBeBBGwBwBh9DAB", false)), Zl: () => new D(l("ohIA", true)), Zp: () => new D(l("phIA", true)), Zs: () => new D(l("gBgEgEgvFgsCgsCBJBlBwBwBh9DAB", false)), ASCII_Hex_Digit: () => new D(l("wBJIFbF", true)), Alphabetic: () => new D(l("hCZBHZBwBLLFGGBVBCeBCpOBFLBPEBICC3CeeBQBCBBDDBCHHCCBCCCBSBCyCBCqEBJlFBClBBDHHBnBBoBNBCCCBCCBCCJaBFDBeKBG3BBCGBPlDBCHBFHBFCBLCBDRRBuBBOkDBZgBBKBBFGGBWBDSBUYBIKBGXBCGBIJJBoBBLLBEGBHrCBCPBCCBFOBOSBCHBDBBDVBCGBCEEBCBEHBDBBDBBCJJFBBCEBNBBLFFBBBCFBFBBDVBCGBCBBCBBCBBFEBFBBDBBFIIBCBCSSBEBMCBCIBCCBCVBCGBCBBCEBEIBCCBCBBEQQBCBWDBFCBCHBDBBDVBCGBCBBCEBEHBDBBDBBKBBFBBCEBORRBCCBEBECBCDBEBBCCCBEEBEEBBBELBFEBECBCCBEHHpBMBCCBCWBCPBEHBCCBCCBJBBCCBCBBDDBdDBCHBCCBCWBCJBCEBEHBCCBCCBJBBGCBCDBOCBNMBCCBCoBBDHBCCBCCBCGGBCBIEBXFBCCBCRBEXBCIBCDDBFBJFBCCCBGBTBBO5BBGGBH0B0BBECBDBCXBCCCBRBCCBDEBCHHPDBhBgCgCBGBCjBBFSBFPBCjBBkC2BBCDDBDBR-BBLDBDlBBCGGDqBBCsKBCDBDGBCCCBCBDoBBCDBDgBBCDBDGBCCCBCBDOBC4BBCDBDiCBmBPBR1CBDFBErTBDQBCZBGqCBEKBITBMUBNTBNMBCCBCBBNzBBDSBPFFkC4CBIqBBGlCBLeBCLBFIBYdBDEBMrBBFZB3BbBF+BBDTBzBYYBMMBBByBzBBCOBCHB0BpBBDDBLrBBCKBP2BBXCBLjBBDKBGqBBDCBqBDBCFBCBBEGGB+FBUhBBM1IBDFBDlBBDFBDHBCGCBdBD0BBCGBCEEBBBCGBEDBDFBFMBGCBCGB1DOORMBmDFFDJBCEEBDBHGCBCBCKBDDBGEBFSSBnBBuZzBB34BkHBHDBEBBNlBBCGGD3BBIRRBVBKGBCGBCGBCGBCGBCGBCGBCGBCfBwB2O2OBBBaIBIEBDEBF1CBHCBC5CBCDBGqBBC9CBSfBxBPBhQ-tGBhCs0VBkCtBBDsIBEPBLBBVuBBGHBEwDBoBIBDmDBDxCBVUBCgBBZzBBNjCBCtBtBBEBECCBBBLgBBGiBBOcBEyBBCLBQRRBOBLEBC2BBKNBTWBEkCBCCCZCBDPBDDBMFBDFBDFBKGBCGBCqBBCNBH6DBWj9KBNWBFwBBloItLBDpDBnBGBNEBGLBCMBCEBCCCBCCBCCBqDBiBqLBT-BBD1BBpBLB1DEBCmEBlBZBHZBM4CBEFBDFBDFBDCBkBLBCZBCSBCBBCOBDNBjB6DBmC0BBsIcBEwBBwBfBOdBGqBBGdBDjBBFHBCEBrB9EBTjBBFjBBFnBBJzBBNKBCOBCGBCBBCKBCOBCGBCBBEzBBN2JBKVBLHBZFBCpBBCIBmCFBDCCBqBBCBBEDDBVBLWBKeBiCSBCBBLVBLZBHZBnB3BBHBBhCDBCBBGHBCCBCcBrBcBEcBkBHBCbBc1BBLVBLSBORBvDoCB4ByBBOyBBOnBBjBbBEGGBVB7HpBBCBBEBBRFBzBCBEcBLJJBUBrBRBvBUBcWBKlCBsBEBL4BBKOOBXBYyBBSDBJiBBEKKB+BBCDBKBBLCCkBRBChBBDHHBCB-BGBCCCBCBCOBCJBI4BBYDBCHBDBBDVBCGBCBBCEBEHBDBBDBBEHHGGBdJBCDDClBBCJBCDDCDBCBBECCtBhCBCCBCDBVCBfhCBDBBC5F5FB0BBDGBaFBjB+BBCEE8B1BBDoCoCBZBDNBWGB6F4BBoD-BBgBHBDDDBGBCBBCdBCBBDBBDDB+CHBDtBBDFBCCCBccBxBBDJBSnCBGTTBnCBoDHB5CgBBgBIBCsBBCGBCyByBBcBDVBCNBqCGBCBBCrBBECCBCCBBBCDDBZZBEBCBBCkBBCBBCDBCYYBqBBlIWBKQBCoBBECBwDwCwCB4cBnDuDBSjGBtyCgDBQvhBBSFBa68DBGmSB61GuBBy2B4RBIeBSuCBSdBTvBBRDBgBUBGSBxNsBB0G-BBhBYBDYBtBqCBF4BBIQBhCBBCNNBFBK1mHBqBfBiDyDB+vIDBCGBCBBCiJBQeeBBBDPPBCBJrMBloCqDBGMBEIBIJBFi7Fi7FBzCBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDYBCYBCeBCYBCeBCYBCeBCYBCeBCYBCHB15BeBHFB2GGBCQBDGBCBBCEBG9BBiBxDxDBrBBLGBRiKiKBcBTrBBlPbBlHdBDwGwGBdBCVBJBBhHGBCDBCBBCOBCkGB8BjCBEEE1lBDBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQB1TZBHZBHZB3zD-2pBBhB9oEBDt0FBDwpHBQtTBjtC9QBjvBq6EBGppIB", false)), Dash: () => new D(l("tB9qB9qB0BiyDiyDmgBqgCqgCBEB+BoBoBQnMnMlgDDDgBBBFdd-NUUwDxszBxszBBmBmBLqFqFhzD-J-J", false)), Emoji: () => new D(l("jBHHGJBwDFFu8HNN5GXX7CFBQBBwLBBNnFnFaKBFCBoGoHoHBLLK7B7BBCBCEBKGDBDDFDDCBBDIEBJJBBBGCCGLBMBBDCCBCCTDDBTTBEBCCCBEEBGGDBBFBBMBBGBBDGGBECBVVBGGBEBCDBDFFDDDBEBCDDCCCHEEHLLBQQDFFCFFBBBCMMBxBxBBBBKeP1LBBwOCBUBB0BFF7mBNN6SCCrrvDrGrGhFBBNBBPDDBIBsCZBCBBYVVDIBWBBvFhBBDvDBDBBCCBDyCBDCBCmIBC+BBMFBCXBIBBDHBNDDBCBDFFBOOBDDJBBKGGBBBNCBJCBDCCFHHEHHB0CBxBlCBGHBDDBEJBECCBEEDJBkHLBF8I8IBtBBCJBC4FBxDMBEKBE4BBCFFBOBDLBFJB", false)), Emoji_Component: () => new D(l("jBHHGJB0+H2G2Gsp3B3+8B3+8BBYB8PEBxtBDBtzhY-CB", false)), Emoji_Modifier: () => new D(l("7-8DE", true)), Emoji_Modifier_Base: () => new D(l("9wJ8G8GRDB4jzD9B9BBBBDDDBBB2DBBDKBWSBEFFBBBCCBICCZqGqGBFFWFFBvFvFBBBEEB0CRRBBBKMMgSDDJHBHKKBIBDCB5B+B+BBCCBCCSCBCMBmHCBrBIB", false)), Emoji_Presentation: () => new D(l("64IBBuGDBEDDqQBBWBBzBLBsBUUOJJBSSBGGBJJGWWIBBCFFDIIFBBdkBkBCFFBBBC+B+BBBBZPP8aBB0BFFvlxDrGrG-FDDBIBsCZBCZZVDDBDBCCBWBBvFgBBNIBClCBCVBNqBBFEBNQBEEEBlCBCCCB5FBD+BBODBCXBTbbBOO3C0CBxBlCBHEEBBBDDBEDBMBBIIBkHLBF8I8IBtBBCJBC4FBxDMBEKBE4BBCFFBOBDLBFJB", false)), Extended_Pictographic: () => new D(l("pFFFu8HNN5GXX7CFBQBBwLBBNnFnFaKBFCBoGoHoHBLLK7B7BBCBCEBKGDBDDFDDCBBDIEBJJBBBGCCGLBMBBDCCBCCTDDBTTBEBCCCBEEBGGDBBFBBMBBGBBDGGBECBVVBGGBEBCDBDFFDDDBEBCDDCCCHEEHLLBQQDFFCFFBBBCMMBxBxBBBBKeP1LBBwOCBUBB0BFF7mBNN6SCCrrvDoBoBBCBlDLBQBBQPPBmBmBBIBxDBBNBBPDDBIBU3BBcOBLVVDIBCDBKWBH7FBDvDBDBBCCBDyCBDCBCDBG9HBC+BBMFBCXBIBBDHBNDDBCBDFFBOOBDDJBBKGGBBBNCBJCBDCCFHHEHHB0CBxBlCBGHBDQBECCBEBDMB7GlBBNDB5BHBLFBpBHBfBBNDBDNBKmBBNuBBCJBC4FB5CHBPxEBhI9fB", false)), Hex_Digit: () => new D(l("wBJIFbFq1-BJIFbF", true)), Lowercase: () => new D(l("hDZBwBLLFlBlBBWBCHBC2BCBQCBuBCDECBBBDCCDEEBFFDEEBBBDDDCCCDCCBCCDEECDDBDDBBBHGDCOCBSCBDDCEEC4BCBFBDDDBCCFICBjCBDiBBIBBfEBhDsBsBCEEDDBTccBhBBCBBECBCWCBDBCGDB0B0BBuBBCgBCK0BCDMCBgDCxBoBBo6CqBBCDB5XFBjkCIBC2D2DB+FBiC0ECBHBCgDCBHBJFBLHBJHBJFBLHBJHBJNBDHBJHBJHBJEBCBBHEEBBBCBBJDBDBBJHBLCBCBB6DOORMBuDEEBEEcKFDBBJDBFiBiBBOBFsasaBYBn6BvBBCEEBGCFCCBCCBGBEiDCBIICFFNlBBCGG0oesBCUaCBBBmEMCBBBC8BCBIBCCCDICFCCDCCBBBCSCGGGCMCFCCDOCWDBCCCBBB2ZqBBCNBHvCBh6TGBNEBqhBZBumBnBBpEjBB8EKBCOBCGBCBBkODDBBBCpBBCIBmoByBB+DVB75CfBhsVfB8BYBnqZZBbGBCRBbZBbDBCCCBFBCKBbZBbZBbZBbZBbZBbZBbZBbZBbbBdYBCFBbYBCFBbYBCFBbYBCFBbYBCFBC15B15BBIBCTBHFBmI9BB1lChBB", false)), Math: () => new D(l("rBRRBBBgBeeCuBuBFmBmBgB5W5WBBBDbbBDDBBBwQCBuwGccBBBMEEOPPBCBWEBMEBiCMBFEEBFFBDBTFFDJBCDDBEBHEEBDDBCCBBBCFBENBClClCBWBCFBCBBFBBFfBCHHBPPBqIBJDBVBB7CffBZBCZZMGB+NBBNJBFFBFBBDBBEEBPCCDFBMHBGBB6BCCeDBKCBxK-BBhI-PBxBUBDFB9+zB4Z4ZBEBCjFjFRCBeCCeCCkEHHBCBitDBBhrwBwoBwoBBzCBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDjJBDxBBhwFDBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQB1BBB-uCIB", false)), Quotation_Mark: () => new D(l("iBFFkEQQ96HHBaBBowDqOqOBCBOCBixzBDB+FFF7CBB", false)), Terminal_Punctuation: () => new D(l("hBLLCMMBEE-ZJJiQ6B6BpCPPCCB1FsBsBBJBCsHsHB3B3BBEBCHBgBmImIB1nB1nBBtFtFFFB4JBB2YHBmY9D9DBBBoCBB+ECBEoBoBBCBDBB7JBBjLDBjFBBLBBCCBeCB8FEB-BBBldYYBKKBBBwlDCBzJOOFLLCBBEBBtNBB8ndBBuICBkHEB-LBB3CBBgD4E4EBBB0ECBgERRB6H6HnxUDDB6B6BBBBCDBqFLLCMMBEEiCDD7hBxBxBnkBoGoG3JBB5EFBlCFB6CDB5dEBtBDB+FGBxDDBgECBiEBBHRRB5C5CBDBtDrJrJB2D2DBBBNBBnLDBEOBqDBB6HCBmQCC8HBB4CBBFBB-MCBuBmUmUBrCrCBspBspBBDB6vRBBmEiCiCBBBLqRqRBoJoJBnwTnwTovHDB", false)), Uppercase: () => new D(l("hCZBmDWBCGBiB2BCDOCDuBCBECEBBCCCBCCBBBDDBCBBCCBEBBCBBCECBCCDCCBCCBBBCCCBEEIJDCMCDQCDDDCCBC4BCIBBCBBDCCBCBCGCiJCCEJJHCCBBBCCCBCCBPBCIBkBDDBBBEWCGDDCBBDyBBxBgBCK2BCBMCD+CCDlBBq6ClBBCGGzW1CB0kCHHBpBBDCBhK0ECKgDCKHBJFBLHBJHBJFBMGCJHBpCDBNDBNDBNEBMDBnIFFECBDCBDEEBDBHGCBCBDDBLBBGbbBOBUzZzZBYBx5BvBBxBCCBBBDGCBCBCDDJCBCgDCJCCFuqeuqeCqBCUaCoEMCE8BCLECBICFCCDCCEUCBDBCEBCOCBCBCCCBQCZs5Vs5VBYBmmBnBBpEjBB9EKBCOBCGBCBBr3ByBB+EVB75CfBhsVfBhCYBoqZZBbZBbZBbCCBGDBDDBCBCHBbZBbBBCDBDHBCGBcBBCDBCEBCEEBFBcZBbZBbZBbZBbZBbZBfYBiBYBiBYBiBYBiBYBiB2pE2pEBgBBvgCZBHZBHZB", false)), White_Space: () => new D(l("JEBTlDlDbgvFgvFgsCKBeBBGwBwBh9DAB", false)) });
        static get Upper() {
          return this.CATEGORIES.get("Lu");
        }
        static SCRIPTS = new nB({ Adlam: () => new D(l("go6DrCFJFB", true)), Ahom: () => new D(l("g4lCaDOFW", true)), Anatolian_Hieroglyphs: () => new D(l("ggxCmS", true)), Arabic: () => new D(l("gwBEBCFBCNBCCBCfBCJBMZBCrDBChBBxCvBBxHhBBGqCBCcBxy8BtPBDvEBhBPBxDEBCmEBk7DeBkCFBJIBiBFBh43BDBCaBCBBCDDCJBCDBCCCHFFCECBBBCBBCDDCICBCCDDBCGBCDBCDBCCCBIBCQBGCBCEBCQB1BBB", false)), Armenian: () => new D(l("xpBlBDxBDCks9BE", true)), Avestan: () => new D(l("g4iC1BEG", true)), Balinese: () => new D(l("g4GsCCxB", true)), Bamum: () => new D(l("g1pB3CpowB4R", true)), Bassa_Vah: () => new D(l("w26CdDF", true)), Batak: () => new D(l("g+GzBJD", true)), Bengali: () => new D(l("gsCDBCHBDBBDVBCGBCEEBCBDIBDBBDDBJFFBCCBDBDYB", false)), Beria_Erfe: () => new D(l("g17CYDY", true)), Bhaiksuki: () => new D(l("ggnCICsBCNLc", true)), Bopomofo: () => new D(l("qXB6wLqBxDf", true)), Brahmi: () => new D(l("ggkCtCFjBKA", true)), Braille: () => new D(l("ggK-H", true)), Buginese: () => new D(l("gwGbDB", true)), Buhid: () => new D(l("g6FT", true)), Canadian_Aboriginal: () => new D(l("ggF-TxRlC7tgCP", true)), Carian: () => new D(l("g1gCwB", true)), Caucasian_Albanian: () => new D(l("wphCzBMA", true)), Chakma: () => new D(l("gokC0BCR", true)), Cham: () => new D(l("gwqB2BKNDJDD", true)), Cherokee: () => new D(l("g9E1CDFz7lBvC", true)), Chorasmian: () => new D(l("w9jCb", true)), Common: () => new D(l("AgCBbFBbuBBCOBCEBYgBgBiOmBBGEBDTB1DKKHCC+THHPEEhB9E9ElQiEiEB6mB6mB2MDBjJwvBwvBBBBoCBBsGBBCumBumBOIIBCBCFBCCBDmYmYBKBD2CBCKBEKBCOBShBB-BlBBCCBDFBCaBCQBqBCBF5UBXKBW-cBhIzTBDpEBhQ9CBzMUBCCCBXBQHBFDB8CBBE7C7CB0E0EBOBhBlBBKxBxBB+BBgBwCBwB5C5CBmFBhuG-BBhoWhBBnDCBmFJB1HhFhFsMPPBzuUzuUBxGxGBIBXiBBCSBCDB0ECCBeBbFBbKBLuBuBBhChCBFBCGBLEBjICBFsBBEIBxCMB0BsBBlHaBltuBDB96D8HBEzNBHWBQQBgDzDB9B1HBLmBBD9BBEQBJBBIdBF8BB2GTBNTBN2CBKYBoE0CBCmCBCBBDDDBDDBCBCLBCCCBFBCgCBCDBDHBCGBCbBCDBCEBCEEBFBCzKBDjJBDxBByjFjCBtC8BBjWrBBFjDBNOBDOBCOBCkBBLtFB5BZBCBBOrBBFIBIBBPFB7E4eBEQBEMBE5GBHLBFQQBKBF3BBJJBHnBBJdBDLBFBBPIBoB3KBJNBDMBEKBE4BBCFFBOBDLBFJBIyEBCmDBnghYffB+CB", false)), Coptic: () => new D(l("ifNxkKzDGG", true)), Cuneiform: () => new D(l("ggoC5cnDuDCEMjG", true)), Cypriot: () => new D(l("ggiCFBDCCBqBBCBBEDD", false)), Cypro_Minoan: () => new D(l("w8rCiD", true)), Cyrillic: () => new D(l("ggBkEBDoFBx6FKBhFtCtCojEfBhie-CBv8VBBhw4B9BBiBAB", false)), Deseret: () => new D(l("gghCvC", true)), Devanagari: () => new D(l("goCwCFODZh7nBfhwcJ", true)), Dives_Akuru: () => new D(l("gomCGBDDDBGBCBBCdBCBBDLBKJB", false)), Dogra: () => new D(l("ggmC7B", true)), Duployan: () => new D(l("ggvDqDGMEIIJDD", true)), Egyptian_Hieroglyphs: () => new D(l("ggsC1iBL68D", true)), Elbasan: () => new D(l("gohCnB", true)), Elymaic: () => new D(l("g-jCW", true)), Ethiopic: () => new D(l("gwEoCBCDBDGBCCCBCBDoBBCDBDgBBCDBDGBCCCBCBDOBC4BBCDBDiCBDfBEZBnvGWBKGBCGBCGBCGBCGBCGBCGBCGBjpfFBDFBDFBKGBCGBylvCGBCDBCBBCOB", false)), Garay: () => new D(l("gqjClBEcJB", true)), Georgian: () => new D(l("glElBBCGGDqBBCDBx8CqBBDCBhiElBBCGG", false)), Glagolitic: () => new D(l("ggL-Ch9sDGCQDGCBCE", true)), Gothic: () => new D(l("w5gCa", true)), Grantha: () => new D(l("g4kCDBCHBDBBDVBCGBCBBCEBDIBDBBDCBDHHGGBDGBEEB", false)), Greek: () => new D(l("wbDBCCBDDBCFFCCCBBBCCCBSBC+BBPPBnpGEBzBEBFEB1ChKhKBUBDFBDlBBDFBDHBCGCBdBD0BBCOBCNBDFBCSBDCBCIBoJ-xiB-xiB7uVuCBSgj0Bgj0BBkCB", false)), Gujarati: () => new D(l("h0CCBCIBCCBCVBCGBCBBCEBDJBCCBCCBDQQBCBDLBIGB", false)), Gunjala_Gondi: () => new D(l("grnCFCBCkBCBCFIJ", true)), Gurmukhi: () => new D(l("hwCCBCFBFBBDVBCGBCBBCBBCBBDCCBDBFBBDCBEIIBCBCIIBPB", false)), Gurung_Khema: () => new D(l("go4C5B", true)), Han: () => new D(l("g0LZBC4CBN1GBwBCCaIBPDBle-tGBhC-vUBhoWtLBDpDBpodBBNGBqgkB-2pBBhB9oEBDt0FBDwpHBQtTBjtC9QBjvBq6EBGppIB", false)), Hangul: () => new D(l("goE-HvxHBiI9CyDeiCei3dckUj9KNWFwBl9JeEFDFDFDC", true)), Hanifi_Rohingya: () => new D(l("gojCnBJJ", true)), Hanunoo: () => new D(l("g5FU", true)), Hatran: () => new D(l("gniCSCBGE", true)), Hebrew: () => new D(l("xsB2BBJaBFFBpp9BZBCEBCCCBCCBCCBIB", false)), Hiragana: () => new D(l("hiM1CBHCBi7-C+IBTeeBBBulQAB", false)), Imperial_Aramaic: () => new D(l("giiCVCI", true)), Inherited: () => new D(l("gYvDB2IBBlOKBbhXhXBCB8qEtBBDLBlPCBCMBCGBFHHEBBnG-BBtQBBjGgBB65DDBsDBBmrzBPBRNBwejHjH7iEl+uBl+uBBsBBDWBhRCBSHBDGBfDBz6rYvHB", false)), Inscriptional_Pahlavi: () => new D(l("g7iCSGH", true)), Inscriptional_Parthian: () => new D(l("g6iCVDH", true)), Javanese: () => new D(l("gsqBtCDJFB", true)), Kaithi: () => new D(l("gkkCiCLA", true)), Kannada: () => new D(l("gkDMCCCWCJCEDICCCDIBGCCDDJCC", true)), Katakana: () => new D(l("hlM5CBDCBxHPBxGuBBC3CBvgzBJBCsBBzisBDBCGBCBBCgJgJBBBzBPPBCB", false)), Kawi: () => new D(l("g4nCQCoBEc", true)), Kayah_Li: () => new D(l("goqBtBCA", true)), Kharoshthi: () => new D(l("gwiCDCBGHCCCcDCFJII", true)), Khitan_Small_Script: () => new D(l("k-7C84G84GB0OBqBAB", false)), Khmer: () => new D(l("g8F9CDJHJnPf", true)), Khojki: () => new D(l("gwkCRCuB", true)), Khudawadi: () => new D(l("w1kC6BGJ", true)), Kirat_Rai: () => new D(l("gq7C5B", true)), Lao: () => new D(l("h0DBBCCCBDBCXBCCCBVBDEBCCCBFBCJBDDB", false)), Latin: () => new D(l("hCZBHZBwBQQGWBCeBCgOBoBEB8wGlBBHwBBGDBGMBClCBiC-HByLOORMBuEBBHccSoBB42CfBj1elDBExCBVOBxZqBBCIBCDB38TGB7gBZBHZBmhCFBCpBBCIBm61BeBHFB", false)), Lepcha: () => new D(l("ggH3BEOEC", true)), Limbu: () => new D(l("goGeBCLBFLBFEEBKB", false)), Linear_A: () => new D(l("gwhC2JKVLH", true)), Linear_B: () => new D(l("gggCLCZCSCBCODNjB6D", true)), Lisu: () => new D(l("wmpBvBx1eA", true)), Lycian: () => new D(l("g0gCc", true)), Lydian: () => new D(l("gpiCZGA", true)), Mahajani: () => new D(l("wqkCmB", true)), Makasar: () => new D(l("g3nCY", true)), Malayalam: () => new D(l("goDMCCCyBCCCFFPDZ", true)), Mandaic: () => new D(l("giCbDA", true)), Manichaean: () => new D(l("g2iCmBFL", true)), Marchen: () => new D(l("wjnCfDVCN", true)), Masaram_Gondi: () => new D(l("gonCGBCBBCrBBECCBCCBHBJJB", false)), Medefaidrin: () => new D(l("gy7C6C", true)), Meetei_Mayek: () => new D(l("g3qBWqGtBDJ", true)), Mende_Kikakui: () => new D(l("gg6DkGDP", true)), Meroitic_Cursive: () => new D(l("gtiCXFTDtB", true)), Meroitic_Hieroglyphs: () => new D(l("gsiCf", true)), Miao: () => new D(l("g47CqCF4BIQ", true)), Modi: () => new D(l("gwlCkCMJ", true)), Mongolian: () => new D(l("ggGBBDCCBSBH4CBIqBB2t-BMB", false)), Mro: () => new D(l("gy6CeCJFB", true)), Multani: () => new D(l("g0kCGBCCCBCBCOBCKB", false)), Myanmar: () => new D(l("ggE-EhqmBeiDfxibT", true)), Nabataean: () => new D(l("gkiCeJI", true)), Nag_Mundari: () => new D(l("wm5DpB", true)), Nandinagari: () => new D(l("gtmCHDtBDK", true)), New_Tai_Lue: () => new D(l("gsGrBFZHKEB", true)), Newa: () => new D(l("gglC7CCE", true)), Nko: () => new D(l("g+B6BDC", true)), Nushu: () => new D(l("h-7CvsQvsQBqMB", false)), Nyiakeng_Puachue_Hmong: () => new D(l("go4DsBENDJFB", true)), Ogham: () => new D(l("g0Fc", true)), Ol_Chiki: () => new D(l("wiHvB", true)), Ol_Onal: () => new D(l("wu5DqBFA", true)), Old_Hungarian: () => new D(l("gkjCyBOyBIF", true)), Old_Italic: () => new D(l("g4gCjBKC", true)), Old_North_Arabian: () => new D(l("g0iCf", true)), Old_Permic: () => new D(l("w6gCqB", true)), Old_Persian: () => new D(l("g9gCjBFN", true)), Old_Sogdian: () => new D(l("g4jCnB", true)), Old_South_Arabian: () => new D(l("gziCf", true)), Old_Turkic: () => new D(l("ggjCoC", true)), Old_Uyghur: () => new D(l("w7jCZ", true)), Oriya: () => new D(l("h4CCCHDBDVCGCBCEDIDBDCICFBCEDR", true)), Osage: () => new D(l("wlhCjBFjB", true)), Osmanya: () => new D(l("gkhCdDJ", true)), Pahawh_Hmong: () => new D(l("g46ClCLJCGCUGS", true)), Palmyrene: () => new D(l("gjiCf", true)), Pau_Cin_Hau: () => new D(l("g2mC4B", true)), Phags_Pa: () => new D(l("giqB3B", true)), Phoenician: () => new D(l("goiCbEA", true)), Psalter_Pahlavi: () => new D(l("g8iCRIDNG", true)), Rejang: () => new D(l("wpqBjBMA", true)), Runic: () => new D(l("g1FqCEK", true)), Samaritan: () => new D(l("ggCtBDO", true)), Saurashtra: () => new D(l("gkqBlCJL", true)), Sharada: () => new D(l("gskC-ChsCH", true)), Shavian: () => new D(l("wihCvB", true)), Siddham: () => new D(l("gslC1BDlB", true)), Sidetic: () => new D(l("gqiCZ", true)), SignWriting: () => new D(l("gg2DrUQECO", true)), Sinhala: () => new D(l("hsDCBCRBEXBCIBCDDBFBEFFBEBCCCBGBHJBDCBt-gCTB", false)), Sogdian: () => new D(l("w5jCpB", true)), Sora_Sompeng: () => new D(l("wmkCYIJ", true)), Soyombo: () => new D(l("wymCyC", true)), Sundanese: () => new D(l("g8G-BhIH", true)), Sunuwar: () => new D(l("g+mChBPJ", true)), Syloti_Nagri: () => new D(l("ggqBsB", true)), Syriac: () => new D(l("g4BNC7BDCxIK", true)), Tagalog: () => new D(l("g4FVKA", true)), Tagbanwa: () => new D(l("g7FMCCCB", true)), Tai_Le: () => new D(l("wqGdDE", true)), Tai_Tham: () => new D(l("gxG+BCcDKHJHN", true)), Tai_Viet: () => new D(l("g0qBiCZE", true)), Tai_Yo: () => new D(l("g25DeCVJB", true)), Takri: () => new D(l("g0lC5BHJ", true)), Tamil: () => new D(l("i8CBBCFBECBCDBEBBCCCBEEBEEBBBELBFEBECBCDBDHHPUBm+kCxBBOAB", false)), Tangsa: () => new D(l("wz6CuCCJ", true)), Tangut: () => new D(l("g-7CgBgBB+3GBhQeBiDyDB", false)), Telugu: () => new D(l("ggDMCCCWCPDICCCDIBCCCBDDDJII", true)), Thaana: () => new D(l("g8BxB", true)), Thai: () => new D(l("hwD5BGb", true)), Tibetan: () => new D(l("g4DnCCjBFmBCjBCOCGFB", true)), Tifinagh: () => new D(l("wpL3BIBPA", true)), Tirhuta: () => new D(l("gklCnCJJ", true)), Todhri: () => new D(l("guhCzB", true)), Tolong_Siki: () => new D(l("wtnCrBFJ", true)), Toto: () => new D(l("w04De", true)), Tulu_Tigalari: () => new D(l("g8kCJBCDDClBBCJBCDDCDBCJBCBBJBB", false)), Ugaritic: () => new D(l("g8gCdCA", true)), Unknown: () => new D(l("4bBBHDBICCVuMuMnBBBzBBBE4B4BBGBcDBHKBvI9B9BBmDmDBMB8BBByBBBQddBCCMEBjBEBuHJJBDDBXXICCBBBFBBKBBDBBFHBCDBDGGBaaBEEHDBDBBXIIDGDBCCGDBDBBECBCGBFCCBFBSJBEKKEXXIDDGBBLIEBCCBNBFBBNGBIEEJBBDBBXIIDGGBKKBDDBEEBFBEDBDGGBTTBIBDHHBBBEFFBBBDCCDCBDCBECBNDBGCBEFFBCCBEBCNBWEBOEEYRRBKKEFFBFBDEEDBBFBBLGBXEEYLLGBBKEEFGBDEBEFFBLLELBOEE0BEEHDBRBBbEETCBZKKCBBICBCDBHCCJFBLBBELB7BDBekBBDCCGZZCYYBGGCIILBBFfBpClBlBBCBoBlBlBQOOBjBBnGCCBDBCBB6LFFBIICFFBqBqBFBBiBFFBIICFFBQQ6BFFBkCkCBhBhBBBBbFB3CBBHBB+UCB6CGBXIBZIBVLBOEEDLB-CBBLFBLFBbFB6CGBsBEBnCJBgBNNBCBNDBCCBrBBBGKBtBDBbFBMCB-BBBiCeeBMMBEBLFBPBBvBBBNTBuCnFnFBGB9BCBQCB-BEBsBBBMHBsBEB3QBBHBBnBBBHBBJGCgBBB2BQQPBBHUUBEEKmDmDNBBcOOBBBjBNBiBOBtEDB7UVBMUB14BBB-LEBuBCCBDBCBB5BGBDNBZIBI4BI-DhBBb6C6CBKB3GZBxC3C3CBoDoDBDBsB-C-C3CIBxBuzcuzcBBB4BIB9KTB5FHB+GTB9BCBLFB5BHBnCHBNFB1DKBfCBvCMMBCBiB4B4BBHBPBBLBBoDXBdJBHBBHBBHIBIII9BDB-DBBLFBl9KLBYDByBjoIBvLBBrDlBBILBGEBbGGCGDrUfBrBFB0BUUFDBGoEoEBCC-FCBHBBHBBHBBECBIIIBIBGBBNbbUDDQBBPhBB8DEBEDBuBCB5COOBBBCuBBvBhEBeCByBOBdDBlBIBfEBsBEBfmBmBBCBPpBB-EBBLFBlBDBlBDBpBHB1BKBNQQIDDMQQIDDBBB1BLB4JIBXJBJXBHrBrBKkCBHBBCtBtBDCBCBBYpCpCBGBKvBBUDDBDBiBCBcEBclBB5BDBVBBzBDDBDBJEEeBBEDBLGBKGBhCfBoBDBNIB3BCBeBBcEBbGBFLBIvCBqC2BB0BMB0BGBvBHBLFBnBCBeHBDvGBgBrBrBEBBDPBHHBKgBBvBHBrBVBblBBdTBYIBvCDBlBIBlCJBCBBaGBLFB2BTTBGBoBIBhDVVBJBTwBwBB8BBICCFQQMFB8BEBLFBFJJBDDBXXIDDGLLBDDBEEBCCBEBCEBIBBICBGKBLCCBCCnBLLCBBCFFLDDBGBDcB9CGGBcBpCHBLlFB3BBBnBhBBmCKBLFBOSB7BFBLFBVbBcBBQDBY4FB9BjDB0CLBJBBCBBJDDfDDBNNBHBLlCBJBBvBBBMaBpCHB0CMBqCGBL1CBJ3CBjBNBLFBKuBuBPJBeCBhBBBXPPBnCBIDDtBCBCDDKHBLFBHDDmBDDHGBLFBtBDBL1HBaGBSqBqBBBBe0CBCOBzBMB8clDBwDGGBJBlGryCBkDMB3iBJB88DEBoS41GB7Bl2BB6RGBgBLLBCByCLLBEBfBBHJBnCJBLIIWEBUvNB7BlGB8CEBaBBarBBsCDB6BGBS-BBGKBIIB3mHoBBhBgDB0D8vIBFIIDkJkJBNBCcBEBBCNBFHBtMjoCBsDEBOCBKGBLBBJ76DB+HCB1NFBYOBSOBvBBBYIB1D7BB3HJBoBBBjGUBnC5DBVLBVLB4CIBamEB2CoCoCDBBCBBDBBFNNCIIiCFFBJJIddFGGCCBI1K1KBlJlJB-V-VBNBGQQBuiBBgBFBH0GBISSBIIDGGBDB-BgBBCvDBuBCBPBBLDBD-JBgBQB7BEBCvOBrB1GBsBDBC-FBgBXXBGBD-GBIFFDQQmGBBRoBBtCDBLDBDwYBlCrCB+BhGBFccDCCBCCLFFCCCBEBCDBCECEDDCBBCICDCCBFFIKFCLLSEBEGGSzBBDtIBtBDBlDLBQBBQQQmBJBvF3BBeMBtBDBKGBDNBH5EB6eCBSCBOCB7GFBNDBCOBNDB5BHBLFBpBHBfBBNDBDNBKmBB5KHBPBBOCBMCB6BCCBCBRBBNDBLGB0EoDoDBjgBBh3pBfB-oEBBv0FBBypHOBvThtCB-QhvBBs6EEBrpIm8yVBCdBhD-DBxHvw-FB", false)), Vai: () => new D(l("gopBrJ", true)), Vithkuqi: () => new D(l("wrhCKCOCGCBCKCOCGCB", true)), Wancho: () => new D(l("g24D5BGA", true)), Warang_Citi: () => new D(l("glmCyCNA", true)), Yezidi: () => new D(l("g0jCpBCCDB", true)), Yi: () => new D(l("ggoBskBE2B", true)), Zanabazar_Square: () => new D(l("gwmCnC", true)) });
        static FOLD_CATEGORIES = new nB({ L: () => new D(l("laA", true)), LC: () => new D(l("laA", true)), Ll: () => new D(l("hCZBmDWBCGBiBuBCEECDOCDuBCBECEBBCCCBCCBBBDDBCBBCCBEBBCBBCECBCCDCCBCCBBBCCCBEEIBBCBBCBBCOCDQCDBBCCCBBBC4BCIBBCBBDCCBCBCGC3HrBrBCEEJHHCCBCCCBCCBPBCIBkBJJCUCGDDCBBDyBBxBgBCK2BCBMCD+CCDlBBq6ClBBCGGzW1CB0kCHHBpBBDCBhK0ECKgDCKHBJFBLHBJHBJFBMGCJHBZHBJHBJHBJEBMEBMDBNEBMEBqJEEBHHxC9zC9zCBuBBxBCCBBBDGCBCBCDDJCBCgDCJCCFuqeuqeCqBCUaCoEMCE8BCLECBICFCCDCCEUCBDBCEBCOCBCBCCCBQCZs5Vs5VBYBmmBnBBpEjBB9EKBCOBCGBCBBr3ByBB+EVB75CfBhsVfBhCYBoyehBB", false)), Lt: () => new D(l("kOCCBCCBCClBCCtsHHBJHBJHBMQQwBAB", false)), Lu: () => new D(l("hDZB7BqBqBBWBCHBCuBCEECDOCDsBCDECBBBDCCDEEGDDECBDDDCCCDFFDEECDDECCGBBCBBCBBCOCBSCDBBCEECkBCEQCJDDBCCFICBEBCBBCCCBEEBCCBCBCEBDCCBDDIDDCBBEFBGLLBnFnFsBCCEEEBBBvBDBCdBCBBECBCWCBDBCGD1BvBBCgBCK0BCDMCBgDCyBlBBq6CqBBDCB5XFBjkCIBCvHvHERRzD0ECGGGC8CCBHBJFBLHBJHBJFBMGCJHBJNBzBBBNSSBPPBEEpL2B2Bs1CvBBCEEBGCHDDLiDCJCCFNNBkBBCGG0oesBCUaCoEMCE8BCLCCDICFFFCBBDSCMOCFCCDOCb9a9advCBi8UZBumBnBBpEjBB8EKBCOBCGBCBBk4ByBB+DVB75CfBhsVfB8BYBvyehBB", false)), M: () => new D(l("5cgBgBlgHAB", false)), Mn: () => new D(l("5cgBgBlgHAB", false)), Emoji: () => new D(l("8mJA", true)), Extended_Pictographic: () => new D(l("8mJA", true)), Lowercase: () => new D(l("hCZBmDWBCGBiBuBCEECDOCDuBCBECEBBCCCBCCBBBDDBCBBCCBEBBCBBCECBCCDCCBCCBBBCCCBEEIBBCBBCBBCOCDQCDBBCCCBBBC4BCIBBCBBDCCBCBCGCiJCCEJJHCCBBBCCCBCCBPBCIBkBJJCUCGDDCBBDyBBxBgBCK2BCBMCD+CCDlBBq6ClBBCGGzW1CB0kCHHBpBBDCBhK0ECKgDCKHBJFBLHBJHBJFBMGCJHBZHBJHBJHBJEBMEBMDBNEBMEBqJEEBHHuBPBUzZzZBYBx5BvBBxBCCBBBDGCBCBCDDJCBCgDCJCCFuqeuqeCqBCUaCoEMCE8BCLECBICFCCDCCEUCBDBCEBCOCBCBCCCBQCZs5Vs5VBYBmmBnBBpEjBB9EKBCOBCGBCBBr3ByBB+EVB75CfBhsVfBhCYBoyehBB", false)), Math: () => new D(l("ycGDCHHFMMDDDCHHFAB", false)), Uppercase: () => new D(l("hDZB7BqBqBBWBCHBCuBCEECDOCDsBCDECBBBDCCDEEGDDECBDDDCCCDFFDEECDDECCGBBCBBCBBCOCBSCDBBCEECkBCEQCJDDBCCFICBEBCBBCCCBEEBCCBCBCEBDCCBDDIDDCBBEFBGLLBnFnFsBCCEEEBBBvBDBCdBCBBECBCWCBDBCGD1BvBBCgBCK0BCDMCBgDCyBlBBq6CqBBDCB5XFBjkCIBCvHvHERRzD0ECGGGC8CCBHBJFBLHBJHBJFBMGCJHBJNBzBBBNSSBPPBEEpLiBiBBOBFsasaBYBn6BvBBCEEBGCHDDLiDCJCCFNNBkBBCGG0oesBCUaCoEMCE8BCLCCDICFFFCBBDSCMOCFCCDOCb9a9advCBi8UZBumBnBBpEjBB8EKBCOBCGBCBBk4ByBB+DVB75CfBhsVfB8BYBvyehBB", false)) });
        static FOLD_SCRIPT = new nB({ Common: () => new D(l("8cgBgB", false)), Greek: () => new D(l("1FwUwU", false)), Inherited: () => new D(l("5cgBgBlgHAB", false)) });
      };
      F = class _ {
        static MAX_RUNE = 1114111;
        static MAX_ASCII = 127;
        static MAX_LATIN1 = 255;
        static MAX_BMP = 65535;
        static MIN_FOLD = 65;
        static MAX_FOLD = 125251;
        static MIN_HIGH_SURROGATE = 55296;
        static MAX_HIGH_SURROGATE = 56319;
        static MIN_LOW_SURROGATE = 56320;
        static MAX_LOW_SURROGATE = 57343;
        static MIN_SUPPLEMENTARY_CODE_POINT = 65536;
        static is32(B, C) {
          let t = 0, e = B.length;
          for (; t < e; ) {
            let s = t + Math.floor((e - t) / 2), n = B.getLo(s), i = B.getHi(s);
            if (n <= C && C <= i) {
              let a = B.getStride(s);
              return (C - n) % a === 0;
            }
            C < n ? e = s : t = s + 1;
          }
          return false;
        }
        static is(B, C) {
          if (C <= _.MAX_LATIN1) {
            for (let t = 0; t < B.length; t++) {
              if (C > B.getHi(t)) continue;
              let e = B.getLo(t);
              if (C < e) return false;
              let s = B.getStride(t);
              return (C - e) % s === 0;
            }
            return false;
          }
          return B.length > 0 && C >= B.getLo(0) && _.is32(B, C);
        }
        static isUpper(B) {
          if (B <= _.MAX_LATIN1) {
            let C = String.fromCodePoint(B);
            return C.toUpperCase() === C && C.toLowerCase() !== C;
          }
          return _.is(J.Upper, B);
        }
        static isPrint(B) {
          return B <= _.MAX_LATIN1 ? B >= 32 && B < _.MAX_ASCII || B >= 161 && B !== 173 : _.is(J.Print, B);
        }
        static simpleFold(B) {
          if (J.CASE_ORBIT.has(B)) return J.CASE_ORBIT.get(B);
          let C = E.toLowerCase(B);
          return C !== B ? C : E.toUpperCase(B);
        }
        static equalsIgnoreCase(B, C) {
          if (B === C) return true;
          if (B < 0 || C < 0) return false;
          if (B <= _.MAX_ASCII && C <= _.MAX_ASCII) return 65 <= B && B <= 90 && (B |= 32), 65 <= C && C <= 90 && (C |= 32), B === C;
          for (let t = _.simpleFold(B); t !== B; t = _.simpleFold(t)) if (t === C) return true;
          return false;
        }
      };
      pB = 256;
      qB = new Uint8Array(pB);
      for (let r = 0; r < pB; r++) qB[r] = 97 <= r && r <= 122 || 65 <= r && r <= 90 || 48 <= r && r <= 57 || r === 95 ? 1 : 0;
      lB = null;
      uB = null;
      G = class x {
        static METACHARACTERS = "\\.+*?()|[]{}^$";
        static EMPTY_BEGIN_LINE = 1;
        static EMPTY_END_LINE = 2;
        static EMPTY_BEGIN_TEXT = 4;
        static EMPTY_END_TEXT = 8;
        static EMPTY_WORD_BOUNDARY = 16;
        static EMPTY_NO_WORD_BOUNDARY = 32;
        static EMPTY_ALL = -1;
        static emptyInts() {
          return [];
        }
        static isByteArray(B) {
          return Array.isArray(B) || B instanceof Uint8Array;
        }
        static isalnum(B) {
          return E.CODES.get("0") <= B && B <= E.CODES.get("9") || E.CODES.get("a") <= B && B <= E.CODES.get("z") || E.CODES.get("A") <= B && B <= E.CODES.get("Z");
        }
        static unhex(B) {
          return E.CODES.get("0") <= B && B <= E.CODES.get("9") ? B - E.CODES.get("0") : E.CODES.get("a") <= B && B <= E.CODES.get("f") ? B - E.CODES.get("a") + 10 : E.CODES.get("A") <= B && B <= E.CODES.get("F") ? B - E.CODES.get("A") + 10 : -1;
        }
        static escapeRune(B) {
          let C = "";
          if (F.isPrint(B)) x.METACHARACTERS.indexOf(String.fromCodePoint(B)) >= 0 && (C += "\\"), C += String.fromCodePoint(B);
          else switch (B) {
            case E.CODES.get('"'):
              C += '\\"';
              break;
            case E.CODES.get("\\"):
              C += "\\\\";
              break;
            case E.CODES.get("	"):
              C += "\\t";
              break;
            case E.CODES.get(`
`):
              C += "\\n";
              break;
            case E.CODES.get("\r"):
              C += "\\r";
              break;
            case E.CODES.get("\b"):
              C += "\\b";
              break;
            case E.CODES.get("\f"):
              C += "\\f";
              break;
            default: {
              let t = B.toString(16);
              B < 256 ? (C += "\\x", t.length === 1 && (C += "0"), C += t) : C += `\\x{${t}}`;
              break;
            }
          }
          return C;
        }
        static stringToRunes(B) {
          let C = String(B), t = [], e = 0;
          for (; e < C.length; ) {
            let s = C.codePointAt(e);
            t.push(s), e += s > F.MAX_BMP ? 2 : 1;
          }
          return t;
        }
        static runeToString(B) {
          return String.fromCodePoint(B);
        }
        static isWordRune(B) {
          return B < pB ? qB[B] === 1 : false;
        }
        static emptyOpContext(B, C) {
          let t = 0;
          return B < 0 && (t |= x.EMPTY_BEGIN_TEXT | x.EMPTY_BEGIN_LINE), B === 10 && (t |= x.EMPTY_BEGIN_LINE), C < 0 && (t |= x.EMPTY_END_TEXT | x.EMPTY_END_LINE), C === 10 && (t |= x.EMPTY_END_LINE), x.isWordRune(B) !== x.isWordRune(C) ? t |= x.EMPTY_WORD_BOUNDARY : t |= x.EMPTY_NO_WORD_BOUNDARY, t;
        }
        static quoteMeta(B) {
          return B.split("").map((C) => x.METACHARACTERS.indexOf(C) >= 0 ? `\\${C}` : C).join("");
        }
        static charCount(B) {
          return B > F.MAX_BMP ? 2 : 1;
        }
        static toArray(B) {
          let C = B.length, t = new Array(C);
          for (let e = 0; e < C; e++) t[e] = B[e];
          return t;
        }
        static stringToUtf8ByteArray(B) {
          if (globalThis.TextEncoder) return lB || (lB = new TextEncoder()), lB.encode(B);
          {
            let C = [], t = 0;
            for (let e = 0; e < B.length; e++) {
              let s = B.charCodeAt(e);
              s < 128 ? C[t++] = s : s < 2048 ? (C[t++] = s >> 6 | 192, C[t++] = s & 63 | 128) : (s & 64512) === F.MIN_HIGH_SURROGATE && e + 1 < B.length && (B.charCodeAt(e + 1) & 64512) === F.MIN_LOW_SURROGATE ? (s = F.MIN_SUPPLEMENTARY_CODE_POINT + ((s & 1023) << 10) + (B.charCodeAt(++e) & 1023), C[t++] = s >> 18 | 240, C[t++] = s >> 12 & 63 | 128, C[t++] = s >> 6 & 63 | 128, C[t++] = s & 63 | 128) : (C[t++] = s >> 12 | 224, C[t++] = s >> 6 & 63 | 128, C[t++] = s & 63 | 128);
            }
            return C;
          }
        }
        static utf8ByteArrayToString(B) {
          if (globalThis.TextDecoder) {
            uB || (uB = new TextDecoder("utf-8"));
            let C = B instanceof Uint8Array ? B : new Uint8Array(B);
            return uB.decode(C);
          } else {
            let C = [], t = 0, e = 0;
            for (; t < B.length; ) {
              let s = B[t++];
              if (s < 128) C[e++] = String.fromCharCode(s);
              else if (s > 191 && s < 224) {
                let n = B[t++];
                C[e++] = String.fromCharCode((s & 31) << 6 | n & 63);
              } else if (s > 239 && s < 365) {
                let n = B[t++], i = B[t++], a = B[t++], h = ((s & 7) << 18 | (n & 63) << 12 | (i & 63) << 6 | a & 63) - F.MIN_SUPPLEMENTARY_CODE_POINT;
                C[e++] = String.fromCharCode(F.MIN_HIGH_SURROGATE + (h >> 10)), C[e++] = String.fromCharCode(F.MIN_LOW_SURROGATE + (h & 1023));
              } else {
                let n = B[t++], i = B[t++];
                C[e++] = String.fromCharCode((s & 15) << 12 | (n & 63) << 6 | i & 63);
              }
            }
            return C.join("");
          }
        }
      };
      VB = (r = [], B = 0) => {
        let C = /* @__PURE__ */ Object.create(null);
        for (let t = 0; t < r.length; t++) {
          let e = r[t], s = B + t;
          C[e] = s, C[s] = e;
        }
        return Object.freeze(C);
      };
      z = class cB {
        static Encoding = VB(["UTF_16", "UTF_8"]);
        getEncoding() {
          throw Error("not implemented");
        }
        asCharSequence() {
          throw Error("not implemented");
        }
        asBytes() {
          throw Error("not implemented");
        }
        length() {
          throw Error("not implemented");
        }
        isUTF8Encoding() {
          return this.getEncoding() === cB.Encoding.UTF_8;
        }
        isUTF16Encoding() {
          return this.getEncoding() === cB.Encoding.UTF_16;
        }
      };
      FB = class extends z {
        constructor(r = null) {
          super(), this.bytes = r;
        }
        getEncoding() {
          return z.Encoding.UTF_8;
        }
        asCharSequence() {
          return G.utf8ByteArrayToString(this.bytes);
        }
        asBytes() {
          return this.bytes;
        }
        length() {
          return this.bytes.length;
        }
      };
      rC = class extends z {
        constructor(r = null) {
          super(), this.charSequence = r;
        }
        getEncoding() {
          return z.Encoding.UTF_16;
        }
        asCharSequence() {
          return this.charSequence;
        }
        asBytes() {
          return G.stringToUtf8ByteArray(this.charSequence.toString());
        }
        length() {
          return this.charSequence.length;
        }
      };
      V = class {
        static utf16(r) {
          return new rC(r);
        }
        static utf8(r) {
          return G.isByteArray(r) ? new FB(r) : new FB(G.stringToUtf8ByteArray(r));
        }
      };
      P = class {
        static EOF() {
          return -8;
        }
        constructor() {
          this.end = 0;
        }
        canCheckPrefix() {
          return true;
        }
        endPos() {
          return this.end;
        }
        hasString() {
          return false;
        }
        hasAnyString() {
          return false;
        }
        prefixLength() {
          return 0;
        }
      };
      aC = class extends P {
        constructor(r, B = 0, C = r.length) {
          super(), this.bytes = r, this.start = B, this.end = C;
        }
        hasString(r, B) {
          let C = r.bytes;
          if (C.length === 0) return true;
          let t = this.indexOf(this.bytes, C, this.start + B);
          return t !== -1 && t <= this.end - C.length;
        }
        hasAnyString(r, B) {
          return r.ac8 ? r.ac8.searchUTF8(this.bytes, this.start + B, this.end) : false;
        }
        step(r) {
          if (r += this.start, r >= this.end) return P.EOF();
          let B = this.bytes[r] & 255;
          if (B < 128) return B << 3 | 1;
          if (B >= 194 && B <= 223 && r + 1 < this.end) {
            let C = this.bytes[r + 1] & 255;
            return (C & 192) !== 128 ? B << 3 | 1 : ((B & 31) << 6 | C & 63) << 3 | 2;
          } else if (B >= 224 && B <= 239 && r + 2 < this.end) {
            let C = this.bytes[r + 1] & 255;
            if ((C & 192) !== 128) return B << 3 | 1;
            let t = this.bytes[r + 2] & 255;
            return (t & 192) !== 128 ? B << 3 | 1 : ((B & 15) << 12 | (C & 63) << 6 | t & 63) << 3 | 3;
          } else if (B >= 240 && B <= 244 && r + 3 < this.end) {
            let C = this.bytes[r + 1] & 255;
            if ((C & 192) !== 128) return B << 3 | 1;
            let t = this.bytes[r + 2] & 255;
            if ((t & 192) !== 128) return B << 3 | 1;
            let e = this.bytes[r + 3] & 255;
            return (e & 192) !== 128 ? B << 3 | 1 : ((B & 7) << 18 | (C & 63) << 12 | (t & 63) << 6 | e & 63) << 3 | 4;
          } else return B << 3 | 1;
        }
        index(r, B) {
          B += this.start;
          let C = this.indexOf(this.bytes, r.prefixUTF8, B);
          return C < 0 ? C : C - B;
        }
        context(r) {
          r += this.start;
          let B = -1;
          if (r > this.start && r <= this.end) {
            let t = r - 1;
            if (B = this.bytes[t--], B >= 128) {
              let e = r - 4;
              for (e < this.start && (e = this.start); t >= e && (this.bytes[t] & 192) === 128; ) t--;
              t < this.start && (t = this.start), B = this.step(t - this.start) >> 3;
            }
          }
          let C = r < this.end ? this.step(r - this.start) >> 3 : -1;
          return G.emptyOpContext(B, C);
        }
        indexOf(r, B, C = 0) {
          let t = B.length;
          if (t === 0) return C <= this.end ? C : -1;
          let e = B[0], s = this.end - t, n = typeof r.indexOf == "function", i = C;
          for (; i <= s; ) {
            if (n) {
              if (i = r.indexOf(e, i), i === -1 || i > s) return -1;
            } else {
              for (; i <= s && r[i] !== e; ) i++;
              if (i > s) return -1;
            }
            let a = true;
            for (let h = 1; h < t; h++) if (r[i + h] !== B[h]) {
              a = false;
              break;
            }
            if (a) return i;
            i++;
          }
          return -1;
        }
        prefixLength(r) {
          return r.prefixUTF8.length;
        }
      };
      DC = class extends P {
        constructor(r, B = 0, C = r.length) {
          super(), this.charSequence = r, this.start = B, this.end = C;
        }
        hasString(r, B) {
          let C = this.charSequence.indexOf(r.str, this.start + B);
          return C !== -1 && C <= this.end - r.str.length;
        }
        hasAnyString(r, B) {
          return r.ac16 ? r.ac16.searchUTF16(this.charSequence, this.start + B, this.end) : false;
        }
        step(r) {
          if (r += this.start, r >= this.end) return P.EOF();
          let B = this.charSequence.charCodeAt(r);
          if (B < F.MIN_HIGH_SURROGATE || B > F.MAX_HIGH_SURROGATE || r + 1 >= this.end) return B << 3 | 1;
          let C = this.charSequence.charCodeAt(r + 1);
          return C >= F.MIN_LOW_SURROGATE && C <= F.MAX_LOW_SURROGATE ? (B - F.MIN_HIGH_SURROGATE) * 1024 + (C - F.MIN_LOW_SURROGATE) + F.MIN_SUPPLEMENTARY_CODE_POINT << 3 | 2 : B << 3 | 1;
        }
        index(r, B) {
          B += this.start;
          let C = this.charSequence.indexOf(r.prefix, B);
          return C < 0 || C > this.end - r.prefix.length ? -1 : C - B;
        }
        context(r) {
          r += this.start;
          let B = r > this.start && r <= this.end ? this.charSequence.charCodeAt(r - 1) : -1, C = r < this.end ? this.charSequence.charCodeAt(r) : -1;
          return G.emptyOpContext(B, C);
        }
        prefixLength(r) {
          return r.prefix.length;
        }
      };
      m = class {
        static fromUTF8(r, B = 0, C = r.length) {
          return new aC(r, B, C);
        }
        static fromUTF16(r, B = 0, C = r.length) {
          return new DC(r, B, C);
        }
      };
      eB = class extends Error {
        constructor(r) {
          super(r), this.name = "RE2JSException";
        }
      };
      R = class extends eB {
        constructor(r, B = null) {
          let C = `error parsing regexp: ${r}`;
          B && (C += `: \`${B}\``), super(C), this.name = "RE2JSSyntaxException", this.message = C, this.error = r, this.input = B;
        }
        getDescription() {
          return this.error;
        }
        getPattern() {
          return this.input;
        }
      };
      zB = class extends eB {
        constructor(r) {
          super(r), this.name = "RE2JSCompileException";
        }
      };
      M = class extends eB {
        constructor(r) {
          super(r), this.name = "RE2JSGroupException";
        }
      };
      lC = class extends eB {
        constructor(r) {
          super(r), this.name = "RE2JSFlagsException";
        }
      };
      CB = class extends eB {
        constructor(r) {
          super(r), this.name = "RE2JSInternalException";
        }
      };
      OB = class XB {
        static MAX_REPLACER_ARGS = 65535;
        static quoteReplacement(B, C = false) {
          return C ? B.indexOf("\\") < 0 && B.indexOf("$") < 0 ? B : B.split("").map((t) => {
            let e = t.codePointAt(0);
            return e === E.CODES.get("\\") || e === E.CODES.get("$") ? `\\${t}` : t;
          }).join("") : B.indexOf("$") < 0 ? B : B.split("").map((t) => t.codePointAt(0) === E.CODES.get("$") ? "$$" : t).join("");
        }
        constructor(B, C) {
          if (B === null) throw new Error("pattern is null");
          this.patternInput = B;
          let t = this.patternInput.re2();
          this.patternGroupCount = t.numberOfCapturingGroups(), this.groups = [], this.namedGroups = t.namedGroups, this.numberOfInstructions = t.numberOfInstructions(), C instanceof z ? this.resetMatcherInput(C) : G.isByteArray(C) ? this.resetMatcherInput(V.utf8(C)) : this.resetMatcherInput(V.utf16(C));
        }
        pattern() {
          return this.patternInput;
        }
        reset() {
          return this.matcherInputLength = this.matcherInput.length(), this.appendPos = 0, this.hasMatch = false, this.hasGroups = false, this.anchorFlag = 0, this;
        }
        resetMatcherInput(B) {
          if (B === null) throw new Error("input is null");
          return B instanceof z || (G.isByteArray(B) ? B = V.utf8(B) : B = V.utf16(B)), this.matcherInput = B, this.reset(), this;
        }
        start(B = 0) {
          if (typeof B == "string") {
            let C = this.namedGroups[B];
            if (!Number.isFinite(C)) throw new M(`group '${B}' not found`);
            B = C;
          }
          return this.loadGroup(B), this.groups[2 * B];
        }
        end(B = 0) {
          if (typeof B == "string") {
            let C = this.namedGroups[B];
            if (!Number.isFinite(C)) throw new M(`group '${B}' not found`);
            B = C;
          }
          return this.loadGroup(B), this.groups[2 * B + 1];
        }
        programSize() {
          return this.numberOfInstructions;
        }
        group(B = 0) {
          if (typeof B == "string") {
            let e = this.namedGroups[B];
            if (!Number.isFinite(e)) throw new M(`group '${B}' not found`);
            B = e;
          }
          let C = this.start(B), t = this.end(B);
          return C < 0 && t < 0 ? null : this.substring(C, t);
        }
        getNamedGroups() {
          if (!this.hasMatch) throw new M("perhaps no match attempted");
          let B = /* @__PURE__ */ Object.create(null);
          for (let C of Object.keys(this.namedGroups)) B[C] = this.group(C);
          return B;
        }
        groupCount() {
          return this.patternGroupCount;
        }
        loadGroup(B) {
          if (B < 0 || B > this.patternGroupCount) throw new M(`Group index out of bounds: ${B}`);
          if (!this.hasMatch) throw new M("perhaps no match attempted");
          if (B === 0 || this.hasGroups) return;
          let C = this.matcherInputLength, t = this.patternInput.re2().matchMachineInput(this.matcherInput, this.groups[0], C, this.anchorFlag, 1 + this.patternGroupCount);
          if (!t[0]) throw new M("inconsistency in matching group data");
          this.groups = t[1], this.hasGroups = true;
        }
        matches() {
          return this.genMatch(0, g.ANCHOR_BOTH);
        }
        lookingAt() {
          return this.genMatch(0, g.ANCHOR_START);
        }
        find(B = null) {
          if (B !== null) {
            if (B < 0 || B > this.matcherInputLength) throw new M(`start index out of bounds: ${B}`);
            return this.reset(), this.genMatch(B, 0);
          }
          if (B = 0, this.hasMatch && (B = this.groups[1], this.groups[0] === this.groups[1])) {
            let C = (this.matcherInput.isUTF16Encoding() ? m.fromUTF16(this.matcherInput.asCharSequence(), 0, this.matcherInputLength) : m.fromUTF8(this.matcherInput.asBytes(), 0, this.matcherInputLength)).step(B);
            C < 0 ? B++ : B += C & 7;
          }
          return this.genMatch(B, g.UNANCHORED);
        }
        genMatch(B, C) {
          let t = this.patternInput.re2().matchMachineInput(this.matcherInput, B, this.matcherInputLength, C, 1);
          return t[0] ? (this.groups = t[1], this.hasMatch = true, this.hasGroups = this.patternGroupCount === 0, this.anchorFlag = C, true) : (this.hasMatch = false, false);
        }
        substring(B, C) {
          return this.matcherInput.isUTF8Encoding() ? G.utf8ByteArrayToString(this.matcherInput.asBytes().slice(B, C)) : this.matcherInput.asCharSequence().substring(B, C).toString();
        }
        inputLength() {
          return this.matcherInputLength;
        }
        appendReplacement(B, C = false) {
          let t = "", e = this.start(), s = this.end();
          return this.appendPos < e && (t += this.substring(this.appendPos, e)), this.appendPos = s, t += C ? this.appendReplacementInternalJava(B) : this.appendReplacementInternalJs(B), t;
        }
        appendReplacementInternalJava(B) {
          let C = "", t = 0, e = B.length, s = 0;
          for (; s < e; ) {
            let n = B.codePointAt(s);
            if (n === E.CODES.get("\\")) {
              if (t < s && (C += B.substring(t, s)), s++, s >= e) throw new M("character to be escaped is missing");
              t = s, s++;
              continue;
            }
            if (n === E.CODES.get("$")) {
              if (t < s && (C += B.substring(t, s)), s + 1 >= e) throw new M("Illegal group reference: group index is missing");
              let i = B.codePointAt(s + 1);
              if (E.CODES.get("0") <= i && i <= E.CODES.get("9")) {
                let a = i - E.CODES.get("0"), h = s + 2;
                for (; h < e; h++) {
                  let f = B.codePointAt(h);
                  if (f < E.CODES.get("0") || f > E.CODES.get("9") || a * 10 + f - E.CODES.get("0") > this.patternGroupCount) break;
                  a = a * 10 + f - E.CODES.get("0");
                }
                if (a > this.patternGroupCount) throw new M(`n > number of groups: ${a}`);
                let o = this.group(a);
                o !== null && (C += o), s = h, t = s;
              } else if (i === E.CODES.get("{")) {
                let a = s + 2;
                for (; a < e && B.codePointAt(a) !== E.CODES.get("}"); ) a++;
                if (a >= e) throw new M("named capture group is missing trailing '}'");
                let h = B.substring(s + 2, a), o = this.group(h);
                o !== null && (C += o), s = a + 1, t = s;
              } else throw new M("Illegal group reference");
              continue;
            }
            s++;
          }
          return t < e && (C += B.substring(t, e)), C;
        }
        appendReplacementInternalJs(B) {
          let C = "", t = 0, e = B.length;
          for (let s = 0; s < e - 1; s++) if (B.codePointAt(s) === E.CODES.get("$")) {
            let n = B.codePointAt(s + 1);
            if (E.CODES.get("$") === n) {
              t < s && (C += B.substring(t, s)), C += "$", s++, t = s + 1;
              continue;
            } else if (E.CODES.get("&") === n) {
              t < s && (C += B.substring(t, s));
              let i = this.group(0);
              i !== null ? C += i : C += "$&", s++, t = s + 1;
              continue;
            } else if (E.CODES.get("`") === n) {
              t < s && (C += B.substring(t, s)), C += this.substring(0, this.start(0)), s++, t = s + 1;
              continue;
            } else if (E.CODES.get("'") === n) {
              t < s && (C += B.substring(t, s)), C += this.substring(this.end(0), this.matcherInputLength), s++, t = s + 1;
              continue;
            } else if (E.CODES.get("1") <= n && n <= E.CODES.get("9")) {
              let i = n - E.CODES.get("0");
              for (t < s && (C += B.substring(t, s)), s += 2; s < e && (n = B.codePointAt(s), !(n < E.CODES.get("0") || n > E.CODES.get("9") || i * 10 + n - E.CODES.get("0") > this.patternGroupCount)); s++) i = i * 10 + n - E.CODES.get("0");
              if (i > this.patternGroupCount) {
                C += `$${i}`, t = s, s--;
                continue;
              }
              let a = this.group(i);
              a !== null && (C += a), t = s, s--;
              continue;
            } else if (n === E.CODES.get("<")) {
              t < s && (C += B.substring(t, s)), s++;
              let i = s + 1;
              for (; i < B.length && B.codePointAt(i) !== E.CODES.get(">") && B.codePointAt(i) !== E.CODES.get(" "); ) i++;
              if (i === B.length || B.codePointAt(i) !== E.CODES.get(">")) {
                C += B.substring(s - 1, i + 1), t = i + 1, s = i;
                continue;
              }
              let a = B.substring(s + 1, i);
              if (Object.prototype.hasOwnProperty.call(this.namedGroups, a)) {
                let h = this.group(a);
                h !== null && (C += h);
              } else C += `$<${a}>`;
              t = i + 1, s = i;
              continue;
            }
          }
          return t < e && (C += B.substring(t, e)), C;
        }
        appendTail() {
          return this.substring(this.appendPos, this.matcherInputLength);
        }
        replaceAll(B, C = false) {
          return this.replace(B, true, C);
        }
        replaceFirst(B, C = false) {
          return this.replace(B, false, C);
        }
        replace(B, C = true, t = false) {
          let e = "";
          this.reset();
          let s = typeof B == "function", n = Object.keys(this.namedGroups).length > 0, i = null;
          if (s) {
            if (this.groupCount() >= XB.MAX_REPLACER_ARGS) throw new M("Too many capture groups to safely invoke replacer function");
            i = this.matcherInput.isUTF8Encoding() ? this.matcherInput.asBytes() : this.matcherInput.asCharSequence();
          }
          for (; this.find() && (e += s ? this.appendReplacementFunc(B, n, i) : this.appendReplacement(B, t), !!C); ) ;
          return e += this.appendTail(), e;
        }
        appendReplacementFunc(B, C, t) {
          let e = "", s = this.start(), n = this.end();
          this.appendPos < s && (e += this.substring(this.appendPos, s)), this.appendPos = n;
          let i = this.buildReplacerArgs(s, C, t);
          return e += String(B(...i)), e;
        }
        buildReplacerArgs(B, C, t) {
          let e = [this.group(0)], s = this.groupCount();
          for (let n = 1; n <= s; n++) {
            let i = this.start(n);
            i < 0 ? e.push(void 0) : e.push(this.substring(i, this.end(n)));
          }
          if (e.push(B), e.push(t), C) {
            let n = this.getNamedGroups();
            for (let i in n) n[i] === null && (n[i] = void 0);
            e.push(n);
          }
          return e;
        }
      };
      c = class S {
        static ALT = 1;
        static ALT_MATCH = 2;
        static CAPTURE = 3;
        static EMPTY_WIDTH = 4;
        static FAIL = 5;
        static MATCH = 6;
        static NOP = 7;
        static RUNE = 8;
        static RUNE1 = 9;
        static RUNE_ANY = 10;
        static RUNE_ANY_NOT_NL = 11;
        static LB_WRITE = 12;
        static LB_CHECK = 13;
        static isRuneOp(B) {
          return S.RUNE <= B && B <= S.RUNE_ANY_NOT_NL;
        }
        static escapeRunes(B) {
          let C = '"';
          for (let t of B) C += G.escapeRune(t);
          return C += '"', C;
        }
        constructor(B) {
          this.op = B, this.out = 0, this.arg = 0, this.runes = [], this.next = null;
        }
        matchRune(B) {
          if (this.runes.length === 1) {
            let n = this.runes[0];
            return (this.arg & g.FOLD_CASE) !== 0 ? F.equalsIgnoreCase(n, B) : B === n;
          }
          let C = this.runes.length;
          if (C === 0) return false;
          if (C === 2 || C === 4 || C === 6 || C === 8) {
            for (let n = 0; n < C; n += 2) {
              if (B < this.runes[n]) return false;
              if (B <= this.runes[n + 1]) return true;
            }
            return false;
          }
          let t = 0, e = C >> 1;
          for (; e > 1; ) {
            let n = e >> 1;
            t += this.runes[t + n << 1] <= B ? n : 0, e -= n;
          }
          t += this.runes[t << 1] <= B ? 1 : 0;
          let s = t - 1;
          return s >= 0 && B <= this.runes[s << 1 | 1];
        }
        matchRunePos(B) {
          if (this.runes.length === 1) {
            let n = this.runes[0];
            return (this.arg & g.FOLD_CASE) !== 0 ? F.equalsIgnoreCase(n, B) ? 0 : -1 : B === n ? 0 : -1;
          }
          let C = this.runes.length;
          if (C === 0) return -1;
          if (C === 2 || C === 4 || C === 6 || C === 8) {
            for (let n = 0; n < C; n += 2) {
              if (B < this.runes[n]) return -1;
              if (B <= this.runes[n + 1]) return Math.floor(n / 2);
            }
            return -1;
          }
          let t = 0, e = C >> 1;
          for (; e > 1; ) {
            let n = e >> 1;
            t += this.runes[t + n << 1] <= B ? n : 0, e -= n;
          }
          t += this.runes[t << 1] <= B ? 1 : 0;
          let s = t - 1;
          return s >= 0 && B <= this.runes[s << 1 | 1] ? s : -1;
        }
        toString() {
          switch (this.op) {
            case S.ALT:
              return `alt -> ${this.out}, ${this.arg}`;
            case S.ALT_MATCH:
              return `altmatch -> ${this.out}, ${this.arg}`;
            case S.CAPTURE:
              return `cap ${this.arg} -> ${this.out}`;
            case S.EMPTY_WIDTH:
              return `empty ${this.arg} -> ${this.out}`;
            case S.MATCH:
              return `match${this.arg !== 0 ? ` ${this.arg}` : ""}`;
            case S.FAIL:
              return "fail";
            case S.NOP:
              return `nop -> ${this.out}`;
            case S.LB_WRITE:
              return `lbwrite ${this.arg} -> ${this.out}`;
            case S.LB_CHECK:
              return `lbcheck ${this.arg} -> ${this.out}`;
            case S.RUNE:
              return this.runes === null ? "rune <null>" : ["rune ", S.escapeRunes(this.runes), (this.arg & g.FOLD_CASE) !== 0 ? "/i" : "", " -> ", this.out].join("");
            case S.RUNE1:
              return `rune1 ${S.escapeRunes(this.runes)} -> ${this.out}`;
            case S.RUNE_ANY:
              return `any -> ${this.out}`;
            case S.RUNE_ANY_NOT_NL:
              return `anynotnl -> ${this.out}`;
            default:
              throw new Error("unhandled case in Inst.toString");
          }
        }
      };
      IB = class {
        constructor(r) {
          this.sparse = new Int32Array(r), this.densePcs = new Int32Array(r), this.denseCaps = null, this.size = 0, this.ncap = 0;
        }
        init(r) {
          this.ncap = r;
          let B = this.densePcs.length * r;
          (!this.denseCaps || this.denseCaps.length < B) && (this.denseCaps = new Int32Array(B));
        }
        contains(r) {
          let B = this.sparse[r];
          return B < this.size && this.densePcs[B] === r;
        }
        isEmpty() {
          return this.size === 0;
        }
        add(r) {
          let B = this.size++;
          return this.sparse[r] = B, this.densePcs[B] = r, B;
        }
        clear() {
          this.size = 0;
        }
        toString() {
          let r = "{";
          for (let B = 0; B < this.size; B++) B !== 0 && (r += ", "), r += this.densePcs[B];
          return r += "}", r;
        }
      };
      ZB = class gB {
        static fromRE2(B) {
          let C = new gB();
          return C.prog = B.prog, C.re2 = B, C.q0 = new IB(C.prog.numInst()), C.q1 = new IB(C.prog.numInst()), C.matched = false, C.matchcap = new Int32Array(C.prog.numCap < 2 ? 2 : C.prog.numCap), C.ncap = 0, C;
        }
        static fromMachine(B) {
          return gB.fromRE2(B.re2);
        }
        constructor() {
          this.prog = null, this.re2 = null, this.q0 = null, this.q1 = null, this.matched = false, this.matchcap = null, this.ncap = 0, this.lbTable = null;
        }
        init(B) {
          this.ncap = B, B > this.matchcap.length ? this.matchcap = new Int32Array(B).fill(-1) : this.matchcap.fill(-1), this.q0.init(B), this.q1.init(B), this.prog.numLb > 0 && ((!this.lbTable || this.lbTable.length < this.prog.numLb + 1) && (this.lbTable = new Int32Array(this.prog.numLb + 1)), this.lbTable.fill(-1));
        }
        submatches() {
          return this.ncap === 0 ? G.emptyInts() : G.toArray(this.matchcap.subarray(0, this.ncap));
        }
        match(B, C, t) {
          let e = this.re2.cond;
          if (e === G.EMPTY_ALL || (t === g.ANCHOR_START || t === g.ANCHOR_BOTH) && C !== 0) return false;
          this.matched = false, this.matchcap.fill(-1);
          let s = this.prog.numLb > 0 ? 0 : C, n = C, i = this.q0, a = this.q1, h = B.step(s), o = h >> 3, f = h & 7, p = -1, O = 0;
          h !== P.EOF() && (h = B.step(s + f), p = h >> 3, O = h & 7);
          let L;
          for (s === 0 ? L = G.emptyOpContext(-1, o) : L = B.context(s); ; ) {
            if (i.isEmpty()) {
              if ((e & G.EMPTY_BEGIN_TEXT) !== 0 && s !== 0 || (t === g.ANCHOR_START || t === g.ANCHOR_BOTH) && s !== 0 || this.matched) break;
              if (this.prog.numLb === 0 && this.re2.prefix.length !== 0 && p !== this.re2.prefixRune && B.canCheckPrefix()) {
                let T = B.index(this.re2, s);
                if (T < 0) break;
                s += T, h = B.step(s), o = h >> 3, f = h & 7, h = B.step(s + f), p = h >> 3, O = h & 7, L = B.context(s);
              }
            }
            if (s === 0 && this.prog.numLb > 0) for (let T = 0; T < this.prog.lbStarts.length; T++) this.add(i, this.prog.lbStarts[T], s, this.matchcap, 0, L);
            !this.matched && (s === 0 || t === g.UNANCHORED) && s >= n && (this.ncap > 0 && (this.matchcap[0] = s), this.add(i, this.prog.start, s, this.matchcap, 0, L));
            let A = s + f;
            if (L = B.context(A), this.step(i, a, s, A, o, L, t, s === B.endPos()), f === 0 || this.ncap === 0 && this.matched) break;
            s += f, o = p, f = O, o !== -1 && (h = B.step(s + f), p = h >> 3, O = h & 7);
            let d = i;
            i = a, a = d;
          }
          return a.clear(), this.matched;
        }
        matchSet(B, C, t) {
          let e = this.re2.cond;
          if (e === G.EMPTY_ALL) return [];
          if ((t === g.ANCHOR_START || t === g.ANCHOR_BOTH) && C !== 0) return [];
          let s = this.prog.numLb > 0 ? 0 : C, n = C, i = this.q0, a = this.q1, h = B.step(s), o = h >> 3, f = h & 7, p = -1, O = 0;
          h !== P.EOF() && (h = B.step(s + f), p = h >> 3, O = h & 7);
          let L = s === 0 ? G.emptyOpContext(-1, o) : B.context(s), A = /* @__PURE__ */ new Set();
          for (; !(i.isEmpty() && ((e & G.EMPTY_BEGIN_TEXT) !== 0 && s !== 0 || (t === g.ANCHOR_START || t === g.ANCHOR_BOTH) && s !== 0)); ) {
            if (s === 0 && this.prog.numLb > 0) for (let v = 0; v < this.prog.lbStarts.length; v++) this.add(i, this.prog.lbStarts[v], s, this.matchcap, 0, L);
            (s === 0 || t === g.UNANCHORED) && s >= n && this.add(i, this.prog.start, s, this.matchcap, 0, L);
            let d = s + f;
            L = B.context(d);
            for (let v = 0; v < i.size; v++) {
              let sC = i.densePcs[v], W = this.prog.inst[sC], nC = v * this.ncap, $ = false;
              switch (W.op) {
                case c.MATCH:
                  if (t === g.ANCHOR_BOTH && s !== B.endPos()) break;
                  A.add(W.arg);
                  break;
                case c.RUNE:
                  $ = W.matchRune(o);
                  break;
                case c.RUNE1:
                  $ = o === W.runes[0];
                  break;
                case c.RUNE_ANY:
                  $ = true;
                  break;
                case c.RUNE_ANY_NOT_NL:
                  $ = o !== 10;
                  break;
                default:
                  continue;
              }
              $ && this.add(a, W.out, d, i.denseCaps, nC, L);
            }
            if (i.clear(), f === 0) break;
            s += f, o = p, f = O, o !== -1 && (h = B.step(s + f), p = h >> 3, O = h & 7);
            let T = i;
            i = a, a = T;
          }
          return a.clear(), Array.from(A).sort((d, T) => d - T);
        }
        step(B, C, t, e, s, n, i, a) {
          let h = this.re2.longest;
          for (let o = 0; o < B.size; o++) {
            let f = B.densePcs[o], p = o * this.ncap;
            if (h && this.matched && this.ncap > 0 && this.matchcap[0] < B.denseCaps[p]) continue;
            let O = this.prog.inst[f], L = false;
            switch (O.op) {
              case c.MATCH:
                if (i === g.ANCHOR_BOTH && !a) break;
                if (this.ncap > 0 && (!h || !this.matched || this.matchcap[1] < t)) {
                  B.denseCaps[p + 1] = t;
                  for (let A = 0; A < this.ncap; A++) this.matchcap[A] = B.denseCaps[p + A];
                }
                h || (B.size = 0), this.matched = true;
                break;
              case c.RUNE:
                L = O.matchRune(s);
                break;
              case c.RUNE1:
                L = s === O.runes[0];
                break;
              case c.RUNE_ANY:
                L = true;
                break;
              case c.RUNE_ANY_NOT_NL:
                L = s !== 10;
                break;
              default:
                continue;
            }
            L && this.add(C, O.out, e, B.denseCaps, p, n);
          }
          B.clear();
        }
        add(B, C, t, e, s, n) {
          for (; ; ) {
            if (C === 0 || B.contains(C)) return;
            let i = B.add(C), a = this.prog.inst[C];
            switch (a.op) {
              case c.FAIL:
                return;
              case c.ALT:
              case c.ALT_MATCH:
                this.add(B, a.out, t, e, s, n), C = a.arg;
                continue;
              case c.EMPTY_WIDTH:
                if ((a.arg & ~n) === 0) {
                  C = a.out;
                  continue;
                }
                return;
              case c.NOP:
                C = a.out;
                continue;
              case c.CAPTURE:
                if (a.arg < this.ncap) {
                  let h = e[s + a.arg];
                  e[s + a.arg] = t, this.add(B, a.out, t, e, s, n), e[s + a.arg] = h;
                  return;
                } else {
                  C = a.out;
                  continue;
                }
              case c.LB_WRITE:
                this.lbTable[Math.abs(a.arg)] = t, C = a.out;
                continue;
              case c.LB_CHECK:
                if (a.arg > 0) {
                  if (this.lbTable[a.arg] === t) {
                    C = a.out;
                    continue;
                  }
                } else if (this.lbTable[-a.arg] !== t) {
                  C = a.out;
                  continue;
                }
                return;
              case c.MATCH:
              case c.RUNE:
              case c.RUNE1:
              case c.RUNE_ANY:
              case c.RUNE_ANY_NOT_NL:
                if (this.ncap > 0) {
                  let h = i * this.ncap;
                  for (let o = 0; o < this.ncap; o++) B.denseCaps[h + o] = e[s + o];
                }
                return;
              default:
                throw new CB("unhandled");
            }
          }
        }
      };
      GB = (r) => {
        let B = -2128831035;
        for (let C = 0; C < r.length; C++) B ^= r[C], B = Math.imul(B, 16777619);
        return B;
      };
      uC = (r, B) => {
        if (r.length !== B.length) return false;
        for (let C = 0; C < r.length; C++) if (r[C] !== B[C]) return false;
        return true;
      };
      hC = class {
        constructor(r, B, C = []) {
          this.nfaStates = r, this.isMatch = B, this.matchIDs = C, this.nextLatin1 = new Array(F.MAX_LATIN1 + 1).fill(null), this.nextLatin1Anchored = new Array(F.MAX_LATIN1 + 1).fill(null), this.transKeys = [], this.transVals = [], this.lastSeen = 0;
        }
      };
      WB = class fB {
        static MAX_CACHE_CLEARS = 5;
        static STATE_MEMORY_ESTIMATE = 838;
        constructor(B, C = 8388608) {
          this.prog = B, this.stateCache = /* @__PURE__ */ new Map(), this.stateCount = 0, this.startState = null, this.stateLimit = Math.max(1, Math.floor(C / fB.STATE_MEMORY_ESTIMATE)), this.cacheClears = 0, this.failed = false, this.clock = 0;
        }
        computeClosure(B) {
          let C = /* @__PURE__ */ new Set(), t = [...B], e = false, s = [];
          for (; t.length > 0; ) {
            let i = t.pop();
            if (C.has(i)) continue;
            C.add(i);
            let a = this.prog.getInst(i);
            switch (a.op) {
              case c.MATCH:
                e = true, s.includes(a.arg) || s.push(a.arg);
                break;
              case c.ALT:
              case c.ALT_MATCH:
                t.push(a.out), t.push(a.arg);
                break;
              case c.NOP:
              case c.CAPTURE:
                t.push(a.out);
                break;
              case c.EMPTY_WIDTH:
              case c.LB_WRITE:
              case c.LB_CHECK:
                return null;
            }
          }
          let n = Int32Array.from(C).sort();
          return s.sort((i, a) => i - a), { pcs: n, isMatch: e, matchIDs: s };
        }
        getState(B) {
          let C = this.computeClosure(B);
          if (!C) return null;
          let t = C.pcs, e = GB(t), s = this.stateCache.get(e);
          if (s) for (let i = 0; i < s.length; i++) {
            let a = s[i];
            if (uC(a.nfaStates, t)) return a.lastSeen = ++this.clock, a;
          }
          else s = [], this.stateCache.set(e, s);
          if (this.failed) return null;
          if (this.stateCount >= this.stateLimit) {
            if (this.cacheClears++, this.cacheClears >= fB.MAX_CACHE_CLEARS) return this.failed = true, this.stateCache.clear(), this.stateCount = 0, this.startState = null, null;
            this.evictCache(), s = this.stateCache.get(e), s || (s = [], this.stateCache.set(e, s));
          }
          let n = new hC(t, C.isMatch, C.matchIDs);
          return n.lastSeen = ++this.clock, s.push(n), this.stateCount++, n;
        }
        evictCache() {
          let B = [];
          for (let n of this.stateCache.values()) for (let i = 0; i < n.length; i++) B.push(n[i]);
          B.sort((n, i) => n.lastSeen - i.lastSeen);
          let C = Math.max(1, Math.floor(this.stateLimit / 2)), t = B.length - C, e = B.slice(t), s = new Set(e);
          this.stateCache.clear(), this.stateCount = 0;
          for (let n = 0; n < e.length; n++) {
            let i = e[n];
            i.nextLatin1.fill(null), i.nextLatin1Anchored.fill(null), i.transKeys.length = 0, i.transVals.length = 0;
            let a = GB(i.nfaStates), h = this.stateCache.get(a);
            h || (h = [], this.stateCache.set(a, h)), h.push(i), this.stateCount++;
          }
          this.startState && !s.has(this.startState) && (this.startState = null);
        }
        step(B, C, t) {
          if (C <= F.MAX_LATIN1) if (t === g.UNANCHORED) {
            let n = B.nextLatin1[C];
            if (n !== null) return n;
          } else {
            let n = B.nextLatin1Anchored[C];
            if (n !== null) return n;
          }
          else {
            let n = C + (t === g.UNANCHORED ? 0 : F.MAX_RUNE + 1), i = B.transKeys, a = i.length;
            for (let h = 0; h < a; h++) if (i[h] === n) return B.transVals[h];
          }
          let e = [];
          for (let n = 0; n < B.nfaStates.length; n++) {
            let i = B.nfaStates[n], a = this.prog.getInst(i);
            c.isRuneOp(a.op) && a.matchRune(C) && e.push(a.out);
          }
          t === g.UNANCHORED && e.push(this.prog.start);
          let s = this.getState(e);
          if (C <= F.MAX_LATIN1) t === g.UNANCHORED ? B.nextLatin1[C] = s : B.nextLatin1Anchored[C] = s;
          else {
            let n = C + (t === g.UNANCHORED ? 0 : F.MAX_RUNE + 1);
            B.transKeys.push(n), B.transVals.push(s);
          }
          return s;
        }
        match(B, C, t) {
          if ((t === g.ANCHOR_START || t === g.ANCHOR_BOTH) && C !== 0) return false;
          if (!this.startState && (this.startState = this.getState([this.prog.start]), !this.startState)) return null;
          let e = B.endPos(), s = this.startState;
          if (s.isMatch) if (t === g.ANCHOR_BOTH) {
            if (C === e) return true;
          } else return true;
          let n = C;
          for (; n < e; ) {
            let i = B.step(n), a = i >> 3, h = i & 7;
            if (h === 0) break;
            if (s = t === g.UNANCHORED && a <= F.MAX_LATIN1 && s.nextLatin1[a] || this.step(s, a, t), s === null) return null;
            if (s.lastSeen = ++this.clock, s.isMatch) if (t === g.ANCHOR_BOTH) {
              if (n + h === e) return true;
            } else return true;
            if (s.nfaStates.length === 0 && t !== g.UNANCHORED) return false;
            n += h;
          }
          return false;
        }
        matchSet(B, C, t) {
          if ((t === g.ANCHOR_START || t === g.ANCHOR_BOTH) && C !== 0) return [];
          if (!this.startState && (this.startState = this.getState([this.prog.start]), !this.startState)) return null;
          let e = B.endPos(), s = this.startState, n = /* @__PURE__ */ new Set(), i = (h, o) => {
            h.isMatch && (t === g.ANCHOR_BOTH ? o === e && h.matchIDs.forEach((f) => n.add(f)) : h.matchIDs.forEach((f) => n.add(f)));
          };
          i(s, C);
          let a = C;
          for (; a < e; ) {
            let h = B.step(a), o = h >> 3, f = h & 7;
            if (f === 0) break;
            if (s = t === g.UNANCHORED && o <= F.MAX_LATIN1 && s.nextLatin1[o] || this.step(s, o, t), s === null) return null;
            if (s.lastSeen = ++this.clock, a += f, i(s, a), s.nfaStates.length === 0 && t !== g.UNANCHORED) break;
          }
          return Array.from(n).sort((h, o) => h - o);
        }
      };
      oC = 32;
      EC = 500;
      hB = 256;
      cC = 256 * 1024;
      gC = class {
        constructor() {
          this.end = 0, this.cap = new Int32Array(0), this.matchcap = new Int32Array(0), this.ncap = 0, this.jobPc = new Int32Array(hB), this.jobArg = new Uint8Array(hB), this.jobPos = new Int32Array(hB), this.jobLen = 0, this.visited = new Uint32Array(0);
        }
        reset(r, B, C) {
          this.end = B, this.jobLen = 0, this.ncap = C;
          let t = r.numInst() * (B + 1) + oC - 1 >>> 5;
          this.visited.length < t ? this.visited = new Uint32Array(t) : this.visited.fill(0, 0, t), this.cap.length < C ? this.cap = new Int32Array(C).fill(-1) : this.cap.fill(-1, 0, C), this.matchcap.length < C ? this.matchcap = new Int32Array(C).fill(-1) : this.matchcap.fill(-1, 0, C);
        }
        shouldVisit(r, B) {
          let C = r * (this.end + 1) + B, t = C >>> 5, e = 1 << (C & 31);
          return (this.visited[t] & e) !== 0 ? false : (this.visited[t] |= e, true);
        }
        push(r, B, C, t) {
          if (r.prog.getInst(B).op !== c.FAIL && (t || this.shouldVisit(B, C))) {
            if (this.jobLen >= this.jobPc.length) {
              let e = this.jobPc.length * 2, s = new Int32Array(e);
              s.set(this.jobPc), this.jobPc = s;
              let n = new Uint8Array(e);
              n.set(this.jobArg), this.jobArg = n;
              let i = new Int32Array(e);
              i.set(this.jobPos), this.jobPos = i;
            }
            this.jobPc[this.jobLen] = B, this.jobArg[this.jobLen] = t ? 1 : 0, this.jobPos[this.jobLen] = C, this.jobLen++;
          }
        }
        tryBacktrack(r, B, C, t, e) {
          let s = r.longest;
          for (this.push(r, C, t, false); this.jobLen > 0; ) {
            this.jobLen--;
            let n = this.jobPc[this.jobLen], i = this.jobArg[this.jobLen] === 1, a = this.jobPos[this.jobLen], h = true;
            for (; !(!h && !this.shouldVisit(n, a)); ) {
              h = false;
              let o = r.prog.getInst(n);
              switch (o.op) {
                case c.FAIL:
                  throw new CB("unexpected InstFail");
                case c.ALT:
                  if (i) {
                    i = false, n = o.arg;
                    continue;
                  } else {
                    this.push(r, n, a, true), n = o.out;
                    continue;
                  }
                case c.ALT_MATCH: {
                  let f = r.prog.getInst(o.out);
                  if (c.isRuneOp(f.op)) {
                    this.push(r, o.arg, a, false), n = o.arg, a = this.end;
                    continue;
                  }
                  this.push(r, o.out, this.end, false), n = o.out;
                  continue;
                }
                case c.RUNE: {
                  let f = B.step(a);
                  if (f === P.EOF() || !o.matchRune(f >> 3)) break;
                  a += f & 7, n = o.out;
                  continue;
                }
                case c.RUNE1: {
                  let f = B.step(a);
                  if (f === P.EOF() || f >> 3 !== o.runes[0]) break;
                  a += f & 7, n = o.out;
                  continue;
                }
                case c.RUNE_ANY_NOT_NL: {
                  let f = B.step(a);
                  if (f === P.EOF() || f >> 3 === 10) break;
                  a += f & 7, n = o.out;
                  continue;
                }
                case c.RUNE_ANY: {
                  let f = B.step(a);
                  if (f === P.EOF()) break;
                  a += f & 7, n = o.out;
                  continue;
                }
                case c.CAPTURE:
                  if (i) {
                    this.cap[o.arg] = a;
                    break;
                  } else {
                    o.arg < this.ncap && (this.push(r, n, this.cap[o.arg], true), this.cap[o.arg] = a), n = o.out;
                    continue;
                  }
                case c.EMPTY_WIDTH: {
                  let f = B.context(a);
                  if ((o.arg & ~f) !== 0) break;
                  n = o.out;
                  continue;
                }
                case c.NOP:
                  n = o.out;
                  continue;
                case c.MATCH: {
                  if (e === g.ANCHOR_BOTH && a !== this.end) break;
                  if (this.ncap === 0) return true;
                  this.ncap > 1 && (this.cap[1] = a);
                  let f = this.matchcap[1];
                  if ((f === -1 || s && a > 0 && a > f) && this.matchcap.set(this.cap), !s || a === this.end) return true;
                  break;
                }
                case c.LB_WRITE:
                case c.LB_CHECK:
                  throw new CB("Backtracker cannot evaluate Lookbehind instructions");
                default:
                  throw new CB("bad inst");
              }
              break;
            }
          }
          return s && this.matchcap.length > 1 && this.matchcap[1] >= 0;
        }
      };
      iB = [];
      rB = class $B {
        static shouldBacktrack(B) {
          return B.numInst() <= EC;
        }
        static maxBitStateLen(B) {
          return $B.shouldBacktrack(B) ? Math.floor(cC / B.numInst()) : 0;
        }
        static execute(B, C, t, e, s) {
          let n = B.cond;
          if (n === G.EMPTY_ALL || (e === g.ANCHOR_START || e === g.ANCHOR_BOTH) && t !== 0 || (n & G.EMPTY_BEGIN_TEXT) !== 0 && t !== 0) return null;
          let i = iB.length > 0 ? iB.pop() : new gC(), a = C.endPos();
          i.reset(B.prog, a, s);
          let h = false;
          if ((n & G.EMPTY_BEGIN_TEXT) !== 0 || e === g.ANCHOR_START || e === g.ANCHOR_BOTH) i.ncap > 0 && (i.cap[0] = t), i.tryBacktrack(B, C, B.prog.start, t, e) && (h = true);
          else {
            let f = -1;
            for (; t <= a && f !== 0; t += f) {
              if (B.prefix.length > 0) {
                let O = C.index(B, t);
                if (O < 0) break;
                t += O;
              }
              if (i.ncap > 0 && (i.cap[0] = t), i.tryBacktrack(B, C, B.prog.start, t, e)) {
                h = true;
                break;
              }
              let p = C.step(t);
              f = p === P.EOF() ? 0 : p & 7;
            }
          }
          if (!h) return iB.push(i), null;
          let o = s === 0 ? [] : G.toArray(i.matchcap.subarray(0, s));
          return iB.push(i), o;
        }
      };
      LB = class {
        constructor(r) {
          this.sparse = new Uint32Array(r), this.dense = new Uint32Array(r), this.size = 0, this.nextIndex = 0;
        }
        empty() {
          return this.nextIndex >= this.size;
        }
        next() {
          return this.dense[this.nextIndex++];
        }
        clear() {
          this.size = 0, this.nextIndex = 0;
        }
        contains(r) {
          return r < this.sparse.length && this.sparse[r] < this.size && this.dense[this.sparse[r]] === r;
        }
        insert(r) {
          this.contains(r) || this.insertNew(r);
        }
        insertNew(r) {
          r >= this.sparse.length || (this.sparse[r] = this.size, this.dense[this.size] = r, this.size++);
        }
      };
      fC = (r, B, C, t) => {
        let e = r.length, s = B.length, n = 0, i = 0, a = [], h = [], o = true, f = -1, p = (O) => {
          let L = O ? r : B, A = O ? n : i, d = O ? C : t;
          return f > 0 && L[A] <= a[f] ? false : (a.push(L[A], L[A + 1]), O ? n += 2 : i += 2, f += 2, h.push(d), true);
        };
        for (; n < e || i < s; ) if (i >= s ? o = p(true) : n >= e || B[i] < r[n] ? o = p(false) : o = p(true), !o) return null;
        return { merged: a, next: h };
      };
      pC = class {
        constructor(r) {
          this.start = r.start, this.numCap = r.numCap, this.inst = new Array(r.inst.length);
          for (let B = 0; B < r.inst.length; B++) {
            let C = r.inst[B], t = new c(C.op);
            t.out = C.out, t.arg = C.arg, t.runes = C.runes ? C.runes.slice() : [], t.next = null, this.inst[B] = t;
          }
        }
      };
      FC = (r) => {
        let B = new pC(r);
        for (let C = 0; C < B.inst.length; C++) {
          let t = B.inst[C];
          if (t.op !== c.ALT && t.op !== c.ALT_MATCH) continue;
          let e = "out", s = "arg", n = B.inst[t[s]];
          if (n.op !== c.ALT && n.op !== c.ALT_MATCH && (e = "arg", s = "out", n = B.inst[t[s]], n.op !== c.ALT && n.op !== c.ALT_MATCH)) continue;
          let i = B.inst[t[e]];
          if (i.op === c.ALT || i.op === c.ALT_MATCH) continue;
          let a = "out", h = "arg", o = false;
          n.out === C ? o = true : n.arg === C && (o = true, a = "arg", h = "out"), o && (n[a] = t[e]), t[e] === n[a] && (t[s] = n[h]);
        }
        return B;
      };
      OC = (r) => {
        if (r.inst.length >= 1e3) return null;
        let B = new LB(r.inst.length), C = new LB(r.inst.length), t = new Array(r.inst.length), e = new Array(r.inst.length).fill(false), s = (n) => {
          let i = true, a = r.inst[n];
          if (C.contains(n)) return true;
          switch (C.insert(n), a.op) {
            case c.ALT:
            case c.ALT_MATCH: {
              i = s(a.out) && s(a.arg);
              let h = e[a.out], o = e[a.arg];
              if (h && o) return false;
              if (o) {
                let L = a.out;
                a.out = a.arg, a.arg = L;
                let A = h;
                h = o, o = A;
              }
              h && (e[n] = true, a.op = c.ALT_MATCH);
              let f = t[a.out] || [], p = t[a.arg] || [], O = fC(f, p, a.out, a.arg);
              if (!O) return false;
              t[n] = O.merged, a.next = new Uint32Array(O.next);
              break;
            }
            case c.CAPTURE:
            case c.EMPTY_WIDTH:
            case c.NOP:
              i = s(a.out), e[n] = e[a.out], t[n] = t[a.out] ? t[a.out].slice() : [], a.next = new Uint32Array(Math.floor(t[n].length / 2) + 1).fill(a.out);
              break;
            case c.MATCH:
            case c.FAIL:
              e[n] = a.op === c.MATCH;
              break;
            case c.RUNE: {
              if (e[n] = false, a.next && a.next.length > 0) break;
              if (B.insert(a.out), !a.runes || a.runes.length === 0) {
                t[n] = [], a.next = new Uint32Array([a.out]);
                break;
              }
              let h = [];
              if (a.runes.length === 1 && (a.arg & g.FOLD_CASE) !== 0) {
                let o = a.runes[0];
                h.push(o, o);
                for (let f = F.simpleFold(o); f !== o; f = F.simpleFold(f)) h.push(f, f);
                h.sort((f, p) => f - p);
              } else for (let o = 0; o < a.runes.length; o++) h.push(a.runes[o]);
              t[n] = h, a.next = new Uint32Array(Math.floor(h.length / 2) + 1).fill(a.out), a.op = c.RUNE;
              break;
            }
            case c.RUNE1: {
              if (e[n] = false, a.next && a.next.length > 0) break;
              B.insert(a.out);
              let h = [];
              if ((a.arg & g.FOLD_CASE) !== 0) {
                let o = a.runes[0];
                h.push(o, o);
                for (let f = F.simpleFold(o); f !== o; f = F.simpleFold(f)) h.push(f, f);
                h.sort((f, p) => f - p);
              } else h.push(a.runes[0], a.runes[0]);
              t[n] = h, a.next = new Uint32Array(Math.floor(h.length / 2) + 1).fill(a.out), a.op = c.RUNE;
              break;
            }
            case c.RUNE_ANY:
              if (e[n] = false, a.next && a.next.length > 0) break;
              B.insert(a.out), t[n] = [0, F.MAX_RUNE], a.next = new Uint32Array([a.out]);
              break;
            case c.RUNE_ANY_NOT_NL:
              if (e[n] = false, a.next && a.next.length > 0) break;
              B.insert(a.out), t[n] = [0, 9, 11, F.MAX_RUNE], a.next = new Uint32Array(Math.floor(t[n].length / 2) + 1).fill(a.out);
              break;
          }
          return i;
        };
        for (B.clear(), B.insert(r.start); !B.empty(); ) if (C.clear(), !s(B.next())) return null;
        for (let n = 0; n < r.inst.length; n++) t[n] && (r.inst[n].runes = t[n]);
        return r;
      };
      IC = (r, B) => {
        for (let C = 0; C < B.inst.length; C++) {
          let t = B.inst[C];
          switch (t.op) {
            case c.ALT:
            case c.ALT_MATCH:
            case c.RUNE:
              break;
            case c.CAPTURE:
            case c.EMPTY_WIDTH:
            case c.NOP:
            case c.MATCH:
            case c.FAIL:
              r.inst[C].next = null;
              break;
            case c.RUNE1:
            case c.RUNE_ANY:
            case c.RUNE_ANY_NOT_NL:
              r.inst[C].next = null, r.inst[C].op = t.op, r.inst[C].runes = t.runes ? t.runes.slice() : [];
              break;
          }
        }
      };
      HB = class BC {
        static compile(B) {
          if (B.start === 0 || B.numLb > 0) return null;
          let C = B.inst[B.start];
          if (C.op !== c.EMPTY_WIDTH || (C.arg & G.EMPTY_BEGIN_TEXT) === 0) return null;
          let t = false;
          for (let s = 0; s < B.inst.length; s++) if (B.inst[s].op === c.ALT || B.inst[s].op === c.ALT_MATCH) {
            t = true;
            break;
          }
          for (let s = 0; s < B.inst.length; s++) {
            let n = B.inst[s], i = B.inst[n.out].op;
            switch (n.op) {
              case c.ALT:
              case c.ALT_MATCH:
                if (i === c.MATCH || B.inst[n.arg].op === c.MATCH) return null;
                break;
              case c.EMPTY_WIDTH:
                if (i === c.MATCH) {
                  if ((n.arg & G.EMPTY_END_TEXT) === G.EMPTY_END_TEXT) continue;
                  return null;
                }
                break;
              default:
                if (i === c.MATCH && t) return null;
                break;
            }
          }
          let e = FC(B);
          return e = OC(e), e !== null && IC(e, B), e;
        }
        static next(B, C) {
          let t = B.matchRunePos(C);
          return t >= 0 ? B.next[t] : B.op === c.ALT_MATCH ? B.out : 0;
        }
        static execute(B, C, t, e, s) {
          let n = B.onepass;
          if (!n) return null;
          let i = new Int32Array(s).fill(-1), a = false, h = C.step(t), o = h >> 3, f = h & 7, p = P.EOF(), O = -1, L = 0;
          h !== P.EOF() && (p = C.step(t + f), p !== P.EOF() && (O = p >> 3, L = p & 7));
          let A = t === 0 ? G.emptyOpContext(-1, o) : C.context(t), d = n.start, T;
          for (; ; ) {
            switch (T = n.inst[d], d = T.out, T.op) {
              case c.MATCH:
                return e === g.ANCHOR_BOTH && t !== C.endPos() ? null : (a = true, i.length > 0 && (i[0] = 0, i[1] = t), s === 0 ? [] : G.toArray(i));
              case c.RUNE:
                if (!T.matchRune(o)) return null;
                break;
              case c.RUNE1:
                if (o !== T.runes[0]) return null;
                break;
              case c.RUNE_ANY:
                break;
              case c.RUNE_ANY_NOT_NL:
                if (o === 10) return null;
                break;
              case c.ALT:
              case c.ALT_MATCH:
                d = BC.next(T, o);
                continue;
              case c.FAIL:
                return null;
              case c.NOP:
                continue;
              case c.EMPTY_WIDTH:
                if ((T.arg & ~A) !== 0) return null;
                continue;
              case c.CAPTURE:
                T.arg < i.length && (i[T.arg] = t);
                continue;
              default:
                throw new CB("bad inst");
            }
            if (f === 0) break;
            A = G.emptyOpContext(o, O), t += f, o = O, f = L, o !== -1 && (p = C.step(t + f), p !== P.EOF() ? (O = p >> 3, L = p & 7) : (O = -1, L = 0));
          }
          return a ? s === 0 ? [] : G.toArray(i) : null;
        }
      };
      u = class H {
        static Op = VB(["NO_MATCH", "EMPTY_MATCH", "LITERAL", "CHAR_CLASS", "ANY_CHAR_NOT_NL", "ANY_CHAR", "BEGIN_LINE", "END_LINE", "BEGIN_TEXT", "END_TEXT", "WORD_BOUNDARY", "NO_WORD_BOUNDARY", "CAPTURE", "STAR", "PLUS", "QUEST", "REPEAT", "CONCAT", "ALTERNATE", "PLB", "NLB", "LEFT_PAREN", "VERTICAL_BAR"]);
        static isPseudoOp(B) {
          return B >= H.Op.LEFT_PAREN;
        }
        static emptySubs() {
          return [];
        }
        static quoteIfHyphen(B) {
          return B === E.CODES.get("-") ? "\\" : "";
        }
        static fromRegexp(B) {
          let C = new H(B.op);
          return C.flags = B.flags, C.subs = B.subs, C.runes = B.runes, C.cap = B.cap, C.min = B.min, C.max = B.max, C.name = B.name, C.namedGroups = B.namedGroups, C.lb = B.lb, C;
        }
        constructor(B) {
          this.op = B, this.flags = 0, this.subs = H.emptySubs(), this.runes = [], this.min = 0, this.max = 0, this.cap = 0, this.name = null, this.namedGroups = /* @__PURE__ */ Object.create(null), this.lb = 0;
        }
        reinit() {
          this.flags = 0, this.subs = H.emptySubs(), this.runes = [], this.cap = 0, this.min = 0, this.max = 0, this.name = null, this.namedGroups = /* @__PURE__ */ Object.create(null), this.lb = 0;
        }
        toString() {
          return this.appendTo();
        }
        appendTo() {
          let B = "";
          switch (this.op) {
            case H.Op.NO_MATCH:
              B += "[^\\x00-\\x{10FFFF}]";
              break;
            case H.Op.EMPTY_MATCH:
              B += "(?:)";
              break;
            case H.Op.STAR:
            case H.Op.PLUS:
            case H.Op.QUEST:
            case H.Op.REPEAT: {
              let C = this.subs[0];
              switch (C.op > H.Op.CAPTURE || C.op === H.Op.LITERAL && C.runes.length > 1 ? B += `(?:${C.appendTo()})` : B += C.appendTo(), this.op) {
                case H.Op.STAR:
                  B += "*";
                  break;
                case H.Op.PLUS:
                  B += "+";
                  break;
                case H.Op.QUEST:
                  B += "?";
                  break;
                case H.Op.REPEAT:
                  B += `{${this.min}`, this.min !== this.max && (B += ",", this.max >= 0 && (B += this.max)), B += "}";
                  break;
              }
              (this.flags & g.NON_GREEDY) !== 0 && (B += "?");
              break;
            }
            case H.Op.CONCAT:
              for (let C of this.subs) C.op === H.Op.ALTERNATE ? B += `(?:${C.appendTo()})` : B += C.appendTo();
              break;
            case H.Op.ALTERNATE: {
              let C = "";
              for (let t of this.subs) B += C, C = "|", B += t.appendTo();
              break;
            }
            case H.Op.LITERAL:
              (this.flags & g.FOLD_CASE) !== 0 && (B += "(?i:");
              for (let C of this.runes) B += G.escapeRune(C);
              (this.flags & g.FOLD_CASE) !== 0 && (B += ")");
              break;
            case H.Op.ANY_CHAR_NOT_NL:
              B += "(?-s:.)";
              break;
            case H.Op.ANY_CHAR:
              B += "(?s:.)";
              break;
            case H.Op.PLB:
              B += `(?<=${this.subs[0].appendTo()})`;
              break;
            case H.Op.NLB:
              B += `(?<!${this.subs[0].appendTo()})`;
              break;
            case H.Op.CAPTURE:
              this.name === null || this.name.length === 0 ? B += "(" : B += `(?P<${this.name}>`, this.subs[0].op !== H.Op.EMPTY_MATCH && (B += this.subs[0].appendTo()), B += ")";
              break;
            case H.Op.BEGIN_TEXT:
              B += "\\A";
              break;
            case H.Op.END_TEXT:
              (this.flags & g.WAS_DOLLAR) !== 0 ? B += "(?-m:$)" : B += "\\z";
              break;
            case H.Op.BEGIN_LINE:
              B += "^";
              break;
            case H.Op.END_LINE:
              B += "$";
              break;
            case H.Op.WORD_BOUNDARY:
              B += "\\b";
              break;
            case H.Op.NO_WORD_BOUNDARY:
              B += "\\B";
              break;
            case H.Op.CHAR_CLASS:
              if (this.runes.length % 2 !== 0) {
                B += "[invalid char class]";
                break;
              }
              if (B += "[", this.runes.length === 0) B += "^\\x00-\\x{10FFFF}";
              else if (this.runes[0] === 0 && this.runes[this.runes.length - 1] === F.MAX_RUNE) {
                B += "^";
                for (let C = 1; C < this.runes.length - 1; C += 2) {
                  let t = this.runes[C] + 1, e = this.runes[C + 1] - 1;
                  B += H.quoteIfHyphen(t), B += G.escapeRune(t), t !== e && (B += "-", B += H.quoteIfHyphen(e), B += G.escapeRune(e));
                }
              } else for (let C = 0; C < this.runes.length; C += 2) {
                let t = this.runes[C], e = this.runes[C + 1];
                B += H.quoteIfHyphen(t), B += G.escapeRune(t), t !== e && (B += "-", B += H.quoteIfHyphen(e), B += G.escapeRune(e));
              }
              B += "]";
              break;
            default:
              B += this.op;
              break;
          }
          return B;
        }
        maxCap() {
          let B = 0;
          if (this.op === H.Op.CAPTURE && (B = this.cap), this.subs !== null) for (let C of this.subs) {
            let t = C.maxCap();
            B < t && (B = t);
          }
          return B;
        }
        equals(B) {
          if (!(B !== null && B instanceof H) || this.op !== B.op) return false;
          switch (this.op) {
            case H.Op.END_TEXT:
              if ((this.flags & g.WAS_DOLLAR) !== (B.flags & g.WAS_DOLLAR)) return false;
              break;
            case H.Op.LITERAL:
            case H.Op.CHAR_CLASS:
              if (this.runes === null && B.runes === null) break;
              if (this.runes === null || B.runes === null || this.runes.length !== B.runes.length) return false;
              for (let C = 0; C < this.runes.length; C++) if (this.runes[C] !== B.runes[C]) return false;
              break;
            case H.Op.ALTERNATE:
            case H.Op.CONCAT:
              if (this.subs.length !== B.subs.length) return false;
              for (let C = 0; C < this.subs.length; ++C) if (!this.subs[C].equals(B.subs[C])) return false;
              break;
            case H.Op.STAR:
            case H.Op.PLUS:
            case H.Op.QUEST:
              if ((this.flags & g.NON_GREEDY) !== (B.flags & g.NON_GREEDY) || !this.subs[0].equals(B.subs[0])) return false;
              break;
            case H.Op.REPEAT:
              if ((this.flags & g.NON_GREEDY) !== (B.flags & g.NON_GREEDY) || this.min !== B.min || this.max !== B.max || !this.subs[0].equals(B.subs[0])) return false;
              break;
            case H.Op.CAPTURE:
              if (this.cap !== B.cap || (this.name === null ? B.name !== null : this.name !== B.name) || !this.subs[0].equals(B.subs[0])) return false;
              break;
            case H.Op.PLB:
            case H.Op.NLB:
              if (this.lb !== B.lb || !this.subs[0].equals(B.subs[0])) return false;
              break;
          }
          return true;
        }
      };
      AB = class {
        constructor(r) {
          this.next = [/* @__PURE__ */ Object.create(null)], this.fail = [0], this.match = [false];
          for (let C of r) {
            let t = 0;
            for (let e = 0; e < C.length; e++) {
              let s = C[e];
              s in this.next[t] || (this.next.push(/* @__PURE__ */ Object.create(null)), this.fail.push(0), this.match.push(false), this.next[t][s] = this.next.length - 1), t = this.next[t][s];
            }
            this.match[t] = true;
          }
          let B = [];
          for (let C in this.next[0]) if (Object.prototype.hasOwnProperty.call(this.next[0], C)) {
            let t = this.next[0][C];
            this.fail[t] = 0, B.push(t);
          }
          for (; B.length > 0; ) {
            let C = B.shift();
            for (let t in this.next[C]) if (Object.prototype.hasOwnProperty.call(this.next[C], t)) {
              let e = this.next[C][t], s = this.fail[C];
              for (; s !== 0 && !(t in this.next[s]); ) s = this.fail[s];
              t in this.next[s] ? this.fail[e] = this.next[s][t] : this.fail[e] = 0, this.match[e] = this.match[e] || this.match[this.fail[e]], B.push(e);
            }
          }
        }
        searchUTF16(r, B, C) {
          let t = 0;
          for (let e = B; e < C; e++) {
            let s = r.charCodeAt(e);
            for (; t !== 0 && !(s in this.next[t]); ) t = this.fail[t];
            if (s in this.next[t] && (t = this.next[t][s]), this.match[t]) return true;
          }
          return false;
        }
        searchUTF8(r, B, C) {
          let t = 0;
          for (let e = B; e < C; e++) {
            let s = r[e];
            for (; t !== 0 && !(s in this.next[t]); ) t = this.fail[t];
            if (s in this.next[t] && (t = this.next[t][s]), this.match[t]) return true;
          }
          return false;
        }
      };
      w = class BB {
        static Type = { NONE: 0, EXACT: 1, AND: 2, OR: 3 };
        constructor(B) {
          this.type = B, this.subs = [], this.str = "", this.bytes = null, this.ac16 = null, this.ac8 = null;
        }
        eval(B, C) {
          switch (this.type) {
            case BB.Type.NONE:
              return true;
            case BB.Type.EXACT:
              return B.hasString(this, C);
            case BB.Type.AND:
              for (let t = 0; t < this.subs.length; t++) if (!this.subs[t].eval(B, C)) return false;
              return true;
            case BB.Type.OR:
              if (this.ac16 && this.ac8) return B.hasAnyString(this, C);
              for (let t = 0; t < this.subs.length; t++) if (this.subs[t].eval(B, C)) return true;
              return false;
            default:
              return true;
          }
        }
      };
      GC = class K {
        static build(B) {
          let C = K.fromRegexp(B);
          return K.simplify(C);
        }
        static fromRegexp(B) {
          if (!B) return new w(w.Type.NONE);
          switch (B.op) {
            case u.Op.PLB:
            case u.Op.NLB:
            case u.Op.NO_MATCH:
            case u.Op.EMPTY_MATCH:
            case u.Op.BEGIN_LINE:
            case u.Op.END_LINE:
            case u.Op.BEGIN_TEXT:
            case u.Op.END_TEXT:
            case u.Op.WORD_BOUNDARY:
            case u.Op.NO_WORD_BOUNDARY:
            case u.Op.CHAR_CLASS:
            case u.Op.ANY_CHAR_NOT_NL:
            case u.Op.ANY_CHAR:
              return new w(w.Type.NONE);
            case u.Op.LITERAL: {
              if (B.runes.length === 0 || (B.flags & g.FOLD_CASE) !== 0) return new w(w.Type.NONE);
              let C = new w(w.Type.EXACT), t = "";
              for (let e = 0; e < B.runes.length; e++) t += String.fromCodePoint(B.runes[e]);
              return C.str = t, C.bytes = G.stringToUtf8ByteArray(C.str), C;
            }
            case u.Op.CAPTURE:
            case u.Op.PLUS:
              return K.fromRegexp(B.subs[0]);
            case u.Op.REPEAT:
              return B.min >= 1 ? K.fromRegexp(B.subs[0]) : new w(w.Type.NONE);
            case u.Op.CONCAT: {
              let C = new w(w.Type.AND);
              for (let t of B.subs) C.subs.push(K.fromRegexp(t));
              return C;
            }
            case u.Op.ALTERNATE: {
              let C = new w(w.Type.OR);
              for (let t of B.subs) C.subs.push(K.fromRegexp(t));
              return C;
            }
            default:
              return new w(w.Type.NONE);
          }
        }
        static simplify(B) {
          if (B.type === w.Type.EXACT || B.type === w.Type.NONE) return B;
          if (B.type === w.Type.AND) {
            let C = [];
            for (let t of B.subs) {
              let e = K.simplify(t);
              if (e.type !== w.Type.NONE) if (e.type === w.Type.AND) for (let s = 0; s < e.subs.length; s++) C.push(e.subs[s]);
              else C.push(e);
            }
            return C.length === 0 ? new w(w.Type.NONE) : C.length === 1 ? C[0] : (B.subs = C, B);
          }
          if (B.type === w.Type.OR) {
            let C = [];
            for (let n of B.subs) {
              let i = K.simplify(n);
              if (i.type === w.Type.NONE) return new w(w.Type.NONE);
              if (i.type === w.Type.OR) for (let a = 0; a < i.subs.length; a++) C.push(i.subs[a]);
              else C.push(i);
            }
            if (C.length === 0) return new w(w.Type.NONE);
            if (C.length === 1) return C[0];
            let t = /* @__PURE__ */ new Set(), e = [];
            for (let n of C) n.type === w.Type.EXACT ? t.has(n.str) || (t.add(n.str), e.push(n)) : e.push(n);
            B.subs = e;
            let s = true;
            for (let n of e) if (n.type !== w.Type.EXACT) {
              s = false;
              break;
            }
            return s && e.length > 1 && (B.ac16 = new AB(e.map((n) => {
              let i = [];
              for (let a = 0; a < n.str.length; a++) i.push(n.str.charCodeAt(a));
              return i;
            })), B.ac8 = new AB(e.map((n) => n.bytes))), B;
          }
          return B;
        }
      };
      U = class {
        constructor(r = 0, B = 0) {
          this.head = r, this.tail = B;
        }
      };
      LC = class {
        constructor() {
          this.inst = [], this.start = 0, this.numCap = 2, this.lbStarts = [], this.numLb = 0;
        }
        getInst(r) {
          return this.inst[r];
        }
        numInst() {
          return this.inst.length;
        }
        addInst(r) {
          this.inst.push(new c(r));
        }
        skipNop(r) {
          let B = this.inst[r];
          for (; B.op === c.NOP || B.op === c.CAPTURE; ) B = this.inst[r], r = B.out;
          return B;
        }
        prefix() {
          let r = "", B = this.skipNop(this.start);
          if (!c.isRuneOp(B.op) || B.runes.length !== 1) return [B.op === c.MATCH, r];
          for (; c.isRuneOp(B.op) && B.runes.length === 1 && (B.arg & g.FOLD_CASE) === 0; ) r += String.fromCodePoint(B.runes[0]), B = this.skipNop(B.out);
          return [B.op === c.MATCH, r];
        }
        startCond() {
          let r = 0, B = this.start;
          B: for (; ; ) {
            let C = this.inst[B];
            switch (C.op) {
              case c.EMPTY_WIDTH:
                r |= C.arg;
                break;
              case c.FAIL:
                return -1;
              case c.CAPTURE:
              case c.NOP:
                break;
              default:
                break B;
            }
            B = C.out;
          }
          return r;
        }
        patch(r, B) {
          let C = r.head;
          for (; C !== 0; ) {
            let t = this.inst[C >> 1];
            (C & 1) === 0 ? (C = t.out, t.out = B) : (C = t.arg, t.arg = B);
          }
        }
        append(r, B) {
          if (r.head === 0) return B;
          if (B.head === 0) return r;
          let C = this.inst[r.tail >> 1];
          return (r.tail & 1) === 0 ? C.out = B.head : C.arg = B.head, new U(r.head, B.tail);
        }
        toString() {
          let r = "";
          for (let B = 0; B < this.inst.length; B++) {
            let C = r.length;
            r += B, B === this.start && (r += "*"), r += "        ".substring(r.length - C), r += this.inst[B], r += `
`;
          }
          return r;
        }
      };
      aB = class {
        constructor(r = 0, B = new U(), C = false) {
          this.i = r, this.out = B, this.nullable = C;
        }
      };
      CC = class X {
        static ANY_RUNE_NOT_NL() {
          return [0, E.CODES.get(`
`) - 1, E.CODES.get(`
`) + 1, F.MAX_RUNE];
        }
        static ANY_RUNE() {
          return [0, F.MAX_RUNE];
        }
        static compileRegexp(B) {
          let C = new X(), t = C.compile(B);
          return C.prog.patch(t.out, C.newInst(c.MATCH).i), C.prog.start = t.i, C.prog;
        }
        static compileSet(B) {
          let C = new X();
          if (B.length === 0) return C.prog.start = C.newInst(c.FAIL).i, C.prog;
          let t = [];
          for (let s = 0; s < B.length; s++) {
            let n = C.compile(B[s]), i = C.newInst(c.MATCH);
            C.prog.getInst(i.i).arg = s, C.prog.patch(n.out, i.i), t.push(n.i);
          }
          let e = t[0];
          for (let s = 1; s < t.length; s++) {
            let n = C.newInst(c.ALT), i = C.prog.getInst(n.i);
            i.out = e, i.arg = t[s], e = n.i;
          }
          return C.prog.start = e, C.prog;
        }
        constructor() {
          this.prog = new LC(), this.newInst(c.FAIL);
        }
        newInst(B) {
          return this.prog.addInst(B), new aB(this.prog.numInst() - 1, new U(), true);
        }
        nop() {
          let B = this.newInst(c.NOP);
          return B.out = new U(B.i << 1, B.i << 1), B;
        }
        fail() {
          return new aB();
        }
        cap(B) {
          let C = this.newInst(c.CAPTURE);
          return C.out = new U(C.i << 1, C.i << 1), this.prog.getInst(C.i).arg = B, this.prog.numCap < B + 1 && (this.prog.numCap = B + 1), C;
        }
        cat(B, C) {
          return B.i === 0 || C.i === 0 ? this.fail() : (this.prog.patch(B.out, C.i), new aB(B.i, C.out, B.nullable && C.nullable));
        }
        alt(B, C) {
          if (B.i === 0) return C;
          if (C.i === 0) return B;
          let t = this.newInst(c.ALT), e = this.prog.getInst(t.i);
          return e.out = B.i, e.arg = C.i, t.out = this.prog.append(B.out, C.out), t.nullable = B.nullable || C.nullable, t;
        }
        loop(B, C) {
          let t = this.newInst(c.ALT), e = this.prog.getInst(t.i);
          return C ? (e.arg = B.i, t.out = new U(t.i << 1, t.i << 1)) : (e.out = B.i, t.out = new U(t.i << 1 | 1, t.i << 1 | 1)), this.prog.patch(B.out, t.i), t;
        }
        quest(B, C) {
          let t = this.newInst(c.ALT), e = this.prog.getInst(t.i);
          return C ? (e.arg = B.i, t.out = new U(t.i << 1, t.i << 1)) : (e.out = B.i, t.out = new U(t.i << 1 | 1, t.i << 1 | 1)), t.out = this.prog.append(t.out, B.out), t;
        }
        star(B, C) {
          return B.nullable ? this.quest(this.plus(B, C), C) : this.loop(B, C);
        }
        plus(B, C) {
          return new aB(B.i, this.loop(B, C).out, B.nullable);
        }
        empty(B) {
          let C = this.newInst(c.EMPTY_WIDTH);
          return this.prog.getInst(C.i).arg = B, C.out = new U(C.i << 1, C.i << 1), C;
        }
        rune(B, C) {
          let t = this.newInst(c.RUNE);
          t.nullable = false;
          let e = this.prog.getInst(t.i);
          return e.runes = B, C &= g.FOLD_CASE, (B.length !== 1 || F.simpleFold(B[0]) === B[0]) && (C &= ~g.FOLD_CASE), e.arg = C, t.out = new U(t.i << 1, t.i << 1), (C & g.FOLD_CASE) === 0 && B.length === 1 || B.length === 2 && B[0] === B[1] ? e.op = c.RUNE1 : B.length === 2 && B[0] === 0 && B[1] === F.MAX_RUNE ? e.op = c.RUNE_ANY : B.length === 4 && B[0] === 0 && B[1] === E.CODES.get(`
`) - 1 && B[2] === E.CODES.get(`
`) + 1 && B[3] === F.MAX_RUNE && (e.op = c.RUNE_ANY_NOT_NL), t;
        }
        lookBehind(B, C) {
          let t = this.newInst(c.LB_WRITE);
          this.prog.getInst(t.i).arg = C;
          let e = this.rune(X.ANY_RUNE(), 0), s = this.star(e, true), n = this.cat(s, B);
          this.prog.patch(n.out, t.i);
          let i = this.newInst(c.LB_CHECK);
          return this.prog.getInst(i.i).arg = C, this.prog.lbStarts.push(n.i), Math.abs(C) > this.prog.numLb && (this.prog.numLb = Math.abs(C)), i.out = new U(i.i << 1, i.i << 1), i;
        }
        compile(B) {
          switch (B.op) {
            case u.Op.NO_MATCH:
              return this.fail();
            case u.Op.EMPTY_MATCH:
              return this.nop();
            case u.Op.LITERAL:
              if (B.runes.length === 0) return this.nop();
              {
                let C = null;
                for (let t of B.runes) {
                  let e = this.rune([t], B.flags);
                  C = C === null ? e : this.cat(C, e);
                }
                return C;
              }
            case u.Op.CHAR_CLASS:
              return this.rune(B.runes, B.flags);
            case u.Op.ANY_CHAR_NOT_NL:
              return this.rune(X.ANY_RUNE_NOT_NL(), 0);
            case u.Op.ANY_CHAR:
              return this.rune(X.ANY_RUNE(), 0);
            case u.Op.BEGIN_LINE:
              return this.empty(G.EMPTY_BEGIN_LINE);
            case u.Op.END_LINE:
              return this.empty(G.EMPTY_END_LINE);
            case u.Op.BEGIN_TEXT:
              return this.empty(G.EMPTY_BEGIN_TEXT);
            case u.Op.END_TEXT:
              return this.empty(G.EMPTY_END_TEXT);
            case u.Op.WORD_BOUNDARY:
              return this.empty(G.EMPTY_WORD_BOUNDARY);
            case u.Op.NO_WORD_BOUNDARY:
              return this.empty(G.EMPTY_NO_WORD_BOUNDARY);
            case u.Op.PLB:
            case u.Op.NLB:
              return this.lookBehind(this.compile(B.subs[0]), B.lb);
            case u.Op.CAPTURE: {
              let C = this.cap(B.cap << 1), t = this.compile(B.subs[0]), e = this.cap(B.cap << 1 | 1);
              return this.cat(this.cat(C, t), e);
            }
            case u.Op.STAR:
              return this.star(this.compile(B.subs[0]), (B.flags & g.NON_GREEDY) !== 0);
            case u.Op.PLUS:
              return this.plus(this.compile(B.subs[0]), (B.flags & g.NON_GREEDY) !== 0);
            case u.Op.QUEST:
              return this.quest(this.compile(B.subs[0]), (B.flags & g.NON_GREEDY) !== 0);
            case u.Op.CONCAT:
              if (B.subs.length === 0) return this.nop();
              {
                let C = null;
                for (let t of B.subs) {
                  let e = this.compile(t);
                  C = C === null ? e : this.cat(C, e);
                }
                return C;
              }
            case u.Op.ALTERNATE:
              if (B.subs.length === 0) return this.nop();
              {
                let C = null;
                for (let t of B.subs) {
                  let e = this.compile(t);
                  C = C === null ? e : this.alt(C, e);
                }
                return C;
              }
            default:
              throw new zB("regexp: unhandled case in compile");
          }
        }
      };
      tC = class k {
        static simplify(B) {
          if (B === null) return null;
          switch (B.op) {
            case u.Op.PLB:
            case u.Op.NLB:
            case u.Op.CAPTURE: {
              let C = k.simplify(B.subs[0]);
              if (C !== B.subs[0]) {
                let t = u.fromRegexp(B);
                return t.runes = [], t.subs = [C], t;
              }
              return B;
            }
            case u.Op.CONCAT:
            case u.Op.ALTERNATE: {
              let C = [], t = false;
              for (let e = 0; e < B.subs.length; e++) {
                let s = B.subs[e], n = k.simplify(s);
                if (n !== s && (t = true), B.op === u.Op.CONCAT) {
                  if (n.op === u.Op.NO_MATCH) return new u(u.Op.NO_MATCH);
                  if (n.op === u.Op.EMPTY_MATCH) {
                    t = true;
                    continue;
                  }
                  if (n.op === u.Op.CONCAT) {
                    t = true;
                    for (let i = 0; i < n.subs.length; i++) C.push(n.subs[i]);
                    continue;
                  }
                } else if (B.op === u.Op.ALTERNATE) {
                  if (n.op === u.Op.NO_MATCH) {
                    t = true;
                    continue;
                  }
                  if (n.op === u.Op.ALTERNATE) {
                    t = true;
                    for (let i = 0; i < n.subs.length; i++) C.push(n.subs[i]);
                    continue;
                  }
                }
                C.push(n);
              }
              if (t) {
                if (C.length === 0) return new u(B.op === u.Op.CONCAT ? u.Op.EMPTY_MATCH : u.Op.NO_MATCH);
                if (C.length === 1) return C[0];
                let e = u.fromRegexp(B);
                return e.runes = [], e.subs = C, e;
              }
              return B;
            }
            case u.Op.CHAR_CLASS:
              return B.runes === null ? B : B.runes.length === 0 ? new u(u.Op.NO_MATCH) : B.runes.length === 2 && B.runes[0] === 0 && B.runes[1] === F.MAX_RUNE ? new u(u.Op.ANY_CHAR) : B.runes.length === 4 && B.runes[0] === 0 && B.runes[1] === E.CODES.get(`
`) - 1 && B.runes[2] === E.CODES.get(`
`) + 1 && B.runes[3] === F.MAX_RUNE ? new u(u.Op.ANY_CHAR_NOT_NL) : B;
            case u.Op.STAR:
            case u.Op.PLUS:
            case u.Op.QUEST: {
              let C = k.simplify(B.subs[0]);
              return k.simplify1(B.op, B.flags, C, B);
            }
            case u.Op.REPEAT: {
              if (B.min === 0 && B.max === 0) return new u(u.Op.EMPTY_MATCH);
              let C = k.simplify(B.subs[0]);
              if (B.max === -1) {
                if (B.min === 0) return k.simplify1(u.Op.STAR, B.flags, C, null);
                if (B.min === 1) return k.simplify1(u.Op.PLUS, B.flags, C, null);
                let e = new u(u.Op.CONCAT), s = [];
                for (let n = 0; n < B.min - 1; n++) s.push(C);
                return s.push(k.simplify1(u.Op.PLUS, B.flags, C, null)), e.subs = s.slice(0), k.simplify(e);
              }
              if (B.min === 1 && B.max === 1) return C;
              let t = null;
              if (B.min > 0) {
                t = [];
                for (let e = 0; e < B.min; e++) t.push(C);
              }
              if (B.max > B.min) {
                let e = k.simplify1(u.Op.QUEST, B.flags, C, null);
                for (let s = B.min + 1; s < B.max; s++) {
                  let n = new u(u.Op.CONCAT);
                  n.subs = [C, e], e = k.simplify1(u.Op.QUEST, B.flags, n, null);
                }
                if (t === null) return e;
                t.push(e);
              }
              if (t !== null) {
                let e = new u(u.Op.CONCAT);
                return e.subs = t.slice(0), k.simplify(e);
              }
              return new u(u.Op.NO_MATCH);
            }
          }
          return B;
        }
        static simplify1(B, C, t, e) {
          if (t.op === u.Op.EMPTY_MATCH) return t;
          if (t.op === u.Op.NO_MATCH) return B === u.Op.PLUS ? t : new u(u.Op.EMPTY_MATCH);
          if (B === t.op && (C & g.NON_GREEDY) === (t.flags & g.NON_GREEDY)) return t;
          if (e !== null && e.op === B && (e.flags & g.NON_GREEDY) === (C & g.NON_GREEDY) && t === e.subs[0]) return e;
          let s = new u(B);
          return s.flags = C, s.subs = [t], s;
        }
      };
      N = class {
        constructor(r, B) {
          this.sign = r, this.cls = B;
        }
      };
      NB = [48, 57];
      wB = [9, 10, 12, 13, 32, 32];
      mB = [48, 57, 65, 90, 95, 95, 97, 122];
      TB = /* @__PURE__ */ new Map([["\\d", new N(1, NB)], ["\\D", new N(-1, NB)], ["\\s", new N(1, wB)], ["\\S", new N(-1, wB)], ["\\w", new N(1, mB)], ["\\W", new N(-1, mB)]]);
      RB = [48, 57, 65, 90, 97, 122];
      dB = [65, 90, 97, 122];
      SB = [0, 127];
      bB = [9, 9, 32, 32];
      PB = [0, 31, 127, 127];
      MB = [48, 57];
      JB = [33, 126];
      xB = [97, 122];
      kB = [32, 126];
      _B = [33, 47, 58, 64, 91, 96, 123, 126];
      UB = [9, 13, 32, 32];
      yB = [65, 90];
      KB = [48, 57, 65, 90, 95, 95, 97, 122];
      vB = [48, 57, 65, 70, 97, 102];
      QB = /* @__PURE__ */ new Map([["[:alnum:]", new N(1, RB)], ["[:^alnum:]", new N(-1, RB)], ["[:alpha:]", new N(1, dB)], ["[:^alpha:]", new N(-1, dB)], ["[:ascii:]", new N(1, SB)], ["[:^ascii:]", new N(-1, SB)], ["[:blank:]", new N(1, bB)], ["[:^blank:]", new N(-1, bB)], ["[:cntrl:]", new N(1, PB)], ["[:^cntrl:]", new N(-1, PB)], ["[:digit:]", new N(1, MB)], ["[:^digit:]", new N(-1, MB)], ["[:graph:]", new N(1, JB)], ["[:^graph:]", new N(-1, JB)], ["[:lower:]", new N(1, xB)], ["[:^lower:]", new N(-1, xB)], ["[:print:]", new N(1, kB)], ["[:^print:]", new N(-1, kB)], ["[:punct:]", new N(1, _B)], ["[:^punct:]", new N(-1, _B)], ["[:space:]", new N(1, UB)], ["[:^space:]", new N(-1, UB)], ["[:upper:]", new N(1, yB)], ["[:^upper:]", new N(-1, yB)], ["[:word:]", new N(1, KB)], ["[:^word:]", new N(-1, KB)], ["[:xdigit:]", new N(1, vB)], ["[:^xdigit:]", new N(-1, vB)]]);
      Q = class j {
        static charClassToString(B, C) {
          let t = "[";
          for (let e = 0; e < C; e += 2) {
            e > 0 && (t += " ");
            let s = B[e], n = B[e + 1];
            s === n ? t += `0x${s.toString(16)}` : t += `0x${s.toString(16)}-0x${n.toString(16)}`;
          }
          return t += "]", t;
        }
        static cmp(B, C, t, e) {
          let s = B[C] - t;
          return s !== 0 ? s : e - B[C + 1];
        }
        static qsortIntPair(B, C, t) {
          let e = ((C + t) / 2 | 0) & -2, s = B[e], n = B[e + 1], i = C, a = t;
          for (; i <= a; ) {
            for (; i < t && j.cmp(B, i, s, n) < 0; ) i += 2;
            for (; a > C && j.cmp(B, a, s, n) > 0; ) a -= 2;
            if (i <= a) {
              if (i !== a) {
                let h = B[i];
                B[i] = B[a], B[a] = h, h = B[i + 1], B[i + 1] = B[a + 1], B[a + 1] = h;
              }
              i += 2, a -= 2;
            }
          }
          C < a && j.qsortIntPair(B, C, a), i < t && j.qsortIntPair(B, i, t);
        }
        constructor(B = G.emptyInts()) {
          this.r = B, this.len = B.length;
        }
        toArray() {
          return this.len === this.r.length ? this.r : this.r.slice(0, this.len);
        }
        cleanClass() {
          if (this.len < 4) return this;
          j.qsortIntPair(this.r, 0, this.len - 2);
          let B = 2;
          for (let C = 2; C < this.len; C += 2) {
            let t = this.r[C], e = this.r[C + 1];
            if (t <= this.r[B - 1] + 1) {
              e > this.r[B - 1] && (this.r[B - 1] = e);
              continue;
            }
            this.r[B] = t, this.r[B + 1] = e, B += 2;
          }
          return this.len = B, this;
        }
        appendLiteral(B, C) {
          return (C & g.FOLD_CASE) !== 0 ? this.appendFoldedRange(B, B) : this.appendRange(B, B);
        }
        appendRange(B, C) {
          if (this.len > 0) {
            for (let t = 2; t <= 4; t += 2) if (this.len >= t) {
              let e = this.r[this.len - t], s = this.r[this.len - t + 1];
              if (B <= s + 1 && e <= C + 1) return B < e && (this.r[this.len - t] = B), C > s && (this.r[this.len - t + 1] = C), this;
            }
          }
          return this.r[this.len++] = B, this.r[this.len++] = C, this;
        }
        appendFoldedRange(B, C) {
          if (B <= F.MIN_FOLD && C >= F.MAX_FOLD) return this.appendRange(B, C);
          if (C < F.MIN_FOLD || B > F.MAX_FOLD) return this.appendRange(B, C);
          B < F.MIN_FOLD && (this.appendRange(B, F.MIN_FOLD - 1), B = F.MIN_FOLD), C > F.MAX_FOLD && (this.appendRange(F.MAX_FOLD + 1, C), C = F.MAX_FOLD);
          for (let t = B; t <= C; t++) {
            this.appendRange(t, t);
            for (let e = F.simpleFold(t); e !== t; e = F.simpleFold(e)) this.appendRange(e, e);
          }
          return this;
        }
        appendClass(B) {
          for (let C = 0; C < B.length; C += 2) this.appendRange(B[C], B[C + 1]);
          return this;
        }
        appendFoldedClass(B) {
          for (let C = 0; C < B.length; C += 2) this.appendFoldedRange(B[C], B[C + 1]);
          return this;
        }
        appendNegatedClass(B) {
          let C = 0;
          for (let t = 0; t < B.length; t += 2) {
            let e = B[t], s = B[t + 1];
            C <= e - 1 && this.appendRange(C, e - 1), C = s + 1;
          }
          return C <= F.MAX_RUNE && this.appendRange(C, F.MAX_RUNE), this;
        }
        appendTable(B) {
          for (let C = 0; C < B.length; ++C) {
            let t = B.getLo(C), e = B.getHi(C), s = B.getStride(C);
            if (s === 1) {
              this.appendRange(t, e);
              continue;
            }
            for (let n = t; n <= e; n += s) this.appendRange(n, n);
          }
          return this;
        }
        appendNegatedTable(B) {
          let C = 0;
          for (let t = 0; t < B.length; ++t) {
            let e = B.getLo(t), s = B.getHi(t), n = B.getStride(t);
            if (n === 1) {
              C <= e - 1 && this.appendRange(C, e - 1), C = s + 1;
              continue;
            }
            for (let i = e; i <= s; i += n) C <= i - 1 && this.appendRange(C, i - 1), C = i + 1;
          }
          return C <= F.MAX_RUNE && this.appendRange(C, F.MAX_RUNE), this;
        }
        appendTableWithSign(B, C) {
          return C < 0 ? this.appendNegatedTable(B) : this.appendTable(B);
        }
        negateClass() {
          let B = 0, C = 0;
          for (let t = 0; t < this.len; t += 2) {
            let e = this.r[t], s = this.r[t + 1];
            B <= e - 1 && (this.r[C] = B, this.r[C + 1] = e - 1, C += 2), B = s + 1;
          }
          return this.len = C, B <= F.MAX_RUNE && (this.r[this.len++] = B, this.r[this.len++] = F.MAX_RUNE), this;
        }
        appendClassWithSign(B, C) {
          return C < 0 ? this.appendNegatedClass(B) : this.appendClass(B);
        }
        appendGroup(B, C) {
          let t = B.cls;
          return C && (t = new j().appendFoldedClass(t).cleanClass().toArray()), this.appendClassWithSign(t, B.sign);
        }
        toString() {
          return j.charClassToString(this.r, this.len);
        }
      };
      HC = class {
        constructor(r) {
          this.str = r, this.position = 0;
        }
        pos() {
          return this.position;
        }
        rewindTo(r) {
          this.position = r;
        }
        more() {
          return this.position < this.str.length;
        }
        peek() {
          return this.str.codePointAt(this.position);
        }
        skip(r) {
          this.position += r;
        }
        skipString(r) {
          this.position += r.length;
        }
        pop() {
          let r = this.str.codePointAt(this.position);
          return this.position += G.charCount(r), r;
        }
        lookingAt(r) {
          return this.str.startsWith(r, this.position);
        }
        rest() {
          return this.str.substring(this.position);
        }
        from(r) {
          return this.str.substring(r, this.position);
        }
        toString() {
          return this.rest();
        }
      };
      eC = class I {
        static ERR_INTERNAL_ERROR = "regexp/syntax: internal error";
        static ERR_INVALID_CHAR_RANGE = "invalid character class range";
        static ERR_INVALID_ESCAPE = "invalid escape sequence";
        static ERR_INVALID_NAMED_CAPTURE = "invalid named capture";
        static ERR_INVALID_PERL_OP = "invalid or unsupported Perl syntax";
        static ERR_INVALID_REPEAT_OP = "invalid nested repetition operator";
        static ERR_INVALID_REPEAT_SIZE = "invalid repeat count";
        static ERR_MISSING_BRACKET = "missing closing ]";
        static ERR_MISSING_PAREN = "missing closing )";
        static ERR_MISSING_REPEAT_ARGUMENT = "missing argument to repetition operator";
        static ERR_TRAILING_BACKSLASH = "trailing backslash at end of expression";
        static ERR_DUPLICATE_NAMED_CAPTURE = "duplicate capture group name";
        static ERR_UNEXPECTED_PAREN = "unexpected )";
        static ERR_NESTING_DEPTH = "expression nests too deeply";
        static ERR_LARGE = "expression too large";
        static ERR_INVALID_CAPTURE_IN_LOOKBEHIND = "invalid capture in lookbehind";
        static MAX_HEIGHT = 1e3;
        static MAX_SIZE = 3355443;
        static MAX_RUNES = 33554432;
        static ANY_TABLE = new D(new Uint32Array([0, F.MAX_RUNE, 1]));
        static ASCII_TABLE = new D(new Uint32Array([0, 127, 1]));
        static ASCII_FOLD_TABLE = new D(new Uint32Array([0, 127, 1, 383, 383, 1, 8490, 8490, 1]));
        static unicodeTable(B) {
          return B === "Any" ? { tab: I.ANY_TABLE, fold: I.ANY_TABLE, sign: 1 } : B === "Ascii" ? { tab: I.ASCII_TABLE, fold: I.ASCII_FOLD_TABLE, sign: 1 } : B === "Assigned" ? { tab: J.CATEGORIES.get("Cn"), fold: J.CATEGORIES.get("Cn"), sign: -1 } : B === "Lc" ? { tab: J.CATEGORIES.get("LC"), fold: J.FOLD_CATEGORIES.get("LC"), sign: 1 } : J.CATEGORIES.has(B) ? { tab: J.CATEGORIES.get(B), fold: J.FOLD_CATEGORIES.get(B), sign: 1 } : J.SCRIPTS.has(B) ? { tab: J.SCRIPTS.get(B), fold: J.FOLD_SCRIPT.get(B), sign: 1 } : null;
        }
        static minFoldRune(B) {
          if (B < F.MIN_FOLD || B > F.MAX_FOLD) return B;
          let C = B, t = B;
          for (B = F.simpleFold(B); B !== t; B = F.simpleFold(B)) C > B && (C = B);
          return C;
        }
        static leadingRegexp(B) {
          if (B.op === u.Op.EMPTY_MATCH) return null;
          if (B.op === u.Op.CONCAT && B.subs.length > 0) {
            let C = B.subs[0];
            return C.op === u.Op.EMPTY_MATCH ? null : C;
          }
          return B;
        }
        static literalRegexp(B, C) {
          let t = new u(u.Op.LITERAL);
          return t.flags = C, t.runes = G.stringToRunes(B), t;
        }
        static parse(B, C) {
          return new I(B, C).parseInternal();
        }
        static parseRepeat(B) {
          let C = B.pos();
          if (!B.more() || !B.lookingAt("{")) return -1;
          B.skip(1);
          let t = I.parseInt(B);
          if (t === -1 || !B.more()) return -1;
          let e;
          if (!B.lookingAt(",")) e = t;
          else {
            if (B.skip(1), !B.more()) return -1;
            if (B.lookingAt("}")) e = -1;
            else if ((e = I.parseInt(B)) === -1) return -1;
          }
          if (!B.more() || !B.lookingAt("}")) return -1;
          if (B.skip(1), t < 0 || t > 1e3 || e === -2 || e > 1e3 || e >= 0 && t > e) throw new R(I.ERR_INVALID_REPEAT_SIZE, B.from(C));
          return t << 16 | e & F.MAX_BMP;
        }
        static isValidCaptureName(B) {
          if (B.length === 0) return false;
          for (let C = 0; C < B.length; C++) {
            let t = B.codePointAt(C);
            if (t !== E.CODES.get("_") && !G.isalnum(t)) return false;
          }
          return true;
        }
        static parseInt(B) {
          let C = B.pos();
          for (; B.more() && B.peek() >= E.CODES.get("0") && B.peek() <= E.CODES.get("9"); ) B.skip(1);
          let t = B.from(C);
          return t.length === 0 || t.length > 1 && t.codePointAt(0) === E.CODES.get("0") ? -1 : t.length > 8 ? -2 : parseInt(t, 10);
        }
        static isCharClass(B) {
          return B.op === u.Op.LITERAL && B.runes.length === 1 || B.op === u.Op.CHAR_CLASS || B.op === u.Op.ANY_CHAR_NOT_NL || B.op === u.Op.ANY_CHAR;
        }
        static matchRune(B, C) {
          switch (B.op) {
            case u.Op.LITERAL:
              return B.runes.length === 1 && B.runes[0] === C;
            case u.Op.CHAR_CLASS:
              for (let t = 0; t < B.runes.length; t += 2) if (B.runes[t] <= C && C <= B.runes[t + 1]) return true;
              return false;
            case u.Op.ANY_CHAR_NOT_NL:
              return C !== E.CODES.get(`
`);
            case u.Op.ANY_CHAR:
              return true;
          }
          return false;
        }
        static mergeCharClass(B, C) {
          switch (B.op) {
            case u.Op.ANY_CHAR:
              break;
            case u.Op.ANY_CHAR_NOT_NL:
              I.matchRune(C, E.CODES.get(`
`)) && (B.op = u.Op.ANY_CHAR);
              break;
            case u.Op.CHAR_CLASS:
              C.op === u.Op.LITERAL ? B.runes = new Q(B.runes).appendLiteral(C.runes[0], C.flags).toArray() : B.runes = new Q(B.runes).appendClass(C.runes).toArray();
              break;
            case u.Op.LITERAL:
              if (C.runes[0] === B.runes[0] && C.flags === B.flags) break;
              B.op = u.Op.CHAR_CLASS, B.runes = new Q().appendLiteral(B.runes[0], B.flags).appendLiteral(C.runes[0], C.flags).toArray();
              break;
          }
        }
        static parseEscape(B) {
          let C = B.pos();
          if (B.skip(1), !B.more()) throw new R(I.ERR_TRAILING_BACKSLASH);
          let t = B.pop();
          B: switch (t) {
            case E.CODES.get("1"):
            case E.CODES.get("2"):
            case E.CODES.get("3"):
            case E.CODES.get("4"):
            case E.CODES.get("5"):
            case E.CODES.get("6"):
            case E.CODES.get("7"):
              if (!B.more() || B.peek() < E.CODES.get("0") || B.peek() > E.CODES.get("7")) break;
            case E.CODES.get("0"): {
              let e = t - E.CODES.get("0");
              for (let s = 1; s < 3 && !(!B.more() || B.peek() < E.CODES.get("0") || B.peek() > E.CODES.get("7")); s++) e = e * 8 + B.peek() - E.CODES.get("0"), B.skip(1);
              return e;
            }
            case E.CODES.get("x"): {
              if (!B.more()) break;
              if (t = B.pop(), t === E.CODES.get("{")) {
                let n = 0, i = 0;
                for (; ; ) {
                  if (!B.more()) break B;
                  if (t = B.pop(), t === E.CODES.get("}")) break;
                  let a = G.unhex(t);
                  if (a < 0 || (i = i * 16 + a, i > F.MAX_RUNE)) break B;
                  n++;
                }
                if (n === 0) break B;
                return i;
              }
              let e = G.unhex(t);
              if (!B.more()) break;
              t = B.pop();
              let s = G.unhex(t);
              if (e < 0 || s < 0) break;
              return e * 16 + s;
            }
            case E.CODES.get("a"):
              return E.CODES.get("\x07");
            case E.CODES.get("f"):
              return E.CODES.get("\f");
            case E.CODES.get("n"):
              return E.CODES.get(`
`);
            case E.CODES.get("r"):
              return E.CODES.get("\r");
            case E.CODES.get("t"):
              return E.CODES.get("	");
            case E.CODES.get("v"):
              return E.CODES.get("\v");
            default:
              if (t <= F.MAX_ASCII && !G.isalnum(t)) return t;
              break;
          }
          throw new R(I.ERR_INVALID_ESCAPE, B.from(C));
        }
        static parseClassChar(B, C) {
          if (!B.more()) throw new R(I.ERR_MISSING_BRACKET, B.from(C));
          return B.lookingAt("\\") ? I.parseEscape(B) : B.pop();
        }
        static concatRunes(B, C) {
          for (let t = 0; t < C.length; t++) B.push(C[t]);
          return B;
        }
        static hasCapture(B) {
          if (B === null) return false;
          if (B.op === u.Op.CAPTURE) return true;
          if (B.subs) {
            for (let C of B.subs) if (I.hasCapture(C)) return true;
          }
          return false;
        }
        constructor(B, C = 0) {
          this.wholeRegexp = B, this.flags = C, this.numCap = 0, this.namedGroups = /* @__PURE__ */ Object.create(null), this.stack = [], this.free = null, this.numRegexp = 0, this.numRunes = 0, this.repeats = 0, this.height = null, this.size = null, this.nlb = 0;
        }
        newRegexp(B) {
          let C = this.free;
          return C !== null && C.subs !== null && C.subs.length > 0 ? (this.free = C.subs[0], C.reinit(), C.op = B) : (C = new u(B), this.numRegexp += 1), C;
        }
        reuse(B) {
          this.height !== null && this.height.has(B) && this.height.delete(B), B.subs !== null && B.subs.length > 0 && (B.subs[0] = this.free), this.free = B;
        }
        checkLimits(B) {
          if (this.numRunes > I.MAX_RUNES) throw new R(I.ERR_LARGE);
          this.checkSize(B), this.checkHeight(B);
        }
        checkSize(B) {
          if (this.size === null) {
            if (this.repeats === 0 && (this.repeats = 1), B.op === u.Op.REPEAT) {
              let C = B.max;
              C === -1 && (C = B.min), C <= 0 && (C = 1), C > Math.floor(I.MAX_SIZE / this.repeats) ? this.repeats = I.MAX_SIZE : this.repeats *= C;
            }
            if (this.numRegexp < Math.floor(I.MAX_SIZE / this.repeats)) return;
            this.size = /* @__PURE__ */ new Map();
            for (let C of this.stack) this.checkSize(C);
          }
          if (this.calcSize(B, true) > I.MAX_SIZE) throw new R(I.ERR_LARGE);
        }
        calcSize(B, C = false) {
          if (!C && this.size !== null && this.size.has(B)) return this.size.get(B);
          let t = 0;
          switch (B.op) {
            case u.Op.LITERAL:
              t = B.runes.length;
              break;
            case u.Op.PLB:
            case u.Op.NLB:
            case u.Op.CAPTURE:
            case u.Op.STAR:
              t = 2 + this.calcSize(B.subs[0]);
              break;
            case u.Op.PLUS:
            case u.Op.QUEST:
              t = 1 + this.calcSize(B.subs[0]);
              break;
            case u.Op.CONCAT:
              for (let e of B.subs) t = t + this.calcSize(e);
              break;
            case u.Op.ALTERNATE:
              for (let e of B.subs) t = t + this.calcSize(e);
              B.subs.length > 1 && (t = t + B.subs.length - 1);
              break;
            case u.Op.REPEAT: {
              let e = this.calcSize(B.subs[0]);
              if (B.max === -1) {
                B.min === 0 ? t = 2 + e : t = 1 + B.min * e;
                break;
              }
              t = B.max * e + (B.max - B.min);
              break;
            }
          }
          return t = Math.max(1, t), this.size === null && (this.size = /* @__PURE__ */ new Map()), this.size.set(B, t), t;
        }
        checkHeight(B) {
          if (!(this.numRegexp < I.MAX_HEIGHT)) {
            if (this.height === null) {
              this.height = /* @__PURE__ */ new Map();
              for (let C of this.stack) this.checkHeight(C);
            }
            if (this.calcHeight(B, true) > I.MAX_HEIGHT) throw new R(I.ERR_NESTING_DEPTH);
          }
        }
        calcHeight(B, C = false) {
          if (!C && this.height !== null && this.height.has(B)) return this.height.get(B);
          let t = 1;
          for (let e of B.subs) {
            let s = this.calcHeight(e);
            t < 1 + s && (t = 1 + s);
          }
          return this.height === null && (this.height = /* @__PURE__ */ new Map()), this.height.set(B, t), t;
        }
        pop() {
          return this.stack.pop();
        }
        popToPseudo() {
          let B = this.stack.length, C = B;
          for (; C > 0 && !u.isPseudoOp(this.stack[C - 1].op); ) C--;
          let t = this.stack.slice(C, B);
          return this.stack = this.stack.slice(0, C), t;
        }
        push(B) {
          if (this.numRunes += B.runes.length, B.op === u.Op.CHAR_CLASS && B.runes.length === 2 && B.runes[0] === B.runes[1]) {
            if (this.maybeConcat(B.runes[0], this.flags & ~g.FOLD_CASE)) return null;
            B.op = u.Op.LITERAL, B.runes = [B.runes[0]], B.flags = this.flags & ~g.FOLD_CASE;
          } else if (B.op === u.Op.CHAR_CLASS && B.runes.length === 4 && B.runes[0] === B.runes[1] && B.runes[2] === B.runes[3] && F.simpleFold(B.runes[0]) === B.runes[2] && F.simpleFold(B.runes[2]) === B.runes[0] || B.op === u.Op.CHAR_CLASS && B.runes.length === 2 && B.runes[0] + 1 === B.runes[1] && F.simpleFold(B.runes[0]) === B.runes[1] && F.simpleFold(B.runes[1]) === B.runes[0]) {
            if (this.maybeConcat(B.runes[0], this.flags | g.FOLD_CASE)) return null;
            B.op = u.Op.LITERAL, B.runes = [B.runes[0]], B.flags = this.flags | g.FOLD_CASE;
          } else this.maybeConcat(-1, 0);
          return this.stack.push(B), this.checkLimits(B), B;
        }
        maybeConcat(B, C) {
          let t = this.stack.length;
          if (t < 2) return false;
          let e = this.stack[t - 1], s = this.stack[t - 2];
          return e.op !== u.Op.LITERAL || s.op !== u.Op.LITERAL || (e.flags & g.FOLD_CASE) !== (s.flags & g.FOLD_CASE) ? false : (s.runes = I.concatRunes(s.runes, e.runes), B >= 0 ? (e.runes = [B], e.flags = C, true) : (this.pop(), this.reuse(e), false));
        }
        newLiteral(B, C) {
          let t = this.newRegexp(u.Op.LITERAL);
          return t.flags = C, (C & g.FOLD_CASE) !== 0 && (B = I.minFoldRune(B)), t.runes = [B], t;
        }
        literal(B) {
          this.push(this.newLiteral(B, this.flags));
        }
        op(B) {
          let C = this.newRegexp(B);
          return C.flags = this.flags, this.push(C);
        }
        repeat(B, C, t, e, s, n) {
          let i = this.flags;
          if ((i & g.PERL_X) !== 0 && (s.more() && s.lookingAt("?") && (s.skip(1), i ^= g.NON_GREEDY), n !== -1)) throw new R(I.ERR_INVALID_REPEAT_OP, s.from(n));
          let a = this.stack.length;
          if (a === 0) throw new R(I.ERR_MISSING_REPEAT_ARGUMENT, s.from(e));
          let h = this.stack[a - 1];
          if (u.isPseudoOp(h.op)) throw new R(I.ERR_MISSING_REPEAT_ARGUMENT, s.from(e));
          let o = this.newRegexp(B);
          if (o.min = C, o.max = t, o.flags = i, o.subs = [h], this.stack[a - 1] = o, this.checkLimits(o), B === u.Op.REPEAT && (C >= 2 || t >= 2) && !this.repeatIsValid(o, 1e3)) throw new R(I.ERR_INVALID_REPEAT_SIZE, s.from(e));
        }
        repeatIsValid(B, C) {
          if (B.op === u.Op.REPEAT) {
            let t = B.max;
            if (t === 0) return true;
            if (t < 0 && (t = B.min), t > C) return false;
            t > 0 && (C = Math.trunc(C / t));
          }
          for (let t of B.subs) if (!this.repeatIsValid(t, C)) return false;
          return true;
        }
        concat() {
          this.maybeConcat(-1, 0);
          let B = this.popToPseudo();
          return B.length === 0 ? this.push(this.newRegexp(u.Op.EMPTY_MATCH)) : this.push(this.collapse(B, u.Op.CONCAT));
        }
        alternate() {
          let B = this.popToPseudo();
          return B.length > 0 && this.cleanAlt(B[B.length - 1]), B.length === 0 ? this.push(this.newRegexp(u.Op.NO_MATCH)) : this.push(this.collapse(B, u.Op.ALTERNATE));
        }
        cleanAlt(B) {
          B.op === u.Op.CHAR_CLASS && (B.runes = new Q(B.runes).cleanClass().toArray(), B.runes.length === 2 && B.runes[0] === 0 && B.runes[1] === F.MAX_RUNE ? (B.runes = [], B.op = u.Op.ANY_CHAR) : B.runes.length === 4 && B.runes[0] === 0 && B.runes[1] === E.CODES.get(`
`) - 1 && B.runes[2] === E.CODES.get(`
`) + 1 && B.runes[3] === F.MAX_RUNE && (B.runes = [], B.op = u.Op.ANY_CHAR_NOT_NL));
        }
        collapse(B, C) {
          if (B.length === 1) return B[0];
          let t = 0;
          for (let i of B) t += i.op === C ? i.subs.length : 1;
          let e = new Array(t).fill(null), s = 0;
          for (let i of B) if (i.op === C) {
            for (let a = 0; a < i.subs.length; a++) e[s++] = i.subs[a];
            this.reuse(i);
          } else e[s++] = i;
          let n = this.newRegexp(C);
          if (n.subs = e, C === u.Op.ALTERNATE && (n.subs = this.factor(n.subs), n.subs.length === 1)) {
            let i = n;
            n = n.subs[0], this.reuse(i);
          }
          return n;
        }
        factor(B) {
          if (B.length < 2) return B;
          let C = 0, t = B.length, e = 0, s = null, n = 0, i = 0, a = 0;
          for (let o = 0; o <= t; o++) {
            let f = null, p = 0, O = 0;
            if (o < t) {
              let L = B[C + o];
              if (L.op === u.Op.CONCAT && L.subs.length > 0 && (L = L.subs[0]), L.op === u.Op.LITERAL && (f = L.runes, p = L.runes.length, O = L.flags & g.FOLD_CASE), O === i) {
                let A = 0;
                for (; A < n && A < p && s[A] === f[A]; ) A++;
                if (A > 0) {
                  n = A;
                  continue;
                }
              }
            }
            if (o !== a) if (o === a + 1) B[e++] = B[C + a];
            else {
              let L = this.newRegexp(u.Op.LITERAL);
              L.flags = i, L.runes = s.slice(0, n);
              for (let T = a; T < o; T++) B[C + T] = this.removeLeadingString(B[C + T], n), this.checkLimits(B[C + T]);
              let A = this.collapse(B.slice(C + a, C + o), u.Op.ALTERNATE), d = this.newRegexp(u.Op.CONCAT);
              d.subs = [L, A], B[e++] = d;
            }
            a = o, s = f, n = p, i = O;
          }
          t = e, C = 0, a = 0, e = 0;
          let h = null;
          for (let o = 0; o <= t; o++) {
            let f = null;
            if (!(o < t && (f = I.leadingRegexp(B[C + o]), h !== null && h.equals(f) && (I.isCharClass(h) || h.op === u.Op.REPEAT && h.min === h.max && I.isCharClass(h.subs[0]))))) {
              if (o !== a) if (o === a + 1) B[e++] = B[C + a];
              else {
                let p = h;
                for (let A = a; A < o; A++) {
                  let d = A !== a;
                  B[C + A] = this.removeLeadingRegexp(B[C + A], d), this.checkLimits(B[C + A]);
                }
                let O = this.collapse(B.slice(C + a, C + o), u.Op.ALTERNATE), L = this.newRegexp(u.Op.CONCAT);
                L.subs = [p, O], B[e++] = L;
              }
              a = o, h = f;
            }
          }
          t = e, C = 0, a = 0, e = 0;
          for (let o = 0; o <= t; o++) if (!(o < t && I.isCharClass(B[C + o]))) {
            if (o !== a) if (o === a + 1) B[e++] = B[C + a];
            else {
              let f = a;
              for (let O = a + 1; O < o; O++) {
                let L = B[C + f], A = B[C + O];
                (L.op < A.op || L.op === A.op && (L.runes !== null ? L.runes.length : 0) < (A.runes !== null ? A.runes.length : 0)) && (f = O);
              }
              let p = B[C + a];
              B[C + a] = B[C + f], B[C + f] = p;
              for (let O = a + 1; O < o; O++) I.mergeCharClass(B[C + a], B[C + O]), this.reuse(B[C + O]);
              this.cleanAlt(B[C + a]), B[e++] = B[C + a];
            }
            o < t && (B[e++] = B[C + o]), a = o + 1;
          }
          t = e, C = 0, a = 0, e = 0;
          for (let o = 0; o < t; ++o) o + 1 < t && B[C + o].op === u.Op.EMPTY_MATCH && B[C + o + 1].op === u.Op.EMPTY_MATCH || (B[e++] = B[C + o]);
          return t = e, C = 0, B.slice(C, t);
        }
        removeLeadingString(B, C) {
          if (B.op === u.Op.CONCAT && B.subs.length > 0) {
            let t = this.removeLeadingString(B.subs[0], C);
            if (B.subs[0] = t, t.op === u.Op.EMPTY_MATCH) switch (this.reuse(t), B.subs.length) {
              case 0:
              case 1:
                B.op = u.Op.EMPTY_MATCH, B.subs = u.emptySubs();
                break;
              case 2: {
                let e = B;
                B = B.subs[1], this.reuse(e);
                break;
              }
              default:
                B.subs = B.subs.slice(1, B.subs.length);
                break;
            }
            return B;
          }
          return B.op === u.Op.LITERAL && (B.runes = B.runes.slice(C, B.runes.length), B.runes.length === 0 && (B.op = u.Op.EMPTY_MATCH)), B;
        }
        removeLeadingRegexp(B, C) {
          if (B.op === u.Op.CONCAT && B.subs.length > 0) {
            switch (C && this.reuse(B.subs[0]), B.subs = B.subs.slice(1, B.subs.length), B.subs.length) {
              case 0:
                B.op = u.Op.EMPTY_MATCH, B.subs = u.emptySubs();
                break;
              case 1: {
                let t = B;
                B = B.subs[0], this.reuse(t);
                break;
              }
            }
            return B;
          }
          return C && this.reuse(B), this.newRegexp(u.Op.EMPTY_MATCH);
        }
        parseInternal() {
          if ((this.flags & g.LITERAL) !== 0) return I.literalRegexp(this.wholeRegexp, this.flags);
          let B = -1, C = -1, t = -1, e = new HC(this.wholeRegexp);
          for (; e.more(); ) {
            let s = -1;
            B: switch (e.peek()) {
              case E.CODES.get("("):
                if ((this.flags & g.LOOKBEHIND) !== 0) {
                  if (e.lookingAt("(?<=")) {
                    this.parsePosLookBehind(), e.skip(4);
                    break;
                  }
                  if (e.lookingAt("(?<!")) {
                    this.parseNegLookBehind(), e.skip(4);
                    break;
                  }
                }
                if ((this.flags & g.PERL_X) !== 0 && e.lookingAt("(?")) {
                  this.parsePerlFlags(e);
                  break;
                }
                this.op(u.Op.LEFT_PAREN).cap = ++this.numCap, e.skip(1);
                break;
              case E.CODES.get("|"):
                this.parseVerticalBar(), e.skip(1);
                break;
              case E.CODES.get(")"):
                this.parseRightParen(), e.skip(1);
                break;
              case E.CODES.get("^"):
                (this.flags & g.ONE_LINE) !== 0 ? this.op(u.Op.BEGIN_TEXT) : this.op(u.Op.BEGIN_LINE), e.skip(1);
                break;
              case E.CODES.get("$"):
                (this.flags & g.ONE_LINE) !== 0 ? this.op(u.Op.END_TEXT).flags |= g.WAS_DOLLAR : this.op(u.Op.END_LINE), e.skip(1);
                break;
              case E.CODES.get("."):
                (this.flags & g.DOT_NL) !== 0 ? this.op(u.Op.ANY_CHAR) : this.op(u.Op.ANY_CHAR_NOT_NL), e.skip(1);
                break;
              case E.CODES.get("["):
                this.parseClass(e);
                break;
              case E.CODES.get("*"):
              case E.CODES.get("+"):
              case E.CODES.get("?"): {
                s = e.pos();
                let n = null;
                switch (e.pop()) {
                  case E.CODES.get("*"):
                    n = u.Op.STAR;
                    break;
                  case E.CODES.get("+"):
                    n = u.Op.PLUS;
                    break;
                  case E.CODES.get("?"):
                    n = u.Op.QUEST;
                    break;
                }
                this.repeat(n, C, t, s, e, B);
                break;
              }
              case E.CODES.get("{"): {
                s = e.pos();
                let n = I.parseRepeat(e);
                if (n < 0) {
                  e.rewindTo(s), this.literal(e.pop());
                  break;
                }
                C = n >> 16, t = (n & F.MAX_BMP) << 16 >> 16, this.repeat(u.Op.REPEAT, C, t, s, e, B);
                break;
              }
              case E.CODES.get("\\"): {
                let n = e.pos();
                if (e.skip(1), (this.flags & g.PERL_X) !== 0 && e.more()) switch (e.pop()) {
                  case E.CODES.get("A"):
                    this.op(u.Op.BEGIN_TEXT);
                    break B;
                  case E.CODES.get("b"):
                    this.op(u.Op.WORD_BOUNDARY);
                    break B;
                  case E.CODES.get("B"):
                    this.op(u.Op.NO_WORD_BOUNDARY);
                    break B;
                  case E.CODES.get("C"):
                    throw new R(I.ERR_INVALID_ESCAPE, "\\C");
                  case E.CODES.get("Q"): {
                    let h = e.rest(), o = h.indexOf("\\E");
                    o >= 0 ? (h = h.substring(0, o), e.skipString(h), e.skipString("\\E")) : e.skipString(h);
                    let f = 0;
                    for (; f < h.length; ) {
                      let p = h.codePointAt(f);
                      this.literal(p), f += G.charCount(p);
                    }
                    break B;
                  }
                  case E.CODES.get("z"):
                    this.op(u.Op.END_TEXT);
                    break B;
                  default:
                    e.rewindTo(n);
                    break;
                }
                else e.rewindTo(n);
                let i = this.newRegexp(u.Op.CHAR_CLASS);
                if (i.flags = this.flags, e.lookingAt("\\p") || e.lookingAt("\\P")) {
                  let h = new Q();
                  if (this.parseUnicodeClass(e, h)) {
                    i.runes = h.toArray(), this.push(i);
                    break B;
                  }
                }
                let a = new Q();
                if (this.parsePerlClassEscape(e, a)) {
                  i.runes = a.toArray(), this.push(i);
                  break B;
                }
                e.rewindTo(n), this.reuse(i), this.literal(I.parseEscape(e));
                break;
              }
              default:
                this.literal(e.pop());
                break;
            }
            B = s;
          }
          if (this.concat(), this.swapVerticalBar() && this.pop(), this.alternate(), this.stack.length !== 1) throw new R(I.ERR_MISSING_PAREN, this.wholeRegexp);
          return this.stack[0].namedGroups = this.namedGroups, this.stack[0];
        }
        parsePerlFlags(B) {
          let C = B.pos(), t = B.rest();
          if (t.startsWith("(?P<") || t.startsWith("(?<")) {
            let i = t.charAt(2) === "P" ? 4 : 3, a = t.indexOf(">");
            if (a < 0) throw new R(I.ERR_INVALID_NAMED_CAPTURE, t);
            let h = t.substring(i, a);
            if (B.skipString(h), B.skip(i + 1), !I.isValidCaptureName(h)) throw new R(I.ERR_INVALID_NAMED_CAPTURE, t.substring(0, a + 1));
            let o = this.op(u.Op.LEFT_PAREN);
            if (o.cap = ++this.numCap, this.namedGroups[h]) throw new R(I.ERR_DUPLICATE_NAMED_CAPTURE, h);
            this.namedGroups[h] = this.numCap, o.name = h;
            return;
          }
          B.skip(2);
          let e = this.flags, s = 1, n = false;
          B: for (; B.more(); ) {
            let i = B.pop();
            switch (i) {
              case E.CODES.get("i"):
                e |= g.FOLD_CASE, n = true;
                break;
              case E.CODES.get("m"):
                e &= ~g.ONE_LINE, n = true;
                break;
              case E.CODES.get("s"):
                e |= g.DOT_NL, n = true;
                break;
              case E.CODES.get("U"):
                e |= g.NON_GREEDY, n = true;
                break;
              case E.CODES.get("-"):
                if (s < 0) break B;
                s = -1, e = ~e, n = false;
                break;
              case E.CODES.get(":"):
              case E.CODES.get(")"):
                if (s < 0) {
                  if (!n) break B;
                  e = ~e;
                }
                i === E.CODES.get(":") && this.op(u.Op.LEFT_PAREN), this.flags = e;
                return;
              default:
                break B;
            }
          }
          throw new R(I.ERR_INVALID_PERL_OP, B.from(C));
        }
        parsePosLookBehind() {
          let B = this.newRegexp(u.Op.LEFT_PAREN);
          return B.flags = this.flags, B.lb = ++this.nlb, this.push(B);
        }
        parseNegLookBehind() {
          let B = this.newRegexp(u.Op.LEFT_PAREN);
          return B.flags = this.flags, B.lb = -++this.nlb, this.push(B);
        }
        parseVerticalBar() {
          this.concat(), this.swapVerticalBar() || this.op(u.Op.VERTICAL_BAR);
        }
        swapVerticalBar() {
          let B = this.stack.length;
          if (B >= 3 && this.stack[B - 2].op === u.Op.VERTICAL_BAR && I.isCharClass(this.stack[B - 1]) && I.isCharClass(this.stack[B - 3])) {
            let C = this.stack[B - 1], t = this.stack[B - 3];
            if (C.op > t.op) {
              let e = t;
              t = C, C = e, this.stack[B - 3] = t;
            }
            return I.mergeCharClass(t, C), this.reuse(C), this.pop(), true;
          }
          if (B >= 2) {
            let C = this.stack[B - 1], t = this.stack[B - 2];
            if (t.op === u.Op.VERTICAL_BAR) return B >= 3 && this.cleanAlt(this.stack[B - 3]), this.stack[B - 2] = C, this.stack[B - 1] = t, true;
          }
          return false;
        }
        parseRightParen() {
          if (this.concat(), this.swapVerticalBar() && this.pop(), this.alternate(), this.stack.length < 2) throw new R(I.ERR_UNEXPECTED_PAREN, this.wholeRegexp);
          let B = this.pop(), C = this.pop();
          if (C.op !== u.Op.LEFT_PAREN) throw new R(I.ERR_UNEXPECTED_PAREN, this.wholeRegexp);
          if (this.flags = C.flags, C.lb !== 0) {
            if (I.hasCapture(B)) throw new R(I.ERR_INVALID_CAPTURE_IN_LOOKBEHIND, this.wholeRegexp);
            C.lb > 0 ? C.op = u.Op.PLB : C.op = u.Op.NLB, C.subs = [B], this.push(C);
            return;
          }
          C.cap === 0 ? this.push(B) : (C.op = u.Op.CAPTURE, C.subs = [B], this.push(C));
        }
        parsePerlClassEscape(B, C) {
          let t = B.pos();
          if ((this.flags & g.PERL_X) === 0 || !B.more() || B.pop() !== E.CODES.get("\\") || !B.more()) return false;
          B.pop();
          let e = B.from(t), s = TB.has(e) ? TB.get(e) : null;
          return s === null ? false : (C.appendGroup(s, (this.flags & g.FOLD_CASE) !== 0), true);
        }
        parseNamedClass(B, C) {
          let t = B.rest(), e = t.indexOf(":]");
          if (e < 0) return false;
          let s = t.substring(0, e + 2);
          B.skipString(s);
          let n = QB.has(s) ? QB.get(s) : null;
          if (n === null) throw new R(I.ERR_INVALID_CHAR_RANGE, s);
          return C.appendGroup(n, (this.flags & g.FOLD_CASE) !== 0), true;
        }
        parseUnicodeClass(B, C) {
          let t = B.pos();
          if ((this.flags & g.UNICODE_GROUPS) === 0 || !B.lookingAt("\\p") && !B.lookingAt("\\P")) return false;
          B.skip(1);
          let e = 1, s = B.pop();
          if (s === E.CODES.get("P") && (e = -1), !B.more()) throw B.rewindTo(t), new R(I.ERR_INVALID_CHAR_RANGE, B.rest());
          s = B.pop();
          let n;
          if (s !== E.CODES.get("{")) n = G.runeToString(s);
          else {
            let o = B.rest(), f = o.indexOf("}");
            if (f < 0) throw B.rewindTo(t), new R(I.ERR_INVALID_CHAR_RANGE, B.rest());
            n = o.substring(0, f), B.skipString(n), B.skip(1);
          }
          n.length !== 0 && n.codePointAt(0) === E.CODES.get("^") && (e = 0 - e, n = n.substring(1));
          let i = I.unicodeTable(n);
          if (i === null) throw new R(I.ERR_INVALID_CHAR_RANGE, B.from(t));
          i.sign < 0 && (e = 0 - e);
          let a = i.tab, h = i.fold;
          if ((this.flags & g.FOLD_CASE) === 0 || h === null) C.appendTableWithSign(a, e);
          else {
            let o = new Q().appendTable(a).appendTable(h).cleanClass().toArray();
            C.appendClassWithSign(o, e);
          }
          return true;
        }
        parseClass(B) {
          let C = B.pos();
          B.skip(1);
          let t = this.newRegexp(u.Op.CHAR_CLASS);
          t.flags = this.flags;
          let e = new Q(), s = 1;
          B.more() && B.lookingAt("^") && (s = -1, B.skip(1), (this.flags & g.CLASS_NL) === 0 && e.appendRange(E.CODES.get(`
`), E.CODES.get(`
`)));
          let n = true;
          for (; !B.more() || B.peek() !== E.CODES.get("]") || n; ) {
            if (B.more() && B.lookingAt("-") && (this.flags & g.PERL_X) === 0 && !n) {
              let o = B.rest();
              if (o === "-" || !o.startsWith("-]")) throw B.rewindTo(C), new R(I.ERR_INVALID_CHAR_RANGE, B.rest());
            }
            n = false;
            let i = B.pos();
            if (B.lookingAt("[:")) {
              if (this.parseNamedClass(B, e)) continue;
              B.rewindTo(i);
            }
            if (this.parseUnicodeClass(B, e) || this.parsePerlClassEscape(B, e)) continue;
            B.rewindTo(i);
            let a = I.parseClassChar(B, C), h = a;
            if (B.more() && B.lookingAt("-")) {
              if (B.skip(1), B.more() && B.lookingAt("]")) B.skip(-1);
              else if (h = I.parseClassChar(B, C), h < a) throw new R(I.ERR_INVALID_CHAR_RANGE, B.from(i));
            }
            (this.flags & g.FOLD_CASE) === 0 ? e.appendRange(a, h) : e.appendFoldedRange(a, h);
          }
          B.skip(1), e.cleanClass(), s < 0 && e.negateClass(), t.runes = e.toArray(), this.push(t);
        }
      };
      AC = class q {
        static initTest(B) {
          let C = q.compile(B), t = new q(C.expr, C.prog, C.numSubexp, C.longest);
          return t.cond = C.cond, t.prefix = C.prefix, t.prefixUTF8 = C.prefixUTF8, t.prefixComplete = C.prefixComplete, t.prefixRune = C.prefixRune, t.prefilter = C.prefilter, t;
        }
        static compile(B) {
          return q.compileImpl(B, g.PERL, false);
        }
        static compilePOSIX(B) {
          return q.compileImpl(B, g.POSIX, true);
        }
        static compileImpl(B, C, t) {
          let e = eC.parse(B, C), s = e.maxCap();
          e = tC.simplify(e);
          let n = GC.build(e), i = CC.compileRegexp(e), a = new q(B, i, s, t);
          a.prefilter = n.type === w.Type.NONE ? null : n;
          let [h, o] = i.prefix();
          return a.prefixComplete = h, a.prefix = o, a.prefixUTF8 = G.stringToUtf8ByteArray(a.prefix), a.prefix.length > 0 && (a.prefixRune = a.prefix.codePointAt(0)), a.namedGroups = e.namedGroups, a;
        }
        static match(B, C) {
          return q.compile(B).match(C);
        }
        constructor(B, C, t = 0, e = 0) {
          this.expr = B, this.prog = C, this.numSubexp = t, this.longest = e, this.cond = C.startCond(), this.prefix = null, this.prefixUTF8 = null, this.prefixComplete = false, this.prefixRune = 0, this.machinePool = [], this.dfa = new WB(this.prog), this.onepass = HB.compile(this.prog), this.prefilter = null;
        }
        matchPrefixComplete(B, C, t, e) {
          if ((t === g.ANCHOR_START || t === g.ANCHOR_BOTH) && C !== 0) return null;
          let s = -1, n = -1, i = B.prefixLength(this);
          if (t === g.UNANCHORED) {
            let a = B.index(this, C);
            if (a < 0) return null;
            s = C + a, n = s + i;
          } else if (t === g.ANCHOR_BOTH) {
            if (B.endPos() !== i || B.index(this, 0) !== 0) return null;
            s = 0, n = i;
          } else if (t === g.ANCHOR_START) {
            if (B.index(this, 0) !== 0) return null;
            s = 0, n = i;
          }
          if (s < 0) return null;
          if (e > 0) {
            let a = new Int32Array(e).fill(-1);
            return a[0] = s, a[1] = n, Array.from(a);
          }
          return [];
        }
        executeEngine(B, C, t, e) {
          if (this.prefixComplete && (e === 0 || this.numSubexp === 0)) return this.matchPrefixComplete(B, C, t, e);
          if (this.prefilter !== null && t === g.UNANCHORED && !this.prefilter.eval(B, C)) return null;
          if (this.onepass !== null) return HB.execute(this, B, C, t, e);
          if (e > 0) return this.prog.numLb === 0 && B.endPos() <= rB.maxBitStateLen(this.prog) ? rB.execute(this, B, C, t, e) : this.doExecuteNFA(B, C, t, e);
          if (this.prog.numLb === 0) {
            let s = this.dfa.match(B, C, t);
            if (s !== null) return s ? [] : null;
            if (B.endPos() <= rB.maxBitStateLen(this.prog)) return rB.execute(this, B, C, t, e);
          }
          return this.doExecuteNFA(B, C, t, e);
        }
        numberOfCapturingGroups() {
          return this.numSubexp;
        }
        numberOfInstructions() {
          return this.prog.numInst();
        }
        get() {
          return this.machinePool.length > 0 ? this.machinePool.pop() : null;
        }
        reset() {
          this.machinePool.length = 0;
        }
        put(B) {
          this.machinePool.push(B);
        }
        toString() {
          return this.expr;
        }
        doExecuteNFA(B, C, t, e) {
          let s = this.get();
          s || (s = ZB.fromRE2(this)), s.init(e);
          let n = s.match(B, C, t) ? s.submatches() : null;
          return this.put(s), n;
        }
        match(B) {
          return this.executeEngine(m.fromUTF16(B), 0, g.UNANCHORED, 0) !== null;
        }
        matchWithGroup(B, C, t, e, s) {
          return B instanceof z || (G.isByteArray(B) ? B = V.utf8(B) : B = V.utf16(B)), this.matchMachineInput(B, C, t, e, s);
        }
        matchMachineInput(B, C, t, e, s) {
          if (C > t) return [false, null];
          let n = B.isUTF16Encoding() ? m.fromUTF16(B.asCharSequence(), 0, t) : m.fromUTF8(B.asBytes(), 0, t), i = this.executeEngine(n, C, e, 2 * s);
          return i === null ? [false, null] : [true, i];
        }
        matchUTF8(B) {
          return this.executeEngine(m.fromUTF8(B), 0, g.UNANCHORED, 0) !== null;
        }
        replaceAll(B, C) {
          return this.replaceAllFunc(B, () => C, 2 * B.length + 1);
        }
        replaceFirst(B, C) {
          return this.replaceAllFunc(B, () => C, 1);
        }
        replaceAllFunc(B, C, t) {
          let e = 0, s = 0, n = "", i = m.fromUTF16(B), a = 0;
          for (; s <= B.length; ) {
            let h = this.executeEngine(i, s, g.UNANCHORED, 2);
            if (h === null || h.length === 0) break;
            n += B.substring(e, h[0]), (h[1] > e || h[0] === 0) && (n += C(B.substring(h[0], h[1])), a++), e = h[1];
            let o = i.step(s) & 7;
            if (s + o > h[1] ? s += o : s + 1 > h[1] ? s++ : s = h[1], a >= t) break;
          }
          return n += B.substring(e), n;
        }
        pad(B) {
          if (B === null) return null;
          let C = (1 + this.numSubexp) * 2;
          if (B.length < C) {
            let t = new Array(C).fill(-1);
            for (let e = 0; e < B.length; e++) t[e] = B[e];
            B = t;
          }
          return B;
        }
        allMatches(B, C, t = (e) => e) {
          let e = [], s = B.endPos();
          C < 0 && (C = s + 1);
          let n = 0, i = 0, a = -1;
          for (; i < C && n <= s; ) {
            let h = this.executeEngine(B, n, g.UNANCHORED, this.prog.numCap);
            if (h === null || h.length === 0) break;
            let o = true;
            if (h[1] === n) {
              h[0] === a && (o = false);
              let f = B.step(n);
              f < 0 ? n = s + 1 : n += f & 7;
            } else n = h[1];
            a = h[1], o && (e.push(t(this.pad(h))), i++);
          }
          return e;
        }
        findUTF8(B) {
          let C = this.executeEngine(m.fromUTF8(B), 0, g.UNANCHORED, 2);
          return C === null ? null : B.slice(C[0], C[1]);
        }
        findUTF8Index(B) {
          let C = this.executeEngine(m.fromUTF8(B), 0, g.UNANCHORED, 2);
          return C === null ? null : C.slice(0, 2);
        }
        find(B) {
          let C = this.executeEngine(m.fromUTF16(B), 0, g.UNANCHORED, 2);
          return C === null ? "" : B.substring(C[0], C[1]);
        }
        findIndex(B) {
          return this.executeEngine(m.fromUTF16(B), 0, g.UNANCHORED, 2);
        }
        findUTF8Submatch(B) {
          let C = this.executeEngine(m.fromUTF8(B), 0, g.UNANCHORED, this.prog.numCap);
          if (C === null) return null;
          let t = new Array(1 + this.numSubexp).fill(null);
          for (let e = 0; e < t.length; e++) 2 * e < C.length && C[2 * e] >= 0 && (t[e] = B.slice(C[2 * e], C[2 * e + 1]));
          return t;
        }
        findUTF8SubmatchIndex(B) {
          return this.pad(this.executeEngine(m.fromUTF8(B), 0, g.UNANCHORED, this.prog.numCap));
        }
        findSubmatch(B) {
          let C = this.executeEngine(m.fromUTF16(B), 0, g.UNANCHORED, this.prog.numCap);
          if (C === null) return null;
          let t = new Array(1 + this.numSubexp).fill(null);
          for (let e = 0; e < t.length; e++) 2 * e < C.length && C[2 * e] >= 0 && (t[e] = B.substring(C[2 * e], C[2 * e + 1]));
          return t;
        }
        findSubmatchIndex(B) {
          return this.pad(this.executeEngine(m.fromUTF16(B), 0, g.UNANCHORED, this.prog.numCap));
        }
        findAllUTF8(B, C) {
          let t = this.allMatches(m.fromUTF8(B), C, (e) => B.slice(e[0], e[1]));
          return t.length === 0 ? null : t;
        }
        findAllUTF8Index(B, C) {
          let t = this.allMatches(m.fromUTF8(B), C, (e) => e.slice(0, 2));
          return t.length === 0 ? null : t;
        }
        findAll(B, C) {
          let t = this.allMatches(m.fromUTF16(B), C, (e) => B.substring(e[0], e[1]));
          return t.length === 0 ? null : t;
        }
        findAllIndex(B, C) {
          let t = this.allMatches(m.fromUTF16(B), C, (e) => e.slice(0, 2));
          return t.length === 0 ? null : t;
        }
        findAllUTF8Submatch(B, C) {
          let t = this.allMatches(m.fromUTF8(B), C, (e) => {
            let s = new Array(e.length / 2 | 0).fill(null);
            for (let n = 0; n < s.length; n++) e[2 * n] >= 0 && (s[n] = B.slice(e[2 * n], e[2 * n + 1]));
            return s;
          });
          return t.length === 0 ? null : t;
        }
        findAllUTF8SubmatchIndex(B, C) {
          let t = this.allMatches(m.fromUTF8(B), C);
          return t.length === 0 ? null : t;
        }
        findAllSubmatch(B, C) {
          let t = this.allMatches(m.fromUTF16(B), C, (e) => {
            let s = new Array(e.length / 2 | 0).fill(null);
            for (let n = 0; n < s.length; n++) e[2 * n] >= 0 && (s[n] = B.substring(e[2 * n], e[2 * n + 1]));
            return s;
          });
          return t.length === 0 ? null : t;
        }
        findAllSubmatchIndex(B, C) {
          let t = this.allMatches(m.fromUTF16(B), C);
          return t.length === 0 ? null : t;
        }
      };
      mC = class DB {
        static UNANCHORED = g.UNANCHORED;
        static ANCHOR_START = g.ANCHOR_START;
        static ANCHOR_BOTH = g.ANCHOR_BOTH;
        constructor(B = DB.UNANCHORED, C = 0, t = 8388608) {
          this.anchor = B, this.jsFlags = C, this.maxMem = t;
          let e = g.PERL;
          (C & y.DISABLE_UNICODE_GROUPS) !== 0 && (e &= ~g.UNICODE_GROUPS), (C & y.LOOKBEHINDS) !== 0 && (e |= g.LOOKBEHIND), this.re2Flags = e, this.regexps = [], this.prog = null, this.dfa = null, this.dummyRe2 = null;
        }
        add(B) {
          if (this.prog) throw new zB("Cannot add patterns after compile");
          let C = B;
          (this.jsFlags & y.CASE_INSENSITIVE) !== 0 && (C = `(?i)${C}`), (this.jsFlags & y.DOTALL) !== 0 && (C = `(?s)${C}`), (this.jsFlags & y.MULTILINE) !== 0 && (C = `(?m)${C}`);
          let t = eC.parse(C, this.re2Flags);
          return this.regexps.push(tC.simplify(t)), this.regexps.length - 1;
        }
        compile() {
          this.prog || (this.prog = CC.compileSet(this.regexps), this.dfa = new WB(this.prog, this.maxMem), this.dummyRe2 = { prog: this.prog, cond: this.prog.startCond(), prefix: "", prefixRune: 0, longest: false });
        }
        match(B) {
          this.prog || this.compile();
          let C = G.isByteArray(B) ? m.fromUTF8(B) : m.fromUTF16(B), t = g.UNANCHORED;
          this.anchor === DB.ANCHOR_START ? t = g.ANCHOR_START : this.anchor === DB.ANCHOR_BOTH && (t = g.ANCHOR_BOTH);
          let e = this.dfa.matchSet(C, 0, t);
          if (e !== null) return e;
          let s = ZB.fromRE2(this.dummyRe2);
          return s.init(0), s.matchSet(C, 0, t);
        }
      };
      NC = class Z {
        static isHexadecimal(B) {
          return "0" <= B && B <= "9" || "A" <= B && B <= "F" || "a" <= B && B <= "f";
        }
        static translate(B) {
          let C = "";
          if (B instanceof RegExp && (B.ignoreCase && (C += "i"), B.multiline && (C += "m"), B.dotAll && (C += "s"), B = B.source), typeof B != "string") return B;
          let t = "", e = false, s = B.length;
          s === 0 && (t = "(?:)", e = true);
          let n = false, i = 0;
          for (; i < s; ) {
            let h = B[i];
            if (h === "\\") {
              if (i + 1 < s) switch (h = B[i + 1], h) {
                case "\\":
                  t += "\\\\", i += 2;
                  continue;
                case "c":
                  if (i + 2 < s) {
                    let p = B[i + 2].charCodeAt(0);
                    if (p >= 65 && p <= 90 || p >= 97 && p <= 122) {
                      let O = p % 32;
                      t += "\\x", t += (O >> 4).toString(16).toUpperCase(), t += (O & 15).toString(16).toUpperCase(), i += 3, e = true;
                      continue;
                    }
                  }
                  t += "c", i += 2, e = true;
                  continue;
                case "u":
                  if (i + 2 < s) {
                    if (B[i + 2] === "{") {
                      let p = i + 3, O = false, L = false;
                      for (; p < s; ) {
                        let A = B[p];
                        if (A === "}") {
                          L = true;
                          break;
                        }
                        if (!Z.isHexadecimal(A)) break;
                        O = true, p++;
                      }
                      if (L && O) {
                        t += "\\x", i += 2, e = true;
                        continue;
                      }
                    } else if (i + 5 < s) {
                      let p = true;
                      for (let O = 0; O < 4; O++) if (!Z.isHexadecimal(B[i + 2 + O])) {
                        p = false;
                        break;
                      }
                      if (p) {
                        t += "\\x{" + B.substring(i + 2, i + 6) + "}", i += 6, e = true;
                        continue;
                      }
                    }
                  }
                  t += "u", i += 2, e = true;
                  continue;
                case "x": {
                  let p = false;
                  if (i + 2 < s && B[i + 2] === "{") {
                    let O = i + 3, L = false, A = false;
                    for (; O < s; ) {
                      let d = B[O];
                      if (d === "}") {
                        A = true;
                        break;
                      }
                      if (!Z.isHexadecimal(d)) break;
                      L = true, O++;
                    }
                    A && L && (p = true);
                  } else i + 3 < s && Z.isHexadecimal(B[i + 2]) && Z.isHexadecimal(B[i + 3]) && (p = true);
                  p ? (t += "\\x", i += 2) : (t += "x", i += 2, e = true);
                  continue;
                }
                case "n":
                case "r":
                case "t":
                case "a":
                case "f":
                case "v":
                case "d":
                case "D":
                case "s":
                case "S":
                case "w":
                case "W":
                case "b":
                case "B":
                case "p":
                case "P":
                case "A":
                case "z":
                case "Q":
                case "E":
                case "0":
                case "1":
                case "2":
                case "3":
                case "4":
                case "5":
                case "6":
                case "7":
                  t += "\\" + h, i += 2;
                  continue;
                default: {
                  let p = B.codePointAt(i + 1);
                  if (p >= 48 && p <= 57 || p >= 65 && p <= 90 || p >= 97 && p <= 122) {
                    let O = G.charCount(p);
                    t += B.substring(i + 1, i + 1 + O), i += O + 1, e = true;
                  } else {
                    t += "\\";
                    let O = G.charCount(p);
                    t += B.substring(i + 1, i + 1 + O), i += O + 1;
                  }
                  continue;
                }
              }
            } else if (h === "/") {
              t += "\\/", i += 1, e = true;
              continue;
            } else if (h === "[") n = true;
            else if (h === "]") n = false;
            else if (!n && h === "(" && i + 2 < s && B[i + 1] === "?" && B[i + 2] === "<" && i + 3 < s && !"=!>)".includes(B[i + 3])) {
              t += "(?P<", i += 3, e = true;
              continue;
            }
            let o = B.codePointAt(i), f = G.charCount(o);
            t += B.substring(i, i + f), i += f;
          }
          let a = e ? t : B;
          return C.length > 0 ? `(?${C})${a}` : a;
        }
      };
      wC = class b {
        static CASE_INSENSITIVE = y.CASE_INSENSITIVE;
        static DOTALL = y.DOTALL;
        static MULTILINE = y.MULTILINE;
        static DISABLE_UNICODE_GROUPS = y.DISABLE_UNICODE_GROUPS;
        static LONGEST_MATCH = y.LONGEST_MATCH;
        static LOOKBEHINDS = y.LOOKBEHINDS;
        static quote(B) {
          return G.quoteMeta(B);
        }
        static quoteReplacement(B, C = false) {
          return OB.quoteReplacement(B, C);
        }
        static translateRegExp(B) {
          return NC.translate(B);
        }
        static compile(B, C = 0) {
          let t = B;
          if ((C & b.CASE_INSENSITIVE) !== 0 && (t = `(?i)${t}`), (C & b.DOTALL) !== 0 && (t = `(?s)${t}`), (C & b.MULTILINE) !== 0 && (t = `(?m)${t}`), (C & ~(b.MULTILINE | b.DOTALL | b.CASE_INSENSITIVE | b.DISABLE_UNICODE_GROUPS | b.LONGEST_MATCH | b.LOOKBEHINDS)) !== 0) throw new lC("Flags should only be a combination of MULTILINE, DOTALL, CASE_INSENSITIVE, DISABLE_UNICODE_GROUPS, LONGEST_MATCH, LOOKBEHINDS");
          let e = g.PERL;
          (C & b.DISABLE_UNICODE_GROUPS) !== 0 && (e &= ~g.UNICODE_GROUPS), (C & b.LOOKBEHINDS) !== 0 && (e |= g.LOOKBEHIND);
          let s = new b(B, C);
          return s.re2Input = AC.compileImpl(t, e, (C & b.LONGEST_MATCH) !== 0), s;
        }
        static matches(B, C) {
          return b.compile(B).testExact(C);
        }
        static initTest(B, C, t) {
          if (B == null) throw new Error("pattern is null");
          if (t == null) throw new Error("re2 is null");
          let e = new b(B, C);
          return e.re2Input = t, e;
        }
        constructor(B, C) {
          this.patternInput = B, this.flagsInput = C, this.re2Input = null;
        }
        reset() {
          this.re2Input.reset();
        }
        flags() {
          return this.flagsInput;
        }
        pattern() {
          return this.patternInput;
        }
        re2() {
          return this.re2Input;
        }
        matches(B) {
          return this.testExact(B);
        }
        matcher(B) {
          return G.isByteArray(B) && (B = V.utf8(B)), new OB(this, B);
        }
        test(B) {
          return G.isByteArray(B) ? this.re2Input.matchUTF8(B) : this.re2Input.match(B);
        }
        testExact(B) {
          let C = G.isByteArray(B) ? m.fromUTF8(B) : m.fromUTF16(B);
          return this.re2Input.executeEngine(C, 0, g.ANCHOR_BOTH, 0) !== null;
        }
        exec(B) {
          let C = this.matcher(B);
          if (!C.find()) return null;
          let t = [C.group(0)];
          for (let s = 1; s <= C.groupCount(); s++) {
            let n = C.group(s);
            t.push(n === null ? void 0 : n);
          }
          t.index = C.start(0), t.input = B;
          let e = this.namedGroups();
          if (Object.keys(e).length > 0) {
            let s = C.getNamedGroups();
            for (let n in s) s[n] === null && (s[n] = void 0);
            t.groups = s;
          } else t.groups = void 0;
          return t;
        }
        split(B, C = 0) {
          let t = this.matcher(B), e = [], s = 0, n = 0;
          for (; t.find(); ) {
            if (n === 0 && t.end() === 0) {
              n = t.end();
              continue;
            }
            if (C > 0 && e.length === C - 1) break;
            if (n === t.start()) {
              if (C === 0) {
                s += 1, n = t.end();
                continue;
              }
            } else for (; s > 0; ) e.push(""), s -= 1;
            e.push(t.substring(n, t.start())), n = t.end();
          }
          if (C === 0 && n !== t.inputLength()) {
            for (; s > 0; ) e.push(""), s -= 1;
            e.push(t.substring(n, t.inputLength()));
          }
          return (C !== 0 || e.length === 0 && !(n === t.inputLength() && n > 0)) && e.push(t.substring(n, t.inputLength())), e;
        }
        *matchAll(B) {
          let C = this.matcher(B);
          for (; C.find(); ) {
            let t = [C.group(0)];
            for (let s = 1; s <= C.groupCount(); s++) {
              let n = C.group(s);
              t.push(n === null ? void 0 : n);
            }
            t.index = C.start(0), t.input = B;
            let e = this.namedGroups();
            if (Object.keys(e).length > 0) {
              let s = C.getNamedGroups();
              for (let n in s) s[n] === null && (s[n] = void 0);
              t.groups = s;
            } else t.groups = void 0;
            yield t;
          }
        }
        toString() {
          return this.patternInput;
        }
        programSize() {
          return this.re2Input.numberOfInstructions();
        }
        groupCount() {
          return this.re2Input.numberOfCapturingGroups();
        }
        namedGroups() {
          return this.re2Input.namedGroups;
        }
        equals(B) {
          return this === B ? true : B === null || this.constructor !== B.constructor ? false : this.flagsInput === B.flagsInput && this.patternInput === B.patternInput;
        }
      };
    }
  });

  // wydgine/sewn/regex.js
  var regex_exports = {};
  __export(regex_exports, {
    regexOperation: () => regexOperation
  });
  function unicode(text, enabled, insensitive) {
    for (let i = 0; i < text.length; i++) {
      const c2 = text.charCodeAt(i);
      ensure(!insensitive || c2 < 128, "REGEX");
      if (c2 >= 55296 && c2 <= 57343) {
        ensure(enabled && c2 <= 56319 && i + 1 < text.length, "REGEX");
        const low = text.charCodeAt(++i);
        ensure(low >= 56320 && low <= 57343, "REGEX");
      }
    }
  }
  function patternSubset(pattern, flags, bounds) {
    let pos = 0, captures = 0, endAnchor = false, anchors = false;
    const check = (cost) => ensure(cost <= bounds.regexAtoms, "LIMIT");
    const escape = (inClass) => {
      ensure(pos < pattern.length, "REGEX");
      const c2 = pattern[pos++];
      if (Object.hasOwn(classes, c2)) return inClass ? classes[c2] : `[${classes[c2]}]`;
      if (["D", "W", "S"].includes(c2)) {
        ensure(!inClass, "REGEX");
        return `[^${classes[c2.toLowerCase()]}]`;
      }
      if (c2 === "b") return inClass ? "\\x08" : "\\b";
      if (c2 === "B") {
        ensure(!inClass, "REGEX");
        return "\\B";
      }
      if ("nrtfv".includes(c2)) return "\\" + c2;
      if (c2 === "0") {
        ensure(!/[0-9]/.test(pattern[pos] ?? ""), "REGEX");
        return "\\x00";
      }
      if (c2 === "x" || c2 === "u") {
        const size = c2 === "x" ? 2 : 4, hex = pattern.slice(pos, pos + size);
        ensure(hex.length === size && /^[0-9a-fA-F]+$/.test(hex), "REGEX");
        pos += size;
        const code = parseInt(hex, 16);
        ensure(code < 55296 || code > 57343, "REGEX");
        ensure(!flags.includes("i") || code < 128, "REGEX");
        return `\\x{${hex}}`;
      }
      ensure("\\^$.*+?()[]{}|/-".includes(c2), "REGEX");
      return c2 === "/" ? "/" : "\\" + c2;
    };
    function sequence(depth) {
      ensure(depth <= bounds.regexDepth, "LIMIT");
      let out = "", cost = 0, hasCapture = false;
      while (pos < pattern.length && pattern[pos] !== ")") {
        const c2 = pattern[pos++];
        let atom = "", size = 1, cap = false, assertion = false;
        if (c2 === "|") {
          out += "|";
          cost++;
          check(cost);
          continue;
        }
        if (c2 === "(") {
          let capturing = true;
          if (pattern[pos] === "?") {
            ensure(pattern.slice(pos, pos + 2) === "?:", "REGEX");
            pos += 2;
            capturing = false;
          }
          if (capturing) ensure(++captures <= bounds.regexCaptures, "LIMIT");
          const child = sequence(depth + 1);
          ensure(pattern[pos++] === ")", "REGEX");
          atom = "(" + (capturing ? "" : "?:") + child.out + ")";
          size = child.cost + 2;
          cap = capturing || child.hasCapture;
        } else if (c2 === "[") {
          atom = "[";
          if (pattern[pos] === "^") atom += pattern[pos++];
          const members = [];
          let count = 0;
          while (pos < pattern.length && pattern[pos] !== "]") {
            const ch = pattern[pos++];
            ensure(ch !== "[", "REGEX");
            members.push(ch === "-" ? "hyphen" : ch === "\\" && "dws".includes(pattern[pos] ?? "") ? "set" : "single");
            atom += ch === "\\" ? escape(true) : ch;
            count++;
          }
          ensure(count > 0 && pattern[pos++] === "]", "REGEX");
          for (let i = 1; i < members.length - 1; i++) if (members[i] === "hyphen") ensure(members[i - 1] === "single" && members[i + 1] === "single", "REGEX");
          atom += "]";
          size = count + 1;
        } else if (c2 === "\\") {
          atom = escape(false);
          assertion = atom === "\\b" || atom === "\\B";
        } else if (c2 === ".") atom = flags.includes("s") ? "[\\x00-\\x{10ffff}]" : "[^\\n\\r\\x{2028}\\x{2029}]";
        else if (c2 === "^" || c2 === "$") {
          atom = c2;
          assertion = true;
          anchors = true;
          if (c2 === "$") endAnchor = true;
        } else {
          ensure(!"*+?{}]".includes(c2), "REGEX");
          atom = c2;
        }
        let repeats = 1, expansion = 1, quantifier = "";
        const q2 = pattern[pos];
        if (q2 === "*" || q2 === "+" || q2 === "?") {
          pos++;
          quantifier = q2;
          repeats = q2 === "?" ? 1 : Infinity;
        } else if (q2 === "{") {
          pos++;
          let lo = "", hi = "";
          while (/[0-9]/.test(pattern[pos] ?? "")) lo += pattern[pos++];
          ensure(lo.length > 0, "REGEX");
          if (pattern[pos] === ",") {
            pos++;
            while (/[0-9]/.test(pattern[pos] ?? "")) hi += pattern[pos++];
            repeats = hi === "" ? Infinity : Number(hi);
          } else repeats = Number(lo);
          ensure((lo === "0" || !lo.startsWith("0")) && (hi === "" || hi === "0" || !hi.startsWith("0")), "REGEX");
          ensure(pattern[pos++] === "}" && Number(lo) <= repeats, "REGEX");
          ensure(Number(lo) <= bounds.regexRepeat && (repeats === Infinity || repeats <= bounds.regexRepeat), "LIMIT");
          expansion = repeats === Infinity ? Math.max(1, Number(lo) + 1) : Math.max(1, repeats);
          quantifier = "{" + lo + (hi !== "" || repeats === Infinity ? "," + hi : "") + "}";
        }
        if (quantifier) {
          ensure(!assertion && (!cap || repeats <= 1), "REGEX");
          if (pattern[pos] === "?") {
            pos++;
            quantifier += "?";
          }
          size = size * expansion + 2;
        }
        cost += size;
        check(cost);
        hasCapture ||= cap;
        out += atom + quantifier;
      }
      return { out, cost, hasCapture };
    }
    const result = sequence(0);
    ensure(pos === pattern.length, "REGEX");
    return { ...result, captures, endAnchor, anchors };
  }
  function regexOperation(bounds, tick) {
    let used = 0;
    const spend = (work) => {
      ensure(Number.isSafeInteger(work) && work >= 0 && work <= bounds.regexWork - used, "LIMIT");
      used += work;
      for (let i = 0; i < Math.ceil(work / 128); i++) tick();
    };
    return (name4, args) => {
      args.forEach((v) => ensure(typeof v === "string", "TYPE"));
      const [text, pattern] = args, flags = args[name4 === "RegexReplace" ? 3 : 2];
      ensure(pattern.length <= bounds.regexPattern && text.length <= bounds.regexInput, "LIMIT");
      spend(pattern.length * pattern.length + text.length + flags.length + 1);
      const seen = /* @__PURE__ */ new Set();
      for (const flag of flags) {
        ensure("gimsu".includes(flag) && !seen.has(flag), "REGEX");
        seen.add(flag);
      }
      unicode(text, seen.has("u"), seen.has("i"));
      unicode(pattern, seen.has("u"), seen.has("i"));
      const subset = patternSubset(pattern, flags, bounds);
      if (subset.anchors && seen.has("m")) ensure(!text.includes("\r") && !text.includes("\u2028") && !text.includes("\u2029"), "REGEX");
      if (subset.endAnchor && !seen.has("m")) ensure(text.length === 0 || !line(text.at(-1)), "REGEX");
      spend((subset.cost + 1) ** 2 * 4);
      let compiled;
      try {
        compiled = wC.compile(subset.out, wC.DISABLE_UNICODE_GROUPS | (seen.has("i") ? wC.CASE_INSENSITIVE : 0) | (seen.has("m") ? wC.MULTILINE : 0));
      } catch {
        fail("REGEX");
      }
      const engine = compiled.re2(), instructions = compiled.programSize();
      ensure(instructions <= bounds.regexInstructions && compiled.groupCount() === subset.captures, "LIMIT");
      engine.executeEngine = (input, pos, anchor, ncap) => engine.doExecuteNFA(input, pos, anchor, ncap);
      const matcher = compiled.matcher(text), groups = subset.captures;
      let position = 0, matches = 0, nodes = name4 === "RegexMatches" || name4 === "RegexSplit" ? 1 : 0, output = 0, last = 0;
      const result = [], parts2 = [], outputLimit = Math.min(bounds.string, bounds.regexOutput);
      const allocate = (units, count = 0) => {
        ensure(output + units <= outputLimit && nodes + count <= bounds.valueNodes, "LIMIT");
        spend(units + count);
        output += units;
        nodes += count;
      };
      const append = (piece) => {
        allocate(piece.length);
        parts2.push(piece);
      };
      const appendRange = (start, end) => {
        allocate(end - start);
        parts2.push(text.slice(start, end));
      };
      const field = (start, end) => {
        allocate(end - start, 1);
        ensure(result.length < bounds.regexMatches + 1, "LIMIT");
        result.push(text.slice(start, end));
      };
      const first = name4 === "RegexTest" || name4 === "RegexMatch" || name4 === "RegexReplace" && !seen.has("g");
      while (position <= text.length) {
        spend((text.length - position + 1) * instructions * (2 * groups + 2) * 16);
        if (!matcher.find(position)) break;
        ensure(++matches <= bounds.regexMatches, "LIMIT");
        tick();
        const start = matcher.start(), end = matcher.end();
        if (name4 === "RegexTest") return true;
        if (name4 === "RegexMatch" || name4 === "RegexMatches") {
          allocate(end - start, 5 + groups);
          const captures = [];
          for (let i = 1; i <= groups; i++) {
            const begin = matcher.start(i), finish = matcher.end(i);
            allocate(begin < 0 ? 0 : finish - begin);
            captures.push(begin < 0 ? null : text.slice(begin, finish));
          }
          const match = { value: text.slice(start, end), index: start, groups: captures };
          if (name4 === "RegexMatch") return match;
          result.push(match);
        } else if (name4 === "RegexReplace") {
          appendRange(last, start);
          append(args[2]);
          last = end;
        } else {
          field(last, start);
          last = end;
        }
        if (first) break;
        position = end === start ? end + (seen.has("u") && text.codePointAt(end) > 65535 ? 2 : 1) : end;
      }
      if (name4 === "RegexTest") return false;
      if (name4 === "RegexMatch") return null;
      if (name4 === "RegexMatches") return result;
      if (name4 === "RegexSplit") {
        field(last, text.length);
        return result;
      }
      appendRange(last, text.length);
      return parts2.join("");
    };
  }
  var whitespace, classes, line;
  var init_regex = __esm({
    "wydgine/sewn/regex.js"() {
      init_re2js();
      init_validate();
      whitespace = "\\t\\n\\v\\f\\r \\x{a0}\\x{1680}\\x{2000}-\\x{200a}\\x{2028}\\x{2029}\\x{202f}\\x{205f}\\x{3000}\\x{feff}";
      classes = { d: "0-9", w: "A-Za-z0-9_", s: whitespace };
      line = (c2) => c2 === "\n" || c2 === "\r" || c2 === "\u2028" || c2 === "\u2029";
    }
  });

  // wydgine/object-model/schema.js
  init_validation();
  var SCHEMA = "wydgit/0.2";
  var validId = (id) => typeof id === "string" && /^[A-Za-z][\w.-]*$/.test(id);
  var envelopeFields = Object.freeze(["schema", "id", "prototype", "properties", "slots", "provenance"]);
  function validateEnvelope(raw) {
    requireThat(record(raw), "OBJECT.ENVELOPE", "Expected object envelope");
    requireThat([Object.prototype, null].includes(Object.getPrototypeOf(raw)), "INPUT.JSON", "Expected plain envelope");
    const keys = Reflect.ownKeys(raw);
    requireThat(keys.length === envelopeFields.length && keys.every((k2) => envelopeFields.includes(k2)), "OBJECT.ENVELOPE", "Expected exactly the canonical envelope fields");
    requireThat(keys.every((k2) => {
      const d = Object.getOwnPropertyDescriptor(raw, k2);
      return d.enumerable && Object.hasOwn(d, "value");
    }), "INPUT.JSON", "Expected enumerable JSON fields");
    requireThat(raw.schema === SCHEMA && validId(raw.id) && typeof raw.prototype === "string", "OBJECT.ENVELOPE", "Invalid schema or identity");
    requireThat(record(raw.properties) && record(raw.slots) && record(raw.provenance), "OBJECT.ENVELOPE", "Properties, slots and provenance must be objects");
  }
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
  function copyEnvelope(input, active = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set(), depth = 0) {
    requireThat(depth <= 64 && seen.size < 1e4, "OBJECT.LIMIT", "Object tree limit exceeded");
    validateEnvelope(input);
    requireThat(!active.has(input), "OBJECT.CYCLE", "Containment cycle");
    requireThat(!seen.has(input), "OBJECT.MULTIPLE_PARENTS", "Repeated containment position");
    active.add(input);
    seen.add(input);
    const slots = /* @__PURE__ */ Object.create(null);
    for (const key of jsonKeys(input.slots)) {
      requireThat(!["__proto__", "constructor", "prototype"].includes(key), "INPUT.DANGEROUS_KEY", "Reserved slot key");
      const children = input.slots[key];
      requireThat(Array.isArray(children), "OBJECT.SLOT", "Slot must be an array");
      jsonKeys(children);
      slots[key] = children.map((child) => copyEnvelope(child, active, seen, depth + 1));
    }
    active.delete(input);
    return { schema: input.schema, id: input.id, prototype: input.prototype, properties: clean(input.properties), slots, provenance: clean(input.provenance) };
  }

  // packages/wydclient/src/data.js
  init_validation();
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
    requireThat(record(value) && Object.keys(value).every((k2) => allowed.includes(k2)) && required.every((k2) => Object.hasOwn(value, k2)), "MANIFEST.SHAPE", "Invalid manifest declaration");
  }
  function decode64(value, length) {
    requireThat(typeof value === "string" && /^[A-Za-z0-9+/]*={0,2}$/.test(value), "PACKAGE.ENCODING", "Invalid cryptographic encoding");
    let bytes;
    try {
      bytes = Uint8Array.from(atob(value), (c2) => c2.charCodeAt(0));
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
      let offset2 = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset2);
        offset2 += chunk.byteLength;
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
    const binding = policy.trustedKeys.find((k2) => k2.publisher === ref.publisher && k2.keyId === ref.keyId && k2.status === "active");
    requireThat(binding, "PACKAGE.UNTRUSTED_KEY", "Publisher key is not trusted");
    requireThat(host.crypto?.subtle, "PACKAGE.CRYPTO", "Package verification unavailable");
    const bytes = await download(ref.url, host, policy, signal);
    let digest, key, valid;
    try {
      digest = new Uint8Array(await host.crypto.subtle.digest("SHA-256", bytes));
      requireThat(digest.every((b2, i) => b2 === expected[i]), "PACKAGE.INTEGRITY", "Package integrity mismatch");
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

  // wydgine/controls.js
  init_validation();

  // wydgine/seam/capabilities.js
  var isCapability = (value) => typeof value === "string" && /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(value);

  // wydgine/seam/context.js
  init_validation();
  function validObjectGrant(grant) {
    return typeof grant === "string" && (grant.endsWith("*") ? grant.endsWith("-*") && validId(grant.slice(0, -2)) : validId(grant));
  }
  function matchesObjectGrant(grants, id) {
    if (!validId(id)) return false;
    return grants.some((grant) => validObjectGrant(grant) && (grant === id || grant.endsWith("*") && id.startsWith(grant.slice(0, -1))));
  }
  var contexts = /* @__PURE__ */ new WeakSet();
  var ExecutionContext = class {
    constructor({ publisher, package: packageId = null, self, app = null, scopes = {}, identity: identity2 = null, installation = null, template = null, principal = packageId, capabilities = [], visible = [], editable = [], traversal = [], limits = {} }) {
      requireThat(typeof publisher === "string" && validId(self), "SEAM.CONTEXT", "Context requires publisher and self");
      requireThat(Array.isArray(capabilities) && capabilities.every(isCapability), "SEAM.CAPABILITY", "Invalid capability name");
      requireThat(Array.isArray(visible) && visible.length <= 1e4 && visible.every(validObjectGrant), "SEAM.CONTEXT", "Invalid visible scope");
      requireThat(Array.isArray(editable) && editable.length <= 1e4 && editable.every(validObjectGrant), "SEAM.CONTEXT", "Invalid editable scope");
      requireThat(Array.isArray(traversal) && traversal.every((x2) => ["parent", "root", "children", "previousSibling", "nextSibling"].includes(x2)), "SEAM.CONTEXT", "Invalid traversal permission");
      requireThat(packageId === null || typeof packageId === "string", "SEAM.CONTEXT", "Invalid package identity");
      requireThat(app === null || typeof app === "string", "SEAM.CONTEXT", "Invalid App identity");
      requireThat([installation, template, principal].every((value) => value === null || typeof value === "string" && value.length > 0 && value.length <= 256), "SEAM.CONTEXT", "Invalid service execution identity");
      const scopeData = clean(scopes);
      requireThat(record(scopeData), "SEAM.CONTEXT", "Scopes must be a JSON object");
      const subject = clean(identity2);
      if (subject !== null) {
        const keys = ["authenticated", "app", "userId", "sessionId", "createdAt", "expiresAt", "roles", "groups", "permissions"];
        requireThat(
          record(subject) && Object.keys(subject).every((k2) => [...keys, "membershipId", "membershipStatus", "membershipRole"].includes(k2)) && keys.every((key) => Object.hasOwn(subject, key)) && subject.authenticated === true && subject.app === app && typeof subject.userId === "string" && typeof subject.sessionId === "string" && Number.isSafeInteger(subject.createdAt) && subject.createdAt >= 0 && Number.isSafeInteger(subject.expiresAt) && subject.expiresAt > subject.createdAt && ["roles", "groups", "permissions"].every((key) => Array.isArray(subject[key]) && subject[key].every((value) => typeof value === "string")),
          "SEAM.CONTEXT",
          "Invalid identity metadata"
        );
      }
      if (subject && ["membershipId", "membershipStatus", "membershipRole"].some((k2) => Object.hasOwn(subject, k2))) requireThat(typeof subject.membershipId === "string" && subject.membershipStatus === "active" && ["owner", "administrator", "member"].includes(subject.membershipRole), "SEAM.CONTEXT", "Invalid membership facts");
      const resources = clean(limits);
      requireThat(record(resources) && Object.values(resources).every((n) => Number.isSafeInteger(n) && n >= 0), "SEAM.CONTEXT", "Limits must be non-negative integers");
      Object.assign(this, { publisher, package: packageId, self, app, identity: subject, installation, template, principal, scopes: scopeData, capabilities: [...new Set(capabilities)], visible: [.../* @__PURE__ */ new Set([self, ...visible])], editable: [...new Set(editable)], traversal: [...new Set(traversal)], limits: resources });
      contexts.add(this);
      freeze(this);
    }
    allows(capability) {
      return this.capabilities.includes(capability);
    }
    require(capability) {
      requireThat(this.allows(capability), "SEAM.DENIED", "Capability denied");
    }
  };
  function checkContext(context) {
    requireThat(contexts.has(context), "SEAM.CONTEXT", "Expected host-issued execution context");
  }

  // wydgine/object-model/members.js
  init_validation();
  var bindings = /* @__PURE__ */ new WeakMap();
  function bindMembers(handle, adapter) {
    bindings.set(handle, adapter);
    return handle;
  }
  function memberAdapter(handle, context) {
    const adapter = bindings.get(handle);
    if (adapter && context) requireThat(adapter.context === context, "OBJECT.ACCESS", "Foreign execution handle");
    return adapter;
  }
  var accessOf = (rule) => rule.access ?? "public";
  var discoverable = (rule) => rule.hidden !== true;
  function validateMember(rule) {
    requireThat(record(rule), "PROTOTYPE.ACCESS", "Invalid member rule");
    requireThat(["public", "private", "protected", "friend"].includes(accessOf(rule)), "PROTOTYPE.ACCESS", "Invalid member access");
    requireThat(rule.requires === void 0 || Array.isArray(rule.requires) && rule.requires.every(isCapability), "PROTOTYPE.ACCESS", "Invalid member capability requirements");
    requireThat(rule.hidden === void 0 || typeof rule.hidden === "boolean", "PROTOTYPE.ACCESS", "Invalid member visibility");
  }
  function resolveMember(definition, kind, name4, exact = true) {
    const table = kind === "property" ? definition.properties : definition.methods;
    const rules = kind === "property" ? definition.properties : definition.methodRules;
    const names = exact ? Object.keys(table).filter((k2) => k2 === name4) : Object.keys(table).filter((k2) => k2.toLowerCase() === name4.toLowerCase() && discoverable(rules[k2] ?? {}));
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
  function readMember(handle, registry, name4, exact, caller, context) {
    const adapter = memberAdapter(handle, context);
    requireThat(adapter, "OBJECT.ACCESS", "Member adapter unavailable");
    const node = adapter.node(), member = resolveMember(registry.get(node.prototype), "property", name4, exact);
    authorizeMember(registry, member, caller, context);
    return freeze(clean(adapter.read ? adapter.read(member.name) : node.properties[member.name]));
  }
  function writeMember(handle, registry, name4, value, exact, caller, context) {
    const adapter = memberAdapter(handle, context);
    requireThat(adapter?.set, "OBJECT.ACCESS", "Member adapter unavailable");
    const member = resolveMember(registry.get(adapter.node().prototype), "property", name4, exact);
    authorizeMember(registry, member, caller, context);
    return adapter.set(member.name, value);
  }

  // wydgine/object-model/forms.js
  init_validation();
  var sensitive = (type, registry) => registry.isA(type, "wydgit.core/password-input");
  function fieldKind(type, registry) {
    return ["hidden-input", "password-input", "text-area", "checkbox", "radio-group", "checkbox-group", "select", "text-input"].find((k2) => registry.isA(type, `wydgit.core/${k2}`)) ?? "text-input";
  }
  function emptyValue(kind, p) {
    return kind === "checkbox" ? false : kind === "checkbox-group" || kind === "select" && p.multiple ? [] : ["radio-group", "select"].includes(kind) ? null : "";
  }
  function fieldValidation(kind, p) {
    const v = p.value, multi = kind === "checkbox-group" || kind === "select" && p.multiple;
    const choice = ["radio-group", "checkbox-group", "select"].includes(kind);
    let message = "";
    if (kind === "checkbox" ? typeof v !== "boolean" : choice ? multi ? !Array.isArray(v) || v.some((x2) => typeof x2 !== "string") || new Set(v).size !== v.length : v !== null && typeof v !== "string" : typeof v !== "string") message = "Invalid value type";
    else if (choice && (multi ? v : v === null ? [] : [v]).some((x2) => !p.options.some((o) => o.value === x2 && o.enabled))) message = "Invalid selection";
    else if (p.required && (kind === "checkbox" ? !v : multi ? v.length === 0 : typeof v === "string" ? !v.trim() : v === null)) message = "Required";
    else if (typeof v === "string" && p.maxLength != null && Array.from(v).length > p.maxLength) message = "Character limit exceeded";
    return { valid: !message, validationMessage: message, errors: message ? [message] : [], warnings: [] };
  }
  function fieldConfiguration(p) {
    requireThat(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(p.name) && !["constructor", "prototype"].includes(p.name), "FORM.NAME", "Invalid field name");
    requireThat(p.maxLength == null || Number.isSafeInteger(p.maxLength) && p.maxLength >= 0, "FORM.CONFIG", "Invalid character limit");
    if (p.options) {
      const seen = /* @__PURE__ */ new Set();
      for (const o of p.options) {
        requireThat(o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length === 3 && typeof o.value === "string" && o.value.length > 0 && typeof o.label === "string" && typeof o.enabled === "boolean" && !seen.has(o.value), "FORM.OPTIONS", "Invalid options");
        seen.add(o.value);
      }
    }
  }
  function descendantFields(runtime, registry, id, context) {
    const out = [];
    let count = 0;
    const walk = (id2) => {
      requireThat(++count <= Math.min(1e4, context?.limits.formNodes ?? 1e4), "FORM.LIMIT", "Field traversal limit");
      if (context) requireThat(matchesObjectGrant(context.visible, id2), "SEAM.VISIBILITY", "Invisible Form descendant");
      const n = runtime.get(id2);
      if (registry.isA(n.prototype, "wydgit.core/field")) out.push(n);
      for (const key of Object.keys(n.slots).sort()) n.slots[key].forEach(walk);
    };
    walk(id);
    return out;
  }
  function formOperation(fields2, registry, operation2, data, set) {
    requireThat(["validate", "isValid", "values", "bind", "clear"].includes(operation2), "FORM.OPERATION", "Unknown Form operation");
    const names = /* @__PURE__ */ new Set();
    for (const f of fields2) {
      fieldConfiguration(f.properties);
      requireThat(!names.has(f.properties.name), "FORM.NAME", "Duplicate field name");
      names.add(f.properties.name);
    }
    if (operation2 === "values") {
      const out = /* @__PURE__ */ Object.create(null);
      for (const f of fields2) if (!sensitive(f.prototype, registry) && ["name", "value"].every((name4) => Object.hasOwn(publicProperties(f, registry), name4))) out[f.properties.name] = clean(f.properties.value);
      return out;
    }
    if (operation2 === "isValid") return fields2.every((f) => f.properties.valid);
    if (operation2 === "bind") {
      const input = clean(data);
      requireThat(input && !Array.isArray(input) && typeof input === "object", "FORM.BIND", "Expected binding object");
      requireThat(Object.keys(input).every((k2) => names.has(k2)), "FORM.BIND", "Unknown binding key");
      const updates = fields2.filter((f) => Object.hasOwn(input, f.properties.name)).map((f) => {
        const value = input[f.properties.name], p = { ...f.properties, value };
        const result = fieldValidation(fieldKind(f.prototype, registry), p);
        requireThat(!["Invalid value type", "Invalid selection"].includes(result.validationMessage), "FORM.BIND", "Incompatible field value");
        return [f.id, { value }];
      });
      updates.forEach(([id, p]) => set(id, p));
      return null;
    }
    if (operation2 === "clear") {
      fields2.forEach((f) => set(f.id, { value: emptyValue(fieldKind(f.prototype, registry), f.properties), valid: true, validationMessage: "", errors: [], warnings: [] }));
      return null;
    }
    let valid = true;
    for (const f of fields2) {
      const result = fieldValidation(fieldKind(f.prototype, registry), f.properties);
      set(f.id, result);
      valid &&= result.valid;
    }
    return valid;
  }
  function formTree(raw, registry, inside = false) {
    const form = registry.isA(raw.prototype, "wydgit.core/form");
    requireThat(!(inside && form), "FORM.NESTED", "Nested Forms are forbidden");
    if (registry.isA(raw.prototype, "wydgit.core/field") && raw.properties.name !== void 0) fieldConfiguration(raw.properties);
    Object.values(raw.slots).flat().forEach((child) => formTree(child, registry, inside || form));
    if (form) {
      const names = /* @__PURE__ */ new Set();
      const walk = (n) => {
        if (registry.isA(n.prototype, "wydgit.core/field")) {
          requireThat(!names.has(n.properties.name), "FORM.NAME", "Duplicate field name");
          names.add(n.properties.name);
        }
        Object.values(n.slots).flat().forEach(walk);
      };
      walk(raw);
    }
  }
  function publicProperties(node, registry) {
    const rules = registry.get(node.prototype).properties;
    return Object.freeze(Object.fromEntries(Object.entries(node.properties).filter(([name4]) => (rules[name4].access ?? "public") === "public" && rules[name4].hidden !== true && !rules[name4].requires?.length).map(([name4, value]) => [name4, name4 === "value" && sensitive(node.prototype, registry) ? "" : value])));
  }

  // wydgine/sewn/operations.js
  init_validate();
  init_schema();

  // wydgine/sewn/types.js
  init_validate();
  init_schema();
  var brands = /* @__PURE__ */ new WeakMap();
  var make = (type, value) => {
    const token = Object.freeze(Object.assign(/* @__PURE__ */ Object.create(null), { type, value }));
    brands.set(token, { type, value });
    return token;
  };
  var brand = (value) => value && typeof value === "object" ? brands.get(value) : void 0;
  function descriptor(type) {
    ensure(contractTypes.includes(type), "TYPE");
    return make("DataType", type);
  }
  function dateTime(text) {
    ensure(typeof text === "string" && /^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text), "TYPE");
    const ms = Date.parse(text);
    ensure(Number.isInteger(ms) && Math.abs(ms) <= 864e13 && new Date(ms).toISOString() === text, "TYPE");
    return make("DateTime", ms);
  }
  function observable(value) {
    const typed = brand(value);
    if (typed) return typed.type;
    return value === null ? "Null" : Array.isArray(value) ? "Array" : typeof value === "number" ? (ensure(Number.isFinite(value), "TYPE"), Number.isSafeInteger(value) ? "Integer" : "Float") : { string: "String", boolean: "Boolean", object: "Object" }[typeof value];
  }
  function contract(value, type) {
    const actual = observable(value);
    ensure(type === "Scalar" ? ["String", "Integer", "Float", "Boolean", "DateTime"].includes(actual) : actual === type, "TYPE");
    return value;
  }
  var external = (value) => brand(value)?.type === "DateTime" ? new Date(brand(value).value).toISOString() : brand(value)?.type === "DataType" ? { schema: "sewn.type/0.11", type: brand(value).value } : value;

  // wydgine/sewn/numeric.js
  init_validate();
  function numericCheck(value, type) {
    ensure(typeof value === "number" && (type === "Integer" ? Number.isSafeInteger(value) : Number.isFinite(value)), "TYPE");
    return value;
  }
  function numeric(operator, a, b2, type) {
    numericCheck(a, "Float");
    numericCheck(b2, "Float");
    const integers = Number.isSafeInteger(a) && Number.isSafeInteger(b2);
    const integerOnly = ["MOD", "\\"].includes(operator);
    const exact = integers && (integerOnly || type !== "Float" && (["+", "-", "*"].includes(operator) || operator === "^" && b2 >= 0));
    if (integerOnly) ensure(integers && b2 !== 0, "TYPE");
    if (exact) {
      const x2 = BigInt(a), y2 = BigInt(b2);
      let v2;
      if (operator === "^") {
        if (a === 0) {
          v2 = b2 === 0 ? 1n : 0n;
        } else if (a === 1) v2 = 1n;
        else if (a === -1) v2 = b2 % 2 === 0 ? 1n : -1n;
        else {
          ensure(b2 <= 53, "TYPE");
          v2 = x2 ** y2;
        }
      } else v2 = operator === "+" ? x2 + y2 : operator === "-" ? x2 - y2 : operator === "*" ? x2 * y2 : operator === "MOD" ? x2 % y2 : x2 / y2;
      ensure(v2 >= -9007199254740991n && v2 <= 9007199254740991n, "TYPE");
      return operator === "MOD" && v2 === 0n && (a < 0 || Object.is(a, -0)) ? -0 : Number(v2);
    }
    ensure(type !== "Integer" || integers, "TYPE");
    const v = operator === "+" ? a + b2 : operator === "-" ? a - b2 : operator === "*" ? a * b2 : operator === "/" ? a / b2 : operator === "^" ? a ** b2 : NaN;
    numericCheck(v, type === "Integer" ? "Integer" : "Float");
    return v;
  }

  // wydgine/sewn/operations.js
  function canonicalConvert(value, type) {
    const typed = brand(value);
    if (type === "String") {
      if (typed) {
        ensure(typed.type === "DateTime", "TYPE");
        return external(value);
      }
      ensure(["string", "boolean", "number"].includes(typeof value), "TYPE");
      if (typeof value === "number") numericCheck(value, "Float");
      return typeof value === "boolean" ? value ? "True" : "False" : String(value);
    }
    if (type === "DateTime") {
      if (typed) {
        ensure(typed.type === "DateTime", "TYPE");
        return value;
      }
      return dateTime(value);
    }
    ensure(!typed, "TYPE");
    if (type === "Boolean") {
      ensure(typeof value === "boolean" || value === "True" || value === "False", "TYPE");
      return typeof value === "boolean" ? value : value === "True";
    }
    ensure(typeof value === "number" || typeof value === "string", "TYPE");
    if (typeof value === "string") {
      ensure(/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(value), "TYPE");
      const [mantissa, exponent = "0"] = value.toLowerCase().split("e");
      const digits = mantissa.replace(/[+.-]/g, ""), fraction = (mantissa.split(".")[1] ?? "").length;
      const shift = Number(exponent) - fraction;
      const nonzero = digits.replace(/^0+/, "");
      const integral = !nonzero || shift >= 0 || -shift <= digits.length && /^0*$/.test(digits.slice(digits.length + shift));
      const number = Number(value);
      numericCheck(number, "Float");
      ensure(!nonzero || number !== 0, "TYPE");
      ensure(!Number.isInteger(number) || integral, "TYPE");
      ensure(!integral || Number.isSafeInteger(number), "TYPE");
      value = number;
    }
    numericCheck(value, type === "Integer" ? "Integer" : "Float");
    return value;
  }
  function operation(name4, args, bounds, tick) {
    operationSignatures[name4].forEach((type, i) => type === "String" ? ensure(typeof args[i] === "string", "TYPE") : numericCheck(args[i], type === "Integer" ? "Integer" : "Float"));
    const [a, b2, c2] = args, limit = (n) => ensure(Number.isSafeInteger(n) && n >= 0 && n <= bounds.string, "LIMIT");
    if (typeof a === "string") {
      limit(a.length);
      switch (name4) {
        case "Length":
          return a.length;
        case "Substring":
          ensure(b2 >= 0 && c2 >= 0 && b2 <= a.length && c2 <= a.length - b2, "TYPE");
          return a.slice(b2, b2 + c2);
        case "IndexOf":
          return a.indexOf(b2);
        case "LastIndexOf":
          return a.lastIndexOf(b2);
        case "StartsWith":
          return a.startsWith(b2);
        case "EndsWith":
          return a.endsWith(b2);
        case "Contains":
          return a.includes(b2);
        case "Trim":
          return a.trim();
        case "TrimStart":
          return a.trimStart();
        case "TrimEnd":
          return a.trimEnd();
        case "Repeat":
          ensure(b2 >= 0, "TYPE");
          limit(a.length * b2);
          return a.repeat(a.length === 0 ? 0 : b2);
        case "Replace": {
          ensure(b2.length > 0, "TYPE");
          let count = 0, pos = 0, next;
          while ((next = a.indexOf(b2, pos)) !== -1) {
            tick();
            count++;
            pos = next + b2.length;
          }
          limit(a.length + count * (c2.length - b2.length));
          return a.split(b2).join(c2);
        }
        case "ToUpper":
        case "ToLower": {
          let size = 0, work = 0;
          for (const ch of a) {
            if (++work % 64 === 0) tick();
            size += (name4 === "ToUpper" ? ch.toUpperCase() : ch.toLowerCase()).length;
            limit(size);
          }
          const result2 = name4 === "ToUpper" ? a.toUpperCase() : a.toLowerCase();
          limit(result2.length);
          return result2;
        }
      }
    }
    let result;
    switch (name4) {
      case "Abs":
        result = Math.abs(a);
        break;
      case "Floor":
        result = Math.floor(a);
        break;
      case "Ceiling":
        result = Math.ceil(a);
        break;
      case "Truncate":
        result = Math.trunc(a);
        break;
      case "Min":
        result = Math.min(a, b2);
        break;
      case "Max":
        result = Math.max(a, b2);
        break;
      case "Power":
        return numeric("^", a, b2, "Auto");
      case "Sqrt":
        result = Math.sqrt(a);
        break;
      case "Sign":
        result = Math.sign(a);
        break;
      case "Round": {
        ensure(b2 >= 0 && b2 <= 15, "TYPE");
        const [coefficient, exp = "0"] = Math.abs(a).toString().split("e");
        const fraction = (coefficient.split(".")[1] ?? "").length;
        const digits = BigInt(coefficient.replace(".", "")), shift = Number(exp) - fraction + b2;
        if (shift >= 0) result = a;
        else {
          const divisor = 10n ** BigInt(-shift), rounded = digits / divisor + (digits % divisor * 2n >= divisor ? 1n : 0n);
          result = Number(`${a < 0 ? "-" : ""}${rounded}e-${b2}`);
        }
        break;
      }
    }
    numericCheck(result, "Float");
    if (Number.isSafeInteger(a) && args.every(Number.isSafeInteger) && !["Sqrt"].includes(name4)) numericCheck(result, "Integer");
    return result === 0 ? 0 : result;
  }
  function collectionOperation(name4, args, bounds, tick, compare) {
    const [a, b2, c2] = args;
    const string = (v) => ensure(typeof v === "string", "TYPE");
    const array = (v) => ensure(Array.isArray(v), "TYPE");
    const index = (v) => {
      numericCheck(v, "Integer");
      ensure(v >= 0, "TYPE");
    };
    const comparable = (v) => ensure(brand(v) || v === null || ["string", "number", "boolean"].includes(typeof v), "TYPE");
    const elements = (n) => ensure(n + 1 <= bounds.valueNodes, "LIMIT");
    if (["Length", "Contains", "IndexOf"].includes(name4)) {
      if (typeof a === "string") return operation(name4, args, bounds, tick);
      array(a);
      if (name4 === "Length") return a.length;
      comparable(b2);
      for (const item of a) {
        tick();
        comparable(item);
      }
      for (let i = 0; i < a.length; i++) {
        tick();
        if (compare(a[i], b2, "=")) return name4 === "Contains" ? true : i;
      }
      return name4 === "Contains" ? false : -1;
    }
    if (name4 === "Slice") {
      array(a);
      index(b2);
      index(c2);
      const start = Math.min(b2, a.length), length = Math.min(c2, a.length - start);
      elements(length);
      return a.slice(start, start + length);
    }
    if (name4 === "Join") {
      array(a);
      string(b2);
      let size = 0;
      for (let i = 0; i < a.length; i++) {
        tick();
        string(a[i]);
        size += a[i].length + (i ? b2.length : 0);
        ensure(size <= bounds.string, "LIMIT");
      }
      return a.join(b2);
    }
    string(a);
    string(b2);
    let count = b2 === "" ? a.length : 1;
    if (b2 !== "") {
      let position = 0, next;
      while ((next = a.indexOf(b2, position)) !== -1) {
        tick();
        count++;
        elements(count);
        position = next + b2.length;
      }
    }
    elements(count);
    return a.split(b2);
  }

  // wydgine/controls.js
  var CONTROL_SCHEMA2 = "wydgit.presentation/0.2";
  var name2 = (v) => typeof v === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v) && !["constructor", "prototype", "__proto__"].includes(v.toLowerCase());
  var shape2 = (v, keys, required = []) => requireThat(record(v) && Object.keys(v).every((k2) => keys.includes(k2)) && required.every((k2) => Object.hasOwn(v, k2)), "CONTROL.INVALID", "Invalid semantic control metadata");
  var wellFormed = (value) => typeof value === "string" && [...value].every((c2) => {
    const n = c2.codePointAt(0);
    return n < 55296 || n > 57343;
  });
  var scalar = (v) => v === null || ["string", "boolean", "number"].includes(typeof v);
  function controlValue(value) {
    requireThat(scalar(value) || record(value) && Object.keys(value).length === 1 && typeof value.get === "string" && /^properties\.[A-Za-z][A-Za-z0-9_]*$/.test(value.get), "CONTROL.INVALID", "Expected scalar literal or exact property binding");
  }
  function validateControls(spec) {
    requireThat(JSON.stringify(spec).length <= 65536, "CONTROL.LIMIT", "Presentation size exceeded");
    shape2(spec, ["schema", "target", "template"], ["schema", "target", "template"]);
    requireThat(spec.schema === CONTROL_SCHEMA2 && spec.target === "client", "CONTROL.TARGET", "Semantic controls require explicit client target");
    const identities = /* @__PURE__ */ new Set();
    let count = 0, fields2 = 0;
    const walk = (n, depth = 0, form = null) => {
      requireThat(depth <= 16 && ++count <= 256, "CONTROL.LIMIT", "Control presentation bound");
      if (n.tag) {
        shape2(n, ["tag", "text", "children"], ["tag"]);
        requireThat(["section", "div", "p", "span", "h2", "h3", "strong", "ul", "ol", "li"].includes(n.tag), "CONTROL.INVALID", "Unsupported structure");
        if (Object.hasOwn(n, "text")) controlValue(n.text);
      } else {
        shape2(n, ["control", "name", "label", "value", "type", "required", "maxLength", "options", "action", "children", "reset"], ["control", "name", "label"]);
        requireThat(name2(n.name) && !identities.has(n.name) && wellFormed(n.label) && n.label.length > 0 && n.label.length <= 256, "CONTROL.IDENTITY", "Invalid control name or label");
        identities.add(n.name);
        requireThat(["label", "status", "button", "form", "text", "textarea", "checkbox", "select", "submit", "reset"].includes(n.control), "CONTROL.INVALID", "Unknown control");
        if (n.control === "form") {
          requireThat(!form, "CONTROL.INVALID", "Nested forms are unsupported");
          form = /* @__PURE__ */ new Set();
          requireThat(["success", "manual"].includes(n.reset ?? "success"), "CONTROL.INVALID", "Invalid reset policy");
        }
        if (["text", "textarea", "checkbox", "select"].includes(n.control)) {
          requireThat(form && ++fields2 <= 64 && !form.has(n.name), "CONTROL.INVALID", "Fields need a form and unique names");
          form.add(n.name);
          requireThat(["String", "Boolean", "Integer", "Float"].includes(n.type) && typeof n.required === "boolean" && Number.isSafeInteger(n.maxLength) && n.maxLength >= 1 && n.maxLength <= 4096, "CONTROL.INVALID", "Field requires explicit bounded value contract");
          requireThat(n.control === "checkbox" ? n.type === "Boolean" : n.control === "select" || n.control === "textarea" ? n.type === "String" : n.type !== "Boolean", "CONTROL.INVALID", "Incompatible control value type");
          if (n.control === "select") requireThat(Array.isArray(n.options) && n.options.length > 0 && n.options.length <= 64 && new Set(n.options).size === n.options.length && n.options.every((o) => wellFormed(o) && o.length > 0 && o.length <= 128), "CONTROL.INVALID", "Invalid finite options");
          else requireThat(n.options === void 0, "CONTROL.INVALID", "Options only belong to selects");
          if (n.value !== void 0) {
            controlValue(n.value);
            if (!record(n.value)) {
              requireThat(n.type === "Boolean" ? typeof n.value === "boolean" : n.type === "String" ? wellFormed(n.value) : ["number", "string"].includes(typeof n.value), "CONTROL.TYPE", "Invalid initial field type");
              if (["Integer", "Float"].includes(n.type)) canonicalConvert(n.value, n.type);
            }
          }
        } else requireThat(["type", "required", "maxLength", "options"].every((k2) => n[k2] === void 0), "CONTROL.INVALID", "Unexpected field contract");
        if (["form", "button"].includes(n.control)) {
          shape2(n.action, ["method"], ["method"]);
          requireThat(name2(n.action.method), "CONTROL.ACTION", "Explicit method action required");
        } else requireThat(n.action === void 0, "CONTROL.ACTION", "Unexpected action binding");
        if (["submit", "reset"].includes(n.control)) requireThat(form, "CONTROL.INVALID", "Submit/reset require a form");
        if (["label", "status"].includes(n.control) && n.value !== void 0) controlValue(n.value);
        requireThat(n.children === void 0 || n.control === "form", "CONTROL.INVALID", "Only forms contain controls");
        if (["button", "form", "submit", "reset"].includes(n.control)) requireThat(n.value === void 0, "CONTROL.INVALID", "This control cannot bind a value");
        if (n.control !== "form") requireThat(n.reset === void 0, "CONTROL.INVALID", "Reset policy belongs to form");
      }
      requireThat(n.children === void 0 || Array.isArray(n.children), "CONTROL.INVALID", "Invalid control children");
      for (const child of n.children ?? []) walk(child, depth + 1, form);
    };
    walk(spec.template);
    return spec;
  }
  function controlNodes(spec) {
    const out = [];
    const walk = (n) => {
      if (n.control) out.push(n);
      for (const c2 of n.children ?? []) walk(c2);
    };
    walk(spec.template);
    return out;
  }
  function validateControlBindings(d, registry) {
    if (d.presentation?.schema !== CONTROL_SCHEMA2) return;
    validateControls(d.presentation);
    const visit = (n) => {
      try {
        for (const v of [n.text, n.value].filter((v2) => record(v2))) {
          const member = resolveMember(d, "property", v.get.slice(11), true);
          requireThat(accessOf(member.rule) === "public" && !member.rule.hidden && !member.rule.requires?.length && ["string", "number", "boolean"].includes(member.rule.type), "CONTROL.ACCESS", "Display bindings require public scalar properties");
          if (n.type) requireThat(member.rule.type === { String: "string", Boolean: "boolean", Integer: "number", Float: "number" }[n.type], "CONTROL.TYPE", "Initial field binding type differs");
        }
        if (n.action) {
          const resolved = registry.method(d.id, n.action.method, null, false), proc = resolved.behavior.procedures[resolved.name];
          requireThat(accessOf(d.methodRules[resolved.name] ?? {}) === "public" && !d.methodRules[resolved.name]?.hidden && proc.kind === "sub" && proc.params.length === (n.control === "form" ? 1 : 0) && (n.control !== "form" || proc.params[0].type === "Object"), "CONTROL.ACTION", "Action requires a public SUB with the declared payload signature");
        }
        for (const c2 of n.children ?? []) visit(c2);
      } catch (error) {
        if (error instanceof WydgitError && !error.details.definition) throw new WydgitError(error.code, error.message, { ...error.details, definition: d.id, member: n.control ? "control:" + n.name : "presentation" });
        throw error;
      }
    };
    visit(d.presentation.template);
  }
  function controlRecord(form, raw, tick = () => {
  }) {
    requireThat(record(raw), "CONTROL.INPUT", "Expected a field record");
    const fields2 = controlNodes({ template: form }).filter((n) => ["text", "textarea", "checkbox", "select"].includes(n.control));
    requireThat(Object.keys(raw).length === fields2.length && Object.keys(raw).every((key) => fields2.some((f) => f.name === key)), "CONTROL.INPUT", "Unexpected or missing form fields");
    const result = /* @__PURE__ */ Object.create(null);
    for (const f of fields2) {
      tick();
      const value = raw[f.name];
      if (f.type === "Boolean") requireThat(typeof value === "boolean", "CONTROL.INPUT", "Invalid checkbox value");
      else requireThat(wellFormed(value) && value.length <= 8192 && [...value].length <= f.maxLength, "CONTROL.INPUT", "Invalid or overlong text");
      const rule = { value, required: f.required, maxLength: f.maxLength, options: (f.options ?? []).map((v) => ({ value: v, label: v, enabled: true })) };
      const validation = fieldValidation(f.control === "checkbox" ? "checkbox" : f.control === "select" ? "select" : "text-input", rule);
      requireThat(validation.valid, "CONTROL.INPUT", `${f.label}: ${validation.validationMessage}`);
      try {
        result[f.name] = ["Integer", "Float"].includes(f.type) ? canonicalConvert(value, f.type) : value;
      } catch {
        requireThat(false, "CONTROL.INPUT", `${f.label}: Invalid number`);
      }
    }
    return clean(result);
  }

  // wydgine/object-model/mutation.js
  init_validation();
  function createEdit(original, context, registry, hydrate2, dehydrate2) {
    checkContext(context);
    const authorize = (ids) => {
      requireThat(context.capabilities.includes("object.instances.edit") && ids.every((id) => matchesObjectGrant(context.visible, id) && matchesObjectGrant(context.editable, id)), "MUTATION.DENIED", "Mutation denied");
    };
    authorize([]);
    original.get(context.self);
    const baseRevision = original.revision;
    let working = dehydrate2(original, { includeSensitive: true }), closed = false;
    const index = (root) => {
      const entries2 = /* @__PURE__ */ new Map();
      const visit = (node, parent = null, slot = null, position = 0) => {
        entries2.set(node.id, { node, parent, slot, position });
        for (const [key, children] of Object.entries(node.slots)) children.forEach((child, i) => visit(child, node.id, key, i));
      };
      visit(root);
      return entries2;
    };
    const initial = index(working), reserved = new Set(initial.keys()), explicitMoves = /* @__PURE__ */ new Set();
    const open = () => requireThat(!closed, "MUTATION.CLOSED", "Edit session is closed");
    const get = (entries2, id) => {
      authorize([id]);
      requireThat(entries2.has(id), "MUTATION.NOT_FOUND", "Object not found");
      return entries2.get(id);
    };
    const subtree = (node) => {
      const ids = [node.id];
      for (const children of Object.values(node.slots)) for (const child of children) ids.push(...subtree(child));
      return ids;
    };
    const slotAt = (entries2, parentId, name4) => {
      const parent = get(entries2, parentId).node;
      requireThat(typeof name4 === "string" && Object.hasOwn(parent.slots, name4), "MUTATION.INVALID_SLOT", "Unknown slot");
      authorize(parent.slots[name4].map((child) => child.id));
      return parent.slots[name4];
    };
    const positionAt = (children, position) => requireThat(Number.isInteger(position) && position >= 0 && position <= children.length, "MUTATION.INDEX", "Invalid child position");
    const removable = (entries2, id) => {
      const entry = get(entries2, id);
      requireThat(entry.parent !== null, "MUTATION.IDENTITY", "App root cannot be removed or reparented");
      slotAt(entries2, entry.parent, entry.slot);
      authorize([entry.parent, ...subtree(entry.node)]);
      return entry;
    };
    const validated2 = (root) => {
      try {
        return hydrate2(root, registry, { revision: baseRevision });
      } catch (error) {
        const codes = { "OBJECT.PROPERTY": "MUTATION.INVALID_PROPERTY", "OBJECT.UNKNOWN_SLOT": "MUTATION.INVALID_SLOT", "OBJECT.SLOT": "MUTATION.INVALID_SLOT", "OBJECT.CHILD_TYPE": "MUTATION.CHILD_TYPE", "OBJECT.CARDINALITY": "MUTATION.CARDINALITY", "OBJECT.DUPLICATE_ID": "MUTATION.DUPLICATE_ID", "OBJECT.CYCLE": "MUTATION.CYCLE" };
        if (error instanceof WydgitError && codes[error.code]) throw new WydgitError(codes[error.code], error.message);
        throw error;
      }
    };
    const apply = (operation2) => {
      open();
      const candidate = dehydrate2(validated2(working), { includeSensitive: true });
      operation2(candidate, index(candidate));
      const next = dehydrate2(validated2(candidate), { includeSensitive: true });
      const ids = [...index(next).keys()];
      working = next;
      ids.forEach((id) => reserved.add(id));
    };
    const fresh = (entries2, parentId, slot, position, envelope, replaceId) => {
      const children = slotAt(entries2, parentId, slot);
      positionAt(children, position);
      const incoming = copyEnvelope(envelope);
      const ids = subtree(incoming);
      authorize(ids);
      for (const id of ids) requireThat(!reserved.has(id), "MUTATION.DUPLICATE_ID", "Instance ID is reserved in this session");
      children.splice(position, replaceId ? 1 : 0, incoming);
    };
    const changes = () => {
      const current = index(working);
      const local2 = (entry) => JSON.stringify({ properties: entry.node.properties, slots: Object.fromEntries(Object.entries(entry.node.slots).map(([key, children]) => [key, children.map((c2) => c2.id)])) });
      const result = { added: [], modified: [], moved: [], removed: [] };
      for (const [id, entry] of current) {
        if (!initial.has(id)) result.added.push(id);
        else {
          const before = initial.get(id);
          if (local2(before) !== local2(entry)) result.modified.push(id);
          if (explicitMoves.has(id) && (before.parent !== entry.parent || before.slot !== entry.slot || before.position !== entry.position)) result.moved.push(id);
        }
      }
      for (const id of initial.keys()) if (!current.has(id)) result.removed.push(id);
      Object.values(result).forEach((ids) => ids.sort());
      return freeze(result);
    };
    const property = (id, name4, value, remove) => apply((_root, entries2) => {
      const node = get(entries2, id).node;
      requireThat(typeof name4 === "string" && !["id", "prototype", "schema", "provenance", "slots"].includes(name4), "MUTATION.IDENTITY", "Envelope identity and metadata are not editable properties");
      requireThat(!["__proto__", "constructor"].includes(name4), "INPUT.DANGEROUS_KEY", "Reserved property key");
      requireThat(Object.hasOwn(registry.get(node.prototype).properties, name4), "MUTATION.INVALID_PROPERTY", "Unknown property");
      if (remove) delete node.properties[name4];
      else node.properties[name4] = clean(value);
    });
    const edit = {
      baseRevision,
      setProperty(id, name4, value) {
        property(id, name4, value, false);
      },
      resetProperty(id, name4) {
        property(id, name4, void 0, true);
      },
      insertChild(parentId, slot, position, envelope) {
        apply((_root, entries2) => {
          fresh(entries2, parentId, slot, position, envelope);
        });
      },
      remove(id) {
        apply((_root, entries2) => {
          const entry = removable(entries2, id);
          entries2.get(entry.parent).node.slots[entry.slot].splice(entry.position, 1);
        });
      },
      moveChild(id, parentId, slot, position) {
        apply((_root, entries2) => {
          const entry = removable(entries2, id);
          requireThat(!subtree(entry.node).includes(parentId), "MUTATION.CYCLE", "Cannot move an object into its subtree");
          const children = slotAt(entries2, parentId, slot);
          entries2.get(entry.parent).node.slots[entry.slot].splice(entry.position, 1);
          positionAt(children, position);
          children.splice(position, 0, entry.node);
        });
        explicitMoves.add(id);
      },
      replaceChild(id, envelope) {
        apply((_root, entries2) => {
          const entry = removable(entries2, id);
          fresh(entries2, entry.parent, entry.slot, entry.position, envelope, id);
        });
      },
      cloneChild(id, parentId, slot, position, idPairs) {
        open();
        const entry = get(index(working), id);
        authorize(subtree(entry.node));
        const pairs = clean(idPairs);
        requireThat(Array.isArray(pairs) && pairs.every((pair) => Array.isArray(pair) && pair.length === 2 && validId(pair[0]) && validId(pair[1])), "MUTATION.IDENTITY", "Expected old/new ID pairs");
        const mapping = new Map(pairs);
        const ids = subtree(entry.node);
        requireThat(pairs.length === ids.length && mapping.size === ids.length && ids.every((old) => mapping.has(old)), "MUTATION.IDENTITY", "Clone requires a complete valid ID map");
        const copy = JSON.parse(JSON.stringify(entry.node));
        for (const { node } of index(copy).values()) node.id = mapping.get(node.id);
        edit.insertChild(parentId, slot, position, copy);
      },
      changes() {
        open();
        return changes();
      },
      commit({ currentRevision = baseRevision } = {}) {
        open();
        requireThat(currentRevision === baseRevision, "MUTATION.CONFLICT", "Base revision does not match current revision");
        requireThat(baseRevision < Number.MAX_SAFE_INTEGER, "MUTATION.CONFLICT", "Revision exhausted");
        const runtime = hydrate2(working, registry, { revision: baseRevision + 1 });
        const result = Object.freeze({ runtime, baseRevision, revision: runtime.revision, changes: changes() });
        closed = true;
        return result;
      },
      abort() {
        open();
        closed = true;
      }
    };
    return Object.freeze(edit);
  }

  // wydgine/object-model/index.js
  init_validation();

  // wydgine/object-model/component-contracts.js
  init_validation();
  var name3 = (n) => typeof n === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n) && !["constructor", "prototype", "__proto__"].includes(n.toLowerCase());
  var shape3 = (v, keys) => record(v) && Object.keys(v).every((k2) => keys.includes(k2));
  function componentContract(d, base) {
    if (d.component === void 0) return base?.component;
    const c2 = clean(d.component);
    requireThat(!d.static && shape3(c2, ["schema", "children", "subscriptions", "templates", "repeaters"]) && c2.schema === "wydgit.component/0.20" && Array.isArray(c2.children) && Array.isArray(c2.subscriptions) && c2.children.length <= 256 && c2.subscriptions.length <= 64, "PROTOTYPE.COMPONENT", "Invalid component contract");
    requireThat((c2.templates === void 0 || Array.isArray(c2.templates)) && (c2.repeaters === void 0 || Array.isArray(c2.repeaters)) && c2.subscriptions.every((b2) => shape3(b2, ["source", "event", "handler"]) && Object.keys(b2).length === 3), "PROTOTYPE.COMPONENT", "Invalid component declarations");
    const children = [...base?.component?.children ?? [], ...c2.children], subscriptions = [...base?.component?.subscriptions ?? [], ...c2.subscriptions.map((b2) => ({ ...b2, owner: d.id }))], names = /* @__PURE__ */ new Set();
    for (const child of children) {
      requireThat(shape3(child, ["name", "type", "slot", "properties"]) && Object.keys(child).length === 4 && name3(child.name) && typeof child.type === "string" && typeof child.slot === "string" && record(child.properties) && !names.has(child.name.toLowerCase()), "PROTOTYPE.COMPONENT", "Invalid named child");
      names.add(child.name.toLowerCase());
    }
    for (const binding of subscriptions) requireThat(shape3(binding, ["source", "event", "handler", "owner"]) && Object.keys(binding).length === 4 && typeof binding.source === "string" && name3(binding.event) && name3(binding.handler), "PROTOTYPE.COMPONENT", "Invalid event binding");
    const templates = [...base?.component?.templates ?? [], ...c2.templates ?? []], repeaters = [...base?.component?.repeaters ?? [], ...c2.repeaters ?? []], templateNames = /* @__PURE__ */ new Set();
    requireThat(templates.length <= 16 && repeaters.length <= 16 && Array.isArray(c2.templates ?? []) && Array.isArray(c2.repeaters ?? []), "PROTOTYPE.COMPONENT", "Invalid template collections");
    for (const t of templates) {
      requireThat(shape3(t, ["name", "type", "model", "key", "bindings"]) && Object.keys(t).length === 5 && name3(t.name) && typeof t.type === "string" && typeof t.model === "string" && name3(t.key) && Array.isArray(t.bindings) && t.bindings.length <= 64 && !templateNames.has(t.name.toLowerCase()), "PROTOTYPE.COMPONENT", "Invalid child template");
      templateNames.add(t.name.toLowerCase());
      for (const b2 of t.bindings) requireThat(shape3(b2, ["property", "input"]) && Object.keys(b2).length === 2 && name3(b2.property) && name3(b2.input), "PROTOTYPE.COMPONENT", "Invalid template binding");
    }
    for (const r of repeaters) if (!(shape3(r, ["template", "property", "slot", "limit"]) && Object.keys(r).length === 4 && typeof r.template === "string" && templateNames.has(r.template.toLowerCase()) && templates.some((t) => t.name === r.template) && name3(r.property) && name3(r.slot) && Number.isSafeInteger(r.limit) && r.limit > 0 && r.limit <= 256)) throw new WydgitError("PROTOTYPE.COMPONENT", "Repeater requires known template, public Array source, explicit slot and integer LIMIT 1\u2013256", { definition: d.id, ...name3(r?.template) ? { member: "repeater:" + r.template } : {} });
    return freeze({ schema: c2.schema, children, subscriptions, templates, repeaters });
  }
  function validateComponent(d, registry) {
    if (!d.component) return;
    const c2 = d.component;
    const at = (member, validate2) => {
      try {
        validate2();
      } catch (error) {
        if (error instanceof WydgitError) throw new WydgitError(error.code, error.message, { ...error.details, definition: d.id, member });
        throw error;
      }
    };
    for (const child of c2.children) at(child.name, () => {
      requireThat(Object.hasOwn(d.slots, child.slot), "PROTOTYPE.COMPONENT", "Unknown containing slot");
      const slot = d.slots[child.slot], type = registry.get(child.type);
      resolveProperties(child.properties, type);
      for (const key of Object.keys(child.properties)) {
        const m2 = resolveMember(type, "property", key, true);
        requireThat(accessOf(m2.rule) === "public" && !m2.rule.hidden && !m2.rule.requires?.length, "PROTOTYPE.COMPONENT", "Restricted child initializer");
      }
      requireThat(Object.hasOwn(d.slots, child.slot) && slot.accepts.some((id) => registry.isA(type.id, id)) && !type.abstract && !type.static && !type.interface, "PROTOTYPE.COMPONENT", "Invalid child relationship");
      requireThat(![...Object.keys(d.properties), ...Object.keys(d.methods), ...Object.keys(d.events)].some((n) => n.toLowerCase() === child.name.toLowerCase()), "PROTOTYPE.COMPONENT", "Child collides with member");
    });
    for (const [name4, slot] of Object.entries(d.slots)) requireThat(slot.max === void 0 || c2.children.filter((child) => child.slot === name4).length <= slot.max, "PROTOTYPE.COMPONENT", "Default children exceed slot cardinality");
    for (const t of c2.templates) at("template:" + t.name, () => {
      const target = registry.get(t.type), model = registry.get(t.model), key = resolveMember(model, "property", t.key, true), mapped = /* @__PURE__ */ new Set();
      requireThat(!target.abstract && !target.static && !target.interface && key.rule.type === "string" && (key.rule.access ?? "public") === "public" && !key.rule.hidden && !key.rule.requires?.length, "PROTOTYPE.COMPONENT", "Invalid template key/type");
      for (const b2 of t.bindings) {
        const input = resolveMember(model, "property", b2.input, true), output = resolveMember(target, "property", b2.property, true);
        requireThat(!mapped.has(b2.property) && [input, output].every((m2) => (m2.rule.access ?? "public") === "public" && !m2.rule.hidden && !m2.rule.requires?.length) && JSON.stringify(input.rule.type) === JSON.stringify(output.rule.type), "PROTOTYPE.COMPONENT", "Incompatible template binding");
        mapped.add(b2.property);
      }
      for (const [name4, rule] of Object.entries(target.properties)) requireThat(!rule.required || Object.hasOwn(rule, "default") || mapped.has(name4), "PROTOTYPE.COMPONENT", "Missing required template initializer");
    });
    const repeatedSlots = /* @__PURE__ */ new Set();
    for (const r of c2.repeaters) at("repeater:" + r.template, () => {
      const property = resolveMember(d, "property", r.property, true), slot = d.slots[r.slot], t = c2.templates.find((t2) => t2.name === r.template);
      requireThat(property.rule.type === "array" && (property.rule.access ?? "public") === "public" && !property.rule.hidden && !property.rule.requires?.length && Object.hasOwn(d.slots, r.slot) && slot.accepts.some((id) => registry.isA(t.type, id)) && !repeatedSlots.has(r.slot), "PROTOTYPE.COMPONENT", "Invalid repeat source/slot");
      repeatedSlots.add(r.slot);
      requireThat(!c2.children.some((child) => child.slot === r.slot), "PROTOTYPE.COMPONENT", "Repeater requires a dedicated slot");
    });
    for (const b2 of c2.subscriptions) at(b2.handler, () => {
      const handler2 = resolveMember(d, "method", b2.handler, false), method = d.methods[handler2.name], proc = method.behavior.procedures[handler2.name];
      authorizeMember(registry, handler2, b2.owner);
      requireThat(proc.kind === "sub", "PROTOTYPE.COMPONENT", "Handlers must be SUBs");
      if (b2.source === "Page") {
        requireThat(b2.event !== "Start" || registry.isA(d.id, "wydgit.core/page"), "PROTOTYPE.COMPONENT", "Page.Start is delivered only to the Page root");
        requireThat(["Start", "Initialize", "Load", "Validate", "PreRender", "Unload"].includes(b2.event) && proc.params.length === 0, "PROTOTYPE.COMPONENT", "Invalid Page subscription");
        return;
      }
      if (["Server", "Session"].includes(b2.source)) {
        const names = b2.source === "Server" ? ["Start", "Stop"] : ["Start", "Authenticated", "Logout", "Timeout", "End"];
        requireThat(registry.isA(d.id, "wydgit.core/app") && names.includes(b2.event) && proc.params.length === 0, "PROTOTYPE.COMPONENT", "Host lifecycle subscriptions require an App-root SUB contract");
        return;
      }
      requireThat(!["App", "Client"].includes(b2.source), "PROTOTYPE.COMPONENT", "Unsupported host event source");
      const child = b2.source === "Me" ? { type: d.id } : c2.children.find((x2) => x2.name === b2.source);
      requireThat(child, "PROTOTYPE.COMPONENT", "Unknown subscription source");
      const source = registry.get(child.type), event = source.events[b2.event];
      requireThat(event && (b2.source === "Me" || accessOf(event) === "public"), "PROTOTYPE.COMPONENT", "Event is not public");
      if (b2.source === "Me") authorizeMember(registry, { owner: source.eventOwners[b2.event], rule: event }, b2.owner);
      requireThat(proc.params.length === event.params.length && proc.params.every((p, i) => p.type === event.params[i].type), "PROTOTYPE.COMPONENT", "Handler signature differs from event");
    });
  }

  // wydgine/object-model/class-contracts.js
  init_validation();
  init_validate();
  init_schema();
  init_interfaces();
  var lifecycleHooks = Object.freeze(["Init", "Preload", "Render", "Unload", "Dispose"]);
  var nameOK = (n) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n) && safeKey(n.toLowerCase());
  var methodType = (t) => contractTypes.includes(t) || interfaceType(t);
  var fields = (v, names) => record(v) && Object.keys(v).every((k2) => names.includes(k2));
  function classContracts(d, base, methods2, properties) {
    if (d.methodContracts !== void 0) for (const [name4, p] of Object.entries(d.properties ?? {})) {
      requireThat(!["id", "publisher", "version", ...lifecycleHooks.map((h) => h.toLowerCase())].includes(name4.toLowerCase()), "PROTOTYPE.CONTRACT", "Reserved platform property");
      requireThat(p.required === void 0 || typeof p.required === "boolean", "PROTOTYPE.CONTRACT", "Invalid required property flag");
      if (Object.hasOwn(p, "default")) {
        const type = p.default === null ? "null" : Array.isArray(p.default) ? "array" : typeof p.default;
        requireThat((Array.isArray(p.type) ? p.type : [p.type]).includes(type) && (!p.enum || p.enum.includes(p.default)), "PROTOTYPE.CONTRACT", "Invalid property default");
      }
    }
    const declared = d.methodContracts ?? {};
    requireThat(record(declared), "PROTOTYPE.CONTRACT", "Invalid method contracts");
    const contracts = { ...base?.methodContracts };
    for (const [name4, s] of Object.entries(declared)) {
      requireThat(nameOK(name4) && fields(s, ["kind", "params", "returns", "access", "abstract", "virtual", "requires", "hidden"]) && ["sub", "function"].includes(s.kind) && Array.isArray(s.params) && s.params.length <= 16 && s.params.every(methodType) && (s.kind === "function" ? methodType(s.returns) : s.returns === void 0) && ["public", "private", "protected", "friend"].includes(s.access) && typeof s.abstract === "boolean" && typeof s.virtual === "boolean" && (!s.abstract || s.virtual && s.access !== "private"), "PROTOTYPE.CONTRACT", "Invalid method contract");
      validateMember(s);
      const old = contracts[name4], proc = d.behavior?.procedures?.[name4];
      if (old) requireThat(old.virtual && (old.requires ?? []).every((c2) => (s.requires ?? []).includes(c2)) && (!old.hidden || s.hidden === true) && s.access === old.access && sameSignature(old, { kind: s.kind, params: s.params.map((type) => ({ type })), returns: s.returns }), "PROTOTYPE.CONTRACT", "Nonvirtual or incompatible override");
      requireThat(s.abstract ? !proc && d.abstract === true : proc && sameSignature(s, proc), "PROTOTYPE.CONTRACT", "Method contract does not match implementation");
      if (proc) requireThat((d.methodRules?.[name4]?.access ?? "public") === s.access && (s.requires ?? []).every((c2) => (d.methodRules?.[name4]?.requires ?? []).includes(c2)) && (!s.hidden || d.methodRules?.[name4]?.hidden === true), "PROTOTYPE.CONTRACT", "Method visibility disagrees with contract");
      contracts[name4] = s;
    }
    for (const [name4, proc] of Object.entries(d.behavior?.procedures ?? {})) {
      const old = base?.methodContracts?.[name4];
      if (old) requireThat(old.virtual && (old.requires ?? []).every((c2) => (d.methodRules?.[name4]?.requires ?? []).includes(c2)) && (!old.hidden || d.methodRules?.[name4]?.hidden === true) && sameSignature(old, proc) && (d.methodRules?.[name4]?.access ?? "public") === old.access, "PROTOTYPE.CONTRACT", "Invalid inherited method contract");
      if (old && !declared[name4]) contracts[name4] = { ...old, abstract: false };
    }
    for (const [name4, s] of Object.entries(contracts)) {
      requireThat(!Object.hasOwn(properties, name4), "PROTOTYPE.CONTRACT", "Property collides with a method contract");
      if (!d.abstract) requireThat(!s.abstract && methods2[name4], "PROTOTYPE.ABSTRACT", "Concrete prototype has unimplemented abstract members");
    }
    const events = { ...base?.events }, eventOwners = { ...base?.eventOwners };
    requireThat(record(d.events ?? {}), "PROTOTYPE.EVENT", "Invalid event contracts");
    for (const [name4, e] of Object.entries(d.events ?? {})) {
      requireThat(nameOK(name4) && !lifecycleHooks.some((h) => h.toLowerCase() === name4.toLowerCase()) && fields(e, ["access", "params"]) && ["public", "private", "protected", "friend"].includes(e.access) && Array.isArray(e.params) && e.params.length <= 16, "PROTOTYPE.EVENT", "Invalid event contract");
      const names = /* @__PURE__ */ new Set();
      for (const p of e.params) {
        requireThat(fields(p, ["name", "type"]) && Object.keys(p).length === 2 && nameOK(p.name) && !names.has(p.name.toLowerCase()) && ["String", "Number", "Integer", "Float", "Boolean", "Null", "Object", "Array"].includes(p.type), "PROTOTYPE.EVENT", "Invalid event parameter");
        names.add(p.name.toLowerCase());
      }
      requireThat(!Object.keys(events).some((n) => n.toLowerCase() === name4.toLowerCase()), "PROTOTYPE.EVENT", "Inherited events cannot be redeclared");
      events[name4] = e;
      eventOwners[name4] = d.id;
    }
    const groups = /* @__PURE__ */ new Set();
    if (Object.keys(contracts).length || Object.keys(events).length) for (const n of /* @__PURE__ */ new Set([...Object.keys(properties), ...Object.keys(methods2), ...Object.keys(contracts), ...Object.keys(events)])) {
      const lower = n.toLowerCase();
      requireThat(!groups.has(lower), "PROTOTYPE.CASE_COLLISION", "Case-equivalent declarations denied");
      groups.add(lower);
      requireThat(!(events[n] && (properties[n] || methods2[n] || contracts[n])), "PROTOTYPE.EVENT", "Event collides with member");
    }
    const lifecycle = { ...base?.lifecycle }, lifecycleOwners = { ...base?.lifecycleOwners };
    requireThat(record(d.lifecycle ?? {}), "PROTOTYPE.LIFECYCLE", "Invalid lifecycle hooks");
    for (const [hook, program] of Object.entries(d.lifecycle ?? {})) {
      requireThat(lifecycleHooks.includes(hook), "PROTOTYPE.LIFECYCLE", "Unknown lifecycle hook");
      const behavior = validate(program), entry = behavior.procedures?.[hook.toLowerCase()];
      requireThat(behavior.body.length === 0 && entry?.kind === "sub" && entry.params.length === 0, "PROTOTYPE.LIFECYCLE", "Lifecycle requires a compiled parameterless SUB");
      lifecycle[hook] = behavior;
      lifecycleOwners[hook] = d.id;
    }
    if (d.static) requireThat(!d.methodContracts && !d.events && !d.lifecycle, "PROTOTYPE.STATIC", "Static prototypes have no instance class contracts");
    return freeze(clean({ methodContracts: contracts, events, eventOwners, lifecycle, lifecycleOwners }));
  }

  // wydgine/object-model/prototypes.js
  init_interfaces();

  // wydgine/presentation-contract.js
  init_validation();
  var blocked = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
  var tags = /* @__PURE__ */ new Set(["section", "div", "p", "span", "h2", "h3", "form", "label", "input", "button", "ol", "ul", "li", "a", "nav", "strong", "audio", "video", "source", "img"]);
  var attributes = /* @__PURE__ */ new Set(["id", "class", "role", "method", "action", "for", "name", "type", "value", "placeholder", "href", "title", "aria-label", "src", "alt", "controls", "preload", "enctype", "accept", "required", "autocomplete", "maxlength"]);
  var ops = /* @__PURE__ */ new Set(["concat", "eq", "not", "and", "or", "if", "length", "add", "subtract", "min", "max", "lt", "gt", "query", "queryValid", "integer", "parameter", "url", "trim"]);
  function validatePresentation(input) {
    const spec = clean(input);
    if (spec.schema === CONTROL_SCHEMA2) return validateControls(spec);
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
    requireThat(Object.keys(spec).every((k2) => ["schema", "template", "request", "when", "valid", "submission", "delivery"].includes(k2)), "COMPONENT.INVALID", "Unknown presentation field");
    for (const binding of [spec.request, spec.submission, spec.delivery].filter(Boolean)) requireThat(Object.keys(binding).every((k2) => ["library", "apiVersion", "operation", "input"].includes(k2)) && ["library", "apiVersion", "operation"].every((k2) => typeof binding[k2] === "string"), "COMPONENT.INVALID", "Invalid service binding");
    walk(spec);
    return spec;
  }

  // wydgine/object-model/prototypes.js
  init_validate();

  // wydgine/sewn/bindings.js
  var reads = { handle: ["id", "prototype", "properties", "Value"], EVENT: ["Type", "Source", "Target", "Payload", "Cancelable", "Cancelled", "Handled", "OldValue", "NewValue"], REQUEST: ["Method", "Path", "Route", "IsPost", "Query", "Form", "Cookies"], RESPONSE: ["Status", "Headers", "Cookies"], CLIENT: ["Cookies"], SERVER: ["App"] };
  var methods = { handle: { FormState: [1, 2], related: [1, 2], Set: [2, 2], Insert: [3, 3], Remove: [0, 0], Replace: [1, 1], Move: [3, 3] }, EVENT: { Cancel: [0, 0], Raise: [2, 3] }, map: { Get: [1, 1], GetAll: [1, 1] }, cookieRead: { Get: [1, 1] }, RESPONSE: { WriteMarkdown: [1, 1] }, headers: { Set: [2, 2], Remove: [1, 1] }, cookieWrite: { Set: [2, 3], Delete: [1, 1] } };

  // wydgine/object-model/prototypes.js
  init_validation();
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
        const contract2 = validateInterface(d);
        requireThat(this.#verified.get(id) === d.publisher, "INTERFACE.PUBLISHER", "Interface requires verified publisher ownership");
        this.#interfaces.set(interfaceKey(contract2), contract2);
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
          requireThat(Object.keys(d).every((k2) => ["id", "publisher", "public", "abstract", "static", "alias", "version", "dependencies", "properties", "slots", "methodRules", "behavior"].includes(k2)), "PROTOTYPE.STATIC", "Unsupported static prototype metadata");
          requireThat(record(d.dependencies ?? {}) && Object.entries(d.dependencies ?? {}).every(([id2, v]) => identity.test(id2) && typeof v === "string"), "PROTOTYPE.STATIC", "Invalid static dependencies");
          requireThat(d.extends === void 0 && !d.abstract && !d.friends?.length && !d.overrides?.length && !d.presentation && !d.actions && Object.keys(d.properties ?? {}).length === 0 && Object.keys(d.slots ?? {}).length === 0, "PROTOTYPE.STATIC", "Dedicated static prototypes cannot contain instance state or inheritance");
          requireThat(typeof d.alias === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.alias) && typeof d.version === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(d.version), "PROTOTYPE.STATIC", "Static prototypes need an alias and exact version");
        } else requireThat(!base?.static && d.alias === void 0 && d.version === void 0, "PROTOTYPE.STATIC", "Static metadata requires a dedicated static prototype");
        requireThat(d.abstract === void 0 || typeof d.abstract === "boolean", "PROTOTYPE.DEFINITION", "Invalid abstract flag");
        requireThat(d.public === void 0 || typeof d.public === "boolean", "PROTOTYPE.DEFINITION", "Invalid public flag");
        requireThat(record(d.properties ?? {}) && record(d.slots ?? {}), "PROTOTYPE.DEFINITION", "Invalid definitions");
        const friends = d.friends ?? [];
        requireThat(Array.isArray(friends) && new Set(friends).size === friends.length && friends.every((x2) => typeof x2 === "string" && (identity.test(x2) || /^[a-z][a-z0-9.-]*\/\*$/.test(x2)) && x2.split("/")[0] === d.publisher), "PROTOTYPE.FRIEND", "Invalid or cross-publisher friendship");
        if (friends.length) requireThat(this.#verified.get(id) === d.publisher, "PROTOTYPE.FRIEND", "Friend grants require a verified publisher binding");
        const methodRules = { ...base?.methodRules };
        requireThat(record(d.methodRules ?? {}) && Object.keys(d.methodRules ?? {}).every((name4) => Object.hasOwn(d.behavior?.procedures ?? {}, name4)), "PROTOTYPE.METHOD", "Method rules require locally declared methods");
        const inheritedMethods = base?.methods ?? {}, methods2 = { ...inheritedMethods };
        requireThat(d.overrides === void 0 || Array.isArray(d.overrides) && d.overrides.every((x2) => typeof x2 === "string"), "PROTOTYPE.METHOD", "Invalid override declarations");
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
        requireThat(!behavior || ["sewn/0.3", "sewn/0.4", "sewn/0.5", "sewn/0.6", "sewn/0.7", "sewn/0.8", "sewn/0.9", "sewn/0.10", "sewn/0.11", "sewn/0.12", "sewn/0.13", "sewn/0.14", "sewn/0.15", "sewn/0.16", "sewn/0.17", "sewn/0.18"].includes(behavior.schema) && behavior.body.length === 0, "PROTOTYPE.METHOD", "Expected portable prototype behavior");
        const linkedNames = new Set(behavior?.libraries?.flatMap((lib) => Object.keys(lib.methods)) ?? []);
        for (const [name4, proc] of Object.entries(behavior?.procedures ?? {})) {
          if (linkedNames.has(name4)) {
            requireThat(!d.methodRules?.[name4] && !(d.overrides ?? []).includes(name4), "PROTOTYPE.STATIC", "Linked procedures are not instance methods");
            continue;
          }
          requireThat(!Object.keys(methods.handle).some((x2) => x2.toLowerCase() === name4.toLowerCase()), "PROTOTYPE.METHOD", "Method conflicts with kernel facade");
          const old = inheritedMethods[name4];
          requireThat(Boolean(old || base?.methodContracts?.[name4]) === (d.overrides ?? []).includes(name4), "PROTOTYPE.METHOD", "Inherited methods require explicit overrides");
          if (old) {
            requireThat(accessOf(base.methodRules[name4]) !== "private", "PROTOTYPE.ACCESS", "Private methods cannot be overridden");
            const previous = old.behavior.procedures[name4];
            requireThat(previous.kind === proc.kind && previous.params.length === proc.params.length && previous.params.every((x2, i) => x2.type === proc.params[i].type) && previous.returns === proc.returns, "PROTOTYPE.METHOD", "Incompatible override signature");
          }
          const rule = d.methodRules?.[name4] ?? {};
          validateMember(rule);
          if (d.static) requireThat(["public", "private"].includes(accessOf(rule)) && !rule.hidden, "PROTOTYPE.STATIC", "Static methods support public/private visibility");
          if (old) requireThat(accessOf(rule) === accessOf(base.methodRules[name4]) && (base.methodRules[name4].requires ?? []).every((cap) => (rule.requires ?? []).includes(cap)) && (!base.methodRules[name4].hidden || rule.hidden === true), "PROTOTYPE.ACCESS", "Override cannot change inherited access or expose hidden members");
          methodRules[name4] = rule;
          methods2[name4] = { owner: id, behavior };
        }
        requireThat((d.overrides ?? []).every((name4) => Object.hasOwn(behavior?.procedures ?? {}, name4)), "PROTOTYPE.METHOD", "Override must declare a method");
        const properties = { ...base?.properties, ...d.properties }, slots = { ...base?.slots, ...d.slots };
        const propertyOwners = { ...base?.propertyOwners };
        for (const [name4, rule] of Object.entries(d.properties ?? {})) {
          validateMember(rule);
          const old = base?.properties[name4];
          if (old) requireThat(accessOf(old) !== "private" && (JSON.stringify(rule.type) === JSON.stringify(old.type) || name4 === "value" && ["wydgit.core/checkbox", "wydgit.core/radio-group", "wydgit.core/checkbox-group", "wydgit.core/select"].includes(id)) && accessOf(rule) === accessOf(old) && (old.requires ?? []).every((cap) => (rule.requires ?? []).includes(cap)) && (!old.required || rule.required === true || Object.hasOwn(rule, "default")) && (!old.hidden || rule.hidden === true) && (!old.enum || rule.enum && rule.enum.every((v) => old.enum.includes(v))), "PROTOTYPE.ACCESS", "Incompatible property override");
          propertyOwners[name4] = old ? base.propertyOwners[name4] : id;
        }
        const names = [...Object.keys(properties), ...Object.keys(methods2)], groups = /* @__PURE__ */ new Map();
        for (const name4 of names) {
          const key = name4.toLowerCase();
          groups.set(key, [...groups.get(key) ?? [], name4]);
        }
        for (const group of groups.values()) if (group.length > 1) {
          const allowed = caseCollisionCompatibility[id];
          requireThat(Array.isArray(allowed) && new Set(group).size === group.length && group.every((name4) => allowed.includes(name4)), "PROTOTYPE.CASE_COLLISION", "Case-equivalent member declarations denied");
        }
        for (const rule of Object.values(properties)) {
          validateMember(rule);
          requireThat(record(rule) && (!Array.isArray(rule.type) || rule.type.length > 0) && (Array.isArray(rule.type) ? rule.type : [rule.type]).every((type) => ["string", "number", "boolean", "object", "array", "null"].includes(type)), "PROTOTYPE.DEFINITION", "Invalid property rule");
          requireThat(rule.enum === void 0 || Array.isArray(rule.enum), "PROTOTYPE.DEFINITION", "Invalid enum");
        }
        for (const rule of Object.values(slots)) {
          requireThat(record(rule) && Array.isArray(rule.accepts) && rule.accepts.length > 0 && rule.accepts.every((x2) => typeof x2 === "string"), "PROTOTYPE.SLOT", "Slot needs accepted prototypes");
          requireThat(rule.ordered === true && Number.isInteger(rule.min ?? 0) && (rule.min ?? 0) >= 0 && (rule.max === void 0 || Number.isInteger(rule.max) && rule.max >= (rule.min ?? 0)), "PROTOTYPE.SLOT", "Invalid ordered slot cardinality");
        }
        const actions = { ...base?.actions };
        requireThat(record(d.actions ?? {}) && Object.keys(d.actions ?? {}).every((name4) => name4 === "Submit"), "PROTOTYPE.ACTION", "Only Submit delegation is supported");
        for (const [name4, rule] of Object.entries(d.actions ?? {})) {
          requireThat(record(rule) && Object.keys(rule).length === 1 && isCapability(rule.capability), "PROTOTYPE.ACTION", "Invalid action declaration");
          requireThat(!actions[name4] || actions[name4].capability === rule.capability, "PROTOTYPE.ACTION", "Inherited action capability cannot change");
          requireThat(d.id === "wydgit.core/form" || base && (base.id === "wydgit.core/form" || base.ancestors.includes("wydgit.core/form")), "PROTOTYPE.ACTION", "Submit delegation requires Form");
          actions[name4] = rule;
        }
        const presentation = d.presentation === void 0 ? base?.presentation : validatePresentation(d.presentation);
        requireThat(record(d.implements ?? {}) && Object.keys(d.implements ?? {}).length <= 16 && (!d.static || d.implements === void 0), "INTERFACE.IMPLEMENTATION", "Invalid implementation metadata");
        if (Object.keys(d.implements ?? {}).length) requireThat(this.#verified.get(id) === d.publisher, "INTERFACE.PUBLISHER", "Implementation requires verified publisher ownership");
        const implementations = { ...base?.implements, ...d.implements };
        if (Object.keys(implementations).length) requireThat(this.#verified.get(id) === d.publisher, "INTERFACE.PUBLISHER", "Inherited implementation requires verified publisher ownership");
        for (const [contractId, version] of Object.entries(implementations)) {
          const contract2 = this.interface(`interface:${contractId}@${version}`);
          for (const [name4, signature] of Object.entries(contract2.signatures)) {
            const member = resolveMember({ methods: methods2, methodRules }, "method", name4, false), method = methods2[member.name];
            requireThat(accessOf(member.rule) === "public" && !member.rule.hidden && sameSignature(signature, method.behavior.procedures[member.name]), "INTERFACE.CONFORMANCE", "Required public instance signature does not match");
          }
        }
        const declarations = classContracts(d, base, methods2, properties);
        const component = componentContract(d, base);
        const result = freeze({ ...d, ...declarations, ...component ? { component } : {}, implements: implementations, ...presentation ? { presentation } : {}, abstract: d.abstract ?? false, properties, propertyOwners, slots, methods: methods2, methodRules, friends, actions, ancestors: base ? [base.id, ...base.ancestors] : [] });
        visiting.delete(id);
        this.#definitions.set(id, result);
        return result;
      };
      for (const id of raw.keys()) resolve(id);
      for (const d of this.#definitions.values()) for (const slot of Object.values(d.slots)) for (const id of slot.accepts) this.get(id);
      const composing = /* @__PURE__ */ new Set(), composed = /* @__PURE__ */ new Set();
      const visitComposition = (id) => {
        requireThat(!composing.has(id), "PROTOTYPE.COMPONENT", "Cyclic default composition");
        if (composed.has(id)) return;
        composing.add(id);
        for (const child of this.get(id).component?.children ?? []) visitComposition(child.type);
        composing.delete(id);
        composed.add(id);
      };
      for (const id of this.#definitions.keys()) visitComposition(id);
      for (const d of this.#definitions.values()) {
        if (d.interface) continue;
        validateControlBindings(d, this);
        validateComponent(d, this);
        if (d.extends && raw.get(d.id).methodContracts !== void 0) {
          const base = this.get(d.extends);
          for (const [name4, slot] of Object.entries(raw.get(d.id).slots ?? {})) {
            const old = base.slots[name4];
            if (old) requireThat((slot.min ?? 0) >= (old.min ?? 0) && (old.max === void 0 || slot.max !== void 0 && slot.max <= old.max) && slot.accepts.every((id) => old.accepts.some((parent) => this.isA(id, parent))), "PROTOTYPE.SLOT", "A class cannot weaken inherited slot contracts");
          }
        }
        for (const s of Object.values(d.methodContracts ?? {})) for (const type of [...s.params, s.returns]) if (typeof type === "string" && type.startsWith("interface:")) this.interface(type);
        if (d.behavior) for (const type of interfaceTypes(d.behavior)) this.interface(type);
        if (d.static) {
          requireThat(["sewn/0.14", "sewn/0.15", "sewn/0.16", "sewn/0.17", "sewn/0.18"].includes(d.behavior?.schema), "PROTOTYPE.STATIC", "Static behavior requires sewn/0.14, sewn/0.15 or sewn/0.16");
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
            const abstractName = Object.keys(d.methodContracts ?? {}).find((n) => (v.exact ? n === v.name : n.toLowerCase() === v.name.toLowerCase()) && d.methodContracts[n].abstract);
            if (d.abstract && abstractName) return;
            const lookup = resolveMember(d, "method", v.name, v.exact ?? false), m2 = d.methods[lookup.name];
            requireThat(m2, "PROTOTYPE.METHOD", "Unknown receiver method");
            edges.add(m2.owner + ":" + lookup.name);
          }
          Object.values(v).forEach((x2) => walk(x2, edges, behavior));
        };
        for (const m2 of Object.values(d.methods)) for (const [name4, proc] of Object.entries(m2.behavior.procedures)) {
          const edges = /* @__PURE__ */ new Set();
          walk(proc.body, edges, m2.owner);
          graph.set(m2.owner + ":" + name4, edges);
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
    method(id, name4, caller = null, exact = true, context = null) {
      const definition = this.get(id);
      requireThat(!definition.static, "PROTOTYPE.STATIC", "Static methods require compile-time linking");
      requireThat(Object.hasOwn(definition.methods, name4) || !exact, "PROTOTYPE.METHOD", "Unknown prototype method");
      const member = resolveMember(definition, "method", name4, exact);
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
      const contract2 = this.interface(type), d = this.get(id);
      return !d.interface && !d.static && d.implements?.[contract2.id] === contract2.version;
    }
    verifiedPublisher(id) {
      return this.#verified.get(id) ?? null;
    }
    isA(id, base) {
      const d = this.get(id);
      return id === base || d.ancestors.includes(base);
    }
  };

  // wydgine/object-model/index.js
  init_validation();
  var graphs = /* @__PURE__ */ new WeakMap();
  function hydrate(input, registry, { revision = 0, rootPrototype = "wydgit.core/app" } = {}) {
    requireThat(Number.isSafeInteger(revision) && revision >= 0, "OBJECT.REVISION", "Revision must be a non-negative safe integer");
    if (typeof input === "string") input = parse(input);
    const nodes = /* @__PURE__ */ new Map(), parents = /* @__PURE__ */ new Map(), positions = /* @__PURE__ */ new Map(), active = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set();
    function visit(raw, parent, slot, index, depth = 0) {
      requireThat(depth <= 64 && nodes.size < 1e4, "OBJECT.LIMIT", "Object tree limit exceeded");
      requireThat(record(raw), "OBJECT.ENVELOPE", "Expected object envelope");
      requireThat(!active.has(raw), "OBJECT.CYCLE", "Containment cycle");
      requireThat(!seen.has(raw), "OBJECT.MULTIPLE_PARENTS", "Object occurs in multiple containment positions");
      active.add(raw);
      seen.add(raw);
      validateEnvelope(raw);
      requireThat(!nodes.has(raw.id), "OBJECT.DUPLICATE_ID", `Duplicate instance ID: ${raw.id}`);
      const definition = registry.get(raw.prototype);
      requireThat(!definition.abstract && !definition.static, "OBJECT.ABSTRACT", "Cannot instantiate abstract prototype");
      requireThat(parent ? !registry.isA(definition.id, "wydgit.core/app") : registry.isA(definition.id, rootPrototype), "OBJECT.ROOT", "Exactly one App must be the root");
      jsonKeys(raw.slots);
      const properties = resolveProperties(raw.properties, definition), provenance = clean(raw.provenance);
      const node = { id: raw.id, prototype: definition.id, properties: freeze(properties), provenance: freeze(provenance), slots: /* @__PURE__ */ Object.create(null) };
      Object.defineProperty(node, "toJSON", { value: () => ({ ...node, properties: publicProperties(node, registry) }) });
      nodes.set(node.id, node);
      parents.set(node.id, parent);
      positions.set(node.id, { slot, index });
      for (const key of Object.keys(raw.slots)) {
        requireThat(!["__proto__", "constructor", "prototype"].includes(key), "INPUT.DANGEROUS_KEY", "Reserved slot key");
        requireThat(Object.hasOwn(definition.slots, key), "OBJECT.UNKNOWN_SLOT", `Unknown slot: ${key}`);
      }
      for (const key of Object.keys(definition.slots).sort()) {
        const rule = definition.slots[key], children = Object.hasOwn(raw.slots, key) ? raw.slots[key] : [];
        requireThat(Array.isArray(children) && Object.getPrototypeOf(children) === Array.prototype, "OBJECT.SLOT", "Slot must be an array");
        jsonKeys(children);
        requireThat(children.length >= (rule.min ?? 0) && children.length <= (rule.max ?? Infinity), "OBJECT.CARDINALITY", `Invalid cardinality: ${key}`);
        node.slots[key] = Object.freeze(children.map((child, i) => {
          const result = visit(child, node.id, key, i, depth + 1);
          requireThat(rule.accepts.some((base) => registry.isA(result.prototype, base)), "OBJECT.CHILD_TYPE", `Invalid child in slot: ${key}`);
          return result.id;
        }));
      }
      active.delete(raw);
      return freeze(node);
    }
    const root = visit(input, null, null, 0);
    const semantic = (id) => {
      const n = nodes.get(id);
      return { prototype: n.prototype, properties: n.properties, slots: Object.fromEntries(Object.entries(n.slots).map(([key, ids]) => [key, ids.map(semantic)])) };
    };
    formTree(semantic(root.id), registry);
    const runtime = Object.freeze({
      // Host-only APIs: never hand this runtime or its context factory to package code.
      rootId: root.id,
      revision,
      edit(context) {
        return createEdit(runtime, context, registry, (input2, _registry, options) => hydrate(input2, registry, { ...options, rootPrototype }), dehydrate);
      },
      get(id) {
        requireThat(nodes.has(id), "OBJECT.UNKNOWN", "Unknown object");
        return nodes.get(id);
      },
      scope(context, startId = context.self) {
        checkContext(context);
        requireThat(nodes.has(context.self), "SEAM.CONTEXT", "Unknown self object");
        requireThat(context.app === null || context.app === root.id, "SEAM.CONTEXT", "Wrong App context");
        const handles = /* @__PURE__ */ new Map();
        const handle = (id) => {
          requireThat(matchesObjectGrant(context.visible, id), "SEAM.VISIBILITY", "Object is not visible");
          requireThat(nodes.has(id), "OBJECT.UNKNOWN", "Unknown object");
          if (handles.has(id)) return handles.get(id);
          const node = nodes.get(id);
          const result = Object.freeze({
            id,
            prototype: node.prototype,
            properties: freeze(clean(publicProperties(node, registry))),
            provenance: node.provenance,
            related(relation, slotName) {
              requireThat(context.traversal.includes(relation), "SEAM.TRAVERSAL", "Traversal denied");
              let ids;
              if (relation === "children") {
                requireThat(slotName === void 0 || Object.hasOwn(node.slots, slotName), "OBJECT.UNKNOWN_SLOT", "Unknown slot");
                ids = slotName === void 0 ? Object.values(node.slots).flat() : node.slots[slotName];
                return Object.freeze(ids.filter((x2) => matchesObjectGrant(context.visible, x2)).map(handle));
              }
              let target;
              if (relation === "root") target = root.id;
              else if (relation === "parent") target = parents.get(id);
              else {
                const parentId = parents.get(id), position = positions.get(id);
                if (parentId) target = nodes.get(parentId).slots[position.slot][position.index + (relation === "nextSibling" ? 1 : -1)];
              }
              return target == null ? null : handle(target);
            },
            requireCapability(capability) {
              requireThat(context.capabilities.includes(capability), "SEAM.DENIED", "Capability denied");
              return true;
            }
          });
          bindMembers(result, { context, node: () => {
            requireThat(matchesObjectGrant(context.visible, id), "SEAM.VISIBILITY", "Object is not visible");
            return node;
          }, read: (name4) => name4 === "value" && registry.isA(node.prototype, "wydgit.core/password-input") ? "" : node.properties[name4] });
          handles.set(id, result);
          return result;
        };
        return handle(startId);
      }
    });
    graphs.set(runtime, { nodes, root, registry });
    return runtime;
  }
  function dehydrate(runtime, { includeSensitive = false } = {}) {
    requireThat(graphs.has(runtime), "OBJECT.RUNTIME", "Expected hydrated runtime");
    const { nodes, root, registry } = graphs.get(runtime);
    const emit = (node) => ({ schema: "wydgit/0.2", id: node.id, prototype: node.prototype, properties: clean(includeSensitive ? node.properties : publicProperties(node, registry)), slots: Object.fromEntries(Object.entries(node.slots).map(([key, ids]) => [key, ids.map((id) => emit(nodes.get(id)))])), provenance: clean(node.provenance) });
    return emit(root);
  }

  // wydgine/events/runtime.js
  init_validate();

  // wydgine/sewn/execute.js
  init_schema();

  // wydgine/sewn/dates.js
  init_validate();
  init_schema();
  var DAY = 864e5;
  var MAX = 864e13;
  var elapsed = { millisecond: 1, second: 1e3, minute: 6e4, hour: 36e5 };
  var leap = (y2) => y2 % 4 === 0 && (y2 % 100 !== 0 || y2 % 400 === 0);
  var days = (y2, m2) => [31, leap(y2) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m2 - 1];
  var checked = (n) => {
    ensure(Number.isSafeInteger(n) && Math.abs(n) <= MAX, "TYPE");
    return n;
  };
  var instant = (n) => dateTime(new Date(checked(n)).toISOString());
  function local(y2, m2, d, h = 0, min = 0, s = 0, ms = 0) {
    ensure(Number.isSafeInteger(y2) && m2 >= 1 && m2 <= 12 && d >= 1 && d <= days(y2, m2) && h >= 0 && h < 24 && min >= 0 && min < 60 && s >= 0 && s < 60 && ms >= 0 && ms < 1e3, "TYPE");
    const date = /* @__PURE__ */ new Date(0);
    date.setUTCFullYear(y2, m2 - 1, d);
    date.setUTCHours(h, min, s, ms);
    return checked(date.getTime());
  }
  function offset(zone) {
    if (zone === "UTC") return 0;
    ensure(/^[+-]\d{2}:\d{2}$/.test(zone), "TYPE");
    const h = Number(zone.slice(1, 3)), m2 = Number(zone.slice(4));
    ensure(h <= 23 && m2 <= 59 && zone !== "-00:00", "TYPE");
    return (zone[0] === "-" ? -1 : 1) * (h * 60 + m2) * 6e4;
  }
  function parts(ms, off) {
    const d = new Date(checked(ms + off));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(), millisecond: d.getUTCMilliseconds(), dayOfWeek: d.getUTCDay() };
  }
  function dateOperation(name4, args, bounds, tick) {
    dateSignatures[name4].forEach((type, i) => ensure(type === "DateTime" ? brand(args[i])?.type === "DateTime" : type === "Integer" ? Number.isSafeInteger(args[i]) : typeof args[i] === "string", "TYPE"));
    const limit = (s, key) => ensure(s.length <= bounds[key] && s.length <= bounds.string, "LIMIT");
    const zone = args.at(-1);
    limit(zone, "dateZone");
    const off = offset(zone);
    tick();
    const [a, b2, c2] = args, ms = brand(a)?.value;
    if (name4 === "ParseDate") {
      limit(a, "dateInput");
      limit(b2, "dateFormat");
      ensure(b2 === "iso", "TYPE");
      const match = /^(\d{4}|[+-]\d{6})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|[+-]\d{2}:\d{2})$/.exec(a);
      ensure(match, "TYPE");
      const [, y2, m2, d, h, min, s, f, z2] = match;
      ensure(y2 !== "-000000" && (y2.length === 4 || Number(y2) < 0 || Number(y2) > 9999), "TYPE");
      const parsedOffset = z2 === "Z" ? 0 : offset(z2);
      ensure(parsedOffset === off, "TYPE");
      return instant(local(Number(y2), Number(m2), Number(d), Number(h), Number(min), Number(s), Number(f)) - parsedOffset);
    }
    const p = parts(ms, off);
    if (name4 === "DatePart") {
      ensure(Object.hasOwn(p, b2), "TYPE");
      return p[b2];
    }
    if (name4 === "DateAdd") {
      let result2;
      if (Object.hasOwn(elapsed, b2)) {
        const delta = c2 * elapsed[b2];
        ensure(Number.isSafeInteger(delta), "TYPE");
        result2 = ms + delta;
      } else if (b2 === "day" || b2 === "week") {
        const delta = c2 * (b2 === "week" ? 7 : 1) * DAY;
        ensure(Number.isSafeInteger(delta), "TYPE");
        result2 = ms + delta;
      } else {
        ensure(b2 === "month" || b2 === "year", "TYPE");
        const total = p.year * 12 + p.month - 1 + c2 * (b2 === "year" ? 12 : 1);
        ensure(Number.isSafeInteger(total), "TYPE");
        const y2 = Math.floor(total / 12), m2 = total - y2 * 12 + 1;
        result2 = local(y2, m2, Math.min(p.day, days(y2, m2)), p.hour, p.minute, p.second, p.millisecond) - off;
      }
      return instant(result2);
    }
    if (name4 === "DateDiff") {
      const finish = brand(b2).value;
      const unit = c2;
      let result2;
      if (Object.hasOwn(elapsed, unit)) result2 = Number((BigInt(finish) - BigInt(ms)) / BigInt(elapsed[unit]));
      else {
        const q2 = parts(finish, off);
        ensure(["day", "week", "month", "year"].includes(unit), "TYPE");
        const dayDiff = Math.floor((finish + off) / DAY) - Math.floor((ms + off) / DAY);
        result2 = unit === "day" ? dayDiff : unit === "week" ? Math.trunc(dayDiff / 7) : unit === "month" ? (q2.year - p.year) * 12 + q2.month - p.month : q2.year - p.year;
      }
      ensure(Number.isSafeInteger(result2), "TYPE");
      return result2 === 0 ? 0 : result2;
    }
    limit(b2, "dateFormat");
    const pad = (v, n) => String(v).padStart(n, "0");
    const year = p.year >= 0 && p.year <= 9999 ? pad(p.year, 4) : `${p.year < 0 ? "-" : "+"}${pad(Math.abs(p.year), 6)}`;
    const tokens = { yyyy: year, MM: pad(p.month, 2), dd: pad(p.day, 2), HH: pad(p.hour, 2), mm: pad(p.minute, 2), ss: pad(p.second, 2), SSS: pad(p.millisecond, 3), XXX: off === 0 ? "+00:00" : zone };
    if (b2 === "iso") {
      const result2 = `${year}-${tokens.MM}-${tokens.dd}T${tokens.HH}:${tokens.mm}:${tokens.ss}.${tokens.SSS}${off === 0 ? "Z" : zone}`;
      limit(result2, "dateOutput");
      return result2;
    }
    let result = "", count = 0;
    for (let i = 0; i < b2.length; ) {
      tick();
      const token = Object.keys(tokens).find((t) => b2.startsWith(t, i));
      if (token) {
        ensure(++count <= bounds.dateTokens, "LIMIT");
        result += tokens[token];
        i += token.length;
      } else {
        ensure(" -/:.,T".includes(b2[i]), "TYPE");
        result += b2[i++];
      }
      limit(result, "dateOutput");
    }
    return result;
  }

  // wydgine/sewn/execute.js
  init_interfaces();
  init_schema();

  // wydgine/object-model/construction.js
  init_validation();
  function construction(registry, context, bounds, guard, ledger) {
    checkContext(context);
    const drafts = /* @__PURE__ */ new WeakMap(), roots = /* @__PURE__ */ new Set();
    let created = 0, operations = 0;
    const tick = () => {
      guard();
      if (ledger) ledger.take("constructionOperations");
      else requireThat(++operations <= bounds.constructionOperations, "SEWN.LIMIT", "Construction limit");
    };
    const requireScope = (type) => {
      context.require("object.instances.construct");
      requireThat(Array.isArray(context.scopes.prototypes) && context.scopes.prototypes.includes(type), "SEAM.DENIED", "Prototype construction denied");
    };
    const state = (handle) => {
      guard();
      const s = drafts.get(handle);
      requireThat(s && !s.consumed, "OBJECT.CONSTRUCTION", "Stale construction handle");
      return s;
    };
    const validate2 = (raw, complete = false, depth = 0, ids = /* @__PURE__ */ new Set()) => {
      requireThat(depth <= bounds.draftDepth && ids.size < bounds.draftNodes, "SEWN.LIMIT", "Draft graph limit");
      requireThat(validId(raw.id) && !ids.has(raw.id), "OBJECT.CONSTRUCTION", "Invalid or duplicate draft identity");
      ids.add(raw.id);
      const def = registry.get(raw.prototype);
      requireThat(!def.abstract && !def.static && !registry.isA(def.id, "wydgit.core/app"), "OBJECT.CONSTRUCTION", "Prototype cannot be constructed");
      const properties = resolveProperties(raw.properties, def, { incomplete: !complete });
      const slots = /* @__PURE__ */ Object.create(null);
      for (const key of Object.keys(raw.slots)) requireThat(Object.hasOwn(def.slots, key), "OBJECT.UNKNOWN_SLOT", "Unknown draft slot");
      for (const [key, rule] of Object.entries(def.slots)) {
        const children = raw.slots[key] ?? [];
        requireThat(Array.isArray(children) && children.length <= (rule.max ?? Infinity) && (!complete || children.length >= (rule.min ?? 0)), "OBJECT.CARDINALITY", "Draft cardinality");
        slots[key] = children.map((child) => {
          requireThat(rule.accepts.some((base) => registry.isA(child.prototype, base)), "OBJECT.CHILD_TYPE", "Draft child type");
          return validate2(child, complete, depth + 1, ids);
        });
      }
      const result = { schema: "wydgit/0.2", id: raw.id, prototype: def.id, properties, slots, provenance: {} };
      formTree(result, registry);
      return result;
    };
    const size = (candidate, excluded) => {
      let total = 0, nodes = 0;
      const count = (raw) => {
        nodes++;
        Object.values(raw.slots).flat().forEach(count);
      };
      for (const root of roots) {
        if (root === excluded) continue;
        const raw = root === candidate?.state ? candidate.raw : root.raw;
        total += JSON.stringify(raw).length;
        count(raw);
      }
      requireThat(nodes <= bounds.draftNodes, "SEWN.LIMIT", "Draft node limit");
      requireThat(total <= bounds.constructionSize, "SEWN.LIMIT", "Construction size limit");
    };
    const update = (s, raw, excluded) => {
      raw = validate2(raw);
      size({ state: s, raw }, excluded);
      s.raw = raw;
    };
    const consume = (s) => {
      s.consumed = true;
      s.raw = null;
      roots.delete(s);
    };
    const defaults = (type, id, properties = {}, depth = 0) => {
      if (depth) tick();
      requireThat(depth <= bounds.draftDepth && validId(id), "OBJECT.CONSTRUCTION", "Invalid default composition");
      requireScope(type);
      if (ledger) {
        ledger.take("drafts");
        ledger.take("draftNodes");
      } else requireThat(++created <= bounds.drafts, "SEWN.LIMIT", "Draft count limit");
      const definition = registry.get(type);
      requireThat(!definition.abstract && !definition.static && !registry.isA(type, "wydgit.core/app"), "OBJECT.CONSTRUCTION", "Prototype cannot be constructed");
      const slots = /* @__PURE__ */ Object.create(null);
      for (const key of Object.keys(definition.slots)) slots[key] = [];
      for (const child of definition.component?.children ?? []) slots[child.slot].push(defaults(child.type, `${id}-${child.name}`, child.properties, depth + 1));
      return { id, prototype: type, properties, slots };
    };
    return Object.freeze({
      has: (handle) => drafts.has(handle),
      create(type, id) {
        tick();
        requireThat(registry, "OBJECT.CONSTRUCTION", "Construction unavailable");
        const s = { raw: validate2(defaults(type, id)), consumed: false };
        const set = (name4, value) => {
          tick();
          const current = state(handle), raw = copyEnvelope(current.raw);
          requireThat(Object.hasOwn(registry.get(raw.prototype).properties, name4), "OBJECT.PROPERTY", "Unknown draft property");
          raw.properties[name4] = clean(value);
          update(current, raw);
        };
        const handle = Object.freeze({
          get id() {
            return state(handle).raw.id;
          },
          get prototype() {
            return state(handle).raw.prototype;
          },
          get properties() {
            return freeze(clean(publicProperties(state(handle).raw, registry)));
          },
          Set(name4, value) {
            requireThat(Object.hasOwn(registry.get(state(handle).raw.prototype).properties, name4), "OBJECT.PROPERTY", "Unknown draft property");
            authorizeMember(registry, resolveMember(registry.get(state(handle).raw.prototype), "property", name4), null, context);
            set(name4, value);
          },
          Insert(slot, index, child) {
            tick();
            const s2 = state(handle), c2 = state(child);
            requireThat(s2 !== c2, "OBJECT.CONSTRUCTION", "Draft cycle");
            const raw = copyEnvelope(s2.raw);
            requireThat(Object.hasOwn(raw.slots, slot), "OBJECT.UNKNOWN_SLOT", "Unknown draft slot");
            requireThat(Number.isSafeInteger(index) && index >= 0 && index <= raw.slots[slot].length, "MUTATION.INDEX", "Invalid draft index");
            raw.slots[slot].splice(index, 0, validate2(c2.raw, true));
            update(s2, raw, c2);
            consume(c2);
          }
        });
        drafts.set(handle, s);
        roots.add(s);
        try {
          size();
        } catch (error) {
          roots.delete(s);
          throw error;
        }
        return bindMembers(handle, { context, node: () => state(handle).raw, set, read: (name4) => name4 === "value" && registry.isA(state(handle).raw.prototype, "wydgit.core/password-input") ? "" : state(handle).raw.properties[name4] });
      },
      envelope(handle) {
        tick();
        return validate2(state(handle).raw, true);
      },
      consume(handle) {
        consume(state(handle));
      },
      check(handle) {
        state(handle);
      },
      close() {
        for (const s of roots) consume(s);
        roots.clear();
      }
    });
  }

  // wydgine/sewn/execute.js
  init_validation();
  init_schema();
  init_validate();

  // wydgine/sewn/budget.js
  init_schema();
  init_validation();
  var ledgers = /* @__PURE__ */ new WeakMap();
  function createExecutionBudget(context, { guard = () => {
  }, deadline = Infinity } = {}) {
    checkContext(context);
    const bounds = Object.fromEntries(Object.entries({ ...MAXIMA, eventDispatches: 256, eventHandlers: 2048, eventRaises: 256, eventDepth: 16 }).map(([key, value]) => [key, Math.min(value, context.limits[key.startsWith("event") ? key : `sewn${key[0].toUpperCase() + key.slice(1)}`] ?? value)]));
    const started = Date.now(), end = Math.min(deadline, started + bounds.timeMs), counts = /* @__PURE__ */ Object.create(null);
    let live = true, eventDepth = -1, exhaustion = null;
    const token = Object.freeze(/* @__PURE__ */ Object.create(null));
    const fail2 = (resource, used, limit, code = "SEWN.LIMIT") => {
      live = false;
      exhaustion ??= Object.freeze({ resource, used, limit });
      throw new WydgitError(code, "Execution budget exhausted", exhaustion);
    };
    const assert = () => {
      const now = Date.now();
      if (!live) fail2(exhaustion?.resource ?? "closed", exhaustion?.used ?? 0, exhaustion?.limit ?? 0);
      if (now >= end) fail2("timeMs", Math.max(0, now - started), Math.max(0, end - started));
      try {
        guard();
      } catch (error) {
        live = false;
        exhaustion ??= Object.freeze({ resource: "guard", used: 0, limit: 0 });
        throw error;
      }
    };
    const ledger = Object.freeze({
      bounds: Object.freeze(bounds),
      deadline: end,
      check: assert,
      eventDepth: () => eventDepth,
      enterEvent(depth) {
        assert();
        if (!Number.isSafeInteger(depth) || depth < 0 || depth > bounds.eventDepth) {
          fail2("eventDepth", depth, bounds.eventDepth, "EVENT.LIMIT");
        }
        const before = eventDepth;
        eventDepth = depth;
        return () => {
          eventDepth = before;
        };
      },
      take(key, count = 1) {
        assert();
        requireThat(Object.hasOwn(bounds, key) && Number.isSafeInteger(count) && count >= 0, "SEWN.LIMIT", "Invalid resource accounting");
        counts[key] = (counts[key] ?? 0) + count;
        if (counts[key] > bounds[key]) {
          fail2(key, counts[key], bounds[key]);
        }
      },
      close() {
        live = false;
      },
      snapshot() {
        return Object.freeze({ ...counts });
      },
      meter() {
        return Object.freeze({ schema: "wydgit.execution-meter/1", elapsedMs: Math.max(0, Date.now() - started), timeLimitMs: Math.max(0, end - started), charges: Object.freeze({ ...counts }), exhaustion });
      }
    });
    ledgers.set(token, { context, ledger });
    return token;
  }
  function executionBudget(token, context) {
    checkContext(context);
    const entry = ledgers.get(token);
    requireThat(entry && entry.context === context, "SEAM.CONTEXT", "Expected the owning execution budget");
    return entry.ledger;
  }

  // wydgine/sewn/entry.js
  init_validation();
  var entries = /* @__PURE__ */ new WeakMap();
  function createExecutionEntry({ registry, context, handle, kind = "method", name: name4, args = [], caller = null }) {
    checkContext(context);
    const adapter = memberAdapter(handle, context);
    requireThat(adapter, "OBJECT.ACCESS", "Expected a live bound receiver");
    const node = adapter.node(), d = registry.get(node.prototype);
    let program, owner, method;
    if (kind === "hook") {
      program = d.lifecycle[name4];
      owner = d.lifecycleOwners[name4];
      requireThat(program && owner, "PROTOTYPE.LIFECYCLE", "Unknown lifecycle hook");
      method = name4.toLowerCase();
    } else {
      requireThat(kind === "method", "OBJECT.ACCESS", "Invalid entry kind");
      const resolved = registry.method(node.prototype, name4, caller, false, context);
      program = resolved.behavior;
      owner = resolved.owner;
      method = resolved.name;
    }
    const token = Object.freeze(/* @__PURE__ */ Object.create(null));
    entries.set(token, { registry, context, handle, program, owner, name: method, args: clean(args) });
    return token;
  }
  function executionEntry(token, registry, context) {
    const entry = entries.get(token);
    requireThat(entry && entry.registry === registry && entry.context === context, "OBJECT.ACCESS", "Invalid execution entry");
    memberAdapter(entry.handle, context).node();
    return entry;
  }

  // wydgine/sewn/execute.js
  async function execute(document, { scope, context, prototypeRegistry, budget, entry, emit }) {
    checkContext(context);
    const initial = entry ? executionEntry(entry, prototypeRegistry, context) : null;
    const program = validate(initial?.program ?? document), ownedBudget = !budget;
    budget ??= createExecutionBudget(context);
    const ledger = executionBudget(budget, context), bounds = ledger.bounds;
    for (const type of interfaceTypes(program)) {
      ensure(prototypeRegistry, "DENIED");
      prototypeRegistry.interface(type);
    }
    let active = true, procedureDepth = 0, liveVariables = 0;
    const deadline = ledger.deadline, refs = /* @__PURE__ */ new WeakMap();
    let immutable = /* @__PURE__ */ new Set(), vars = /* @__PURE__ */ new Map(), variableTypes = /* @__PURE__ */ new Map(), bodyDepth = 0, receiver = null, frameProgram = program, declaring = null;
    const activeCalls = /* @__PURE__ */ new Set();
    const tick = () => {
      ensure(active, "LIMIT");
      ledger.take("steps");
    };
    let regexRun;
    const recoverable = (error) => error instanceof WydgitError && (error.code === "SEWN.TYPE" || [REGEX_SCHEMA, DO_SCHEMA, INTERFACE_SCHEMA, DATE_SCHEMA].includes(frameProgram.schema) && error.code === "SEWN.REGEX");
    const builders = construction(prototypeRegistry, context, bounds, tick, ledger);
    const ref = (value, kind, view = null) => {
      const token = Object.freeze(/* @__PURE__ */ Object.create(null));
      refs.set(token, { value, kind, view });
      return token;
    };
    const data = (value) => {
      if (brand(value)) return value;
      let result;
      try {
        result = clean(value);
        const restore = (original, copy) => {
          if (brand(original)) return original;
          if (copy && typeof copy === "object") for (const k2 of Object.keys(copy)) copy[k2] = restore(original[k2], copy[k2]);
          return copy;
        };
        result = restore(value, result);
      } catch {
        fail("TYPE");
      }
      let count = 0;
      const walk = (v, d = 0) => {
        ensure(d <= bounds.expressionDepth && ++count <= bounds.valueNodes, "LIMIT");
        if (typeof v === "string") ensure(v.length <= bounds.string, "LIMIT");
        if (v && typeof v === "object") Object.values(v).forEach((x2) => walk(x2, d + 1));
      };
      walk(result);
      return freeze(result);
    };
    const safe = (value) => refs.has(value) ? value : Array.isArray(value) ? (ensure(value.length <= bounds.valueNodes, "LIMIT"), Object.freeze(value.map(safe))) : data(value);
    const store = (n, v, declare = false, type = null) => {
      ensure(!immutable.has(n), "TYPE");
      ensure(declare ? !vars.has(n) : vars.has(n), "TYPE");
      if (declare) ensure(liveVariables < bounds.variables, "LIMIT");
      const contract2 = type ?? variableTypes.get(n), value = contract2 ? typed(v, contract2) : safe(v);
      if (declare) liveVariables++;
      if (type) variableTypes.set(n, type);
      vars.set(n, value);
    };
    const json = (v) => {
      const visit = (x2) => {
        ensure(!refs.has(x2), "TYPE");
        if (x2 && typeof x2 === "object") Object.values(x2).forEach(visit);
      };
      visit(v);
      const encode = (x2) => {
        if (brand(x2)) return external(x2);
        if (Array.isArray(x2)) return x2.map(encode);
        if (x2 && typeof x2 === "object") return Object.fromEntries(Object.entries(x2).map(([k2, v2]) => [k2, encode(v2)]));
        return x2;
      };
      return data(encode(v));
    };
    const member = (target, key) => {
      ensure(safeKey(key) || Number.isSafeInteger(key) && key >= 0, "DENIED");
      const r = refs.get(target);
      if (r) {
        ensure(!r.view, "DENIED");
        if (r.kind === "handle") memberAdapter(r.value, context);
        if (r.kind === "handle" && builders.has(r.value)) builders.check(r.value);
        ensure(reads[r.kind]?.includes(key), "DENIED");
        const v = r.value[key];
        if (key === "Source" || key === "Target") return ref(v, "handle");
        if (["Query", "Form"].includes(key)) return ref(v, "map");
        if (key === "Cookies") return ref(v, r.kind === "RESPONSE" ? "cookieWrite" : "cookieRead");
        if (key === "Headers") return ref(v, "headers");
        return data(v);
      }
      ensure(!brand(target) && target !== null && typeof target === "object", "TYPE");
      if (Array.isArray(target)) ensure(Number.isSafeInteger(key) && key >= 0 && key < target.length, "TYPE");
      else ensure(Object.hasOwn(target, key), "TYPE");
      return safe(target[key]);
    };
    const call = async (target, method2, args) => {
      tick();
      const r = refs.get(target);
      if (r?.kind === "handle") memberAdapter(r.value, context);
      ensure(!r?.view, "DENIED");
      const rule = r && methods[r.kind]?.[method2];
      ensure(rule && args.length >= rule[0] && args.length <= rule[1], "DENIED");
      const draftIndex = r.kind === "handle" ? method2 === "Insert" ? 2 : method2 === "Replace" ? 0 : -1 : -1;
      const draft = draftIndex >= 0 && refs.get(args[draftIndex]);
      const actual = args.map((v, i) => {
        if (r.kind === "handle" && method2 === "Move" && i === 0 || r.kind === "EVENT" && method2 === "Raise" && i === 1) {
          const h = refs.get(v);
          ensure(h?.kind === "handle", "TYPE");
          return h.value;
        }
        if (i === draftIndex && draft?.kind === "handle" && builders.has(draft.value)) return builders.has(r.value) ? draft.value : builders.envelope(draft.value);
        return json(v);
      });
      if (r.kind === "handle" && ["Insert", "Replace"].includes(method2) && !builders.has(r.value) && !(draft?.kind === "handle" && builders.has(draft.value))) {
        const envelope = (x2) => {
          ensure(x2 && typeof x2 === "object" && !Array.isArray(x2) && Object.keys(x2).every((k2) => ["id", "type", "properties", "slots"].includes(k2)) && typeof x2.id === "string" && typeof x2.type === "string", "TYPE");
          if (prototypeRegistry) for (const key of Object.keys(x2.properties ?? {})) authorizeMember(prototypeRegistry, resolveMember(prototypeRegistry.get(x2.type), "property", key), declaring, context);
          const slots = /* @__PURE__ */ Object.create(null);
          for (const [k2, children] of Object.entries(x2.slots ?? {})) {
            ensure(Array.isArray(children), "TYPE");
            slots[k2] = children.map(envelope);
          }
          return { schema: "wydgit/0.2", id: x2.id, prototype: x2.type, properties: x2.properties ?? {}, slots, provenance: {} };
        };
        const i = method2 === "Insert" ? 2 : 0;
        actual[i] = envelope(actual[i]);
      }
      if (r.kind === "EVENT" && method2 === "Raise" && declaring && prototypeRegistry.get(declaring).component && prototypeRegistry.get(refs.get(receiver).value.prototype).events?.[actual[0]]) {
        ensure(emit && receiver, "DENIED");
        const source = refs.get(args[1]);
        ensure(source?.kind === "handle" && identityValue(args[1]) === identityValue(receiver), "DENIED");
        await emit({ declaring, source: source.value, name: actual[0], payload: actual[2] ?? {}, budget });
        tick();
        return null;
      }
      ensure(typeof r.value[method2] === "function", "DENIED");
      if (r.kind === "handle" && method2 === "Set" && prototypeRegistry) {
        if (memberAdapter(r.value, context)) {
          writeMember(r.value, prototypeRegistry, actual[0], actual[1], true, declaring, context);
          return null;
        }
        const m2 = resolveMember(prototypeRegistry.get(r.value.prototype), "property", actual[0]);
        authorizeMember(prototypeRegistry, m2, declaring, context);
      }
      const value = await r.value[method2](...actual);
      if (draft?.kind === "handle" && builders.has(draft.value) && !builders.has(r.value)) builders.consume(draft.value);
      tick();
      if (method2 === "related") {
        if (Array.isArray(value)) ensure(value.length <= bounds.valueNodes, "LIMIT");
        return Array.isArray(value) ? Object.freeze(value.map((v) => ref(v, "handle"))) : value === null ? null : ref(value, "handle");
      }
      return value === void 0 ? null : data(value);
    };
    const typed = (v, type) => {
      const r = refs.get(v);
      if (interfaceType(type)) {
        prototypeRegistry?.interface(type);
        if (v === null) return null;
        return cast(v, type);
      }
      if (type === "Wydgit") {
        ensure(v === null || r?.kind === "handle", "TYPE");
        if (r) identityValue(v);
        return safe(v);
      }
      ensure(!r, "TYPE");
      if (["Scalar", "DataType", "DateTime"].includes(type)) return contract(safe(v), type);
      ensure(!brand(v), "TYPE");
      json(v);
      const result = safe(v);
      if (["Integer", "Float"].includes(type)) return numericCheck(result, type);
      const actual = result === null ? "Null" : Array.isArray(result) ? "Array" : { string: "String", number: "Number", boolean: "Boolean", object: "Object" }[typeof result];
      ensure(actual === type, "TYPE");
      return result;
    };
    const service = async (n, evaluate = expr) => {
      ledger.take("serviceCalls");
      const input = json(await evaluate(n.input));
      tick();
      ensure(scope.SERVICES, "DENIED");
      const v = n.op.startsWith("canonical") ? await scope.SERVICES.Invoke(n.library, n.apiVersion, n.method, input) : await scope.SERVICES.Call(n.library, n.method, input);
      tick();
      return v;
    };
    const staticTables = /* @__PURE__ */ new WeakMap();
    const staticMethodOf = (p, name4) => {
      if (!staticTables.has(p)) staticTables.set(p, new Map(p.libraries?.flatMap((lib) => Object.entries(lib.methods)) ?? []));
      return staticTables.get(p).get(name4);
    };
    const procedure = async (n, kind, evaluate = expr, calleeProgram = frameProgram, calleeReceiver = receiver, calleeDeclaring = declaring) => {
      tick();
      ledger.take("procedureCalls");
      ensure(procedureDepth < bounds.procedureDepth, "LIMIT");
      const staticMethod = staticMethodOf(calleeProgram, n.name);
      if (staticMethod) {
        calleeReceiver = null;
        calleeDeclaring = null;
        checkMemberCapabilities(staticMethod, context);
      }
      if (calleeDeclaring) checkMemberCapabilities(prototypeRegistry.get(calleeDeclaring).methodRules[n.name] ?? {}, context);
      const proc = calleeProgram.procedures?.[n.name];
      ensure(proc?.kind === kind && n.args.length === proc.params.length, "TYPE");
      ensure(proc.params.length <= bounds.parameters, "LIMIT");
      ensure([STATIC_SCHEMA, REGEX_SCHEMA, DO_SCHEMA, INTERFACE_SCHEMA, DATE_SCHEMA].includes(calleeProgram.schema) || !activeCalls.has(proc), "LIMIT");
      const args = await argumentsIn(n.args, evaluate);
      const values = args.map((v, i) => typed(v, proc.params[i].type));
      activeCalls.add(proc);
      const caller = vars, callerTypes = variableTypes, callerImmutable = immutable, previousProgram = frameProgram, previousReceiver = receiver, previousDeclaring = declaring;
      vars = /* @__PURE__ */ new Map();
      variableTypes = /* @__PURE__ */ new Map();
      immutable = /* @__PURE__ */ new Set();
      frameProgram = calleeProgram;
      receiver = calleeReceiver;
      declaring = calleeDeclaring;
      procedureDepth++;
      try {
        for (let i = 0; i < values.length; i++) store(proc.params[i].name, values[i], true, interfaceType(proc.params[i].type) ? proc.params[i].type : null);
        const result = await body(proc.body, bodyDepth);
        if (kind === "sub") {
          ensure(!result || result.status === "returned" && !result.hasValue, "TYPE");
          return null;
        }
        ensure(result?.status === "returned" && result.hasValue, "TYPE");
        return typed(result.value, proc.returns);
      } finally {
        liveVariables -= vars.size;
        vars = caller;
        variableTypes = callerTypes;
        immutable = callerImmutable;
        procedureDepth--;
        frameProgram = previousProgram;
        receiver = previousReceiver;
        declaring = previousDeclaring;
        activeCalls.delete(proc);
      }
    };
    const method = async (n, kind, evaluate = expr) => {
      const target = await evaluate(n.target), r = refs.get(target);
      ensure(r?.kind === "handle" && prototypeRegistry, "DENIED");
      if (builders.has(r.value)) builders.check(r.value);
      const adapter = memberAdapter(r.value, context);
      if (adapter) {
        adapter.node();
        adapter.executable?.();
      }
      if (r.view) {
        const contract2 = prototypeRegistry.interface(r.view);
        const name4 = n.exact ? n.name : n.name.toLowerCase();
        ensure(Object.hasOwn(contract2.signatures, name4) && contract2.signatures[name4].kind === kind, "DENIED");
      }
      const resolved = prototypeRegistry.method(r.value.prototype, n.name, declaring, n.exact ?? false, context);
      return procedure({ ...n, name: resolved.name }, kind, evaluate, resolved.behavior, r.view ? ref(r.value, "handle") : target, resolved.owner);
    };
    const identityValue = (v) => {
      if (v === null) return null;
      const r = refs.get(v);
      ensure(r?.kind === "handle", "TYPE");
      if (builders.has(r.value)) builders.check(r.value);
      const adapter = memberAdapter(r.value, context);
      if (adapter) return adapter.node();
      ensure(r.value && typeof r.value.id === "string", "TYPE");
      return r.value;
    };
    const implementation = (v, type) => {
      ensure(prototypeRegistry, "DENIED");
      prototypeRegistry.interface(type);
      identityValue(v);
      const r = refs.get(v);
      ensure(r?.kind === "handle", "TYPE");
      const adapter = memberAdapter(r.value, context);
      ensure(adapter, "DENIED");
      const node = adapter.node();
      return prototypeRegistry.implements(node.prototype, type);
    };
    const cast = (v, type) => {
      ensure(implementation(v, type), "TYPE");
      const r = refs.get(v);
      return r.view === type ? v : ref(r.value, "handle", type);
    };
    const identity2 = (a, b2, negate = false) => {
      const left = identityValue(a), right = identityValue(b2);
      return negate ? left !== right : left === right;
    };
    const compare = (a, b2, op) => {
      const x2 = brand(a), y2 = brand(b2);
      if (x2 || y2) {
        if (x2?.type === "DateTime" || y2?.type === "DateTime") {
          if ((a === null || b2 === null) && ["=", "!="].includes(op)) return op === "!=";
          ensure(x2?.type === "DateTime" && y2?.type === "DateTime", "TYPE");
          return compare(x2.value, y2.value, op);
        }
        ensure(["=", "!="].includes(op), "TYPE");
        for (const v of [a, b2]) ensure(brand(v) || v === null || ["string", "number", "boolean"].includes(typeof v), "TYPE");
        const equal = x2?.type === "DataType" && y2?.type === "DataType" && x2.value === y2.value;
        return op === "=" ? equal : !equal;
      }
      ensure(!refs.has(a) && !refs.has(b2), "TYPE");
      if (op === "=" || op === "!=") {
        ensure(a === null || ["string", "number", "boolean"].includes(typeof a), "TYPE");
        ensure(b2 === null || ["string", "number", "boolean"].includes(typeof b2), "TYPE");
        return op === "=" ? a === b2 : a !== b2;
      }
      if (["<", "<=", ">", ">="].includes(op)) {
        ensure(typeof a === typeof b2 && ["string", "number"].includes(typeof a), "TYPE");
        return op === "<" ? a < b2 : op === "<=" ? a <= b2 : op === ">" ? a > b2 : a >= b2;
      }
    };
    const portable = (value) => {
      let nodes = 0;
      const walk = (v) => {
        if (++nodes % 64 === 0) tick();
        ensure(!refs.has(v), "TYPE");
        if (v && typeof v === "object" && !brand(v)) for (const item of Object.values(v)) walk(item);
      };
      walk(value);
      return value;
    };
    const boolean = (v) => {
      ensure(typeof v === "boolean", "TYPE");
      return v;
    };
    const expr = async (n, d = 0) => {
      tick();
      ensure(d <= bounds.expressionDepth, "LIMIT");
      const e = (x2) => expr(x2, d + 1);
      switch (n.op) {
        case "implements":
          return implementation(await e(n.value), n.type);
        case "cast":
          return cast(await e(n.value), n.type);
        case "index": {
          const target = await e(n.target), position = await e(n.index);
          ensure(Array.isArray(target), "TYPE");
          numericCheck(position, "Integer");
          ensure(position >= 0 && position < target.length, "TYPE");
          portable(target);
          return safe(target[position]);
        }
        case "operation": {
          const args = await argumentsIn(n.args, e);
          args.forEach((v) => ensure(!refs.has(v), "TYPE"));
          const extended = [COLLECTION_SCHEMA, STATIC_SCHEMA, REGEX_SCHEMA, DO_SCHEMA, INTERFACE_SCHEMA, DATE_SCHEMA].includes(frameProgram.schema) && ["Length", "Contains", "IndexOf", "Slice", "Join", "Split"].includes(n.name);
          if (extended) args.forEach(portable);
          let result;
          if (frameProgram.schema === DATE_SCHEMA && Object.hasOwn(dateSignatures, n.name)) result = dateOperation(n.name, args, bounds, tick);
          else if ([REGEX_SCHEMA, DO_SCHEMA, INTERFACE_SCHEMA, DATE_SCHEMA].includes(frameProgram.schema) && Object.hasOwn(regexSignatures, n.name)) {
            regexRun ??= (await Promise.resolve().then(() => (init_regex(), regex_exports))).regexOperation(bounds, tick);
            result = regexRun(n.name, args);
          } else result = extended ? collectionOperation(n.name, args, bounds, tick, compare) : operation(n.name, args, bounds, tick);
          tick();
          return data(result);
        }
        case "typeLiteral":
          return descriptor(n.type);
        case "dateTime":
          return dateTime(await e(n.value));
        case "typeCheck": {
          const v = await e(n.value);
          ensure(!refs.has(v), "TYPE");
          if ([COLLECTION_SCHEMA, STATIC_SCHEMA, REGEX_SCHEMA, DO_SCHEMA, INTERFACE_SCHEMA, DATE_SCHEMA].includes(frameProgram.schema) && n.type === "Array") {
            ensure(Array.isArray(v), "TYPE");
            return safe(v);
          }
          return [COLLECTION_SCHEMA, STATIC_SCHEMA, REGEX_SCHEMA, DO_SCHEMA, INTERFACE_SCHEMA, DATE_SCHEMA].includes(frameProgram.schema) ? typed(v, n.type) : contract(v, n.type);
        }
        case "typeOf": {
          const v = await e(n.value);
          if (refs.has(v)) {
            identityValue(v);
            return descriptor("Wydgit");
          }
          return descriptor(observable(safe(v)));
        }
        case "numericCheck":
          return numericCheck(json(await e(n.value)), n.type);
        case "numericPredicate": {
          const v = json(await e(n.value));
          return n.predicate === "IsInteger" ? Number.isInteger(v) : Number.isSafeInteger(v);
        }
        case "numeric":
          return numeric(n.operator, json(await e(n.left)), json(await e(n.right)), n.type);
        case "xor": {
          const a = boolean(await e(n.left)), b2 = boolean(await e(n.right));
          return a !== b2;
        }
        case "identity":
          return identity2(await e(n.left), await e(n.right), n.negate);
        case "convert": {
          const value = await e(n.value);
          ensure(!refs.has(value), "TYPE");
          if (n.mode === "canonical") return data(canonicalConvert(value, n.type));
          if (n.type === "String") {
            ensure(["string", "number", "boolean"].includes(typeof value), "TYPE");
            ensure(typeof value !== "number" || Number.isFinite(value), "TYPE");
            return data(typeof value === "boolean" ? value ? "True" : "False" : String(value));
          }
          ensure(typeof value === "string" || typeof value === "number", "TYPE");
          if (typeof value === "string") ensure(/^[ \t\r\n]*[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?[ \t\r\n]*$/.test(value), "TYPE");
          const number = typeof value === "number" ? value : Number(value);
          ensure(Number.isFinite(number), "TYPE");
          return data(number);
        }
        case "isNull": {
          const v = await e(n.value), r = refs.get(v);
          if (r) {
            ensure(r.kind === "handle", "TYPE");
            if (builders.has(r.value)) builders.check(r.value);
            const adapter = memberAdapter(r.value, context);
            if (adapter) {
              adapter.node();
              adapter.executable?.();
            } else ensure(r.value && typeof r.value.id === "string", "TYPE");
          }
          return n.negate ? v !== null : v === null;
        }
        case "memberRead": {
          const r = refs.get(await e(n.target));
          ensure(r?.kind === "handle" && !r.view && prototypeRegistry, "DENIED");
          return data(readMember(r.value, prototypeRegistry, n.name, n.exact, declaring, context));
        }
        case "newId": {
          ensure(typeof globalThis.crypto?.randomUUID === "function", "DENIED");
          return data("w" + globalThis.crypto.randomUUID().replaceAll("-", ""));
        }
        case "construct":
          return ref(builders.create(n.type, json(await e(n.id))), "handle");
        case "methodValue":
          return method(n, "function", e);
        case "functionCall":
          return procedure(n, "function", e);
        case "canonicalServiceCall":
        case "serviceCall":
          return data(await service(n, e));
        case "array":
          return data((await argumentsIn(n.items, e)).map((v) => {
            json(v);
            return safe(v);
          }));
        case "object": {
          const out = /* @__PURE__ */ Object.create(null);
          for (const [k2, v] of Object.entries(n.fields)) {
            const item = await e(v);
            json(item);
            out[k2] = safe(item);
          }
          return data(out);
        }
        case "literal":
          return data(n.value);
        case "variable":
          ensure(vars.has(n.name), "TYPE");
          return vars.get(n.name);
        case "context": {
          if (n.name === "ME" && receiver) return receiver;
          const v = scope[n.name];
          return n.name === "SESSION" ? data(v) : ref(v, ["ME", "PAGE"].includes(n.name) ? "handle" : n.name);
        }
        case "read":
          return member(await e(n.target), n.key);
        case "invoke":
          return call(await e(n.target), n.method, await argumentsIn(n.args, e));
        case "not":
          return !boolean(await e(n.value));
        case "binary": {
          const a = await e(n.left), op = n.operator;
          if (op === "AND") return boolean(a) && boolean(await e(n.right));
          if (op === "OR") return boolean(a) || boolean(await e(n.right));
          const b2 = await e(n.right);
          if (["=", "!=", "<", "<=", ">", ">="].includes(op)) return compare(a, b2, op);
          ensure(!refs.has(a) && !refs.has(b2), "TYPE");
          if (op === "concat") {
            ensure(typeof a === "string" && typeof b2 === "string", "TYPE");
            return data(a + b2);
          }
          ensure(typeof a === "number" && typeof b2 === "number", "TYPE");
          const v = op === "+" ? a + b2 : op === "-" ? a - b2 : op === "*" ? a * b2 : a / b2;
          ensure(Number.isFinite(v), "TYPE");
          return v;
        }
      }
    };
    const argumentsIn = async (args, e) => {
      const values = [];
      for (const x2 of args) values.push(await e(x2));
      return values;
    };
    const body = async (nodes, depth = 0) => {
      ensure(depth <= bounds.nesting, "LIMIT");
      const previousDepth = bodyDepth;
      bodyDepth = depth;
      try {
        for (const n of nodes) {
          tick();
          switch (n.op) {
            case "constant": {
              const v = typed(await expr(n.value), n.type);
              store(n.name, v, true);
              immutable.add(n.name);
              break;
            }
            case "do": {
              while (true) {
                const condition = boolean(await expr(n.condition));
                if (condition !== (n.mode === "while")) break;
                tick();
                ledger.take("iterations");
                const result = await body(n.body, depth + 1);
                if (result?.status === "exitDo") break;
                if (result) return result;
              }
              break;
            }
            case "exitDo":
              return { status: "exitDo" };
            case "forNumeric": {
              const start = await expr(n.start), end = await expr(n.end), step = await expr(n.step);
              for (const v of [start, end, step]) numericCheck(v, "Float");
              ensure(step !== 0 && !vars.has(n.name), "TYPE");
              ensure(liveVariables < bounds.variables, "LIMIT");
              const type = [start, end, step].every(Number.isSafeInteger) ? "Integer" : "Float";
              liveVariables++;
              immutable.add(n.name);
              try {
                let value = start;
                while (step > 0 ? value <= end : value >= end) {
                  tick();
                  ledger.take("iterations");
                  vars.set(n.name, value === 0 ? 0 : value);
                  const result = await body(n.body, depth + 1);
                  if (result?.status === "exitFor") break;
                  if (result) return result;
                  if (value === end) break;
                  tick();
                  const next = numeric("+", value, step, type);
                  ensure(step > 0 ? next > value : next < value, "TYPE");
                  value = next;
                }
              } finally {
                vars.delete(n.name);
                immutable.delete(n.name);
                liveVariables--;
              }
              break;
            }
            case "select": {
              const value = await expr(n.value);
              if (refs.has(value) || value === null) identityValue(value);
              else ensure(brand(value) || ["string", "number", "boolean"].includes(typeof value), "TYPE");
              let chosen = n.else ?? [];
              let matched = false;
              for (const branch of n.cases) {
                tick();
                for (const test of branch.tests) {
                  tick();
                  const operand = await expr(test.value);
                  if (test.operator === "IS" || test.operator === "IS NOT" ? identity2(value, operand, test.operator === "IS NOT") : compare(value, operand, test.operator)) {
                    chosen = branch.body;
                    matched = true;
                    break;
                  }
                }
                if (matched) break;
              }
              const result = await body(chosen, depth + 1);
              if (result) return result;
              break;
            }
            case "try": {
              let result = null, pending = null;
              try {
                result = await body(n.body, depth + 1);
              } catch (error) {
                if (!recoverable(error)) throw error;
                pending = error;
                if (n.catch) {
                  ensure(!vars.has(n.catch.name), "TYPE");
                  store(n.catch.name, { code: error.code, message: "Invalid value or operation." }, true);
                  try {
                    result = await body(n.catch.body, depth + 1);
                    pending = null;
                  } catch (next) {
                    if (!recoverable(next)) throw next;
                    pending = next;
                  } finally {
                    vars.delete(n.catch.name);
                    liveVariables--;
                  }
                }
              }
              if (n.finally) {
                const cleanup = await body(n.finally, depth + 1);
                if (cleanup) result = cleanup;
              }
              if (pending) throw pending;
              if (result) return result;
              break;
            }
            case "exitFor":
              return { status: "exitFor" };
            case "memberSet": {
              const r = refs.get(await expr(n.target));
              ensure(r?.kind === "handle" && !r.view && prototypeRegistry, "DENIED");
              const value = json(await expr(n.value));
              tick();
              writeMember(r.value, prototypeRegistry, n.name, value, n.exact, declaring, context);
              break;
            }
            case "declare":
            case "set": {
              if (n.op === "set" && n.type) ensure(variableTypes.get(n.name) === n.type, "TYPE");
              store(n.name, await expr(n.value), n.op === "declare", n.op === "declare" ? n.type : null);
              break;
            }
            case "if": {
              const s = await body(boolean(await expr(n.condition)) ? n.then : n.else ?? [], depth + 1);
              if (s) return s;
              break;
            }
            case "forEach": {
              const items = await expr(n.items);
              ensure(Array.isArray(items) && !vars.has(n.name), "TYPE");
              ensure(liveVariables < bounds.variables, "LIMIT");
              liveVariables++;
              try {
                for (const item of items) {
                  tick();
                  ledger.take("iterations");
                  vars.set(n.name, safe(item));
                  const s = await body(n.body, depth + 1);
                  if (s?.status === "exitFor") break;
                  if (s) return s;
                }
              } finally {
                vars.delete(n.name);
                liveVariables--;
              }
              break;
            }
            case "call": {
              const v = await call(await expr(n.target), n.method, await argumentsIn(n.args, expr));
              if (n.into) store(n.into, v, true);
              break;
            }
            case "canonicalService":
            case "service": {
              const v = await service(n);
              if (n.into) store(n.into, data(v), true);
              break;
            }
            case "methodCall":
              await method(n, "sub");
              break;
            case "procedureCall":
              await procedure(n, "sub");
              break;
            case "return": {
              const hasValue = Object.hasOwn(n, "value"), value = hasValue ? await expr(n.value) : null;
              return procedureDepth ? { status: "returned", value, hasValue } : { status: "returned", value: json(value) };
            }
            case "stop":
              return { status: "stopped", value: n.value === void 0 ? null : json(await expr(n.value)) };
          }
        }
        return null;
      } finally {
        bodyDepth = previousDepth;
      }
    };
    let timer;
    try {
      return freeze(await Promise.race([(initial ? procedure({ name: initial.name, args: initial.args.map((value) => ({ op: "literal", value })) }, program.procedures[initial.name].kind, expr, program, ref(initial.handle, "handle"), initial.owner).then((value) => ({ status: "completed", value: json(value) })) : body(program.body)).then((v) => v ?? { status: "completed", value: null }), new Promise((_2, reject) => {
        timer = setTimeout(() => {
          active = false;
          reject(new WydgitError("SEWN.LIMIT", "SEWN execution failed"));
        }, Math.max(1, deadline - Date.now()));
      })]));
    } catch (error) {
      throw new WydgitError(error instanceof WydgitError ? error.code : "SEWN.EXECUTION_FAILED", "SEWN execution failed");
    } finally {
      active = false;
      builders.close();
      clearTimeout(timer);
      if (ownedBudget) ledger.close();
    }
  }

  // wydgine/events/runtime.js
  init_validation();

  // wydgine/events/registry.js
  init_validation();
  var types = ["string", "number", "boolean", "object", "array", "null", "json"];
  var EventRegistry = class {
    #events = /* @__PURE__ */ new Map();
    constructor() {
      for (const [family, names] of Object.entries({ Server: ["Start", "Stop"], Session: ["Start", "Authenticated", "Logout", "Timeout", "End"], Page: ["Start", "Initialize", "Load", "Validate", "Resolve", "PreRender", "Unload"], Client: ["Mount", "Ready", "Unmount"] }))
        for (const name4 of names) this.define(`${family}.${name4}`, { family, fields: {}, cancelable: false });
      this.define("Activate", { family: "Semantic", cancelable: true, fields: { Command: { type: "string", optional: true } } });
      this.define("Change", { family: "Semantic", cancelable: true, fields: { OldValue: { type: "json" }, NewValue: { type: "json" } } });
      this.define("Submit", { family: "Semantic", cancelable: true, fields: {} });
    }
    define(name4, input) {
      requireThat(typeof name4 === "string" && (/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?$/.test(name4) || /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*#[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name4)) && !this.#events.has(name4), "EVENT.INVALID", "Invalid event definition");
      const d = clean(input);
      requireThat(record(d) && Object.keys(d).every((k2) => ["family", "cancelable", "fields"].includes(k2)) && ["Server", "Session", "Page", "Client", "Semantic", "Custom"].includes(d.family) && typeof d.cancelable === "boolean" && record(d.fields), "EVENT.INVALID", "Invalid event schema");
      for (const rule of Object.values(d.fields)) requireThat(record(rule) && Object.keys(rule).every((k2) => ["type", "optional"].includes(k2)) && types.includes(rule.type) && (rule.optional === void 0 || typeof rule.optional === "boolean"), "EVENT.INVALID", "Invalid payload rule");
      requireThat(["Semantic", "Custom"].includes(d.family) || !d.cancelable, "EVENT.INVALID", "Lifecycle cannot cancel");
      this.#events.set(name4, freeze(d));
      return this;
    }
    resolve(name4) {
      const matches = [...this.#events.keys()].filter((key) => key.toLowerCase() === name4.toLowerCase());
      requireThat(matches.length === 1, "EVENT.INVALID", "Unknown or ambiguous event");
      return matches[0];
    }
    get(name4) {
      requireThat(this.#events.has(name4), "EVENT.INVALID", "Unknown event");
      return this.#events.get(name4);
    }
    payload(name4, input) {
      const value = clean(input), d = this.get(name4);
      requireThat(record(value) && JSON.stringify(value).length <= 16384, "EVENT.LIMIT", "Payload limit");
      function depth(v, n = 0) {
        requireThat(n <= 16, "EVENT.LIMIT", "Payload depth");
        if (v && typeof v === "object") Object.values(v).forEach((x2) => depth(x2, n + 1));
      }
      depth(value);
      requireThat(Object.keys(value).every((k2) => Object.hasOwn(d.fields, k2)), "EVENT.INVALID", "Unknown payload field");
      for (const [key, rule] of Object.entries(d.fields)) {
        if (!Object.hasOwn(value, key)) {
          requireThat(rule.optional === true, "EVENT.INVALID", "Missing payload field");
          continue;
        }
        const v = value[key], type = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
        requireThat(rule.type === "json" || rule.type === type, "EVENT.INVALID", "Invalid payload type");
      }
      return freeze(value);
    }
  };

  // wydgine/events/runtime.js
  var safeError = (error) => new WydgitError(error instanceof WydgitError ? error.code : "EVENT.HANDLER_FAILED", "Execution failed");
  function handler(fn) {
    const source = typeof fn === "function" ? Function.prototype.toString.call(fn) : "";
    requireThat(/^(?:async\s+)?(?:function(?:\s+[\w$]+)?\s*)?\(\s*\)/.test(source) && fn.length === 0, "EVENT.INVALID", "Handlers must declare no parameters");
    return fn;
  }
  function createDispatcher({ registry = new EventRegistry(), handlers = [], context, handle, contexts: contexts2 = () => ({}), exists = () => true, defaults = {}, limit = {}, completed = () => false, runtimeTarget = "server", identifiers = {}, reusable = false, canRaise = exists, prototypeRegistry, budget, executor = execute, dynamicHandlers = () => [] }) {
    checkContext(context);
    const records = handlers.map(prepareRuntimeHandler).map((r) => {
      const d = registry.get(r.type);
      requireThat(["Semantic", "Custom"].includes(d.family) || r.source === void 0 || r.source === r.owner, "EVENT.INVALID", "Lifecycle handler owner must be recipient");
      requireThat(typeof r.owner === "string", "EVENT.INVALID", "Missing owner");
      return r;
    });
    const bounds = { queue: 64, dispatches: 256, handlers: 2048, depth: 16, timeMs: 5e3, ...limit };
    for (const key of Object.keys(bounds)) {
      const grant = context.limits[`event${key[0].toUpperCase() + key.slice(1)}`];
      if (grant !== void 0) bounds[key] = Math.min(bounds[key], grant);
      requireThat(Number.isSafeInteger(bounds[key]) && bounds[key] > 0, "EVENT.LIMIT", "Invalid limit");
    }
    let deadline = Date.now() + bounds.timeMs;
    const sharedBudget = budget;
    budget ??= createExecutionBudget(context, { deadline, guard: () => requireThat(!closed, "EVENT.INVALID", "Closed dispatch") });
    let calls = 0, count = 0, closed = false, processing = false, currentDepth = 0, chainBase = -1;
    const queue = [];
    const enqueue = (task) => {
      requireThat(processing && !closed && queue.length < bounds.queue, "EVENT.LIMIT", "No active bounded event chain");
      executionBudget(budget, context).take("eventRaises");
      queue.push({ ...task, payload: registry.payload(task.type, task.payload ?? {}), depth: currentDepth + 1 });
    };
    const deliver = async (task) => {
      executionBudget(budget, context).take("eventDispatches");
      requireThat(Date.now() < deadline && !closed && ++count <= bounds.dispatches && task.depth <= Math.min(bounds.depth, executionBudget(budget, context).bounds.eventDepth), "EVENT.LIMIT", "Dispatch limit");
      currentDepth = task.depth;
      const definition = registry.get(task.type);
      let payload = registry.payload(task.type, task.payload ?? {});
      if (task.type === "Change" && prototypeRegistry) {
        const target = handle(task.target, () => {
        }), rule = prototypeRegistry.get(target.prototype).properties.value;
        if (!rule || (rule.access ?? "public") !== "public" || rule.hidden === true || rule.requires?.length || sensitive(target.prototype, prototypeRegistry)) payload = freeze({ OldValue: "", NewValue: "" });
      }
      const envelope = freeze({ schema: "wydgit.event/0.1", type: task.type, runtime: runtimeTarget, app: context.app, session: identifiers.session ?? null, page: identifiers.page ?? null, source: task.source, target: task.target, payload, cancelable: definition.cancelable });
      const structural = !["Semantic", "Custom"].includes(definition.family);
      requireThat(exists(task.target) && exists(task.source), "EVENT.INVALID", "Stale event target");
      let cancelled = false, handled = false;
      for (const record2 of [...records, ...dynamicHandlers({ budget, enqueue }).map(prepareRuntimeHandler)].filter((r) => r.type === task.type && (r.source ?? r.owner) === task.target)) {
        if (!exists(task.source)) break;
        if (!exists(record2.owner)) continue;
        executionBudget(budget, context).take("eventHandlers");
        requireThat(++calls <= bounds.handlers, "EVENT.LIMIT", "Handler limit");
        if (record2.capability) context.require(record2.capability);
        let active = true;
        const guard = () => requireThat(active && !closed, "EVENT.INVALID", "Stale invocation");
        const event = {
          Type: task.type,
          Source: handle(task.source, guard),
          Target: handle(task.target, guard),
          Payload: payload,
          Cancelable: definition.cancelable,
          get Cancelled() {
            guard();
            return cancelled;
          },
          get Handled() {
            guard();
            return handled;
          },
          set Handled(value) {
            guard();
            requireThat(typeof value === "boolean", "EVENT.INVALID", "Handled must be boolean");
            handled = value;
          },
          Cancel() {
            guard();
            requireThat(definition.cancelable, "EVENT.INVALID", "Event cannot cancel");
            cancelled = true;
          },
          Raise(type, source, payload2 = {}) {
            guard();
            requireThat(typeof type === "string" && !type.includes("#"), "EVENT.DENIED", "Class events require authenticated declaration dispatch");
            context.require("event.custom.raise");
            requireThat(context.scopes.events?.includes(type), "EVENT.DENIED", "Event scope denied");
            requireThat(registry.get(type).family === "Custom", "EVENT.DENIED", "Only custom events may be raised");
            const id = source.id;
            requireThat(canRaise(id), "EVENT.INVALID", "Target is not initialized");
            requireThat(handle(id, guard).id === id && source === handle(id, guard), "EVENT.DENIED", "Expected scoped handle");
            executionBudget(budget, context).take("eventRaises");
            requireThat(queue.length < bounds.queue, "EVENT.LIMIT", "Event queue limit");
            queue.push({ type, source: id, target: id, payload: registry.payload(type, payload2), depth: task.depth + 1 });
          }
        };
        if (task.type === "Change") Object.defineProperties(event, { OldValue: { get() {
          guard();
          return payload.OldValue;
        } }, NewValue: { get() {
          guard();
          return payload.NewValue;
        } } });
        const provided = { ME: handle(record2.owner, guard), EVENT: Object.freeze(event), ...contexts2(guard, task) };
        const scope = new Proxy(Object.freeze(provided), { get(target, key) {
          guard();
          requireThat(Object.hasOwn(target, key), "EVENT.CONTEXT", "Context unavailable");
          return target[key];
        } });
        let timer;
        try {
          await Promise.race([Promise.resolve().then(() => record2.workflow ? executor(record2.workflow, { scope, context, prototypeRegistry, budget, enqueue }) : record2.run.call(scope)), new Promise((_2, reject) => {
            timer = setTimeout(() => reject(new WydgitError("EVENT.LIMIT", "Handler time limit")), Math.max(1, deadline - Date.now()));
          })]);
        } catch (error) {
          throw safeError(error);
        } finally {
          active = false;
          clearTimeout(timer);
        }
        if (completed() || !structural && (cancelled || handled)) break;
      }
      if (!completed() && !cancelled && task.valid !== false && Object.hasOwn(defaults, task.type) && defaults[task.type]) await defaults[task.type](task, payload, context);
      return freeze({ cancelled, handled, envelope: { ...envelope, cancelled, handled } });
    };
    const invoke = async (task) => {
      const restore = executionBudget(budget, context).enterEvent(chainBase + task.depth + 1);
      try {
        return await deliver(task);
      } finally {
        restore();
      }
    };
    return Object.freeze({
      enqueue,
      async dispatch(task) {
        requireThat(!processing && !closed, "EVENT.INVALID", "Recursive dispatch denied");
        if (reusable) {
          deadline = Date.now() + bounds.timeMs;
          calls = 0;
          count = 0;
          if (!sharedBudget) {
            executionBudget(budget, context).close();
            budget = createExecutionBudget(context, { deadline, guard: () => requireThat(!closed, "EVENT.INVALID", "Closed dispatch") });
          }
        }
        chainBase = executionBudget(budget, context).eventDepth();
        processing = true;
        try {
          const result = await invoke({ ...task, depth: 0 });
          while (queue.length) await invoke(queue.shift());
          return result;
        } catch (error) {
          queue.length = 0;
          throw safeError(error);
        } finally {
          processing = false;
        }
      },
      close() {
        closed = true;
        queue.length = 0;
        if (!sharedBudget) executionBudget(budget, context).close();
      }
    });
  }
  function prepareRuntimeHandler(record2) {
    requireThat(record2.wydBasic === void 0 && record2.wydBasicModule === void 0, "EVENT.INVALID", "Client/runtime handlers require compiled SEWN");
    requireThat(["run", "workflow"].filter((key) => record2[key] !== void 0).length === 1, "EVENT.INVALID", "Choose one handler implementation");
    return record2.workflow !== void 0 ? { ...record2, workflow: validate(record2.workflow) } : { ...record2, run: handler(record2.run) };
  }

  // wydgine/execution/component-target.js
  init_validation();
  var placements = { form: ["blocks", "fields"], field: [], section: ["blocks"], block: ["children"], page: ["sections", "navigation"], app: ["pages", "navigation"], navigation: [] };
  function serverKind(id, registry) {
    return Object.keys(placements).find((kind) => registry.isA(id, `wydgit.core/${kind}`));
  }
  function serverPlacement(parent, slot, child, registry) {
    if (!serverKind(child, registry)) return;
    const kind = serverKind(parent, registry), definition = registry.get(parent);
    requireThat(!(kind === "form" && definition.component && definition.presentation), "COMPONENT.TARGET", "Composed Form presentation needs a native field placement contract");
    requireThat(kind && placements[kind].includes(slot), "COMPONENT.TARGET", "This visual slot has no current server renderer placement");
  }
  function serverComponent(definition, registry) {
    requireThat(definition.presentation?.schema !== "wydgit.presentation/0.2", "COMPONENT.TARGET", "Client controls do not imply HTTP form semantics");
    if (definition.presentation) requireThat(["block", "section", "field", "form"].includes(serverKind(definition.id, registry)), "COMPONENT.TARGET", "Presentation is unsupported for this server semantic type");
    for (const child of definition.component?.children ?? []) serverPlacement(definition.id, child.slot, child.type, registry);
    for (const r of definition.component?.repeaters ?? []) {
      const t = definition.component.templates.find((t2) => t2.name === r.template);
      serverPlacement(definition.id, r.slot, t.type, registry);
    }
  }

  // wydgine/execution/instances.js
  init_validation();
  function createInstanceController({ runtime: initial, registry, context, rootId, services, scope = {}, budget: sharedBudget, events: providedEvents, onRuntime, canEdit = () => true, canEmit = () => true, componentPolicy = serverComponent, placementPolicy = serverPlacement, runtimeTarget = "server", present, renderOnInvoke = false }) {
    checkContext(context);
    if (sharedBudget) executionBudget(sharedBudget, context);
    requireThat(context.app === initial.rootId, "SEAM.CONTEXT", "Wrong owning App");
    initial.scope(context, rootId);
    let runtime = initial, closed = false, busy = false, currentBudget = null, dispatcher = null, job = null, hostScope = null, attachedDispatcher = null, externalQueue = null, idle = Promise.resolve(), settleIdle, activationFailed = false;
    const repeated = /* @__PURE__ */ new Map();
    let generation = 0;
    const rows = /* @__PURE__ */ new Map(), retired = /* @__PURE__ */ new Set(), pending = [], errors = [], events = providedEvents ?? new EventRegistry();
    const tree = (id = rootId, state = runtime) => {
      const ids = [];
      const walk = (key, depth = 0) => {
        requireThat(depth <= 32 && ids.length < 256, "OBJECT.LIMIT", "Component tree bound");
        ids.push(key);
        const node = state.get(key);
        componentPolicy(registry.get(node.prototype), registry);
        for (const [slot, children] of Object.entries(node.slots)) for (const child of children) {
          placementPolicy(node.prototype, slot, state.get(child).prototype, registry);
          if (rootId === state.rootId && registry.isA(state.get(child).prototype, "wydgit.core/page")) continue;
          walk(child, depth + 1);
        }
      };
      walk(id);
      return ids;
    };
    const register = () => {
      for (const id of tree()) if (!rows.has(id)) {
        requireThat(rows.size < 4096, "OBJECT.LIMIT", "Instance lifetime allocation bound");
        requireThat(!retired.has(id), "OBJECT.ACCESS", "Retired identity cannot be reused");
        rows.set(id, { state: "constructed", init: false, loaded: false, node: runtime.get(id) });
      }
    };
    register();
    const live = (id) => rows.has(id) && !["disposed", "disposing", "unloading", "failed"].includes(rows.get(id).state) && !closed;
    const row = (id) => {
      requireThat(rows.has(id), "OBJECT.ACCESS", "Unknown owned instance");
      return rows.get(id);
    };
    const actual = (id) => {
      if (id === pageId && !rows.has(id)) return runtime.get(id);
      const r = row(id);
      return ["disposing", "disposed"].includes(r.state) ? r.node : runtime.get(id);
    };
    const ancestry = /* @__PURE__ */ new Map();
    const index = (id) => {
      for (const child of Object.values(initial.get(id).slots).flat()) {
        ancestry.set(child, id);
        index(child);
      }
    };
    index(initial.rootId);
    let pageId = rootId;
    while (pageId && !registry.isA(initial.get(pageId).prototype, "wydgit.core/page")) pageId = ancestry.get(pageId);
    const handles = /* @__PURE__ */ new WeakMap();
    const handle = (id, guard = () => {
    }, role = "application", own = null) => {
      let cache = handles.get(guard);
      if (!cache) {
        cache = /* @__PURE__ */ new Map();
        handles.set(guard, cache);
      }
      const key = id + ":" + role;
      if (cache.has(key)) return cache.get(key);
      const assert = () => {
        guard();
        requireThat(!closed && matchesObjectGrant(context.visible, id), "OBJECT.ACCESS", "Invisible or disposed instance");
        if (id === pageId && !rows.has(id)) return;
        const r = row(id);
        requireThat(role === "cleanup" && id === own && ["disposing", "unloading"].includes(r.state) || live(id) && (!["constructed", "initializing"].includes(r.state) || role === "hook" && id === own), "OBJECT.ACCESS", "Instance is not executable");
      };
      const edit = (operation3, ...args) => {
        assert();
        requireThat(canEdit(), "EVENT.DENIED", "Tree is read-only");
        requireThat(role !== "cleanup", "OBJECT.ACCESS", "Cleanup cannot change containment");
        const before = tree(), session = runtime.edit(context);
        session[operation3](id, ...args);
        const next = session.commit().runtime;
        const after = tree(rootId, next);
        requireThat(after.includes(rootId), "OBJECT.ACCESS", "Execution root cannot be detached");
        requireThat(after.every((key2) => rows.has(key2) || !retired.has(key2)), "OBJECT.ACCESS", "Retired identity cannot be reused");
        const removed = before.filter((key2) => !after.includes(key2));
        for (const key2 of removed) {
          const r = row(key2);
          r.node = runtime.get(key2);
          r.previous = r.state;
          r.state = "disposing";
          retired.add(key2);
        }
        runtime = next;
        publish();
        pending.push(...removed.reverse());
        register();
      };
      const set = (name4, value) => {
        assert();
        if (role === "cleanup") {
          requireThat(context.capabilities.includes("object.instances.edit") && matchesObjectGrant(context.editable, id), "MUTATION.DENIED", "Cleanup property mutation denied");
          const r = row(id);
          if (r.state === "unloading") {
            const session = runtime.edit(context);
            session.setProperty(id, name4, value);
            runtime = session.commit().runtime;
            publish();
            return;
          }
          r.node = { ...r.node, properties: freeze(resolveProperties({ ...r.node.properties, [name4]: clean(value) }, registry.get(r.node.prototype))) };
          return;
        }
        edit("setProperty", name4, value);
      };
      const result = Object.freeze({
        get id() {
          assert();
          return id;
        },
        get prototype() {
          assert();
          return actual(id).prototype;
        },
        get properties() {
          assert();
          return publicProperties(actual(id), registry);
        },
        FormState(operation3, data) {
          assert();
          requireThat(role !== "cleanup" && registry.isA(actual(id).prototype, "wydgit.core/form"), "FORM.OPERATION", "Receiver must be a live Form");
          requireThat(context.traversal.includes("children"), "SEAM.TRAVERSAL", "Form traversal denied");
          const fields2 = descendantFields(runtime, registry, id, context);
          requireThat(fields2.every((f) => matchesObjectGrant(context.visible, f.id)), "SEAM.VISIBILITY", "Invisible Form field");
          const changes = [];
          const value = formOperation(fields2, registry, operation3, data, (id2, p) => changes.push([id2, p]));
          if (operation3 === "validate") changes.push([id, { valid: value }]);
          if (operation3 === "clear") changes.push([id, { valid: true }]);
          if (changes.length) {
            const session = runtime.edit(context);
            for (const [key2, properties] of changes) for (const [name4, value2] of Object.entries(properties)) session.setProperty(key2, name4, value2);
            runtime = session.commit().runtime;
            publish();
          }
          return value;
        },
        Set(name4, value) {
          assert();
          authorizeMember(registry, resolveMember(registry.get(actual(id).prototype), "property", name4), null, context);
          set(name4, value);
        },
        related(relation, slot) {
          assert();
          if (relation === "child") {
            requireThat(role !== "cleanup" && context.traversal.includes("children"), "SEAM.TRAVERSAL", "Child traversal denied");
            const d = registry.get(actual(id).prototype), child = d.component?.children.find((c2) => c2.name === slot);
            requireThat(child && Object.hasOwn(actual(id).slots, child.slot), "OBJECT.ACCESS", "Unknown declared child");
            const ids = actual(id).slots[child.slot].filter((key2) => key2 === `${id}-${child.name}` && registry.isA(runtime.get(key2).prototype, child.type));
            requireThat(ids.length === 1, "OBJECT.ACCESS", "Declared ownership no longer exists");
            return handle(ids[0], guard, role, own);
          }
          requireThat(role !== "cleanup", "OBJECT.ACCESS", "Cleanup cannot traverse");
          const related = runtime.scope(context, id).related(relation, slot), wrap = (value) => {
            requireThat(rows.has(value.id), "OBJECT.ACCESS", "Outside component root");
            return handle(value.id, guard, role, own);
          };
          return Array.isArray(related) ? Object.freeze(related.map(wrap)) : related ? wrap(related) : null;
        },
        Insert(slot, index2, envelope) {
          edit("insertChild", slot, index2, envelope);
        },
        Remove() {
          requireThat(id !== rootId, "OBJECT.ACCESS", "Root removal is host-controlled");
          edit("remove");
        },
        Replace(envelope) {
          requireThat(id !== rootId, "OBJECT.ACCESS", "Root replacement is host-controlled");
          edit("replaceChild", envelope);
        },
        Move(parent, slot, index2) {
          requireThat(memberAdapter(parent, context), "OBJECT.ACCESS", "Foreign parent");
          requireThat(rows.has(parent.id), "OBJECT.ACCESS", "Outside component root");
          edit("moveChild", parent.id, slot, index2);
        }
      });
      bindMembers(result, { context, node: () => {
        assert();
        return actual(id);
      }, read: (name4) => {
        assert();
        return name4 === "value" && registry.isA(actual(id).prototype, "wydgit.core/password-input") ? "" : actual(id).properties[name4];
      }, set });
      cache.set(key, result);
      return result;
    };
    const publish = () => {
      onRuntime?.(runtime);
    };
    const eventTypes = /* @__PURE__ */ new Map();
    const typeFor = (prototype, name4) => {
      const d = registry.get(prototype), owner = d.eventOwners[name4], key = owner + ":" + name4;
      if (!eventTypes.has(key)) {
        const type = `${owner}#${name4}`, fields2 = Object.fromEntries(d.events[name4].params.map((p) => [p.name, { type: { Integer: "number", Float: "number", Number: "number", String: "string", Boolean: "boolean", Null: "null", Object: "object", Array: "array" }[p.type] }]));
        let existing;
        try {
          existing = events.get(type);
        } catch {
        }
        if (existing) requireThat(existing.family === "Custom" && existing.cancelable === true && JSON.stringify(existing.fields) === JSON.stringify(clean(fields2)), "EVENT.INVALID", "Conflicting declared event contract");
        else events.define(type, { family: "Custom", cancelable: true, fields: fields2 });
        eventTypes.set(key, type);
      }
      return eventTypes.get(key);
    };
    try {
      events.get("wydgit.core/invocation#Run");
    } catch {
      events.define("wydgit.core/invocation#Run", { family: "Custom", cancelable: false, fields: {} });
    }
    for (const id of tree()) for (const name4 of Object.keys(registry.get(actual(id).prototype).events)) typeFor(actual(id).prototype, name4);
    const hook = (id, name4) => registry.get(actual(id).prototype).lifecycle[name4];
    const entryRun = async (id, kind, name4, args = [], caller = null, event = null) => {
      const r = row(id), role = kind === "hook" ? ["disposing", "unloading"].includes(r.state) ? "cleanup" : "hook" : "application";
      let active = true;
      const guard = () => {
        requireThat(active && !closed, "OBJECT.ACCESS", "Expired invocation");
        executionBudget(currentBudget, context).check();
      };
      try {
        const receiver = handle(id, guard, role, id), entry = kind === "workflow" ? null : createExecutionEntry({ registry, context, handle: receiver, kind, name: name4, args, caller });
        return await execute(kind === "workflow" ? job.document : null, { scope: { ...scope, ...hostScope, ...kind === "workflow" ? job.scope : {}, ME: receiver, EVENT: event ?? {}, ...services ? { SERVICES: services } : {} }, context, prototypeRegistry: registry, budget: currentBudget, entry, emit: async (request) => {
          guard();
          const source = memberAdapter(request.source, context).node(), definition = registry.get(source.prototype), contract2 = definition.events[request.name], owner = definition.eventOwners[request.name];
          requireThat(canEmit() && live(source.id) && row(source.id).state === "active" && contract2 && registry.verifiedPublisher(owner) === registry.get(owner).publisher, "EVENT.DENIED", "No live authenticated event source");
          authorizeMember(registry, { owner, rule: contract2 }, request.declaring, context);
          context.require("event.custom.raise");
          requireThat(context.scopes.events?.includes(request.name.toLowerCase()), "EVENT.DENIED", "Typed event scope denied");
          for (const p of contract2.params) {
            const value = request.payload[p.name];
            requireThat(p.type !== "Integer" || Number.isSafeInteger(value), "EVENT.INVALID", "Invalid Integer payload");
          }
          const type = typeFor(source.prototype, request.name);
          const task = { type, source: source.id, target: source.id, payload: request.payload };
          if (externalQueue) externalQueue(task);
          else (attachedDispatcher ?? dispatcher).enqueue(task);
        } });
      } finally {
        active = false;
      }
    };
    const bindingRecords = ({ budget: incomingBudget, enqueue } = {}) => {
      const records = [];
      for (const id of tree()) {
        if (row(id).state !== "active") continue;
        const d = registry.get(actual(id).prototype);
        for (const b2 of d.component?.subscriptions ?? []) {
          if (["Server", "Session"].includes(b2.source)) continue;
          const child = b2.source === "Page" || b2.source === "Me" ? null : d.component.children.find((c2) => c2.name === b2.source), source = child ? `${id}-${child.name}` : id;
          if (child) {
            requireThat(context.traversal.includes("children") && matchesObjectGrant(context.visible, id) && matchesObjectGrant(context.visible, source), "EVENT.DENIED", "Child subscription visibility/traversal denied");
            if (!actual(id).slots[child.slot]?.includes(source) || !rows.has(source) || !registry.isA(actual(source).prototype, child.type)) continue;
          }
          const type = b2.source === "Page" ? `Page.${b2.event}` : typeFor(child?.type ?? d.id, b2.event);
          requireThat(records.length < 2048, "EVENT.LIMIT", "Subscription registration bound");
          records.push({ owner: id, ...child ? { source } : {}, type, run: async function() {
            const event = this.EVENT, work = async () => {
              if (row(id).state !== "active" || child && !actual(id).slots[child.slot]?.includes(source)) return;
              const params = b2.source === "Page" ? [] : registry.get(child?.type ?? d.id).events[b2.event].params;
              await entryRun(id, "method", b2.handler, params.map((p) => event.Payload[p.name]), b2.owner, event);
            };
            if (incomingBudget) {
              const deliver = async () => {
                const previous = externalQueue;
                externalQueue = enqueue;
                try {
                  await work();
                  await activate();
                  await reconcile();
                } finally {
                  externalQueue = previous;
                }
              };
              if (busy) {
                requireThat(incomingBudget === currentBudget, "EVENT.DENIED", "Mismatched event budget");
                await deliver();
              } else await operation2(deliver, incomingBudget);
            } else await work();
          } });
        }
      }
      return records;
    };
    const kernelRecords = () => tree().map((id) => ({ owner: id, type: "wydgit.core/invocation#Run", run: async function() {
      requireThat(job && job.id === id, "EVENT.DENIED", "Invalid trusted invocation");
      job.result = await entryRun(id, job.kind, job.name, job.args, job.caller, job.kind === "workflow" ? job.scope.EVENT : job.event ?? {});
    } }));
    const buildDispatcher = () => createDispatcher({ registry: events, handlers: kernelRecords(), dynamicHandlers: () => bindingRecords(), runtimeTarget, context, prototypeRegistry: registry, budget: currentBudget, handle, exists: (id) => id === pageId || live(id), contexts: () => scope });
    const dispatchEntry = async (id, kind, name4, args = [], caller = null, extra = {}) => {
      if (kind === "hook" && !hook(id, name4)) return;
      if (externalQueue) {
        const previous = job;
        job = { id, kind, name: name4, args, caller, result: null, ...extra };
        try {
          return await entryRun(id, kind, name4, args, caller, extra.scope?.EVENT ?? {});
        } finally {
          job = previous;
        }
      }
      job = { id, kind, name: name4, args, caller, result: null, ...extra };
      if (!attachedDispatcher) {
        dispatcher?.close();
        dispatcher = buildDispatcher();
      }
      try {
        await (attachedDispatcher ?? dispatcher).dispatch({ type: "wydgit.core/invocation#Run", source: id, target: id, payload: {} });
        return job.result;
      } finally {
        job = null;
      }
    };
    const cleanup = async (id) => {
      const r = row(id);
      if (r.state === "disposed") return;
      r.state = "disposing";
      retired.add(id);
      for (const name4 of [...r.loaded ? ["Unload"] : [], "Dispose"]) try {
        if (hook(id, name4)) await entryRun(id, "hook", name4);
      } catch (error) {
        if (errors.length < 256) errors.push(safeError(error).toJSON());
      }
      r.loaded = false;
      r.state = "disposed";
    };
    const drain = async () => {
      while (pending.length) await cleanup(pending.shift());
    };
    const envelopeFor = (type, id, properties, depth = 0) => {
      requireThat(depth <= 32 && id.length <= 128, "OBJECT.LIMIT", "Template construction bound");
      context.require("object.instances.construct");
      requireThat(context.scopes.prototypes?.includes(type), "SEAM.DENIED", "Template prototype scope denied");
      const ledger = executionBudget(currentBudget, context);
      ledger.take("drafts");
      ledger.take("draftNodes");
      ledger.take("constructionOperations");
      const d = registry.get(type), slots = Object.fromEntries(Object.keys(d.slots).map((slot) => [slot, []]));
      for (const child of d.component?.children ?? []) slots[child.slot].push(envelopeFor(child.type, `${id}-${child.name}`, child.properties, depth + 1));
      return { schema: "wydgit/0.2", id, prototype: type, properties: resolveProperties(properties, d), slots, provenance: {} };
    };
    const reconcile = async () => {
      let rounds = 0;
      while (true) {
        requireThat(++rounds <= 32, "OBJECT.LIMIT", "Repeater nesting bound");
        let added = false;
        for (const id of tree()) {
          if (!live(id)) continue;
          const d = registry.get(runtime.get(id).prototype);
          for (const repeater of d.component?.repeaters ?? []) {
            const definition = d.component.templates.find((t) => t.name === repeater.template), model = registry.get(definition.model), target = registry.get(definition.type), input = runtime.get(id).properties[repeater.property];
            requireThat(Array.isArray(input) && input.length <= repeater.limit, "OBJECT.LIMIT", "Repeater item bound");
            const keys = /* @__PURE__ */ new Set(), values = input.map((value) => {
              executionBudget(currentBudget, context).take("steps");
              const item = resolveProperties(value, model), key = item[definition.key];
              requireThat(typeof key === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(key) && !keys.has(key), "OBJECT.IDENTITY", "Invalid or duplicate repeater key");
              keys.add(key);
              return { key, properties: Object.fromEntries(definition.bindings.map((b2) => [b2.property, item[b2.input]])) };
            });
            const token = id + ":" + repeater.template, previous = repeated.get(token) ?? /* @__PURE__ */ new Map(), next = /* @__PURE__ */ new Map(), children = [...runtime.get(id).slots[repeater.slot]], desired = values.map((item) => {
              const old = previous.get(item.key);
              const child = old ?? `${id}-${repeater.template}-${item.key}-${++generation}`;
              requireThat(child.length <= 128, "OBJECT.LIMIT", "Expanded identity bound");
              next.set(item.key, child);
              return { ...item, id: child, created: !old };
            });
            if (children.length === desired.length && desired.every((item, index2) => !item.created && children[index2] === item.id && Object.entries(item.properties).every(([key, value]) => JSON.stringify(runtime.get(item.id).properties[key]) === JSON.stringify(value)))) {
              repeated.set(token, next);
              continue;
            }
            if (!desired.length && !children.length) {
              repeated.set(token, next);
              continue;
            }
            context.require("object.instances.edit");
            const edit = runtime.edit(context), removed = children.filter((child) => !desired.some((item) => item.id === child));
            for (const child of removed) {
              edit.remove(child);
              children.splice(children.indexOf(child), 1);
            }
            for (let index2 = 0; index2 < desired.length; index2++) {
              const item = desired[index2];
              if (item.created) {
                const envelope = envelopeFor(definition.type, item.id, item.properties);
                edit.insertChild(id, repeater.slot, index2, envelope);
                children.splice(index2, 0, item.id);
                added = true;
              } else {
                for (const [name4, value] of Object.entries(item.properties)) edit.setProperty(item.id, name4, value);
                const position = children.indexOf(item.id);
                requireThat(position >= 0, "OBJECT.ACCESS", "Repeater ownership changed");
                if (position !== index2) {
                  edit.moveChild(item.id, id, repeater.slot, index2);
                  children.splice(position, 1);
                  children.splice(index2, 0, item.id);
                }
              }
            }
            const nextRuntime = edit.commit().runtime;
            tree(rootId, nextRuntime);
            for (const child of removed) for (const key of tree(child).reverse()) {
              const r = row(key);
              r.node = runtime.get(key);
              r.state = "disposing";
              retired.add(key);
              pending.push(key);
            }
            runtime = nextRuntime;
            publish();
            repeated.set(token, next);
            register();
            await drain();
          }
        }
        if (!added) break;
        await activate();
      }
    };
    const operation2 = async (work, providedBudget, entryGuard) => {
      if (providedBudget) executionBudget(providedBudget, context);
      requireThat(!closed && !busy, "OBJECT.ACCESS", "Controller is closed or busy");
      busy = true;
      idle = new Promise((resolve) => settleIdle = resolve);
      currentBudget = providedBudget ?? sharedBudget ?? createExecutionBudget(context, { guard: () => {
        requireThat(!closed, "OBJECT.ACCESS", "Controller closed");
        entryGuard?.();
      } });
      try {
        const result = await work();
        if (present) await present(runtime, executionBudget(currentBudget, context));
        return result;
      } finally {
        if (activationFailed) for (const id of tree().reverse()) {
          const r = row(id);
          if (r.state !== "disposed") {
            r.node = runtime.get(id);
            r.state = "disposing";
            retired.add(id);
            pending.push(id);
          }
        }
        await drain();
        if (activationFailed) closed = true;
        dispatcher?.close();
        dispatcher = null;
        if (!sharedBudget && !providedBudget) executionBudget(currentBudget, context).close();
        currentBudget = null;
        busy = false;
        settleIdle();
      }
    };
    const initialize = async () => {
      for (const id of tree()) {
        const r = row(id);
        if (r.init) continue;
        r.init = true;
        r.state = "initializing";
        try {
          await dispatchEntry(id, "hook", "Init");
          r.state = "initialized";
        } catch (error) {
          activationFailed = true;
          r.state = "failed";
          r.node = runtime.get(id);
          pending.push(id);
          throw error;
        }
      }
    };
    const activate = async () => {
      await initialize();
      for (const id of tree()) {
        const r = row(id);
        if (r.state === "active") continue;
        requireThat(r.state === "initialized", "OBJECT.ACCESS", "Invalid activation");
        r.state = "preloading";
        r.loaded = true;
        try {
          await dispatchEntry(id, "hook", "Preload");
          r.state = "active";
        } catch (error) {
          activationFailed = true;
          r.state = "failed";
          r.node = runtime.get(id);
          pending.push(id);
          throw error;
        }
      }
    };
    return Object.freeze({
      attachDispatcher: (value) => {
        requireThat(!busy && !closed && !attachedDispatcher, "OBJECT.ACCESS", "Invalid dispatcher attachment");
        attachedDispatcher = value;
      },
      handlers: (options) => [...kernelRecords(), ...bindingRecords(options)],
      adopt: (next) => {
        if (next === runtime) return;
        requireThat(!busy && !closed && next.rootId === runtime.rootId, "OBJECT.ACCESS", "Invalid runtime adoption");
        const before = tree(), after = tree(rootId, next);
        requireThat(after.every((id) => rows.has(id) || !retired.has(id)), "OBJECT.ACCESS", "Retired identity cannot be reused");
        for (const id of before.filter((id2) => !after.includes(id2)).reverse()) {
          const r = row(id);
          r.node = runtime.get(id);
          r.state = "disposing";
          retired.add(id);
          pending.push(id);
        }
        runtime = next;
        register();
      },
      executable: (id) => live(id) && row(id).state === "active",
      workflow: (document, invocationScope, id, options = {}) => operation2(async () => {
        requireThat(row(id).state === "active", "OBJECT.ACCESS", "Inactive instance");
        externalQueue = options.enqueue ?? null;
        try {
          const value = await dispatchEntry(id, "workflow", null, [], null, { document, scope: invocationScope });
          await drain();
          await activate();
          await reconcile();
          return value;
        } finally {
          externalQueue = null;
        }
      }, options.budget),
      activate: () => operation2(async () => {
        try {
          const previouslyActive = new Set(tree().filter((id) => row(id).state === "active"));
          await activate();
          await reconcile();
          for (const id of tree()) if (!previouslyActive.has(id)) await dispatchEntry(id, "hook", "Render");
          await reconcile();
          bindingRecords();
        } catch (error) {
          for (const id of tree().reverse()) {
            const r = row(id);
            if (r.state !== "disposed") {
              r.node = runtime.get(id);
              r.state = "disposing";
              pending.push(id);
            }
          }
          throw safeError(error);
        }
      }),
      invoke: (id, name4, args = [], options = {}) => operation2(async () => {
        if (options.prepare) args = options.prepare(executionBudget(currentBudget, context));
        requireThat(row(id).state === "active", "OBJECT.ACCESS", "Inactive instance");
        const value = await dispatchEntry(id, "method", name4, clean(args));
        await drain();
        await activate();
        await reconcile();
        if (renderOnInvoke) {
          for (const key of tree()) await dispatchEntry(key, "hook", "Render");
          await reconcile();
        }
        return value;
      }, void 0, options.guard),
      render: () => operation2(async () => {
        for (const id of tree()) {
          requireThat(row(id).state === "active", "OBJECT.ACCESS", "Inactive instance");
          await dispatchEntry(id, "hook", "Render");
        }
        await reconcile();
        return dehydrate(runtime);
      }),
      hostEvent: (type, options) => operation2(async () => {
        requireThat(rootId === runtime.rootId && registry.isA(actual(rootId).prototype, "wydgit.core/app") && registry.verifiedPublisher(actual(rootId).prototype) === registry.get(actual(rootId).prototype).publisher, "EVENT.DENIED", "Host event receiver is not the verified App root");
        context.require("event.lifecycle.subscribe");
        requireThat(context.scopes.events?.includes(type.toLowerCase()) && options.scope.SERVER.App === context.app, "EVENT.DENIED", "Host event scope denied");
        const [source, event] = type.split("."), d = registry.get(actual(rootId).prototype);
        requireThat(["Server", "Session"].includes(source), "EVENT.DENIED", "Invalid host source");
        hostScope = options.scope;
        try {
          for (const b2 of d.component?.subscriptions ?? []) if (b2.source === source && b2.event === event) {
            requireThat(row(rootId).state === "active", "OBJECT.ACCESS", "Inactive App");
            const guard = () => executionBudget(currentBudget, context).check();
            const original = options.scope.EVENT;
            const event2 = Object.freeze({ ...original, Source: handle(rootId, guard), Target: handle(rootId, guard) });
            job = { id: rootId, kind: "method", name: b2.handler, args: [], caller: b2.owner, event: event2, result: null };
            dispatcher = buildDispatcher();
            await dispatcher.dispatch({ type: "wydgit.core/invocation#Run", source: rootId, target: rootId, payload: {} });
          }
        } finally {
          hostScope = null;
          job = null;
        }
      }, options.budget),
      page: (name4, targetId) => operation2(async () => {
        requireThat(pageId, "EVENT.DENIED", "No owning Page");
        requireThat(["Start", "Initialize", "Load", "Validate", "PreRender", "Unload"].includes(name4), "EVENT.DENIED", "Unsupported host Page event");
        dispatcher = buildDispatcher();
        for (const id of tree().filter((id2) => targetId === void 0 || id2 === targetId)) if (live(id) && registry.get(actual(id).prototype).component?.subscriptions.some((b2) => b2.source === "Page" && b2.event === name4)) await dispatcher.dispatch({ type: `Page.${name4}`, source: pageId, target: id, payload: {} });
        if (name4 !== "Unload") {
          await activate();
          await reconcile();
        }
      }),
      unload: async () => {
        if (busy) {
          executionBudget(currentBudget, context).close();
          await idle;
        }
        return operation2(async () => {
          if (runtimeTarget === "client") try {
            dispatcher = buildDispatcher();
            for (const id of tree()) if (row(id).state === "active" && registry.get(actual(id).prototype).component?.subscriptions.some((b2) => b2.source === "Page" && b2.event === "Unload")) await dispatcher.dispatch({ type: "Page.Unload", source: pageId, target: id, payload: {} });
          } catch (error) {
            if (errors.length < 256) errors.push(safeError(error).toJSON());
          }
          for (const id of tree().reverse()) {
            const r = row(id);
            if (r.state !== "active") continue;
            r.state = "unloading";
            r.node = runtime.get(id);
            try {
              if (hook(id, "Unload")) await entryRun(id, "hook", "Unload");
            } catch (error) {
              if (errors.length < 256) errors.push(safeError(error).toJSON());
            } finally {
              r.loaded = false;
              r.state = "initialized";
            }
          }
        });
      },
      dispose: async () => {
        if (closed) return;
        if (busy) {
          for (const id of tree().reverse()) {
            const r = row(id);
            r.node = runtime.get(id);
            r.state = "disposing";
            retired.add(id);
            pending.push(id);
          }
          executionBudget(currentBudget, context).close();
          await idle;
          closed = true;
          return;
        }
        return operation2(async () => {
          for (const id of tree().reverse()) {
            const r = row(id);
            r.node = runtime.get(id);
            r.state = "disposing";
            await cleanup(id);
          }
          closed = true;
        });
      },
      remove: (id) => operation2(async () => {
        requireThat(id !== rootId, "OBJECT.ACCESS", "Use dispose for root");
        const h = handle(id);
        h.Remove();
        await drain();
      }),
      inspect: (id) => freeze({ id, state: row(id).state, properties: clean(publicProperties(["disposed", "disposing"].includes(row(id).state) ? row(id).node : runtime.get(id), registry)) }),
      status: (id) => row(id).state,
      snapshot: () => dehydrate(runtime),
      errors: () => freeze(clean(errors))
    });
  }

  // wydgine/execution/client-target.js
  init_validation();
  var shape4 = (v, allowed, required = []) => requireThat(record(v) && Object.keys(v).every((k2) => allowed.includes(k2)) && required.every((k2) => Object.hasOwn(v, k2)), "COMPONENT.TARGET", "Unsupported client metadata");
  var validated = /* @__PURE__ */ new WeakMap();
  var scalar2 = (v) => v === null || ["string", "number", "boolean"].includes(typeof v);
  function portableComponent(d, registry) {
    if (d.interface) return;
    let approved = validated.get(registry);
    if (!approved) {
      approved = /* @__PURE__ */ new Set();
      validated.set(registry, approved);
    }
    if (approved.has(d.id)) return;
    const visual = registry.isA(d.id, "wydgit.core/section") || registry.isA(d.id, "wydgit.core/block");
    if (d.presentation?.schema === CONTROL_SCHEMA2) {
      requireThat(visual, "CONTROL.TARGET", "Controls require a visual receiver");
      validateControlBindings(d, registry);
    } else if (d.presentation) {
      requireThat(visual, "COMPONENT.TARGET", "Unsupported browser presentation receiver");
      shape4(d.presentation, ["schema", "template"], ["schema", "template"]);
      let count = 0;
      const walk = (node, depth = 0) => {
        requireThat(depth <= 32 && ++count <= 1024, "COMPONENT.LIMIT", "Presentation bound");
        shape4(node, ["tag", "text", "children"], ["tag"]);
        requireThat(["section", "div", "p", "span", "h2", "h3", "strong", "ul", "ol", "li"].includes(node.tag), "COMPONENT.TARGET", "Unsupported browser element");
        if (Object.hasOwn(node, "text")) {
          const value = node.text;
          if (!scalar2(value)) {
            shape4(value, ["get"], ["get"]);
            requireThat(typeof value.get === "string" && /^properties\.[A-Za-z][A-Za-z0-9_]*$/.test(value.get), "COMPONENT.TARGET", "Only exact public property bindings are portable");
            const rule = d.properties[value.get.slice(11)];
            requireThat(rule && (rule.access ?? "public") === "public" && !rule.hidden && !rule.requires?.length && ["string", "number", "boolean"].includes(rule.type), "COMPONENT.TARGET", "Restricted or nonscalar presentation binding");
          }
        }
        requireThat(node.children === void 0 || Array.isArray(node.children), "COMPONENT.TARGET", "Invalid children");
        for (const child of node.children ?? []) walk(child, depth + 1);
      };
      walk(d.presentation.template);
    }
    for (const b2 of d.component?.subscriptions ?? []) requireThat(!["Server", "Session"].includes(b2.source) && !(b2.source === "Page" && ["Validate"].includes(b2.event)), "COMPONENT.TARGET", "Unsupported browser lifecycle source");
    for (const c2 of d.component?.children ?? []) portablePlacement(d.id, c2.slot, c2.type, registry);
    for (const r of d.component?.repeaters ?? []) portablePlacement(d.id, r.slot, d.component.templates.find((t) => t.name === r.template).type, registry);
    const programs = [d.behavior, ...Object.values(d.lifecycle ?? {})].filter(Boolean);
    const scan = (value) => {
      if (!value || typeof value !== "object" || value.op === "literal") return;
      requireThat(!["service", "serviceCall", "canonicalService", "canonicalServiceCall"].includes(value.op) && !(value.op === "context" && !["ME", "EVENT"].includes(value.name)), "COMPONENT.TARGET", "Server or service operation unavailable");
      for (const item of Object.values(value)) scan(item);
    };
    for (const program of programs) scan(program);
    approved.add(d.id);
  }
  function portablePlacement(parent, slot, child, registry) {
    requireThat((registry.isA(parent, "wydgit.core/page") && slot === "sections" || registry.isA(parent, "wydgit.core/section") && slot === "blocks" || registry.isA(parent, "wydgit.core/block") && slot === "children") && (registry.isA(child, "wydgit.core/section") || registry.isA(child, "wydgit.core/block")), "COMPONENT.TARGET", "Unsupported browser placement");
  }

  // packages/wydclient/src/controls.js
  function controlAdapter({ region, boundary, dispatch, executable }) {
    const drafts = /* @__PURE__ */ new Map();
    let current = [], staged = [], busy = false, generation = 0, focus = null;
    const owns = (el) => {
      if (!el.isConnected) return false;
      for (let p = el; p && p !== region; p = p.parentElement) {
        if (boundary(p)) return false;
        if (p.parentElement === region) return true;
      }
      return false;
    };
    const live = (record2) => record2.generation === generation && owns(record2.element) && executable(record2.id);
    const disable = () => {
      for (const r of current) for (const el of r.inputs ?? [r.element]) el.disabled = busy || !executable(r.id);
    };
    const feedback = (form, message) => {
      for (const f of form.fields) f.element.setAttribute("aria-invalid", message ? "true" : "false");
      form.status.textContent = message;
      form.status.setAttribute("role", message ? "alert" : "status");
    };
    const listen = (r, type, fn) => {
      r.element.addEventListener(type, fn);
      r.detach ??= [];
      r.detach.push(() => r.element.removeEventListener(type, fn));
    };
    const run = async (r, form) => {
      if (busy || !live(r)) return;
      busy = true;
      disable();
      if (form) feedback(form, "");
      try {
        await dispatch(r.id, r.spec, (ledger) => {
          requireThat(live(r), "CONTROL.STALE", "Retired control");
          ledger.take("steps");
          if (!form) return [];
          requireThat([...form.element.elements].every((el) => form.inputs.includes(el)), "CONTROL.INPUT", "Unexpected form fields");
          const raw = Object.fromEntries(form.fields.map((f) => [f.spec.name, f.spec.control === "checkbox" ? f.element.checked : f.element.value]));
          const values = controlRecord(form.spec, raw, () => ledger.take("steps"));
          return [values];
        }, () => requireThat(live(r), "CONTROL.STALE", "Retired control"));
        if (form && (form.spec.reset ?? "success") === "success") {
          for (const f of form.fields) {
            drafts.delete(f.key);
            const fresh = current.find((n) => n.key === f.key);
            if (fresh) {
              fresh.element.value = fresh.initial;
              fresh.element.checked = fresh.initial === true;
            }
          }
        }
      } catch (error) {
        const message = error?.code === "CONTROL.INPUT" ? "Check the required fields, lengths and allowed values." : "Action could not be completed.";
        const target = form && current.find((n) => n.key === form.key);
        if (target && live(target)) feedback(target, message);
      } finally {
        busy = false;
        disable();
      }
    };
    return {
      begin() {
        staged = [];
        focus = null;
        for (const r of current) if (r.element === region.ownerDocument.activeElement) focus = { key: r.key, start: r.element.selectionStart, end: r.element.selectionEnd };
      },
      build(spec, { id, make: make2, text, read }) {
        const render = (s, form = null) => {
          if (s.tag) {
            const el2 = make2(s.tag);
            if (Object.hasOwn(s, "text")) text(el2, read(s.text));
            for (const c2 of s.children ?? []) el2.append(render(c2, form));
            return el2;
          }
          const kind = s.control, key = id + ":" + s.name, record2 = { id, key, spec: s, generation: generation + 1 }, el = make2({ form: "form", label: "label", status: "p", button: "button", submit: "button", reset: "button", text: "input", textarea: "textarea", checkbox: "input", select: "select" }[kind]);
          record2.element = el;
          staged.push(record2);
          if (kind === "form") {
            el.noValidate = true;
            el.setAttribute("aria-label", s.label);
            record2.fields = [];
            record2.inputs = [];
            form = record2;
            const legend = make2("h3");
            text(legend, s.label);
            el.append(legend);
            for (const child of s.children ?? []) el.append(render(child, form));
            const status = make2("p");
            status.setAttribute("role", "status");
            status.setAttribute("aria-live", "polite");
            status.id = `${region.getAttribute("data-wydclient-context")}-${id}-${s.name}-feedback`;
            record2.status = status;
            el.append(status);
            el.setAttribute("aria-describedby", status.id);
            listen(record2, "submit", (event) => {
              if (event.target !== el) return;
              event.preventDefault();
              void run(record2, record2);
            });
            listen(record2, "reset", (event) => {
              if (event.target !== el) return;
              event.preventDefault();
              if (!live(record2) || busy) return;
              for (const f of record2.fields) {
                drafts.delete(f.key);
                f.element.value = f.initial;
                f.element.checked = f.initial === true;
              }
              feedback(record2, "");
            });
          } else if (["text", "textarea", "checkbox", "select"].includes(kind)) {
            const label = make2("label");
            text(label, s.label);
            label.append(el);
            el.name = s.name;
            el.required = s.required;
            el.setAttribute("aria-label", s.label);
            el.setAttribute("data-wydclient-control", s.name);
            if (kind === "text") el.type = "text";
            if (kind === "checkbox") el.type = "checkbox";
            if (kind === "text" || kind === "textarea") el.maxLength = s.maxLength;
            if (kind === "select") for (const value2 of s.options) {
              const option = make2("option");
              option.value = value2;
              text(option, value2);
              el.append(option);
            }
            record2.initial = s.value === void 0 ? kind === "checkbox" ? false : kind === "select" ? s.options[0] : "" : read(s.value);
            requireThat(kind === "checkbox" ? typeof record2.initial === "boolean" : ["string", "number"].includes(typeof record2.initial), "CONTROL.TYPE", "Invalid initial field value");
            const value = drafts.has(key) ? drafts.get(key) : record2.initial;
            if (kind === "checkbox") el.checked = value;
            else el.value = String(value);
            form.fields.push(record2);
            form.inputs.push(el);
            listen(record2, kind === "checkbox" || kind === "select" ? "change" : "input", () => {
              if (live(record2) && !busy) drafts.set(key, kind === "checkbox" ? el.checked : el.value);
            });
            return label;
          } else if (["button", "submit", "reset"].includes(kind)) {
            el.type = kind === "submit" ? "submit" : kind === "reset" ? "reset" : "button";
            text(el, s.label);
            el.setAttribute("data-wydclient-control", s.name);
            if (form) form.inputs.push(el);
            if (kind === "button") listen(record2, "click", (event) => {
              if (event.target !== el) return;
              event.preventDefault();
              void run(record2);
            });
          } else {
            text(el, s.value === void 0 ? s.label : read(s.value));
            if (kind === "status") {
              el.setAttribute("role", "status");
              el.setAttribute("aria-live", "polite");
            }
          }
          return el;
        };
        return render(spec.template);
      },
      commit() {
        for (const r of current) for (const detach of r.detach ?? []) detach();
        current = staged;
        generation++;
        const valid = new Set(current.map((r) => r.key));
        for (const key of drafts.keys()) if (!valid.has(key)) drafts.delete(key);
        disable();
        if (focus) {
          const r = current.find((r2) => r2.key === focus.key);
          if (r) {
            r.element.focus();
            if (typeof focus.start === "number" && r.element.setSelectionRange) r.element.setSelectionRange(focus.start, focus.end);
          }
        }
      },
      clear() {
        for (const r of [...current, ...staged]) for (const detach of r.detach ?? []) detach();
        current = [];
        staged = [];
        drafts.clear();
        generation++;
      }
    };
  }

  // packages/wydclient/src/portable.js
  var scalar3 = (v) => v === null || ["string", "number", "boolean"].includes(typeof v);
  function portableRenderer({ registry, region, boundary, dispatch, executable = () => false }) {
    const controls = controlAdapter({ region, boundary, dispatch, executable });
    const generated = /* @__PURE__ */ new WeakSet();
    let displayed = [];
    const preserve = (element) => {
      for (const child of [...element.childNodes]) {
        if (!generated.has(child) || child.nodeType === 1 && boundary(child)) element.parentNode?.insertBefore(child, element);
        else if (child.nodeType === 1) preserve(child);
      }
    };
    const clear = () => {
      for (const element of displayed) {
        preserve(element);
        element.remove();
      }
      displayed = [];
    };
    return { clear() {
      controls.clear();
      clear();
    }, render(runtime, ledger) {
      controls.begin();
      const doc = region.ownerDocument;
      let nodes = 0, bytes = 0;
      const make2 = (tag) => {
        ledger.take("steps");
        requireThat(++nodes <= 4096, "COMPONENT.LIMIT", "Render node bound");
        const el = doc.createElement(tag);
        generated.add(el);
        return el;
      };
      const text = (el, value) => {
        requireThat(scalar3(value), "COMPONENT.TARGET", "Nonscalar content");
        const content = value === null ? "" : String(value);
        bytes += content.length;
        requireThat(bytes <= 262144, "COMPONENT.LIMIT", "Render content bound");
        el.textContent = content;
        for (const n of el.childNodes) generated.add(n);
      };
      const build = (id, depth = 0) => {
        requireThat(depth <= 32, "COMPONENT.LIMIT", "Render depth bound");
        const node = runtime.get(id), d = registry.get(node.prototype), values = publicProperties(node, registry);
        requireThat(!values.skin, "COMPONENT.TARGET", "Browser skins unavailable");
        const spec = (s, level = 0) => {
          requireThat(level <= 32, "COMPONENT.LIMIT", "Presentation depth");
          const el2 = make2(s.tag);
          if (Object.hasOwn(s, "text")) text(el2, record(s.text) ? node.properties[s.text.get.slice(11)] : s.text);
          for (const c2 of s.children ?? []) el2.append(spec(c2, level + 1));
          return el2;
        };
        const el = d.presentation?.schema === CONTROL_SCHEMA2 ? controls.build(d.presentation, { id, make: make2, text, read: (v) => record(v) ? node.properties[v.get.slice(11)] : v }) : d.presentation ? spec(d.presentation.template) : make2(registry.isA(d.id, "wydgit.core/section") ? "section" : "div");
        el.setAttribute("data-wydclient-object", "");
        const format = values.format ?? {};
        shape(format, ["align", "width", "tone"]);
        for (const [key, value] of Object.entries(format)) requireThat({ align: ["start", "center", "end"], width: ["normal", "wide", "narrow"], tone: ["plain", "muted", "hero"] }[key].includes(value), "COMPONENT.TARGET", "Unsupported format");
        el.className = ["wyd-object", ...Object.entries(format).map(([k2, v]) => `wyd-${k2}-${v}`)].join(" ");
        if (!d.presentation && values.content) {
          const value = values.content;
          shape(value, ["type", "value"], ["type", "value"]);
          requireThat(value.type === "markdown" && typeof value.value === "string", "COMPONENT.TARGET", "Unsupported content");
          const p = make2("p");
          text(p, value.value);
          el.append(p);
        }
        for (const children of Object.values(node.slots)) for (const child of children) el.append(build(child, depth + 1));
        return el;
      };
      const staged = runtime.get(runtime.rootId).slots.sections.map((id) => build(id));
      ledger.check();
      clear();
      for (const el of staged) region.append(el);
      displayed = staged;
      controls.commit();
    } };
  }

  // packages/wydclient/src/execution.js
  function executionPolicy(value) {
    value = clean(value);
    shape(value, ["publisher", "package", "packageVersion", "installation", "capabilities", "visible", "editable", "traversal", "scopes", "limits", "actions"], ["publisher", "installation", "actions"]);
    requireThat(typeof value.installation === "string" && value.installation.length > 0 && Array.isArray(value.actions) && value.actions.length <= 128 && value.actions.every((a) => typeof a === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(a)), "SEAM.CONTEXT", "Invalid execution approval");
    new ExecutionContext({ ...value, self: "validation", app: "validation" });
    return freeze(value);
  }
  async function executableInstances({ registry, page, entry, approval, regions, active, boundary, provenance }) {
    shape(entry, ["id", "type", "properties"], ["id", "type"]);
    requireThat(typeof entry.id === "string", "OBJECT.IDENTITY", "Invalid entry identity");
    const definition = registry.get(entry.type);
    requireThat(definition.publisher === approval.publisher && registry.verifiedPublisher(entry.type) === approval.publisher && registry.isA(entry.type, "wydgit.core/section"), "SEAM.DENIED", "Unapproved entry prototype");
    const source = provenance?.get(entry.type);
    requireThat(!source || source.package === approval.package && source.packageVersion === approval.packageVersion, "SEAM.DENIED", "Signed package version is not approved");
    let count = 0;
    const envelope = (id, type, properties = {}, depth = 0) => {
      requireThat(depth <= 32 && ++count <= 256, "OBJECT.LIMIT", "Initial composition bound");
      const d = registry.get(type);
      if (d.presentation?.schema === CONTROL_SCHEMA2) {
        for (const n of controlNodes(d.presentation)) if (n.action) requireThat(approval.actions.some((a) => a.toLowerCase() === n.action.method.toLowerCase()), "SEAM.DENIED", "Control action lacks host approval");
      }
      requireThat(registry.verifiedPublisher(type) === d.publisher || d.publisher === "wydgit.core", "PROTOTYPE.PUBLISHER", "Unverified constructed prototype");
      const slots = Object.fromEntries(Object.keys(d.slots).map((k2) => [k2, []]));
      for (const child2 of d.component?.children ?? []) slots[child2.slot].push(envelope(`${id}-${child2.name}`, child2.type, child2.properties, depth + 1));
      return { schema: "wydgit/0.2", id, prototype: type, properties: resolveProperties(properties, d), slots, provenance: { publisher: d.publisher, ...approval.package ? { package: approval.package } : {}, ...provenance?.get(type) ?? {}, installation: approval.installation } };
    };
    const child = envelope(entry.id, entry.type, entry.properties);
    const runtime = hydrate({ ...page, slots: { ...page.slots, sections: [child] } }, registry, { rootPrototype: "wydgit.core/page" });
    const context = new ExecutionContext({ ...approval, self: page.id, app: page.id });
    regions.bottom.setAttribute("data-wydclient-context", page.id);
    let controller;
    const approved = (method) => approval.actions.some((name4) => name4.toLowerCase() === method.toLowerCase());
    const renderer = portableRenderer({
      registry,
      region: regions.bottom,
      boundary,
      executable: (id) => controller?.executable(id) ?? false,
      dispatch: async (id, binding, prepare, lifetime) => {
        guard();
        requireThat(controller.executable(id), "CONTROL.STALE", "Inactive control owner");
        requireThat(approved(binding.action.method), "SEAM.DENIED", "Control action is not host-approved");
        return controller.invoke(id, binding.action.method, [], { prepare, guard: lifetime });
      }
    });
    let closed = false;
    const tokens = /* @__PURE__ */ new WeakMap(), guard = () => {
      active();
      requireThat(!closed, "OBJECT.ACCESS", "Disposed execution root");
    };
    controller = createInstanceController({
      runtime,
      registry,
      context,
      rootId: page.id,
      runtimeTarget: "client",
      renderOnInvoke: true,
      componentPolicy: portableComponent,
      placementPolicy: portablePlacement,
      canEdit: () => {
        guard();
        return true;
      },
      canEmit: () => {
        guard();
        return true;
      },
      present: (runtime2, ledger) => {
        guard();
        renderer.render(runtime2, ledger);
      }
    });
    const ref = (id) => {
      const token = Object.freeze(/* @__PURE__ */ Object.create(null));
      tokens.set(token, id);
      return token;
    };
    const resolve = (token) => {
      guard();
      const id = tokens.get(token);
      requireThat(id && controller.executable(id), "OBJECT.ACCESS", "Expected a live local receiver");
      return id;
    };
    const safe = async (work) => {
      guard();
      try {
        return await work();
      } catch (error) {
        const code = typeof error.code === "string" ? error.code : "EXECUTION.FAILED";
        requireThat(false, code, "Execution failed");
      }
    };
    const api = Object.freeze({
      entry: () => {
        guard();
        requireThat(controller.executable(entry.id), "OBJECT.ACCESS", "Inactive entry");
        return ref(entry.id);
      },
      children(token, slot) {
        const id = resolve(token), snapshot = controller.snapshot();
        const find = (n) => n.id === id ? n : Object.values(n.slots).flat().map(find).find(Boolean);
        const node = find(snapshot);
        requireThat(node && Object.hasOwn(node.slots, slot), "OBJECT.ACCESS", "Unknown slot");
        return Object.freeze(node.slots[slot].map((n) => ref(n.id)));
      },
      snapshot(token) {
        return controller.inspect(resolve(token));
      },
      invoke: (token, name4, args = []) => safe(async () => {
        requireThat(approval.actions.includes(name4), "SEAM.DENIED", "Host action not approved");
        return controller.invoke(resolve(token), name4, clean(args));
      }),
      render: () => safe(() => controller.render()),
      unload: () => safe(() => controller.unload()),
      activate: () => safe(() => controller.activate())
    });
    try {
      await controller.activate();
      await controller.page("Start");
      await controller.page("Initialize");
      await controller.page("Load");
      await controller.page("PreRender");
      guard();
    } catch (error) {
      closed = true;
      renderer.clear();
      await controller.dispose().catch(() => {
      });
      throw error;
    }
    return { api, dispose() {
      if (closed) return Promise.resolve();
      closed = true;
      renderer.clear();
      return controller.dispose().catch(() => {
      });
    } };
  }

  // packages/wydclient/src/instances.js
  function instances({ registry, page, regions, active, boundary, provenance }) {
    const tokens = /* @__PURE__ */ new WeakMap();
    let nodes = /* @__PURE__ */ new Map(), serial = 0, closed = false;
    const destinations = /* @__PURE__ */ new Map([["SUB.Page.Top", []], ["SUB.Page.Bottom", []]]);
    let rendered = [];
    const generated = /* @__PURE__ */ new WeakSet();
    const guard = () => {
      active();
      requireThat(!closed, "OBJECT.DISPOSED", "Environment disposed");
    };
    const get = (ref) => {
      guard();
      const id = tokens.get(ref);
      requireThat(id && nodes.has(id) && nodes.get(id).lifecycle !== "owned-draft", "OBJECT.REFERENCE", "Invalid or stale reference");
      return nodes.get(id);
    };
    const token = (id) => {
      const ref = Object.freeze({});
      tokens.set(ref, id);
      return ref;
    };
    const bounded = (value) => parseJSON(new TextEncoder().encode(JSON.stringify(clean(value))));
    const publicValues = (n) => Object.fromEntries(Object.entries(n.properties).filter(([k2]) => {
      const r = registry.get(n.prototype).properties[k2];
      return (r.access ?? "public") === "public" && !r.hidden && !r.requires?.length;
    }));
    function validate2(candidate, complete = false, depth = 0) {
      requireThat(depth <= 32, "OBJECT.LIMIT", "Tree depth exceeded");
      const def = registry.get(candidate.prototype);
      candidate.properties = resolveProperties(candidate.properties, def, { incomplete: !complete });
      for (const [slot, rule] of Object.entries(def.slots)) {
        const children = candidate.slots[slot];
        requireThat(children.length <= (rule.max ?? 256) && (!complete || children.length >= (rule.min ?? 0)), "OBJECT.CARDINALITY", "Invalid child count");
        for (const id of children) {
          const child = nodes.get(id);
          requireThat(rule.accepts.some((base) => registry.isA(child.prototype, base)), "OBJECT.CHILD_TYPE", "Invalid child type");
          validate2(child, complete, depth + 1);
        }
      }
      const values = publicValues(candidate);
      if (values.content !== void 0) shape(values.content, ["type", "value"], ["type", "value"]);
      if (values.content !== void 0) requireThat(values.content.type === "markdown" && typeof values.content.value === "string", "RENDER.CONTENT", "Unsupported content");
      const format = values.format ?? {};
      shape(format, ["align", "width", "tone"]);
      for (const [key, value] of Object.entries(format)) requireThat({ align: ["start", "center", "end"], width: ["normal", "wide", "narrow"], tone: ["plain", "muted", "hero"] }[key].includes(value), "RENDER.FORMAT", "Unsupported style hook");
    }
    function preserve(element) {
      for (const child of [...element.childNodes]) {
        if (child.nodeType === 1 && boundary(child) || !generated.has(child)) element.parentNode?.insertBefore(child, element);
        else if (child.nodeType === 1) preserve(child);
      }
    }
    function clear() {
      for (const element of rendered) {
        preserve(element);
        element.remove();
      }
      rendered = [];
    }
    function render() {
      const staged = [];
      const build = (id) => {
        const n = nodes.get(id), values = publicValues(n), el = regions.top.ownerDocument.createElement(registry.isA(n.prototype, "wydgit.core/section") ? "section" : "div");
        generated.add(el);
        el.setAttribute("data-wydclient-object", "");
        el.className = ["wyd-object", ...Object.entries(values.format ?? {}).map(([k2, v]) => `wyd-${k2}-${v}`)].join(" ");
        if (values.content) {
          const text = el.ownerDocument.createElement("p");
          generated.add(text);
          text.setAttribute("data-wydclient-object", "");
          text.textContent = values.content.value;
          for (const child of text.childNodes) generated.add(child);
          el.append(text);
        }
        for (const children of Object.values(n.slots)) for (const child of children) el.append(build(child));
        return el;
      };
      try {
        for (const [destination, ids] of destinations) for (const id of ids) staged.push([destination.endsWith("Top") ? regions.top : regions.bottom, build(id)]);
      } catch {
        requireThat(false, "RENDER.FAILED", "Rendering failed");
      }
      const inserted = [];
      try {
        for (const [region, el] of staged) {
          region.append(el);
          inserted.push(el);
        }
      } catch {
        for (const el of inserted) el.remove();
        requireThat(false, "RENDER.FAILED", "Rendering failed");
      }
      clear();
      rendered = inserted;
    }
    function transaction(fn) {
      guard();
      const previous = nodes, previousDestinations = [...destinations].map(([k2, v]) => [k2, [...v]]);
      nodes = new Map([...nodes].map(([id, n]) => [id, { ...n, properties: clean(n.properties), slots: clean(n.slots), provenance: clean(n.provenance) }]));
      try {
        const result = fn();
        requireThat(nodes.size <= 256 && JSON.stringify([...nodes.values()]).length <= 262144, "OBJECT.LIMIT", "Instance budget exceeded");
        for (const n of nodes.values()) if (!nodes.has(n.parent)) validate2(n, n.lifecycle === "placed");
        render();
        return result;
      } catch (error) {
        nodes = previous;
        for (const [k2, v] of previousDestinations) destinations.set(k2, v);
        throw error;
      }
    }
    const list = (parent, slot) => {
      guard();
      if (typeof parent === "string") {
        const destination = parent === "SUB.Page.default" ? "SUB.Page.Bottom" : parent;
        requireThat(destinations.has(destination) && slot === void 0, "OBJECT.PARENT", "Invalid destination");
        return { children: destinations.get(destination), parent: page.id, slot: destination };
      }
      const n = get(parent);
      requireThat(Object.hasOwn(n.slots, slot), "OBJECT.SLOT", "Invalid slot");
      return { children: n.slots[slot], parent: n.id, slot, owner: n };
    };
    const api = Object.freeze({
      construct(spec) {
        guard();
        spec = bounded(spec);
        shape(spec, ["type", "properties"], ["type"]);
        const def = registry.get(spec.type);
        requireThat(!def.abstract && !def.static && (registry.isA(def.id, "wydgit.core/section") || registry.isA(def.id, "wydgit.core/block")), "OBJECT.CONSTRUCTION", "Unsupported construction");
        const id = `${page.id}-Instance-${++serial}`;
        transaction(() => {
          const n = { schema: SCHEMA, id, prototype: def.id, properties: spec.properties ?? {}, slots: Object.fromEntries(Object.keys(def.slots).map((k2) => [k2, []])), provenance: { publisher: def.publisher, version: def.version ?? null, ...provenance.get(def.id) ?? {} }, lifecycle: "draft", parent: null, slot: null };
          nodes.set(id, n);
          validate2(n);
        });
        return token(id);
      },
      Insert(parent, slot, index, ref) {
        const child = get(ref), target = list(parent, slot);
        requireThat(child.lifecycle === "draft" && !child.parent, "OBJECT.OWNERSHIP", "Child already owned");
        requireThat(!target.owner || target.owner.lifecycle === "draft" || target.owner.lifecycle === "placed", "OBJECT.PARENT", "Invalid parent");
        for (let n = target.owner; n; n = nodes.get(n.parent)) requireThat(n.id !== child.id, "OBJECT.CYCLE", "Parent cycle");
        requireThat(Number.isSafeInteger(index) && index >= 0 && index <= target.children.length, "MUTATION.INDEX", "Invalid index");
        transaction(() => {
          const t = list(parent, slot), c2 = nodes.get(child.id);
          validate2(c2, true);
          t.children.splice(index, 0, c2.id);
          c2.parent = t.parent;
          c2.slot = t.slot;
          if (t.owner) validate2(t.owner);
          const mark = (n) => {
            n.lifecycle = t.owner?.lifecycle === "draft" ? "owned-draft" : "placed";
            for (const ids of Object.values(n.slots)) for (const id of ids) mark(nodes.get(id));
          };
          mark(c2);
          if (!t.owner || t.owner.lifecycle === "placed") validate2(c2, true);
        });
        tokens.delete(ref);
        return target.owner?.lifecycle === "draft" ? null : token(child.id);
      },
      children(parent, slot) {
        const t = list(parent, slot);
        requireThat(!t.owner || t.owner.lifecycle === "placed", "OBJECT.CONSTRUCTION", "Draft children are consumed");
        return Object.freeze(t.children.map(token));
      },
      Move(ref, index, sibling, after = false) {
        const n = get(ref);
        requireThat(n.lifecycle === "placed", "OBJECT.LIFECYCLE", "Expected placed instance");
        const ids = n.parent === page.id ? destinations.get(n.slot) : nodes.get(n.parent).slots[n.slot];
        const reordered = ids.filter((id) => id !== n.id);
        if (sibling !== void 0) {
          const s = get(sibling);
          requireThat(s.id !== n.id && s.parent === n.parent && s.slot === n.slot, "OBJECT.SIBLING", "Invalid sibling");
          index = reordered.indexOf(s.id) + (after ? 1 : 0);
        }
        requireThat(Number.isSafeInteger(index) && index >= 0 && index <= reordered.length, "MUTATION.INDEX", "Invalid index");
        transaction(() => {
          const current = nodes.get(n.id), list2 = current.parent === page.id ? destinations.get(current.slot) : nodes.get(current.parent).slots[current.slot];
          list2.splice(list2.indexOf(n.id), 1);
          list2.splice(index, 0, n.id);
        });
      },
      Set(ref, name4, value) {
        const n = get(ref);
        requireThat(["draft", "placed"].includes(n.lifecycle), "OBJECT.LIFECYCLE", "Consumed draft");
        transaction(() => {
          const current = nodes.get(n.id);
          current.properties[name4] = bounded(value);
          validate2(current, current.lifecycle === "placed");
        });
      },
      Remove(ref) {
        const n = get(ref);
        requireThat(["draft", "placed"].includes(n.lifecycle), "OBJECT.LIFECYCLE", "Consumed draft");
        transaction(() => {
          if (n.parent) {
            const parent = nodes.get(n.parent), ids = parent ? parent.slots[n.slot] : destinations.get(n.slot);
            ids.splice(ids.indexOf(n.id), 1);
            if (parent) validate2(parent, parent.lifecycle === "placed");
          }
          const drop = (id) => {
            for (const ids of Object.values(nodes.get(id).slots)) for (const child of ids) drop(child);
            nodes.delete(id);
          };
          drop(n.id);
        });
      },
      snapshot(ref) {
        const n = get(ref);
        return freeze({ schema: n.schema, id: n.id, prototype: n.prototype, properties: clean(publicValues(n)), slots: clean(n.slots), provenance: clean(n.provenance), lifecycle: n.lifecycle, parent: n.parent, slot: n.slot });
      }
    });
    return { api, dispose() {
      closed = true;
      clear();
      nodes.clear();
      for (const ids of destinations.values()) ids.length = 0;
      regions = registry = page = provenance = boundary = null;
    } };
  }

  // prototypes/objects.json
  var objects_default = [{ id: "wydgit.core/object", publisher: "wydgit.core", public: true, abstract: true, properties: { order: { type: "number", default: 0 }, position: { type: "string", default: "main", enum: ["header", "main", "aside", "footer"] }, format: { type: "object", default: {} } }, slots: {} }, { id: "wydgit.core/page", publisher: "wydgit.core", public: true, properties: { title: { type: "string", required: true }, slug: { type: "string", required: true }, description: { type: "string", default: "" }, skin: { type: "string", description: "Optional skin ID. Its tokens override inherited site/page/section tokens; omitted tokens keep the parent values." }, searchable: { type: "boolean", default: false }, published: { type: "boolean", default: true } }, slots: { sections: { accepts: ["wydgit.core/section"], ordered: true }, navigation: { accepts: ["wydgit.core/navigation"], ordered: true, max: 1 } }, extends: "wydgit.core/object" }, { id: "wydgit.core/section", publisher: "wydgit.core", public: true, properties: { skin: { type: "string", description: "Optional skin ID. Its tokens override inherited site/page/section tokens; omitted tokens keep the parent values." } }, slots: { blocks: { accepts: ["wydgit.core/block", "wydgit.core/section", "wydgit.core/field"], ordered: true } }, extends: "wydgit.core/object" }, { id: "wydgit.core/block", publisher: "wydgit.core", public: true, properties: { anchors: { type: "array", default: [] }, content: { type: "object", required: true, "supported-types": ["markdown"] }, skin: { type: "string", description: "Optional skin ID. Its tokens override inherited site/page/section tokens; omitted tokens keep the parent values." }, linkToPage: { type: "string", description: "Page ID, resolved like navigation.items[].page. Required for whole-card-link; optional for card (adds a separate page link)." } }, slots: { children: { accepts: ["wydgit.core/block", "wydgit.core/section", "wydgit.core/field"], ordered: true } }, extends: "wydgit.core/object" }, { id: "wydgit.core/navigation", publisher: "wydgit.core", public: true, properties: { label: { type: "string", default: "Navigation" }, items: { type: "array", required: true } }, slots: {}, extends: "wydgit.core/object" }, { id: "wydgit.core/field", publisher: "wydgit.core", public: true, extends: "wydgit.core/object", properties: { name: { type: "string", required: true }, label: { type: "string", default: "" }, value: { type: "string", default: "" }, required: { type: "boolean", default: false }, valid: { type: "boolean", default: true }, errors: { type: "array", default: [] }, warnings: { type: "array", default: [] }, enabled: { type: "boolean", default: true }, visible: { type: "boolean", default: true }, validationMessage: { type: "string", default: "" } }, slots: {} }];

  // packages/wydclient/src/registry.js
  var coreIds = ["object", "page", "section", "block", "field", "navigation"].map((x2) => "wydgit.core/" + x2);
  var coreDefinitions = objects_default.filter((d) => coreIds.includes(d.id));
  function approveRegistry(declarations, verifiedPrototypes, executable = false, approval) {
    requireThat(declarations.length <= LIMITS.prototypes, "MANIFEST.LIMIT", "Prototype limit exceeded");
    for (const d of declarations) {
      requireThat(record(d) && typeof d.id === "string" && d.publisher !== "wydgit.core", "PROTOTYPE.IDENTITY", "Invalid prototype identity");
      requireThat(Object.keys(d).every((k2) => ["id", "publisher", "public", "abstract", "extends", "properties", "slots", "friends", "methodRules", "overrides", "behavior", "interface", "alias", "version", "signatures", "implements", ...executable ? ["component", "presentation", "methodContracts", "lifecycle", "events", "dependencies", "static"] : []].includes(k2)), "PROTOTYPE.DEFINITION", "Unsupported client prototype field");
      if (d.behavior && !executable) requireThat(Array.isArray(d.behavior.body) && d.behavior.body.length === 0 && record(d.behavior.procedures) && Object.values(d.behavior.procedures).every((p) => Array.isArray(p.body) && p.body.length === 0), "PROTOTYPE.METHOD", "Executable behavior is deferred");
    }
    const registry = new PrototypeRegistry([...coreDefinitions, ...declarations], { verifiedPrototypes });
    if (executable) for (const d of declarations) {
      const definition = registry.get(d.id);
      requireThat(registry.verifiedPublisher(d.id) === d.publisher, "PROTOTYPE.PUBLISHER", "Executable definitions require independent publisher verification");
      portableComponent(definition, registry);
      if (approval && definition.presentation?.schema === CONTROL_SCHEMA2) {
        for (const n of controlNodes(definition.presentation)) if (n.action) requireThat(approval.actions.some((a) => a.toLowerCase() === n.action.method.toLowerCase()), "SEAM.DENIED", "Control action lacks host approval");
      }
    }
    for (const d of declarations) resolveProperties({}, registry.get(d.id), { incomplete: true });
    return registry;
  }

  // packages/wydclient/src/runtime.js
  var VERSION = "0.1.0-alpha.9";
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
    shape(config, ["allowedOrigins", "trustedKeys", "verifiedPrototypes", "execution"]);
    const origins = config.allowedOrigins ?? [], keys = config.trustedKeys ?? [], bindings2 = config.verifiedPrototypes ?? {};
    requireThat(Array.isArray(origins) && origins.length <= 16 && origins.every((x2) => typeof x2 === "string" && new URL(x2).origin === x2 && /^https?:/.test(x2)), "BOOTSTRAP.CONFIG", "Invalid trusted origin policy");
    requireThat(Array.isArray(keys) && keys.length <= 64 && record(bindings2) && Object.keys(bindings2).length <= LIMITS.prototypes, "BOOTSTRAP.CONFIG", "Invalid trusted publisher policy");
    const seen = /* @__PURE__ */ new Set();
    for (const key of keys) {
      shape(key, ["publisher", "keyId", "publicKey", "status"], ["publisher", "keyId", "publicKey", "status"]);
      requireThat(publisherPattern.test(key.publisher) && key.publisher !== "wydgit.core" && typeof key.keyId === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(key.keyId) && ["active", "revoked"].includes(key.status), "BOOTSTRAP.CONFIG", "Invalid trusted key binding");
      decode64(key.publicKey, 32);
      const id = key.publisher + "/" + key.keyId;
      requireThat(!seen.has(id), "BOOTSTRAP.CONFIG", "Duplicate trusted key binding");
      seen.add(id);
    }
    for (const [id, publisher] of Object.entries(bindings2)) requireThat(identityPattern.test(id) && id.split("/")[0] === publisher && publisher !== "wydgit.core", "BOOTSTRAP.CONFIG", "Invalid trusted publisher binding");
    return freeze({ allowedOrigins: origins, trustedKeys: keys, verifiedPrototypes: bindings2, ...config.execution ? { execution: executionPolicy(config.execution) } : {} });
  }
  function createRuntime(host, configuration = {}) {
    const owners = /* @__PURE__ */ new WeakMap(), regions = /* @__PURE__ */ new WeakSet();
    let sequence = 0;
    const isBoundary = (element) => element.hasAttribute("data-wydgit-root") || owners.has(element);
    function mount(options) {
      requireThat(record(options) && Object.keys(options).every((k2) => ["root", "policy", "page", "properties"].includes(k2)), "MOUNT.CONFIG", "Invalid mount configuration");
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
    let snapshotError, properties, regions = null, objects;
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
    const api = Object.freeze(embedded ? { ready, host: hostAdapter, execution: executionAdapter, get state() {
      return state;
    }, unmount } : { host: hostAdapter, execution: executionAdapter, version: VERSION, protocol: PROTOCOL, ready, get state() {
      return state;
    }, mount: scope.mount });
    function executionAdapter() {
      requireThat(state === "ready" && entryAPI(), "OBJECT.CONTEXT", "Expected executable environment");
      return objects.api;
    }
    function entryAPI() {
      return objects?.api?.invoke;
    }
    function hostAdapter() {
      requireThat(!entryAPI(), "OBJECT.CONTEXT", "Executable environment uses the trusted execution facade");
      requireThat(state === "ready" && objects, "OBJECT.CONTEXT", "Expected approved live environment");
      return objects.api;
    }
    const active = () => requireThat(state !== "disposed", "BOOTSTRAP.DISPOSED", "Page environment disposed");
    function unmount() {
      if (state === "disposed") return result;
      state = "disposed";
      controller.abort();
      objects?.dispose();
      objects = null;
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
      let registry, page, entry, approval, error = null;
      const provenance = /* @__PURE__ */ new Map();
      try {
        if (snapshotError) throw snapshotError;
        const policy = policyFrom(configuration);
        const belongsToDocument = (element) => {
          for (let parent = element; parent; parent = parent.parentElement) if (scope.isBoundary(parent)) return false;
          return true;
        };
        const inline = embedded ? [...scope.root.children].filter((e) => !scope.isBoundary(e) && e.hasAttribute("data-wydgit-manifest")) : [...doc.querySelectorAll('[id="wydgit-manifest"]')].filter(belongsToDocument);
        const external2 = embedded ? [...scope.root.children].filter((e) => !scope.isBoundary(e) && e.matches('link[rel~="wydgit-manifest"]')) : [...doc.querySelectorAll('link[rel~="wydgit-manifest"]')].filter(belongsToDocument);
        requireThat(inline.length + external2.length <= 1, "MANIFEST.DUPLICATE", "Multiple authoritative manifests");
        let manifest = { schema: "wydgit.registry/0.1", protocol: "0.1", prototypes: [] };
        if (inline.length) {
          requireThat(inline[0].tagName === "SCRIPT" && inline[0].getAttribute("type") === "application/json", "MANIFEST.TYPE", "Expected JSON manifest");
          requireThat(inline[0].textContent.length <= LIMITS.bytes, "MANIFEST.LIMIT", "Manifest limit exceeded");
          manifest = parseJSON(new TextEncoder().encode(inline[0].textContent));
        } else if (external2.length) {
          requireThat(external2[0].hasAttribute("href") && external2[0].getAttribute("href").length > 0, "NETWORK.URL", "Missing manifest URL");
          manifest = parseJSON(await download(external2[0].getAttribute("href"), host, policy, controller.signal));
          active();
        }
        shape(manifest, ["schema", "protocol", "prototypes", "packages", "entry"], ["schema", "prototypes"]);
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
          for (const d of definitions) {
            verified[d.id] = ref.publisher;
            provenance.set(d.id, { publisher: ref.publisher, package: ref.id, packageVersion: ref.version });
          }
        }
        approval = policy.execution;
        entry = manifest.entry;
        requireThat(!approval || entry, "SEAM.DENIED", "Execution approval requires an entry");
        requireThat(!entry || approval, "SEAM.DENIED", "Executable entry requires host approval");
        registry = approveRegistry(declarations, verified, Boolean(approval), approval);
        const selected = embedded ? scope.page ?? scope.root.getAttribute("data-wydgit-page") ?? "wydgit.core/page" : doc.documentElement.getAttribute("data-wydgit-page") ?? "wydgit.core/page";
        let definition;
        try {
          definition = registry.get(selected);
          requireThat(!definition.component?.children.length && !definition.component?.repeaters.length, "PAGE.PROTOTYPE", "Initial Page composition is unsupported");
          requireThat(registry.isA(selected, "wydgit.core/page") && !definition.abstract, "PAGE.PROTOTYPE", "Expected concrete Page prototype");
          requireThat(![...Object.keys(definition.properties), ...Object.keys(definition.slots), ...Object.keys(definition.methods)].some((k2) => ["top", "bottom", "sub"].includes(k2.toLowerCase())), "PAGE.MOUNT", "Reserved Page destination");
          const values = resolveProperties(embedded ? {
            title: scope.root.getAttribute("data-wydgit-title") ?? "",
            slug: scope.root.getAttribute("data-wydgit-slug") ?? host.location.pathname,
            ...properties
          } : { title: String(doc.title), slug: host.location.pathname }, definition);
          const slots = Object.fromEntries(Object.entries(definition.slots).map(([k2, rule]) => {
            requireThat((rule.min ?? 0) === 0, "PAGE.SLOT", "Static Page requires empty slots");
            return [k2, []];
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
      state = error ? "failed" : entry ? "initializing" : "ready";
      if (!error && entry) {
        try {
          const executable = await executableInstances({ registry, page, entry, approval, regions, active, boundary: scope.isBoundary, provenance });
          if (state === "disposed") {
            void executable.dispose();
            return result;
          }
          objects = executable;
          state = "ready";
        } catch (failure) {
          if (state === "disposed") return result;
          error = freeze({ code: typeof failure.code === "string" ? failure.code : "BOOTSTRAP.FAILED", message: messages.bootstrap });
          state = "failed";
        }
      }
      if (!error && !entry) objects = instances({ registry, page, regions, provenance, active: () => requireThat(state === "ready", "OBJECT.CONTEXT", "Expected live environment"), boundary: scope.isBoundary });
      runtimes.set(api, Object.freeze({ registry, page, destinations, regions, approved: !error }));
      const publicProperties2 = Object.fromEntries(Object.entries(page.properties).filter(([key]) => {
        const rule = registry.get(page.prototype).properties[key];
        return (rule.access ?? "public") === "public" && !rule.hidden && !rule.requires?.length;
      }));
      result = freeze({ ok: !error, state, page: { ...page, properties: publicProperties2 }, SUB: destinations, registry: { approved: !error }, diagnostics: error ? [error] : [] });
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
