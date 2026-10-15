// Explicit trusted LOCAL development policy. Package metadata grants no authority.
globalThis.WydClientConfig = {
  verifiedPrototypes: {'example/hello': 'example'},
  execution: {
    publisher: 'example', package: 'example/hello-client', installation: 'local-hello',
    actions: ['Greet'], capabilities: ['object.instances.edit'],
    traversal: [], visible: ['hello'], editable: ['hello'], scopes: {}
  }
};
