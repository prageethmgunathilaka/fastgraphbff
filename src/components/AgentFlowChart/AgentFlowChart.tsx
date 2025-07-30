import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  NodeProps,
  Handle,
  Position,
} from 'reactflow';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  Box,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Fab,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Error as ErrorIcon,
  CheckCircle as IdleIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { Agent, AgentStatus } from '../../types/core';

// Import React Flow styles
import 'reactflow/dist/style.css';

interface AgentFlowChartProps {
  agents: Agent[];
  workflowId: string;
  onAgentConnect?: (source: string, target: string) => void;
  onAgentDisconnect?: (source: string, target: string) => void;
  onNodeClick?: (agent: Agent) => void;
  onLoadConnections?: (agentId: string) => Promise<any[]>;
  onAddAgent?: (position: { x: number; y: number }, agentData: Partial<Agent>) => void;
  onAgentDelete?: (agentId: string) => void;
}

// Custom Agent Node Component
const AgentNode: React.FC<NodeProps> = ({ data, selected }) => {
  const agent: Agent = data.agent;
  
  const getStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case AgentStatus.RUNNING:
        return <PlayIcon sx={{ fontSize: 16, color: '#4caf50' }} />;
      case AgentStatus.IDLE:
        return <IdleIcon sx={{ fontSize: 16, color: '#2196f3' }} />;
      case AgentStatus.FAILED:
        return <ErrorIcon sx={{ fontSize: 16, color: '#f44336' }} />;
      default:
        return <PauseIcon sx={{ fontSize: 16, color: '#9e9e9e' }} />;
    }
  };

  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case AgentStatus.RUNNING:
        return 'success';
      case AgentStatus.IDLE:
        return 'primary';
      case AgentStatus.FAILED:
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card 
      sx={{ 
        minWidth: 250,
        maxWidth: 300,
        border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
        boxShadow: selected ? 3 : 1,
        '&:hover': {
          boxShadow: 3,
        }
      }}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#555',
          width: 10,
          height: 10,
        }}
      />
      
      <CardContent sx={{ padding: 2 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
            {agent.name?.charAt(0).toUpperCase() || 'A'}
          </Avatar>
          <Box flex={1}>
            <Typography variant="subtitle2" fontWeight="bold" noWrap>
              {agent.name || 'Unnamed Agent'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              ID: {agent.id?.substring(0, 8)}...
            </Typography>
          </Box>
          {getStatusIcon(agent.status)}
        </Box>

        <Box mb={1}>
          <Chip
            label={agent.status}
            size="small"
            color={getStatusColor(agent.status) as any}
            sx={{ fontSize: 10, height: 20 }}
          />
        </Box>

        {(agent as any).llm_config && (
          <Typography variant="caption" display="block" color="text.secondary">
            Model: {(agent as any).llm_config.provider || 'Unknown'} / {(agent as any).llm_config.model || 'Unknown'}
          </Typography>
        )}

        {agent.capabilities && (
          <Typography variant="caption" display="block" color="text.secondary" noWrap>
            Capabilities: {Array.isArray(agent.capabilities) 
              ? agent.capabilities.join(', ') 
              : agent.capabilities}
          </Typography>
        )}

        <Box mt={1} display="flex" gap={0.5}>
          <Tooltip title="Start Agent">
            <IconButton size="small" color="primary">
              <PlayIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Pause Agent">
            <IconButton size="small" color="default">
              <PauseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#555',
          width: 10,
          height: 10,
        }}
      />
    </Card>
  );
};

const nodeTypes = {
  agentNode: AgentNode,
};

