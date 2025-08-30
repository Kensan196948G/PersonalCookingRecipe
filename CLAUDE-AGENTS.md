# Claude Code Agents Configuration

## Available Agents (54 Total)

### 🚀 Concurrent Agent Usage

**CRITICAL**: Always spawn multiple agents concurrently using the Task tool in a single message:

```javascript
// ✅ CORRECT: Concurrent agent deployment
[Single Message]:
  - Task("Agent 1", "full instructions", "agent-type-1")
  - Task("Agent 2", "full instructions", "agent-type-2") 
  - Task("Agent 3", "full instructions", "agent-type-3")
  - Task("Agent 4", "full instructions", "agent-type-4")
  - Task("Agent 5", "full instructions", "agent-type-5")
```

### 📋 Agent Categories & Concurrent Patterns

#### **Core Development Agents**
- `coder` - Implementation specialist
- `reviewer` - Code quality assurance
- `tester` - Test creation and validation
- `planner` - Strategic planning
- `researcher` - Information gathering

**Concurrent Usage:**
```bash
# Deploy full development swarm
Task("Research requirements", "...", "researcher")
Task("Plan architecture", "...", "planner") 
Task("Implement features", "...", "coder")
Task("Create tests", "...", "tester")
Task("Review code", "...", "reviewer")
```

#### **Swarm Coordination Agents**
- `hierarchical-coordinator` - Queen-led coordination
- `mesh-coordinator` - Peer-to-peer networks
- `adaptive-coordinator` - Dynamic topology
- `collective-intelligence-coordinator` - Hive-mind intelligence
- `swarm-memory-manager` - Distributed memory

**Concurrent Swarm Deployment:**
```bash
# Deploy multi-topology coordination
Task("Hierarchical coordination", "...", "hierarchical-coordinator")
Task("Mesh network backup", "...", "mesh-coordinator")
Task("Adaptive optimization", "...", "adaptive-coordinator")
```

#### **Consensus & Distributed Systems**
- `byzantine-coordinator` - Byzantine fault tolerance
- `raft-manager` - Leader election protocols
- `gossip-coordinator` - Epidemic dissemination
- `consensus-builder` - Decision-making algorithms
- `crdt-synchronizer` - Conflict-free replication
- `quorum-manager` - Dynamic quorum management
- `security-manager` - Cryptographic security

#### **Performance & Optimization**
- `perf-analyzer` - Bottleneck identification
- `performance-benchmarker` - Performance testing
- `task-orchestrator` - Workflow optimization
- `memory-coordinator` - Memory management
- `smart-agent` - Intelligent coordination

#### **GitHub & Repository Management**
- `github-modes` - Comprehensive GitHub integration
- `pr-manager` - Pull request management
- `code-review-swarm` - Multi-agent code review
- `issue-tracker` - Issue management
- `release-manager` - Release coordination
- `workflow-automation` - CI/CD automation
- `project-board-sync` - Project tracking
- `repo-architect` - Repository optimization
- `multi-repo-swarm` - Cross-repository coordination

#### **SPARC Methodology Agents**
- `sparc-coord` - SPARC orchestration
- `sparc-coder` - TDD implementation
- `specification` - Requirements analysis
- `pseudocode` - Algorithm design
- `architecture` - System design
- `refinement` - Iterative improvement

#### **Specialized Development**
- `backend-dev` - API development
- `mobile-dev` - React Native development
- `ml-developer` - Machine learning
- `cicd-engineer` - CI/CD pipelines
- `api-docs` - OpenAPI documentation
- `system-architect` - High-level design
- `code-analyzer` - Code quality analysis
- `base-template-generator` - Boilerplate creation

#### **Testing & Validation**
- `tdd-london-swarm` - Mock-driven TDD
- `production-validator` - Real implementation validation

#### **Migration & Planning**
- `migration-planner` - System migrations
- `swarm-init` - Topology initialization

### 🎯 Concurrent Agent Patterns

