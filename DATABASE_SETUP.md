# FastGraphBff Database Setup Guide

This guide walks you through setting up PostgreSQL persistence for workflows and agents with soft delete functionality.

## Overview

The system now includes:
- **PostgreSQL database** with comprehensive schema for workflows, agents, logs, and results
- **Soft delete functionality** - records are marked as deleted but preserved for recovery
- **Full CRUD operations** via REST API
- **Status tracking** with history
- **Performance metrics** and analytics
- **Automated cleanup** and maintenance tasks

## Prerequisites

1. **PostgreSQL** (version 12 or higher)
2. **Node.js** (version 18 or higher)
3. **npm** or **yarn**

## Quick Setup

### 1. Install Dependencies
```bash
npm run setup
```

### 2. Setup Database

**Option A: Using npm script (recommended)**
```bash
# Create database and run schema
npm run db:setup
```

**Option B: Manual setup**
```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database
CREATE DATABASE fastgraph;

# Exit and run schema
\q
psql -U postgres -d fastgraph -f server/database/schema.sql
```

### 3. Configure Environment

```bash
# Copy configuration template
cp server/config.env.txt server/.env

# Edit server/.env with your database credentials
nano server/.env
```

**Required environment variables:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fastgraph
DB_USER=postgres
DB_PASSWORD=your_password
```

### 4. Start Development

```bash
# Start both frontend and backend
npm run dev:full

# Or start individually:
npm run server:dev  # Backend on :3001
npm run dev         # Frontend on :5173
```

## Database Schema

### Core Tables

#### `workflows`
- Primary workflow management with soft delete
- Status tracking (pending, running, completed, failed, etc.)
- Progress monitoring and metrics
- Configuration and metadata storage

#### `agents`
- Agent instances linked to workflows
- Performance tracking and resource usage
- Execution context and capabilities
- Soft delete with workflow relationship

#### `log_entries`
- Structured logging for agents and workflows
- Log levels (debug, info, warn, error, fatal)
- Context and error information

#### `agent_results`
- Results and outputs from agent execution
- Quality metrics and performance data
- Different result types (data, metric, insight, etc.)

#### Status History Tables
- `workflow_status_history` - Track workflow status changes
- `agent_status_history` - Track agent status changes

### Key Features

#### Soft Delete
Records are never actually deleted, just marked with `deleted_at` timestamp:
```sql
-- Soft delete a workflow (and all its agents)
SELECT soft_delete_workflow('workflow-uuid', 'user', 'reason');

-- Restore a workflow
SELECT restore_workflow('workflow-uuid');
```

#### Views for Active Records
```sql
-- Only show non-deleted records
SELECT * FROM active_workflows;
SELECT * FROM active_agents;
```

## API Endpoints

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/workflows` | List workflows with filtering |
| `GET` | `/api/workflows/:id` | Get specific workflow |
| `POST` | `/api/workflows` | Create new workflow |
| `PUT` | `/api/workflows/:id` | Update workflow |
| `DELETE` | `/api/workflows/:id` | Soft delete workflow |
| `POST` | `/api/workflows/:id/restore` | Restore deleted workflow |

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents` | List agents with filtering |
| `GET` | `/api/agents/:id` | Get specific agent |
| `POST` | `/api/agents` | Create new agent |
| `PUT` | `/api/agents/:id` | Update agent |
| `DELETE` | `/api/agents/:id` | Soft delete agent |
| `POST` | `/api/agents/:id/logs` | Add log entry |
| `POST` | `/api/agents/:id/results` | Add result |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/dashboard` | Dashboard metrics |
| `GET` | `/api/analytics/performance` | Performance metrics |
| `GET` | `/api/analytics/business` | Business metrics |

## Usage Examples

### Creating a Workflow
```javascript
const workflow = await workflowApi.createWorkflow({
  name: "Data Processing Pipeline",
  description: "Process customer data",
  priority: "high",
  tags: ["data", "processing"],
  creator: "system"
});
```

### Creating an Agent
```javascript
const agent = await agentApi.createAgent(workflowId, {
  name: "Data Validator",
  type: "validation",
  capabilities: ["data-validation", "schema-check"],
  tools: ["pandas", "jsonschema"]
});
```

### Filtering and Pagination
```javascript
// Get active workflows with pagination
const response = await workflowApi.getWorkflows({
  page: 1,
  pageSize: 20,
  status: 'running',
  priority: 'high'
});

// Get agents for specific workflow
const agents = await agentApi.getAgents(workflowId);
```

## Database Maintenance

### Automated Cleanup
The system runs daily cleanup tasks at 2 AM:
- Remove soft-deleted records older than 30 days
- Clean old log entries (90+ days)
- Clean old results (90+ days)
- Optimize database performance

### Manual Maintenance
```bash
# Reset database (WARNING: Deletes all data)
npm run db:reset

# Access PostgreSQL directly
psql -U postgres -d fastgraph
```

### SQL Maintenance Commands
```sql
-- View database statistics
SELECT * FROM pg_stat_user_tables;

-- Manual cleanup (be careful!)
DELETE FROM workflows WHERE deleted_at < NOW() - INTERVAL '30 days';

-- Analyze table for performance
ANALYZE workflows;
```

## Production Considerations

### Environment Configuration
```env
NODE_ENV=production
DB_SSL=true
DB_POOL_MAX=100
LOG_LEVEL=warn
```

### Security
- Use connection pooling (configured)
- Enable SSL for database connections
- Implement API authentication (JWT recommended)
- Regular security updates

### Monitoring
- Database connection health: `GET /health`
- Performance metrics: `GET /api/analytics/performance`
- Log monitoring with Winston
- Resource usage tracking

### Backup Strategy
```bash
# Backup database
pg_dump -U postgres fastgraph > backup_$(date +%Y%m%d).sql

# Restore from backup
psql -U postgres -d fastgraph < backup_file.sql
```

## Troubleshooting

### Common Issues

**Database connection failed:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U postgres -h localhost -p 5432
```

**Port already in use:**
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

**Permission denied:**
```sql
-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE fastgraph TO your_user;
```

### Development Tools

**View logs:**
```bash
# Backend logs
tail -f server/logs/combined.log

# Error logs only
tail -f server/logs/error.log
```

**Database inspection:**
```bash
# Connect to database
psql -U postgres -d fastgraph

# View tables
\dt

# Describe table structure
\d workflows
```

## Future Enhancements

### Vector Database Integration
The schema is designed to accommodate future vector storage:
- Additional JSONB fields for vector data
- Vector similarity search capabilities
- Agent memory and context storage

### Additional Features
- Real-time WebSocket updates
- Advanced analytics and reporting
- Multi-tenant support
- Workflow templates and cloning
- Agent marketplace and sharing

## Support

For issues or questions:
1. Check the logs in `server/logs/`
2. Verify database connectivity
3. Ensure all environment variables are set
4. Review the API documentation above

The system is designed to be robust and handle failures gracefully while preserving data integrity through soft deletes and comprehensive logging. 