let runtimeBindings = null;
let externalExecutionEnabled = true;

export function setRuntimeBindings(bindings = null) {
  runtimeBindings = bindings;
  if (bindings && bindings.externalExecutionEnabled !== undefined) {
    externalExecutionEnabled = bindings.externalExecutionEnabled;
  }
}

export function setting(name) {
  const value = runtimeBindings?.[name];
  if (value !== undefined) return value;
  if (name === 'EXTERNAL_EXECUTION_ENABLED') return externalExecutionEnabled;
  return process.env[name];
}

export function setExternalExecutionEnabled(enabled) {
  externalExecutionEnabled = enabled;
}
