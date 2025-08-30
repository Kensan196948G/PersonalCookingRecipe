# Claude Code Configuration - SPARC Development Environment (Batchtools Optimized)

## 🚨 CRITICAL: CONCURRENT EXECUTION FOR ALL ACTIONS

**ABSOLUTE RULE**: ALL operations MUST be concurrent/parallel in a single message:

### 🔴 MANDATORY CONCURRENT PATTERNS:
1. **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
2. **Task tool**: ALWAYS spawn ALL agents in ONE message with full instructions
3. **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
4. **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
5. **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**Examples of CORRECT concurrent execution:**
```javascript
// ✅ CORRECT: Everything in ONE message
[Single Message]:
  - TodoWrite { todos: [10+ todos with all statuses/priorities] }
  - Task("Agent 1 with full instructions and hooks")
  - Task("Agent 2 with full instructions and hooks")
  - Task("Agent 3 with full instructions and hooks")
  - Read("file1.js")
  - Read("file2.js")
  - Write("output1.js", content)
  - Write("output2.js", content)
  - Bash("npm install")
  - Bash("npm test")
  - Bash("npm run build")
```

**Examples of WRONG sequential execution:**
```javascript
// ❌ WRONG: Multiple messages (NEVER DO THIS)
Message 1: TodoWrite { todos: [single todo] }
Message 2: Task("Agent 1")
Message 3: Task("Agent 2")
Message 4: Read("file1.js")
Message 5: Write("output1.js")
Message 6: Bash("npm install")
// This is 6x slower and breaks coordination!
```

### 🎯 CONCURRENT EXECUTION CHECKLIST:

Before sending ANY message, ask yourself:
- ✅ Are ALL related TodoWrite operations batched together?
- ✅ Are ALL Task spawning operations in ONE message?
- ✅ Are ALL file operations (Read/Write/Edit) batched together?
- ✅ Are ALL bash commands grouped in ONE message?
- ✅ Are ALL memory operations concurrent?

If ANY answer is "No", you MUST combine operations into a single message!

## Project Overview
This project uses the SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology for systematic Test-Driven Development with AI assistance through Claude-Flow orchestration.

**🚀 Batchtools Optimization Enabled**: This configuration includes optimized prompts and parallel processing capabilities for improved performance and efficiency.

## 🚀 CRITICAL: Claude Code Does ALL Real Work

### 🎯 CLAUDE CODE IS THE ONLY EXECUTOR

**ABSOLUTE RULE**: Claude Code performs ALL actual work:

### ✅ Claude Code ALWAYS Handles:

- 🔧 **ALL file operations** (Read, Write, Edit, MultiEdit, Glob, Grep)
- 💻 **ALL code generation** and programming tasks
- 🖥️ **ALL bash commands** and system operations
- 🏗️ **ALL actual implementation** work
- 🔍 **ALL project navigation** and code analysis
- 📝 **ALL TodoWrite** and task management
- 🔄 **ALL git operations** (commit, push, merge)
- 📦 **ALL package management** (npm, pip, etc.)
- 🧪 **ALL testing** and validation
- 🔧 **ALL debugging** and troubleshooting

### 🧠 Claude Flow MCP Tools ONLY Handle:

- 🎯 **Coordination only** - Planning Claude Code's actions
- 💾 **Memory management** - Storing decisions and context
- 🤖 **Neural features** - Learning from Claude Code's work
- 📊 **Performance tracking** - Monitoring Claude Code's efficiency
- 🐝 **Swarm orchestration** - Coordinating multiple Claude Code instances
- 🔗 **GitHub integration** - Advanced repository coordination

### 🚨 CRITICAL SEPARATION OF CONCERNS:

**❌ MCP Tools NEVER:**
- Write files or create content
- Execute bash commands
- Generate code
- Perform file operations
- Handle TodoWrite operations
- Execute system commands
- Do actual implementation work

**✅ MCP Tools ONLY:**
- Coordinate and plan
- Store memory and context
- Track performance
- Orchestrate workflows
- Provide intelligence insights

### ⚠️ Key Principle:

**MCP tools coordinate, Claude Code executes.** Think of MCP tools as the "brain" that plans and coordinates, while Claude Code is the "hands" that do all the actual work.

## 🚀 CRITICAL: Parallel Execution & Batch Operations

### 🚨 MANDATORY RULE #1: BATCH EVERYTHING

**When using swarms, you MUST use BatchTool for ALL operations:**

1. **NEVER** send multiple messages for related operations
2. **ALWAYS** combine multiple tool calls in ONE message
3. **PARALLEL** execution is MANDATORY, not optional

### ⚡ THE GOLDEN RULE OF SWARMS

```
If you need to do X operations, they should be in 1 message, not X messages
```

### 🚨 MANDATORY TODO AND TASK BATCHING

**CRITICAL RULE FOR TODOS AND TASKS:**

1. **TodoWrite** MUST ALWAYS include ALL todos in ONE call (5-10+ todos)
2. **Task** tool calls MUST be batched - spawn multiple agents in ONE message
3. **NEVER** update todos one by one - this breaks parallel coordination
4. **NEVER** spawn agents sequentially - ALL agents spawn together

## Important Notes (Enhanced)

- Always run tests before committing with parallel execution (`npm run test --parallel`)
- Use SPARC memory system with concurrent operations to maintain context across sessions
- Follow the Red-Green-Refactor cycle with parallel test generation during TDD phases
- Document architectural decisions with concurrent validation in memory
- Regular security reviews with parallel analysis for authentication or data handling code
- Claude Code slash commands provide quick access to batchtools-optimized SPARC modes
- Monitor system resources during parallel operations for optimal performance

## Module References

For detailed information, see the following specialized modules:

- **[CLAUDE-AGENTS.md](./CLAUDE-AGENTS.md)** - Complete agent definitions and deployment patterns (54 agents)
- **[CLAUDE-SPARC.md](./CLAUDE-SPARC.md)** - SPARC methodology, commands, and workflows
- **[CLAUDE-SWARM.md](./CLAUDE-SWARM.md)** - Swarm coordination, orchestration patterns, and protocols  
- **[CLAUDE-PERFORMANCE.md](./CLAUDE-PERFORMANCE.md)** - Performance optimization, benchmarks, and monitoring

Each module maintains cross-references and can be used independently or together for maximum flexibility and performance.

## Quick Start

1. **Initialize coordination**: Use `mcp__claude-flow__swarm_init` for coordination setup
2. **Spawn agents**: Deploy agents from [CLAUDE-AGENTS.md](./CLAUDE-AGENTS.md) using parallel patterns
3. **Apply SPARC**: Follow methodology from [CLAUDE-SPARC.md](./CLAUDE-SPARC.md) for structured development
4. **Optimize performance**: Implement strategies from [CLAUDE-PERFORMANCE.md](./CLAUDE-PERFORMANCE.md)
5. **Coordinate swarms**: Use protocols from [CLAUDE-SWARM.md](./CLAUDE-SWARM.md) for complex tasks

Remember: **Claude Flow coordinates, Claude Code creates!** All modules work together to enhance your development workflow while maintaining the core principle of concurrent execution and batch operations.