class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  registerTool(tool) {
    if (!tool?.name || typeof tool.invoke !== "function") {
      throw new TypeError("A tool requires a name and an invoke function.");
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  unregisterTool(name) { return this.tools.delete(name); }

  executeTool(name, input) {
    const registered = this.tools.get(name);
    if (!registered) throw new Error(`Unknown tool: ${name}`);
    return registered.invoke(input);
  }

  describeTools() {
    return this.getAvailableTools().map((tool) => ({ name: tool.name, description: tool.description, supportsFallback: tool.supportsFallback !== false }));
  }

  getAvailableTools() { return [...this.tools.values()]; }
}

module.exports = { ToolRegistry };