const AgentFlowChart: React.FC<AgentFlowChartProps> = ({
  agents,
  workflowId,
  onAgentConnect,
  onAgentDisconnect,
  onNodeClick,
  onLoadConnections,
  onAddAgent,
  onAgentDelete,
}) => {
  // Convert agents to React Flow nodes
  const initialNodes: Node[] = useMemo(
    () =>
      agents.map((agent, index) => ({
        id: agent.id,
        type: 'agentNode',
        position: {
          x: (index % 3) * 320 + 50, // Arrange in a grid, 3 agents per row
          y: Math.floor(index / 3) * 200 + 50,
        },
        data: {
          agent,
          label: agent.name || 'Agent',
        },
        draggable: true,
      })),
    [agents]
  );

  const initialEdges: Edge[] = []; // Start with no connections

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [loadingConnections, setLoadingConnections] = React.useState(false);
  
  // Add Agent Dialog State
  const [addAgentDialogOpen, setAddAgentDialogOpen] = React.useState(false);
  const [newAgentPosition, setNewAgentPosition] = React.useState({ x: 0, y: 0 });
  const [newAgentData, setNewAgentData] = React.useState({
    name: '',
    description: '',
    capabilities: '',
  });

  // Context Menu State
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);
  const [contextMenuPosition, setContextMenuPosition] = React.useState({ x: 0, y: 0 });
  const [selectedAgent, setSelectedAgent] = React.useState<Agent | null>(null);

  // Load existing connections from backend
  const loadExistingConnections = useCallback(async () => {
    if (!onLoadConnections || agents.length === 0) return;

    setLoadingConnections(true);
    try {
      const allConnections: any[] = [];
      
      // Load connections for each agent (sort by name for consistent processing order)
      const sortedAgents = [...agents].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
      
      for (const agent of sortedAgents) {
        try {
          const connections = await onLoadConnections(agent.id);
          // Backend returns agent objects, not connection objects
          // So we just add them to allConnections without modifying them
          allConnections.push(...connections);
        } catch (error) {
          console.warn(`Failed to load connections for agent ${agent.id}:`, error);
        }
      }

      // Convert backend agent data to React Flow edges
      // Backend returns agent objects with 'connected_agents' arrays, not direct connection objects
      console.log(`🔧 Processing ${allConnections.length} agent responses for React Flow:`);
      
      const flowEdges: Edge[] = [];
      const processedConnections = new Set<string>(); // Track processed connections to avoid duplicates
      
      allConnections.forEach((agentData, index) => {
        const sourceAgentId = agentData.id; // Use the agent's own ID as the source
        const connectedAgents = agentData.connected_agents || [];
        
        console.log(`🔗 Processing agent ${index + 1}: ${agentData.name || 'unnamed'}`);
        console.log(`   Source ID: ${sourceAgentId}`);
        console.log(`   Connected to: [${connectedAgents.join(', ')}]`);
        
        if (!sourceAgentId || !connectedAgents.length) {
          console.log(`   ⚠️ No connections found for agent ${sourceAgentId}`);
          return;
        }
        
        // Create edges for each connected agent (with deduplication)
        connectedAgents.forEach((targetAgentId: string, connIndex: number) => {
          // Create connection keys for both directions to check for duplicates
          const forwardKey = `${sourceAgentId}-${targetAgentId}`;
          const reverseKey = `${targetAgentId}-${sourceAgentId}`;
          
          if (processedConnections.has(forwardKey) || processedConnections.has(reverseKey)) {
            console.log(`   🔄 Skipping duplicate connection: ${sourceAgentId} → ${targetAgentId}`);
            return;
          }
          
          // Mark both directions as processed to prevent duplicates, but keep original direction
          processedConnections.add(forwardKey);
          processedConnections.add(reverseKey);
          
          console.log(`   🔗 Creating connection ${connIndex + 1}: ${sourceAgentId} → ${targetAgentId} (original direction preserved)`);
          
          const edge = {
            id: `edge-${sourceAgentId}-${targetAgentId}`,
            source: sourceAgentId,
            target: targetAgentId,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#1976d2', strokeWidth: 2 },
            label: 'connected',
            data: {
              connectionType: 'agent_connection',
              sourceAgent: sourceAgentId,
              targetAgent: targetAgentId
            }
          };
          
          console.log(`   ✅ Created edge:`, edge);
          flowEdges.push(edge);
        });
      });

      console.log(`🎯 Setting ${flowEdges.length} edges in React Flow (deduplicated):`, flowEdges);
      setEdges(flowEdges);
      console.log(`✅ Loaded ${flowEdges.length} existing agent connections`);
      
    } catch (error) {
      console.error('❌ Failed to load agent connections:', error);
    } finally {
      setLoadingConnections(false);
    }
  }, [agents, onLoadConnections, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = addEdge(
        {
          ...params,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#1976d2', strokeWidth: 2 },
        },
        edges
      );
      setEdges(newEdge);
      
      // Notify parent component about the connection
      if (onAgentConnect && params.source && params.target) {
        onAgentConnect(params.source, params.target);
      }
    },
    [edges, setEdges, onAgentConnect]
  );

  // Handle connection deletion via right-click context menu
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: any) => {
    event.preventDefault();
    
    const sourceAgent = agents.find(a => a.id === edge.source);
    const targetAgent = agents.find(a => a.id === edge.target);
    const sourceName = sourceAgent?.name || edge.source?.slice(0, 8) || 'Unknown';
    const targetName = targetAgent?.name || edge.target?.slice(0, 8) || 'Unknown';
    
    const confirmDelete = window.confirm(
      `🗑️ Delete connection?\n\nFrom: ${sourceName}\nTo: ${targetName}`
    );
    
    if (confirmDelete) {
      console.log(`🗑️ Deleting connection: ${edge.source} → ${edge.target}`);
      
      // Remove edge from UI immediately for instant feedback
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      
      // Call backend to delete connection
      if (onAgentDisconnect) {
        onAgentDisconnect(edge.source, edge.target);
      }
    }
  }, [agents, setEdges, onAgentDisconnect]);

  // Handle Delete key for selected connections
  const onEdgesDelete = useCallback((edgesToDelete: any[]) => {
    console.log(`🗑️ Deleting ${edgesToDelete.length} selected connection(s)`);
    
    edgesToDelete.forEach(edge => {
      if (onAgentDisconnect) {
        onAgentDisconnect(edge.source, edge.target);
      }
    });
  }, [onAgentDisconnect]);

  const onNodeClickHandler = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (onNodeClick && node.data.agent) {
        onNodeClick(node.data.agent);
      }
    },
    [onNodeClick]
  );

  // Handle canvas double-click to add agent
  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!onAddAgent) return;
      
      // Get the canvas position from the click event
      const reactFlowBounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left - 125, // Center the node (250px width / 2)
        y: event.clientY - reactFlowBounds.top - 100,  // Center the node vertically
      };

      setNewAgentPosition(position);
      setAddAgentDialogOpen(true);
    },
    [onAddAgent]
  );

  // Handle add agent form submission
  const handleAddAgent = useCallback(() => {
    if (!onAddAgent || !newAgentData.name.trim()) return;

    const agentData: Partial<Agent> = {
      name: newAgentData.name.trim(),
      description: newAgentData.description.trim() || undefined,
      capabilities: newAgentData.capabilities.trim() ? newAgentData.capabilities.split(',').map(c => c.trim()) : undefined,
      status: AgentStatus.IDLE,
    };

    onAddAgent(newAgentPosition, agentData);
    
    // Reset form and close dialog
    setNewAgentData({ name: '', description: '', capabilities: '' });
    setAddAgentDialogOpen(false);
  }, [onAddAgent, newAgentPosition, newAgentData]);

  // Handle dialog close
  const handleCloseAddDialog = useCallback(() => {
    setAddAgentDialogOpen(false);
    setNewAgentData({ name: '', description: '', capabilities: '' });
  }, []);

  // Handle node right-click to show context menu
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: any) => {
    event.preventDefault();
    
    const agent = node.data.agent;
    if (!agent) return;
    
    // Set the selected agent and show context menu at cursor position
    setSelectedAgent(agent);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuOpen(true);
  }, []);

  // Handle context menu close
  const handleContextMenuClose = useCallback(() => {
    setContextMenuOpen(false);
    setSelectedAgent(null);
  }, []);

  // Handle delete from context menu
  const handleDeleteFromContextMenu = useCallback(() => {
    if (!selectedAgent || !onAgentDelete) return;
    
    const confirmDelete = window.confirm(
      `🗑️ Delete Agent?\n\nAgent: ${selectedAgent.name || 'Unnamed Agent'}\nID: ${selectedAgent.id?.substring(0, 8)}...\n\nThis action cannot be undone.`
    );
    
    if (confirmDelete) {
      console.log(`🗑️ Deleting agent: ${selectedAgent.id} (${selectedAgent.name})`);
      onAgentDelete(selectedAgent.id);
    }
    
    handleContextMenuClose();
  }, [selectedAgent, onAgentDelete, handleContextMenuClose]);

  // Handle Delete key for selected agents
  const onNodesDelete = useCallback((nodesToDelete: any[]) => {
    if (!onAgentDelete) return;
    
    console.log(`🗑️ Deleting ${nodesToDelete.length} selected agent(s)`);
    
    // Show confirmation for multiple agents
    if (nodesToDelete.length > 1) {
      const agentNames = nodesToDelete.map(node => node.data.agent?.name || 'Unnamed').join(', ');
      const confirmDelete = window.confirm(
        `🗑️ Delete ${nodesToDelete.length} Agents?\n\nAgents: ${agentNames}\n\nThis action cannot be undone.`
      );
      
      if (!confirmDelete) return;
    }
    
    nodesToDelete.forEach(node => {
      const agent = node.data.agent;
      if (agent?.id) {
        console.log(`🗑️ Deleting agent: ${agent.id} (${agent.name})`);
        onAgentDelete(agent.id);
      }
    });
  }, [onAgentDelete]);

  // Update nodes when agents change
  React.useEffect(() => {
    setNodes(currentNodes => {
      const updatedNodes = agents.map((agent, index) => ({
        id: agent.id,
        type: 'agentNode',
        position: currentNodes.find(n => n.id === agent.id)?.position || {
          x: (index % 3) * 320 + 50,
          y: Math.floor(index / 3) * 200 + 50,
        },
        data: {
          agent,
          label: agent.name || 'Agent',
        },
        draggable: true,
      }));
      return updatedNodes;
    });
  }, [agents]);

  // Load existing connections when component mounts or agents change
  // Use a stable string of agent IDs to avoid frequent refreshes
  const agentIds = React.useMemo(() => 
    agents.map(a => a.id).sort().join(','), 
    [agents]
  );
  
  // Load connections with proper debouncing and dependency management
  const [hasLoadedConnections, setHasLoadedConnections] = React.useState(false);
  
  React.useEffect(() => {
    if (agents.length === 0) {
      setHasLoadedConnections(false);
      return;
    }
    
    // Only load connections when agents actually change, not on every render
    if (!hasLoadedConnections) {
      console.log(`🚀 Loading connections for agents: ${agentIds}`);
      
      const loadConnections = async () => {
        try {
          await loadExistingConnections();
          setHasLoadedConnections(true);
        } catch (error) {
          console.error('Failed to load connections:', error);
          // Retry after 5 seconds on error
          setTimeout(() => setHasLoadedConnections(false), 5000);
        }
      };
      
      loadConnections();
    }
  }, [agentIds, hasLoadedConnections]); // Only depend on agent IDs, not loadExistingConnections

  return (
    <Box sx={{ height: 400, border: '1px solid #e0e0e0', borderRadius: 1, position: 'relative' }}>
      {/* DEBUG: Manual controls for testing */}
      <Box sx={{ p: 1, borderBottom: '1px solid #e0e0e0', display: 'flex', gap: 1, backgroundColor: '#f5f5f5', alignItems: 'center' }}>
        <button 
          onClick={() => {
            console.log('🔥 MANUAL CONNECTION RELOAD');
            setHasLoadedConnections(false); // Force reload
          }}
          style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px' }}
        >
          🔄 Reload Connections
        </button>
        <button 
          onClick={() => {
            console.log('🧹 CLEARING ALL EDGES');
            setEdges([]);
          }}
          style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '3px' }}
        >
          🧹 Clear Edges
        </button>
        <span style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>
          Nodes: {nodes.length} | Edges: {edges.length} | Loaded: {hasLoadedConnections ? '✅' : '❌'}
        </span>
        <span style={{ fontSize: '12px', color: '#999', marginLeft: '16px' }}>
          💡 Double-click to add agent • Right-click agents/connections to delete • Select and press Del key
        </span>
      </Box>
      
      {loadingConnections && (
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: 1,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Loading connections...
          </Typography>
        </Box>
      )}
              <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClickHandler}
        onNodeContextMenu={onNodeContextMenu}
        onNodesDelete={onNodesDelete}
        onEdgeContextMenu={onEdgeContextMenu}
        onEdgesDelete={onEdgesDelete}
        onPaneDoubleClick={onPaneDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.2,
        }}
        style={{ height: 'calc(100% - 50px)' }} // Account for debug controls
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>

      {/* Empty State Overlay */}
      {agents.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            zIndex: 500,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: 3,
            borderRadius: 2,
            border: '2px dashed #e0e0e0',
            maxWidth: 300,
          }}
        >
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
            No agents yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Get started by adding your first agent to this workflow
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            💡 Double-click anywhere or use the + button
          </Typography>
        </Box>
      )}

      {/* Floating Add Button */}
      {onAddAgent && (
        <Fab
          color="primary"
          aria-label="add agent"
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 1000,
          }}
          onClick={() => {
            setNewAgentPosition({ x: 100, y: 100 });
            setAddAgentDialogOpen(true);
          }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Add Agent Dialog */}
      <Dialog 
        open={addAgentDialogOpen} 
        onClose={handleCloseAddDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Agent</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              autoFocus
              label="Agent Name"
              placeholder="Enter agent name"
              value={newAgentData.name}
              onChange={(e) => setNewAgentData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Description"
              placeholder="What does this agent do?"
              value={newAgentData.description}
              onChange={(e) => setNewAgentData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={2}
              fullWidth
            />
            <TextField
              label="Capabilities"
              placeholder="data_analysis, web_scraping, etc. (comma-separated)"
              value={newAgentData.capabilities}
              onChange={(e) => setNewAgentData(prev => ({ ...prev, capabilities: e.target.value }))}
              fullWidth
              helperText="Enter capabilities separated by commas"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog}>Cancel</Button>
          <Button 
            onClick={handleAddAgent} 
            variant="contained"
            disabled={!newAgentData.name.trim()}
          >
            Add Agent
          </Button>
        </DialogActions>
      </Dialog>

      {/* Agent Context Menu */}
      <Menu
        open={contextMenuOpen}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={{
          top: contextMenuPosition.y,
          left: contextMenuPosition.x,
        }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
            },
          },
        }}
      >
        <MenuItem onClick={() => {
          if (selectedAgent && onNodeClick) {
            onNodeClick(selectedAgent);
          }
          handleContextMenuClose();
        }}>
          <ListItemIcon>
            <InfoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => {
          // Future: Edit agent functionality
          handleContextMenuClose();
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Agent</ListItemText>
        </MenuItem>
        
        <MenuItem 
          onClick={handleDeleteFromContextMenu}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Delete Agent</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default AgentFlowChart; 