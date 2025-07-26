-- FastGraphBff Database Schema
-- PostgreSQL schema for workflows and agents with soft delete support

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums for type safety
CREATE TYPE workflow_status AS ENUM ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled');
CREATE TYPE agent_status AS ENUM ('idle', 'running', 'waiting', 'completed', 'failed', 'timeout');
CREATE TYPE agent_type AS ENUM ('analysis', 'processing', 'monitoring', 'optimization', 'communication', 'validation');
CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE log_level AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');
CREATE TYPE result_type AS ENUM ('data', 'metric', 'insight', 'recommendation', 'alert');

-- Workflows table
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status workflow_status NOT NULL DEFAULT 'pending',
    priority priority NOT NULL DEFAULT 'medium',
    progress DECIMAL(5,2) DEFAULT 0.0 CHECK (progress >= 0 AND progress <= 100),
    estimated_time_remaining INTEGER, -- in seconds
    completed_tasks INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 1,
    current_phase VARCHAR(100),
    creator VARCHAR(255) NOT NULL DEFAULT 'system',
    tags TEXT[] DEFAULT '{}',
    configuration JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    status_change_reason TEXT,
    
    -- Metrics (stored as JSONB for flexibility)
    metrics JSONB DEFAULT '{
        "executionTime": 0,
        "successRate": 0,
        "errorRate": 0,
        "throughput": 0,
        "costMetrics": {"totalCost": 0, "costPerExecution": 0},
        "resourceUsage": {"cpuUsage": 0, "memoryUsage": 0, "storageUsage": 0}
    }',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255),
    delete_reason TEXT
);

-- Agents table
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type agent_type NOT NULL,
    status agent_status NOT NULL DEFAULT 'idle',
    progress DECIMAL(5,2) DEFAULT 0.0 CHECK (progress >= 0 AND progress <= 100),
    estimated_time_remaining INTEGER, -- in seconds
    current_phase VARCHAR(100),
    capabilities TEXT[] DEFAULT '{}',
    tools TEXT[] DEFAULT '{}',
    status_change_reason TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Execution context
    execution_context JSONB DEFAULT '{
        "environment": "production",
        "version": "1.0.0",
        "configuration": {},
        "dependencies": []
    }',
    
    -- Performance metrics
    performance JSONB DEFAULT '{
        "executionTime": 0,
        "responseTime": 0,
        "successRate": 0,
        "errorCount": 0,
        "resourceUsage": {"cpu": 0, "memory": 0, "apiCalls": 0, "tokens": 0},
        "qualityScore": 0
    }',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255),
    delete_reason TEXT
);

-- Workflow status history
CREATE TABLE workflow_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status workflow_status NOT NULL,
    previous_status workflow_status,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent status history
CREATE TABLE agent_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    status agent_status NOT NULL,
    previous_status agent_status,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Log entries
CREATE TABLE log_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    level log_level NOT NULL,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    error_info JSONB, -- {code, message, stack, context}
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent results
CREATE TABLE agent_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    type result_type NOT NULL,
    data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    quality_metrics JSONB DEFAULT '{
        "accuracy": 0,
        "completeness": 0,
        "relevance": 0,
        "confidence": 0
    }',
    execution_time INTEGER, -- in milliseconds
    memory_usage INTEGER, -- in bytes
    cpu_usage DECIMAL(5,2), -- percentage
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_workflows_status ON workflows(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflows_creator ON workflows(creator) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflows_created_at ON workflows(created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflows_priority ON workflows(priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflows_tags ON workflows USING GIN(tags) WHERE deleted_at IS NULL;

CREATE INDEX idx_agents_workflow_id ON agents(workflow_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_agents_status ON agents(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_agents_type ON agents(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_agents_created_at ON agents(created_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_status_history_workflow ON workflow_status_history(workflow_id, timestamp);
CREATE INDEX idx_status_history_agent ON agent_status_history(agent_id, timestamp);

CREATE INDEX idx_logs_agent_id ON log_entries(agent_id, timestamp);
CREATE INDEX idx_logs_workflow_id ON log_entries(workflow_id, timestamp);
CREATE INDEX idx_logs_level ON log_entries(level, timestamp);

CREATE INDEX idx_results_agent_id ON agent_results(agent_id, timestamp);
CREATE INDEX idx_results_workflow_id ON agent_results(workflow_id, timestamp);
CREATE INDEX idx_results_type ON agent_results(type, timestamp);

-- Functions for updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for soft delete
CREATE OR REPLACE FUNCTION soft_delete_workflow(workflow_uuid UUID, deleted_by_user VARCHAR(255), reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE workflows 
    SET deleted_at = NOW(), 
        deleted_by = deleted_by_user, 
        delete_reason = reason,
        updated_at = NOW()
    WHERE id = workflow_uuid AND deleted_at IS NULL;
    
    -- Also soft delete associated agents
    UPDATE agents 
    SET deleted_at = NOW(), 
        deleted_by = deleted_by_user, 
        delete_reason = 'Workflow deleted: ' || COALESCE(reason, 'No reason provided'),
        updated_at = NOW()
    WHERE workflow_id = workflow_uuid AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION soft_delete_agent(agent_uuid UUID, deleted_by_user VARCHAR(255), reason TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE agents 
    SET deleted_at = NOW(), 
        deleted_by = deleted_by_user, 
        delete_reason = reason,
        updated_at = NOW()
    WHERE id = agent_uuid AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to restore soft deleted items
CREATE OR REPLACE FUNCTION restore_workflow(workflow_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE workflows 
    SET deleted_at = NULL, 
        deleted_by = NULL, 
        delete_reason = NULL,
        updated_at = NOW()
    WHERE id = workflow_uuid AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION restore_agent(agent_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE agents 
    SET deleted_at = NULL, 
        deleted_by = NULL, 
        delete_reason = NULL,
        updated_at = NOW()
    WHERE id = agent_uuid AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Views for easier querying (only non-deleted items)
CREATE VIEW active_workflows AS
SELECT * FROM workflows WHERE deleted_at IS NULL;

CREATE VIEW active_agents AS
SELECT * FROM agents WHERE deleted_at IS NULL;

-- Example seed data (optional)
INSERT INTO workflows (id, name, description, status, priority, creator) VALUES
(uuid_generate_v4(), 'Data Analysis Pipeline', 'Automated data processing and analysis workflow', 'pending', 'high', 'system'),
(uuid_generate_v4(), 'Report Generation', 'Weekly business report generation', 'running', 'medium', 'system'); 