#### **Full-Stack Development Swarm (8 agents)**
```bash
Task("System architecture", "...", "system-architect")
Task("Backend APIs", "...", "backend-dev") 
Task("Frontend mobile", "...", "mobile-dev")
Task("Database design", "...", "coder")
Task("API documentation", "...", "api-docs")
Task("CI/CD pipeline", "...", "cicd-engineer")
Task("Performance testing", "...", "performance-benchmarker")
Task("Production validation", "...", "production-validator")
```

#### **Distributed System Swarm (6 agents)**
```bash
Task("Byzantine consensus", "...", "byzantine-coordinator")
Task("Raft coordination", "...", "raft-manager")
Task("Gossip protocols", "...", "gossip-coordinator") 
Task("CRDT synchronization", "...", "crdt-synchronizer")
Task("Security management", "...", "security-manager")
Task("Performance monitoring", "...", "perf-analyzer")
```

#### **GitHub Workflow Swarm (5 agents)**
```bash
Task("PR management", "...", "pr-manager")
Task("Code review", "...", "code-review-swarm")
Task("Issue tracking", "...", "issue-tracker")
Task("Release coordination", "...", "release-manager")
Task("Workflow automation", "...", "workflow-automation")
```

#### **SPARC TDD Swarm (7 agents)**
```bash
Task("Requirements spec", "...", "specification")
Task("Algorithm design", "...", "pseudocode")
Task("System architecture", "...", "architecture") 
Task("TDD implementation", "...", "sparc-coder")
Task("London school tests", "...", "tdd-london-swarm")
Task("Iterative refinement", "...", "refinement")
Task("Production validation", "...", "production-validator")
```

### ⚡ Performance Optimization

**Agent Selection Strategy:**
- **High Priority**: Use 3-5 agents max for critical path
- **Medium Priority**: Use 5-8 agents for complex features
- **Large Projects**: Use 8+ agents with proper coordination

**Memory Management:**
- Use `memory-coordinator` for cross-agent state
- Implement `swarm-memory-manager` for distributed coordination
- Apply `collective-intelligence-coordinator` for decision-making

### 🎯 Agent Count Configuration

**CRITICAL: Dynamic Agent Count Rules**

1. **Check CLI Arguments First**: If user runs `npx claude-flow@alpha --agents 5`, use 5 agents
2. **Auto-Decide if No Args**: Without CLI args, analyze task complexity:
   - Simple tasks (1-3 components): 3-4 agents
   - Medium tasks (4-6 components): 5-7 agents
   - Complex tasks (7+ components): 8-12 agents
3. **Agent Type Distribution**: Balance agent types based on task:
   - Always include 1 coordinator
   - For code-heavy tasks: more coders
   - For design tasks: more architects/analysts
   - For quality tasks: more testers/reviewers

**Example Auto-Decision Logic:**

```javascript
// If CLI args provided: npx claude-flow@alpha --agents 6
maxAgents = CLI_ARGS.agents || determineAgentCount(task);

function determineAgentCount(task) {
  // Analyze task complexity
  if (task.includes(['API', 'database', 'auth', 'tests'])) return 8;
  if (task.includes(['frontend', 'backend'])) return 6;
  if (task.includes(['simple', 'script'])) return 3;
  return 5; // default
}
```

## Related Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Main configuration and core principles
- **[CLAUDE-SPARC.md](./CLAUDE-SPARC.md)** - SPARC methodology integration with agents
- **[CLAUDE-SWARM.md](./CLAUDE-SWARM.md)** - Swarm orchestration patterns
- **[CLAUDE-PERFORMANCE.md](./CLAUDE-PERFORMANCE.md)** - Performance optimization strategies

For more information about SPARC methodology and batchtools optimization with agents, see: 
- SPARC Guide: https://github.com/ruvnet/claude-code-flow/docs/sparc.md
- Batchtools Documentation: https://github.com/ruvnet/claude-code-flow/docs/batchtools.md